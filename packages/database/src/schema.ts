import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Organization types per MASTER_SPEC §17. SYSTEM is the platform's own
 * internal organization that owns all B2C clients; PARTNER represents any
 * Wedding Planner / agency / hotel using AllInvites as a SaaS platform.
 */
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationType: text("organization_type", { enum: ["SYSTEM", "PARTNER"] }).notNull(),
  slug: text("slug").notNull().unique(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  /** STORY-003-005 — White Label / branding fields. Nullable; unset until explicitly configured. */
  brandName: text("brand_name"),
  logo: text("logo"),
  primaryColor: text("primary_color"),
  secondaryColor: text("secondary_color"),
  /** STORY-003-006 — Organization Settings. Nullable; unset until explicitly configured. */
  supportContactEmail: text("support_contact_email"),
  /**
   * STORY-003-004 — Activate / Suspend Organization. A SUSPENDED organization
   * is denied (ORGANIZATION_SUSPENDED) by every organization-scoped endpoint
   * except activation. Not null; existing rows default to ACTIVE.
   */
  organizationStatus: text("organization_status", { enum: ["ACTIVE", "SUSPENDED"] })
    .notNull()
    .default("ACTIVE"),
});

/**
 * Application-level user profile, keyed by the Supabase Auth user id
 * (auth.users.id). Credentials themselves live in Supabase Auth, never here
 * (MASTER_SPEC §30; EPIC_002_IDENTITY.md STORY-002-001 acceptance criteria).
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Organization Membership per MASTER_SPEC §26.2a: links a User to an
 * Organization with a single canonical Role. A User may hold more than one
 * membership (multi-organization membership, MASTER_SPEC §18; ADR-001).
 */
export const organizationMemberships = pgTable(
  "organization_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["OWNER", "ADMIN", "MEMBER", "CLIENT"] }).notNull(),
    /**
     * Membership lifecycle (STORY-002-007). REMOVED is a soft state, never a
     * row delete, so historical records remain intact (API_SPEC.md §23
     * "Remove User"). Resolves the "Deactivate" (API_SPEC summary lists) vs.
     * "Suspend" (USER_FLOWS/MASTER_SPEC) naming inconsistency in favor of a
     * single ACTIVE/SUSPENDED/REMOVED axis.
     */
    status: text("status", { enum: ["ACTIVE", "SUSPENDED", "REMOVED"] })
      .notNull()
      .default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("organization_memberships_user_org_idx").on(table.userId, table.organizationId),
  ],
);

/**
 * STORY-002-007 — Invite User. Only the invitation token's hash is ever
 * stored (never the raw token). Consumption (lookup by token, marking
 * ACCEPTED) is not implemented by this Story — see
 * `InvitationRepository`.
 */
export const userInvitations = pgTable(
  "user_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role", { enum: ["OWNER", "ADMIN", "MEMBER", "CLIENT"] }).notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    status: text("status", { enum: ["PENDING", "ACCEPTED", "EXPIRED", "REVOKED"] })
      .notNull()
      .default("PENDING"),
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  },
  (table) => [index("user_invitations_org_email_idx").on(table.organizationId, table.email)],
);

/**
 * STORY-003-004 — Administrative audit trail (ADR-007 "Audit Trail"). Written
 * only by the Audit module, only in INSERT form; UPDATE and DELETE are
 * rejected by a database trigger (supabase/migrations/20261006120100). No
 * foreign keys, so records outlive the entities they describe.
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    userId: uuid("user_id").notNull(),
    organizationId: uuid("organization_id").notNull(),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: uuid("resource_id").notNull(),
    result: text("result", { enum: ["SUCCESS", "FAILURE"] }).notNull(),
    metadata: jsonb("metadata"),
  },
  (table) => [
    index("audit_logs_organization_occurred_idx").on(table.organizationId, table.occurredAt),
  ],
);
