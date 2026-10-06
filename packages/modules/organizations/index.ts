// Public surface of the organizations module. Internal folders (domain,
// infrastructure, presentation/validators, mappers) remain private — see
// Architecture.md "Module Communication".

import {
  createInitialOwnerMembership,
  listActiveOrganizationIds,
  verifyActiveMembership,
  verifyOwnerMembership,
} from "@allinvites/module-identity";
import { CreateOrganizationUseCase } from "./application/use-cases/create-organization.use-case";
import { ListOrganizationsUseCase } from "./application/use-cases/list-organizations.use-case";
import { RetrieveOrganizationUseCase } from "./application/use-cases/retrieve-organization.use-case";
import { RetrieveOrganizationBrandingUseCase } from "./application/use-cases/retrieve-organization-branding.use-case";
import { RetrieveOrganizationSettingsUseCase } from "./application/use-cases/retrieve-organization-settings.use-case";
import { UpdateOrganizationUseCase } from "./application/use-cases/update-organization.use-case";
import { UpdateOrganizationBrandingUseCase } from "./application/use-cases/update-organization-branding.use-case";
import { UpdateOrganizationSettingsUseCase } from "./application/use-cases/update-organization-settings.use-case";
import { SupabaseSessionVerifier } from "./infrastructure/providers/supabase-session-verifier";
import { DrizzleOrganizationRepository } from "./infrastructure/repositories/drizzle-organization-repository";
import {
  createCreateOrganizationHandler,
  type HandlerResponse,
} from "./presentation/handlers/create-organization.handler";
import { createListOrganizationsHandler } from "./presentation/handlers/list-organizations.handler";
import { createRetrieveOrganizationHandler } from "./presentation/handlers/retrieve-organization.handler";
import { createRetrieveOrganizationBrandingHandler } from "./presentation/handlers/retrieve-organization-branding.handler";
import { createRetrieveOrganizationSettingsHandler } from "./presentation/handlers/retrieve-organization-settings.handler";
import { createUpdateOrganizationHandler } from "./presentation/handlers/update-organization.handler";
import { createUpdateOrganizationBrandingHandler } from "./presentation/handlers/update-organization-branding.handler";
import { createUpdateOrganizationSettingsHandler } from "./presentation/handlers/update-organization-settings.handler";

export type { CreateOrganizationCommand } from "./application/commands/create-organization.command";
export type { ListOrganizationsCommand } from "./application/commands/list-organizations.command";
export type { UpdateOrganizationCommand } from "./application/commands/update-organization.command";
export type { UpdateOrganizationBrandingCommand } from "./application/commands/update-organization-branding.command";
export type { UpdateOrganizationSettingsCommand } from "./application/commands/update-organization-settings.command";
export type {
  SessionVerifier,
  SessionVerifierError,
  VerifiedCaller,
} from "./application/ports/session-verifier";
export type {
  CreateOrganizationError,
  CreateOrganizationResult,
} from "./application/use-cases/create-organization.use-case";
export { CreateOrganizationUseCase } from "./application/use-cases/create-organization.use-case";
export type {
  ListOrganizationsError,
  ListOrganizationsResult,
} from "./application/use-cases/list-organizations.use-case";
export { ListOrganizationsUseCase } from "./application/use-cases/list-organizations.use-case";
export type {
  RetrieveOrganizationError,
  RetrieveOrganizationResult,
} from "./application/use-cases/retrieve-organization.use-case";
export { RetrieveOrganizationUseCase } from "./application/use-cases/retrieve-organization.use-case";
export type {
  RetrieveOrganizationBrandingError,
  RetrieveOrganizationBrandingResult,
} from "./application/use-cases/retrieve-organization-branding.use-case";
export { RetrieveOrganizationBrandingUseCase } from "./application/use-cases/retrieve-organization-branding.use-case";
export type {
  RetrieveOrganizationSettingsError,
  RetrieveOrganizationSettingsResult,
} from "./application/use-cases/retrieve-organization-settings.use-case";
export { RetrieveOrganizationSettingsUseCase } from "./application/use-cases/retrieve-organization-settings.use-case";
export type {
  UpdateOrganizationError,
  UpdateOrganizationResult,
} from "./application/use-cases/update-organization.use-case";
export { UpdateOrganizationUseCase } from "./application/use-cases/update-organization.use-case";
export type {
  UpdateOrganizationBrandingError,
  UpdateOrganizationBrandingResult,
} from "./application/use-cases/update-organization-branding.use-case";
export { UpdateOrganizationBrandingUseCase } from "./application/use-cases/update-organization-branding.use-case";
export type {
  UpdateOrganizationSettingsError,
  UpdateOrganizationSettingsResult,
} from "./application/use-cases/update-organization-settings.use-case";
export { UpdateOrganizationSettingsUseCase } from "./application/use-cases/update-organization-settings.use-case";
export type {
  CreatedOrganizationDto,
  CreateOrganizationRequestDto,
} from "./contracts/create-organization.dto";
export type { OrganizationDto, PaginationDto } from "./contracts/organization.dto";
export type { OrganizationBrandingDto } from "./contracts/organization-branding.dto";
export type { OrganizationSettingsDto } from "./contracts/organization-settings.dto";
export type { Organization } from "./domain/entities/organization";
export { InvalidSlugError } from "./domain/exceptions/invalid-slug.error";
export { OrganizationSlugAlreadyExistsError } from "./domain/exceptions/organization-slug-already-exists.error";
export type { OrganizationRepository } from "./domain/repositories/organization-repository";
export type { OrganizationType } from "./domain/value-objects/organization-type";
export {
  createCreateOrganizationHandler,
  type HandlerResponse,
} from "./presentation/handlers/create-organization.handler";
export { createListOrganizationsHandler } from "./presentation/handlers/list-organizations.handler";
export { createRetrieveOrganizationHandler } from "./presentation/handlers/retrieve-organization.handler";
export { createRetrieveOrganizationBrandingHandler } from "./presentation/handlers/retrieve-organization-branding.handler";
export { createRetrieveOrganizationSettingsHandler } from "./presentation/handlers/retrieve-organization-settings.handler";
export { createUpdateOrganizationHandler } from "./presentation/handlers/update-organization.handler";
export { createUpdateOrganizationBrandingHandler } from "./presentation/handlers/update-organization-branding.handler";
export { createUpdateOrganizationSettingsHandler } from "./presentation/handlers/update-organization-settings.handler";

