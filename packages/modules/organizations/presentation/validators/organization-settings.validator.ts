import { z } from "zod";

/**
 * Transport-level validation only (Architecture.md "Validation"): the path
 * parameter must be a syntactically valid UUID. Whether it identifies a
 * real, accessible Organization is a business/authorization concern
 * resolved by the use cases, not this schema. Shared by both Retrieve and
 * Update Organization Settings.
 */
export const organizationSettingsParamsSchema = z.object({
  organizationId: z.string().uuid("organizationId must be a valid UUID"),
});

export type OrganizationSettingsParamsInput = z.infer<typeof organizationSettingsParamsSchema>;

const MAX_EMAIL_LENGTH = 254; // RFC 5321 §4.5.3.1.3 practical maximum total-address length.

/**
 * `support_contact_email` is the sole approved Organization Settings field
 * (STORY-003-006) — required, not clearable: a missing, empty,
 * whitespace-only, too-long, or malformed value is rejected. No other field
 * is accepted.
 *
 * Uses zod's `html5Email` pattern rather than its stricter default: the
 * default pattern rejects legitimate addresses on internationalized
 * (punycode) domains and single-label domains like `user@localhost`, which
 * a real-world support contact address may plausibly use — `html5Email` is
 * the same pattern browsers use for `<input type="email">` validation, a
 * pragmatic and well-established balance of strict-but-not-exotic.
 */
export const updateOrganizationSettingsRequestSchema = z.object({
  support_contact_email: z
    .string()
    .trim()
    .min(1, "support_contact_email is required")
    .max(MAX_EMAIL_LENGTH, `support_contact_email must be at most ${MAX_EMAIL_LENGTH} characters`)
    .email({
      pattern: z.regexes.html5Email,
      error: "support_contact_email must be a valid email address",
    }),
});

export type UpdateOrganizationSettingsRequestInput = z.infer<
  typeof updateOrganizationSettingsRequestSchema
>;
