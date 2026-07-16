import "server-only";
import { prisma } from "@/lib/db";
import type { Difficulty } from "@/lib/schemas";
import { DIFFICULTY_MULTIPLIER } from "@/server/dal/leaderboard";
import { ownerWhere, type Viewer } from "@/server/dal/owner";
import { computeStreaks, utcDayIndex } from "@/server/learning/momentum";
import { addDays } from "@/server/learning/scheduling";

/**
 * Reads for the learning loop: the review queue, the concept mastery map, and
 * the streak/XP momentum tiles.
 *
 * Everything here is owner-scoped through ownerWhere() and returns the empty
 * shape for an anonymous viewer — there is no guest identity, so there is
 * nothing to aggregate. Like analytics.ts, these must be safe on their own:
 * the dashboard layout redirects anonymous visitors, but layout and page render
 * in parallel, so a query can be in flight before the redirect wins.
 */

/** A score at or above this is "right" — matches analytics.ts and the result page. */
const CORRECT_AT = 80;

// ---------------------------------------------------------------------------
// Review queue
// ---------------------------------------------------------------------------

export type ReviewItemRow = {
  id: string;
  concept: string;
  topic: string;
  difficulty: Difficulty;
  stage: number;
  lapses: number;
  dueAt: Date;
};

export type ReviewQueue = {
  due: ReviewItemRow[];
  /** Active items not yet due, within the next 7 days. */
  upcoming: ReviewItemRow[];
  dueCount: number;
  upcomingCount: number;
  retiredCount: number;
};

const reviewItemSelect = {
  id: true,
  concept: true,
  topic: true,
  difficulty: true,
  stage: true,
  lapses: true,
  dueAt: true,
} as const;

/** The full picture for the review page. */
export async function getReviewQueue(viewer: Viewer): Promise<ReviewQueue> {
  const owner = ownerWhere(viewer);
  if (!owner) {
    return {
      due: [],
      upcoming: [],
      dueCount: 0,
      upcomingCount: 0,
      retiredCount: 0,
    };
  }

  const now = new Date();
  const horizon = addDays(now, 7);

  const [due, upcoming, dueCount, upcomingCount, retiredCount] =
    await Promise.all([
      prisma.reviewItem.findMany({
        where: { userId: owner.userId, retired: false, dueAt: { lte: now } },
        orderBy: { dueAt: "asc" },
        take: 100,
        select: reviewItemSelect,
      }),
      prisma.reviewItem.findMany({
        where: {
          userId: owner.userId,
          retired: false,
          dueAt: { gt: now, lte: horizon },
        },
        orderBy: { dueAt: "asc" },
        take: 100,
        select: reviewItemSelect,
      }),
      prisma.reviewItem.count({
        where: { userId: owner.userId, retired: false, dueAt: { lte: now } },
      }),
      prisma.reviewItem.count({
        where: {
          userId: owner.userId,
          retired: false,
          dueAt: { gt: now, lte: horizon },
        },
      }),
      prisma.reviewItem.count({
        where: { userId: owner.userId, retired: true },
      }),
    ]);

  return { due, upcoming, dueCount, upcomingCount, retiredCount };
}

/** Just the due-now count — for the dashboard card and its tile. */
export async function getDueReviewCount(viewer: Viewer): Promise<number> {
  const owner = ownerWhere(viewer);
  if (!owner) return 0;

  return prisma.reviewItem.count({
    where: { userId: owner.userId, retired: false, dueAt: { lte: new Date() } },
  });
}

// ---------------------------------------------------------------------------
// Momentum: streaks + XP
// ---------------------------------------------------------------------------

export type Momentum = {
  currentStreak: number;
  longestStreak: number;
  /** Leaderboard points formula, rounded for display. */
  xp: number;
};

/**
 * Streak and XP for the dashboard tiles.
 *
 * Both derive from the same per-user pull of graded sessions — bounded by one
 * user's history, so this is not the "load the whole table" hazard the public
 * leaderboard guards against. XP reuses DIFFICULTY_MULTIPLIER exported from
 * leaderboard.ts so the two formulas can never drift; SCREEN sessions are
 * excluded because a candidate screen is not the user's own study.
 */
export async function getMomentum(viewer: Viewer): Promise<Momentum> {
  const owner = ownerWhere(viewer);
  if (!owner) return { currentStreak: 0, longestStreak: 0, xp: 0 };

  const sessions = await prisma.interviewSession.findMany({
    where: {
      userId: owner.userId,
      status: "GRADED",
      score: { not: null },
      gradedAt: { not: null },
      mode: { not: "SCREEN" },
    },
    select: {
      gradedAt: true,
      score: true,
      difficulty: true,
      questionCount: true,
    },
  });

  let xp = 0;
  const dayIndices: number[] = [];
  for (const session of sessions) {
    xp +=
      Number(session.score) *
      DIFFICULTY_MULTIPLIER[session.difficulty] *
      (session.questionCount / 10);
    if (session.gradedAt) dayIndices.push(utcDayIndex(session.gradedAt));
  }

  const { current, longest } = computeStreaks(
    dayIndices,
    utcDayIndex(new Date()),
  );

  return { currentStreak: current, longestStreak: longest, xp: Math.round(xp) };
}

