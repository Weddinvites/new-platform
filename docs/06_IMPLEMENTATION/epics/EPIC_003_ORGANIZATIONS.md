# EPIC 003 — Organizations

**Status:** Closed — Implemented (2026-10-08). All six Stories (001–006) are closed; see §8 "Epic Definition of Done" for verification.
**Module:** `organizations`
**Priority:** Critical
**Phase:** MVP

---

# 1. Objective

Implement the Organizations bounded context responsible for creating, retrieving, and configuring Organizations — the tenant boundary for the entire AllInvites platform (ADR-001 Multi-Tenant Ownership Model).

The Epic establishes the tenant foundation required by every partner-facing module (Events, Guests, Assets, etc. — MASTER_SPEC BR-008: "Todo dato deberá pertenecer a una organización").

The implementation must respect the approved Architecture, API Specification, and ADRs — in particular ADR-011 Domain Module Ownership, which governs every cross-module boundary in this Epic.

---

# 2. Scope

This Epic covers:

- Organization creation (with atomic OWNER-membership assignment)
- Organization retrieval and listing
- Organization update and settings management
- White Label / branding configuration (including a reference-only Custom Domain field)
- Organization activation/suspension and status-based enforcement across all Organizations endpoints (STORY-003-004, decided and implemented after this Epic's initial documentation — see §3 Out of Scope and STORY-003-004's own section)

---

# 3. Out of Scope

The following are not implemented as part of this Epic:

- ~~Activate/Suspend Organization — blocked; no authoritative source defines the "Platform administrator" actor referenced by API_SPEC §22, and no new actor/role/authorization model may be invented.~~ **Superseded:** this gap was resolved by defining "platform-privileged" as an ACTIVE OWNER/ADMIN membership in the existing SYSTEM organization — not a new actor, role, or authorization model — and the capability was implemented and closed as STORY-003-004 (see its section and the updated §2 Scope above).
- Subscription domain logic, entity, or ownership — owned by Billing (ADR-011; API_SPEC §19 "API Resource Ownership"). The conflicting "Subscription ownership" wording in Architecture.md's Organizations section and API_SPEC §22's Responsibilities list is stale documentation, not corrected as part of this Epic.
- Domain entity, DNS, or provisioning logic — owned by the future Domains module (ADR-011). Organizations may only store/configure a reference to a Custom Domain.
- API Key entity, repository, or API — module ownership is unresolved (absent from both ADR-011's and API_SPEC §19's ownership tables, despite being a fully-specified entity in MASTER_SPEC §26.14). Recorded as a separate documentation gap for future Epic planning.
- Any new RBAC permission, role, or actor beyond the canonical `OWNER`/`ADMIN`/`MEMBER`/`CLIENT` model.
- Event management, Guest management, Messaging, Invitation Deployment, Analytics, AI functionality.

Other modules consume Organizations capabilities but own their respective business logic.

---

# 4. Dependencies

## 4.1 EPIC-002 Identity (Closed)

EPIC-002 — Identity & Access Management is complete and frozen. This Epic depends on its existing capabilities (authentication/session resolution, the `OrganizationMembership` domain entity, the canonical role model) but does not reopen or modify any EPIC-002 Story.

This Epic requires one **new** Identity-owned public Application Service — `CreateInitialOwnerMembershipService` — added to the Identity module to support STORY-003-001. This is an addition to Identity's public surface, not a modification of any existing EPIC-002 Story's approved contract.

## 4.2 Architectural Governance

- `ADR-001` Multi-Tenant Ownership Model — governs tenant-scoping rules for every capability in this Epic.
- `ADR-011` Domain Module Ownership — governs all cross-module contract shape; Organizations owns `Organization`, Identity owns `OrganizationMembership`, Billing owns `Subscription`, the future Domains module owns `Domain`.

---

# 5. Stories

## STORY-003-001 — Organization Creation & Onboarding

**Status:** Closed — Implemented (2026-10-08). See "Implementation Summary" for what was built and verified.

### Objective

Create a new PARTNER Organization and atomically assign the authenticated creator as its OWNER, per USER_FLOWS.md Flow 13 "Organization Onboarding," Main Flow steps 1–5.

This Story implements only the Organization-creation and OWNER-membership-assignment portion of Flow 13. Flow 13 Main Flow step 6 ("Default settings are initialized") and Postcondition 3 ("Platform configuration is initialized") are explicitly **not** implemented by this Story — deferred to STORY-003-003.

### Scope

- Create one `Organization` row (`organization_type: PARTNER`).
- Create one `OrganizationMembership` row for the caller (`role: OWNER`, `status: ACTIVE`), via a new Identity public Application Service.
- Return both created resources to the caller.

### Out of Scope

- Organization Settings / "default settings" (deferred to STORY-003-003).
- White Label, Custom Domain, Subscription, API Key.
- Any organization-creation permission, role, or quota beyond "any authenticated User, no limit."
- Flow 13's "Organization Already Exists" alternative flow (joining an existing org via invitation) — already served by Identity's existing team-management capabilities (STORY-002-007), not part of Create Organization.

### Preconditions

- User has completed registration (Flow 13 precondition; satisfied by EPIC-002).
- Email verification is not a gating precondition — registration is non-blocking for MVP (`email_verified: false` is a valid, usable state per STORY-002-001).
- Caller supplies a valid Bearer access token.

### API Reference

`POST /api/v1/management/organizations` (API_SPEC.md §22 "Organizations API — Create Organization").

### Authentication / Authorization

Authentication required (valid session, Bearer token). No authorization check beyond authentication: any authenticated User may create a PARTNER Organization. An existing CLIENT membership in the SYSTEM organization does not prevent this (MASTER_SPEC §26.2a — additive, non-replacing memberships).

### Request Schema

```json
{
  "display_name": "string, required",
  "slug": "string, optional"
}
```

### Response Schema (success, 201 Created)

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "organization_type": "PARTNER",
    "slug": "string",
    "display_name": "string",
    "created_at": "ISO-8601 timestamp",
    "membership": {
      "id": "uuid",
      "organization_id": "uuid",
      "role": "OWNER",
      "status": "ACTIVE"
    }
  }
}
```

### Status / Error Mapping

- Validation failure (missing/empty `display_name`, malformed `slug`): `VALIDATION_ERROR` (422).
- Slug conflict: `ORGANIZATION_SLUG_ALREADY_EXISTS` (409).
- Authentication failure: `UNAUTHORIZED` (401).
- Unexpected failure: `INTERNAL_SERVER_ERROR` (500).

### Slug Policy

`slug` is optional; if omitted, the server derives it from `display_name`. Whether supplied or derived, it is normalized to lowercase-kebab-case before the uniqueness check. Collisions return the conflict error above. No auto-suffixing. No reserved-slug catalog — the database's unique constraint on `organizations.slug` is the sole enforcement mechanism; the persisted SYSTEM organization's slug is not specially protected beyond ordinary uniqueness.

### Transaction Boundary

Organization creation and the creator's OWNER membership creation are performed as one atomic database transaction, using the existing shared transaction primitive (`@allinvites/database`'s `Database`/`getDatabase()`, the same mechanism already used by Identity's `DrizzleUserRepository.save`). No event bus, outbox, or asynchronous consumer is introduced. No Organization may ever be observed without its OWNER membership.

### Cross-Module Identity Contract

Organizations must not import or manipulate `OrganizationMembershipRepository`, `OrganizationMembership` domain internals, or the `organization_memberships` table directly (ADR-011). Instead, Organizations' use case calls a new, narrow, synchronous Identity-owned Application Service:

```
CreateInitialOwnerMembershipService(
  params: { userId: string; organizationId: string },
  tx: <transaction-scoped Database handle>
) => Promise<Result<{ membershipId: string }, CreateInitialOwnerMembershipError>>

type CreateInitialOwnerMembershipError =
  | { type: "USER_NOT_FOUND" }
  | { type: "UNEXPECTED"; cause: unknown }
