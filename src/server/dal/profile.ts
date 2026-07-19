import "server-only";
import { prisma } from "@/lib/db";
import type { Difficulty } from "@/lib/schemas";
import { DIFFICULTY_MULTIPLIER } from "@/server/dal/leaderboard";
import {
  type ActivityCalendar,
  buildActivityCalendar,
} from "@/server/learning/activity";
import { listEarnedBadgeIds } from "@/server/learning/awards";
import {
  BADGE_COUNT,
  type Badge,
  earnedCount,
  evaluateBadges,
} from "@/server/learning/badges";
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
const RECENT_RUNS = 5;
const TOP_TOPICS = 5;
const TREND_RUNS = 20;
const STRONG_CONCEPTS = 8;
/** A topic needs at least this many attempts before it can be a "top" topic. */
const MIN_TOPIC_ATTEMPTS = 2;
/** Same floor, for concepts: one lucky question is not a strength. */
const MIN_CONCEPT_ATTEMPTS = 2;
/** A per-answer score at or above this is "right" — matches learning.ts. */
const CORRECT_AT = 80;
/**
 * A concept is only a "strength" once it is right this often. 0.6 rather than
 * 0.5 because 60 is the pass mark submitSession already uses — listing a
 * coin-flip concept under "strongest" reads as a bug, not a boast.
 */
const STRENGTH_FLOOR = 0.6;

/** Rungs low-to-high, so the spread reads as a ramp rather than by frequency. */
const DIFFICULTY_ORDER = [
  "BEGINNER",
  "EASY",
  "MEDIUM",
  "HARD",
  "EXPERT",
] as const satisfies readonly Difficulty[];

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

export type ProfileTrendPoint = {
  sessionId: string;
  topic: string;
  difficulty: Difficulty;
  score: number;
  gradedAt: Date;
};

export type ProfileDifficulty = {
  difficulty: Difficulty;
  count: number;
  /** Percentage of all graded runs at this rung. */
  share: number;
};

export type ProfileConcept = {
  concept: string;
  attempts: number;
  /** 0–100. */
  correctRate: number;
};

export type PublicProfile = {
  visibility: "public";
  /** Needed to resolve follow state. Not a secret — the handle already names them. */
  userId: string;
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
  /** Runs scored 100. */
  perfectCount: number;
  averageScore: number | null;
  calendar: ActivityCalendar;
  bestRuns: ProfileRun[];
  recentRuns: ProfileRun[];
  topTopics: ProfileTopic[];
  /** Oldest-first: a line chart reads left-to-right in time. */
  trend: ProfileTrendPoint[];
  difficultySpread: ProfileDifficulty[];
  /** Strengths only — see strongestConcepts() for why. */
  strongConcepts: ProfileConcept[];
  badges: Badge[];
  badgesEarned: number;
  badgeTotal: number;
};

