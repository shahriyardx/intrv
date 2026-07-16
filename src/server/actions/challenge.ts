"use server";

import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { QuestionType } from "@/lib/schemas";
import { getViewer } from "@/server/dal/session";

export type ActionError = { ok: false; error: string };

/**
 * Accepts a friend's challenge: clones the shared session's exact question set
 * into a fresh REMATCH session for the viewer, then drops them into the runner.
 *
 * The clone is entirely server-side — answer keys are read from the source's
 * Question rows and written straight into the new ones, never crossing the wire.
 * The source must be GRADED (a live session's questions must not leak), which
 * the shareId lookup enforces. The new session gets no shareId of its own: it is
 * an attempt, not something to re-share.
 *
 * A POST endpoint reachable directly, so it establishes its own viewer.
 */
export async function acceptChallenge(
  shareId: string,
): Promise<ActionError | never> {
  const viewer = await getViewer();

  const source = await prisma.interviewSession.findFirst({
    where: { shareId, status: "GRADED" },
    select: {
      id: true,
      topic: true,
      difficulty: true,
      questionCount: true,
      timeLimitMs: true,
      questions: {
        orderBy: { index: "asc" },
        select: {
          index: true,
          type: true,
          prompt: true,
          choices: true,
          answerKey: true,
          explanation: true,
          concepts: true,
        },
      },
    },
  });

  if (!source || source.questions.length === 0) {
    return { ok: false, error: "That challenge could not be found." };
  }

  const now = new Date();
  const timeLimitMs = source.timeLimitMs;

  const session = await prisma.interviewSession.create({
    data: {
      userId: viewer.kind === "user" ? viewer.userId : null,
      mode: "REMATCH",
      rematchOfId: source.id,
      topic: source.topic,
      difficulty: source.difficulty,
      questionCount: source.questionCount,
      timeLimitMs,
      status: "READY",
      startedAt: now,
      expiresAt: timeLimitMs ? new Date(now.getTime() + timeLimitMs) : null,
      questions: {
        create: source.questions.map((q) => ({
          index: q.index,
          type: q.type,
          prompt: q.prompt,
          choices: (q.choices ?? undefined) as
            | Prisma.InputJsonValue
            | undefined,
          answerKey: q.answerKey as Prisma.InputJsonValue,
          explanation: q.explanation,
          concepts: q.concepts,
        })),
      },
    },
    select: { id: true },
  });

  const types = [
    ...new Set(source.questions.map((q) => q.type)),
  ] as QuestionType[];
  const typesParam = encodeURIComponent(types.join(","));

  redirect(`/s/${session.id}?types=${typesParam}`);
}
