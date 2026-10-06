import { z } from "zod";

/**
 * Transport-level validation only, matching the same philosophy as
 * register-user.validator.ts: presence/shape only. Full credential
 * correctness is decided exclusively by the AuthSessionProvider (Supabase),
 * so a malformed email is treated identically to a wrong password —
 * INVALID_CREDENTIALS, never a distinguishing VALIDATION_ERROR — preserving
 * API_SPEC.md §21a's "does not reveal whether the email exists" guarantee.
 */
export const loginRequestSchema = z.object({
  email: z.string().min(1, "email is required"),
  password: z.string().min(1, "password is required"),
});

export type LoginRequestInput = z.infer<typeof loginRequestSchema>;
