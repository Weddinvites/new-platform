// Public surface of the identity module. Internal folders (domain,
// infrastructure, presentation/validators, mappers) remain private — see
// Architecture.md "Module Communication".

import type { Transaction } from "@allinvites/database";
import type { Result } from "@allinvites/kernel";
import { createTeamManagementAuthorizationPolicy } from "./application/policies/create-team-management-authorization-policy";
import {
  type CreateInitialOwnerMembershipError,
  type CreateInitialOwnerMembershipParams,
  type CreateInitialOwnerMembershipResult,
  type CreateInitialOwnerMembershipService,
  createCreateInitialOwnerMembershipService,
} from "./application/services/create-initial-owner-membership.service";
import {
  createListActiveOrganizationIdsService,
  type ListActiveOrganizationIdsError,
  type ListActiveOrganizationIdsParams,
  type ListActiveOrganizationIdsResult,
  type ListActiveOrganizationIdsService,
} from "./application/services/list-active-organization-ids.service";
import {
  createVerifyActiveMembershipService,
  type VerifyActiveMembershipError,
  type VerifyActiveMembershipParams,
  type VerifyActiveMembershipService,
} from "./application/services/verify-active-membership.service";
import {
  createVerifyOwnerMembershipService,
  type VerifyOwnerMembershipError,
  type VerifyOwnerMembershipParams,
  type VerifyOwnerMembershipService,
} from "./application/services/verify-owner-membership.service";
import { ActivateUserUseCase } from "./application/use-cases/activate-user.use-case";
import { AssignUserRoleUseCase } from "./application/use-cases/assign-user-role.use-case";
import { ChangePasswordUseCase } from "./application/use-cases/change-password.use-case";
import { GetUserUseCase } from "./application/use-cases/get-user.use-case";
import { InitiatePasswordRecoveryUseCase } from "./application/use-cases/initiate-password-recovery.use-case";
import { InviteUserUseCase } from "./application/use-cases/invite-user.use-case";
import { ListUsersUseCase } from "./application/use-cases/list-users.use-case";
import { LoginUserUseCase } from "./application/use-cases/login-user.use-case";
import { LogoutUseCase } from "./application/use-cases/logout.use-case";
import { RefreshSessionUseCase } from "./application/use-cases/refresh-session.use-case";
import { RegisterUserUseCase } from "./application/use-cases/register-user.use-case";
import { RemoveUserUseCase } from "./application/use-cases/remove-user.use-case";
import { ResetPasswordUseCase } from "./application/use-cases/reset-password.use-case";
import { ResolveCurrentUserUseCase } from "./application/use-cases/resolve-current-user.use-case";
import { SuspendUserUseCase } from "./application/use-cases/suspend-user.use-case";
import { UpdateUserUseCase } from "./application/use-cases/update-user.use-case";
import { UpdateUserProfileUseCase } from "./application/use-cases/update-user-profile.use-case";
import { NoOpInvitationDeliveryProvider } from "./infrastructure/providers/no-op-invitation-delivery-provider";
import { SupabaseAuthProvider } from "./infrastructure/providers/supabase-auth-provider";
import { DrizzleInvitationRepository } from "./infrastructure/repositories/drizzle-invitation-repository";
import { DrizzleOrganizationLookup } from "./infrastructure/repositories/drizzle-organization-lookup";
import { DrizzleOrganizationMembershipRepository } from "./infrastructure/repositories/drizzle-organization-membership-repository";
import { DrizzleUserRepository } from "./infrastructure/repositories/drizzle-user-repository";
import { createActivateUserHandler } from "./presentation/handlers/activate-user.handler";
import { createAssignUserRoleHandler } from "./presentation/handlers/assign-user-role.handler";
import { createChangePasswordHandler } from "./presentation/handlers/change-password.handler";
import { createForgotPasswordHandler } from "./presentation/handlers/forgot-password.handler";
import { createGetUserHandler } from "./presentation/handlers/get-user.handler";
import { createInviteUserHandler } from "./presentation/handlers/invite-user.handler";
import { createListUsersHandler } from "./presentation/handlers/list-users.handler";
import { createLoginHandler } from "./presentation/handlers/login.handler";
import { createLogoutHandler } from "./presentation/handlers/logout.handler";
import { createMeHandler } from "./presentation/handlers/me.handler";
import { createRefreshSessionHandler } from "./presentation/handlers/refresh-session.handler";
import {
  createRegisterUserHandler,
  type HandlerResponse,
} from "./presentation/handlers/register-user.handler";
import { createRemoveUserHandler } from "./presentation/handlers/remove-user.handler";
import { createResetPasswordHandler } from "./presentation/handlers/reset-password.handler";
import { createSuspendUserHandler } from "./presentation/handlers/suspend-user.handler";
import { createUpdateProfileHandler } from "./presentation/handlers/update-profile.handler";
import { createUpdateUserHandler } from "./presentation/handlers/update-user.handler";

