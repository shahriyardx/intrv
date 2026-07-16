/**
 * Slug rules, shared by the editor's auto-suggestion and the server's
 * validation. They live together so they cannot drift: slugify() must only ever
 * produce something SLUG_PATTERN accepts, or the editor would suggest a slug
 * that the action then rejects.
 *
 * Import-free on purpose — this runs in the client bundle too.
 */

export const SLUG_MAX = 120;

/** Lowercase words joined by single hyphens; no leading, trailing or doubled. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(input: string): string {
  return (
    input
      // Decompose accents into letter + mark so "Résumé" becomes "resume"
      // rather than "r-sum", which is what dropping the whole glyph would give.
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, SLUG_MAX)
      // The slice can land mid-separator and leave a trailing hyphen, which
      // SLUG_PATTERN rejects.
      .replace(/-+$/g, "")
  );
}
