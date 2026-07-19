import "server-only";

/**
 * Runs after a session reaches GRADED, before the redirect to the result page.
 *
 * This is the learning loop's entry point: it schedules ReviewItems for missed
 * concepts and advances/laps items exercised by a REVIEW session. It is called
 * from submitSession inside a try/catch — a failure here must never cost the
 * student their result.
 *
 * Anonymous sessions no-op: review scheduling only means something for a viewer
 * who can come back to a dashboard.
 */
export async function afterSessionGraded(sessionId: string): Promise<void> {
  const { scheduleReviews } = await import("@/server/learning/reviews");
  const { awardSeasonalBadges } = await import("@/server/learning/awards");

  await scheduleReviews(sessionId);
  // Separate from the review scheduling above: a seasonal badge is the one
  // thing here that cannot be recovered by re-running later, because the
  // window it depends on will have closed.
  await awardSeasonalBadges(sessionId);
}