// ---------------------------------------------------------------------------
// Mastery map
// ---------------------------------------------------------------------------

export type ConceptMastery = {
  concept: string;
  attempts: number;
  correct: number;
  /** 0-100. */
  correctRate: number;
  averageScore: number;
  lastSeen: Date;
  topics: string[];
  /** True when an active (non-retired) ReviewItem exists for this concept. */
  dueForReview: boolean;
};

export type TopicMastery = {
  topic: string;
  attempts: number;
  correct: number;
  correctRate: number;
  averageScore: number;
  /** Distinct concepts seen under the topic. */
  concepts: number;
  /** Most recent difficulty practised — the base rung for a plan suggestion. */
  difficulty: Difficulty;
};

export type Mastery = {
  concepts: ConceptMastery[];
  topics: TopicMastery[];
};

type ConceptRow = {
  concept: string;
  attempts: number;
  correct: number;
  avg_score: number;
  last_seen: Date;
  topics: string[];
};

type TopicRow = {
  topic: string;
  attempts: number;
  correct: number;
  avg_score: number;
  concepts: number;
  difficulty: Difficulty;
};

/**
 * The concept and topic mastery rollups.
 *
 * Raw SQL for the same reason analytics.ts is: `concepts` is a String[] that
 * has to be unnested one row per (question, concept) pair, and the score lives
 * on Answer while the tag lives on Question — a join Prisma's groupBy cannot
 * express. userId is a bound parameter; nothing user-typed is concatenated.
 * SCREEN sessions are excluded — a screen is not the user's own study record.
 */
export async function getMastery(viewer: Viewer): Promise<Mastery> {
  const owner = ownerWhere(viewer);
  if (!owner) return { concepts: [], topics: [] };

  const [conceptRows, topicRows, activeConcepts] = await Promise.all([
    prisma.$queryRaw<ConceptRow[]>`
      SELECT c.concept                                          AS concept,
             COUNT(*)::int                                      AS attempts,
             COUNT(*) FILTER (WHERE a.score >= ${CORRECT_AT})::int AS correct,
             AVG(a.score)::float8                               AS avg_score,
             MAX(s."gradedAt")                                  AS last_seen,
             array_agg(DISTINCT s.topic)                        AS topics
      FROM question q
      JOIN answer a ON a."questionId" = q.id
      JOIN interview_session s ON s.id = q."sessionId"
      CROSS JOIN LATERAL unnest(q.concepts) AS c(concept)
      WHERE s."userId" = ${owner.userId}
        AND s.status = 'GRADED'
        AND s.mode <> 'SCREEN'
        AND a.score IS NOT NULL
      GROUP BY c.concept
      ORDER BY (COUNT(*) FILTER (WHERE a.score >= ${CORRECT_AT})::float8 / COUNT(*)) ASC,
               attempts DESC,
               concept ASC
    `,
    prisma.$queryRaw<TopicRow[]>`
      SELECT s.topic                                            AS topic,
             COUNT(*)::int                                      AS attempts,
             COUNT(*) FILTER (WHERE a.score >= ${CORRECT_AT})::int AS correct,
             AVG(a.score)::float8                               AS avg_score,
             COUNT(DISTINCT c.concept)::int                     AS concepts,
             (array_agg(s."difficulty" ORDER BY s."gradedAt" DESC))[1] AS difficulty
      FROM question q
      JOIN answer a ON a."questionId" = q.id
      JOIN interview_session s ON s.id = q."sessionId"
      LEFT JOIN LATERAL unnest(q.concepts) AS c(concept) ON true
      WHERE s."userId" = ${owner.userId}
        AND s.status = 'GRADED'
        AND s.mode <> 'SCREEN'
        AND a.score IS NOT NULL
      GROUP BY s.topic
      ORDER BY (COUNT(*) FILTER (WHERE a.score >= ${CORRECT_AT})::float8 / COUNT(*)) ASC,
               attempts DESC
    `,
    prisma.reviewItem.findMany({
      where: { userId: owner.userId, retired: false },
      select: { concept: true },
      distinct: ["concept"],
    }),
  ]);

  const active = new Set(activeConcepts.map((row) => row.concept));

  return {
    concepts: conceptRows.map((row) => ({
      concept: row.concept,
      attempts: row.attempts,
      correct: row.correct,
      correctRate: row.attempts === 0 ? 0 : (row.correct / row.attempts) * 100,
      averageScore: row.avg_score ?? 0,
      lastSeen: row.last_seen,
      topics: row.topics ?? [],
      dueForReview: active.has(row.concept),
    })),
    topics: topicRows.map((row) => ({
      topic: row.topic,
      attempts: row.attempts,
      correct: row.correct,
      correctRate: row.attempts === 0 ? 0 : (row.correct / row.attempts) * 100,
      averageScore: row.avg_score ?? 0,
      concepts: row.concepts,
      difficulty: row.difficulty,
    })),
  };
}