export type PrivateProfile = {
  visibility: "private";
  userId: string;
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

  // The account's name is the heading; the handle already has its own line
  // underneath. This used to prefer displayUsername, so a profile printed the
  // same handle twice and the person's actual name appeared nowhere.
  const displayName = user.name?.trim() || user.displayUsername || username;

  // Cased handle where one exists — `username` is normalised lowercase, and
  // someone who typed MixedCase should see it back.
  const handle = user.displayUsername?.trim() || user.username || username;

  // Opted out → the handle exists but the profile is private.
  if (user.leaderboardOptOut) {
    return {
      visibility: "private",
      userId: user.id,
      username: handle,
      displayName,
    };
  }

  const todayIndex = utcDayIndex(new Date());
  const since = new Date((todayIndex - CALENDAR_WEEKS * 7) * 86_400_000);

  const [
    sessions,
    windowSessions,
    rank,
    retiredReviews,
    strongConcepts,
    captured,
  ] = await Promise.all([
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
        mode: true,
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
    prisma.reviewItem.count({ where: { userId: user.id, retired: true } }),
    strongestConcepts(user.id),
    listEarnedBadgeIds(user.id),
  ]);

  let xp = 0;
  let scoreSum = 0;
  let perfectCount = 0;
  let hardCount = 0;
  let dailyCount = 0;
  const dayIndices: number[] = [];
  const topicAgg = new Map<string, { sum: number; count: number }>();
  const byDifficulty = new Map<Difficulty, number>();

  for (const s of sessions) {
    const score = Number(s.score);
    xp += score * DIFFICULTY_MULTIPLIER[s.difficulty] * (s.questionCount / 10);
    scoreSum += score;
    if (score >= 100) perfectCount++;
    if (s.difficulty === "HARD" || s.difficulty === "EXPERT") hardCount++;
    if (s.mode === "DAILY") dailyCount++;
    if (s.gradedAt) dayIndices.push(utcDayIndex(s.gradedAt));

    byDifficulty.set(s.difficulty, (byDifficulty.get(s.difficulty) ?? 0) + 1);

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
    .map(toRun);

  const topTopics: ProfileTopic[] = [...topicAgg.entries()]
    .filter(([, a]) => a.count >= MIN_TOPIC_ATTEMPTS)
    .map(([topic, a]) => ({
      topic,
      averageScore: Math.round((a.sum / a.count) * 10) / 10,
      attempts: a.count,
    }))
    .sort((a, b) => b.averageScore - a.averageScore)
    .slice(0, TOP_TOPICS);

  // Most recent first everywhere else; the trend reads left-to-right in time,
  // so it is the only list that gets reversed.
  const recentRuns: ProfileRun[] = sessions.slice(0, RECENT_RUNS).map(toRun);

  const trend: ProfileTrendPoint[] = sessions
    .slice(0, TREND_RUNS)
    .reverse()
    .map((s) => ({
      sessionId: s.id,
      topic: s.topic,
      difficulty: s.difficulty,
      score: Number(s.score),
      gradedAt: s.gradedAt as Date,
    }));

  const difficultySpread: ProfileDifficulty[] = DIFFICULTY_ORDER.filter(
    (d) => (byDifficulty.get(d) ?? 0) > 0,
  ).map((difficulty) => {
    const count = byDifficulty.get(difficulty) ?? 0;
    return {
      difficulty,
      count,
      share: sessions.length === 0 ? 0 : (count / sessions.length) * 100,
    };
  });

  const level = levelProgress(Math.round(xp));

  const badges = evaluateBadges(
    {
      gradedCount: sessions.length,
      currentStreak: current,
      longestStreak: longest,
      xp: level.xp,
      level: level.level,
      perfectCount,
      topicCount: topicAgg.size,
      hardCount,
      retiredReviews,
      dailyCount,
    },
    captured,
  );

  return {
    visibility: "public",
    userId: user.id,
    username: handle,
    displayName,
    image: user.image,
    joinedAt: user.createdAt,
    currentStreak: current,
    longestStreak: longest,
    xp: Math.round(xp),
    level,
    rank,
    gradedCount: sessions.length,
    perfectCount,
    averageScore:
      sessions.length === 0
        ? null
        : Math.round((scoreSum / sessions.length) * 10) / 10,
    calendar: buildActivityCalendar(counts, todayIndex, CALENDAR_WEEKS),
    bestRuns,
    recentRuns,
    topTopics,
    trend,
    difficultySpread,
    strongConcepts,
    badges,
    badgesEarned: earnedCount(badges),
    badgeTotal: BADGE_COUNT,
  };
}

function toRun(s: {
  id: string;
  topic: string;
  difficulty: Difficulty;
  score: unknown;
  gradedAt: Date | null;
}): ProfileRun {
  return {
    id: s.id,
    topic: s.topic,
    difficulty: s.difficulty,
    score: Number(s.score),
    gradedAt: s.gradedAt as Date,
  };
}

type ConceptRow = { concept: string; attempts: number; correct_rate: number };

/**
 * The concepts this person gets right most often.
 *
 * Strengths only, and that asymmetry is the point: the mastery map on the
 * dashboard is weakest-first because it is a study tool for the person who owns
 * it. A public page is not the place to publish what someone keeps getting
 * wrong, so nothing here is sorted or filtered by failure.
 *
 * Raw SQL for the same reason getMastery is: `concepts` is a String[] needing
 * one row per (question, concept), and the score lives on Answer while the tag
 * lives on Question. userId is a bound parameter.
 */
async function strongestConcepts(userId: string): Promise<ProfileConcept[]> {
  const rows = await prisma.$queryRaw<ConceptRow[]>`
    SELECT c.concept                                       AS concept,
           COUNT(*)::int                                   AS attempts,
           (COUNT(*) FILTER (WHERE a.score >= ${CORRECT_AT})::float8
             / COUNT(*)) * 100                             AS correct_rate
    FROM question q
    JOIN answer a ON a."questionId" = q.id
    JOIN interview_session s ON s.id = q."sessionId"
    CROSS JOIN LATERAL unnest(q.concepts) AS c(concept)
    WHERE s."userId" = ${userId}
      AND s.status = 'GRADED'
      AND s.mode <> 'ASSESSMENT'
      AND a.score IS NOT NULL
    GROUP BY c.concept
    HAVING COUNT(*) >= ${MIN_CONCEPT_ATTEMPTS}
       AND (COUNT(*) FILTER (WHERE a.score >= ${CORRECT_AT})::float8
             / COUNT(*)) >= ${STRENGTH_FLOOR}
    ORDER BY correct_rate DESC, attempts DESC, concept ASC
    LIMIT ${STRONG_CONCEPTS}
  `;

  return rows.map((r) => ({
    concept: r.concept,
    attempts: r.attempts,
    correctRate: r.correct_rate,
  }));
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