export type { ActivateUserCommand } from "./application/commands/activate-user.command";
export type { AssignUserRoleCommand } from "./application/commands/assign-user-role.command";
export type { GetUserCommand } from "./application/commands/get-user.command";
export type { InviteUserCommand } from "./application/commands/invite-user.command";
export type { ListUsersCommand } from "./application/commands/list-users.command";
export type { LoginUserCommand } from "./application/commands/login-user.command";
export type { RefreshSessionCommand } from "./application/commands/refresh-session.command";
export type { RegisterUserCommand } from "./application/commands/register-user.command";
export type { RemoveUserCommand } from "./application/commands/remove-user.command";
export type { SuspendUserCommand } from "./application/commands/suspend-user.command";
export type { UpdateUserCommand } from "./application/commands/update-user.command";
export { AuthorizationPolicy } from "./application/policies/authorization-policy";
export type { Permission } from "./application/policies/permission";
export { RolePermissionRegistry } from "./application/policies/role-permission-registry";
export type {
  AuthProvider,
  AuthProviderError,
  AuthSession,
  AuthSessionProvider,
  CreatedAuthUser,
  SignInError,
} from "./application/ports/auth-provider";
export type { InvitationDeliveryProvider } from "./application/ports/invitation-delivery-provider";
export type { OrganizationLookupPort } from "./application/ports/organization-lookup.port";
export type {
  PasswordRecoveryError,
  PasswordRecoveryProvider,
  ResetPasswordError as ResetPasswordProviderError,
} from "./application/ports/password-recovery-provider";
export type {
  SessionError,
  SessionProvider,
  VerifiedIdentity,
} from "./application/ports/session-provider";
export {
  type CreateInitialOwnerMembershipError,
  type CreateInitialOwnerMembershipParams,
  type CreateInitialOwnerMembershipResult,
  type CreateInitialOwnerMembershipService,
  createCreateInitialOwnerMembershipService,
} from "./application/services/create-initial-owner-membership.service";
export {
  createListActiveOrganizationIdsService,
  type ListActiveOrganizationIdsError,
  type ListActiveOrganizationIdsParams,
  type ListActiveOrganizationIdsResult,
  type ListActiveOrganizationIdsService,
} from "./application/services/list-active-organization-ids.service";
export {
  type ResolveOrganizationContextError,
  resolveOrganizationContext,
} from "./application/services/resolve-organization-context";
export {
  createVerifyActiveMembershipService,
  type VerifyActiveMembershipError,
  type VerifyActiveMembershipParams,
  type VerifyActiveMembershipService,
} from "./application/services/verify-active-membership.service";
export {
  createVerifyOwnerMembershipService,
  type VerifyOwnerMembershipError,
  type VerifyOwnerMembershipParams,
  type VerifyOwnerMembershipService,
} from "./application/services/verify-owner-membership.service";
export {
  type ActivateUserError,
  type ActivateUserResult,
  ActivateUserUseCase,
} from "./application/use-cases/activate-user.use-case";
export {
  type AssignUserRoleError,
  type AssignUserRoleResult,
  AssignUserRoleUseCase,
} from "./application/use-cases/assign-user-role.use-case";
export {
  type ChangePasswordError,
  ChangePasswordUseCase,
} from "./application/use-cases/change-password.use-case";
export {
  type GetUserError,
  type GetUserResult,
  GetUserUseCase,
} from "./application/use-cases/get-user.use-case";
export {
  type InitiatePasswordRecoveryError,
  InitiatePasswordRecoveryUseCase,
} from "./application/use-cases/initiate-password-recovery.use-case";
export {
  type InviteUserError,
  type InviteUserResult,
  InviteUserUseCase,
} from "./application/use-cases/invite-user.use-case";
export {
  type ListUsersError,
  type ListUsersResult,
  ListUsersUseCase,
} from "./application/use-cases/list-users.use-case";
export {
  type LoginUserError,
  type LoginUserResult,
  LoginUserUseCase,
} from "./application/use-cases/login-user.use-case";
export { type LogoutError, LogoutUseCase } from "./application/use-cases/logout.use-case";
export {
  type RefreshSessionError,
  type RefreshSessionResult,
  RefreshSessionUseCase,
} from "./application/use-cases/refresh-session.use-case";
export {
  type RegisterUserError,
  type RegisterUserResult,
  RegisterUserUseCase,
} from "./application/use-cases/register-user.use-case";
export {
  type RemoveUserError,
  type RemoveUserResult,
  RemoveUserUseCase,
} from "./application/use-cases/remove-user.use-case";
export {
  type ResetPasswordError,
  ResetPasswordUseCase,
} from "./application/use-cases/reset-password.use-case";
export {
  type ResolveCurrentUserError,
  type ResolveCurrentUserResult,
  ResolveCurrentUserUseCase,
} from "./application/use-cases/resolve-current-user.use-case";
export {
  type SuspendUserError,
  type SuspendUserResult,
  SuspendUserUseCase,
} from "./application/use-cases/suspend-user.use-case";
export {
  type UpdateUserError,
  type UpdateUserResult,
  UpdateUserUseCase,
} from "./application/use-cases/update-user.use-case";
export {
  type UpdateUserProfileError,
  type UpdateUserProfileResult,
  UpdateUserProfileUseCase,
} from "./application/use-cases/update-user-profile.use-case";
export type { AssignUserRoleRequestDto } from "./contracts/assign-user-role.dto";
export type { ChangePasswordRequestDto } from "./contracts/change-password.dto";
export type { ForgotPasswordRequestDto } from "./contracts/forgot-password.dto";
export type { InvitationDto, InviteUserRequestDto } from "./contracts/invite-user.dto";
export type { LoginRequestDto, LoginResponseDto } from "./contracts/login-user.dto";
export type { MeResponseDto } from "./contracts/me.dto";
export type {
  RefreshSessionRequestDto,
  RefreshSessionResponseDto,
} from "./contracts/refresh-session.dto";
export type { RegisteredUserDto, RegisterUserRequestDto } from "./contracts/register-user.dto";
export type { ResetPasswordRequestDto } from "./contracts/reset-password.dto";
export type {
  UpdateProfileRequestDto,
  UpdateProfileResponseDto,
} from "./contracts/update-profile.dto";
export type { UpdateUserRequestDto } from "./contracts/update-user.dto";
export type { UserMembershipDto } from "./contracts/user-membership.dto";
export type { Invitation } from "./domain/entities/invitation";
export type { OrganizationMembership } from "./domain/entities/organization-membership";
export type { UserAuthenticatedEvent } from "./domain/events/user-authenticated.event";
export type { UserInvitedEvent } from "./domain/events/user-invited.event";
export type { UserLoggedOutEvent } from "./domain/events/user-logged-out.event";
export type { UserRegisteredEvent } from "./domain/events/user-registered.event";
export type { UserRemovedEvent } from "./domain/events/user-removed.event";
export type { InvitationRepository } from "./domain/repositories/invitation-repository";
export type {
  ListOrganizationMembersResult,
  MembershipWithUser,
  OrganizationMembershipRepository,
} from "./domain/repositories/organization-membership-repository";
export type { UserRepository } from "./domain/repositories/user-repository";
export type { InvitationStatus } from "./domain/value-objects/invitation-status";
export type { MembershipStatus } from "./domain/value-objects/membership-status";
export type { OrganizationRole } from "./domain/value-objects/organization-role";
export { createActivateUserHandler } from "./presentation/handlers/activate-user.handler";
export { createAssignUserRoleHandler } from "./presentation/handlers/assign-user-role.handler";
export { createChangePasswordHandler } from "./presentation/handlers/change-password.handler";
export { createForgotPasswordHandler } from "./presentation/handlers/forgot-password.handler";
export { createGetUserHandler } from "./presentation/handlers/get-user.handler";
export { createInviteUserHandler } from "./presentation/handlers/invite-user.handler";
export { createListUsersHandler } from "./presentation/handlers/list-users.handler";
export { createLoginHandler } from "./presentation/handlers/login.handler";
export { createLogoutHandler } from "./presentation/handlers/logout.handler";
export { createMeHandler } from "./presentation/handlers/me.handler";
export { createRefreshSessionHandler } from "./presentation/handlers/refresh-session.handler";
export {
  createRegisterUserHandler,
  type HandlerResponse,
} from "./presentation/handlers/register-user.handler";
export { createRemoveUserHandler } from "./presentation/handlers/remove-user.handler";
export { createResetPasswordHandler } from "./presentation/handlers/reset-password.handler";
export { createSuspendUserHandler } from "./presentation/handlers/suspend-user.handler";
export { createUpdateProfileHandler } from "./presentation/handlers/update-profile.handler";
export { createUpdateUserHandler } from "./presentation/handlers/update-user.handler";

