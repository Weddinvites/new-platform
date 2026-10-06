import { InvalidSlugError } from "../exceptions/invalid-slug.error";

/**
 * STORY-003-001 approved slug policy: an optional client slug, or one
 * derived from `display_name` when omitted, is normalized to
 * lowercase-kebab-case before the uniqueness check. No auto-suffixing and no
 * reserved-slug catalog — the database's unique constraint on
 * organizations.slug is the sole enforcement mechanism (see
 * OrganizationSlugAlreadyExistsError), including for the persisted SYSTEM
 * organization's slug, which is not specially protected beyond ordinary
 * uniqueness.
 */
export class Slug {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static create(raw: string): Slug {
    const normalized = normalize(raw);
    if (normalized.length === 0) {
      throw new InvalidSlugError();
    }
    return new Slug(normalized);
  }

  static fromPersistence(value: string): Slug {
    return new Slug(value);
  }
}

function normalize(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
