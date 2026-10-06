import type { Transaction } from "@allinvites/database";
import type { Organization, OrganizationStatus } from "../entities/organization";

/**
 * STORY-003-004 — Activate / Suspend Organization. A separate port (Interface
 * Segregation) so the status-change capability does not widen
 * OrganizationRepository, which every other use case already depends on.
 * Implemented by DrizzleOrganizationRepository.
 */
export interface OrganizationStatusRepository {
  findById(id: string): Promise<Organization | null>;

  /** The SYSTEM organization (MASTER_SPEC §17), or null if it has not been seeded. */
  findSystemOrganization(): Promise<Organization | null>;

  /**
   * Platform-wide listing for platform-privileged callers only. Bounded,
   * database-level pagination over every Organization, ordered `created_at
   * ASC`, including SUSPENDED ones.
   */
  findPage(pagination: {
    page: number;
    pageSize: number;
  }): Promise<{ items: Organization[]; total: number }>;

  /**
   * Conditional single-row update: sets `organization_status` to `to` only
   * if the row is currently `from`. Returns null when no row matched, which
   * means another request changed the status after it was read. Runs within
   * the caller's transaction so the change commits atomically with its audit
   * record.
   */
  updateStatus(
    id: string,
    from: OrganizationStatus,
    to: OrganizationStatus,
    tx: Transaction,
  ): Promise<Organization | null>;
}
