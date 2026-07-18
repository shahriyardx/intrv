import "server-only";
import { prisma } from "@/lib/db";
import type { Difficulty } from "@/lib/schemas";
import { DIFFICULTY_MULTIPLIER } from "@/server/dal/leaderboard";
import {
  type ActivityCalendar,
  buildActivityCalendar,
} from "@/server/learning/activity";
import { type LevelProgress, levelProgress } from "@/server/learning/levels";
import { computeStreaks, utcDayIndex } from "@/server/learning/momentum";

/**
 * Public profile at /u/[username]. Anyone with the link may read it — no auth.
 *
 * Three outcomes:
 * - **null** — no such handle, or a banned account. The page calls notFound(),
 *   so a made-up handle and a banned one are indistinguishable (the /admin
 *   non-disclosure doctrine, applied to people).
 * - **private** — the account chose privacy (leaderboardOptOut). The handle is
 *   a public string, so we confirm it exists and show a "this profile is
 *   private" state rather than a 404 — but no stats.
 * - **public** — the full profile.
 *
 * ASSESSMENT sessions are excluded everywhere, exactly as on the leaderboard: a
 * screening attempt is a recruiter's private process, never a public stat.
 */

const CALENDAR_WEEKS = 53;
const BEST_RUNS = 5;
const TOP_TOPICS = 5;
/** A topic needs at least this many attempts before it can be a "top" topic. */
const MIN_TOPIC_ATTEMPTS = 2;

export type ProfileRun = {
  id: string;
  topic: string;
  difficulty: Difficulty;
  score: number;
  gradedAt: Date;
};

export type ProfileTopic = {
  topic: string;
  averageScore: number;
  attempts: number;
};

export type PublicProfile = {
  visibility: "public";
  username: string;
  displayName: string;
  image: string | null;
  joinedAt: Date;
  currentStreak: number;
  longestStreak: number;
  xp: number;
  /** Derived from xp by the same curve the dashboard uses. */
  level: LevelProgress;
  /** Global all-time leaderboard rank, or null below the ranking threshold. */
  rank: number | null;
  gradedCount: number;
  averageScore: number | null;
  calendar: ActivityCalendar;
  bestRuns: ProfileRun[];
  topTopics: ProfileTopic[];
};

export type PrivateProfile = {
  visibility: "private";
  username: string;
  displayName: string;
};

export type ProfileResult = PublicProfile | PrivateProfile;

