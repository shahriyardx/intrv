"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { QUESTION_COUNTS, questionTypeSchema } from "@/lib/schemas";
import { AiError } from "@/server/ai/client";
import { extractJdProfile, type JdProfile, jdTextSchema } from "@/server/ai/jd";
import { getViewer } from "@/server/dal/session";

export type ActionError = { ok: false; error: string };

/**
 * Everything except the JD text — the same controls as the topic form, minus the
 * difficulty picker, since seniority is read from the posting instead.
 */
const jdFormSchema = z.object({
  questionCount: z
    .number()
    .int()
    .refine((n) => (QUESTION_COUNTS as readonly number[]).includes(n), {
      message: "Pick a supported question count.",
    }),
  types: z
    .array(questionTypeSchema)
    .min(1, "Choose at least one question type.")
    .max(3),
  timeLimitMinutes: z.number().int().min(1).max(180).nullable(),
});

/**
 * Reads a pasted job description into a role profile, then creates a
 * JOB_DESCRIPTION session pointed at that role. Mirrors createInterviewSession's
 * contract: returns {ok:false,error} on any failure, redirects on success.
 *
 * We store only the derived topic (the role) and the brief (summary + stack +
 * focus) on the session — never the raw paste. The extraction runs before the
 * row exists, so nothing is persisted if the reader fails.
 */
export async function createJdSession(
  _prev: unknown,
  formData: FormData,
): Promise<ActionError | never> {
  const jdParsed = jdTextSchema.safeParse(String(formData.get("jd") ?? ""));
  if (!jdParsed.success) {
    return {
      ok: false,
      error: jdParsed.error.issues[0]?.message ?? "Paste a job description.",
    };
  }

  const fields = jdFormSchema.safeParse({
    questionCount: Number(formData.get("questionCount") ?? 10),
    types: formData.getAll("types").map(String),
    timeLimitMinutes: formData.get("timeLimitMinutes")
      ? Number(formData.get("timeLimitMinutes"))
      : null,
  });
  if (!fields.success) {
    return {
      ok: false,
      error: fields.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const viewer = await getViewer();

  let profile: JdProfile;
  try {
    profile = await extractJdProfile(jdParsed.data);
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof AiError && error.code === "insufficient_balance"
          ? "The job-description reader is unavailable right now. Please try again later."
          : "We couldn't read that job description. Try pasting the main responsibilities and requirements.",
    };
  }

  const session = await prisma.interviewSession.create({
    data: {
      // Same access model as every other session: signed out means unowned, the
      // id in the URL is the capability.
      userId: viewer.kind === "user" ? viewer.userId : null,
      topic: buildTopic(profile),
      difficulty: profile.seniority,
      questionCount: fields.data.questionCount,
      timeLimitMs: fields.data.timeLimitMinutes
        ? fields.data.timeLimitMinutes * 60_000
        : null,
      mode: "JOB_DESCRIPTION",
      // Threaded into generation by the existing session.brief → generate path.
      brief: buildBrief(profile),
      status: "GENERATING",
    },
    select: { id: true },
  });

  const types = fields.data.types.join(",");
  redirect(`/s/${session.id}?types=${encodeURIComponent(types)}`);
}

/**
 * The session topic is the role. It descends from model output, so strip control
 * characters and clamp to the topic column's 120. Fall back through the stack to
 * a generic label so a title-less posting still yields a usable topic (≥2 chars).
 */
function buildTopic(profile: JdProfile): string {
  const role = profile.role
    // biome-ignore lint/suspicious/noControlCharactersInRegex: same rule as topicSchema
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const base =
    role.length >= 2
      ? role
      : profile.stack[0]
        ? `${profile.stack[0]} interview`
        : "Technical interview";

  return base.slice(0, 120);
}

/**
 * The generation brief: the neutral summary plus the concrete stack and focus
 * areas, clamped to the brief column's 2000. This is what steers the questions
 * toward the role — and, deliberately, all we keep of the posting.
 */
function buildBrief(profile: JdProfile): string {
  const parts: string[] = [];
  if (profile.summary) parts.push(profile.summary);
  if (profile.stack.length) parts.push(`Stack: ${profile.stack.join(", ")}`);
  if (profile.focusAreas.length) {
    parts.push(`Focus: ${profile.focusAreas.join(", ")}`);
  }
  return parts.join("\n").slice(0, 2000);
}
