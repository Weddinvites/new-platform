import { err, ok, type Result } from "@allinvites/kernel";
import type { OrganizationMembership } from "../../domain/entities/organization-membership";
import type { OrganizationMembershipRepository } from "../../domain/repositories/organization-membership-repository";
import type { AuthorizationPolicy } from "../policies/authorization-policy";
import type { Permission } from "../policies/permission";
import type { SessionProvider } from "../ports/session-provider";
import {
  type ResolveOrganizationContextError,
  resolveOrganizationContext,
} from "../services/resolve-organization-context";

export type ResolveAuthorizedCallerError = ResolveOrganizationContextError;

/**
 * STORY-002-007 shared flow for every team-management use case: resolve the
 * caller's Organization Context (STORY-002-008's `resolveOrganizationContext`
 * — authenticate, resolve the caller's membership for `organizationId` per
 * the approved platform-wide convention, require it ACTIVE), then authorize
 * the requested Permission against it. Centralized here so all 8 use cases
 * share identical caller-resolution/authorization semantics rather than
 * duplicating it.
 *
 * A caller with no membership in `organizationId`, a non-ACTIVE membership,
 * or a membership the registry does not grant `permission` to are all
 * reported identically as FORBIDDEN — this deliberately never reveals which
 * of the three applies, avoiding leaking organization-membership
 * information to a caller who is not authorized in that organization.
 *
 * External behavior/signature unchanged by the STORY-002-008 extraction —
 * this now composes `resolveOrganizationContext` with a permission check
 * instead of duplicating the context-resolution logic inline.
 */
export async function resolveAuthorizedCaller(params: {
  sessionProvider: SessionProvider;
  membershipRepository: OrganizationMembershipRepository;
  authorizationPolicy: AuthorizationPolicy;
  accessToken: string;
  organizationId: string;
  permission: Permission;
}): Promise<Result<OrganizationMembership, ResolveAuthorizedCallerError>> {
  const context = await resolveOrganizationContext({
    sessionProvider: params.sessionProvider,
    membershipRepository: params.membershipRepository,
    accessToken: params.accessToken,
    organizationId: params.organizationId,
  });

  if (!context.ok) {
    return err(context.error);
  }

  if (!params.authorizationPolicy.authorize(context.value, params.permission)) {
    return err({ type: "FORBIDDEN" });
  }

  return ok(context.value);
}