let cachedRegisterHandler: ReturnType<typeof createRegisterUserHandler> | undefined;
let cachedLoginHandler: ReturnType<typeof createLoginHandler> | undefined;
let cachedMeHandler: ReturnType<typeof createMeHandler> | undefined;
let cachedRefreshHandler: ReturnType<typeof createRefreshSessionHandler> | undefined;
let cachedLogoutHandler: ReturnType<typeof createLogoutHandler> | undefined;
let cachedForgotPasswordHandler: ReturnType<typeof createForgotPasswordHandler> | undefined;
let cachedResetPasswordHandler: ReturnType<typeof createResetPasswordHandler> | undefined;
let cachedChangePasswordHandler: ReturnType<typeof createChangePasswordHandler> | undefined;
let cachedUpdateProfileHandler: ReturnType<typeof createUpdateProfileHandler> | undefined;

/**
 * Ready-to-use handler for POST /auth/register, pre-wired with the
 * Supabase/Drizzle infrastructure adapters. This is the only thing a
 * consuming app (e.g. apps/dashboard) needs to call.
 *
 * Infrastructure (and therefore environment variables) is only instantiated
 * on first invocation, never at module import time — so importing this
 * module for its types, or for RegisterUserUseCase with fakes in tests,
 * never requires real environment configuration.
 */
