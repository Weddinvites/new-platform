/**
 * Organization Membership lifecycle status (STORY-002-007). A single status
 * axis — ACTIVE/SUSPENDED/REMOVED — resolves the API_SPEC "Deactivate User"
 * vs. USER_FLOWS/MASTER_SPEC "Suspend User" naming inconsistency identified
 * during the STORY-002-007 contract audit: they are the same lifecycle
 * transition, and "Suspend"/"Activate" is the terminology used in code.
 * REMOVED is a distinct, non-reversible-via-Activate state so "historical
 * records remain unchanged" (API_SPEC.md §23 "Remove User") without a
 * physical row delete.
 */
export const MEMBERSHIP_STATUSES = ["ACTIVE", "SUSPENDED", "REMOVED"] as const;

export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export function isMembershipStatus(value: string): value is MembershipStatus {
  return (MEMBERSHIP_STATUSES as readonly string[]).includes(value);
}
