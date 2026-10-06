import { isPostgresErrorCode, type Transaction } from "@allinvites/database";
import { err, ok, type Result } from "@allinvites/kernel";
import { OrganizationMembership } from "../../domain/entities/organization-membership";
import type { OrganizationMembershipRepository } from "../../domain/repositories/organization-membership-repository";

export type CreateInitialOwnerMembershipParams = {
  readonly userId: string;
  readonly organizationId: string;
};

export type CreateInitialOwnerMembershipResult = {
  readonly membershipId: string;
};

export type CreateInitialOwnerMembershipError =
  | { readonly type: "USER_NOT_FOUND" }
  | { readonly type: "UNEXPECTED"; readonly cause: unknown };

export type CreateInitialOwnerMembershipService = (
  params: CreateInitialOwnerMembershipParams,
  tx: Transaction,
) => Promise<Result<CreateInitialOwnerMembershipResult, CreateInitialOwnerMembershipError>>;

const FOREIGN_KEY_VIOLATION = "23503";

/**
 * STORY-003-001 (Organizations) — the sole new addition to Identity's public
 * surface required by EPIC-003 (EPIC_003_ORGANIZATIONS.md §5). Creates the
 * initial OWNER `OrganizationMembership` for a brand-new Organization,
 * participating in the caller-supplied transaction so Organization creation
 * and OWNER membership creation remain atomic across the module boundary
 * (ADR-011) without a second transaction mechanism or an event bus.
 *
 * `userId` existence is enforced by the `organization_memberships.user_id`
 * foreign key (schema.ts) rather than a redundant pre-check `SELECT` — the
 * same "database constraint is the sole enforcement mechanism" approach
 * already approved for the Organization slug uniqueness check.
 */
export function createCreateInitialOwnerMembershipService(
  organizationMembershipRepository: OrganizationMembershipRepository,
): CreateInitialOwnerMembershipService {
  return async function createInitialOwnerMembership(params, tx) {
    const membership = OrganizationMembership.create({
      id: crypto.randomUUID(),
      userId: params.userId,
      organizationId: params.organizationId,
      role: "OWNER",
    });

    try {
      await organizationMembershipRepository.create(membership, tx);
    } catch (error) {
      if (isPostgresErrorCode(error, FOREIGN_KEY_VIOLATION)) {
        return err({ type: "USER_NOT_FOUND" });
      }
      return err({ type: "UNEXPECTED", cause: error });
    }

    return ok({ membershipId: membership.id });
  };
}
