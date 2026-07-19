import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { Difficulty } from "@/lib/schemas";
import { questionTypeSchema } from "@/lib/schemas";
import { AiError } from "@/server/ai/client";
import { generateQuestionsStream } from "@/server/ai/generate";
import {
  type ClientQuestion,
  clientQuestionSelect,
  toClientQuestion,
} from "@/server/dal/dto";
import { getAccessibleSession } from "@/server/dal/interview";
import { canAccessSession, type Viewer } from "@/server/dal/owner";
import { createTRPCRouter, publicProcedure } from "@/trpc/init";

/** The tRPC context carries the viewer's identity; rebuild it in the same shape. */
function viewerFrom(ctx: {
  session: {
    user: { id: string; role?: string | null; banned?: boolean | null };
  } | null;
}): Viewer {
  if (ctx.session?.user) {
    return {
      kind: "user",
      userId: ctx.session.user.id,
      role: ctx.session.user.role ?? null,
      banned: Boolean(ctx.session.user.banned),
    };
  }
  return { kind: "anonymous" };
}

type GenSession = {
  id: string;
  topic: string;
  difficulty: Difficulty;
  questionCount: number;
  timeLimitMs: number | null;
  brief: string | null;
};

/**
 * A session that couldn't generate is our failure, not the user's work, so it
 * is deleted rather than kept as a FAILED row: it must never count as an
 * interview taken, never appear in history, and leave nothing to sweep. The
 * cascade removes its questions and answers; the AiCall telemetry survives (its
 * sessionId is SetNull, not cascaded), so the failure is still visible in admin
 * AI usage. The live runner renders its own error from the stream and does not
 * re-read the row, so deleting it does not affect what the user is watching.
 */
async function discardFailedSession(
  sessionId: string,
  error: unknown,
): Promise<void> {
  console.error(`generation failed for session ${sessionId}:`, error);
  // Guard the delete: the row may already be gone (e.g. the account was deleted
  // mid-generation), and a missing-row error here must not mask the real cause.
  await prisma.interviewSession
    .delete({ where: { id: sessionId } })
    .catch(() => {});
}

/**
 * Generation: everything at the session difficulty, streamed and persisted as
 * it lands, the clock started once the whole set exists.
 */
async function* streamStandard(
  session: GenSession,
  types: ClientQuestion["type"][],
  signal: AbortSignal | undefined,
): AsyncGenerator<ClientQuestion> {
  let index = 0;

  for await (const generated of generateQuestionsStream({
    topic: session.topic,
    difficulty: session.difficulty,
    types,
    count: session.questionCount,
    brief: session.brief ?? undefined,
    sessionId: session.id,
    signal,
  })) {
    const saved = await prisma.question.create({
      data: {
        sessionId: session.id,
        index,
        type: generated.type,
        prompt: generated.prompt,
        choices: generated.choices ?? undefined,
        answerKey: generated.answerKey,
        explanation: generated.explanation || null,
        concepts: generated.concepts,
      },
      select: clientQuestionSelect,
    });

    index++;
    yield toClientQuestion(saved, false);
  }

  if (index === 0) {
    throw new AiError(
      "No questions could be generated",
      "invalid_output",
      false,
    );
  }

  const now = new Date();
  await prisma.interviewSession.update({
    where: { id: session.id },
    data: {
      questionCount: index,
      startedAt: now,
      expiresAt: session.timeLimitMs
        ? new Date(now.getTime() + session.timeLimitMs)
        : null,
    },
  });
}

export const interviewRouter = createTRPCRouter({
  get: publicProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const session = await getAccessibleSession(
        viewerFrom(ctx),
        input.sessionId,
      );
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      return session;
    }),

  /**
   * Streams questions as DeepSeek produces them.
   *
   * This is an async-generator query: the client's `data` is a growing array
   * that re-renders per yield. No SSE plumbing, and the payload is still typed
   * and Zod-validated end to end.
   */
  generate: publicProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        types: z.array(questionTypeSchema).min(1).max(3),
      }),
    )
    .query(async function* ({ input, ctx, signal }) {
      const viewer = viewerFrom(ctx);

      const session = await prisma.interviewSession.findUnique({
        where: { id: input.sessionId },
        select: {
          id: true,
          userId: true,
          topic: true,
          difficulty: true,
          questionCount: true,
          timeLimitMs: true,
          status: true,
          mode: true,
          brief: true,
        },
      });

      if (!session || !canAccessSession(session, viewer)) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Already generated: replay from the database so a refresh or a second
      // tab shows the same questions instead of paying to make new ones.
      if (session.status !== "GENERATING") {
        const existing = await prisma.question.findMany({
          where: { sessionId: session.id },
          orderBy: { index: "asc" },
          select: clientQuestionSelect,
        });
        for (const question of existing) {
          yield toClientQuestion(question, false);
        }
        return;
      }

      // Claim the session before generating. Two tabs racing would otherwise
      // both stream and double-insert; the conditional update makes exactly one
      // win.
      const claim = await prisma.interviewSession.updateMany({
        where: { id: session.id, status: "GENERATING" },
        data: { status: "READY", startedAt: new Date() },
      });

      if (claim.count === 0) {
        const existing = await prisma.question.findMany({
          where: { sessionId: session.id },
          orderBy: { index: "asc" },
          select: clientQuestionSelect,
        });
        for (const question of existing) {
          yield toClientQuestion(question, false);
        }
        return;
      }

      const gen: GenSession = {
        id: session.id,
        topic: session.topic,
        difficulty: session.difficulty,
        questionCount: session.questionCount,
        timeLimitMs: session.timeLimitMs,
        brief: session.brief,
      };

      try {
        yield* streamStandard(gen, input.types, signal);
      } catch (error) {
        await discardFailedSession(session.id, error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Generation failed",
          cause: error,
        });
      }
    }),
});

export type InterviewRouter = typeof interviewRouter;
export type { ClientQuestion };
