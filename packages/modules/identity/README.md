# @allinvites/module-identity

Authentication, sessions, password recovery, user profile, roles and permissions.

## Status

STORY-002-001 — User Registration, STORY-002-002 — User Login,
STORY-002-003 — Session Management, STORY-002-004 — Password Recovery
(forgot-password, reset-password, and change-password),
STORY-002-005 — User Profile (MVP: `full_name` update only),
STORY-002-006 — RBAC Foundation (policy mechanism only — see below),
STORY-002-007 — Internal User / Team Management (Invite/Retrieve/List/
admin-Update/Remove/Activate/Suspend User, Assign Roles — see below), and
STORY-002-008 — Organization Membership & Access Context (`GET /auth/me`
already satisfied its own acceptance criterion; STORY-002-008 additionally
approved `organization_id` as the permanent, platform-wide Organization
Context convention and extracted `resolveOrganizationContext` as a reusable
primitive — see below) are implemented.

## Business purpose

Owns the User entity end-to-end — authentication, profile, Organization
Membership and the RBAC role vocabulary (OWNER, ADMIN, MEMBER, CLIENT) — per
MASTER_SPEC §28.1. There is no separate "Users" module.

## Public contracts (`index.ts`)

- `registerUserHandler(rawBody)` — ready-to-use handler for
  `POST /auth/register` (API_SPEC.md §21a), pre-wired with the Supabase/
  Drizzle infrastructure.
- `loginHandler(rawBody)` — ready-to-use handler for `POST /auth/login`
  (API_SPEC.md §21a), pre-wired with the Supabase infrastructure. Returns
  only a session; profile/membership resolution belongs to `GET /auth/me`
  (STORY-002-003), not Login.
- `meHandler(authorizationHeader)` — ready-to-use handler for
  `GET /auth/me` (API_SPEC.md §21a "Current User"). Reads the `Authorization:
  Bearer <token>` header (API_SPEC.md § "Headers"), verifies it via Supabase,
  then resolves the User + Organization Memberships from this module's own
  data — Supabase is only the session verifier, never the profile source.