export function registerUserHandler(rawBody: unknown): Promise<HandlerResponse> {
  if (!cachedRegisterHandler) {
    cachedRegisterHandler = createRegisterUserHandler(
      new RegisterUserUseCase(
        new DrizzleUserRepository(),
        new SupabaseAuthProvider(),
        new DrizzleOrganizationLookup(),
      ),
    );
  }
  return cachedRegisterHandler(rawBody);
}

/**
 * Ready-to-use handler for POST /auth/login, pre-wired with the Supabase
 * infrastructure adapter. Same lazy-instantiation guarantee as
 * registerUserHandler above — no environment variables are required just to
 * import this module.
 */
export function loginHandler(rawBody: unknown): Promise<HandlerResponse> {
  if (!cachedLoginHandler) {
    cachedLoginHandler = createLoginHandler(new LoginUserUseCase(new SupabaseAuthProvider()));
  }
  return cachedLoginHandler(rawBody);
}

/**
 * Ready-to-use handler for GET /auth/me, pre-wired with the Supabase/
 * Drizzle infrastructure adapters. Same lazy-instantiation guarantee as the
 * other handlers above.
 */
export function meHandler(
  authorizationHeader: string | null | undefined,
): Promise<HandlerResponse> {
  if (!cachedMeHandler) {
    const supabaseAuthProvider = new SupabaseAuthProvider();
    cachedMeHandler = createMeHandler(
      new ResolveCurrentUserUseCase(supabaseAuthProvider, new DrizzleUserRepository()),
    );
  }
  return cachedMeHandler(authorizationHeader);
}

/**
 * Ready-to-use handler for POST /auth/refresh, pre-wired with the Supabase
 * infrastructure adapter. Same lazy-instantiation guarantee as the other
 * handlers above.
 */
export function refreshSessionHandler(rawBody: unknown): Promise<HandlerResponse> {
  if (!cachedRefreshHandler) {
    cachedRefreshHandler = createRefreshSessionHandler(
      new RefreshSessionUseCase(new SupabaseAuthProvider()),
    );
  }
  return cachedRefreshHandler(rawBody);
}

/**
 * Ready-to-use handler for POST /auth/logout, pre-wired with the Supabase
 * infrastructure adapter. Same lazy-instantiation guarantee as the other
 * handlers above.
 */
