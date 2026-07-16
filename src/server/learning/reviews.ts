import "server-only";

/**
 * Spaced-repetition scheduling. Stub — implemented by the learning-loop
 * feature: on a graded session, upsert a ReviewItem per missed concept
 * (stage 0, due in 1 day); on a graded REVIEW session, advance the stage of
 * correctly re-answered concepts (1d → 3d → 7d, then retired) and reset + lapse
 * the ones missed again.
 */
export async function scheduleReviews(_sessionId: string): Promise<void> {
  // Implemented in the learning-loop feature.
}