export async function getPublicProfile(
  rawUsername: string,
): Promise<ProfileResult | null> {
  const username = rawUsername.trim().toLowerCase();
  if (!username) return null;

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      name: true,
      displayUsername: true,
      username: true,
      image: true,
      createdAt: true,
      banned: true,
      leaderboardOptOut: true,
    },
  });

  // Missing or banned → notFound (a banned account is not discoverable).
  if (!user || user.banned) return null;

  const displayName = user.displayUsername || user.name;

  // Opted out → the handle exists but the profile is private.
  if (user.leaderboardOptOut) {
    return {
      visibility: "private",
      username: user.username ?? username,
      displayName,
    };
  }

  const todayIndex = utcDayIndex(new Date());
  const since = new Date((todayIndex - CALENDAR_WEEKS * 7) * 86_400_000);

  const [sessions, windowSessions, rank] = await Promise.all([
    // All graded sessions — for streak, xp, best runs, top topics.
    prisma.interviewSession.findMany({
      where: {
        userId: user.id,
        status: "GRADED",
        score: { not: null },
        gradedAt: { not: null },
        mode: { not: "ASSESSMENT" },
      },
      select: {
        id: true,
        topic: true,
        difficulty: true,
        score: true,
        gradedAt: true,
        questionCount: true,
      },
      orderBy: { gradedAt: "desc" },
    }),
    // Only the heatmap window — a smaller pull keyed by day.
    prisma.interviewSession.findMany({
      where: {
        userId: user.id,
        status: "GRADED",
        gradedAt: { not: null, gte: since },
        mode: { not: "ASSESSMENT" },
      },
      select: { gradedAt: true },
    }),
    userRank(user.id),
  ]);

  let xp = 0;
  let scoreSum = 0;
  const dayIndices: number[] = [];
  const topicAgg = new Map<string, { sum: number; count: number }>();

  for (const s of sessions) {
    const score = Number(s.score);
    xp += score * DIFFICULTY_MULTIPLIER[s.difficulty] * (s.questionCount / 10);
    scoreSum += score;
    if (s.gradedAt) dayIndices.push(utcDayIndex(s.gradedAt));

    const agg = topicAgg.get(s.topic) ?? { sum: 0, count: 0 };
    agg.sum += score;
    agg.count += 1;
    topicAgg.set(s.topic, agg);
  }

  const { current, longest } = computeStreaks(dayIndices, todayIndex);

  const counts = new Map<number, number>();
  for (const s of windowSessions) {
    if (!s.gradedAt) continue;
    const day = utcDayIndex(s.gradedAt);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }

  const bestRuns: ProfileRun[] = [...sessions]
    .sort((a, b) => Number(b.score) - Number(a.score))
    .slice(0, BEST_RUNS)
    .map((s) => ({
      id: s.id,
      topic: s.topic,
      difficulty: s.difficulty,
      score: Number(s.score),
      gradedAt: s.gradedAt as Date,
    }));

  const topTopics: ProfileTopic[] = [...topicAgg.entries()]
    .filter(([, a]) => a.count >= MIN_TOPIC_ATTEMPTS)
    .map(([topic, a]) => ({
      topic,
      averageScore: Math.round((a.sum / a.count) * 10) / 10,
      attempts: a.count,
    }))
    .sort((a, b) => b.averageScore - a.averageScore)
    .slice(0, TOP_TOPICS);

  return {
    visibility: "public",
    username: user.username ?? username,
    displayName,
    image: user.image,
    joinedAt: user.createdAt,
    currentStreak: current,
    longestStreak: longest,
    xp: Math.round(xp),
    level: levelProgress(Math.round(xp)),
    rank,
    gradedCount: sessions.length,
    averageScore:
      sessions.length === 0
        ? null
        : Math.round((scoreSum / sessions.length) * 10) / 10,
    calendar: buildActivityCalendar(counts, todayIndex, CALENDAR_WEEKS),
    bestRuns,
    topTopics,
  };
}

/**
 * All-time global rank for one user, or null when they sit below the leaderboard
 * threshold or have no graded play. Same formula and filters as leaderboard.ts —
 * the CASE weights mirror DIFFICULTY_MULTIPLIER — so a profile and the board can
 * never disagree about someone's rank.
 */
async function userRank(userId: string): Promise<number | null> {
  const rows = await prisma.$queryRaw<{ rank: bigint }[]>`
    WITH totals AS (
      SELECT
        s."userId" AS uid,
        SUM(
          s."score"
          * CASE s."difficulty"
              WHEN 'BEGINNER' THEN 0.5
              WHEN 'EASY'     THEN 1.0
              WHEN 'MEDIUM'   THEN 1.5
              WHEN 'HARD'     THEN 2.0
              WHEN 'EXPERT'   THEN 3.0
              ELSE 1.0
            END
          * (s."questionCount"::numeric / 10)
        ) AS points
      FROM interview_session s
      JOIN "user" u ON u."id" = s."userId"
      WHERE s."status" = 'GRADED'
        AND s."score" IS NOT NULL
        AND s."userId" IS NOT NULL
        AND s."mode" != 'ASSESSMENT'
        AND u."leaderboardOptOut" = false
        AND COALESCE(u."banned", false) = false
      GROUP BY s."userId"
    )
    SELECT rank FROM (
      SELECT uid, RANK() OVER (ORDER BY points DESC) AS rank FROM totals
    ) ranked
    WHERE uid = ${userId}
  `;

  return rows[0] ? Number(rows[0].rank) : null;
}
