import "server-only";
import { prisma } from "@/lib/db";
import type { Difficulty } from "@/lib/schemas";
import {
  type ClientQuestion,
  clientQuestionSelect,
  toClientQuestion,
} from "@/server/dal/dto";
import { canAccessSession, ownerWhere, type Viewer } from "@/server/dal/owner";

export type SessionSummary = {
  id: string;
  topic: string;
  difficulty: Difficulty;
  status:
    | "GENERATING"
    | "READY"
    | "SUBMITTED"
    | "GRADED"
    | "FAILED"
    | "ABANDONED";
  questionCount: number;
  score: number | null;
  expiresAt: Date | null;
  timeLimitMs: number | null;
  createdAt: Date;
  shareId: string | null;
  /** User-facing note when something degraded: failed generation, partial grading. */
  error: string | null;
  mode:
    | "CUSTOM"
    | "JOB_DESCRIPTION"
    | "DAILY"
    | "REVIEW"
    | "REMATCH"
    | "ASSESSMENT";
  adaptive: boolean;
  rematchOfId: string | null;
};

export type SessionDetail = SessionSummary & {
  questions: ClientQuestion[];
};

const sessionSelect = {
  id: true,
  userId: true,
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
} as const;

/**
 * Loads a session the viewer may read, or null.
 *
 * Unowned sessions are readable by anyone holding the id — that is the
 * no-account design. Owned sessions are readable only by their owner. Both
 * "missing" and "forbidden" return null, so this cannot be used to probe which
 * session ids exist.
 */
export async function getAccessibleSession(
  viewer: Viewer,
  sessionId: string,
): Promise<SessionDetail | null> {
  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    select: {
      ...sessionSelect,
      questions: {
        orderBy: { index: "asc" },
        select: clientQuestionSelect,
      },
    },
  });

  if (!session || !canAccessSession(session, viewer)) return null;

  const revealAnswers = session.status === "GRADED";

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
    questions: session.questions.map((q) => toClientQuestion(q, revealAnswers)),
  };
}

/** Access check without loading questions — for actions that only mutate. */
export async function assertCanAccessSession(
  viewer: Viewer,
  sessionId: string,
): Promise<{
  id: string;
  userId: string | null;
  status: SessionSummary["status"];
  expiresAt: Date | null;
  topic: string;
  mode:
    | "CUSTOM"
    | "JOB_DESCRIPTION"
    | "DAILY"
    | "REVIEW"
    | "REMATCH"
    | "ASSESSMENT";
  assessmentId: string | null;
} | null> {
  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      status: true,
      expiresAt: true,
      topic: true,
      mode: true,
      assessmentId: true,
    },
  });

  if (!session || !canAccessSession(session, viewer)) return null;
  return session;
}

/** A signed-in user's history. Anonymous viewers have none, by design. */
export async function listSessions(
  viewer: Viewer,
  opts: { limit?: number; cursor?: string } = {},
): Promise<{ items: SessionSummary[]; nextCursor: string | null }> {
  const owner = ownerWhere(viewer);
  if (!owner) return { items: [], nextCursor: null };

  const limit = Math.min(opts.limit ?? 20, 50);

  const rows = await prisma.interviewSession.findMany({
    // Failed generations are deleted at the source; excluded here too so any
    // legacy or mid-flight FAILED row never surfaces in history.
    where: { ...owner, status: { not: "FAILED" } },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    select: sessionSelect,
  });

  const hasMore = rows.length > limit;
  const items = (hasMore ? rows.slice(0, limit) : rows).map(
    ({ userId: _userId, ...row }) => ({
      ...row,
      score: row.score === null ? null : Number(row.score),
    }),
  );

  return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
}