export function logoutHandler(
  authorizationHeader: string | null | undefined,
): Promise<HandlerResponse> {
  if (!cachedLogoutHandler) {
    cachedLogoutHandler = createLogoutHandler(new LogoutUseCase(new SupabaseAuthProvider()));
  }
  return cachedLogoutHandler(authorizationHeader);
}

/**
 * Ready-to-use handler for POST /auth/forgot-password, pre-wired with the
 * Supabase infrastructure adapter. Same lazy-instantiation guarantee as the
 * other handlers above.
 */
export function forgotPasswordHandler(rawBody: unknown): Promise<HandlerResponse> {
  if (!cachedForgotPasswordHandler) {
    cachedForgotPasswordHandler = createForgotPasswordHandler(
      new InitiatePasswordRecoveryUseCase(new SupabaseAuthProvider()),
    );
  }
  return cachedForgotPasswordHandler(rawBody);
}

/**
 * Ready-to-use handler for POST /auth/reset-password, pre-wired with the
 * Supabase infrastructure adapter. Same lazy-instantiation guarantee as the
 * other handlers above.
 */
export function resetPasswordHandler(rawBody: unknown): Promise<HandlerResponse> {
  if (!cachedResetPasswordHandler) {
    cachedResetPasswordHandler = createResetPasswordHandler(
      new ResetPasswordUseCase(new SupabaseAuthProvider()),
    );
  }
  return cachedResetPasswordHandler(rawBody);
}

/**
 * Ready-to-use handler for POST /auth/change-password, pre-wired with the
 * Supabase/Drizzle infrastructure adapters. Same lazy-instantiation
 * guarantee as the other handlers above.
 */
export function changePasswordHandler(
  authorizationHeader: string | null | undefined,
  rawBody: unknown,
): Promise<HandlerResponse> {
  if (!cachedChangePasswordHandler) {
    const supabaseAuthProvider = new SupabaseAuthProvider();
    cachedChangePasswordHandler = createChangePasswordHandler(
      new ChangePasswordUseCase(
        supabaseAuthProvider,
        new DrizzleUserRepository(),
        supabaseAuthProvider,
        supabaseAuthProvider,
      ),
    );
  }
  return cachedChangePasswordHandler(authorizationHeader, rawBody);
}

/**
 * Ready-to-use handler for POST /auth/profile, pre-wired with the Supabase/
 * Drizzle infrastructure adapters. Same lazy-instantiation guarantee as the
 * other handlers above.
 */
export function updateProfileHandler(
  authorizationHeader: string | null | undefined,
  rawBody: unknown,
): Promise<HandlerResponse> {
  if (!cachedUpdateProfileHandler) {
    cachedUpdateProfileHandler = createUpdateProfileHandler(
      new UpdateUserProfileUseCase(new SupabaseAuthProvider(), new DrizzleUserRepository()),
    );
  }
  return cachedUpdateProfileHandler(authorizationHeader, rawBody);
}

// --- STORY-002-007 — Internal User / Team Management ---------------------
// All 8 handlers below share the same OWNER-only AuthorizationPolicy
// (seeded once per module instance) and the same
// DrizzleOrganizationMembershipRepository, mirroring the lazy-instantiation
// guarantee established above: infrastructure (and therefore environment
// variables) is only constructed on first invocation of any of these
// functions, never at module import time.

let cachedInviteUserHandler: ReturnType<typeof createInviteUserHandler> | undefined;
let cachedGetUserHandler: ReturnType<typeof createGetUserHandler> | undefined;
let cachedListUsersHandler: ReturnType<typeof createListUsersHandler> | undefined;
let cachedUpdateUserHandler: ReturnType<typeof createUpdateUserHandler> | undefined;
let cachedRemoveUserHandler: ReturnType<typeof createRemoveUserHandler> | undefined;
let cachedSuspendUserHandler: ReturnType<typeof createSuspendUserHandler> | undefined;
let cachedActivateUserHandler: ReturnType<typeof createActivateUserHandler> | undefined;
let cachedAssignUserRoleHandler: ReturnType<typeof createAssignUserRoleHandler> | undefined;

/**
 * Ready-to-use handler for POST /api/v1/management/users/invitations.
 */
export function inviteUserHandler(
  authorizationHeader: string | null | undefined,
  query: unknown,
  rawBody: unknown,
): Promise<HandlerResponse> {
  if (!cachedInviteUserHandler) {
    cachedInviteUserHandler = createInviteUserHandler(
      new InviteUserUseCase(
        new SupabaseAuthProvider(),
        new DrizzleOrganizationMembershipRepository(),
        createTeamManagementAuthorizationPolicy(),
        new DrizzleInvitationRepository(),
        new NoOpInvitationDeliveryProvider(),
      ),
    );
  }
  return cachedInviteUserHandler(authorizationHeader, query, rawBody);
}

