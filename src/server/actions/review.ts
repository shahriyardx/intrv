"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  DIFFICULTIES,
  type Difficulty,
  difficultySchema,
  topicSchema,
} from "@/lib/schemas";
import { getViewer } from "@/server/dal/session";
import { harderDifficulty } from "@/server/learning/plan";

/**
 * Server Functions are POST endpoints reachable directly, so each action here
 * re-establishes its viewer rather than trusting the UI that called it. Both
 * create a session and redirect into it; the generation stream reads the brief
 * and types from there.
 */

export type ReviewActionError = { ok: false; error: string };

/** The `?types=` string that opts a new session into all three formats. */
const ALL_TYPES = "MCQ,TRUE_FALSE,SHORT_ANSWER";

/** brief is VarChar(2000); leave headroom for the trailing ellipsis. */
const BRIEF_MAX = 2000;

/**
 * Build a session from the user's due review items and drop them into it.
 *
 * Returns an error shape only when there is genuinely nothing to review — the
 * happy path redirects and never returns.
 */
export async function startReviewSession(): Promise<ReviewActionError | never> {
  const viewer = await getViewer();
  if (viewer.kind !== "user") redirect("/sign-in?next=/dashboard/review");

  const items = await prisma.reviewItem.findMany({
    where: {
      userId: viewer.userId,
      retired: false,
      dueAt: { lte: new Date() },
    },
    orderBy: { dueAt: "asc" },
    take: 12,
    select: { concept: true, topic: true, difficulty: true },
  });

  if (items.length === 0) {
    return { ok: false, error: "Nothing is due for review right now." };
  }

  const topics = new Set(items.map((item) => item.topic));
  const topic = topics.size === 1 ? [...topics][0] : "Mixed review";

  // Test at the hardest rung any due item carries — a review that quietly
  // downgrades the difficulty is not re-testing the miss.
  const difficulty = items.reduce<Difficulty>(
    (hardest, item) => harderDifficulty(hardest, item.difficulty),
    DIFFICULTIES[0],
  );

  const session = await prisma.interviewSession.create({
    data: {
      userId: viewer.userId,
      mode: "REVIEW",
      topic,
      difficulty,
      // A handful of concepts doesn't need a full-length set.
      questionCount: items.length <= 4 ? 5 : 10,
      adaptive: false,
      status: "GENERATING",
      brief: buildReviewBrief(items),
    },
    select: { id: true },
  });

  redirect(`/s/${session.id}?types=${ALL_TYPES}`);
}

/**
 * The one-click "Start" behind a learning-path suggestion. topic and difficulty
 * come from our own mastery rollup, but they arrive over a POST like any other
 * client input, so both are re-validated against the shared schemas.
 */
export async function startPlannedSession(
  topic: string,
  difficulty: string,
): Promise<ReviewActionError | never> {
  const viewer = await getViewer();
  if (viewer.kind !== "user") redirect("/sign-in?next=/dashboard/plan");

  const parsedTopic = topicSchema.safeParse(topic);
  const parsedDifficulty = difficultySchema.safeParse(difficulty);
  if (!parsedTopic.success || !parsedDifficulty.success) {
    return { ok: false, error: "That suggestion is no longer valid." };
  }

  const session = await prisma.interviewSession.create({
    data: {
      userId: viewer.userId,
      mode: "CUSTOM",
      topic: parsedTopic.data,
      difficulty: parsedDifficulty.data,
      questionCount: 10,
      adaptive: false,
      timeLimitMs: null,
      status: "GENERATING",
    },
    select: { id: true },
  });

  redirect(`/s/${session.id}?types=${ALL_TYPES}`);
}

/**
 * The focus text the review generator gets: the concepts being re-tested and
 * the topic each was missed under. Truncated on item boundaries so the column
 * cap is never blown and the list never ends mid-quote.
 */
function buildReviewBrief(items: { concept: string; topic: string }[]): string {
  const prefix = "Re-test these previously missed concepts: ";
  const parts = items.map((item) => `"${item.concept}" (${item.topic})`);

  const full = prefix + parts.join(", ");
  if (full.length <= BRIEF_MAX) return full;

  let brief = prefix;
  for (const part of parts) {
    const next = brief === prefix ? brief + part : `${brief}, ${part}`;
    // -1 leaves room for the ellipsis appended below.
    if (next.length > BRIEF_MAX - 1) break;
    brief = next;
  }
  return `${brief}…`;
}
