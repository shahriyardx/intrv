"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import type { QuestionType } from "@/lib/schemas";
import type { NormalizedQuestion } from "@/server/ai/schemas";
import {
  DAILY_TIME_LIMIT_MS,
  getOrCreateDailyChallenge,
} from "@/server/dal/daily";
import { checkInterviewQuota } from "@/server/dal/limits";
import { getViewer } from "@/server/dal/session";

export type ActionError = { ok: false; error: string };

/** Distinct question types present, so the runner's replay URL is honest. */
function typesOf(questions: NormalizedQuestion[]): QuestionType[] {
  const seen = new Set<QuestionType>();
  for (const q of questions) seen.add(q.type);
  return [...seen];
}

/**
 * Starts (or resumes) the viewer's attempt at today's challenge.
 *
 * On the very first visit of a UTC day this blocks while the set is generated
 * (~60-120s) — the button island shows a patient pending state for exactly that
 * window. Server Functions are POST endpoints reachable directly, so this
 * re-establishes its own viewer rather than trusting the page that called it.
 *
 * Signed-in players get one attempt per challenge: a second start returns them
 * to their existing session (or its result) instead of minting another.
 * Signed-out visitors may play, but the /daily copy says only signed-in scores
 * rank — an anonymous session has no identity to place on the board.
 */
export async function startDailyChallenge(
  _prev: unknown,
  _formData: FormData,
): Promise<ActionError | never> {
  const viewer = await getViewer();

  const challenge = await getOrCreateDailyChallenge();

  const types = typesOf(challenge.questions);
  const typesParam = encodeURIComponent(types.join(","));

  if (viewer.kind === "user") {
    const existing = await prisma.interviewSession.findFirst({
      where: { userId: viewer.userId, dailyChallengeId: challenge.id },
      select: { id: true, status: true },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      redirect(
        existing.status === "GRADED"
          ? `/s/${existing.id}/result`
          : `/s/${existing.id}?types=${typesParam}`,
      );
    }
  }

  const now = new Date();

  if (viewer.kind !== "user") redirect("/sign-in?next=%2Fdaily");

  const quota = await checkInterviewQuota(viewer);
  if (!quota.ok) return { ok: false, error: quota.message };

  const session = await prisma.interviewSession.create({
    data: {
      userId: viewer.kind === "user" ? viewer.userId : null,
      mode: "DAILY",
      dailyChallengeId: challenge.id,
      topic: challenge.topic,
      difficulty: challenge.difficulty,
      questionCount: challenge.questions.length,
      timeLimitMs: DAILY_TIME_LIMIT_MS,
      status: "READY",
      startedAt: now,
      expiresAt: new Date(now.getTime() + DAILY_TIME_LIMIT_MS),
      // Seed the frozen set as this session's own Question rows so grading and
      // the runner's replay path treat it like any other session.
      questions: {
        create: challenge.questions.map((q, index) => ({
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

  redirect(`/s/${session.id}?types=${typesParam}`);
}
