import "server-only";
import { prisma } from "@/lib/db";
import type { Viewer } from "@/server/dal/owner";
import {
  limitsFor,
  nextUtcDayReset,
  type Plan,
  startOfUtcDay,
} from "@/server/limits/plans";

/**
 * Quota checks. Every one of these guards a DeepSeek call, so they are the
 * difference between a bad day and a bad invoice.
 *
 * **Known gap, deliberate:** an anonymous visitor has no identity to count
 * against — there is no guest cookie by design — so signed-out interviews are
 * not rate limited here. That is the app's largest remaining cost exposure and
 * it needs its own decision (IP buckets, a proof-of-work, or requiring an
 * account to generate). Do not mistake the presence of this file for that
 * problem being solved.
 */

export type QuotaOk = { ok: true };
export type QuotaExceeded = {
  ok: false;
  limit: number;
  used: number;
  /** When the window rolls over. Null for limits that never reset. */
  resetsAt: Date | null;
  /** Ready to show a user; the actions pass it straight through. */
  message: string;
};
export type QuotaResult = QuotaOk | QuotaExceeded;

/**
 * The seam for paid plans. There is no `plan` column yet, so everyone is FREE;
 * when plans ship these read one and nothing else changes.
 */
async function planForUser(_userId: string): Promise<Plan> {
  return "FREE";
}
async function planForOrg(_orgId: string): Promise<Plan> {
  return "FREE";
}

/** Modes that count against a person's own daily interview quota. */
const PERSONAL_MODES = [
  "CUSTOM",
  "JOB_DESCRIPTION",
  "DAILY",
  "REVIEW",
  "REMATCH",
] as const;

/**
 * Interviews this person has started today, against their plan's allowance.
 *
 * ASSESSMENT is excluded: sitting a screening is work an org asked for, and the
 * org pays for it through its own quota. Anonymous viewers pass — see the gap
 * noted at the top of this file.
 */
export async function checkInterviewQuota(
  viewer: Viewer,
): Promise<QuotaResult> {
  if (viewer.kind !== "user") return { ok: true };

  const now = new Date();
  const limit = limitsFor(await planForUser(viewer.userId)).interviewsPerDay;

  const used = await prisma.interviewSession.count({
    where: {
      userId: viewer.userId,
      mode: { in: [...PERSONAL_MODES] },
      createdAt: { gte: startOfUtcDay(now) },
    },
  });

  if (used < limit) return { ok: true };

  return {
    ok: false,
    limit,
    used,
    resetsAt: nextUtcDayReset(now),
    message: `You've started ${limit} interviews today, which is the daily limit. It resets at midnight UTC — your history and reviews are all still here.`,
  };
}

/** Assessments this org has created today, against its plan's allowance. */
export async function checkAssessmentQuota(
  orgId: string,
): Promise<QuotaResult> {
  const now = new Date();
  const limit = limitsFor(await planForOrg(orgId)).assessmentsPerDay;

  const used = await prisma.assessment.count({
    where: { orgId, createdAt: { gte: startOfUtcDay(now) } },
  });

  if (used < limit) return { ok: true };

  return {
    ok: false,
    limit,
    used,
    resetsAt: nextUtcDayReset(now),
    message: `You've created ${limit} assessments today, which is the daily limit on the free plan. It resets at midnight UTC.`,
  };
}

/**
 * Candidates who have ever sat one assessment, against the plan's cap.
 *
 * Not a daily window — this one is a lifetime cap per assessment, so it never
 * resets. Counts attempts rather than distinct people on purpose: a retake is
 * another generated-and-graded set either way, and distinct-candidate counting
 * would let one address consume the quota unbounded.
 */
export async function checkParticipantQuota(
  assessmentId: string,
): Promise<QuotaResult> {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { orgId: true },
  });
  // A missing assessment is not a quota problem; let the caller's own
  // not-found handling deal with it.
  if (!assessment) return { ok: true };

  const limit = limitsFor(
    await planForOrg(assessment.orgId),
  ).participantsPerAssessment;

  const used = await prisma.interviewSession.count({ where: { assessmentId } });

  if (used < limit) return { ok: true };

  return {
    ok: false,
    limit,
    used,
    resetsAt: null,
    message: `This assessment has reached its ${limit}-candidate limit on the free plan.`,
  };
}

/** Today's usage for the dashboard/org UI, so the cap is visible before it bites. */
export async function getInterviewUsage(
  viewer: Viewer,
): Promise<{ used: number; limit: number } | null> {
  if (viewer.kind !== "user") return null;

  const limit = limitsFor(await planForUser(viewer.userId)).interviewsPerDay;
  const used = await prisma.interviewSession.count({
    where: {
      userId: viewer.userId,
      mode: { in: [...PERSONAL_MODES] },
      createdAt: { gte: startOfUtcDay(new Date()) },
    },
  });

  return { used, limit };
}
