import type { OrganizationMembership } from "../entities/organization-membership";
import type { User } from "../entities/user";
import type { Email } from "../value-objects/email";
import type { FullName } from "../value-objects/full-name";

/**
 * Repository interface (domain-owned port). Returns Domain objects only —
 * never ORM-specific concepts (DEVELOPMENT_RULES.md §9). Implemented by
 * DrizzleUserRepository in the Infrastructure layer.
 */
export interface UserRepository {
  findByEmail(email: Email): Promise<User | null>;

  /**
   * Resolves a User by id (STORY-002-003 — Session Management, `GET
   * /auth/me`). `id` is the Supabase Auth user id, same as User.id.
   */
  findById(id: string): Promise<User | null>;

  /**
   * All Organization Memberships held by a User (STORY-002-003 — `GET
   * /auth/me`), reflecting the approved multi-organization membership model
   * (MASTER_SPEC §18; ADR-001).
   */
  findMembershipsByUserId(userId: string): Promise<OrganizationMembership[]>;

  /**
   * Persists a newly registered User together with their initial
   * Organization Membership as a single atomic operation, so the system
   * never observes a User without at least one membership
   * (MASTER_SPEC §18 BR-002).
   */
  save(user: User, initialMembership: OrganizationMembership): Promise<void>;

  /**
   * Updates a User's `full_name` (STORY-002-005 — User Profile, MVP).
   * Returns the updated User. Deliberately narrow — not a generic
   * multi-field "update profile" operation, since no other field is in
   * scope for this Story.
   */
  updateFullName(userId: string, fullName: FullName): Promise<User>;
}
