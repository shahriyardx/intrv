import "server-only";
import { prisma } from "@/lib/db";
import { clientQuestionSelect, toClientQuestion } from "@/server/dal/dto";
import type { SessionDetail } from "@/server/dal/interview";

/**
 * A shared result plus, when it is honest to show one, the taker's name. The
 * name is present ONLY for a signed-in owner who is on the public leaderboard
 * and not banned — for an anonymous, opted-out, or banned taker it is null and
 * the badge simply omits it. Sharing a result must never out someone who chose
 * not to be named.
 */
export type SharedSession = SessionDetail & { takerName: string | null };

/**
 * Loads a shared result by its unguessable share id. Deliberately NOT
 * owner-scoped: the whole point is that anyone with the link can read it. The
 * id is the only credential, which is why it is 96 bits of randomness and why
 * only GRADED sessions are reachable — a live session must never be shareable
 * or the questions leak before the taker submits.
 */
export async function getSharedSession(
  shareId: string,
): Promise<SharedSession | null> {
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
      rematchOfId: true,
      // Only the fields the privacy test below needs — never enough to identify
      // an anonymous taker.
      user: { select: { name: true, banned: true, leaderboardOptOut: true } },
      questions: {
        orderBy: { index: "asc" },
        select: clientQuestionSelect,
      },
    },
  });

  if (!session) return null;

  // Name the taker only when they are a real, unbanned, opted-in account.
  // Anonymous (no user), opted-out, or banned all collapse to null.
  const takerName =
    session.user && !session.user.banned && !session.user.leaderboardOptOut
      ? session.user.name
      : null;

  return {
    takerName,
    // A share page is read by strangers by definition.
    owned: false,
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
    rematchOfId: session.rematchOfId,
    // Graded, so the answers are already public knowledge to the taker.
    questions: session.questions.map((q) => toClientQuestion(q, true)),
  };
}
