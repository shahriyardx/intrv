"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  type AnswerKey,
  type AnswerResponse,
  answerResponseSchema,
  createSessionSchema,
  type Integrity,
  integritySchema,
} from "@/lib/schemas";
import { AiError } from "@/server/ai/client";
import { type GradeItem, gradeShortAnswers } from "@/server/ai/grade";
import { assertCanAccessSession } from "@/server/dal/interview";
import { getViewer } from "@/server/dal/session";
import { computeSessionScore, gradeLocally } from "@/server/grading/local";
import { afterSessionGraded } from "@/server/learning/hooks";

export type ActionError = { ok: false; error: string };

/**
 * Server Functions are POST endpoints reachable directly, not just through our
 * UI, and a proxy.ts matcher can never be relied on to cover them. Every action
 * in this file therefore establishes its own viewer and re-checks ownership.
 */

export async function createInterviewSession(
  _prev: unknown,
  formData: FormData,
): Promise<ActionError | never> {
  const raw = {
    topic: String(formData.get("topic") ?? ""),
    difficulty: String(formData.get("difficulty") ?? "MEDIUM"),
    questionCount: Number(formData.get("questionCount") ?? 10),
    types: formData.getAll("types").map(String),
    timeLimitMinutes: formData.get("timeLimitMinutes")
      ? Number(formData.get("timeLimitMinutes"))
      : null,
  };

  const parsed = createSessionSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const viewer = await getViewer();

  const session = await prisma.interviewSession.create({
    data: {
      // Signed out means unowned: the id in the URL is what brings the visitor
      // back to their own interview. No account, no cookie, nothing to migrate.
      userId: viewer.kind === "user" ? viewer.userId : null,
      topic: parsed.data.topic,
      difficulty: parsed.data.difficulty,
      questionCount: parsed.data.questionCount,
      timeLimitMs: parsed.data.timeLimitMinutes
        ? parsed.data.timeLimitMinutes * 60_000
        : null,
      status: "GENERATING",
    },
    select: { id: true },
  });

  // Types aren't a column — they only matter during generation, so they ride in
  // the redirect rather than bloating the schema.
  const types = parsed.data.types.join(",");
  redirect(`/s/${session.id}?types=${encodeURIComponent(types)}`);
}

export async function saveAnswer(input: {
  sessionId: string;
  questionId: string;
  response: AnswerResponse;
  /** Accumulated active time on this question. Analytics only — see Answer.timeMs. */
  timeMs?: number;
}): Promise<{ ok: true } | ActionError> {
  const viewer = await getViewer();
  const session = await assertCanAccessSession(viewer, input.sessionId);

  if (!session) return { ok: false, error: "Session not found." };
  if (session.status === "GRADED" || session.status === "SUBMITTED") {
    return { ok: false, error: "This session is already submitted." };
  }
  if (isExpired(session.expiresAt)) {
    return { ok: false, error: "Time is up." };
  }

  const parsed = answerResponseSchema.safeParse(input.response);
  if (!parsed.success) return { ok: false, error: "Invalid answer." };

  // Verify the question belongs to this session — never trust a client-supplied
  // id to be in scope.
  const question = await prisma.question.findFirst({
    where: { id: input.questionId, sessionId: input.sessionId },
    select: { id: true },
  });
  if (!question) return { ok: false, error: "Question not found." };

  // Clamp rather than reject: a wild client clock must not lose the answer.
  const timeMs =
    typeof input.timeMs === "number" && Number.isFinite(input.timeMs)
      ? Math.min(Math.max(Math.round(input.timeMs), 0), 6 * 60 * 60_000)
      : null;

  await prisma.answer.upsert({
    where: { questionId: input.questionId },
    create: {
      questionId: input.questionId,
      response: parsed.data,
      ...(timeMs !== null ? { timeMs } : {}),
    },
    update: {
      response: parsed.data,
      ...(timeMs !== null ? { timeMs } : {}),
    },
  });

  return { ok: true };
}

function isExpired(expiresAt: Date | null): boolean {
  // The DB deadline is authoritative; the client clock is decoration.
  return Boolean(expiresAt && expiresAt.getTime() < Date.now());
}

