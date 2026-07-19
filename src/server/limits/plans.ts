/**
 * Plan limits. Import-free and pure, like owner.ts and levels.ts, so the
 * numbers are unit-testable and there is exactly one place they live.
 *
 * There is no `plan` column yet — everyone is FREE — and that is deliberate:
 * paid plans are a later decision, and a column nobody can change is worse
 * than a seam. `planForUser`/`planForOrg` in the limits DAL are that seam:
 * when plans become real, they start reading a column and nothing else here
 * moves.
 */

export type Plan = "FREE" | "PRO";

export type Limits = {
  /**
   * Interviews a signed-in person may start per UTC day.
   *
   * Screening attempts do not count. Sitting an assessment is work someone else
   * asked for — a candidate rate-limited out of an interview a recruiter sent
   * them would be a support ticket, and the org already pays for that quota
   * through its own assessment limit.
   */
  interviewsPerDay: number;
  /** Assessments an org may create per UTC day. */
  assessmentsPerDay: number;
  /** Candidates who may ever sit one assessment. */
  participantsPerAssessment: number;
};

export const PLAN_LIMITS: Record<Plan, Limits> = {
  FREE: {
    interviewsPerDay: 5,
    assessmentsPerDay: 5,
    participantsPerAssessment: 100,
  },
  // Placeholder shape so the record is exhaustive and the seam is obvious.
  // Nothing resolves to PRO yet; the numbers are a guess and are meant to be
  // argued about when plans ship.
  PRO: {
    interviewsPerDay: 50,
    assessmentsPerDay: 50,
    participantsPerAssessment: 1_000,
  },
};

export function limitsFor(plan: Plan): Limits {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.FREE;
}

/**
 * The UTC midnight at or before `now` — the start of the quota window.
 *
 * UTC rather than local time, matching streaks and the daily challenge. One
 * boundary consistently applied beats two: a user in UTC+13 sees their quota
 * reset mid-afternoon, which is the same rollover their streak already uses.
 */
export function startOfUtcDay(now: Date): Date {
  return new Date(Math.floor(now.getTime() / 86_400_000) * 86_400_000);
}

/** The next UTC midnight — when the window rolls and the quota frees up. */
export function nextUtcDayReset(now: Date): Date {
  return new Date(startOfUtcDay(now).getTime() + 86_400_000);
}
