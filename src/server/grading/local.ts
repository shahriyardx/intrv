import type { AnswerKey, AnswerResponse } from "@/lib/schemas";

export type LocalGrade = { isCorrect: boolean; score: number };

/**
 * Grades the two objective types. No AI, no network, no cost — and it still
 * works when DeepSeek is down.
 *
 * Only MCQ and TRUE_FALSE are gradeable locally; SHORT_ANSWER returns null and
 * goes to the model.
 */
export function gradeLocally(
  key: AnswerKey,
  response: AnswerResponse | null,
): LocalGrade | null {
  if (key.kind === "SHORT_ANSWER") return null;

  // Unanswered is wrong, not an error.
  if (!response) return { isCorrect: false, score: 0 };

  if (key.kind === "MCQ") {
    if (response.kind !== "MCQ") return { isCorrect: false, score: 0 };
    // Keys are model-generated ("A"/"a"); compare case-insensitively so a
    // casing drift never reads as a wrong answer.
    const isCorrect =
      response.key.trim().toLowerCase() === key.key.trim().toLowerCase();
    return { isCorrect, score: isCorrect ? 100 : 0 };
  }

  if (response.kind !== "TRUE_FALSE") return { isCorrect: false, score: 0 };
  const isCorrect = response.value === key.value;
  return { isCorrect, score: isCorrect ? 100 : 0 };
}

/** Session score is the mean of per-question scores, 0-100, 2dp. */
export function computeSessionScore(scores: number[]): number {
  if (scores.length === 0) return 0;
  const total = scores.reduce((sum, s) => sum + s, 0);
  return Math.round((total / scores.length) * 100) / 100;
}
