import "server-only";
import type {
  AnswerKey,
  AnswerResponse,
  Choice,
  Difficulty,
  QuestionType,
} from "@/lib/schemas";
import { answerKeySchema } from "@/lib/schemas";

/**
 * The single most important rule in this codebase: `answerKey` and
 * `explanation` must never reach the client before a session is graded.
 * Everything else is recoverable; leaking these hands the user the answers.
 *
 * Every path that sends a question to the client goes through toClientQuestion.
 * Nothing else may serialize a Question row.
 */
export type ClientQuestion = {
  id: string;
  index: number;
  type: QuestionType;
  prompt: string;
  choices: Choice[] | null;
  /**
   * The rung this question was generated at, or null when it inherits the
   * session difficulty — which is now always, since the adaptive feature that
   * set it was removed. Kept because the column is kept (see schema.prisma):
   * questions from past adaptive sessions still carry a rung. Not a secret —
   * it says nothing about the answer — so it is sent regardless of grading.
   */
  difficulty: Difficulty | null;
  /** Present only once graded. */
  explanation: string | null;
  /** Present only once graded. */
  answerKey: AnswerKey | null;
  /**
   * Present only once graded. Tags like "hoisting, closures" would hint at the
   * answer, so they are withheld with everything else.
   */
  concepts: string[] | null;
  answer: {
    response: AnswerResponse | null;
    isCorrect: boolean | null;
    score: number | null;
    feedback: string | null;
  } | null;
};

type QuestionRow = {
  id: string;
  index: number;
  type: QuestionType;
  prompt: string;
  choices: unknown;
  answerKey: unknown;
  difficulty?: Difficulty | null;
  explanation: string | null;
  concepts?: string[];
  answer?: {
    response: unknown;
    isCorrect: boolean | null;
    score: unknown;
    feedback: string | null;
  } | null;
};

/**
 * @param revealAnswers pass true ONLY when the session is graded. It is a
 * required argument rather than an option with a default so that adding a new
 * call site forces a deliberate decision about disclosure.
 */
export function toClientQuestion(
  row: QuestionRow,
  revealAnswers: boolean,
): ClientQuestion {
  const choices = (row.choices as Choice[] | null) ?? null;

  const key = revealAnswers ? answerKeySchema.safeParse(row.answerKey) : null;

  return {
    id: row.id,
    index: row.index,
    type: row.type,
    prompt: row.prompt,
    choices,
    difficulty: row.difficulty ?? null,
    explanation: revealAnswers ? row.explanation : null,
    answerKey: key?.success ? key.data : null,
    concepts: revealAnswers ? (row.concepts ?? []) : null,
    answer: row.answer
      ? {
          response: (row.answer.response as AnswerResponse | null) ?? null,
          isCorrect: row.answer.isCorrect,
          score: row.answer.score === null ? null : Number(row.answer.score),
          feedback: row.answer.feedback,
        }
      : null,
  };
}

/** Prisma `select` for a client-safe question, kept beside the DTO it feeds. */
export const clientQuestionSelect = {
  id: true,
  index: true,
  type: true,
  prompt: true,
  choices: true,
  answerKey: true,
  difficulty: true,
  explanation: true,
  concepts: true,
  answer: {
    select: {
      response: true,
      isCorrect: true,
      score: true,
      feedback: true,
    },
  },
} as const;
