import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { Difficulty } from "@/lib/schemas";
import {
  addDays,
  advanceStage,
  RESET_STAGE,
} from "@/server/learning/scheduling";

/**
 * Spaced-repetition scheduling. Called from afterSessionGraded (hooks.ts) once a
 * session reaches GRADED, inside a try/catch — throwing is safe but pointless,
 * it only costs the log line.
 *
 * Two jobs, split on session mode:
 *  - A normal graded session *creates work*: every concept the user missed
 *    becomes (or resets to) a stage-0 ReviewItem due in a day.
 *  - A REVIEW session *resolves work*: it was generated from due items, so a
 *    concept answered cleanly climbs the ladder (1d → 3d → 7d → retired) and a
 *    concept missed again resets and counts a lapse.
 *
 * Anonymous and SCREEN sessions no-op: neither feeds the signed-in user's study
 * loop.
 */
export async function scheduleReviews(sessionId: string): Promise<void> {
  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    select: {
      userId: true,
      mode: true,
      topic: true,
      difficulty: true,
      questions: {
        select: {
          concepts: true,
          answer: { select: { isCorrect: true, score: true } },
        },
      },
    },
  });

  if (!session || session.userId === null) return;
  if (session.mode === "SCREEN") return;

  const userId = session.userId;
  const now = new Date();

  if (session.mode === "REVIEW") {
    await resolveReviewSession(userId, session.questions, now);
  } else {
    await scheduleMissedConcepts(
      userId,
      session.topic,
      session.difficulty,
      session.questions,
      now,
    );
  }

  await capActiveItems(userId);
}

type GradedQuestion = {
  concepts: string[];
  answer: { isCorrect: boolean | null; score: Prisma.Decimal | null } | null;
};

/**
 * A question counts as missed when it was never answered, graded wrong, or
 * scored below a bare pass. The `< 60` floor matches the short-answer pass line
 * submitSession uses when it sets isCorrect.
 */
function isMissed(answer: GradedQuestion["answer"]): boolean {
  if (!answer) return true;
  if (answer.isCorrect === false) return true;
  const score = answer.score === null ? null : Number(answer.score);
  return score !== null && score < 60;
}

/** Distinct, non-empty concepts on missed questions. */
function missedConcepts(questions: GradedQuestion[]): string[] {
  const missed = new Set<string>();
  for (const q of questions) {
    if (!isMissed(q.answer)) continue;
    for (const concept of q.concepts) {
      const trimmed = concept.trim();
      if (trimmed) missed.add(trimmed);
    }
  }
  return [...missed];
}

/**
 * Upsert a stage-0 ReviewItem per missed concept under this session's topic.
 *
 * A lapse is only counted when the concept had made progress worth losing — it
 * was past stage 0 or already retired. Resetting a concept that was already at
 * stage 0 (missed twice before ever being reviewed) is not a lapse, just a
 * re-miss, so the lapse count stays an honest measure of backsliding.
 */
async function scheduleMissedConcepts(
  userId: string,
  topic: string,
  difficulty: Difficulty,
  questions: GradedQuestion[],
  now: Date,
): Promise<void> {
  const concepts = missedConcepts(questions);
  if (concepts.length === 0) return;

  const dueAt = addDays(now, 1);

  const existing = await prisma.reviewItem.findMany({
    where: { userId, topic, concept: { in: concepts } },
    select: { id: true, concept: true, stage: true, retired: true },
  });
  const byConcept = new Map(existing.map((row) => [row.concept, row]));

  for (const concept of concepts) {
    const prior = byConcept.get(concept);
    if (!prior) {
      await prisma.reviewItem.create({
        data: {
          userId,
          topic,
          concept,
          difficulty,
          stage: RESET_STAGE,
          lapses: 0,
          dueAt,
          retired: false,
        },
      });
      continue;
    }

    const lapsed = prior.stage > RESET_STAGE || prior.retired;
    await prisma.reviewItem.update({
      where: { id: prior.id },
      data: {
        stage: RESET_STAGE,
        retired: false,
        dueAt,
        ...(lapsed ? { lapses: { increment: 1 } } : {}),
      },
    });
  }
}

/**
 * Advance or lapse the active items a REVIEW session exercised.
 *
 * The session's questions were generated from due concepts, so we match active
 * items by concept alone (any topic — a concept can be missed under several).
 * Clean on every question carrying the concept → climb; missed on any → reset
 * and lapse.
 */
async function resolveReviewSession(
  userId: string,
  questions: GradedQuestion[],
  now: Date,
): Promise<void> {
  const missedByConcept = new Map<string, boolean>();
  for (const q of questions) {
    const missed = isMissed(q.answer);
    for (const concept of q.concepts) {
      const trimmed = concept.trim();
      if (!trimmed) continue;
      missedByConcept.set(
        trimmed,
        (missedByConcept.get(trimmed) ?? false) || missed,
      );
    }
  }

  const concepts = [...missedByConcept.keys()];
  if (concepts.length === 0) return;

  const items = await prisma.reviewItem.findMany({
    where: { userId, retired: false, concept: { in: concepts } },
    select: { id: true, concept: true, stage: true },
  });

  for (const item of items) {
    const missed = missedByConcept.get(item.concept);
    if (missed) {
      await prisma.reviewItem.update({
        where: { id: item.id },
        data: {
          stage: RESET_STAGE,
          dueAt: addDays(now, 1),
          lapses: { increment: 1 },
        },
      });
      continue;
    }

    const next = advanceStage(item.stage);
    if (next.retire) {
      await prisma.reviewItem.update({
        where: { id: item.id },
        data: { retired: true },
      });
    } else {
      await prisma.reviewItem.update({
        where: { id: item.id },
        data: { stage: next.stage, dueAt: addDays(now, next.intervalDays) },
      });
    }
  }
}

/** No user carries more than this many active items — the queue must stay finite. */
const MAX_ACTIVE_ITEMS = 200;

/**
 * Keep the active queue bounded. When a user runs over the cap, the items that
 * have sat due the longest are retired — they are the least likely to still be
 * worth re-testing, and letting the queue grow without limit turns the review
 * page into a wall.
 */
async function capActiveItems(userId: string): Promise<void> {
  const active = await prisma.reviewItem.count({
    where: { userId, retired: false },
  });
  if (active <= MAX_ACTIVE_ITEMS) return;

  const excess = active - MAX_ACTIVE_ITEMS;
  const stale = await prisma.reviewItem.findMany({
    where: { userId, retired: false },
    orderBy: { dueAt: "asc" },
    take: excess,
    select: { id: true },
  });

  await prisma.reviewItem.updateMany({
    where: { id: { in: stale.map((row) => row.id) } },
    data: { retired: true },
  });
}
