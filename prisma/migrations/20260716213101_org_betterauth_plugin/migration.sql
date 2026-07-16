-- Migrate the hand-rolled org models onto the better-auth `organization` plugin
-- schema (organization / member / invitation + session.activeOrganizationId).
--
-- Written to CARRY EXISTING ROWS: `org_member` is RENAMEd (not dropped), and
-- each organization's `ownerId` is preserved as an owner-role member before the
-- column is removed. The backfill is idempotent (only inserts a missing owner
-- member), so it is a no-op when the owner member already exists — which it
-- always does in our data, since createOrganization inserted it.

-- 1. Preserve ownership: ownerId -> an owner-role member row, if not already one.
INSERT INTO "org_member" ("id", "orgId", "userId", "role", "createdAt")
SELECT gen_random_uuid()::text, o."id", o."ownerId", 'owner', now()
FROM "organization" o
WHERE o."ownerId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "org_member" m
    WHERE m."orgId" = o."id" AND m."userId" = o."ownerId"
  );

-- 2. organization: drop the owner FK + ownerId/updatedAt, add the plugin's
--    logo/metadata, and align createdAt with the plugin's plain timestamp.
ALTER TABLE "organization" DROP CONSTRAINT "organization_ownerId_fkey";
ALTER TABLE "organization"
  DROP COLUMN "ownerId",
  DROP COLUMN "updatedAt",
  ADD COLUMN "logo" TEXT,
  ADD COLUMN "metadata" TEXT,
  ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- 3. session: the active-organization pointer the plugin maintains.
ALTER TABLE "session" ADD COLUMN "activeOrganizationId" TEXT;

-- 4. org_member -> member, orgId -> organizationId, carrying every row. Rename
--    the constraints/indexes to the names Prisma derives for the new model so
--    the resulting schema has no drift.
ALTER TABLE "org_member" RENAME TO "member";
ALTER TABLE "member" RENAME COLUMN "orgId" TO "organizationId";
ALTER TABLE "member" ALTER COLUMN "role" SET DEFAULT 'member';
ALTER TABLE "member" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);
ALTER TABLE "member" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "member" RENAME CONSTRAINT "org_member_pkey" TO "member_pkey";
ALTER TABLE "member" RENAME CONSTRAINT "org_member_orgId_fkey" TO "member_organizationId_fkey";
ALTER TABLE "member" RENAME CONSTRAINT "org_member_userId_fkey" TO "member_userId_fkey";

ALTER INDEX "org_member_userId_idx" RENAME TO "member_userId_idx";
ALTER INDEX "org_member_orgId_userId_key" RENAME TO "member_organizationId_userId_key";

-- The plugin schema indexes organizationId; org_member did not, so add it.
CREATE INDEX "member_organizationId_idx" ON "member"("organizationId");

-- 5. invitation: new, empty.
CREATE TABLE "invitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "inviterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "invitation_organizationId_idx" ON "invitation"("organizationId");

CREATE INDEX "invitation_email_idx" ON "invitation"("email");

ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
