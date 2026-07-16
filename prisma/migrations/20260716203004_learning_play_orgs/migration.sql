-- CreateEnum
CREATE TYPE "SessionMode" AS ENUM ('CUSTOM', 'JOB_DESCRIPTION', 'DAILY', 'REVIEW', 'REMATCH', 'SCREEN');

-- AlterTable
ALTER TABLE "answer" ADD COLUMN     "timeMs" INTEGER;

-- AlterTable
ALTER TABLE "interview_session" ADD COLUMN     "adaptive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "brief" VARCHAR(2000),
ADD COLUMN     "candidateEmail" VARCHAR(160),
ADD COLUMN     "candidateName" VARCHAR(80),
ADD COLUMN     "dailyChallengeId" TEXT,
ADD COLUMN     "integrity" JSONB,
ADD COLUMN     "mode" "SessionMode" NOT NULL DEFAULT 'CUSTOM',
ADD COLUMN     "rematchOfId" TEXT,
ADD COLUMN     "screenId" TEXT;

-- AlterTable
ALTER TABLE "question" ADD COLUMN     "difficulty" "Difficulty";

-- CreateTable
CREATE TABLE "review_item" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "concept" VARCHAR(120) NOT NULL,
    "topic" VARCHAR(120) NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "stage" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMPTZ(3) NOT NULL,
    "retired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "review_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_challenge" (
    "id" TEXT NOT NULL,
    "dateKey" VARCHAR(10) NOT NULL,
    "topic" VARCHAR(120) NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "questions" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_member" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screen" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "topic" VARCHAR(120) NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "questionCount" INTEGER NOT NULL,
    "timeLimitMs" INTEGER,
    "questions" JSONB NOT NULL,
    "inviteToken" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "screen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "review_item_userId_retired_dueAt_idx" ON "review_item"("userId", "retired", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "review_item_userId_topic_concept_key" ON "review_item"("userId", "topic", "concept");

-- CreateIndex
CREATE UNIQUE INDEX "daily_challenge_dateKey_key" ON "daily_challenge"("dateKey");

-- CreateIndex
CREATE UNIQUE INDEX "organization_slug_key" ON "organization"("slug");

-- CreateIndex
CREATE INDEX "org_member_userId_idx" ON "org_member"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "org_member_orgId_userId_key" ON "org_member"("orgId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "screen_inviteToken_key" ON "screen"("inviteToken");

-- CreateIndex
CREATE INDEX "screen_orgId_createdAt_idx" ON "screen"("orgId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "interview_session_dailyChallengeId_score_idx" ON "interview_session"("dailyChallengeId", "score" DESC);

-- CreateIndex
CREATE INDEX "interview_session_screenId_createdAt_idx" ON "interview_session"("screenId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "interview_session" ADD CONSTRAINT "interview_session_dailyChallengeId_fkey" FOREIGN KEY ("dailyChallengeId") REFERENCES "daily_challenge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_session" ADD CONSTRAINT "interview_session_rematchOfId_fkey" FOREIGN KEY ("rematchOfId") REFERENCES "interview_session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_session" ADD CONSTRAINT "interview_session_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "screen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_item" ADD CONSTRAINT "review_item_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization" ADD CONSTRAINT "organization_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_member" ADD CONSTRAINT "org_member_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_member" ADD CONSTRAINT "org_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screen" ADD CONSTRAINT "screen_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
