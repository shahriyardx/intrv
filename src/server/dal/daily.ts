import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { Difficulty } from "@/lib/schemas";
import { QUESTION_TYPES } from "@/lib/schemas";
import { generateQuestions } from "@/server/ai/generate";
import type { NormalizedQuestion } from "@/server/ai/schemas";
import { dailyTopicFor, dateKeyUTC } from "@/server/dal/daily-schedule";
import type { Viewer } from "@/server/dal/owner";

export { dailyTopicFor, dateKeyUTC } from "@/server/dal/daily-schedule";

/** Everyone gets the same set: ten mixed-type questions, ten minutes, MEDIUM. */
export const DAILY_QUESTION_COUNT = 10;
export const DAILY_DIFFICULTY: Difficulty = "MEDIUM";
export const DAILY_TIME_LIMIT_MS = 10 * 60_000;

/**
 * Arbitrary but fixed (classid, objid) pair the day's first visitors serialize
 * on while one of them writes the set. The int4 pair form avoids a BigInt
 * literal this tsconfig target cannot express; the admin claim uses (84749,
 * 2011), this is its neighbour. See claimAdminIfUnclaimed in admin.ts.
 */
const DAILY_CLAIM_LOCK = [84_749, 2_012] as const;

/**
 * A day's challenge with its frozen question set already parsed. The `questions`
 * array carries answer keys — this type is server-only and must never be
 * serialized to a client. The page reads only topic/difficulty/questionCount;
 * the start action reads `questions` to seed a playable session.
 */
export type DailyChallenge = {
  id: string;
  dateKey: string;
  topic: string;
  difficulty: Difficulty;
  questions: NormalizedQuestion[];
  questionCount: number;
  createdAt: Date;
};

type DailyRow = {
  id: string;
  dateKey: string;
  topic: string;
  difficulty: Difficulty;
  questions: Prisma.JsonValue;
  createdAt: Date;
};

function toChallenge(row: DailyRow): DailyChallenge {
  const questions = (row.questions as unknown as NormalizedQuestion[]) ?? [];
  return {
    id: row.id,
    dateKey: row.dateKey,
    topic: row.topic,
    difficulty: row.difficulty,
    questions,
    questionCount: questions.length,
    createdAt: row.createdAt,
  };
}

/**
 * Today's challenge if it already exists, else null. Read-only by design: a GET
 * on /daily must stay cheap, so the ~90s generation never runs at page-render
 * time. The first *player* triggers creation through the start action instead.
 */
export async function getTodayDailyChallenge(): Promise<DailyChallenge | null> {
  const row = await prisma.dailyChallenge.findUnique({
    where: { dateKey: dateKeyUTC() },
  });
  return row ? toChallenge(row) : null;
}

/**
 * Today's challenge, generating it once if it does not exist yet.
 *
 * Fast path is a plain lookup. Only when today is genuinely missing do we take
 * the advisory lock and generate — the same bootstrap pattern as the admin
 * claim, and for the same reason: under READ COMMITTED two simultaneous first
 * visitors would both find nothing and both generate, paying twice and racing
 * to insert a duplicate `dateKey`. The loser of the lock re-checks and returns
 * the winner's set.
 *
 * Generation runs *inside* the transaction, so the lock is held for its full
 * ~60-120s. That is the point: it happens at most once per UTC day, and every
 * other visitor either fast-paths or waits behind it exactly once. The
 * transaction timeout is raised to cover that window.
 */