```

This is the only new addition to Identity's public surface required by this Epic.

### `OrganizationCreated` Event

Constructed and returned post-commit only, following the existing `UserRegisteredEvent` precedent (a plain typed value, not dispatched — no event bus, publisher, or consumer exists in the codebase). Payload: `{ type: "OrganizationCreated", organizationId, creatorUserId, occurredAt }`. Never drives membership creation — that remains synchronous and transactional per the Transaction Boundary above.

### Security / Tenant Isolation

- Server generates the Organization `id` and Membership `id`; the client never supplies or influences either.
- The caller's `userId` is always taken from the authenticated session, never from the request body.
- Full Multi-Tenant isolation per ADR-001 spans application layer, PostgreSQL RLS, domain services, and audit; PostgreSQL RLS policies are not yet implemented anywhere in this codebase (a pre-existing gap inherited from EPIC-002, not introduced or resolved by this Story) — enforcement here is at the application-service layer only.

### Required Tests

- Use case: successful creation; slug omitted (derived + normalized); slug supplied (normalized); slug collision (conflict, no partial write); Identity-contract failure (full rollback, no orphaned Organization); unauthenticated caller rejected.
- Cross-module contract: `CreateInitialOwnerMembershipService` — success, `USER_NOT_FOUND`, correct participation in an externally supplied transaction.
- Handler/route: missing `display_name` → 422; success → 201 with correct envelope; slug conflict → 409; missing/invalid auth → 401.
- Repository: `OrganizationRepository` persistence round-trip.

### Acceptance Criteria

- An authenticated User submitting a valid `display_name` (and optional `slug`) receives `201` with the created Organization and their OWNER membership.
- The created Organization is always `organization_type: PARTNER`.
- The caller's existing memberships (including SYSTEM/CLIENT) are unaffected.
- A slug collision yields `409` and creates neither an Organization nor a membership.
- Any failure during creation leaves no Organization without its OWNER membership.
- No Settings, White Label, Custom Domain, Subscription, or API Key data is created or referenced.

### Explicit Implementation Boundary

This Story implements exactly: request validation → slug resolution/normalization → transactional creation of `Organization` + OWNER `OrganizationMembership` via the Identity contract → response mapping → post-commit `OrganizationCreated` construction. It does not implement Retrieval/Listing, Update/Settings, Activate/Suspend, or White Label.

### Implementation Summary

STORY-003-001 is implemented in full, matching the approved contract above:

- **Endpoint**: `POST /api/v1/management/organizations` (thin Next.js route adapter in `apps/dashboard`, delegating to the Organizations module's pre-wired handler).
- **Atomicity**: `Organization` creation and the caller's initial `OrganizationMembership` (`role: OWNER`, `status: ACTIVE`) are written inside a single database transaction opened by the Organizations use case, using the existing shared `@allinvites/database` transaction primitive — no second transaction mechanism, no event bus. Any failure inside the transaction rolls back both writes; no Organization can ever be observed without its OWNER membership.
- **Cross-module contract**: `CreateInitialOwnerMembershipService` was added as the one new Identity-owned public Application Service, exactly per the approved shape (`params: { userId, organizationId }`, an externally supplied transaction handle, `Result<{ membershipId }, CreateInitialOwnerMembershipError>`). Organizations never imports `OrganizationMembershipRepository`, `OrganizationMembership` domain internals, or the `organization_memberships` table directly.
- **Slug behavior**: optional client slug, or derived from `display_name` when omitted; normalized to lowercase-kebab-case in both cases; no auto-suffixing; uniqueness enforced solely by the database's unique constraint on `organizations.slug` (no reserved-slug catalog, no special-casing of the SYSTEM organization's slug).
- **Errors / authentication**: `VALIDATION_ERROR` (422) for a missing `display_name` or a slug that normalizes to empty; `ORGANIZATION_SLUG_ALREADY_EXISTS` (409) on a uniqueness-constraint collision; `UNAUTHORIZED` (401) for a missing, malformed, or invalid/expired Bearer access token; `INTERNAL_SERVER_ERROR` (500) for any unexpected failure, never leaking internal error details to the client.
- **Validation**: full monorepo `build`, `typecheck`, `lint`, and `test` all pass, including all 265 pre-existing Identity tests (unchanged) and 36 new Organizations tests.
- **Post-closure refinement**: a review pass found `display_name` was not trimmed at the create validator, so whitespace-only values (e.g. `"   "`) were accepted and persisted whenever a valid `slug` was also supplied (STORY-003-003's update validator already trims). Fixed by changing the validator to `.trim().min(1)`, with validator tests for whitespace-only and padded values and a handler test confirming a whitespace-only `display_name` returns 422 and creates nothing. Contract shape is unchanged (`display_name` still required; only whitespace-only and padded values change). Current totals after this refinement: Identity 286/286 (unchanged); Organizations 217/217.

### Accepted Follow-ups / Technical Debt

The following are accepted, non-blocking follow-ups — they do **not** block functional closure of STORY-003-001 and are deferred to future work:

- A database-backed integration test for `DrizzleOrganizationRepository` (the "persistence round-trip" item under Required Tests) — deferred because this repository has no database-backed integration-test infrastructure at all today; the same gap already exists for Identity's own Drizzle repositories (`DrizzleUserRepository`, `DrizzleOrganizationMembershipRepository`), so this is a pre-existing, codebase-wide gap rather than one introduced by this Story.
- An evaluation of shared session-verification infrastructure: Organizations currently owns its own `SessionVerifier`/`SupabaseSessionVerifier` adapter, which duplicates the token-verification logic already present in Identity's `SupabaseAuthProvider.getUserFromAccessToken`. This kept Identity's public-surface addition limited to exactly the one approved `CreateInitialOwnerMembershipService`; whether a shared, cross-module session-verification primitive should be extracted is left for future evaluation.

---

## STORY-003-002 — Organization Retrieval & Listing

**Status:** Closed — Implemented (2026-10-08). See "Implementation Summary" for what was built and verified.

### Objective

Allow an authenticated User to retrieve a single Organization they have an ACTIVE membership in, and to list every Organization where they have an ACTIVE membership.

### Scope

- Retrieve a single Organization by id (API_SPEC.md §22 "Retrieve Organization").
- List every Organization visible to the authenticated caller, paginated (API_SPEC.md §22 "List Organizations").

### Out of Scope

- Organization Settings, White Label, Custom Domain, Subscription, API Key — not returned or referenced by either capability.
- Update Organization, Activate/Suspend Organization — separate Stories (STORY-003-003, STORY-003-004).
- Client-configurable filtering or sorting — not specified anywhere in the authoritative documentation; not implemented.
- Any role-based restriction on Retrieve beyond ACTIVE membership (e.g. OWNER-only) — no authoritative source requires one.

### Preconditions

- Caller supplies a valid Bearer access token.
- Caller holds at least one Organization Membership (any status) — an ACTIVE one is required for an Organization to be retrievable/visible; see Tenancy / Visibility Rules below.

### API Reference

- `GET /api/v1/management/organizations/:organizationId` (API_SPEC.md §22 "Retrieve Organization").
- `GET /api/v1/management/organizations` (API_SPEC.md §22 "List Organizations").

### Authentication / Authorization

Authentication required (valid session, Bearer token) for both capabilities. No role-based authorization beyond authentication:

- Retrieve: any of OWNER/ADMIN/MEMBER/CLIENT is sufficient, provided the membership is ACTIVE.
- List: no separate check — the result set is itself scoped to the caller's ACTIVE memberships, so listing requires nothing beyond authentication.

### Path / Query Parameters

- Retrieve: `organizationId` (path, required, UUID).
- List: `page` (optional, default 1), `pageSize` (optional, default 25, max 100). No `organization_id` query parameter (see API_SPEC.md §22). No filter or sort parameters.

### Response Schema

Both capabilities return the Organization in this shape (no membership details):

```json
{
  "id": "uuid",
  "organization_type": "SYSTEM | PARTNER",
  "slug": "string",
  "display_name": "string",
  "created_at": "ISO-8601 timestamp"
}
```

- Retrieve: `{ "success": true, "data": <above> }`.
- List: `{ "success": true, "data": [<above>, ...], "pagination": { "page", "pageSize", "totalItems", "totalPages" } }` — no `hasPrevious`/`hasNext` (matches the implemented List Users shape).

### Status / Error Mapping

- Validation failure (malformed `organizationId`; out-of-range pagination params): `VALIDATION_ERROR` (422).
- Retrieve, nonexistent or inaccessible organization: `RESOURCE_NOT_FOUND` (404) — identical response in both cases (no distinguishing signal).
- Authentication failure: `UNAUTHORIZED` (401).
- Unexpected failure: `INTERNAL_SERVER_ERROR` (500).

### Tenancy / Visibility Rules

- An Organization is retrievable/visible to a caller if and only if the caller's membership in it is ACTIVE.
- SUSPENDED and REMOVED memberships are excluded — treated identically to no membership at all, for both Retrieve (→ 404) and List (→ omitted from results).
- SYSTEM and PARTNER organizations follow the identical rule; SYSTEM is included in List's results whenever the caller's membership there is ACTIVE (e.g. the default CLIENT membership created at registration, MASTER_SPEC §26.2a).
- No Organization is ever visible merely because it exists or because the caller is authenticated (ADR-001; Architecture.md "Multi-Tenant Isolation").

### Pagination, Ordering, and Out-of-Range Pages

- Defaults: `page=1`, `pageSize=25`; maximum `pageSize=100` (API_SPEC.md §16).
- Pagination is applied to the already ACTIVE-membership-scoped result set, via bounded database-backed retrieval — never unrestricted in-memory pagination over the full `organizations` table.
- `totalItems` is the count of Organizations visible to the caller after ACTIVE-membership scoping — not a platform-wide organization count.
- Ordering is a fixed internal `created_at ASC` — deterministic, not client-configurable (no `?sort=` support).
- A `page` beyond the last available page returns `200 OK` with an empty `data` array and a `pagination` object reflecting the true `totalItems`/`totalPages` — not an error.

### Identity Cross-Module Contracts

Two new, narrow Identity-owned public Application Services (additions to Identity's public surface; no existing EPIC-002 Story contract is modified):

```
verifyActiveMembership(
  params: { userId: string; organizationId: string }
) => Promise<Result<void, VerifyActiveMembershipError>>

type VerifyActiveMembershipError =
  | { type: "NOT_A_MEMBER" }   // no membership, or membership not ACTIVE — collapsed, fail-secure
  | { type: "UNEXPECTED"; cause: unknown }
```

```
listActiveOrganizationIds(
  params: { userId: string }
) => Promise<Result<{ organizationIds: string[] }, ListActiveOrganizationIdsError>>

type ListActiveOrganizationIdsError =
  | { type: "UNEXPECTED"; cause: unknown }
