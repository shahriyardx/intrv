/**
 * Promote an existing user to admin.
 *
 *   bun run prisma/seed.ts you@example.com
 *
 * There is no credential here and no user is created: sign up through the app
 * like anyone else, then run this against the address you used. A seed script
 * that invents a password is a seed script that ships one to production.
 *
 * Idempotent — run it as often as you like.
 *
 * It builds its own PrismaClient rather than importing src/lib/db.ts, which is
 * `server-only` and throws the moment a plain Node/Bun process imports it.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const ADMIN_ROLE = "admin";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();

  if (!email) {
    console.error("Usage: bun run prisma/seed.ts <email>");
    console.error("Promotes an existing, already signed-up user to admin.");
    process.exitCode = 1;
    return;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set. Is .env in place?");
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    // Case-insensitive: better-auth normalizes on sign-up, but an operator
    // retyping their own address from memory should not get "no such user".
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, email: true, name: true, role: true, banned: true },
    });

    if (!user) {
      console.error(`No user with the email ${email}.`);
      console.error(
        "Sign up in the app first, then re-run this with that address.",
      );
      process.exitCode = 1;
      return;
    }

    if (user.role === ADMIN_ROLE) {
      console.log(`${user.email} is already an admin. Nothing to do.`);
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: ADMIN_ROLE },
      });
      console.log(
        `Promoted ${user.email} from "${user.role ?? "user"}" to admin.`,
      );
    }

    if (user.banned) {
      // A banned admin fails isAdmin(), so promotion alone wouldn't let them in.
      console.warn(
        `Note: ${user.email} is banned, and a banned admin is still locked out. Lift the ban first.`,
      );
    }

    console.log("Open /admin to confirm.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
