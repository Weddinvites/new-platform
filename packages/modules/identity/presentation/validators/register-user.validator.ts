import { z } from "zod";

/**
 * Transport-level validation only (Architecture.md "Validation": Presentation
 * validates input format/required fields; Domain validates business
 * invariants). This schema exists to reject malformed requests early with a
 * clean 400 — the domain value objects (Email, Password, FullName) remain
 * the authoritative source of business validation and are always re-checked
 * by the use case regardless of what called it.
 */
export const registerUserRequestSchema = z.object({
  email: z.string().min(1, "email is required"),
  password: z.string().min(1, "password is required"),
  full_name: z.string().min(1, "full_name is required"),
  invitation_token: z.string().min(1).optional(),
});

export type RegisterUserRequestInput = z.infer<typeof registerUserRequestSchema>;