export async function getOrCreateDailyChallenge(): Promise<DailyChallenge> {
  const dateKey = dateKeyUTC();

  const existing = await prisma.dailyChallenge.findUnique({
    where: { dateKey },
  });
  if (existing) return toChallenge(existing);

  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${DAILY_CLAIM_LOCK[0]}, ${DAILY_CLAIM_LOCK[1]})`;

      // Re-check under the lock: another visitor may have written it while we
      // waited to acquire the lock.
      const winner = await tx.dailyChallenge.findUnique({ where: { dateKey } });
      if (winner) return toChallenge(winner);

      const topic = dailyTopicFor(dateKey);
      const questions = await generateQuestions({
        topic,
        difficulty: DAILY_DIFFICULTY,
        types: [...QUESTION_TYPES],
        count: DAILY_QUESTION_COUNT,
      });

      if (questions.length === 0) {
        // Abort rather than persist an empty set: throwing rolls back the
        // transaction, releases the lock, and lets the next visitor retry.
        throw new Error("Daily challenge generation produced no questions.");
      }

      const created = await tx.dailyChallenge.create({
        data: {
          dateKey,
          topic,
          difficulty: DAILY_DIFFICULTY,
          questions: questions as unknown as Prisma.InputJsonValue,
        },
      });

      return toChallenge(created);
    },
    { timeout: 200_000, maxWait: 15_000 },
  );
}

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------

export type DailyStandingRow = {
  rank: number;
  sessionId: string;
  /** Already privacy-resolved: "Anonymous" for signed-out, opted-out, or banned. */
  name: string;
  score: number;
  /** Wall-clock time from start to submit, in ms. Null if timings are missing. */
  timeMs: number | null;
  isViewer: boolean;
};

export type DailyStanding = {
  rows: DailyStandingRow[];
  /** Total graded attempts at this challenge, not just the shown top slice. */
  attempts: number;
};

type RawStandingRow = {
  sessionId: string;
  userId: string | null;
  score: number;
  timeMs: number | null;
  userName: string | null;
  optOut: boolean | null;
  banned: boolean | null;
};

/**
 * Faster times win ties on equal scores, so the ranking key is (score desc,
 * time asc). Time is not a column — it is submit minus start — so this is a raw
 * query; the [dailyChallengeId, score desc] index still serves the score half.
 * Anonymous attempts appear too, but always as "Anonymous": a signed-out
 * session has no identity to show, by the same rule the leaderboard applies.
 */
export async function getDailyStanding(
  challengeId: string,
  viewer: Viewer,
): Promise<DailyStanding> {
  const viewerId = viewer.kind === "user" ? viewer.userId : null;

  const [rows, attempts] = await Promise.all([
    prisma.$queryRaw<RawStandingRow[]>`
      SELECT
        s."id"                                                           AS "sessionId",
        s."userId"                                                       AS "userId",
        s."score"::float                                                 AS "score",
        (EXTRACT(EPOCH FROM (s."submittedAt" - s."startedAt")) * 1000)   AS "timeMs",
        u."name"                                                         AS "userName",
        u."leaderboardOptOut"                                            AS "optOut",
        COALESCE(u."banned", false)                                      AS "banned"
      FROM interview_session s
      LEFT JOIN "user" u ON u."id" = s."userId"
      WHERE s."dailyChallengeId" = ${challengeId}
        AND s."status" = 'GRADED'
        AND s."score" IS NOT NULL
      ORDER BY s."score" DESC, "timeMs" ASC NULLS LAST
      LIMIT 25
    `,
    prisma.interviewSession.count({
      where: { dailyChallengeId: challengeId, status: "GRADED" },
    }),
  ]);

  return {
    rows: rows.map((row, i) => ({
      rank: i + 1,
      sessionId: row.sessionId,
      name: displayName(row),
      score: Math.round(row.score),
      timeMs: row.timeMs === null ? null : Math.round(row.timeMs),
      isViewer: viewerId !== null && row.userId === viewerId,
    })),
    attempts: Number(attempts),
  };
}

export type ViewerDailyStanding = {
  rank: number;
  score: number;
  sessionId: string;
};

/**
 * Where the signed-in viewer sits on today's board, even if they fell outside
 * the shown top slice. Ranked over every graded attempt (anonymous included) so
 * the number matches the visible table. A signed-in user gets one attempt per
 * challenge, so there is exactly one row to find.
 */
export async function getViewerDailyStanding(
  challengeId: string,
  viewer: Viewer,
): Promise<ViewerDailyStanding | null> {
  if (viewer.kind !== "user") return null;

  const rows = await prisma.$queryRaw<
    { sessionId: string; score: number; rank: bigint }[]
  >`
    WITH ranked AS (
      SELECT
        s."id"       AS "sessionId",
        s."userId"   AS "userId",
        s."score"::float AS "score",
        RANK() OVER (
          ORDER BY s."score" DESC,
          EXTRACT(EPOCH FROM (s."submittedAt" - s."startedAt")) ASC NULLS LAST
        ) AS "rank"
      FROM interview_session s
      WHERE s."dailyChallengeId" = ${challengeId}
        AND s."status" = 'GRADED'
        AND s."score" IS NOT NULL
    )
    SELECT "sessionId", "score", "rank"
    FROM ranked
    WHERE "userId" = ${viewer.userId}
    ORDER BY "rank" ASC
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    rank: Number(row.rank),
    score: Math.round(row.score),
    sessionId: row.sessionId,
  };
}

/** The one place daily standings resolve a name — mirrors the leaderboard's rule. */
function displayName(row: {
  userId: string | null;
  userName: string | null;
  optOut: boolean | null;
  banned: boolean | null;
}): string {
  if (!row.userId || !row.userName) return "Anonymous";
  if (row.optOut || row.banned) return "Anonymous";
  return row.userName;
}
