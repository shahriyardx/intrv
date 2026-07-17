import "server-only";
import { prisma } from "@/lib/db";
import { parseIntegrity } from "@/server/dal/org";
import {
  beatsShare,
  bucketScores,
  median,
  percentile,
  type QuestionVerdict,
  type ScoreBucket,
  verdictFor,
} from "@/server/dal/org-stats";
import type { Viewer } from "@/server/dal/owner";

/**
 * Analytics for the organizations surface.
 *
 * Two audiences, one file. A recruiter needs to rank candidates fairly (which
 * takes cohort context — a bare 72% means nothing without the distribution it
 * sits in), and to make the screen itself better over time (which takes
 * per-question pass rates). Everything here is membership-gated exactly like
 * `org.ts`: not a member, no data, and null rather than a 403.
 *
 * Nothing in here reads `Screen.questions` or `Question.answerKey` into a
 * client-bound shape — the frozen set carries answer keys and stays server-side.
 */

/** A score at or above this counts as "got it". Matches the result page's verdict. */
const PASS_SCORE = 80;

/**
 * An unsubmitted attempt is only "abandoned" once it cannot plausibly still be
 * in progress: its deadline passed, or it has sat untouched for a day. Counting
 * a candidate who started ninety seconds ago as a drop-off would make the
 * number lie in the direction that panics people.
 */
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

async function memberOf(viewer: Viewer, orgId: string): Promise<boolean> {
  if (viewer.kind !== "user") return false;

  const membership = await prisma.member.findUnique({
    where: {
      organizationId_userId: { organizationId: orgId, userId: viewer.userId },
    },
    select: { id: true },
  });

  return membership !== null;
}

// ---------------------------------------------------------------------------
// Org overview
// ---------------------------------------------------------------------------

export type OrgOverview = {
  activeScreens: number;
  totalScreens: number;
  candidates: number;
  candidates7d: number;
  /** Submitted ÷ started, over attempts old enough to judge. Null with no data. */
  completionRate: number | null;
  /** Attempts that started, went stale, and never came back. */
  abandoned: number;
  /** Median of graded scores — median, not mean: one zero shouldn't move it. */
  medianScore: number | null;
  flagged: number;
};

export async function getOrgOverview(
  viewer: Viewer,
  orgId: string,
): Promise<OrgOverview | null> {
  if (!(await memberOf(viewer, orgId))) return null;

  const now = Date.now();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const [screens, activeScreens, sessions] = await Promise.all([
    prisma.screen.count({ where: { orgId } }),
    prisma.screen.count({ where: { orgId, active: true } }),
    prisma.interviewSession.findMany({
      where: { screen: { orgId } },
      select: {
        score: true,
        startedAt: true,
        submittedAt: true,
        expiresAt: true,
        createdAt: true,
        integrity: true,
      },
    }),
  ]);

  const started = sessions.filter((s) => s.startedAt !== null);
  const submitted = started.filter((s) => s.submittedAt !== null);

  const stale = started.filter(
    (s) =>
      s.submittedAt === null &&
      ((s.expiresAt !== null && s.expiresAt.getTime() < now) ||
        (s.startedAt as Date).getTime() < now - STALE_AFTER_MS),
  );

  // Judge completion only against attempts that have had their chance: an
  // in-flight attempt is neither a completion nor a drop-off yet.
  const settled = submitted.length + stale.length;

  const scores = sessions
    .map((s) => (s.score === null ? null : Number(s.score)))
    .filter((s): s is number => s !== null);

  const flagged = sessions.filter((s) => {
    const integrity = parseIntegrity(s.integrity);
    return integrity !== null && (integrity.blurs > 0 || integrity.pastes > 0);
  }).length;

  return {
    activeScreens,
    totalScreens: screens,
    candidates: sessions.length,
    candidates7d: sessions.filter((s) => s.createdAt >= weekAgo).length,
    completionRate: settled === 0 ? null : submitted.length / settled,
    abandoned: stale.length,
    medianScore: median(scores),
    flagged,
  };
}

export type RecentCandidate = {
  sessionId: string;
  screenId: string;
  screenTitle: string;
  name: string | null;
  status: string;
  score: number | null;
  at: Date;
};

/** The "what happened since I last looked" list. */
export async function listRecentCandidates(
  viewer: Viewer,
  orgId: string,
  limit = 8,
): Promise<RecentCandidate[]> {
  if (!(await memberOf(viewer, orgId))) return [];

  const rows = await prisma.interviewSession.findMany({
    where: { screen: { orgId } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      candidateName: true,
      status: true,
      score: true,
      createdAt: true,
      submittedAt: true,
      screenId: true,
      screen: { select: { title: true } },
    },
  });

  return rows.map((row) => ({
    sessionId: row.id,
    screenId: row.screenId ?? "",
    screenTitle: row.screen?.title ?? "—",
    name: row.candidateName,
    status: row.status,
    score: row.score === null ? null : Number(row.score),
    at: row.submittedAt ?? row.createdAt,
  }));
}

// ---------------------------------------------------------------------------
// Per-screen analytics
// ---------------------------------------------------------------------------