/**
 * Ready-to-use handler for GET /api/v1/management/users/{userId}.
 */
export function getUserHandler(
  authorizationHeader: string | null | undefined,
  query: unknown,
  targetUserId: string,
): Promise<HandlerResponse> {
  if (!cachedGetUserHandler) {
    cachedGetUserHandler = createGetUserHandler(
      new GetUserUseCase(
        new SupabaseAuthProvider(),
        new DrizzleOrganizationMembershipRepository(),
        createTeamManagementAuthorizationPolicy(),
      ),
    );
  }
  return cachedGetUserHandler(authorizationHeader, query, targetUserId);
}

/**
 * Ready-to-use handler for GET /api/v1/management/users.
 */
export function listUsersHandler(
  authorizationHeader: string | null | undefined,
  query: unknown,
): Promise<HandlerResponse> {
  if (!cachedListUsersHandler) {
    cachedListUsersHandler = createListUsersHandler(
      new ListUsersUseCase(
        new SupabaseAuthProvider(),
        new DrizzleOrganizationMembershipRepository(),
        createTeamManagementAuthorizationPolicy(),
      ),
    );
  }
  return cachedListUsersHandler(authorizationHeader, query);
}

/**
 * Ready-to-use handler for PATCH /api/v1/management/users/{userId}.
 */
export function updateUserHandler(
  authorizationHeader: string | null | undefined,
  query: unknown,
  targetUserId: string,
  rawBody: unknown,
): Promise<HandlerResponse> {
  if (!cachedUpdateUserHandler) {
    cachedUpdateUserHandler = createUpdateUserHandler(
      new UpdateUserUseCase(
        new SupabaseAuthProvider(),
        new DrizzleOrganizationMembershipRepository(),
        createTeamManagementAuthorizationPolicy(),
        new DrizzleUserRepository(),
      ),
    );
  }
  return cachedUpdateUserHandler(authorizationHeader, query, targetUserId, rawBody);
}

/**
 * Ready-to-use handler for DELETE /api/v1/management/users/{userId}.
 */
export function removeUserHandler(
  authorizationHeader: string | null | undefined,
  query: unknown,
  targetUserId: string,
): Promise<HandlerResponse> {
  if (!cachedRemoveUserHandler) {
    cachedRemoveUserHandler = createRemoveUserHandler(
      new RemoveUserUseCase(
        new SupabaseAuthProvider(),
        new DrizzleOrganizationMembershipRepository(),
        createTeamManagementAuthorizationPolicy(),
      ),
    );
  }
  return cachedRemoveUserHandler(authorizationHeader, query, targetUserId);
}

/**
 * Ready-to-use handler for POST /api/v1/management/users/{userId}/suspend.
 */
export function suspendUserHandler(
  authorizationHeader: string | null | undefined,
  query: unknown,
  targetUserId: string,
): Promise<HandlerResponse> {
  if (!cachedSuspendUserHandler) {
    cachedSuspendUserHandler = createSuspendUserHandler(
      new SuspendUserUseCase(
        new SupabaseAuthProvider(),
        new DrizzleOrganizationMembershipRepository(),
        createTeamManagementAuthorizationPolicy(),
      ),
    );
  }
  return cachedSuspendUserHandler(authorizationHeader, query, targetUserId);
}

/**
 * Ready-to-use handler for POST /api/v1/management/users/{userId}/activate.
 */
export function activateUserHandler(
  authorizationHeader: string | null | undefined,
  query: unknown,
  targetUserId: string,
): Promise<HandlerResponse> {
  if (!cachedActivateUserHandler) {
    cachedActivateUserHandler = createActivateUserHandler(
      new ActivateUserUseCase(
        new SupabaseAuthProvider(),
        new DrizzleOrganizationMembershipRepository(),
        createTeamManagementAuthorizationPolicy(),
      ),
    );
  }
  return cachedActivateUserHandler(authorizationHeader, query, targetUserId);
}

let cachedVerifyActiveMembership: VerifyActiveMembershipService | undefined;

