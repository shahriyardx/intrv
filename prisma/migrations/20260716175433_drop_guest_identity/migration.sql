/*
  Warnings:

  - You are about to drop the column `guestId` on the `interview_session` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "interview_session_guestId_createdAt_idx";

-- AlterTable
ALTER TABLE "interview_session" DROP COLUMN "guestId";
