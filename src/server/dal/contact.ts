import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * Contact messages: written by anonymous strangers, read only in /admin.
 *
 * Everything in here treats the stored text as hostile. Nothing is rendered as
 * HTML anywhere downstream — see message-list.tsx.
 */

export type ContactMessageRow = {
  id: string;
  name: string;
  email: string;
  subject: string;
  handled: boolean;
  createdAt: Date;
};

export type ContactMessageDetail = ContactMessageRow & { body: string };

export const MESSAGES_PAGE_SIZE = 25;

/**
 * Unhandled first, then newest — this is a queue, and "is it dealt with"
 * outranks "when did it arrive". Matches the [handled, createdAt desc] index.
 */
export async function listContactMessages(opts: { page?: number }): Promise<{
  rows: ContactMessageRow[];
  total: number;
  unhandled: number;
  page: number;
}> {
  const page = Math.max(1, opts.page ?? 1);

  const [rows, total, unhandled] = await Promise.all([
    prisma.contactMessage.findMany({
      orderBy: [{ handled: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * MESSAGES_PAGE_SIZE,
      take: MESSAGES_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        subject: true,
        handled: true,
        createdAt: true,
      },
    }),
    prisma.contactMessage.count(),
    prisma.contactMessage.count({ where: { handled: false } }),
  ]);

  return { rows, total, unhandled, page };
}

/**
 * The body is fetched only for the one message being read, rather than riding
 * along with every row: 25 × 4000 characters per page is a lot of hostile text
 * to ship to a browser that asked to see one of them.
 */
export async function getContactMessage(
  id: string,
): Promise<ContactMessageDetail | null> {
  return prisma.contactMessage.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      subject: true,
      body: true,
      handled: true,
      createdAt: true,
    },
  });
}

// ---------------------------------------------------------------------------
// Form token
//
// Lives here rather than in the action because both sides need it and a
// "use server" module can only export actions — minting a token would become a
// POST endpoint of its own.
// ---------------------------------------------------------------------------

/** A human takes longer than this to fill in four fields. A script does not. */
export const MIN_DWELL_MS = 2_500;

/** A tab left open past this gets a "reload the page", not a lost message. */
const MAX_TOKEN_AGE_MS = 3 * 60 * 60 * 1000;

function sign(issuedAt: string): string {
  return createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(`contact.${issuedAt}`)
    .digest("base64url");
}

/**
 * Stamps when the form was served, signed so it can't be back-dated. Calls
 * Date.now(), so callers must be request-time (await connection()) — under
 * cacheComponents a prerender would otherwise bake one frozen token into the
 * static shell and hand every visitor the same expiring stamp.
 */
export function issueContactToken(): string {
  const issuedAt = String(Date.now());
  return `${issuedAt}.${sign(issuedAt)}`;
}

export type TokenVerdict = "ok" | "invalid" | "stale" | "too-fast";

/**
 * Proves the submission came from a form we served, and how long ago we served
 * it. It is not a nonce: nothing here stops the same token being replayed
 * inside its window. It buys the dwell-time check an unforgeable clock, which
 * an `<input type="hidden" value={Date.now()}>` could never be.
 */
export function verifyContactToken(raw: unknown): TokenVerdict {
  if (typeof raw !== "string") return "invalid";

  const [issuedAt, signature] = raw.split(".");
  if (!issuedAt || !signature || !/^\d{1,15}$/.test(issuedAt)) return "invalid";

  const expected = Buffer.from(sign(issuedAt));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length) return "invalid";
  if (!timingSafeEqual(expected, actual)) return "invalid";

  const age = Date.now() - Number(issuedAt);
  // A negative age means our own clock moved backwards, not a valid form.
  if (age < 0 || age > MAX_TOKEN_AGE_MS) return "stale";
  if (age < MIN_DWELL_MS) return "too-fast";

  return "ok";
}
