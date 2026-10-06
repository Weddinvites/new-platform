/**
 * Organization types per MASTER_SPEC §17 (database/schema.ts's persisted
 * enum). STORY-003-001 only ever creates PARTNER organizations — SYSTEM is
 * seeded platform-side, never created through this contract.
 */
export const ORGANIZATION_TYPES = ["SYSTEM", "PARTNER"] as const;

export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];
