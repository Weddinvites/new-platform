import { err, ok, type Result } from "@allinvites/kernel";
import { OrganizationMembership } from "../../domain/entities/organization-membership";
import { User } from "../../domain/entities/user";
import {
  type UserRegisteredEvent,
  userRegisteredEvent,
} from "../../domain/events/user-registered.event";
import { AccountAlreadyExistsError } from "../../domain/exceptions/account-already-exists.error";
import { InvalidEmailError } from "../../domain/exceptions/invalid-email.error";
import { InvalidFullNameError } from "../../domain/exceptions/invalid-full-name.error";
import { InvalidInvitationTokenError } from "../../domain/exceptions/invalid-invitation-token.error";
import { InvalidPasswordError } from "../../domain/exceptions/invalid-password.error";
import type { UserRepository } from "../../domain/repositories/user-repository";
import { SYSTEM_ORGANIZATION_SLUG } from "../../domain/system-organization";
import { Email } from "../../domain/value-objects/email";
import { FullName } from "../../domain/value-objects/full-name";
import { Password } from "../../domain/value-objects/password";
import type { RegisterUserCommand } from "../commands/register-user.command";
import type { AuthProvider, AuthSession } from "../ports/auth-provider";
import type { OrganizationLookupPort } from "../ports/organization-lookup.port";

export type RegisterUserError =
  | InvalidEmailError
  | InvalidPasswordError
  | InvalidFullNameError
  | AccountAlreadyExistsError
  | InvalidInvitationTokenError
  | { readonly type: "SYSTEM_ORGANIZATION_NOT_CONFIGURED" }
  | { readonly type: "UNEXPECTED"; readonly cause: unknown };

export type RegisterUserResult = {
  readonly user: User;
  readonly membership: OrganizationMembership;
  readonly event: UserRegisteredEvent;
  readonly session: AuthSession;
};

/**
 * STORY-002-001 — User Registration. Implements the contract resolved in
 * API_SPEC.md §21a "Registration Decisions":
 *  - auto-authentication is fulfilled by the AuthProvider, which returns a
 *    session alongside the created user;
 *  - default initial membership is CLIENT in the SYSTEM organization;
 *  - an invitation_token, if supplied, is always currently invalid (no
 *    invitation system exists yet — see InvalidInvitationTokenError);
 *  - registration always succeeds with `email_verified: false` (non-blocking
 *    verification for MVP).
 */
export class RegisterUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly authProvider: AuthProvider,
    private readonly organizationLookup: OrganizationLookupPort,
  ) {}

  async execute(
    command: RegisterUserCommand,
  ): Promise<Result<RegisterUserResult, RegisterUserError>> {
    if (command.invitationToken !== undefined) {
      return err(new InvalidInvitationTokenError());
    }

    const validated = this.validate(command);
    if (!validated.ok) {
      return validated;
    }
    const { email, password, fullName } = validated.value;

    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      return err(new AccountAlreadyExistsError());
    }

    const organizationId = await this.organizationLookup.findIdBySlug(SYSTEM_ORGANIZATION_SLUG);
    if (!organizationId) {
      return err({ type: "SYSTEM_ORGANIZATION_NOT_CONFIGURED" });
    }

    const createdAuthUser = await this.authProvider.createUser({
      email: email.value,
      password: password.value,
      fullName: fullName.value,
    });

    if (!createdAuthUser.ok) {
      if (createdAuthUser.error.type === "EMAIL_ALREADY_REGISTERED") {
        return err(new AccountAlreadyExistsError());
      }
      return err({ type: "UNEXPECTED", cause: createdAuthUser.error.cause });
    }

    const user = User.register({
      id: createdAuthUser.value.id,
      email,
      fullName,
    });

    const membership = OrganizationMembership.create({
      id: crypto.randomUUID(),
      userId: user.id,
      organizationId,
      role: "CLIENT",
    });

    await this.userRepository.save(user, membership);

    const event = userRegisteredEvent({
      userId: user.id,
      organizationId: membership.organizationId,
      role: membership.role,
    });

    return ok({ user, membership, event, session: createdAuthUser.value.session });
  }

  private validate(
    command: RegisterUserCommand,
  ): Result<{ email: Email; password: Password; fullName: FullName }, RegisterUserError> {
    try {
      const email = Email.create(command.email);
      const password = Password.create(command.password);
      const fullName = FullName.create(command.fullName);
      return ok({ email, password, fullName });
    } catch (error) {
      if (
        error instanceof InvalidEmailError ||
        error instanceof InvalidPasswordError ||
        error instanceof InvalidFullNameError
      ) {
        return err(error);
      }
      throw error;
    }
  }
}
