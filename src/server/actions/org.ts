"use server";

import { randomBytes } from "node:crypto";
import type { Route } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  answerKeySchema,
  choiceSchema,
  difficultySchema,
  questionTypeSchema,
  topicSchema,
} from "@/lib/schemas";
import { slugify } from "@/lib/slug";
import { AiError } from "@/server/ai/client";
import { generateQuestions } from "@/server/ai/generate";
import { getViewer } from "@/server/dal/session";

export type ActionError = { ok: false; error: string };

/**
 * Server Functions are POST endpoints reachable directly, so every action here
 * re-establishes its own viewer and re-checks membership/role in the database —
 * the UI that called it proves nothing.
 */

// Not exported: a "use server" module may only export async functions. The
// sign-up form mirrors these bounds in its own client schema.
const orgNameSchema = z
  .string()
  .trim()
  .min(2, "Give the organization a name of at least 2 characters.")
  .max(80, "Keep the organization name under 80 characters.");

/**
 * Creates the account's organization. One org per user: an account is either
 * personal or an org account, and an org account has exactly one org. This is
 * the only creation path — it runs from the sign-up flow when someone chooses
 * an organization account, and flips them to an org account by giving them a
 * membership and setting session.activeOrganizationId.
 */
export async function createOrganization(
  _prev: unknown,
  formData: FormData,
  // `code: "has_org"` lets the sign-up retry path tell "you already have one"
  // (route to /org) apart from a real failure (show the error).
): Promise<
  ActionError | { ok: false; error: string; code: "has_org" } | never
> {
  const viewer = await getViewer();
  if (viewer.kind !== "user") redirect("/sign-in?next=/sign-up");

  const parsed = orgNameSchema.safeParse(String(formData.get("name") ?? ""));
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid name.",
    };
  }
  const name = parsed.data;

  // One org per user — reject if this account already belongs to one.
  const existing = await prisma.member.count({
    where: { userId: viewer.userId },
  });
  if (existing >= 1) {
    return {
      ok: false,
      error: "This account already has an organization.",
      code: "has_org",
    };
  }

  // Pre-dedupe the slug so we keep the -2/-3 suffixing behaviour; the plugin
  // would otherwise just reject a taken slug. better-auth then creates the org
  // and the creator's owner member atomically.
  const slug = await uniqueSlug(name);
  const requestHeaders = await headers();

  let created: { id: string } | null;
  try {
    created = await auth.api.createOrganization({
      body: { name, slug },
      headers: requestHeaders,
    });
  } catch {
    return {
      ok: false,
      error: "We couldn't create that organization. Please try again.",
    };
  }
  if (!created) {
    return {
      ok: false,
      error: "We couldn't create that organization. Please try again.",
    };
  }

  // Set it active so session.activeOrganizationId — the source of truth for org
  // accounts — is populated now, not on the next session refresh. getActiveOrg
  // falls back to the membership if this races, so a failure here is non-fatal.
  try {
    await auth.api.setActiveOrganization({
      body: { organizationId: created.id },
      headers: requestHeaders,
    });
  } catch {
    // non-fatal — the membership fallback covers it.
  }

  redirect("/org");
}

/** A slug free at read time; suffixes -2, -3… on collision. */
async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || "org";

  for (let n = 1; n < 50; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const taken = await prisma.organization.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }

  // Fall back to an unguessable suffix rather than loop forever.
  return `${base}-${randomBytes(3).toString("hex")}`;
}

const SCREEN_QUESTION_COUNTS = [5, 10, 15, 20] as const;
const SCREEN_TIME_LIMITS = [10, 20, 30, 45] as const;

const createAssessmentSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Give the assessment a title of at least 2 characters.")
    .max(120, "Keep the title under 120 characters."),
  topic: topicSchema,
  difficulty: difficultySchema,
  questionCount: z
    .number()
    .int()
    .refine((n) => (SCREEN_QUESTION_COUNTS as readonly number[]).includes(n), {
      message: "Pick a supported question count.",
    }),
  timeLimitMinutes: z
    .number()
    .int()
    .refine((n) => (SCREEN_TIME_LIMITS as readonly number[]).includes(n), {
      message: "Pick a supported time limit.",
    }),
  types: z
    .array(questionTypeSchema)
    .min(1, "Choose at least one question type.")
    .max(3),
});