```

`verifyActiveMembership` returns only the membership fact (`void` on success) — it does not return the caller's role; nothing in the approved contract needs it. `listActiveOrganizationIds` returns bare organization id strings only, already filtered to ACTIVE status — never an `OrganizationMembership` entity, role, or membership id. Both take an already-resolved `userId` (from Organizations' own `SessionVerifier`, STORY-003-001 precedent), not an access token — Identity is consulted only for the membership fact.

Organizations must not import `OrganizationMembershipRepository`, `OrganizationMembership` domain internals, or the `organization_memberships` table directly (ADR-011). All membership entities, repositories, and persistence remain inside Identity.

### Repository and Service Boundaries

- `OrganizationRepository.findById(id): Promise<Organization | null>` — already exists (STORY-003-001); reused as-is for Retrieve's data fetch, called only after `verifyActiveMembership` succeeds.
- `OrganizationRepository.findByIds(ids: string[], pagination): Promise<{ items: Organization[]; total: number }>` — new method required for List; performs bounded, database-backed pagination over the id set returned by `listActiveOrganizationIds` — never fetches or paginates over the full `organizations` table.
- Identity owns: membership existence, status, and the ACTIVE-scoped id enumeration (the two services above).
- Organizations owns: the Organization entity's own data, request validation, pagination/response mapping, and the decision to collapse "doesn't exist" and "not an ACTIVE member" into the same 404 for Retrieve.

### Required Tests

- Identity, unit: `verifyActiveMembership` — ACTIVE membership → success; SUSPENDED/REMOVED/no membership → `NOT_A_MEMBER`; unexpected repository failure → `UNEXPECTED`.
- Identity, unit: `listActiveOrganizationIds` — returns only ACTIVE org ids; excludes SUSPENDED/REMOVED; empty array for a caller with none; unexpected failure → `UNEXPECTED`.
- Organizations, use case (Retrieve): ACTIVE membership → success; SUSPENDED/REMOVED/no membership → `RESOURCE_NOT_FOUND`; nonexistent organization → identical `RESOURCE_NOT_FOUND`; unauthenticated caller → `UNAUTHORIZED`.
- Organizations, use case (List): returns exactly the caller's ACTIVE-membership organizations, including SYSTEM when applicable; excludes SUSPENDED/REMOVED-only organizations; empty list for a caller with none; `totalItems`/`totalPages` reflect the scoped set, not the platform total; a page beyond the last returns an empty `data` array with correct pagination metadata, not an error; ordering is deterministic (`created_at ASC`) across repeated calls.
- Handler/route (both): malformed `organizationId` → 422; missing/invalid auth → 401; success envelopes match the approved schema exactly; Retrieve's 404 response is byte-identical for "doesn't exist" vs. "not an ACTIVE member."
- Tenancy: a caller with ACTIVE membership in Org A and none (or a non-ACTIVE one) in Org B cannot retrieve B, and B never appears in their list.

Optional / future, not blocking this Story's closure (mirrors the accepted STORY-003-001 precedent): a database-backed integration test for `DrizzleOrganizationRepository.findByIds` and for the two new Identity repository-level query methods, deferred because no integration-test infrastructure exists anywhere in this codebase yet.

### Explicit Implementation Boundary

This Story implements exactly: for Retrieve — path validation → `verifyActiveMembership` → (on success) `OrganizationRepository.findById` → response mapping. For List — query validation → `listActiveOrganizationIds` → `OrganizationRepository.findByIds` (bounded, paginated) → response mapping. It does not implement Update/Settings, Activate/Suspend, White Label, or any filtering/sorting capability.

### Implementation Summary

STORY-003-002 is implemented in full, matching the approved contract above:

- **Endpoints**: `GET /api/v1/management/organizations/:organizationId` (Retrieve) and `GET /api/v1/management/organizations` (List), both thin Next.js route adapters in `apps/dashboard` delegating to the Organizations module's pre-wired handlers.
- **Tenancy enforcement**: both capabilities require an ACTIVE caller membership — resolved via Identity's `verifyActiveMembership` (Retrieve) and `listActiveOrganizationIds` (List). SUSPENDED and REMOVED memberships are excluded, treated identically to no membership at all.
- **SYSTEM/PARTNER visibility**: both organization types follow the identical ACTIVE-membership rule — SYSTEM is included in List's results whenever the caller's membership there is ACTIVE, with no type-based exception.
- **Identity cross-module contracts**: `verifyActiveMembership` and `listActiveOrganizationIds` were added as the two new Identity-owned public Application Services, built entirely on Identity's existing repository methods (`OrganizationMembershipRepository.findByUserAndOrganization`, `UserRepository.findMembershipsByUserId`) — no new Identity repository methods or schema changes were required. Organizations imports neither `OrganizationMembershipRepository`, `OrganizationMembership` domain internals, nor the `organization_memberships` table.
- **Pagination and ordering**: `OrganizationRepository.findByIds` performs bounded, database-level pagination (`inArray` + `orderBy(asc(created_at))` + `limit`/`offset`) over the already ACTIVE-membership-scoped id set — never an in-memory pagination over the full `organizations` table. Ordering is the fixed, deterministic `created_at ASC`.
- **404 behavior**: nonexistent and inaccessible (no ACTIVE membership) organizations return byte-identical `RESOURCE_NOT_FOUND` (404) responses — verified directly by a dedicated handler test comparing serialized response bodies.
- **Post-closure refinement (STORY-003-004)**: Retrieve and List also serve platform-privileged callers (ACTIVE OWNER or ADMIN in SYSTEM). Retrieve admits such a caller without a membership in the target, and List returns every Organization to them, including SUSPENDED ones. Retrieve returns `403 ORGANIZATION_SUSPENDED` for a SUSPENDED Organization after authorization, for every caller. The ACTIVE-membership rule and the byte-identical 404 are unchanged for all other callers. The platform check is Identity's new `verifyPlatformPrivilege`; no existing Identity service changed.

### Validation Results

- `pnpm build`: 21/21 tasks succeeded.
- `pnpm typecheck`: 27/27 tasks succeeded.
- `pnpm lint`: 21/21 packages clean (biome).
- `pnpm test`: 27/27 tasks succeeded — Identity: 276/276 tests pass (265 pre-existing unchanged + 11 new); Organizations: 76/76 tests pass (36 pre-existing STORY-003-001 unchanged + 40 new).

### Accepted Non-Blocking Gaps

- No database-backed integration test for `DrizzleOrganizationRepository.findByIds` or the two new Identity repository-level query methods — the same pre-existing, codebase-wide gap already accepted for STORY-003-001 (no integration-test infrastructure exists anywhere in this repository).
- During implementation, this codebase's conventional test-fixture IDs (e.g. `"22222222-2222-2222-2222-222222222222"`) were found to not be RFC-4122-shaped (invalid variant nibble) and are rejected by the new `organizationId` UUID validator. This was a test-authoring detail only — resolved by using properly-shaped UUID literals in tests that route through the validator — and is not a contract deviation.

EPIC-002, Stories 002-001 through 002-008, and STORY-003-001 remain frozen and behaviorally unchanged — verified by all 265 pre-existing Identity tests and all 36 pre-existing Organizations tests passing with no assertion changes.

### Known Documentation Inconsistencies (Not Resolved by This Story)

- `API_SPEC.md §22`'s general "Authorization" section ("Organization administrators may only manage their own organization") uses "Organization Administrator," a role name `MASTER_SPEC §18` explicitly states is invalid. Not corrected here — `MASTER_SPEC §18` remains authoritative; the stale wording is a pre-existing gap, consistent with the already-recorded "Platform administrator" issue (see §3 Out of Scope).
- `API_SPEC.md §16`'s generic pagination example includes `hasPrevious`/`hasNext`; the only implemented collection endpoint (List Users, §23) does not use them. STORY-003-002 follows the implemented List Users shape (no `hasPrevious`/`hasNext`); the inconsistency in §16's own generic text remains unresolved.

---

## STORY-003-003 — Organization Metadata Update

**Status:** Closed — Implemented (2026-10-08). See "Implementation Summary" for what was built and verified.

### Objective

Allow an Organization's OWNER to update its `display_name`.

### Scope

- Update Organization `display_name` only (API_SPEC.md §22 "Update Organization").

### Out of Scope

- Organization Settings (retrieve/update) and Flow 13's deferred default-settings initialization — reserved for STORY-003-006, with its own future contract audit, persistence decision, and schema definition. Not silently dropped.
- White Label, branding, Custom Domain — STORY-003-005.
- Organization status changes (Activate/Suspend) — STORY-003-004 (implemented and closed; see its section).
- Subscription, billing, plans, API keys — out of Organizations' ownership (ADR-011).
- Any new RBAC role or permission.
- Any schema migration; no `updated_at` field.
- `slug`, `organization_type`, `id`, `created_at` — immutable, not editable via this Story.

### Preconditions

- Organization already exists (STORY-003-001).
- Caller supplies a valid Bearer access token and holds an ACTIVE OWNER membership in the target Organization.

### API Reference

`PATCH /api/v1/management/organizations/:organizationId` (API_SPEC.md §22 "Update Organization").

### Authentication / Authorization

Authentication required (valid session, Bearer token) — missing, invalid, or expired token: `UNAUTHORIZED` (401). Authorization: caller must hold an ACTIVE OWNER membership in the target Organization — ADMIN, MEMBER, and CLIENT are not authorized. No new role or permission introduced.

### Request Schema

```json
{ "display_name": "string, required, non-empty after trimming" }
```

Only `display_name` is editable. `id`, `organization_type`, `slug`, and `created_at` are immutable. Missing, empty, or whitespace-only `display_name`: `VALIDATION_ERROR` (422).

### Response Schema (success, 200 OK)

Reuses STORY-003-002's `OrganizationDto` without any shape change:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "organization_type": "PARTNER",
    "slug": "string",
    "display_name": "string",
    "created_at": "ISO-8601 timestamp"
  }
}
```

