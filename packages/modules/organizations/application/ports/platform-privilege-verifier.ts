/**
 * STORY-003-004 — resolves whether a User is platform-privileged (an ACTIVE
 * OWNER or ADMIN membership in the SYSTEM organization; API_SPEC.md §22).
 * Declared locally, not imported from Identity, so this use case compiles
 * without the Identity addition; the wiring module supplies the implementation.
 * Resolves `false` for any non-privileged state and throws only on
 * infrastructure failure.
 */
export type PlatformPrivilegeVerifier = (params: { userId: string }) => Promise<boolean>;