let cachedCreateOrganizationHandler: ReturnType<typeof createCreateOrganizationHandler> | undefined;

/**
 * Ready-to-use handler for POST /api/v1/management/organizations
 * (STORY-003-001), pre-wired with the Drizzle/Supabase infrastructure
 * adapters and Identity's public CreateInitialOwnerMembershipService
 * (ADR-011). This is the only thing a consuming app (e.g. apps/dashboard)
 * needs to call.
 *
 * Infrastructure (and therefore environment variables) is only instantiated
 * on first invocation, never at module import time — matching the same
 * lazy-instantiation guarantee established by @allinvites/module-identity.
 */
export function createOrganizationHandler(
  authorizationHeader: string | null | undefined,
  rawBody: unknown,
): Promise<HandlerResponse> {
  if (!cachedCreateOrganizationHandler) {
    cachedCreateOrganizationHandler = createCreateOrganizationHandler(
      new CreateOrganizationUseCase(
        new DrizzleOrganizationRepository(),
        createInitialOwnerMembership,
        new SupabaseSessionVerifier(),
      ),
    );
  }
  return cachedCreateOrganizationHandler(authorizationHeader, rawBody);
}

let cachedRetrieveOrganizationHandler:
  | ReturnType<typeof createRetrieveOrganizationHandler>
  | undefined;

/**
 * Ready-to-use handler for GET /api/v1/management/organizations/:organizationId
 * (STORY-003-002), pre-wired with the Drizzle/Supabase infrastructure
 * adapters and Identity's public VerifyActiveMembershipService (ADR-011).
 * Same lazy-instantiation guarantee as createOrganizationHandler above.
 */
export function retrieveOrganizationHandler(
  authorizationHeader: string | null | undefined,
  params: unknown,
): Promise<HandlerResponse> {
  if (!cachedRetrieveOrganizationHandler) {
    cachedRetrieveOrganizationHandler = createRetrieveOrganizationHandler(
      new RetrieveOrganizationUseCase(
        new DrizzleOrganizationRepository(),
        verifyActiveMembership,
        new SupabaseSessionVerifier(),
      ),
    );
  }
  return cachedRetrieveOrganizationHandler(authorizationHeader, params);
}

let cachedUpdateOrganizationHandler: ReturnType<typeof createUpdateOrganizationHandler> | undefined;

/**
 * Ready-to-use handler for PATCH /api/v1/management/organizations/:organizationId
 * (STORY-003-003), pre-wired with the Drizzle/Supabase infrastructure
 * adapters and Identity's public VerifyOwnerMembershipService (ADR-011).
 * Same lazy-instantiation guarantee as createOrganizationHandler above.
 */
export function updateOrganizationHandler(
  authorizationHeader: string | null | undefined,
  params: unknown,
  rawBody: unknown,
): Promise<HandlerResponse> {
  if (!cachedUpdateOrganizationHandler) {
    cachedUpdateOrganizationHandler = createUpdateOrganizationHandler(
      new UpdateOrganizationUseCase(
        new DrizzleOrganizationRepository(),
        verifyOwnerMembership,
        new SupabaseSessionVerifier(),
      ),
    );
  }
  return cachedUpdateOrganizationHandler(authorizationHeader, params, rawBody);
}

let cachedRetrieveOrganizationBrandingHandler:
  | ReturnType<typeof createRetrieveOrganizationBrandingHandler>
  | undefined;

/**
 * Ready-to-use handler for
 * GET /api/v1/management/organizations/:organizationId/branding
 * (STORY-003-005), pre-wired with the Drizzle/Supabase infrastructure
 * adapters and Identity's public VerifyOwnerMembershipService (ADR-011).
 * Same lazy-instantiation guarantee as createOrganizationHandler above.
 */