export type QuestionStat = {
  index: number;
  type: string;
  prompt: string;
  answered: number;
  passed: number;
  /** Null until enough answers exist to mean anything. */
  passRate: number | null;
  verdict: QuestionVerdict;
};

export type ScreenAnalytics = {
  graded: number;
  started: number;
  submitted: number;
  abandoned: number;
  inProgress: number;
  medianScore: number | null;
  p25: number | null;
  p75: number | null;
  distribution: ScoreBucket[];
  /** sessionId → percentile rank (0-100) among graded attempts at this screen. */
  percentiles: Map<string, number>;
  medianDurationMs: number | null;
  /** Submitted within a minute of the deadline — they ran out of time. */
  hitLimit: number;
  timeLimitMs: number | null;
  flagged: number;
  questions: QuestionStat[];
};

/**
 * Everything the screen report needs beyond the candidate list itself.
 *
 * Returns null for a non-member or an unknown screen alike — the same
 * non-disclosure the rest of the org DAL keeps.
 */
export async function getScreenAnalytics(
  viewer: Viewer,
  screenId: string,
): Promise<ScreenAnalytics | null> {
  const screen = await prisma.screen.findUnique({
    where: { id: screenId },
    select: { id: true, orgId: true, timeLimitMs: true },
  });

  if (!screen || !(await memberOf(viewer, screen.orgId))) return null;

  const now = Date.now();

  const sessions = await prisma.interviewSession.findMany({
    where: { screenId },
    select: {
      id: true,
      status: true,
      score: true,
      startedAt: true,
      submittedAt: true,
      expiresAt: true,
      integrity: true,
    },
  });

  const started = sessions.filter((s) => s.startedAt !== null);
  const submitted = started.filter((s) => s.submittedAt !== null);
  const abandoned = started.filter(
    (s) =>
      s.submittedAt === null &&
      ((s.expiresAt !== null && s.expiresAt.getTime() < now) ||
        (s.startedAt as Date).getTime() < now - STALE_AFTER_MS),
  );

  const graded = sessions.filter(
    (s) => s.status === "GRADED" && s.score !== null,
  );
  const scores = graded.map((s) => Number(s.score));

  // The share of the cohort each candidate strictly beat — see beatsShare. The
  // UI hides this below a cohort worth comparing against at all.
  const percentiles = new Map<string, number>();
  for (const session of graded) {
    percentiles.set(session.id, beatsShare(Number(session.score), scores));
  }

  const durations = submitted
    .map(
      (s) =>
        (s.submittedAt as Date).getTime() - (s.startedAt as Date).getTime(),
    )
    .filter((d) => d > 0);

  const hitLimit = submitted.filter(
    (s) =>
      s.expiresAt !== null &&
      (s.submittedAt as Date).getTime() >= s.expiresAt.getTime() - 60_000,
  ).length;

  const flagged = sessions.filter((s) => {
    const integrity = parseIntegrity(s.integrity);
    return integrity !== null && (integrity.blurs > 0 || integrity.pastes > 0);
  }).length;

  return {
    graded: graded.length,
    started: started.length,
    submitted: submitted.length,
    abandoned: abandoned.length,
    inProgress: started.length - submitted.length - abandoned.length,
    medianScore: median(scores),
    p25: percentile(scores, 25),
    p75: percentile(scores, 75),
    distribution: bucketScores(scores),
    percentiles,
    medianDurationMs: median(durations),
    hitLimit,
    timeLimitMs: screen.timeLimitMs,
    flagged,
    questions: await questionStats(screenId),
  };
}

/**
 * Per-question pass rates across every graded attempt.
 *
 * This is the part that makes a screen better rather than just measuring
 * candidates: a question nearly everyone passes carries no signal and is
 * costing a slot, and one nearly everyone fails is usually ambiguous rather
 * than hard. Because a screen's question set is frozen, `index` identifies the
 * same question across every candidate.
 */
async function questionStats(screenId: string): Promise<QuestionStat[]> {
  const rows = await prisma.question.findMany({
    where: { session: { screenId, status: "GRADED" } },
    select: {
      index: true,
      type: true,
      prompt: true,
      answer: { select: { score: true } },
    },
    orderBy: { index: "asc" },
  });

  const byIndex = new Map<
    number,
    { type: string; prompt: string; answered: number; passed: number }
  >();

  for (const row of rows) {
    const entry = byIndex.get(row.index) ?? {
      type: row.type,
      prompt: row.prompt,
      answered: 0,
      passed: 0,
    };

    // An ungraded answer is not evidence either way; a missing one is a miss.
    const score = row.answer?.score;
    entry.answered++;
    if (score !== null && score !== undefined && Number(score) >= PASS_SCORE) {
      entry.passed++;
    }

    byIndex.set(row.index, entry);
  }

  return [...byIndex.entries()]
    .sort(([a], [b]) => a - b)
    .map(([index, e]) => {
      const passRate = e.answered === 0 ? null : e.passed / e.answered;

      return {
        index,
        type: e.type,
        prompt: e.prompt,
        answered: e.answered,
        passed: e.passed,
        passRate,
        verdict: verdictFor(e.passed, e.answered),
      };
    });
}
