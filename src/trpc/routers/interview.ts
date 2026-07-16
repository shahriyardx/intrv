import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
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
          adaptive: true,
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

      let index = 0;

      try {
        for await (const generated of generateQuestionsStream({
          topic: session.topic,
          difficulty: session.difficulty,
          types: input.types,
          count: session.questionCount,
          brief: session.brief ?? undefined,
          sessionId: session.id,
          signal,
        })) {
          // Persist before yielding: if the client disconnects mid-stream the
          // work is not lost, and a reconnect replays from the database.
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
          // revealAnswers is false: the session is live, so the key stays server-side.
          yield toClientQuestion(saved, false);
        }

        if (index === 0) {
          throw new AiError(
            "No questions could be generated",
            "invalid_output",
            false,
          );
        }

        // The clock starts once the questions exist — generation latency must
        // not eat the student's time.
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
      } catch (error) {
        await prisma.interviewSession.update({
          where: { id: session.id },
          data: {
            status: "FAILED",
            error:
              error instanceof AiError && error.code === "insufficient_balance"
                ? "Question generation is unavailable right now. Please try again later."
                : "We couldn't generate questions for this topic. Try rephrasing it.",
          },
        });

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