No `updated_at` field, migration, settings table/columns, versioning, or concurrency mechanism is introduced.

### Status / Error Mapping

- `VALIDATION_ERROR` (422): missing/empty/whitespace-only `display_name`.
- `RESOURCE_NOT_FOUND` (404): nonexistent organization; no membership; non-ACTIVE (SUSPENDED or REMOVED) membership; SYSTEM organization. All applicable cases return byte-identical responses.
- `FORBIDDEN` (403): ACTIVE member, not OWNER.
- `UNAUTHORIZED` (401): authentication failure.
- `INTERNAL_SERVER_ERROR` (500): unexpected failure, no cause leaked.

### SYSTEM Organization Handling

1. Authorize via Identity's `verifyOwnerMembership`.
2. Fetch the organization.
3. If `organization_type === "SYSTEM"`, normalize the result to the same `RESOURCE_NOT_FOUND` response as step 1's failure — no distinguishable code or shape. STORY-003-004's platform-privilege model (ACTIVE OWNER or ADMIN membership in SYSTEM) is now implemented, but Update Organization grants it no bypass of this rule — only Retrieve and List admit a platform-privileged caller to a SYSTEM or otherwise inaccessible organization (see STORY-003-002's post-closure refinement). This is defense-in-depth: no flow in this specification ever creates a documented OWNER membership in the SYSTEM organization.

### Identity Cross-Module Contract

```
verifyOwnerMembership(
  params: { userId: string; organizationId: string }
) => Promise<Result<void, VerifyOwnerMembershipError>>

type VerifyOwnerMembershipError =
  | { type: "NOT_ACTIVE_MEMBER" }   // no membership, or membership not ACTIVE
  | { type: "NOT_OWNER" }           // ACTIVE membership exists, caller is not OWNER
  | { type: "UNEXPECTED"; cause: unknown }
```

Returns no membership entity, role value, or RBAC internals. Built on Identity's existing `OrganizationMembershipRepository.findByUserAndOrganization` — no new Identity repository method. Organizations maps `NOT_ACTIVE_MEMBER` → its own `RESOURCE_NOT_FOUND`, `NOT_OWNER` → `FORBIDDEN`. Organizations must not import `OrganizationMembershipRepository`, `OrganizationMembership` domain internals, or the `organization_memberships` table. No existing Identity service or EPIC-002 Story is modified.

### Repository and Service Boundaries

- New: `OrganizationRepository.update(id: string, changes: { displayName: string }): Promise<Organization>` — single-row update by organization id, updating only `display_name`. No transaction is required for this Story.
- No settings table/columns, no versioning/concurrency field, no migration.

### Dependencies

This Story depends on: STORY-003-001 (the Organization entity it updates), STORY-003-002 (the `OrganizationDto` response contract it reuses unchanged), and Identity's existing `OrganizationMembershipRepository.findByUserAndOrganization` (the membership-verification boundary the new `verifyOwnerMembership` service is built on).

### Required Tests

Unit (use case), handler/route, authorization (OWNER vs ADMIN/MEMBER/CLIENT), tenancy (cross-organization isolation, SYSTEM exclusion), validation (`display_name`), error-contract (byte-identical 404 across all applicable cases). Accepted non-blocking gaps, consistent with STORY-003-001/002 precedent: no database-backed integration-test infrastructure exists yet; no API contract-testing tooling exists yet (ADR-008 requires contract tests for every public API change — recorded as a pre-existing, codebase-wide gap, not introduced by this Story).

### Explicit Non-Goals

Same as Out of Scope above.

### Implementation Summary

STORY-003-003 is implemented in full, matching the approved contract above:

- **Endpoint**: `PATCH /api/v1/management/organizations/:organizationId`, a thin Next.js route adapter in `apps/dashboard` delegating to the Organizations module's pre-wired handler, alongside the existing `GET` on the same route.
- **Identity cross-module contract**: `verifyOwnerMembership` was added as the new Identity-owned public Application Service, exactly per the approved shape (`params: { userId, organizationId }`, `Result<void, VerifyOwnerMembershipError>` with `NOT_ACTIVE_MEMBER` / `NOT_OWNER` / `UNEXPECTED`) — built entirely on Identity's existing `OrganizationMembershipRepository.findByUserAndOrganization`; no new Identity repository method or schema change was required. Organizations imports neither `OrganizationMembershipRepository`, `OrganizationMembership` domain internals, nor the `organization_memberships` table.
- **Denial mapping**: `NOT_ACTIVE_MEMBER` (no membership, or a non-ACTIVE one), a defensively-missing organization row, and a SYSTEM-typed organization all normalize to the same use-case-level `NOT_FOUND`, mapped to a byte-identical `RESOURCE_NOT_FOUND` (404) response — verified directly by a dedicated handler test comparing serialized response bodies across all three cases. `NOT_OWNER` (an ACTIVE membership that isn't OWNER) maps to `FORBIDDEN` (403), a deliberately distinguishable outcome since the caller already knows the organization exists.
- **Request validation**: `display_name` is validated via `z.string().trim().min(1)`, rejecting missing, empty, and whitespace-only values with `VALIDATION_ERROR` (422); the schema's `.trim()` also produces the trimmed value the use case persists, so no separate trimming step exists elsewhere. `slug`, `organization_type`, `id`, and `created_at` are not accepted by the request schema (unknown keys are stripped) and are never touched by the new `OrganizationRepository.update`, which sets only `display_name`.
- **Response**: 200 OK, reusing STORY-003-002's `OrganizationDto` with no shape change — no `updated_at`.
- **Persistence**: a single-row `UPDATE ... WHERE id = ... RETURNING` in `DrizzleOrganizationRepository.update`; no transaction, no migration, no settings table/columns, no versioning/concurrency mechanism.
- **Post-closure refinement (STORY-003-004)**: Update Organization returns `403 ORGANIZATION_SUSPENDED` (with the fixed message) for a SUSPENDED Organization, after the OWNER check and before any write. Every existing response is unchanged for an ACTIVE Organization.

### Validation Results

- `pnpm typecheck`: 27/27 tasks succeeded.
- `pnpm lint`: 21/21 packages clean (biome).
- `pnpm test`: 27/27 tasks succeeded — Identity: 286/286 tests pass (276 pre-existing unchanged + 10 new); Organizations: 112/112 tests pass (76 pre-existing unchanged + 36 new).
- `pnpm build`: 21/21 tasks succeeded, including the dashboard build registering `PATCH /api/v1/management/organizations/[organizationId]` alongside the existing `GET`.

### Accepted Non-Blocking Gaps

- No database-backed integration test for `DrizzleOrganizationRepository.update` or `verifyOwnerMembership`'s repository-level path — the same pre-existing, codebase-wide gap already accepted for STORY-003-001/002 (no integration-test infrastructure exists anywhere in this repository).
- No API contract-testing tooling exists (ADR-008 requires contract tests for every public API modification) — a pre-existing, codebase-wide gap, not introduced by this Story; first identified during this Story's contract audit.

EPIC-002, Stories 002-001 through 002-008, STORY-003-001, and STORY-003-002 remain frozen and behaviorally unchanged — verified by all 276 pre-existing Identity tests and all 76 pre-existing Organizations tests passing with no assertion changes. STORY-003-006 was not implemented, audited, or otherwise altered by this Story and remains reserved.

### Known Documentation Inconsistencies (Not Resolved by This Story)

- `API_SPEC.md §22`'s general Authorization section ("Organization administrators may only manage their own organization") vs. `MASTER_SPEC §18`'s rejection of that role name — unchanged, same as recorded under STORY-003-002.
- `API_SPEC.md §16`'s generic pagination example (`hasPrevious`/`hasNext`) vs. the implemented List Users/List Organizations shape — unchanged, same as recorded under STORY-003-002.
- Pre-existing wording conflicts around Update Organization's authorization (across `API_SPEC §22`, `USER_FLOWS` Flow 14, and `MASTER_SPEC §18`) — this Story's own behavior (OWNER-only) is now decided, but the underlying document text is not corrected.
- The STORY-002-007 (`resolveAuthorizedCaller`, collapses all denials to 403) vs. STORY-003-002 (collapses to 404) precedent tension — this Story adopts a hybrid (404 for existence/visibility, 403 for insufficient role) for its own behavior only; neither existing precedent's text is altered.
- `MASTER_SPEC §27.2` "Organization Plan" vs. `§27.4` "Planes" overlap, and the recurring stale Billing/Subscription wording under Organizations' §22 Ownership/Responsibilities sections — unresolved, unchanged.

---

## STORY-003-004 — Activate / Suspend Organization

**Status:** Closed — Implemented (2026-10-08). See "Implementation State" for what was built and verified.

The three gaps that previously blocked this Story were resolved by the product decisions recorded below, and the Story is now implemented and closed (see "Implementation State").

### Approved decisions

1. **Platform-privileged actor (no new role).** A caller is platform-privileged if they hold an `ACTIVE` membership in the SYSTEM organization with role OWNER or ADMIN. MEMBER and CLIENT in SYSTEM have no platform privilege. Grounded in MASTER_SPEC §17 ("usuarios internos de AllInvites con privilegios explícitos"; SYSTEM = "Agencia 0") and the closed role list in MASTER_SPEC §18.
2. **Cross-organization visibility.** Platform-privileged users can see and act on all organizations. This extends the visibility of STORY-003-002's retrieve and list endpoints for those callers only; all other callers keep the ACTIVE-membership rule.
3. **Persisted status.** `organizations.organization_status`: `text`, not null, default `ACTIVE`, check in (`ACTIVE`, `SUSPENDED`). Existing rows become `ACTIVE`. Named in MASTER_SPEC §26.1/§27.2 and in the Design Rule of §17.
4. **Enforcement (every organization-scoped endpoint).** When an organization is `SUSPENDED`, every endpoint scoped to it denies the request with `403 ORGANIZATION_SUSPENDED` — a distinguishable code and fixed message, defined during the API_SPEC §22 contract drafting; it replaced this decision's original plan to reuse the generic `FORBIDDEN`. This applies to members and to platform-privileged users alike. The sole exception is `/activate`, which must stay reachable for a suspended organization or it could never be reactivated.
5. **Endpoints.** Separate actions, matching the existing user actions (`/users/{userId}/suspend`, `/activate`):
   - `POST /api/v1/management/organizations/:organizationId/suspend`
   - `POST /api/v1/management/organizations/:organizationId/activate`

### Flow

- **Actor:** platform-privileged caller (decision 1). Callers without that privilege get the existing concealment: `404 RESOURCE_NOT_FOUND` if they have no relationship to the target, `403 FORBIDDEN` if they are a member but not platform-privileged.
- **Preconditions:** authenticated caller; target organization exists.
- **Main flow (suspend):** validate target, set `organization_status = SUSPENDED`, return `200` with the organization's status.
- **Main flow (activate):** validate target, set `organization_status = ACTIVE`, return `200` with the organization's status.
- **Rules:**
  - SYSTEM cannot be suspended or activated; the request returns `404 RESOURCE_NOT_FOUND`, consistent with the SYSTEM rule used elsewhere.
  - Suspend on an already `SUSPENDED` organization, and activate on an already `ACTIVE` one, return `200` with the current state (idempotent).
- **Postconditions:** the organization's status is updated, and enforcement (decision 4) applies to all organization-scoped endpoints immediately after.

### Scope impact (requires awareness before implementation)

- **Closed Stories changed.** The enforcement check (decision 4) and the visibility extension (decision 2) affect STORY-003-002's retrieve and list, and every Organizations endpoint in STORY-003-003, 005, and 006. STORY-003-001 (create) is affected only by the status check on its own endpoints, which it does not have.
- **Where the check lives.** Identity's membership services are frozen and do not know organization status. The status check goes in an Organizations helper that loads the organization and checks its status. Identity remains unchanged.
- **Resolved during contract drafting (no longer open):** the API_SPEC.md §22 contract text is applied; the suspension check lives on the loaded `Organization` entity (`isSuspended()`), checked by each use case right after its existing authorization check — no separate cross-cutting helper; and audit logging was written now, via the Audit module, not deferred (ADR-007 "Audit Trail").

### Implementation State

Implemented and closed (all packages typecheck, lint, and test green: Organizations 251/251, Identity 294/294; monorepo typecheck 28/28, lint 21/21, test passing):
- Status changes are conditional updates (`WHERE organization_status = <value read>`). A lost race re-reads and decides again, so each actual change has exactly one audit record, and its `previousStatus` is the value actually replaced.
- `organizations.organization_status` migration (`supabase/migrations/20261006120000_organizations_status.sql`) and `audit_logs` append-only migration (`20261006120100_audit_logs.sql`, UPDATE/DELETE trigger, RLS), both applied to the `weddinvites` Supabase project (`expuwijtpubgsrqpdejj`) and verified directly: the status column/default/check constraint, the SYSTEM seed's `ACTIVE` status, and the trigger blocking both an UPDATE and a DELETE on `audit_logs` inside a rolled-back transaction. A follow-up migration (`20261006130000`) pins the trigger function's `search_path`, resolving the Supabase security advisor's `function_search_path_mutable` finding; also applied and verified.
- Identity public service `verifyPlatformPrivilege` (ACTIVE OWNER or ADMIN in SYSTEM; any other state returns `NOT_PLATFORM_PRIVILEGED`), with its wiring and tests. Additive only: no existing Identity service changed.
- Audit module: append-only `recordAuditEvent`, written inside the caller's transaction. Wired into Organizations.
- Organizations: `POST .../suspend` and `POST .../activate` (route adapters in `apps/dashboard`), through `SetOrganizationStatusUseCase`: platform check, concealment rules, SYSTEM normalization, idempotency, and atomic audit.
- Suspension enforcement on Retrieve, Update, Retrieve/Update Branding, and Retrieve/Update Settings. Returns `403 ORGANIZATION_SUSPENDED` after the existing authorization checks.
- Platform visibility (API_SPEC.md §22): Retrieve admits a platform-privileged non-member, and List returns every organization to a platform-privileged caller. Both are unchanged for everyone else.
- Post-closure refinement bullets for STORY-003-002, 003, 005, and 006 are recorded in each Story's own section, covering the enforcement and visibility changes.
- Committed (`2a94681`, `0c3ddc7`) and pushed to `origin/main` on `github.com/Weddinvites/new-platform`.

### Accepted Non-Blocking Gaps

- Retrieve Organization and List Organizations do not return `organization_status` in their response DTOs. A platform-privileged caller can only infer that an organization is suspended from the `ORGANIZATION_SUSPENDED` response on Retrieve, or from the audit trail — not from the List payload. Adding the field is a contract change, not made here.
- No database-backed integration test exercises the conditional update's concurrency behavior directly; it is covered only by the unit tests' fakes. The same pre-existing, codebase-wide gap already accepted for every prior Story in this Epic.
- The security advisor's `rls_auto_enable` finding (a project-level Supabase function) predates this Story and is unrelated to its migrations; not addressed here.

### Known Documentation Inconsistencies (Not Resolved by This Story)

- `API_SPEC.md §22`'s general Authorization section names "Platform administrators" and "Organization administrators." `MASTER_SPEC §18` names "Organization Administrator" as invalid. This Story uses the approved decision above, and the wording in `API_SPEC.md §22` is not changed.

This ID is not reassigned to another capability.

---

## STORY-003-005 — White Label / Branding Configuration

**Status:** Closed — Implemented (2026-10-08). See "Implementation Summary" for what was built and verified.

### Objective

Allow an Organization's OWNER to configure its White Label / branding identity: brand name, logo, and primary/secondary colors.

### Scope

- Retrieve Organization Branding.
- Update Organization Branding (`brand_name`, `logo`, `primary_color`, `secondary_color`).
- One Branding resource per Organization, Organizations-owned.

### Out of Scope

- Custom Domain — resolved out of this Story entirely. Each Invitation (Event) may have its own custom domain if needed, plus an always-available preview/internal URL — this is exclusively Invitation Deployment's concern (API_SPEC.md, "Configure Custom Domain," Invitation Deployment API), per-Invitation, not an Organization-level field. Organizations does not store, reference, or point to any domain data.
- Email Branding as a stored field — not persisted; transactional emails reuse the Logo/Colors configured here as a rendering behavior. No separate field, column, or endpoint exists for it.
- `brand_name` never affects or is affected by `display_name` (STORY-003-003) — the two are fully independent fields.
- Logo as an Assets-module-backed entity — deferred; `logo` is a plain URL string, no cross-module boundary with Assets.
- Organization Settings (STORY-003-006, separately blocked), Localization, Notifications, Integrations, Feature Flags — per the Configuration Ownership Matrix established during the STORY-003-006 audit.
- Any new RBAC role or permission.
- Any schema migration executed as part of this documentation stage (see Repository and Service Boundaries below — approved, not yet applied).

### Preconditions

- Organization already exists (STORY-003-001).
- Caller supplies a valid Bearer access token and holds an ACTIVE OWNER membership in the target Organization.

### API Reference

- `GET /api/v1/management/organizations/:organizationId/branding` (API_SPEC.md §22 "Configure White Label").
- `PATCH /api/v1/management/organizations/:organizationId/branding` (API_SPEC.md §22 "Configure White Label").

### Authentication / Authorization

Identical to STORY-003-003: ACTIVE OWNER membership required — ADMIN, MEMBER, and CLIENT are not authorized. No new role or permission introduced.

### Request Schema (PATCH)

```json
{
  "brand_name": "string, optional",
  "logo": "string (well-formed URL), optional",
  "primary_color": "string (#RRGGBB hex), optional",
  "secondary_color": "string (#RRGGBB hex), optional"
}
```

At least one field is required; an empty body is rejected with `VALIDATION_ERROR` (422).

### Response Schema (GET and PATCH, success, 200 OK)

```json
{
  "success": true,
  "data": {
    "organization_id": "uuid",
    "brand_name": "string | null",
    "logo": "string | null",
    "primary_color": "string | null",
    "secondary_color": "string | null"
  }
}
```

A new, standalone DTO — not merged into STORY-003-002's `OrganizationDto`, which remains unchanged.

### Status / Error Mapping

- `VALIDATION_ERROR` (422): empty PATCH body; malformed `logo` URL; malformed hex color.
- `RESOURCE_NOT_FOUND` (404): nonexistent organization; no membership; non-ACTIVE (SUSPENDED or REMOVED) membership; SYSTEM organization. All applicable cases byte-identical.
- `FORBIDDEN` (403): ACTIVE member, not OWNER.
- `UNAUTHORIZED` (401): authentication failure.
- `INTERNAL_SERVER_ERROR` (500): unexpected failure, no cause leaked.

### Identity Cross-Module Contract

None new. Reuses `verifyOwnerMembership({ userId, organizationId })` (STORY-003-003) unchanged.

### Repository and Service Boundaries

- New: four nullable columns on the existing `organizations` table — `brand_name`, `logo`, `primary_color`, `secondary_color` (all `text`, nullable, no default), consistent with this codebase's existing typed-column convention (no dedicated table, no JSONB).
- Single-row update; no transaction required.
- No Assets or Invitation Deployment cross-module contract.

### Required Tests

Unit (use case), handler/route, authorization (OWNER vs. ADMIN/MEMBER/CLIENT), tenancy (SYSTEM exclusion, cross-organization isolation), validation (empty body, malformed URL/hex color), error-contract (byte-identical 404). Same accepted non-blocking gaps as prior EPIC-003 Stories: no database-backed integration-test infrastructure; no API contract-testing tooling (ADR-008 gap).

### Explicit Non-Goals

Same as Out of Scope above.

### Implementation Summary

STORY-003-005 is implemented in full, matching the approved contract above:

- **Endpoints**: `GET /api/v1/management/organizations/:organizationId/branding` and `PATCH /api/v1/management/organizations/:organizationId/branding`, both thin Next.js route adapters in `apps/dashboard` delegating to the Organizations module's pre-wired handlers, alongside the existing `GET`/`PATCH` on `.../organizations/:organizationId`.
- **Authorization**: reuses `verifyOwnerMembership` (STORY-003-003) unchanged — no new Identity contract. ACTIVE OWNER required; ADMIN/MEMBER/CLIENT excluded.
- **Denial mapping**: `NOT_ACTIVE_MEMBER`, a defensively-missing organization row, and a SYSTEM-typed organization all normalize to the same use-case-level `NOT_FOUND`, mapped to a byte-identical `RESOURCE_NOT_FOUND` (404) — verified directly by dedicated handler tests on both endpoints. `NOT_OWNER` maps to `FORBIDDEN` (403).
- **Request validation**: `brand_name` (trimmed, non-empty if present), `logo` (well-formed URL), `primary_color`/`secondary_color` (`#RRGGBB` hex), all independently optional but with at least one required — an empty body is rejected with `VALIDATION_ERROR` (422). No `custom_domain` or `email_branding` field is accepted.
- **Partial updates**: `UpdateOrganizationBrandingUseCase` persists only the fields present on the command; fields not supplied are left untouched, verified by a dedicated test.
- **Response**: a new, standalone `OrganizationBrandingDto` — `OrganizationDto` (STORY-003-002) is unchanged.
- **Persistence**: four new nullable columns on `organizations` (`brand_name`, `logo`, `primary_color`, `secondary_color`), added via `packages/database/src/schema.ts` and `supabase/migrations/20260922000000_organizations_branding.sql`, following this repository's existing hand-written SQL migration convention. Single-row update; no transaction.
- **Custom Domain**: confirmed excluded — remains exclusively Invitation Deployment's concern, per-Invitation; Organizations stores no domain data of any kind.
- **Post-closure refinement**: a focused validator review (after initial closure) found `primary_color`/`secondary_color` rejected values with incidental leading/trailing whitespace, inconsistent with `brand_name` (explicitly trimmed) and `logo` (implicitly trimmed via URL parsing). Fixed by adding `.trim()` to both color fields, with three new tests added to cover all four fields' trimming behavior explicitly.
- **Post-closure refinement (STORY-003-004)**: Retrieve and Update Branding return `403 ORGANIZATION_SUSPENDED` for a SUSPENDED Organization, after the OWNER check. Responses for ACTIVE Organizations are unchanged.

### Validation Results

- `pnpm typecheck`: 27/27 tasks succeeded.
- `pnpm lint`: 21/21 packages clean (biome).
- `pnpm test`: 27/27 tasks succeeded — Identity: 286/286 tests pass (unchanged); Organizations: 165/165 tests pass (162 as of initial implementation + 3 refinement tests).
- `pnpm build`: 21/21 tasks succeeded, including the dashboard build registering the new `branding` route alongside the existing `[organizationId]` route.

### Accepted Non-Blocking Gaps

- No database-backed integration test for `DrizzleOrganizationRepository.updateBranding` or for the new migration's actual application to a live database — the same pre-existing, codebase-wide gap already accepted for every prior EPIC-003 Story (no integration-test infrastructure, and no drizzle-kit/migration-execution tooling, exist anywhere in this repository).
- No API contract-testing tooling exists (ADR-008 requires contract tests for every public API modification) — a pre-existing, codebase-wide gap, not introduced by this Story.

EPIC-002, Stories 002-001 through 002-008, STORY-003-001, STORY-003-002, STORY-003-003, and STORY-003-006 remain frozen and behaviorally unchanged — verified by all 286 pre-existing Identity tests and all 112 pre-existing Organizations tests passing with no assertion changes.

### Known Documentation Inconsistencies (Not Resolved by This Story)

- `API_SPEC.md §22`'s general Authorization section ("Organization administrators...") vs. `MASTER_SPEC §18` role vocabulary — unchanged, same as recorded under STORY-003-002/003.
- `MASTER_SPEC`'s Glossary "White Label" entry lists "Chatbot" as something White Label "may include" — not adopted anywhere in this Story; left unexplained, not resolved.
- `USER_FLOWS.md` Flow 14 frames Branding (along with Localization, Notifications, Integrations, Feature Availability) as operations under one unified "Organization Settings" UI screen — a UX-layer grouping that doesn't map 1:1 onto the module-level ownership split already established. Not a contradiction requiring resolution, recorded for awareness.
- All previously recorded EPIC-003 inconsistencies (pagination example, Organization Plan/Planes overlap, STORY-002-007-vs-003-002/003 denial precedent divergence) remain unresolved and unchanged.

---

## STORY-003-006 — Organization Settings

**Status:** Closed — Implemented (2026-10-08). See "Implementation Summary" for what was built and verified.

### Objective

Allow an Organization's OWNER to retrieve and update its Organization Settings — currently a single approved field, `support_contact_email`.

### Ownership (Resolved)

Organization Settings are owned by the **Organizations** module — not by a separate Settings module or a separate Epic. This resolves a documentation conflict discovered during this Story's contract audit: `API_SPEC.md §32` ("Settings API"/"Settings Module") previously described a dedicated Settings module claiming ownership of Organization Settings, Branding, Localization, Feature Flags, and Integrations, which conflicted with `MASTER_SPEC §27` (Bounded Contexts) and `§28` (Functional Modules) — neither of which recognizes a Settings context/module anywhere in their canonical lists — with `ADR-011` (no Settings module in its module-ownership model), with `API_SPEC.md §19`'s own Resource Ownership Matrix (previously silent on Settings as a resource), and with `IMPLEMENTATION_ROADMAP.md`'s 13-Epic roadmap (no Settings Epic). **This conflict has now been explicitly resolved in the documentation**: Organization Settings are owned by Organizations; the former standalone Settings-module description in `API_SPEC.md §32` is stale and has been reconciled accordingly — `§32` now carries an explicit Ownership Reconciliation Note stating this, its own "Ownership" subsection is labeled historical/superseded, and `§19`'s Resource Ownership Matrix now includes an explicit `Organization Settings → Organizations` row. `API_SPEC.md §32`'s remaining field-level content (Responsibilities list, Capability subsections, Domain Events) is preserved as historical reference only and is **not adopted** as an implementation contract. Organization Settings, White Label, and Branding remain Organizations-owned capabilities, consistent with `MASTER_SPEC §27.2` and `§28.2`.

### Configuration Ownership Matrix

A dedicated cross-document audit of configuration ownership and precedence (`MASTER_SPEC`, `Architecture.md`, `ADR-011`, `API_SPEC.md`, `IMPLEMENTATION_ROADMAP.md`) was performed to establish the boundary below explicitly, independent of the now-stale `API_SPEC.md §32`.

| Configuration Category | Owning Bounded Context / Module | Scope | In STORY-003-006? | Authoritative Source |
|---|---|---|---|---|
| Organization Settings | **Organizations** | Organization-level | Yes — `support_contact_email` approved for implementation (see Product Field Proposal and Approved Field Contract below) | `MASTER_SPEC §27.2` (Organizations Context, "Incluye: ... Organization Settings ..."), `§28.2` (Organizations Module, Recursos: "Organization Settings"); `Architecture.md` "## Organizations" ("Incluye: ... Organization Settings ..."); `API_SPEC.md §19` (`Organization Settings → Organizations`, added this Story) |
| Branding / White Label | **Organizations** | Organization-level | No — STORY-003-005's scope | `MASTER_SPEC §27.2`, `§28.2` ("White Label," "Branding"); `Architecture.md` "## Organizations" ("Branding," "White Label") |
| Event Settings | **Events** | Event-level | No | `MASTER_SPEC §26.4` (full field list: Zona horaria, Idioma, Configuración visual, Configuración del RSVP, Configuración de asistentes, Configuración de privacidad, Configuración del dominio, Configuración de mensajería — "Toda configuración pertenece exactamente a un Event"); `§27.5` (Events Context, "Incluye: ... Configuración ..."); `Architecture.md` "## Events" ("Configuración general," "Configuración del evento") |
| Feature Flags / Global (Platform) Configuration | **Administration** | Platform-level (non-commercial, per `§27.14`) | No | `MASTER_SPEC §27.14` (Administration Context, "Incluye: ... Configuración global, Feature Flags ...", "Este contexto no forma parte del producto comercial"); `§28.13` (Administration Module, Responsabilidades: "Configuración global, Feature Flags," Recursos: "System Settings") — converging at both the Bounded-Context and Functional-Module level |
| Organization Plan / Subscription | **Billing** | Organization-level (commercial) | No | `API_SPEC.md §19` (`Subscription → Billing`); `Architecture.md` "## Billing" ("Planes," "Suscripciones," "Facturación"). Note: `MASTER_SPEC §27.2`'s "Organization Plan" and `Architecture.md` "## Organizations"' "Subscription Ownership" are stale wording under Organizations — a separately recorded, pre-existing inconsistency (see Known Documentation Inconsistencies), not reopened here |
| Organization Status | Organizations (activation state) — implemented and closed | Organization-level | No — STORY-003-004 (implemented and closed; see its section) | `MASTER_SPEC §27.2`; `API_SPEC.md §22` (Activate/Suspend Organization) |
| Notifications | **Not determined by any authoritative source** | Undetermined | No | No `MASTER_SPEC`, `Architecture.md`, or `ADR-011` statement assigns Notifications to any module; only the stale `API_SPEC.md §32` mentions it |
| Integrations | **Not determined by any authoritative source** | Undetermined | No | Same as Notifications — only `API_SPEC.md §32` (stale) mentions it |
| Localization | No organization-level ownership found; only an event-level equivalent exists | Event-level only | No | `MASTER_SPEC §26.4` (Zona horaria, Idioma are Event Settings fields, not Organization-level) |
| Platform Defaults / Configuration Inheritance Hierarchy | **UNSPECIFIED** | N/A | No | Not established by `MASTER_SPEC`, `Architecture.md`, or `ADR-011` anywhere; the only source describing a hierarchy ("Platform Default → Organization Settings → Event Settings") is the stale `API_SPEC.md §32`, not adopted |

**Defaults / inheritance:** no authoritative document establishes a configuration hierarchy or inheritance/override mechanism between Platform, Organization, and Event configuration. This is marked **UNSPECIFIED**, not adopted from `§32`. No default-resolution, fallback, or inheritance behavior is implemented or planned by this Story.

### Scope (Narrowed)

- Retrieve Organization Settings (`support_contact_email`).
- Update Organization Settings (`support_contact_email` — required in the request body; not clearable back to `null` once set, only replaceable with another valid value).
- One Organization Settings resource per Organization, Organizations-owned.
- OWNER-only access via the existing `verifyOwnerMembership({ userId, organizationId })` (STORY-003-003), with the same authentication, tenancy, SYSTEM-organization exclusion, and normalized byte-identical `RESOURCE_NOT_FOUND` (404) behavior already established.

### Preconditions

- Organization already exists (STORY-003-001).
- Caller supplies a valid Bearer access token and holds an ACTIVE OWNER membership in the target Organization.

### API Reference

- `GET /api/v1/management/organizations/:organizationId/settings` (API_SPEC.md §22 "Retrieve Organization Settings").
- `PATCH /api/v1/management/organizations/:organizationId/settings` (API_SPEC.md §22 "Update Organization Settings").

### Authentication / Authorization

Identical to STORY-003-003/005: ACTIVE OWNER membership required — ADMIN, MEMBER, and CLIENT are not authorized. No new role or permission introduced.

### Request Schema (PATCH)

```json
{ "support_contact_email": "string (well-formed email), required, non-empty after trimming" }
```

Required — this field cannot be cleared back to `null` once set; a client must supply a replacement value to change it. No other field is accepted.

### Response Schema (GET and PATCH, success, 200 OK)

```json
{
  "success": true,
  "data": {
    "organization_id": "uuid",
    "support_contact_email": "string | null"
  }
}
```

A new, standalone DTO — distinct from `OrganizationDto` (STORY-003-002) and `OrganizationBrandingDto` (STORY-003-005), both of which remain unchanged.

### Status / Error Mapping

- `VALIDATION_ERROR` (422): missing, empty, or whitespace-only value; a malformed email address.
- `RESOURCE_NOT_FOUND` (404): nonexistent organization; no membership; non-ACTIVE (SUSPENDED or REMOVED) membership; SYSTEM organization. All applicable cases byte-identical.
- `FORBIDDEN` (403): ACTIVE member, not OWNER.
- `UNAUTHORIZED` (401): authentication failure.
- `INTERNAL_SERVER_ERROR` (500): unexpected failure, no cause leaked.

### Identity Cross-Module Contract

None new. Reuses `verifyOwnerMembership({ userId, organizationId })` (STORY-003-003) unchanged.

### Repository and Service Boundaries

- New: one nullable column on the existing `organizations` table — `support_contact_email` (`text`, nullable, no default), consistent with this codebase's existing typed-column convention (no dedicated table, no JSONB) — the same design choice already made for STORY-003-005's branding columns.
- Single-row update; no transaction required.

### Required Tests

Unit (use case), handler/route, authorization (OWNER vs. ADMIN/MEMBER/CLIENT), tenancy (SYSTEM exclusion, cross-organization isolation), validation (missing/empty/malformed email), error-contract (byte-identical 404). Same accepted non-blocking gaps as prior EPIC-003 Stories: no database-backed integration-test infrastructure; no API contract-testing tooling (ADR-008 gap).

### Explicit Exclusions

The following are excluded from this Story's scope and were not adopted from `API_SPEC.md §32` without separate approval:

- Branding / White Label — remains exclusively STORY-003-005's scope.
- Localization.
- Notifications.
- Integrations.
- Feature Flags.
- Event Settings.
- Platform Defaults / configuration inheritance hierarchy.
- Organization Plan — a Billing/Subscription concept (`API_SPEC §19`: `Subscription → Billing`), not a Settings field; also the subject of a separate, already-recorded documentation inconsistency (`MASTER_SPEC §27.2` "Organization Plan" vs. `§27.4` "Planes").
- Organization Status — belongs to STORY-003-004 (Activate/Suspend), implemented and closed separately.
- API Keys — a separately recorded, unresolved module-ownership gap (see §3 Out of Scope above), not part of Settings.

### Field-Level Audit (Historical — Superseded for `support_contact_email`)

A dedicated field-level search was conducted across `MASTER_SPEC`, `API_SPEC.md`, `USER_FLOWS.md`, `Architecture.md`, `DESIGN_SYSTEM.md`, `UI_SPEC.md`, and `CONTENT_GUIDELINES.md`. At the time of that search, **zero concrete Organization Settings fields had any authoritative basis** once the exclusions below are applied — every mention of Organization-level configuration in the documentation set was either a bare, never-expanded label ("Configuración general" — `MASTER_SPEC §26.1`, `§27.2`, `§28.2`; "Configuración empresarial" — `§28.2`) or belonged to an excluded category or a different Story/entity (Plan, Status, API Keys, Guest preferences, a Dashboard nav-item reference in `UI_SPEC.md §4` with no field content). No field was invented to fill this gap during the audit. `support_contact_email` was subsequently approved as an explicit **NEW PRODUCT DECISION** (see below) — it is not derived from this audit's search and remains marked as such; the audit's finding of zero *authoritative-source* fields stands unchanged for every field not explicitly approved this way.

### Product Field Proposal and Approved Field Contract

A dedicated Product Field Proposal was prepared to give a candidate field set for explicit product approval, without treating any candidate as decided. Three candidates were identified, grounded in general product reasoning about this platform rather than any authoritative source:

- `support_contact_email` — **NEW PRODUCT DECISION; approved for implementation.** Explicit field approval was given ("`support_contact_email` is approved for implementation"), followed by explicit confirmation of: required-not-clearable behavior in the PATCH request; the `GET`/`PATCH /api/v1/management/organizations/:organizationId/settings` endpoint path; and column-based persistence (one nullable column on `organizations`, not a dedicated table). The full approved contract is recorded above (Scope, Preconditions, API Reference, Request/Response Schema, Status/Error Mapping, Identity Cross-Module Contract, Repository and Service Boundaries).
- `support_contact_phone` — **NEW PRODUCT DECISION; not approved.** Remains out of scope.
- `description` — **NEW PRODUCT DECISION, with an additional flagged ownership-overlap risk against STORY-003-005 (Branding/White Label); not approved.** Remains out of scope. STORY-003-005 was not reopened, and `description` was not moved into Branding/White Label.

Only `support_contact_email` is approved. Approving one field does not imply approval of the other two — they remain unapproved unless separately and explicitly approved in the future.

### Implementation Trigger (Historical Record — Both Conditions Satisfied)

**Implementation required both conditions below to be explicitly satisfied — neither alone was treated as sufficient:**

1. **Field approval.** The product owner explicitly identifies the approved field or field set, using unambiguous language (e.g. "`support_contact_email` is approved for implementation," or "The following Organization Settings field set is approved for implementation: …"). Per the project's Explicit Product Approval rule, a proposal, a candidate identification, a "recommended minimal scope," "cleanest candidate" language, discussion, or conversational acknowledgment ("understood," "accepted," "looks good," or similar) does **not** constitute field approval. — **Satisfied**: `support_contact_email` was explicitly approved for implementation, and the decision package's open items (required-not-clearable behavior, endpoint path, column-based persistence) were subsequently confirmed.
2. **Implementation authorization.** The product owner explicitly authorizes implementation of STORY-003-006 *after* the field contract has been approved (e.g. "Proceed with implementation of STORY-003-006," or "Implement STORY-003-006 using the approved field contract"). — **Satisfied**: explicit implementation authorization was given after field approval.

`support_contact_phone` and `description` remain unapproved and out of scope — approving `support_contact_email` did not imply approval of the other two. This ID is not reassigned to another capability.

### Implementation Summary

STORY-003-006 is implemented in full, matching the approved contract above:

- **Endpoints**: `GET /api/v1/management/organizations/:organizationId/settings` and `PATCH /api/v1/management/organizations/:organizationId/settings`, both thin Next.js route adapters in `apps/dashboard` delegating to the Organizations module's pre-wired handlers, alongside the existing `GET`/`PATCH` on `.../organizations/:organizationId` and `.../organizations/:organizationId/branding`.
- **Authorization**: reuses `verifyOwnerMembership` (STORY-003-003) unchanged — no new Identity contract. ACTIVE OWNER required; ADMIN/MEMBER/CLIENT excluded.
- **Denial mapping**: `NOT_ACTIVE_MEMBER`, a defensively-missing organization row, and a SYSTEM-typed organization all normalize to the same use-case-level `NOT_FOUND`, mapped to a byte-identical `RESOURCE_NOT_FOUND` (404) — verified directly by dedicated handler tests on both endpoints. `NOT_OWNER` maps to `FORBIDDEN` (403).
- **Request validation**: `support_contact_email` — required, trimmed, validated as a well-formed email address (max 254 characters, RFC 5321 §4.5.3.1.3), using zod's `html5Email` pattern rather than its stricter default so legitimate internationalized (punycode) domains and single-label domains such as `localhost` are accepted; missing, empty, whitespace-only, too-long, or malformed values are rejected with `VALIDATION_ERROR` (422). No other field is accepted.
- **Field behavior**: required, not clearable — once set, only replaceable with another valid value, exactly as approved.
- **Response**: a new, standalone `OrganizationSettingsDto` — `OrganizationDto` (STORY-003-002) and `OrganizationBrandingDto` (STORY-003-005) are unchanged.
- **Persistence**: one new nullable column on `organizations` (`support_contact_email`), added via `packages/database/src/schema.ts` and `supabase/migrations/20260922010000_organizations_settings.sql`, following this repository's hand-written SQL migration convention. Single-row update; no transaction.
- **Post-closure refinement**: a focused validator review (after initial closure) found the email check accepted arbitrarily long input and rejected legitimate punycode/single-label domains; both gaps were fixed by adding the length cap and switching to the `html5Email` pattern above, with three new tests added to cover them. The branding validator (STORY-003-005) received an analogous fix in the same review pass — see that Story's Implementation Summary.
- **Post-closure refinement (STORY-003-004)**: Retrieve and Update Settings return `403 ORGANIZATION_SUSPENDED` for a SUSPENDED Organization, after the OWNER check. Responses for ACTIVE Organizations are unchanged.

### Validation Results

- `pnpm typecheck`: 27/27 tasks succeeded.
- `pnpm lint`: 21/21 packages clean (biome).
- `pnpm test`: 27/27 tasks succeeded — Identity: 286/286 tests pass (unchanged); Organizations: 213/213 tests pass (207 as of initial implementation + 3 settings-validator refinement tests + 3 branding-validator refinement tests from the same review pass).
- `pnpm build`: 21/21 tasks succeeded, including the dashboard build registering the new `settings` route alongside the existing `[organizationId]` and `branding` routes.

### Accepted Non-Blocking Gaps

- No database-backed integration test for `DrizzleOrganizationRepository.updateSettings` or for the new migration's actual application to a live database — the same pre-existing, codebase-wide gap already accepted for every prior EPIC-003 Story (no integration-test infrastructure, and no drizzle-kit/migration-execution tooling, exist anywhere in this repository).
- No API contract-testing tooling exists (ADR-008 requires contract tests for every public API modification) — a pre-existing, codebase-wide gap, not introduced by this Story.

EPIC-002, Stories 002-001 through 002-008, STORY-003-001, STORY-003-002, STORY-003-003, and STORY-003-005 remain frozen and behaviorally unchanged — verified by all 286 pre-existing Identity tests and all 162 pre-existing Organizations tests passing with no assertion changes. `support_contact_phone` and `description` were not implemented and remain unapproved and out of scope.

### Known Documentation Inconsistencies (Not Resolved by This Story)

- `API_SPEC.md §32` ("Settings API"/"Settings Module") — **resolved**: Organization Settings are owned by Organizations; the former standalone Settings-module description in `API_SPEC.md §32` is stale and has been reconciled accordingly. `§32` now carries an explicit Ownership Reconciliation Note recording this, its "Ownership" subsection is labeled historical/superseded, and `§19`'s Resource Ownership Matrix now includes `Organization Settings → Organizations`. `§32`'s remaining field-level content (Responsibilities list, Capability subsections, Domain Events) is preserved as historical reference only and is not an implementation contract — no concrete fields or endpoints were adopted from it.
- `MASTER_SPEC §27.14` Administration Context separately claims "Feature Flags" as a platform-internal concern. `§32`'s Ownership Reconciliation Note now states that Feature Flags/global configuration remain governed by Administration per `§27.14`, so this is no longer a competing claim from `§32` — it remains recorded here for traceability, not as an open conflict.
- All previously recorded EPIC-003 inconsistencies (the "Organization administrator" role-name wording, `API_SPEC §16`'s `hasPrevious`/`hasNext` pagination example, the `MASTER_SPEC §27.2`/`§27.4` "Organization Plan"/"Planes" overlap and stale Billing/Subscription wording, and the STORY-002-007-vs-STORY-003-002/003 denial-response precedent divergence) remain unresolved and unchanged.

---

# 6. Story Dependencies

```text
STORY-003-001
Organization Creation & Onboarding
        │
        ├──────────────► STORY-003-002
        │                Organization Retrieval & Listing
        │
        ├──────────────► STORY-003-003
        │                Organization Update & Settings Management
        │
        └──────────────► STORY-003-005
                         White Label / Branding Configuration

STORY-003-004 is implemented and closed (see its section). It depends on STORY-003-002 (visibility extension, implemented) and extends the enforcement points of STORY-003-002, 003, 005, and 006 (each Story's own section records its post-closure refinement).

STORY-003-006 is implemented and closed (see its section) — not part of the dependency graph above because it depends only on STORY-003-001, the same as STORY-003-002/003/005.
```

All six Stories are now closed (see each Story's own "Status" line and Implementation Summary/State section).

STORY-003-001 is the dependency root: it is the only Story that produces the Organization entity and the only Story requiring a new cross-module contract with Identity; every other Story operates on an Organization it has already created.

---

# 7. Technical Constraints

All Stories must respect the following constraints:

- Organizations business logic belongs to `packages/modules/organizations`.
- Organizations must never create, modify, delete, or directly query Identity-owned entities/tables (`User`, `OrganizationMembership`) — only through Identity's public Application Services (ADR-011).
- Domain code must not depend on Next.js, Supabase implementation details, or HTTP.
- No shared domain ownership: Subscription remains Billing's; Domain remains the future Domains module's; API Key ownership remains unresolved and out of scope.
- No new RBAC permission, role, or actor may be introduced without explicit approval.
- Tenant/organization isolation must be enforced server-side.
- The existing shared database transaction primitive (`@allinvites/database`) is the only sanctioned mechanism for cross-module atomic writes in this Epic — no new event-bus/outbox infrastructure.
- All security-sensitive behavior requires automated tests.

---

# 8. Epic Definition of Done

EPIC-003 is complete when:

- STORY-003-001, STORY-003-002, STORY-003-003, STORY-003-004, STORY-003-005, and STORY-003-006 are each contract-audited, approved, implemented, and tested. (STORY-003-004 and STORY-003-006 were added to the Epic after this Definition of Done was first written; this list now names all six.) **Satisfied** — all six carry a "Closed — Implemented" status line.
- No Subscription, Domain-entity, API-Key, or Platform-Administrator logic has been introduced anywhere in the Organizations module. (STORY-003-004's "platform-privileged caller" is not an exception to this: it introduces no new role — platform privilege is an ACTIVE OWNER or ADMIN membership in the existing SYSTEM organization, using roles STORY-002-006 already defines.) **Satisfied.**
- The `organizations` schema and any new settings/branding fields exist only as explicitly approved in each Story's own contract audit. **Satisfied** — `organization_status`, `brand_name`/`logo`/`primary_color`/`secondary_color`, and `support_contact_email` each trace to an explicit approval recorded in their own Story.
- Identity's new `CreateInitialOwnerMembershipService` is implemented, tested, and does not alter any existing EPIC-002 Story's approved contract. **Satisfied**, along with the other additive-only Identity services added later in the Epic (`verifyActiveMembership`, `listActiveOrganizationIds`, `verifyOwnerMembership`, `verifyPlatformPrivilege`) — none alter an existing EPIC-002 contract.
- Unit tests pass. Integration tests pass. Typecheck passes. Lint passes. Build passes. **Satisfied** for unit/typecheck/lint/build, per each Story's own Validation Results; no database-integration-test infrastructure exists anywhere in this repository, a pre-existing, codebase-wide gap accepted by every Story (see each Story's "Accepted Non-Blocking Gaps").
- No undocumented architectural changes were introduced. **Satisfied.**
- No unresolved security-critical issues remain. **Satisfied** — the Supabase advisor findings raised during this Epic (the `audit_logs` trigger's mutable `search_path`) were fixed and verified; the pre-existing, project-level `rls_auto_enable` finding predates this Epic and is recorded as an accepted non-blocking gap under STORY-003-004.

This Definition of Done is fully satisfied as of 2026-10-08; EPIC-003 is closed.

---

# 9. First Implementation Story

The first implementation target is:

**STORY-003-001 — Organization Creation & Onboarding**

Its contract was audited and approved (see this document, §5). It is the correct dependency root: every other Story in this Epic operates on an Organization that only this Story can create, and it is the only Story requiring the new Identity cross-module contract. STORY-003-001 was implemented first, as planned, and is now closed along with the rest of the Epic (see §8).
