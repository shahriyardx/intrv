import "server-only";
import { prisma } from "@/lib/db";
import type { Difficulty, QuestionType } from "@/lib/schemas";
import {
  type ClientQuestion,
  clientQuestionSelect,
  toClientQuestion,
} from "@/server/dal/dto";
import { ownerWhere, type Viewer } from "@/server/dal/owner";

/**
 * Aggregates over a signed-in user's history.
 *
 * Every function here is owner-scoped through ownerWhere() and returns the
 * empty shape for an anonymous viewer: there is no guest identity, so there is
 * nothing to aggregate. The dashboard layout redirects anonymous visitors, but
 * layouts and pages render in parallel — these queries must be safe on their
 * own rather than trusting that the redirect won already.
 *
 * Rollups are computed in Postgres. Pulling every answer into JS to count them
 * would grow linearly with a user's history for numbers that GROUP BY produces
 * in one pass.
 */

/** A score at or above this is "right". Matches the result page's verdict. */
const CORRECT_AT = 80;

/**
 * Only GRADED sessions carry a trustworthy score, and never a screening.
 *
 * ASSESSMENT is excluded from every read in this file for the same reason it is
 * excluded from the leaderboard, XP and the learning loop: a screening attempt
 * is a recruiter's private process, not the candidate's own practice. Leaving it
 * in meant a candidate's personal average, weak concepts and mistakes were all
 * polluted by an interview someone else set them — and, worse, those mistakes
 * could never be dismissed, because scheduleReviews skips ASSESSMENT and so no
 * ReviewItem ever existed to retire.
 */
const gradedSession = {
  status: "GRADED" as const,
  score: { not: null },
  mode: { not: "ASSESSMENT" as const },
};

/** The same exclusion for queries that don't need a score to be present. */
const ownPractice = { mode: { not: "ASSESSMENT" as const } };

export type ConceptAccuracy = {
  concept: string;
  /** Answered questions tagged with this concept. */
  total: number;
  correct: number;
  /** 0-100. */
  accuracy: number;
  averageScore: number;
};

export type TopicPerformance = {
  topic: string;
  attempts: number;
  averageScore: number;
};

export type TypeAccuracy = {
  type: QuestionType;
  total: number;
  correct: number;
  accuracy: number;
  averageScore: number;
};

export type TrendPoint = {
  sessionId: string;
  topic: string;
  difficulty: Difficulty;
  score: number;
  gradedAt: Date;
};

export type OverviewStats = {
  /** Every session they started, including ones they never finished. */
  totalSessions: number;
  gradedSessions: number;
  /** Mean of graded session scores, or null when nothing is graded yet. */
  averageScore: number | null;
  bestScore: number | null;
  questionsAnswered: number;
  bestTopic: TopicPerformance | null;
};

/**
 * Postgres returns `count(*)` as bigint and `numeric` as a string; both arrive
 * over the driver as something JSON can't serialize to a React client. Casting
 * inside SQL (`::int`, `::float8`) is what keeps these rows plain numbers.
 */
type ConceptRow = {
  concept: string;
  total: number;
  correct: number;
  avg_score: number;
};

/**
 * Per-concept accuracy across the user's graded history.
 *
 * `concepts` is a String[] column, so the rollup needs one row per (question,
 * concept) pair — that is what the LATERAL unnest does. Prisma's groupBy cannot
 * express it and cannot join Answer to Question either, so this one is raw. The
 * userId is a bound parameter: $queryRaw's tagged template parameterises every
 * interpolation, and nothing user-typed is ever concatenated into the string.
 *
 * @param minTotal drop concepts seen too rarely to mean anything. A single
 * missed question is noise, not a weakness.
 */
export async function getConceptAccuracy(
  viewer: Viewer,
  opts: { limit?: number; minTotal?: number } = {},
): Promise<ConceptAccuracy[]> {
  const owner = ownerWhere(viewer);
  if (!owner) return [];

  const limit = Math.min(opts.limit ?? 12, 50);
  const minTotal = opts.minTotal ?? 1;

  const rows = await prisma.$queryRaw<ConceptRow[]>`
    SELECT c.concept AS concept,
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE a.score >= ${CORRECT_AT})::int AS correct,
           AVG(a.score)::float8 AS avg_score
    FROM question q
    JOIN answer a ON a."questionId" = q.id
    JOIN interview_session s ON s.id = q."sessionId"
    CROSS JOIN LATERAL unnest(q.concepts) AS c(concept)
    WHERE s."userId" = ${owner.userId}
      AND s.status = 'GRADED'
      AND s.mode <> 'ASSESSMENT'
      AND a.score IS NOT NULL
    GROUP BY c.concept
    HAVING COUNT(*) >= ${minTotal}
    ORDER BY total DESC, concept ASC
    LIMIT ${limit}
  `;

  return rows.map(toConceptAccuracy);
}

