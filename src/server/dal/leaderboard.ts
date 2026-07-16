import "server-only";
import { prisma } from "@/lib/db";
import type { Viewer } from "@/server/dal/owner";

/**
 * Difficulty weights. Average score alone would be topped by whoever only ever
 * takes five-question EASY quizzes, so points scale with how hard the thing
 * was and how much of it there was.
 *
 * points(session) = score% × multiplier × (questions ÷ 10)
 */
export const DIFFICULTY_MULTIPLIER = {
  BEGINNER: 0.5,
  EASY: 1,
  MEDIUM: 1.5,
  HARD: 2,
  EXPERT: 3,
} as const;

/** Below this, one lucky session would put a stranger at the top of the page. */
const MIN_SESSIONS = 1;

export type LeaderboardRow = {
  rank: number;
  userId: string;
  name: string;
  points: number;
  sessions: number;
  averageScore: number;
  bestTopic: string | null;
};

type RawRow = {
  userId: string;
  name: string;
  points: number;
  sessions: bigint;
  averageScore: number;
};

/**
 * The public board.
 *
 * Only signed-in users with GRADED sessions who have not opted out. Anonymous
 * interviews can never appear: they have no identity attached, by design.
 *
 * Aggregated in SQL rather than in JS — this is a public page and pulling every
 * graded session in the system into memory to sum it would not survive a real
 * user count. `banned` users are excluded: a banned account should not keep a
 * trophy on a page everyone can see.
 */
export async function getLeaderboard(limit = 50): Promise<LeaderboardRow[]> {
  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT
      s."userId"                                   AS "userId",
      u."name"                                     AS "name",
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
      )::float                                     AS "points",
      COUNT(*)                                     AS "sessions",
      AVG(s."score")::float                        AS "averageScore"
    FROM interview_session s
    JOIN "user" u ON u."id" = s."userId"
    WHERE s."status" = 'GRADED'
      AND s."score" IS NOT NULL
      AND s."userId" IS NOT NULL
      -- Screening attempts are a recruiter's private process, not play.
      AND s."mode" != 'SCREEN'
      AND u."leaderboardOptOut" = false
      AND COALESCE(u."banned", false) = false
    GROUP BY s."userId", u."name"
    HAVING COUNT(*) >= ${MIN_SESSIONS}
    ORDER BY "points" DESC, "sessions" ASC
    LIMIT ${limit}
  `;

  return rows.map((row, i) => ({
    rank: i + 1,
    userId: row.userId,
    name: row.name,
    // Points are a game score, not a measurement: a whole number reads better
    // and nobody is served by "1240.7381".
    points: Math.round(row.points),
    sessions: Number(row.sessions),
    averageScore: Math.round(row.averageScore * 10) / 10,
    bestTopic: null,
  }));
}

export type ViewerStanding = {
  rank: number | null;
  points: number;
  sessions: number;
  optedOut: boolean;
};

/**
 * Where the viewer sits, so someone outside the top 50 still sees their own
 * standing rather than a page that pretends they do not exist.
 */
export async function getViewerStanding(
  viewer: Viewer,
): Promise<ViewerStanding | null> {
  if (viewer.kind !== "user") return null;

  const user = await prisma.user.findUnique({
    where: { id: viewer.userId },
    select: { leaderboardOptOut: true },
  });
  if (!user) return null;

  const rows = await prisma.$queryRaw<
    { points: number; sessions: bigint; rank: bigint }[]
  >`
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
        ) AS points,
        COUNT(*) AS sessions
      FROM interview_session s
      JOIN "user" u ON u."id" = s."userId"
      WHERE s."status" = 'GRADED'
        AND s."score" IS NOT NULL
        AND s."userId" IS NOT NULL
        AND s."mode" != 'SCREEN'
        AND u."leaderboardOptOut" = false
        AND COALESCE(u."banned", false) = false
      GROUP BY s."userId"
    )
    SELECT
      points::float AS points,
      sessions,
      RANK() OVER (ORDER BY points DESC) AS rank
    FROM totals
    WHERE uid = ${viewer.userId}
  `;

  const row = rows[0];

  // No row means they are opted out, banned, or have not finished anything yet.
  if (!row) {
    return {
      rank: null,
      points: 0,
      sessions: 0,
      optedOut: user.leaderboardOptOut,
    };
  }

  return {
    rank: Number(row.rank),
    points: Math.round(row.points),
    sessions: Number(row.sessions),
    optedOut: user.leaderboardOptOut,
  };
}
