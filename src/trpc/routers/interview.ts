import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { AnswerKey, AnswerResponse, Difficulty } from "@/lib/schemas";
import { questionTypeSchema } from "@/lib/schemas";
import { LADDER, nextRung } from "@/server/ai/adaptive";
import { AiError } from "@/server/ai/client";
import { generateQuestionsStream } from "@/server/ai/generate";
import {
  type ClientQuestion,
  clientQuestionSelect,
  toClientQuestion,
} from "@/server/dal/dto";
import { getAccessibleSession } from "@/server/dal/interview";
import { canAccessSession, type Viewer } from "@/server/dal/owner";
import { gradeLocally } from "@/server/grading/local";
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

/** Questions per adaptive round — one rung's worth before the ladder can move. */
const ADAPTIVE_BATCH = 3;

/** How long to wait for a batch's answers before proceeding at the same rung. */
const ANSWER_WAIT_CAP_MS = 15 * 60 * 1000;
const ANSWER_POLL_MS = 2_500;

/** A cancellable delay that also resolves the moment the request is aborted. */
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(finish, ms);
    function finish() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", finish);
      resolve();
    }
    signal?.addEventListener("abort", finish);
  });
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
 * Non-adaptive generation: everything at the session difficulty, streamed and
 * persisted as it lands, the clock started once the whole set exists. This is
 * the original flow, factored out untouched.
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

/**
 * Adaptive generation: one rung-sized batch at a time. Between batches it waits
 * for the batch's objective answers, grades them server-side against the stored
 * key (nothing leaks — the key never leaves the server), and steps the rung
 * from that signal before writing the next batch.
 */
async function* streamAdaptive(
  session: GenSession,
  types: ClientQuestion["type"][],
  signal: AbortSignal | undefined,
): AsyncGenerator<ClientQuestion> {
  let rung: Difficulty = LADDER.includes(session.difficulty)
    ? session.difficulty
    : "MEDIUM";
  let index = 0;
  let clockStarted = false;
  const priorPrompts: string[] = [];

  while (index < session.questionCount) {
    if (signal?.aborted) return;

    const want = Math.min(ADAPTIVE_BATCH, session.questionCount - index);
    const isLastBatch = index + want >= session.questionCount;

    // Objective questions (MCQ/TRUE_FALSE) in this batch, kept with their keys
    // so the wait can grade them locally once answers arrive.
    const objective: { id: string; key: AnswerKey }[] = [];
    let yielded = 0;

    for await (const generated of generateQuestionsStream({
      topic: session.topic,
      difficulty: rung,
      types,
      count: want,
      brief: session.brief ?? undefined,
      avoidSeed: priorPrompts,
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
          // The rung is the whole point of an adaptive session — persist it so
          // the result page can calibrate.
          difficulty: rung,
        },
        select: clientQuestionSelect,
      });

      priorPrompts.push(generated.prompt);
      if (generated.type === "MCQ" || generated.type === "TRUE_FALSE") {
        objective.push({ id: saved.id, key: generated.answerKey });
      }

      index++;
      yielded++;
      yield toClientQuestion(saved, false);

      // The clock must start when the first questions become answerable, not
      // after the whole (paced) set exists — otherwise a timed adaptive session
      // never starts ticking while it waits for answers.
      if (!clockStarted) {
        clockStarted = true;
        const now = new Date();
        await prisma.interviewSession.update({
          where: { id: session.id },
          data: {
            startedAt: now,
            expiresAt: session.timeLimitMs
              ? new Date(now.getTime() + session.timeLimitMs)
              : null,
          },
        });
      }
    }

    // A batch that produced nothing new means the topic is exhausted; stepping
    // and waiting would both be pointless.
    if (yielded === 0) break;
    if (isLastBatch) break;

    rung = await waitAndStep(rung, objective, signal);
    if (signal?.aborted) return;
  }

  if (index === 0) {
    throw new AiError(
      "No questions could be generated",
      "invalid_output",
      false,
    );
  }

  // The target may have fallen short if the topic ran dry; record what exists.
  if (index !== session.questionCount) {
    await prisma.interviewSession.update({
      where: { id: session.id },
      data: { questionCount: index },
    });
  }
}

/**
 * Waits for a batch's objective questions to be answered (polling, capped, and
 * abortable), then returns the next rung from how they were graded. Times out
 * to the same rung so a student who walks away is not stuck forever.
 */
async function waitAndStep(
  current: Difficulty,
  objective: { id: string; key: AnswerKey }[],
  signal: AbortSignal | undefined,
): Promise<Difficulty> {
  if (objective.length === 0) return current;

  const ids = objective.map((o) => o.id);
  const deadline = Date.now() + ANSWER_WAIT_CAP_MS;

  while (Date.now() < deadline) {
    if (signal?.aborted) return current;
    const answered = await prisma.answer.count({
      where: { questionId: { in: ids } },
    });
    if (answered >= ids.length) break;
    await delay(ANSWER_POLL_MS, signal);
  }

  if (signal?.aborted) return current;

  const answers = await prisma.answer.findMany({
    where: { questionId: { in: ids } },
    select: { questionId: true, response: true },
  });
  const responseById = new Map(
    answers.map((a) => [a.questionId, a.response as AnswerResponse | null]),
  );

  let correct = 0;
  let total = 0;
  for (const { id, key } of objective) {
    if (!responseById.has(id)) continue;
    const graded = gradeLocally(key, responseById.get(id) ?? null);
    if (!graded) continue;
    total++;
    if (graded.isCorrect) correct++;
  }

  return nextRung(current, { correct, total });
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

      const gen: GenSession = {
        id: session.id,
        topic: session.topic,
        difficulty: session.difficulty,
        questionCount: session.questionCount,
        timeLimitMs: session.timeLimitMs,
        brief: session.brief,
      };

      try {
        if (session.adaptive) {
          yield* streamAdaptive(gen, input.types, signal);
        } else {
          yield* streamStandard(gen, input.types, signal);
        }
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
