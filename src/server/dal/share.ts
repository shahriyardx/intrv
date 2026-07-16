import "server-only";
import { prisma } from "@/lib/db";
import { clientQuestionSelect, toClientQuestion } from "@/server/dal/dto";
import type { SessionDetail } from "@/server/dal/interview";

/**
 * Loads a shared result by its unguessable share id. Deliberately NOT
 * owner-scoped: the whole point is that anyone with the link can read it. The
 * id is the only credential, which is why it is 96 bits of randomness and why
 * only GRADED sessions are reachable — a live session must never be shareable
 * or the questions leak before the taker submits.
 */
export async function getSharedSession(
  shareId: string,
): Promise<SessionDetail | null> {
  const session = await prisma.interviewSession.findFirst({
    where: { shareId, status: "GRADED" },
    select: {
      id: true,
      topic: true,
      difficulty: true,
      status: true,
      questionCount: true,
      score: true,
      expiresAt: true,
      timeLimitMs: true,
      createdAt: true,
      shareId: true,
      error: true,
      mode: true,
      adaptive: true,
      rematchOfId: true,
      questions: {
        orderBy: { index: "asc" },
        select: clientQuestionSelect,
      },
    },
  });

  if (!session) return null;

  return {
    id: session.id,
    topic: session.topic,
    difficulty: session.difficulty,
    status: session.status,
    questionCount: session.questionCount,
    score: session.score === null ? null : Number(session.score),
    expiresAt: session.expiresAt,
    timeLimitMs: session.timeLimitMs,
    createdAt: session.createdAt,
    shareId: session.shareId,
    error: session.error,
    mode: session.mode,
    adaptive: session.adaptive,
    rematchOfId: session.rematchOfId,
    // Graded, so the answers are already public knowledge to the taker.
    questions: session.questions.map((q) => toClientQuestion(q, true)),
  };
}
