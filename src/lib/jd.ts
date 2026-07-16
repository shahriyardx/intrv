import { z } from "zod";
import type { Difficulty } from "@/lib/schemas";

/**
 * Shared JD validation. Lives outside the `server-only` extraction module so
 * the configurator (a client component) and unit tests can use it without
 * pulling the DeepSeek client — and its env loading — into the bundle.
 */
export const JD_MIN = 80;
export const JD_MAX = 8000;

/**
 * Strip control characters the way topicSchema does — but keep tab, newline,
 * and carriage return, because a job description is genuinely multi-line. The
 * stray C0/DEL bytes are what could smuggle a fake message boundary near the
 * model.
 */
function stripControl(text: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping them is the point
  return text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
}

/**
 * Validates the pasted JD. Sanitizes first, then bounds length on the cleaned
 * text so a paste padded with control bytes can't sneak past the minimum.
 */
export const jdTextSchema = z
  .string()
  .transform((s) => stripControl(s).trim())
  .refine(
    (s) => s.length >= JD_MIN,
    `Paste at least ${JD_MIN} characters of the job description.`,
  )
  .refine(
    (s) => s.length <= JD_MAX,
    `That job description is too long — keep it under ${JD_MAX} characters.`,
  );

/**
 * Maps the model's freeform seniority word onto the 5-rung difficulty ladder.
 * Order matters: staff/principal must win before the "senior" substring in
 * "senior staff engineer" pulls it down to HARD. Anything unrecognized holds at
 * MEDIUM — a safe middle for question difficulty.
 */
export function mapSeniority(raw: string): Difficulty {
  const s = raw.toLowerCase();
  if (/intern|trainee|apprentice/.test(s)) return "BEGINNER";
  if (/staff|principal|distinguished|architect|fellow/.test(s)) return "EXPERT";
  if (/senior|\bsr\b|\blead\b/.test(s)) return "HARD";
  if (/junior|\bjr\b|entry|graduate|\bgrad\b|associate/.test(s)) return "EASY";
  if (/mid|intermediate|regular/.test(s)) return "MEDIUM";
  return "MEDIUM";
}
