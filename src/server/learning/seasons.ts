/**
 * Leaderboard season windows. Pure so the UTC boundary math is testable without
 * a clock — the same discipline momentum.ts and activity.ts follow.
 *
 * Seasons are calendar windows, not rolling ones: "this week" resets at the
 * start of the UTC week, "this month" at the first of the UTC month. A reset is
 * the point — it gives someone who joined late a board they can actually win,
 * which the all-time board never is once a leader is entrenched.
 */

export type SeasonPeriod = "all" | "month" | "week";

export const SEASON_PERIODS: readonly SeasonPeriod[] = [
  "all",
  "month",
  "week",
] as const;

/** Narrow an untrusted query param to a period, defaulting to all-time. */
export function toSeasonPeriod(value: unknown): SeasonPeriod {
  return value === "month" || value === "week" ? value : "all";
}

export const SEASON_LABEL: Record<SeasonPeriod, string> = {
  all: "All time",
  month: "This month",
  week: "This week",
};

/**
 * The inclusive lower bound for a period's `gradedAt`, or null for all-time.
 *
 * Weeks start Sunday to match the activity heatmap's columns, so a session and
 * its heatmap square never disagree about which week they fall in.
 */
export function seasonSince(period: SeasonPeriod, now: Date): Date | null {
  if (period === "all") return null;

  if (period === "month") {
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
    );
  }

  // Week: rewind to the most recent Sunday at UTC midnight.
  const midnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    0,
    0,
    0,
    0,
  );
  const sundayOffsetDays = new Date(midnight).getUTCDay(); // 0 = Sunday
  return new Date(midnight - sundayOffsetDays * 86_400_000);
}
