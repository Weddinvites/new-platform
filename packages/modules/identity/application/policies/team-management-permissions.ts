/**
 * STORY-002-007 — Internal User / Team Management. The minimum concrete
 * Permission identifiers this Story requires, scoped exactly to its 7
 * operations. MASTER_SPEC §28.1 "Nota de Permisos" forbids inventing a
 * broad, speculative permission catalog — these are not that: they are the
 * narrow set STORY-002-006's own design anticipated a consuming Story would
 * define ("exists for future Stories/modules to populate and consume").
 */
export const TeamManagementPermissions = {
  INVITE_USER: "users:invite",
  READ_USER: "users:read",
  LIST_USERS: "users:list",
  UPDATE_USER: "users:update",
  REMOVE_USER: "users:remove",
  SUSPEND_USER: "users:suspend",
  ASSIGN_USER_ROLE: "users:assign_role",
} as const;
