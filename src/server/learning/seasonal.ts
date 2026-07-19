/**
 * Seasonal badges: earned inside a window, kept forever.
 *
 * Import-free and pure, so the windows and the matching rules are testable
 * without a database or a clock.
 *
 * **Why these cannot be derived.** Every other badge in the app is recomputed
 * from current counters on each read (see badges.ts), which is what lets a new
 * rule apply retroactively. A seasonal badge cannot work that way: re-running
 * "took a FIFA interview before 20 July 2026" on 21 July returns false, and the
 * badge would vanish the day the season closed. So these are *captured* — the
 * award writes an EarnedBadge row and that row is the fact from then on.
 *
 * The window is checked once, at the moment of earning. Nothing re-checks it,
 * and nothing deletes an award.
 */

export type SeasonalBadge = {
  id: string;
  name: string;
  description: string;
  /** Shown while the season is open, so people know it is going away. */
  seasonLabel: string;
  /** Inclusive start, exclusive end — both UTC instants. */
  opensAt: Date;
  closesAt: Date;
  /**
   * Lowercased words, any of which appearing in the session topic earns it.
   * Substring rather than exact match: the topic is free text a user typed, so
   * "FIFA World Cup 2026" and "fifa tactics" both count.
   */
  topicMatches: string[];
};

export const SEASONAL_BADGES: SeasonalBadge[] = [
  {
    id: "fifa-2026",
    name: "World Cup 2026",
    description: "Took a FIFA interview during the 2026 World Cup.",
    seasonLabel: "Season · closes 20 July 2026",
    opensAt: new Date("2026-06-01T00:00:00.000Z"),
    // Exclusive end at the start of the 21st, so the whole of the 20th counts.
    closesAt: new Date("2026-07-21T00:00:00.000Z"),
    topicMatches: ["fifa", "world cup"],
  },
];

/** Whether `at` falls inside the badge's window. */
export function isSeasonOpen(badge: SeasonalBadge, at: Date): boolean {
  const t = at.getTime();
  return t >= badge.opensAt.getTime() && t < badge.closesAt.getTime();
}

/** Seasons currently accepting awards. */
export function openSeasons(at: Date): SeasonalBadge[] {
  return SEASONAL_BADGES.filter((badge) => isSeasonOpen(badge, at));
}

/**
 * Does this topic earn the badge?
 *
 * Case- and punctuation-insensitive on the topic side, because it is free text.
 * Difficulty is deliberately not considered — the brief is "any difficulty",
 * and gating a commemorative badge on a rung would make it a skill badge.
 */
export function topicEarns(badge: SeasonalBadge, topic: string): boolean {
  const haystack = topic.toLowerCase();
  return badge.topicMatches.some((needle) => haystack.includes(needle));
}

/**
 * Which seasonal badges a graded session earns, given when it was graded.
 *
 * Returns ids; the caller persists them. An empty array is the normal case.
 */
export function seasonalAwardsFor(input: {
  topic: string;
  gradedAt: Date;
}): string[] {
  return openSeasons(input.gradedAt)
    .filter((badge) => topicEarns(badge, input.topic))
    .map((badge) => badge.id);
}

export function seasonalById(id: string): SeasonalBadge | undefined {
  return SEASONAL_BADGES.find((badge) => badge.id === id);
}
