import { err, ok, type Result } from "@allinvites/kernel";
import type { UserRepository } from "../../domain/repositories/user-repository";

export type ListActiveOrganizationIdsParams = {
  readonly userId: string;
};

export type ListActiveOrganizationIdsResult = {
  readonly organizationIds: string[];
};

export type ListActiveOrganizationIdsError = {
  readonly type: "UNEXPECTED";
  readonly cause: unknown;
};

export type ListActiveOrganizationIdsService = (
  params: ListActiveOrganizationIdsParams,
) => Promise<Result<ListActiveOrganizationIdsResult, ListActiveOrganizationIdsError>>;

/**
 * STORY-003-002 (Organizations) — the second new addition to Identity's
 * public surface required by this Story. Built on the existing
 * `UserRepository.findMembershipsByUserId` (STORY-002-003) rather than a new
 * repository method — no EPIC-002 contract is modified, only consumed
 * read-only. Filters to ACTIVE memberships only (SUSPENDED/REMOVED
 * excluded) and returns bare organization id strings — never an
 * `OrganizationMembership` entity, role, or membership id.
 */
export function createListActiveOrganizationIdsService(
  userRepository: UserRepository,
): ListActiveOrganizationIdsService {
  return async function listActiveOrganizationIds(params) {
    try {
      const memberships = await userRepository.findMembershipsByUserId(params.userId);
      const organizationIds = memberships
        .filter((membership) => membership.status === "ACTIVE")
        .map((membership) => membership.organizationId);

      return ok({ organizationIds });
    } catch (error) {
      return err({ type: "UNEXPECTED", cause: error });
    }
  };
}
