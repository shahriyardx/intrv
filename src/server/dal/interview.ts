import "server-only";
import { prisma } from "@/lib/db";
import type { CreateSessionInput } from "@/lib/schemas";
import type { NormalizedQuestion } from "@/server/ai/schemas";
import {
  type ClientQuestion,
  clientQuestionSelect,
  toClientQuestion,
} from "@/server/dal/dto";
import { ownerWhere, type Viewer } from "@/server/dal/owner";

export type SessionSummary = {
  id: string;
  topic: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
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
};

export type SessionDetail = SessionSummary & {
  questions: ClientQuestion[];
};

export async function createSession(
  viewer: Viewer,
  input: CreateSessionInput & { guestId?: string },
): Promise<string> {
  const owner =
    viewer.kind === "user"
      ? { userId: viewer.userId }
      : {
          guestId:
            input.guestId ?? (viewer.kind === "guest" ? viewer.guestId : null),
        };

  if (!owner.userId && !owner.guestId) {
    throw new Error("createSession requires an owner");
  }

  const session = await prisma.interviewSession.create({
    data: {
      ...owner,
      topic: input.topic,
      difficulty: input.difficulty,
      questionCount: input.questionCount,
      timeLimitMs: input.timeLimitMinutes
        ? input.timeLimitMinutes * 60_000
        : null,
      status: "GENERATING",
    },
    select: { id: true },
  });

  return session.id;
}

/**
 * Loads a session the viewer owns, or null. The owner predicate is applied in
 * the query rather than checked afterwards, so a miss is indistinguishable from
 * a non-existent id and we can't leak existence.
 */
export async function getOwnedSession(
  viewer: Viewer,
  sessionId: string,
): Promise<SessionDetail | null> {
  const owner = ownerWhere(viewer);
  if (!owner) return null;

  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, ...owner },
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
      questions: {
        orderBy: { index: "asc" },
        select: clientQuestionSelect,
      },
    },
  });

  if (!session) return null;

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
    questions: session.questions.map((q) => toClientQuestion(q, revealAnswers)),
  };
}

/** Ownership check without loading questions — for actions that only mutate. */
export async function assertOwnsSession(
  viewer: Viewer,
  sessionId: string,
): Promise<{
  id: string;
  status: SessionSummary["status"];
  expiresAt: Date | null;
  topic: string;
} | null> {
  const owner = ownerWhere(viewer);
  if (!owner) return null;

  return prisma.interviewSession.findFirst({
    where: { id: sessionId, ...owner },
    select: { id: true, status: true, expiresAt: true, topic: true },
  });
}

export async function listSessions(
  viewer: Viewer,
  opts: { limit?: number; cursor?: string } = {},
): Promise<{ items: SessionSummary[]; nextCursor: string | null }> {
  const owner = ownerWhere(viewer);
  if (!owner) return { items: [], nextCursor: null };

  const limit = Math.min(opts.limit ?? 20, 50);

  const rows = await prisma.interviewSession.findMany({
    where: owner,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
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
    },
  });

  const hasMore = rows.length > limit;
  const items = (hasMore ? rows.slice(0, limit) : rows).map((r) => ({
    ...r,
    score: r.score === null ? null : Number(r.score),
  }));

  return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
}

/** Persists generated questions and flips the session to READY. */
export async function saveGeneratedQuestions(
  sessionId: string,
  questions: NormalizedQuestion[],
  timeLimitMs: number | null,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.question.createMany({
      data: questions.map((q, index) => ({
        sessionId,
        index,
        type: q.type,
        prompt: q.prompt,
        choices: q.choices ?? undefined,
        answerKey: q.answerKey,
        explanation: q.explanation || null,
        concepts: q.concepts,
      })),
    });

    // The clock starts when the questions exist, not when the row was created —
    // generation latency must not eat the student's time.
    const now = new Date();
    await tx.interviewSession.update({
      where: { id: sessionId },
      data: {
        status: "READY",
        questionCount: questions.length,
        startedAt: now,
        expiresAt: timeLimitMs ? new Date(now.getTime() + timeLimitMs) : null,
      },
    });
  });
}

export async function markSessionFailed(
  sessionId: string,
  error: string,
): Promise<void> {
  await prisma.interviewSession.update({
    where: { id: sessionId },
    data: { status: "FAILED", error },
  });
}
