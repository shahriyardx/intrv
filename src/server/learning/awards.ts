import "server-only";
import { prisma } from "@/lib/db";
import { seasonalAwardsFor } from "@/server/learning/seasonal";

/**
 * Capturing seasonal badges when a session is graded.
 *
 * This is the only place badges are written. Everything else is derived — see
 * badges.ts — and stays that way; only the time-limited ones need a row,
 * because their condition stops being reachable once the season shuts.
 *
 * Awards are upserted and never deleted. Earning the same badge twice is the
 * same fact as earning it once, so a re-grade is harmless.
 */
export async function awardSeasonalBadges(sessionId: string): Promise<void> {
  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    select: {
      userId: true,
      topic: true,
      gradedAt: true,
      mode: true,
    },
  });

  if (!session?.userId || !session.gradedAt) return;
  // A screening is a recruiter's process, not the candidate's play — excluded
  // from badges for the same reason it is excluded from XP and the leaderboard.
  if (session.mode === "ASSESSMENT") return;

  const ids = seasonalAwardsFor({
    topic: session.topic,
    // The grading time, not now: a session graded inside the window earns even
    // if this runs a moment after the season shuts.
    gradedAt: session.gradedAt,
  });
  if (ids.length === 0) return;

  const userId = session.userId;

  await Promise.all(
    ids.map((badgeId) =>
      prisma.earnedBadge.upsert({
        where: { userId_badgeId: { userId, badgeId } },
        // Keeps the original earnedAt: the first time is the time that counts.
        update: {},
        create: { userId, badgeId, sessionId },
      }),
    ),
  );
}

/** Badge ids this user has captured. */
export async function listEarnedBadgeIds(userId: string): Promise<Set<string>> {
  const rows = await prisma.earnedBadge.findMany({
    where: { userId },
    select: { badgeId: true },
  });
  return new Set(rows.map((row) => row.badgeId));
}
