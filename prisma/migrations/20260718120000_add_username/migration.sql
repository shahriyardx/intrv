-- Username plugin fields plus our once-only-change flag.
ALTER TABLE "user" ADD COLUMN "username" TEXT;
ALTER TABLE "user" ADD COLUMN "displayUsername" TEXT;
ALTER TABLE "user" ADD COLUMN "usernameChanged" BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing accounts with a unique handle so the unique index below
-- holds and nobody is left without a username. New accounts get a readable
-- random handle from the databaseHook in auth.ts; these fallback handles are
-- deliberately plain and can be changed once, like any other.
UPDATE "user" AS u
SET "username" = h.handle,
    "displayUsername" = h.handle
FROM (
  SELECT id, 'user-' || left(md5(random()::text || id), 8) AS handle
  FROM "user"
) AS h
WHERE u.id = h.id
  AND u."username" IS NULL;

CREATE UNIQUE INDEX "user_username_key" ON "user"("username");