/**
 * Ready-to-use, pre-wired `VerifyActiveMembershipService` (STORY-003-002,
 * EPIC_003_ORGANIZATIONS.md) — one of the two new additions to Identity's
 * public surface required by this Story. Returns only the membership fact
 * (never the caller's role). Same lazy-instantiation guarantee as every
 * other handler above.
 */
export function verifyActiveMembership(
  params: VerifyActiveMembershipParams,
): Promise<Result<void, VerifyActiveMembershipError>> {
  if (!cachedVerifyActiveMembership) {
    cachedVerifyActiveMembership = createVerifyActiveMembershipService(
      new DrizzleOrganizationMembershipRepository(),
    );
  }
  return cachedVerifyActiveMembership(params);
}

let cachedVerifyOwnerMembership: VerifyOwnerMembershipService | undefined;

/**
 * Ready-to-use, pre-wired `VerifyOwnerMembershipService` (STORY-003-003,
 * EPIC_003_ORGANIZATIONS.md) — new addition to Identity's public surface
 * required by this Story. Returns only success/failure (never the
 * membership entity, actual role, or RBAC internals). Same
 * lazy-instantiation guarantee as every other handler above.
 */
export function verifyOwnerMembership(
  params: VerifyOwnerMembershipParams,
): Promise<Result<void, VerifyOwnerMembershipError>> {
  if (!cachedVerifyOwnerMembership) {
    cachedVerifyOwnerMembership = createVerifyOwnerMembershipService(
      new DrizzleOrganizationMembershipRepository(),
    );
  }
  return cachedVerifyOwnerMembership(params);
}

let cachedListActiveOrganizationIds: ListActiveOrganizationIdsService | undefined;

/**
 * Ready-to-use, pre-wired `ListActiveOrganizationIdsService`
 * (STORY-003-002, EPIC_003_ORGANIZATIONS.md) — the second new addition to
 * Identity's public surface required by this Story. Returns bare
 * organization id strings, already filtered to ACTIVE status. Same
 * lazy-instantiation guarantee as every other handler above.
 */
export function listActiveOrganizationIds(
  params: ListActiveOrganizationIdsParams,
): Promise<Result<ListActiveOrganizationIdsResult, ListActiveOrganizationIdsError>> {
  if (!cachedListActiveOrganizationIds) {
    cachedListActiveOrganizationIds = createListActiveOrganizationIdsService(
      new DrizzleUserRepository(),
    );
  }
  return cachedListActiveOrganizationIds(params);
}

let cachedCreateInitialOwnerMembership: CreateInitialOwnerMembershipService | undefined;

/**
 * Ready-to-use, pre-wired `CreateInitialOwnerMembershipService`
 * (STORY-003-001, EPIC_003_ORGANIZATIONS.md) — the only new addition to
 * Identity's public surface required by EPIC-003. Consumed by the
 * Organizations module's `CreateOrganizationUseCase`, which opens the
 * transaction and supplies `tx` so Organization creation and the creator's
 * OWNER membership creation commit atomically (ADR-011: Organizations never
 * imports `OrganizationMembershipRepository` or touches
 * `organization_memberships` directly). Same lazy-instantiation guarantee as
 * every other handler above.
 */
export function createInitialOwnerMembership(
  params: CreateInitialOwnerMembershipParams,
  tx: Transaction,
): Promise<Result<CreateInitialOwnerMembershipResult, CreateInitialOwnerMembershipError>> {
  if (!cachedCreateInitialOwnerMembership) {
    cachedCreateInitialOwnerMembership = createCreateInitialOwnerMembershipService(
      new DrizzleOrganizationMembershipRepository(),
    );
  }
  return cachedCreateInitialOwnerMembership(params, tx);
}

/**
 * Ready-to-use handler for POST /api/v1/management/users/{userId}/role.
 */
export function assignUserRoleHandler(
  authorizationHeader: string | null | undefined,
  query: unknown,
  targetUserId: string,
  rawBody: unknown,
): Promise<HandlerResponse> {
  if (!cachedAssignUserRoleHandler) {
    cachedAssignUserRoleHandler = createAssignUserRoleHandler(
      new AssignUserRoleUseCase(
        new SupabaseAuthProvider(),
        new DrizzleOrganizationMembershipRepository(),
        createTeamManagementAuthorizationPolicy(),
      ),
    );
  }
  return cachedAssignUserRoleHandler(authorizationHeader, query, targetUserId, rawBody);
}
