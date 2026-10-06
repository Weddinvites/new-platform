import { err, ok, type Result } from "@allinvites/kernel";
import type { ListActiveOrganizationIdsService } from "@allinvites/module-identity";
import type { Organization } from "../../domain/entities/organization";
import type { OrganizationRepository } from "../../domain/repositories/organization-repository";
import type { ListOrganizationsCommand } from "../commands/list-organizations.command";
import type { SessionVerifier } from "../ports/session-verifier";

export type ListOrganizationsError =
  | { readonly type: "UNAUTHORIZED" }
  | { readonly type: "UNEXPECTED"; readonly cause: unknown };

export type ListOrganizationsResult = {
  readonly items: Organization[];
  readonly total: number;
};

/**
 * STORY-003-002 — List Organizations (EPIC_003_ORGANIZATIONS.md §5). Scope
 * resolution is delegated to Identity's `listActiveOrganizationIds`
 * (ADR-011); pagination is applied only after that ACTIVE-membership scoping,
 * via `OrganizationRepository.findByIds`'s bounded, database-level
 * LIMIT/OFFSET — never in-memory over the full result set. A caller with no
 * ACTIVE memberships short-circuits to an empty result without querying
 * Organizations' own table at all.
 */
export class ListOrganizationsUseCase {
  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly listActiveOrganizationIds: ListActiveOrganizationIdsService,
    private readonly sessionVerifier: SessionVerifier,
  ) {}

  async execute(
    accessToken: string,
    command: ListOrganizationsCommand,
  ): Promise<Result<ListOrganizationsResult, ListOrganizationsError>> {
    const caller = await this.sessionVerifier.verify(accessToken);
    if (!caller.ok) {
      if (caller.error.type === "UNAUTHORIZED") {
        return err({ type: "UNAUTHORIZED" });
      }
      return err({ type: "UNEXPECTED", cause: caller.error.cause });
    }

    const idsResult = await this.listActiveOrganizationIds({ userId: caller.value.userId });
    if (!idsResult.ok) {
      return err({ type: "UNEXPECTED", cause: idsResult.error.cause });
    }

    if (idsResult.value.organizationIds.length === 0) {
      return ok({ items: [], total: 0 });
    }

    const { items, total } = await this.organizationRepository.findByIds(
      idsResult.value.organizationIds,
      { page: command.page, pageSize: command.pageSize },
    );

    return ok({ items, total });
  }
}