export async function createAssessment(
  orgId: string,
  _prev: unknown,
  formData: FormData,
): Promise<ActionError | never> {
  const viewer = await getViewer();
  if (viewer.kind !== "user") redirect("/sign-in?next=/org");

  // Re-check role in the DB: owner/admin may author assessments, a plain member
  // may not.
  const membership = await prisma.member.findUnique({
    where: {
      organizationId_userId: { organizationId: orgId, userId: viewer.userId },
    },
    select: { role: true },
  });
  if (
    !membership ||
    (membership.role !== "owner" && membership.role !== "admin")
  ) {
    return {
      ok: false,
      error: "You don't have permission to create assessments here.",
    };
  }

  const parsed = createAssessmentSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    topic: String(formData.get("topic") ?? ""),
    difficulty: String(formData.get("difficulty") ?? "MEDIUM"),
    questionCount: Number(formData.get("questionCount") ?? 10),
    timeLimitMinutes: Number(formData.get("timeLimitMinutes") ?? 20),
    types: formData.getAll("types").map(String),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  const input = parsed.data;

  // Generate synchronously and freeze: every candidate must answer the
  // identical set, so it is written once, here, and stored on the assessment.
  let generated: Awaited<ReturnType<typeof generateQuestions>>;
  try {
    generated = await generateQuestions({
      topic: input.topic,
      difficulty: input.difficulty,
      types: input.types,
      count: input.questionCount,
    });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof AiError && error.code === "insufficient_balance"
          ? "Question generation is unavailable right now. Please try again later."
          : "We couldn't write questions for this topic. Try rephrasing it.",
    };
  }

  if (generated.length === 0) {
    return {
      ok: false,
      error: "We couldn't write questions for this topic. Try rephrasing it.",
    };
  }

  // The frozen payload mirrors NormalizedQuestion and carries the answer key —
  // server-only, never selected into a client view. See src/server/dal/org.ts.
  const frozen = generated.map((q) => ({
    type: q.type,
    prompt: q.prompt,
    choices: q.choices,
    answerKey: q.answerKey,
    explanation: q.explanation,
    concepts: q.concepts,
  }));

  // Unguessable: the invite link is public, so the token is its only credential.
  const inviteToken = randomBytes(12).toString("base64url");

  const assessment = await prisma.assessment.create({
    data: {
      orgId,
      title: input.title,
      topic: input.topic,
      difficulty: input.difficulty,
      // Persist the true generated count, which may fall short of the request.
      questionCount: frozen.length,
      timeLimitMs: input.timeLimitMinutes * 60_000,
      questions: frozen,
      inviteToken,
      createdById: viewer.userId,
    },
    select: { id: true },
  });

  redirect(`/org/assessments/${assessment.id}` as Route);
}

/** owner/admin only: flip whether an assessment accepts new candidates. */
export async function toggleAssessmentActive(
  assessmentId: string,
): Promise<{ ok: true; active: boolean } | ActionError> {
  const viewer = await getViewer();
  const assessment = await manageableAssessment(viewer, assessmentId);
  if (!assessment) return { ok: false, error: "Assessment not found." };

  const updated = await prisma.assessment.update({
    where: { id: assessmentId },
    data: { active: !assessment.active },
    select: { active: true },
  });

  return { ok: true, active: updated.active };
}

/**
 * owner/admin only: mint a new invite token. Every previously-shared link
 * pointed at the old token and stops working the instant this returns — say so
 * in the confirm copy.
 */
export async function rotateInviteToken(
  assessmentId: string,
): Promise<{ ok: true; token: string } | ActionError> {
  const viewer = await getViewer();
  const assessment = await manageableAssessment(viewer, assessmentId);
  if (!assessment) return { ok: false, error: "Assessment not found." };

  const token = randomBytes(12).toString("base64url");
  await prisma.assessment.update({
    where: { id: assessmentId },
    data: { inviteToken: token },
  });

  return { ok: true, token };
}

