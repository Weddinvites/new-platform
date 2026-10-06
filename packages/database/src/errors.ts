/**
 * Detects a specific Postgres SQLSTATE error code (e.g. `23505` unique
 * violation, `23503` foreign key violation) on an error thrown by the
 * underlying `postgres` driver, without depending on its `PostgresError`
 * class directly. Used to let a database constraint remain the sole
 * enforcement mechanism for an invariant (no redundant pre-check query).
 */
export function isPostgresErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}
