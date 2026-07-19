"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  DIFFICULTIES,
  type Difficulty,
  difficultySchema,
  topicSchema,
} from "@/lib/schemas";
import { checkInterviewQuota } from "@/server/dal/limits";
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

  const quota = await checkInterviewQuota(viewer);
  if (!quota.ok) return { ok: false, error: quota.message };

  const session = await prisma.interviewSession.create({
    data: {
      userId: viewer.userId,
      mode: "REVIEW",
      topic,
      difficulty,
      // A handful of concepts doesn't need a full-length set.
      questionCount: items.length <= 4 ? 5 : 10,
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

  const quota = await checkInterviewQuota(viewer);
  if (!quota.ok) return { ok: false, error: quota.message };

  const session = await prisma.interviewSession.create({
    data: {
      userId: viewer.userId,
      mode: "CUSTOM",
      topic: parsedTopic.data,
      difficulty: parsedDifficulty.data,
      questionCount: 10,
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

/**
 * Retire review items — the "I've got this" gesture.
 *
 * Retiring is the single thing that means *done*: it takes the concept out of
 * the queue, and the mistakes page folds concepts with no active item. There is
 * no separate dismissal record, so the two surfaces cannot disagree about what
 * you have finished with.
 *
 * Nothing is deleted. `retired: true` is the same terminal state a concept
 * reaches by climbing the 1d → 3d → 7d ladder, so a manually retired concept is
 * indistinguishable from an earned one — including to `capActiveItems`, which
 * already treats retired items as out of the way. A re-miss on a later
 * interview resets it and it comes back, exactly as if it had graduated: this
 * says "not now", never "never again".
 *
 * Scoped by userId in the `where` rather than by a prior ownership read: a
 * mismatched id updates zero rows instead of someone else's queue, and the
 * count we return tells the truth either way.
 */
export async function retireReviewItems(input: {
  /** Retire one item by id. */
  itemId?: string;
  /** Retire every active item for one concept. */
  concept?: string;
  /** Retire the viewer's whole active queue. */
  all?: boolean;
}): Promise<{ ok: true; retired: number } | ReviewActionError> {
  const viewer = await getViewer();
  if (viewer.kind !== "user") {
    return { ok: false, error: "Sign in to manage your review queue." };
  }

  const scope = input.all
    ? {}
    : input.itemId
      ? { id: input.itemId }
      : input.concept
        ? { concept: input.concept }
        : null;

  // No scope at all would retire everything — refuse rather than guess.
  if (!scope) return { ok: false, error: "Nothing selected." };

  const { count } = await prisma.reviewItem.updateMany({
    where: { ...scope, userId: viewer.userId, retired: false },
    data: { retired: true },
  });

  revalidatePath("/dashboard/review");
  revalidatePath("/dashboard/mistakes");
  revalidatePath("/dashboard");

  return { ok: true, retired: count };
}
