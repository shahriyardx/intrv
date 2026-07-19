/**
 * Badges. Import-free and pure, and — deliberately — **derived, never stored**.
 *
 * A badge table would need a write on every grade, a backfill for existing
 * users, and would drift the moment a rule changed. Every rule here is a
 * predicate over stats we already compute for the dashboard and the profile, so
 * a new badge ships without a migration and applies retroactively to everyone.
 *
 * The cost of that choice: a badge cannot record *when* it was earned. If we
 * ever want "unlocked 3 days ago", that needs a table. It does not need one now.
 */

export type BadgeStats = {
  /** Graded, non-ASSESSMENT sessions. */
  gradedCount: number;
  currentStreak: number;
  longestStreak: number;
  xp: number;
  level: number;
  /** Sessions scored 100. */
  perfectCount: number;
  /** Distinct topics practised. */
  topicCount: number;
  /** Graded sessions at HARD or EXPERT. */
  hardCount: number;
  /** Review items that reached the end of the ladder. */
  retiredReviews: number;
  /** DAILY-mode sessions completed. */
  dailyCount: number;
};

export type BadgeTier = "bronze" | "silver" | "gold";

export type Badge = {
  id: string;
  name: string;
  /** What earning it means — shown on the locked state too, as the goal. */
  description: string;
  tier: BadgeTier;
  earned: boolean;
  /** Progress toward the threshold, 0–100. 100 whenever earned. */
  percent: number;
  /** e.g. "3 / 10" — the raw counter, for the locked state. */
  progressLabel: string;
};

type Rule = {
  id: string;
  name: string;
  description: string;
  tier: BadgeTier;
  target: number;
  /** Unit for the progress label, e.g. "sessions". */
  of: (stats: BadgeStats) => number;
};

const RULES: Rule[] = [
  {
    id: "first-run",
    name: "First run",
    description: "Finish one graded interview.",
    tier: "bronze",
    target: 1,
    of: (s) => s.gradedCount,
  },
  {
    id: "ten-runs",
    name: "Regular",
    description: "Finish ten graded interviews.",
    tier: "silver",
    target: 10,
    of: (s) => s.gradedCount,
  },
  {
    id: "fifty-runs",
    name: "Veteran",
    description: "Finish fifty graded interviews.",
    tier: "gold",
    target: 50,
    of: (s) => s.gradedCount,
  },
  {
    id: "streak-3",
    name: "Warming up",
    description: "Practise three days in a row.",
    tier: "bronze",
    target: 3,
    of: (s) => s.longestStreak,
  },
  {
    id: "streak-7",
    name: "Week straight",
    description: "Practise seven days in a row.",
    tier: "silver",
    target: 7,
    of: (s) => s.longestStreak,
  },
  {
    id: "streak-30",
    name: "Unbroken",
    description: "Practise thirty days in a row.",
    tier: "gold",
    target: 30,
    of: (s) => s.longestStreak,
  },
  {
    id: "perfect",
    name: "Clean sheet",
    description: "Score 100% on an interview.",
    tier: "silver",
    target: 1,
    of: (s) => s.perfectCount,
  },
  {
    id: "perfect-5",
    name: "Flawless five",
    description: "Score 100% on five interviews.",
    tier: "gold",
    target: 5,
    of: (s) => s.perfectCount,
  },
  {
    id: "explorer",
    name: "Explorer",
    description: "Practise five different topics.",
    tier: "bronze",
    target: 5,
    of: (s) => s.topicCount,
  },
  {
    id: "deep-end",
    name: "Deep end",
    description: "Finish five interviews at hard or expert.",
    tier: "silver",
    target: 5,
    of: (s) => s.hardCount,
  },
  {
    id: "retained",
    name: "It stuck",
    description: "Carry ten concepts to the end of the review ladder.",
    tier: "gold",
    target: 10,
    of: (s) => s.retiredReviews,
  },
  {
    id: "daily-10",
    name: "Daily habit",
    description: "Complete ten daily challenges.",
    tier: "silver",
    target: 10,
    of: (s) => s.dailyCount,
  },
  {
    id: "hundred-runs",
    name: "Centurion",
    description: "Finish a hundred graded interviews.",
    tier: "gold",
    target: 100,
    of: (s) => s.gradedCount,
  },
  {
    id: "level-5",
    name: "Finding your feet",
    description: "Reach level 5.",
    tier: "bronze",
    target: 5,
    of: (s) => s.level,
  },
  {
    id: "level-15",
    name: "Seasoned",
    description: "Reach level 15.",
    tier: "gold",
    target: 15,
    of: (s) => s.level,
  },
  {
    id: "streak-14",
    name: "Fortnight",
    description: "Practise fourteen days in a row.",
    tier: "silver",
    target: 14,
    of: (s) => s.longestStreak,
  },
  {
    id: "perfect-10",
    name: "Immaculate",
    description: "Score 100% on ten interviews.",
    tier: "gold",
    target: 10,
    of: (s) => s.perfectCount,
  },
  {
    id: "topics-15",
    name: "Polymath",
    description: "Practise fifteen different topics.",
    tier: "silver",
    target: 15,
    of: (s) => s.topicCount,
  },
  {
    id: "expert-20",
    name: "Heavyweight",
    description: "Finish twenty interviews at hard or expert.",
    tier: "gold",
    target: 20,
    of: (s) => s.hardCount,
  },
  {
    id: "daily-30",
    name: "Thirty dailies",
    description: "Complete thirty daily challenges.",
    tier: "gold",
    target: 30,
    of: (s) => s.dailyCount,
  },
];

/** Every badge with its earned state and progress, earned first. */
export function evaluateBadges(stats: BadgeStats): Badge[] {
  const badges = RULES.map((rule) => {
    const have = Math.max(0, rule.of(stats));
    const earned = have >= rule.target;
    return {
      id: rule.id,
      name: rule.name,
      description: rule.description,
      tier: rule.tier,
      earned,
      percent: earned ? 100 : Math.min(100, (have / rule.target) * 100),
      progressLabel: `${Math.min(have, rule.target)} / ${rule.target}`,
    };
  });

  // Earned first, then closest-to-earned — so the locked list reads as a
  // to-do rather than a wall.
  return badges.sort((a, b) => {
    if (a.earned !== b.earned) return a.earned ? -1 : 1;
    return b.percent - a.percent;
  });
}

export function earnedCount(badges: Badge[]): number {
  return badges.filter((b) => b.earned).length;
}

export const BADGE_COUNT = RULES.length;
