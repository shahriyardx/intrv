-- CreateTable
CREATE TABLE "earned_badge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "earnedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionId" TEXT,

    CONSTRAINT "earned_badge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "earned_badge_userId_idx" ON "earned_badge"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "earned_badge_userId_badgeId_key" ON "earned_badge"("userId", "badgeId");

-- AddForeignKey
ALTER TABLE "earned_badge" ADD CONSTRAINT "earned_badge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
