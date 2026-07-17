-- Rename Screen -> Assessment.
--
-- Hand-written on purpose. Prisma sees a renamed model as a dropped table plus
-- a new one, which would throw away every assessment and every candidate
-- attempt. These are pure renames: the rows, the enum values already stored in
-- interview_session.mode, and the foreign keys all survive untouched.

-- Postgres renames an enum value in place, so rows holding 'SCREEN' now read
-- 'ASSESSMENT' without a rewrite.
ALTER TYPE "SessionMode" RENAME VALUE 'SCREEN' TO 'ASSESSMENT';

ALTER TABLE "screen" RENAME TO "assessment";
ALTER TABLE "interview_session" RENAME COLUMN "screenId" TO "assessmentId";

-- RENAME leaves indexes and constraints under their old names. Prisma compares
-- them by name, so leaving these would show as permanent drift.
ALTER INDEX "screen_pkey" RENAME TO "assessment_pkey";
ALTER INDEX "screen_inviteToken_key" RENAME TO "assessment_inviteToken_key";
ALTER INDEX "screen_orgId_createdAt_idx" RENAME TO "assessment_orgId_createdAt_idx";
ALTER TABLE "assessment" RENAME CONSTRAINT "screen_orgId_fkey" TO "assessment_orgId_fkey";

ALTER INDEX "interview_session_screenId_createdAt_idx" RENAME TO "interview_session_assessmentId_createdAt_idx";
ALTER TABLE "interview_session" RENAME CONSTRAINT "interview_session_screenId_fkey" TO "interview_session_assessmentId_fkey";