/**
 * The concepts they get wrong most often — the dashboard's actual advice.
 *
 * Ordered by accuracy, not by miss count: 3 missed out of 4 is a worse weakness
 * than 4 missed out of 20, and a "study this next" list that ranks by raw
 * misses just surfaces whatever they happened to practise most.
 */
export async function getWeakConcepts(
  viewer: Viewer,
  opts: { limit?: number; minTotal?: number } = {},
): Promise<ConceptAccuracy[]> {
  const owner = ownerWhere(viewer);
  if (!owner) return [];

  const limit = Math.min(opts.limit ?? 5, 50);
  const minTotal = opts.minTotal ?? 2;

  const rows = await prisma.$queryRaw<ConceptRow[]>`
    SELECT c.concept AS concept,
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE a.score >= ${CORRECT_AT})::int AS correct,
           AVG(a.score)::float8 AS avg_score
    FROM question q
    JOIN answer a ON a."questionId" = q.id
    JOIN interview_session s ON s.id = q."sessionId"
    CROSS JOIN LATERAL unnest(q.concepts) AS c(concept)
    WHERE s."userId" = ${owner.userId}
      AND s.status = 'GRADED'
      AND s.mode <> 'ASSESSMENT'
      AND a.score IS NOT NULL
    GROUP BY c.concept
    HAVING COUNT(*) >= ${minTotal}
       AND COUNT(*) FILTER (WHERE a.score >= ${CORRECT_AT}) < COUNT(*)
    ORDER BY (COUNT(*) FILTER (WHERE a.score >= ${CORRECT_AT})::float8 / COUNT(*)) ASC,
             total DESC
    LIMIT ${limit}
  `;

  return rows.map(toConceptAccuracy);
}

function toConceptAccuracy(row: ConceptRow): ConceptAccuracy {
  return {
    concept: row.concept,
    total: row.total,
    correct: row.correct,
    accuracy: row.total === 0 ? 0 : (row.correct / row.total) * 100,
    averageScore: row.avg_score ?? 0,
  };
}

type TypeRow = {
  type: QuestionType;
  total: number;
  correct: number;
  avg_score: number;
};

/**
 * Accuracy by question type. Raw for the same reason as concepts: the type is
 * on Question and the score is on Answer, which Prisma's groupBy cannot join.
 */
export async function getTypeAccuracy(viewer: Viewer): Promise<TypeAccuracy[]> {
  const owner = ownerWhere(viewer);
  if (!owner) return [];

  const rows = await prisma.$queryRaw<TypeRow[]>`
    SELECT q.type::text AS type,
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE a.score >= ${CORRECT_AT})::int AS correct,
           AVG(a.score)::float8 AS avg_score
    FROM question q
    JOIN answer a ON a."questionId" = q.id
    JOIN interview_session s ON s.id = q."sessionId"
    WHERE s."userId" = ${owner.userId}
      AND s.status = 'GRADED'
      AND s.mode <> 'ASSESSMENT'
      AND a.score IS NOT NULL
    GROUP BY q.type
    ORDER BY total DESC
  `;

  return rows.map((row) => ({
    type: row.type,
    total: row.total,
    correct: row.correct,
    accuracy: row.total === 0 ? 0 : (row.correct / row.total) * 100,
    averageScore: row.avg_score ?? 0,
  }));
}

/** Average score per topic. Topics are free text, so they group exactly as typed. */
export async function getTopicPerformance(
  viewer: Viewer,
  opts: { limit?: number } = {},
): Promise<TopicPerformance[]> {
  const owner = ownerWhere(viewer);
  if (!owner) return [];

  const rows = await prisma.interviewSession.groupBy({
    by: ["topic"],
    where: { ...owner, ...gradedSession },
    _avg: { score: true },
    _count: { _all: true },
    orderBy: { _count: { topic: "desc" } },
    take: Math.min(opts.limit ?? 10, 50),
  });

  return rows.map((row) => ({
    topic: row.topic,
    attempts: row._count._all,
    averageScore: Number(row._avg.score ?? 0),
  }));
}

