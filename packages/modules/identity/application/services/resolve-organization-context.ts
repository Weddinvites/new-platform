import { err, ok, type Result } from "@allinvites/kernel";
import type { OrganizationMembership } from "../../domain/entities/organization-membership";
import type { OrganizationMembershipRepository } from "../../domain/repositories/organization-membership-repository";
import type { SessionProvider } from "../ports/session-provider";

export type ResolveOrganizationContextError =
  | { readonly type: "UNAUTHORIZED" }
  | { readonly type: "FORBIDDEN" }
  | { readonly type: "UNEXPECTED"; readonly cause: unknown };

/**
 * STORY-002-008 — Organization Context resolution. The general primitive
 * behind "exactly one active Organization Context per request"
 * (Architecture.md §16 "Multi-Tenant Isolation"; ADR-001; API_SPEC.md §7):
 * authenticate the caller, resolve their `OrganizationMembership` for the
 * supplied `organizationId` (approved platform-wide convention: a
 * request-scoped `organization_id`, never trusted merely because the
 * client supplied it — always re-verified against persisted membership
 * rows), and require that membership to be ACTIVE. Returns the resolved
 * membership — organization, role, and status together (MASTER_SPEC
 * §26.2a) — as the caller's authorization context. Fail-secure: a missing,
 * SUSPENDED, or REMOVED membership is reported identically as FORBIDDEN,
 * never distinguishing which, so no cross-organization information leaks.
 *
 * Deliberately does NOT perform permission authorization — that remains a
 * separate, caller-specific concern (STORY-002-006's `AuthorizationPolicy`).
 * STORY-002-007's `resolveAuthorizedCaller` composes this primitive with a
 * permission check; this function exists so future organization-scoped
 * operations that don't need RBAC (or that need a different one) are not
 * forced to duplicate context-resolution logic. Purely request-scoped: it
 * reads nothing from and writes nothing to any session/persisted "current
 * organization" state — every call is independent.
 */
export async function resolveOrganizationContext(params: {
  sessionProvider: SessionProvider;
  membershipRepository: OrganizationMembershipRepository;
  accessToken: string;
  organizationId: string;
}): Promise<Result<OrganizationMembership, ResolveOrganizationContextError>> {
  const identity = await params.sessionProvider.getUserFromAccessToken(params.accessToken);

  if (!identity.ok) {
    if (identity.error.type === "UNAUTHORIZED") {
      return err({ type: "UNAUTHORIZED" });
    }
    return err({ type: "UNEXPECTED", cause: identity.error.cause });
  }

  const membership = await params.membershipRepository.findByUserAndOrganization(
    identity.value.id,
    params.organizationId,
  );

  if (membership?.status !== "ACTIVE") {
    return err({ type: "FORBIDDEN" });
  }

  return ok(membership);
}