- `refreshSessionHandler(rawBody)` — ready-to-use handler for
  `POST /auth/refresh` (API_SPEC.md §21a "Existing Authentication
  Endpoints"). Body-driven (`{ refresh_token }`), like Register/Login.
- `logoutHandler(authorizationHeader)` — ready-to-use handler for
  `POST /auth/logout` (API_SPEC.md §21a "Existing Authentication
  Endpoints"). Header-driven, like `GET /auth/me`.
- `forgotPasswordHandler(rawBody)` — ready-to-use handler for
  `POST /auth/forgot-password` (API_SPEC.md §21a). Always responds
  `{success:true}` regardless of whether the email matches an account.
- `resetPasswordHandler(rawBody)` — ready-to-use handler for
  `POST /auth/reset-password` (API_SPEC.md §21a). Body-driven
  (`{email, token, password}`); does **not** return a session — the
  documented success response is `{success:true}` only, so the caller must
  separately call `POST /auth/login` afterward.
- `changePasswordHandler(authorizationHeader, rawBody)` — ready-to-use
  handler for `POST /auth/change-password` (API_SPEC.md §23 "Change
  Password"; the technical contract — method, path, request/response shape,
  status codes — was finalized as part of closing out STORY-002-004, since
  §23 originally documented this capability only conceptually). Header +
  body driven: verifies the Bearer token via `SessionProvider`, then
  verifies `current_password` by reusing `AuthSessionProvider.signIn` (the
  same primitive Login already uses — no new credential-verification
  mechanism was introduced) before setting the new password.
- `updateProfileHandler(authorizationHeader, rawBody)` — ready-to-use
  handler for `POST /auth/profile` (API_SPEC.md §23 "Update User", MVP
  contract finalized alongside STORY-002-005). Updates only `full_name`;
  email, preferences, language, time zone, notifications, and profile photo
  are explicitly out of scope for this Story — see "Known gaps."
- `inviteUserHandler(authorizationHeader, query, rawBody)` — ready-to-use
  handler for `POST /api/v1/management/users/invitations` (STORY-002-007,
  API_SPEC.md §23 "Invite User"). OWNER-only. `query` must contain
  `organization_id` (the interim Organization Context input — STORY-002-008
  will formalize this). Creates a pending `Invitation`, hashing and
  persisting its token (never the raw token); delivery is routed through
  `InvitationDeliveryProvider`, currently wired to a no-op implementation
  (see "Known gaps").
- `getUserHandler(authorizationHeader, query, targetUserId)` — ready-to-use
  handler for `GET /api/v1/management/users/{userId}` (API_SPEC.md §23
  "Retrieve User"). OWNER-only.
- `listUsersHandler(authorizationHeader, query)` — ready-to-use handler for
  `GET /api/v1/management/users` (API_SPEC.md §23 "List Users"). OWNER-only.
  Standard pagination (`page`, `pageSize` query parameters).
- `updateUserHandler(authorizationHeader, query, targetUserId, rawBody)` —
  ready-to-use handler for `PATCH /api/v1/management/users/{userId}`
  (API_SPEC.md §23 "Update User", admin case). OWNER-only. Same `full_name`
  -only boundary as the self-service `POST /auth/profile`.
- `removeUserHandler(authorizationHeader, query, targetUserId)` —
  ready-to-use handler for `DELETE /api/v1/management/users/{userId}`
  (API_SPEC.md §23 "Remove User"). OWNER-only. Soft-transitions the target's
  Organization Membership to `REMOVED` — never deletes the global User/auth
  account, never a row delete. Enforces the last-active-OWNER invariant
  (`CANNOT_REMOVE_LAST_OWNER`).
- `suspendUserHandler(authorizationHeader, query, targetUserId)` /
  `activateUserHandler(authorizationHeader, query, targetUserId)` —
  ready-to-use handlers for `POST /api/v1/management/users/{userId}/suspend`
  and `.../activate` (API_SPEC.md §23 "Suspend User" / "Activate User").
  OWNER-only, sharing the `users:suspend` permission (no separate "activate"
  permission was approved). Suspend enforces
  `CANNOT_SUSPEND_LAST_OWNER`.
- `assignUserRoleHandler(authorizationHeader, query, targetUserId, rawBody)`
  — ready-to-use handler for `POST /api/v1/management/users/{userId}/role`
  (API_SPEC.md §23 "Assign Roles"). OWNER-only. Enforces
  `CANNOT_DEMOTE_LAST_OWNER`; no other role-hierarchy rule is implemented
  (none was approved for this Story).
- `resolveOrganizationContext({sessionProvider, membershipRepository,
  accessToken, organizationId})` — STORY-002-008's reusable Organization
  Context primitive (API_SPEC.md §7 "Organization Context Resolution").
  Authenticates the caller, resolves their `OrganizationMembership` for the
  supplied `organizationId` (never trusting it merely because the client
  sent it — always re-verified against persisted membership rows), and
  requires it ACTIVE. Returns the resolved membership (organization + role
  + status together) as the authorization context, or `FORBIDDEN`
  identically for "no membership," "SUSPENDED," or "REMOVED" — never
  revealing which. Deliberately does **not** perform permission
  authorization itself (that remains `AuthorizationPolicy`'s job) and is
  purely request-scoped — nothing is persisted or remembered between calls.
  STORY-002-007's `resolveAuthorizedCaller` now composes this primitive with
  a permission check internally; its own public signature and behavior are
  unchanged.
- `AuthorizationPolicy`, `RolePermissionRegistry`, `Permission` — the
  STORY-002-006 RBAC Foundation mechanism. `RolePermissionRegistry` is a
  Role → Permission association store that starts empty (MASTER_SPEC §28.1
  "Nota de Permisos" forbids inventing a permission catalog); `Permission`
  is an opaque string with no defined codes. `AuthorizationPolicy.authorize
  (membership, permission)` evaluates an `OrganizationMembership`'s role
  against the registry, fail-secure (deny by default). **Now wired into the
  8 STORY-002-007 Team Management handlers** via
  `createTeamManagementAuthorizationPolicy()`, which seeds exactly 7
  permissions (`users:invite`, `users:read`, `users:list`, `users:update`,
  `users:remove`, `users:suspend`, `users:assign_role`) onto `OWNER` only —
  ADMIN, MEMBER and CLIENT hold none of them. `AuthorizationPolicy` and
  `RolePermissionRegistry` themselves were not modified; only populated, as
  originally designed.
- `RegisterUserUseCase` / `createRegisterUserHandler`, `LoginUserUseCase` /
  `createLoginHandler`, `ResolveCurrentUserUseCase` / `createMeHandler`,
  `RefreshSessionUseCase` / `createRefreshSessionHandler`,
  `LogoutUseCase` / `createLogoutHandler`,
  `InitiatePasswordRecoveryUseCase` / `createForgotPasswordHandler`,
  `ResetPasswordUseCase` / `createResetPasswordHandler`,
  `ChangePasswordUseCase` / `createChangePasswordHandler`, and
  `UpdateUserProfileUseCase` / `createUpdateProfileHandler` — for composing
  each Use Case with different (e.g. fake) infrastructure, primarily in
  tests.
- `UserRepository`, `AuthProvider`, `AuthSessionProvider`, `SessionProvider`,
  `PasswordRecoveryProvider`, `OrganizationLookupPort` — the ports the Use
  Cases depend on. `AuthSessionProvider` (establishing a new session from
  credentials), `SessionProvider` (operating on an existing session —
  verify/refresh/revoke), and `PasswordRecoveryProvider` (initiate/reset) are
  deliberately separate from `AuthProvider` (account creation) and from each
  other (Interface Segregation), so implementing each Story required no
  changes to any previously-approved Story's ports. `UserRepository` itself
  was extended (`updateFullName`) rather than fragmented — it already owns
  reads/writes on the User aggregate.
- `RegisterUserRequestDto`, `RegisteredUserDto`, `LoginRequestDto`,
  `LoginResponseDto`, `MeResponseDto`, `RefreshSessionRequestDto`,
  `RefreshSessionResponseDto`, `ForgotPasswordRequestDto`,
  `ResetPasswordRequestDto`, `ChangePasswordRequestDto`,
  `UpdateProfileRequestDto`, `UpdateProfileResponseDto` — the public wire
  contracts.
- `UserRegisteredEvent`, `UserAuthenticatedEvent`, `UserLoggedOutEvent` — the
  integration events produced on successful registration/login/logout
  (MASTER_SPEC §28.1 "Produce"). No event bus exists yet; each event is
  returned by its Use Case for a future publisher to consume. Session
  refresh and Password Recovery do not produce an event — neither is listed
  as a Produce event in MASTER_SPEC §28.1.

## Dependencies

`@allinvites/kernel`, `@allinvites/database`, `@allinvites/auth`.

## Owned entities

`User`, `OrganizationMembership` (MASTER_SPEC §26.2, §26.2a), `Invitation`
(STORY-002-007).

## Known gaps

- `invitation_token` is still accepted by the `POST /auth/register` contract
  but always rejected with `INVALID_OR_EXPIRED_TOKEN`. STORY-002-007 now
  implements "Invite User" (real, persisted `Invitation` records exist),
  but Registration's consumption side was explicitly not wired in as part
  of that Story — see the STORY-002-007 known-gap entries below for what
  remains required. This is correct current behavior, not a stub — see
  `InvalidInvitationTokenError`.
- Whether Supabase sends a confirmation email for admin-created users with
  `email_confirm: false` depends on project-level settings and has not been
  verified against a live Supabase project.
- No live integration test exists against a real Supabase/Postgres instance
  (none was available in this environment); only unit tests with fakes.
- **No rate limiting.** SECURITY.md §15 requires rate limiting for
  Authentication and Public APIs, which applies to every endpoint in this
  module — most critically `POST /auth/login`, `POST /auth/refresh`, and
  `POST /auth/forgot-password` (all guessing/enumeration/abuse targets), and
  still applicable to `POST /auth/register`, `GET /auth/me`,
  `POST /auth/logout`, `POST /auth/reset-password`,
  `POST /auth/change-password`, and all 8 STORY-002-007 Team Management
  endpoints (`POST /api/v1/management/users/invitations`,
  `GET /api/v1/management/users`, `GET|PATCH|DELETE
  /api/v1/management/users/{userId}`,
  `POST /api/v1/management/users/{userId}/{suspend|activate|role}`). No
  rate-limiting infrastructure exists anywhere in this repository yet. None
  of these endpoints **must be exposed to production traffic until rate
  limiting is in place.** This is a cross-cutting/platform concern — it
  belongs at the application edge or gateway layer (e.g. middleware, reverse
  proxy, or a shared infrastructure package), not inside the Identity
  module's domain or application logic, and is intentionally out of scope
  for every Story implemented so far. This gap is not satisfied by anything
  in this module today; do not assume it is covered.
- **No audit logging.** ADR-007 ("Security-First") explicitly lists both
  "Login" and "Logout" as actions that must be logged, and SECURITY.md §16
  ("Audit Logging") names Authentication generically as a required audit
  event — Password Recovery and Change Password are security-sensitive
  credential events of the same class. No audit infrastructure exists
  anywhere in this repository yet — Registration, Login, Logout, Password
  Recovery, Change Password, and STORY-002-007's Team Management operations
  currently produce no audit trail (Registration/Login/Logout/Invite
  User/Remove User each return a typed integration event —
  `UserRegisteredEvent`, `UserAuthenticatedEvent`, `UserLoggedOutEvent`,
  `UserInvitedEvent`, `UserRemovedEvent` — but nothing consumes or persists
  them as an audit record, since no event bus/audit sink exists; Password
  Recovery, Change Password, admin Update User, Suspend/Activate User, and
  Assign Roles produce no event at all, since MASTER_SPEC §28.1 does not
  list one for any of them — only `UserCreated`/`UserInvited`/`UserRemoved`
  are named alongside the auth events, and STORY-002-007 deliberately did
  not invent `UserSuspended`/`UserActivated`/`UserRoleChanged`).
  **Audit logging for Login, Logout, Password Recovery, and Change Password
  is required before production exposure.** This must be implemented using
  the project's future shared/cross-cutting audit infrastructure once it
  exists, not an ad-hoc logger added inside the Identity module. This gap is
  not satisfied by anything in this module today; do not assume it is
  covered.
- **`POST /auth/logout`'s error status/code is an inferred convention, not
  an explicitly documented one.** API_SPEC.md §21a shows only the success
  case for `POST /auth/logout` (`200 OK, { "success": true }`); it does not
  show an error example the way `GET /auth/me` and `POST /auth/refresh` do.
  Since Logout shares the identical "Authentication requirement: Required"
  language with `GET /auth/me`, this implementation reuses that endpoint's
  documented `401 UNAUTHORIZED` / "Authentication is required." convention
  for a missing/invalid access token on Logout. This is a reasoned extension
  of an existing documented pattern, not an invented one, but it has not
  been explicitly confirmed against the authoritative contract.
- **`GET /auth/me` returns `500` (not `401`) if Supabase confirms a valid
  access token but no matching Identity `User` row exists locally.** This is
  treated as a server-side data-consistency bug rather than a caller
  authentication failure (a correctly functioning system should never reach
  this state, since Registration always creates the User row transactionally
  before returning a session) — undocumented, since the spec does not
  anticipate this case.
- **`POST /auth/change-password`'s technical contract was originally
  undefined and has since been decided and recorded in API_SPEC.md §23
  "Change Password".** API_SPEC.md §23 previously documented this capability
  only as a one-paragraph description with no method, path, request/response
  schema, or status/error codes (true of every capability in §23, not
  specific to Change Password). The finalized contract — method, path
  (`POST /auth/change-password`), request (`{current_password, new_password}`),
  success (`200 OK, {"success": true}`), and errors
  (`VALIDATION_ERROR`/422, `INVALID_CREDENTIALS`/401,
  `INTERNAL_SERVER_ERROR`/500) — is now recorded in API_SPEC.md §23 itself,
  not just in this README, and the implementation matches it exactly.
- **`POST /auth/reset-password`'s exact request field names (`email`,
  `token`, `password`) are not given verbatim in API_SPEC.md** (only the
  endpoint's purpose, auth requirement, success body, and error codes are
  documented — no JSON request schema is shown, unlike Register/Login).
  `email` is required specifically because Supabase's `verifyOtp` API needs
  it paired with the token; `token` and `password` follow the naming already
  established by `invitation_token` and Register's `password` field.
- **Whether the reset-password email actually delivers a plain OTP `token`
  (compatible with `verifyOtp({email, token, type:'recovery'})`, as
  implemented) or a magic-link URL with an embedded `token_hash` (Supabase's
  default email template) depends on project-level email template
  configuration and has not been verified against a live Supabase project**
  — the same class of uncertainty already disclosed for registration's
  confirmation email.
- **ARCHITECTURAL GAP — bulk session invalidation after a password
  change/reset is not implemented, and deliberately was not attempted in
  STORY-002-004.** Password change/reset invalidation is required by
  SECURITY.md §14 ("Session Management" — "Password change invalidation"),
  but the current architecture only supports revocation of a known
  individual access token (`SessionProvider.revoke`, via
  `admin.signOut(jwt)`). There is no available Supabase admin API to
  bulk-revoke a user's sessions by user id, and no session-tracking store
  exists in this repository to enumerate a user's active sessions in order
  to revoke them one by one. Closing this gap requires a future
  architectural decision (e.g. building a session-tracking store to enable
  bulk revocation, or accepting an alternative mitigation such as
  short-lived access tokens) — see Mission 012A's investigation for the full
  analysis. This decision does not block STORY-002-004: no session tracking,
  session store, new Supabase revocation mechanism, or speculative
  workaround was added or attempted here.
- **`POST /auth/profile` only updates `full_name`.** UI_SPEC.md §14 "User
  Profile" names Profile Information, Password, Preferences, Language, Time
  Zone, and Notifications as components of this capability, but only
  Profile Information's `full_name` field is implemented in this Story —
  by explicit decision, not oversight. Email changes, email
  re-verification, Preferences, Language, Time Zone, Notifications, and
  profile photo/avatar are all explicitly out of scope: none of them has a
  defined field schema, allowed-values list, or (for photo) a storage
  mechanism anywhere in the authoritative documentation (MASTER_SPEC,
  API_SPEC, UI_SPEC), and no infrastructure for any of them was created.
  Password management for this Story is fully covered by the already
  -implemented `POST /auth/change-password` (STORY-002-004) — `Update User`
  does not duplicate it.
- **`invitation_token` at `POST /auth/register` is still always rejected —
  STORY-002-007 does not wire invitation consumption into Registration.**
  STORY-002-001 remains unmodified by design (explicit mission instruction).
  `POST /api/v1/management/users/invitations` now creates and persists real
  pending `Invitation` records, but nothing yet consumes them. Before
  Registration can safely accept a real `invitation_token`, the following
  are still required: (1) an `InvitationRepository.findByTokenHash` lookup
  method (deliberately not added yet — no consumer exists for it); (2) an
  email-mismatch rule (registration email vs. invitation email — approved
  direction is "mismatch is rejected," not implemented); (3) a transaction
  spanning invitation-acceptance + User creation + Organization Membership
  creation as one atomic unit (today's `UserRepository.save` only spans the
  latter two). This is an explicit, approved deferral, not an oversight.
- **No concrete invitation-delivery mechanism exists.** `InviteUser` hashes
  and persists the invitation token via `InvitationRepository`, then calls
  `InvitationDeliveryProvider.deliver(...)` with the raw token — currently
  wired to `NoOpInvitationDeliveryProvider`, which does nothing (and never
  logs the token). There is currently no way to actually get an invitation's
  token to the invited person. This must be replaced with a real email (or
  other channel) adapter behind the same port once one exists; do not couple
  Identity to a specific provider ad hoc.
- **`Resend Invitation` (USER_FLOWS.md Flow 15) is explicitly out of
  scope.** `API_SPEC.md §23` never defined it as a capability, unlike Invite
  User/Update User Role/Activate/Suspend/Remove, which it does define. No
  endpoint exists for it.
- **`organization_id` is a required query parameter on all 8 Team
  Management endpoints — now the approved, permanent platform-wide
  Organization Context convention (STORY-002-008), not an interim one.**
  Callers must supply `organization_id` explicitly on every organization
  -scoped request; it is verified server-side against the caller's own
  Organization Memberships (never trusted blindly) and documented in
  API_SPEC.md §7 "Organization Context Resolution". Organization Context is
  deliberately request-scoped/stateless: no "current organization" is
  persisted, and no session/JWT claim implies one.
- **Only the `CANNOT_REMOVE_LAST_OWNER` / `CANNOT_SUSPEND_LAST_OWNER` /
  `CANNOT_DEMOTE_LAST_OWNER` invariant is enforced for OWNER role
  hierarchy.** No other rule (e.g. restricting which role a caller may
  assign, OWNER-assigns-OWNER restrictions) is implemented, since none was
  approved for this Story — only OWNER can call any of these 8 endpoints at
  all, so no additional hierarchy currently applies.
- **`GET /auth/me`'s response is unchanged by STORY-002-007** — it does not
  expose the new per-membership `status` (ACTIVE/SUSPENDED/REMOVED), by
  explicit instruction. A suspended/removed member currently cannot see
  their own membership status via `/auth/me`; this is deferred to whichever
  future Story/contract decision addresses it.