export function retrieveOrganizationBrandingHandler(
  authorizationHeader: string | null | undefined,
  params: unknown,
): Promise<HandlerResponse> {
  if (!cachedRetrieveOrganizationBrandingHandler) {
    cachedRetrieveOrganizationBrandingHandler = createRetrieveOrganizationBrandingHandler(
      new RetrieveOrganizationBrandingUseCase(
        new DrizzleOrganizationRepository(),
        verifyOwnerMembership,
        new SupabaseSessionVerifier(),
      ),
    );
  }
  return cachedRetrieveOrganizationBrandingHandler(authorizationHeader, params);
}

let cachedUpdateOrganizationBrandingHandler:
  | ReturnType<typeof createUpdateOrganizationBrandingHandler>
  | undefined;

/**
 * Ready-to-use handler for
 * PATCH /api/v1/management/organizations/:organizationId/branding
 * (STORY-003-005), pre-wired with the Drizzle/Supabase infrastructure
 * adapters and Identity's public VerifyOwnerMembershipService (ADR-011).
 * Same lazy-instantiation guarantee as createOrganizationHandler above.
 */
export function updateOrganizationBrandingHandler(
  authorizationHeader: string | null | undefined,
  params: unknown,
  rawBody: unknown,
): Promise<HandlerResponse> {
  if (!cachedUpdateOrganizationBrandingHandler) {
    cachedUpdateOrganizationBrandingHandler = createUpdateOrganizationBrandingHandler(
      new UpdateOrganizationBrandingUseCase(
        new DrizzleOrganizationRepository(),
        verifyOwnerMembership,
        new SupabaseSessionVerifier(),
      ),
    );
  }
  return cachedUpdateOrganizationBrandingHandler(authorizationHeader, params, rawBody);
}

let cachedRetrieveOrganizationSettingsHandler:
  | ReturnType<typeof createRetrieveOrganizationSettingsHandler>
  | undefined;

/**
 * Ready-to-use handler for
 * GET /api/v1/management/organizations/:organizationId/settings
 * (STORY-003-006), pre-wired with the Drizzle/Supabase infrastructure
 * adapters and Identity's public VerifyOwnerMembershipService (ADR-011).
 * Same lazy-instantiation guarantee as createOrganizationHandler above.
 */
export function retrieveOrganizationSettingsHandler(
  authorizationHeader: string | null | undefined,
  params: unknown,
): Promise<HandlerResponse> {
  if (!cachedRetrieveOrganizationSettingsHandler) {
    cachedRetrieveOrganizationSettingsHandler = createRetrieveOrganizationSettingsHandler(
      new RetrieveOrganizationSettingsUseCase(
        new DrizzleOrganizationRepository(),
        verifyOwnerMembership,
        new SupabaseSessionVerifier(),
      ),
    );
  }
  return cachedRetrieveOrganizationSettingsHandler(authorizationHeader, params);
}

let cachedUpdateOrganizationSettingsHandler:
  | ReturnType<typeof createUpdateOrganizationSettingsHandler>
  | undefined;

/**
 * Ready-to-use handler for
 * PATCH /api/v1/management/organizations/:organizationId/settings
 * (STORY-003-006), pre-wired with the Drizzle/Supabase infrastructure
 * adapters and Identity's public VerifyOwnerMembershipService (ADR-011).
 * Same lazy-instantiation guarantee as createOrganizationHandler above.
 */
export function updateOrganizationSettingsHandler(
  authorizationHeader: string | null | undefined,
  params: unknown,
  rawBody: unknown,
): Promise<HandlerResponse> {
  if (!cachedUpdateOrganizationSettingsHandler) {
    cachedUpdateOrganizationSettingsHandler = createUpdateOrganizationSettingsHandler(
      new UpdateOrganizationSettingsUseCase(
        new DrizzleOrganizationRepository(),
        verifyOwnerMembership,
        new SupabaseSessionVerifier(),
      ),
    );
  }
  return cachedUpdateOrganizationSettingsHandler(authorizationHeader, params, rawBody);
}

let cachedListOrganizationsHandler: ReturnType<typeof createListOrganizationsHandler> | undefined;

/**
 * Ready-to-use handler for GET /api/v1/management/organizations
 * (STORY-003-002), pre-wired with the Drizzle/Supabase infrastructure
 * adapters and Identity's public ListActiveOrganizationIdsService
 * (ADR-011). Same lazy-instantiation guarantee as createOrganizationHandler
 * above.
 */
export function listOrganizationsHandler(
  authorizationHeader: string | null | undefined,
  query: unknown,
): Promise<HandlerResponse> {
  if (!cachedListOrganizationsHandler) {
    cachedListOrganizationsHandler = createListOrganizationsHandler(
      new ListOrganizationsUseCase(
        new DrizzleOrganizationRepository(),
        listActiveOrganizationIds,
        new SupabaseSessionVerifier(),
      ),
    );
  }
  return cachedListOrganizationsHandler(authorizationHeader, query);
}
