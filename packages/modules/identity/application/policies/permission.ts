/**
 * Opaque permission identifier (STORY-002-006 — RBAC Foundation). No
 * catalog of concrete permission codes exists yet — MASTER_SPEC §28.1
 * "Nota de Permisos" deliberately leaves that catalog undefined until
 * approved through the project's change-control process. This type only
 * carries the Role → Permission *mechanism*; it must never be seeded with
 * invented permission names.
 */
export type Permission = string;