export async function submitSession(
  sessionId: string,
  integrity?: Integrity,
): Promise<ActionError | never> {
  const viewer = await getViewer();
  const session = await assertCanAccessSession(viewer, sessionId);

  if (!session) return { ok: false, error: "Session not found." };
  if (session.status === "GRADED") redirect(`/s/${sessionId}/result`);
  if (session.status !== "READY" && session.status !== "SUBMITTED") {
    return { ok: false, error: "This session can't be submitted yet." };
  }

  // Integrity counters are only meaningful (and only stored) for org assessments —
  // recording them for regular practice would be surveillance for no reader.
  const parsedIntegrity =
    session.assessmentId && integrity
      ? integritySchema.safeParse(integrity)
      : null;

  await prisma.interviewSession.update({
    where: { id: sessionId },
    data: {
      status: "SUBMITTED",
      submittedAt: new Date(),
      ...(parsedIntegrity?.success ? { integrity: parsedIntegrity.data } : {}),
    },
  });

  const questions = await prisma.question.findMany({
    where: { sessionId },
    orderBy: { index: "asc" },
    select: {
      id: true,
      prompt: true,
      answerKey: true,
      answer: { select: { response: true } },
    },
  });

  const scores: number[] = [];
  const toGrade: GradeItem[] = [];

  // Objective questions grade here: free, instant, and unaffected by a DeepSeek
  // outage.
  for (const question of questions) {
    const key = question.answerKey as AnswerKey;
    const response =
      (question.answer?.response as AnswerResponse | null) ?? null;

    const local = gradeLocally(key, response);
    if (local) {
      await prisma.answer.upsert({
        where: { questionId: question.id },
        create: {
          questionId: question.id,
          response: response ?? { kind: "MCQ", key: "" },
          isCorrect: local.isCorrect,
          score: local.score,
        },
        update: { isCorrect: local.isCorrect, score: local.score },
      });
      scores.push(local.score);
      continue;
    }

    if (key.kind !== "SHORT_ANSWER") continue;

    const text =
      response && response.kind === "SHORT_ANSWER" ? response.text.trim() : "";

    // A blank answer is a 0 we can score ourselves — don't pay the model to
    // tell us that, and don't make the student wait for it.
    if (!text) {
      await prisma.answer.upsert({
        where: { questionId: question.id },
        create: {
          questionId: question.id,
          response: { kind: "SHORT_ANSWER", text: "" },
          isCorrect: false,
          score: 0,
          feedback: "You left this blank.",
        },
        update: {
          isCorrect: false,
          score: 0,
          feedback: "You left this blank.",
        },
      });
      scores.push(0);
      continue;
    }

    toGrade.push({
      id: question.id,
      prompt: question.prompt,
      expected: key.expected,
      keyPoints: key.keyPoints,
      answer: text,
    });
  }

  if (toGrade.length > 0) {
    try {
      const grades = await gradeShortAnswers(toGrade, { sessionId });

      for (const item of toGrade) {
        const grade = grades.get(item.id);
        // If the model skipped an id, the student must not silently get a 0 —
        // flag it instead of inventing a score.
        const score = grade?.score ?? null;

        await prisma.answer.update({
          where: { questionId: item.id },
          data: {
            isCorrect: score === null ? null : score >= 60,
            score,
            feedback:
              grade?.feedback ??
              "We couldn't grade this answer automatically. It isn't counted in your score.",
          },
        });

        if (score !== null) scores.push(score);
      }
    } catch (error) {
      const message =
        error instanceof AiError && error.code === "insufficient_balance"
          ? "Grading is unavailable right now. Your objective answers are scored; short answers will need a retry."
          : "We couldn't grade your written answers. Your objective answers are scored.";

      await prisma.interviewSession.update({
        where: { id: sessionId },
        data: {
          status: "GRADED",
          gradedAt: new Date(),
          score: computeSessionScore(scores),
          error: message,
        },
      });

      await runAfterGraded(sessionId);
      updateTag(`session:${sessionId}`);
      redirect(`/s/${sessionId}/result`);
    }
  }

  await prisma.interviewSession.update({
    where: { id: sessionId },
    data: {
      status: "GRADED",
      gradedAt: new Date(),
      score: computeSessionScore(scores),
    },
  });

  await runAfterGraded(sessionId);

  // updateTag, not revalidateTag: the student must see their own result
  // immediately, not stale-while-revalidate.
  updateTag(`session:${sessionId}`);
  if (viewer.kind === "user") updateTag(`user:${viewer.userId}`);

  redirect(`/s/${sessionId}/result`);
}

/** The learning loop must never cost the student their result. */
async function runAfterGraded(sessionId: string): Promise<void> {
  try {
    await afterSessionGraded(sessionId);
  } catch (error) {
    console.error("afterSessionGraded failed:", error);
  }
}

export async function createShareLink(
  sessionId: string,
): Promise<{ ok: true; shareId: string } | ActionError> {
  const viewer = await getViewer();
  const session = await assertCanAccessSession(viewer, sessionId);

  if (!session) return { ok: false, error: "Session not found." };
  if (session.status !== "GRADED") {
    return { ok: false, error: "Only graded sessions can be shared." };
  }

  const existing = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    select: { shareId: true },
  });
  if (existing?.shareId) return { ok: true, shareId: existing.shareId };

  // Unguessable: the share page is public, so the id is the only thing
  // protecting it.
  const shareId = randomBytes(12).toString("base64url");

  await prisma.interviewSession.update({
    where: { id: sessionId },
    data: { shareId },
  });

  revalidatePath(`/r/${shareId}`);
  return { ok: true, shareId };
}
