import "server-only";
import { prisma } from "@/lib/db";
import type { Difficulty } from "@/lib/schemas";

/**
 * "Challenge a friend" reuses the share link as the invite: the source session
 * is a GRADED session someone shared, and the friend clones its exact question
 * set. Everything here is a public read keyed by the unguessable shareId or by a
 * session id the caller already has access to — no answer keys are ever exposed,
 * because the clone happens server-side in acceptChallenge().
 */

export type ChallengeSource = {
  /** The cloned session inherits these. */
  topic: string;
  difficulty: Difficulty;
  questionCount: number;
  timeLimitMs: number | null;
  score: number;
  /**
   * The challenger's name, or null when it must not be shown — signed-out,
   * opted out of the public board, or banned. The page renders null as
   * "Someone", the same privacy rule the leaderboard uses.
   */
  challengerName: string | null;
};

/**
 * The invitation preview for /challenge/[shareId]. GRADED only — the share id
 * points at a finished result, and a live session must never be reachable this
 * way or its questions would leak before the taker submits (see share.ts).
 */
export async function getChallengeSource(
  shareId: string,
): Promise<ChallengeSource | null> {
  const session = await prisma.interviewSession.findFirst({
    where: { shareId, status: "GRADED" },
    select: {
      topic: true,
      difficulty: true,
      questionCount: true,
      timeLimitMs: true,
      score: true,
      user: {
        select: { name: true, leaderboardOptOut: true, banned: true },
      },
    },
  });

  if (!session || session.score === null) return null;

  return {
    topic: session.topic,
    difficulty: session.difficulty,
    questionCount: session.questionCount,
    timeLimitMs: session.timeLimitMs,
    score: Math.round(Number(session.score)),
    challengerName: resolveName(session.user),
  };
}

export type RematchComparison = {
  opponentScore: number;
  /** "Someone" under the same privacy rules; never a hidden real name. */
  opponentName: string;
  topic: string;
};

/**
 * The head-to-head for a REMATCH session's result banner: how the person who
 * issued the challenge scored on the set this session cloned. Returns null when
 * the session is not a rematch or the source has gone (SetNull on delete), so a
 * caller can mount it unconditionally.
 */
export async function getRematchComparison(
  sessionId: string,
): Promise<RematchComparison | null> {
  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    select: { rematchOfId: true },
  });

  if (!session?.rematchOfId) return null;

  const source = await prisma.interviewSession.findUnique({
    where: { id: session.rematchOfId },
    select: {
      topic: true,
      score: true,
      status: true,
      user: {
        select: { name: true, leaderboardOptOut: true, banned: true },
      },
    },
  });

  if (!source || source.status !== "GRADED" || source.score === null) {
    return null;
  }

  return {
    opponentScore: Math.round(Number(source.score)),
    opponentName: resolveName(source.user) ?? "Someone",
    topic: source.topic,
  };
}

function resolveName(
  user: {
    name: string;
    leaderboardOptOut: boolean;
    banned: boolean | null;
  } | null,
): string | null {
  if (!user) return null;
  if (user.leaderboardOptOut || user.banned) return null;
  return user.name;
}
