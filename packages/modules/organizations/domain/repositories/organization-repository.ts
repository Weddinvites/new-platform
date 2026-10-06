import type { Transaction } from "@allinvites/database";
import type { Organization } from "../entities/organization";

/**
 * Repository interface (domain-owned port) for the Organization aggregate.
 * Implemented by DrizzleOrganizationRepository in the Infrastructure layer.
 */
export interface OrganizationRepository {
  /**
   * STORY-003-001 — inserts within the transaction opened by
   * CreateOrganizationUseCase, so it commits atomically together with the
   * creator's OWNER membership (created via Identity's
   * CreateInitialOwnerMembershipService in the same transaction). Relies on
   * the database's unique constraint on `slug` as the sole uniqueness
   * enforcement mechanism (no redundant pre-check `SELECT`).
   */
  create(organization: Organization, tx: Transaction): Promise<void>;

  findById(id: string): Promise<Organization | null>;

  /**
   * STORY-003-002 — List Organizations. Bounded, database-level pagination
   * over an already ACTIVE-membership-scoped id set (never the full
   * `organizations` table). Ordered `created_at ASC` (fixed, deterministic,
   * not client-configurable). `total` reflects the count of `ids` matched,
   * not a platform-wide count.
   */
  findByIds(
    ids: string[],
    pagination: { page: number; pageSize: number },
  ): Promise<{ items: Organization[]; total: number }>;

  /**
   * STORY-003-003 — Update Organization. A single-row update by id,
   * changing only `display_name`. Called only after the use case has
   * already confirmed the organization exists (via `findById`), so the
   * updated row is always expected to be found.
   */
  update(id: string, changes: { displayName: string }): Promise<Organization>;

  /**
   * STORY-003-005 — Update Organization Branding. A single-row, partial
   * update by id: only the keys present in `changes` are modified. Called
   * only after the use case has already confirmed the organization exists
   * (via `findById`), so the updated row is always expected to be found.
   */
  updateBranding(
    id: string,
    changes: Partial<{
      brandName: string;
      logo: string;
      primaryColor: string;
      secondaryColor: string;
    }>,
  ): Promise<Organization>;

  /**
   * STORY-003-006 — Update Organization Settings. A single-row update by
   * id, changing only `support_contact_email` (the sole approved Settings
   * field — required, not clearable). Called only after the use case has
   * already confirmed the organization exists (via `findById`), so the
   * updated row is always expected to be found.
   */
  updateSettings(id: string, changes: { supportContactEmail: string }): Promise<Organization>;
}