/**
 * The assessment if the viewer may manage it (owner/admin of its org), else null.
 * Both "no such assessment" and "not permitted" return null.
 */
async function manageableAssessment(
  viewer: Awaited<ReturnType<typeof getViewer>>,
  assessmentId: string,
): Promise<{ active: boolean } | null> {
  if (viewer.kind !== "user") return null;

  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { active: true, orgId: true },
  });
  if (!assessment) return null;

  const membership = await prisma.member.findUnique({
    where: {
      organizationId_userId: {
        organizationId: assessment.orgId,
        userId: viewer.userId,
      },
    },
    select: { role: true },
  });
  if (
    !membership ||
    (membership.role !== "owner" && membership.role !== "admin")
  ) {
    return null;
  }

  return { active: assessment.active };
}

const startAssessmentSchema = z.object({
  candidateName: z
    .string()
    .trim()
    .min(1, "Enter your name.")
    .max(80, "Keep your name under 80 characters."),
  candidateEmail: z
    .email("Enter a valid email address.")
    .max(160, "Keep your email under 160 characters."),
});

/** The frozen question set, validated on the way out of the JSON column. */
const frozenQuestionsSchema = z.array(
  z.object({
    type: questionTypeSchema,
    prompt: z.string(),
    choices: z.array(choiceSchema).nullable(),
    answerKey: answerKeySchema,
    explanation: z.string(),
    concepts: z.array(z.string()),
  }),
);

/**
 * PUBLIC: a candidate — anonymous or signed in — starts an attempt at an assessment.
 *
 * Screens are always timed, so the deadline is set at creation. One attempt per
 * candidate is not enforceable without an identity we don't collect; the report
 * simply shows every attempt.
 */
export async function startAssessmentSession(
  token: string,
  _prev: unknown,
  formData: FormData,
): Promise<ActionError | never> {
  const parsed = startAssessmentSchema.safeParse({
    candidateName: String(formData.get("candidateName") ?? ""),
    candidateEmail: String(formData.get("candidateEmail") ?? ""),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const assessment = await prisma.assessment.findFirst({
    where: { inviteToken: token, active: true },
    select: {
      id: true,
      topic: true,
      difficulty: true,
      timeLimitMs: true,
      questionCount: true,
      questions: true,
    },
  });
  if (!assessment) {
    return {
      ok: false,
      error: "This screening link is no longer active. Ask for a fresh one.",
    };
  }

  const frozen = frozenQuestionsSchema.safeParse(assessment.questions);
  if (!frozen.success || frozen.data.length === 0) {
    return {
      ok: false,
      error:
        "This assessment is misconfigured. Please contact the organization.",
    };
  }

  const viewer = await getViewer();
  const now = new Date();
  const timeLimitMs = assessment.timeLimitMs ?? 20 * 60_000;

  const session = await prisma.interviewSession.create({
    data: {
      // A signed-in candidate keeps the attempt in their own history; an
      // anonymous one reaches it through the session id, as everywhere else.
      userId: viewer.kind === "user" ? viewer.userId : null,
      mode: "ASSESSMENT",
      assessmentId: assessment.id,
      candidateName: parsed.data.candidateName,
      candidateEmail: parsed.data.candidateEmail,
      topic: assessment.topic,
      difficulty: assessment.difficulty,
      questionCount: frozen.data.length,
      timeLimitMs,
      // READY, not GENERATING: the questions already exist, so the runner
      // replays them rather than paying to make new ones.
      status: "READY",
      startedAt: now,
      expiresAt: new Date(now.getTime() + timeLimitMs),
      // Copy the frozen set into this attempt's own Question rows so grading is
      // identical to every other session.
      questions: {
        create: frozen.data.map((q, index) => ({
          index,
          type: q.type,
          prompt: q.prompt,
          choices: q.choices ?? undefined,
          answerKey: q.answerKey,
          explanation: q.explanation || null,
          concepts: q.concepts,
        })),
      },
    },
    select: { id: true },
  });

  const types = [...new Set(frozen.data.map((q) => q.type))].join(",");
  redirect(`/s/${session.id}?types=${encodeURIComponent(types)}`);
}