/** Score over time, oldest first — the shape a trend line wants. */
export async function getScoreTrend(
  viewer: Viewer,
  opts: { limit?: number } = {},
): Promise<TrendPoint[]> {
  const owner = ownerWhere(viewer);
  if (!owner) return [];

  // Take the most recent N, then flip: a trend of the *first* 30 sessions is
  // not what anyone means by "how am I doing".
  const rows = await prisma.interviewSession.findMany({
    where: { ...owner, ...gradedSession, gradedAt: { not: null } },
    orderBy: { gradedAt: "desc" },
    take: Math.min(opts.limit ?? 30, 100),
    select: {
      id: true,
      topic: true,
      difficulty: true,
      score: true,
      gradedAt: true,
    },
  });

  return rows
    .map((row) => ({
      sessionId: row.id,
      topic: row.topic,
      difficulty: row.difficulty,
      score: Number(row.score),
      // Narrowed by the `gradedAt: { not: null }` filter above.
      gradedAt: row.gradedAt as Date,
    }))
    .reverse();
}

/** The overview tiles. One round trip per number, all issued in parallel. */
export async function getOverviewStats(viewer: Viewer): Promise<OverviewStats> {
  const owner = ownerWhere(viewer);
  if (!owner) {
    return {
      totalSessions: 0,
      gradedSessions: 0,
      averageScore: null,
      bestScore: null,
      questionsAnswered: 0,
      bestTopic: null,
    };
  }

  const [totalSessions, graded, questionsAnswered, topics] = await Promise.all([
    // Failed generations are deleted at the source, but exclude them here too so
    // a legacy or mid-flight FAILED row never inflates "interviews taken".
    prisma.interviewSession.count({
      where: { ...owner, ...ownPractice, status: { not: "FAILED" } },
    }),
    prisma.interviewSession.aggregate({
      where: { ...owner, ...gradedSession },
      _avg: { score: true },
      _max: { score: true },
      _count: { _all: true },
    }),
    prisma.answer.count({
      where: {
        question: { session: { ...owner, ...ownPractice, status: "GRADED" } },
      },
    }),
    // Ranked here rather than in SQL: the list is already capped at 10 topics,
    // and "best" needs a minimum-attempts rule that ORDER BY can't express as
    // honestly.
    getTopicPerformance(viewer, { limit: 10 }),
  ]);

  return {
    totalSessions,
    gradedSessions: graded._count._all,
    averageScore: graded._avg.score === null ? null : Number(graded._avg.score),
    bestScore: graded._max.score === null ? null : Number(graded._max.score),
    questionsAnswered,
    bestTopic: pickBestTopic(topics),
  };
}

/**
 * A "best topic" off a single lucky attempt is a lie the tiles would tell every
 * new user. Prefer a topic they've actually practised; fall back to a single
 * attempt only when that is all the history there is.
 */
function pickBestTopic(topics: TopicPerformance[]): TopicPerformance | null {
  if (topics.length === 0) return null;

  const repeated = topics.filter((t) => t.attempts > 1);
  const pool = repeated.length > 0 ? repeated : topics;

  return pool.reduce((best, t) =>
    t.averageScore > best.averageScore ? t : best,
  );
}

export type TypeMix = { type: QuestionType; count: number }[];

/**
 * The question-type breakdown for a page of sessions, keyed by session id.
 *
 * Batched deliberately: the history table renders one of these per row, and
 * asking per row is the N+1 that turns a 20-row page into 21 round trips. The
 * session ids come from a listing this viewer already owns, and the where
 * clause re-scopes them to the owner anyway — an id from another user's
 * history would match nothing.
 */
export async function getTypeMixBySession(
  viewer: Viewer,
  sessionIds: string[],
): Promise<Map<string, TypeMix>> {
  const owner = ownerWhere(viewer);
  if (!owner || sessionIds.length === 0) return new Map();

  const rows = await prisma.question.groupBy({
    by: ["sessionId", "type"],
    where: { sessionId: { in: sessionIds }, session: owner },
    _count: { _all: true },
  });

  const mix = new Map<string, TypeMix>();
  for (const row of rows) {
    const list = mix.get(row.sessionId) ?? [];
    list.push({ type: row.type, count: row._count._all });
    mix.set(row.sessionId, list);
  }

  for (const list of mix.values()) list.sort((a, b) => b.count - a.count);

  return mix;
}

