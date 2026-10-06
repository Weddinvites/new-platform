import { z } from "zod";

/**
 * Transport-level validation only (Architecture.md "Validation"): the path
 * parameter must be a syntactically valid UUID. Whether it identifies a
 * real, accessible Organization is a business/authorization concern
 * resolved by the use cases, not this schema. Shared by both Retrieve and
 * Update Organization Branding.
 */
export const organizationBrandingParamsSchema = z.object({
  organizationId: z.string().uuid("organizationId must be a valid UUID"),
});

export type OrganizationBrandingParamsInput = z.infer<typeof organizationBrandingParamsSchema>;

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

/**
 * All four fields are independently optional, but at least one must be
 * present (STORY-003-005 approved contract) — enforced by the top-level
 * `.refine()`. No `custom_domain` or `email_branding` field is accepted:
 * Custom Domain remains exclusively Invitation Deployment's concern, and
 * Email Branding is a rendering behavior, not a stored field.
 *
 * `.trim()` runs before every field-level check, so incidental
 * leading/trailing whitespace never causes a rejection — `brand_name` is
 * trimmed explicitly, `logo` is trimmed implicitly by `.url()`'s underlying
 * `URL` parser (WHATWG URL Standard strips leading/trailing whitespace), and
 * `primary_color`/`secondary_color` are trimmed explicitly here so all four
 * fields behave consistently.
 */
export const updateOrganizationBrandingRequestSchema = z
  .object({
    brand_name: z.string().trim().min(1, "brand_name must not be empty").optional(),
    logo: z.string().url("logo must be a well-formed URL").optional(),
    primary_color: z
      .string()
      .trim()
      .regex(HEX_COLOR_PATTERN, "primary_color must be a #RRGGBB hex color")
      .optional(),
    secondary_color: z
      .string()
      .trim()
      .regex(HEX_COLOR_PATTERN, "secondary_color must be a #RRGGBB hex color")
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export type UpdateOrganizationBrandingRequestInput = z.infer<
  typeof updateOrganizationBrandingRequestSchema
>;
