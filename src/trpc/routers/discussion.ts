import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { AnswerKey, AnswerResponse, Choice } from "@/lib/schemas";
import { callChatStream } from "@/server/ai/client";
import { buildDiscussUser, DISCUSS_SYSTEM } from "@/server/ai/prompts";
import { canAccessSession, type Viewer } from "@/server/dal/owner";
import { createTRPCRouter, publicProcedure } from "@/trpc/init";

/** Same viewer reconstruction as the interview router — keep the two in step. */
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

/** Human-readable correct answer for the prompt — the result page already reveals this. */
function renderKey(key: AnswerKey, choices: Choice[] | null): string {
  if (key.kind === "MCQ") {
    const choice = choices?.find(
      (c) => c.key.toLowerCase() === key.key.toLowerCase(),
    );
    return choice ? `${choice.key}. ${choice.text}` : key.key;
  }
  if (key.kind === "TRUE_FALSE") return key.value ? "True" : "False";
  return key.expected;
}

function renderResponse(
  response: AnswerResponse | null,
  choices: Choice[] | null,
): string {
  if (!response) return "(no answer)";
  if (response.kind === "MCQ") {
    const choice = choices?.find(
      (c) => c.key.toLowerCase() === response.key.toLowerCase(),
    );
    return choice ? `${choice.key}. ${choice.text}` : response.key;
  }
  if (response.kind === "TRUE_FALSE") return response.value ? "True" : "False";
  return response.text;
}

export const discussionRouter = createTRPCRouter({
  /**
   * Streams a tutor's reply about one graded question. Async-generator query:
   * the client's `data` is a growing array of text chunks. Only reachable once
   * the session is GRADED — a discussion of the answer before grading would leak
   * exactly what the DTO guards.
   */
  drill: publicProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        questionId: z.string().uuid(),
        turns: z
          .array(
            z.object({
              role: z.enum(["student", "assistant"]),
              text: z.string().min(1).max(2000),
            }),
          )
          .min(1)
          .max(8),
      }),
    )
    .query(async function* ({ input, ctx, signal }) {
      // The client always ends on a student question; a trailing assistant turn
      // would mean there's nothing to answer.
      const last = input.turns.at(-1);
      if (!last || last.role !== "student") {
        throw new TRPCError({ code: "BAD_REQUEST" });
      }

      const viewer = viewerFrom(ctx);

      const session = await prisma.interviewSession.findUnique({
        where: { id: input.sessionId },
        select: { id: true, userId: true, status: true },
      });

      // NOT_FOUND for missing, inaccessible, or not-yet-graded alike — never
      // confirm a session exists, and never discuss answers pre-grading.
      if (
        !session ||
        !canAccessSession(session, viewer) ||
        session.status !== "GRADED"
      ) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const question = await prisma.question.findFirst({
        where: { id: input.questionId, sessionId: input.sessionId },
        select: {
          type: true,
          prompt: true,
          choices: true,
          answerKey: true,
          explanation: true,
          answer: { select: { response: true, feedback: true, score: true } },
        },
      });

      if (!question) throw new TRPCError({ code: "NOT_FOUND" });

      const choices = (question.choices as Choice[] | null) ?? null;
      const key = question.answerKey as AnswerKey;
      const response =
        (question.answer?.response as AnswerResponse | null) ?? null;

      const user = buildDiscussUser({
        prompt: question.prompt,
        type: question.type,
        choices,
        correctAnswer: renderKey(key, choices),
        explanation: question.explanation,
        studentAnswer: renderResponse(response, choices),
        feedback: question.answer?.feedback ?? null,
        score:
          question.answer?.score === null ||
          question.answer?.score === undefined
            ? null
            : Number(question.answer.score),
        turns: input.turns,
      });

      for await (const delta of callChatStream({
        sessionId: input.sessionId,
        system: DISCUSS_SYSTEM,
        user,
        signal,
      })) {
        yield delta;
      }
    }),
});

export type DiscussionRouter = typeof discussionRouter;