export type Mistake = {
  question: ClientQuestion;
  sessionId: string;
  topic: string;
  difficulty: Difficulty;
  gradedAt: Date | null;
};

export type ConceptMistakes = {
  concept: string;
  mistakes: Mistake[];
};

/** Questions tagged with no concept still need somewhere to live. */
export const UNTAGGED_CONCEPT = "Untagged";

/**
 * Every question the user got wrong or only partly right, newest first.
 *
 * Capped: this is a study list, not an archive, and an unbounded findMany over
 * a heavy user's whole history is a page that eventually stops loading.
 */
export async function getMistakes(
  viewer: Viewer,
  opts: { limit?: number } = {},
): Promise<{ items: Mistake[]; capped: boolean }> {
  const owner = ownerWhere(viewer);
  if (!owner) return { items: [], capped: false };

  const limit = Math.min(opts.limit ?? 100, 200);

  const rows = await prisma.question.findMany({
    where: {
      session: { ...owner, ...ownPractice, status: "GRADED" },
      // `lt` on a null score matches nothing, so ungraded answers stay out —
      // an answer we failed to grade is not a mistake we can teach from.
      answer: { score: { lt: CORRECT_AT } },
    },
    orderBy: [{ session: { gradedAt: "desc" } }, { index: "asc" }],
    take: limit + 1,
    select: {
      ...clientQuestionSelect,
      sessionId: true,
      session: {
        select: { topic: true, difficulty: true, gradedAt: true },
      },
    },
  });

  const capped = rows.length > limit;

  const items = (capped ? rows.slice(0, limit) : rows).map((row) => ({
    // These sessions are GRADED, so the key and explanation are the point.
    // Still routed through the DTO — nothing else may serialize a Question.
    question: toClientQuestion(row, true),
    sessionId: row.sessionId,
    topic: row.session.topic,
    difficulty: row.session.difficulty,
    gradedAt: row.session.gradedAt,
  }));

  return { items, capped };
}

/**
 * Groups mistakes by concept, most-missed concept first.
 *
 * A question with several concepts appears under each of them: it is genuinely
 * evidence about all of them, and a student reviewing "closures" wants every
 * question that touched closures.
 */
export function groupMistakesByConcept(mistakes: Mistake[]): ConceptMistakes[] {
  const byConcept = new Map<string, Mistake[]>();

  for (const mistake of mistakes) {
    const concepts = mistake.question.concepts?.length
      ? mistake.question.concepts
      : [UNTAGGED_CONCEPT];

    for (const concept of concepts) {
      const list = byConcept.get(concept);
      if (list) list.push(mistake);
      else byConcept.set(concept, [mistake]);
    }
  }

  return [...byConcept.entries()]
    .map(([concept, items]) => ({ concept, mistakes: items }))
    .sort(
      (a, b) =>
        b.mistakes.length - a.mistakes.length ||
        a.concept.localeCompare(b.concept),
    );
}

export type AccountProfile = {
  name: string;
  email: string;
  createdAt: Date;
  /** Display-cased handle; the settings form shows this and the once-only flag. */
  username: string | null;
  usernameChanged: boolean;
  /** Drives the leaderboard toggle: the board is public and on by default. */
  leaderboardOptOut: boolean;
};

/** The settings page's own read. Scoped to the viewer, never to a passed-in id. */
export async function getAccountProfile(
  viewer: Viewer,
): Promise<AccountProfile | null> {
  if (viewer.kind !== "user") return null;

  const user = await prisma.user.findUnique({
    where: { id: viewer.userId },
    select: {
      name: true,
      email: true,
      createdAt: true,
      displayUsername: true,
      username: true,
      usernameChanged: true,
      leaderboardOptOut: true,
    },
  });

  if (!user) return null;

  return {
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    // Prefer the cased display handle; fall back to the normalized one.
    username: user.displayUsername ?? user.username,
    usernameChanged: user.usernameChanged,
    leaderboardOptOut: user.leaderboardOptOut,
  };
}
