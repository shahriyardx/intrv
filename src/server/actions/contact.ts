"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireFreshAdmin } from "@/server/dal/admin";
import { verifyContactToken } from "@/server/dal/contact";

/**
 * /contact is the only unauthenticated write endpoint in this app, and a Server
 * Function is a POST endpoint reachable directly — the form that rendered the
 * fields proves nothing about what arrives here. Everything below re-derives
 * its own facts: the guards run against the request, not against the UI.
 */

export type ContactField = "name" | "email" | "subject" | "body";

export type ContactState =
  | { status: "idle" }
  | { status: "sent" }
  | {
      status: "error";
      /** Form-level; shown above the submit button. */
      error?: string;
      fieldErrors?: Partial<Record<ContactField, string>>;
    };

/**
 * Mirrors ContactMessage.body VarChar(4000). The column is the authority, not
 * the form: a value over it is a 500 from Postgres, so it is checked here even
 * though the textarea also caps it. Not exported — a "use server" module can
 * only export actions, and the form mirrors the same column itself.
 */
const BODY_MAX = 4000;

// Control characters can smuggle line breaks and terminal escapes into text an
// operator will read; a name or a subject has no honest use for them. The body
// keeps \t, \n and \r because it is prose someone typed into a textarea.
// biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting them is the point
const CONTROL = /[\u0000-\u001f\u007f]/;
// biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting them is the point
const CONTROL_EXCEPT_BREAKS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Tell us what to call you.")
    .max(80, "Keep your name under 80 characters.")
    .refine((v) => !CONTROL.test(v), "Your name contains control characters."),
  email: z
    .email("That isn't an email address.")
    .trim()
    .max(160, "Keep your email under 160 characters."),
  subject: z
    .string()
    .trim()
    .min(1, "Give it a subject — it's what we scan the queue by.")
    .max(160, "Keep the subject under 160 characters.")
    .refine(
      (v) => !CONTROL.test(v),
      "The subject contains control characters.",
    ),
  body: z
    .string()
    .trim()
    .min(10, "Ten characters minimum — give us something to work with.")
    .max(BODY_MAX, `Keep it under ${BODY_MAX} characters.`)
    .refine(
      (v) => !CONTROL_EXCEPT_BREAKS.test(v),
      "Your message contains control characters.",
    ),
});

// ---------------------------------------------------------------------------
// Abuse guards
// ---------------------------------------------------------------------------

/**
 * Per-IP, per hour. Deliberately low: nobody has three genuinely different
 * things to tell us in an hour, and the ones who do can wait.
 */
const IP_LIMIT = 3;
const IP_WINDOW_MS = 60 * 60 * 1000;

/** Per email address, per hour. Survives restarts; the IP window does not. */
const EMAIL_LIMIT = 3;

/**
 * Across everyone, per hour. A backstop against a distributed flood filling the
 * table faster than a person could ever read it. The trade-off is real and
 * chosen knowingly: an attacker who saturates this locks out legitimate senders
 * for the rest of the hour. It sits high enough that only an actual flood
 * reaches it, and losing an hour of the contact form beats losing the inbox.
 */
const GLOBAL_LIMIT = 60;

/**
 * Process-local, because there is nowhere to put it: ContactMessage has no `ip`
 * column and the schema is fixed, so an IP window cannot be persisted without
 * storing the IP of everyone who writes to us — which this product should not
 * do anyway.
 *
 * Consequences, stated plainly: it resets on deploy, and each instance counts
 * on its own, so N instances mean an effective limit of N × IP_LIMIT. It is a
 * speed bump. The persistent limits below are what actually bound the damage.
 */
type IpHits = Map<string, number[]>;

// On globalThis for the same reason the Prisma pool is: an HMR reload swaps
// this module, and a plain module-level Map would hand every dev edit a fresh,
// empty rate limiter.
const globalForContact = globalThis as { __contactIpHits?: IpHits };
const ipHits: IpHits = globalForContact.__contactIpHits ?? new Map();
globalForContact.__contactIpHits = ipHits;

/**
 * Both headers are attacker-supplied unless a trusted proxy overwrites them,
 * and nothing here can tell the difference — anyone willing to send a different
 * X-Forwarded-For gets a fresh bucket every time. That is why this limit is one
 * layer of several and not the answer on its own.
 */
async function clientIp(): Promise<string> {
  const head = await headers();
  const forwarded = head.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || head.get("x-real-ip")?.trim() || "unknown";
}

function ipRateLimited(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - IP_WINDOW_MS;

  // Sweep the whole map, not just this key: without it, every IP that ever
  // posted stays resident for the life of the process.
  for (const [key, hits] of ipHits) {
    const live = hits.filter((at) => at > cutoff);
    if (live.length === 0) ipHits.delete(key);
    else ipHits.set(key, live);
  }

  const hits = ipHits.get(ip) ?? [];
  if (hits.length >= IP_LIMIT) return true;

  ipHits.set(ip, [...hits, now]);
  return false;
}

const TOO_MANY =
  "That's a few messages in a short time. Give it an hour and try again.";

export async function sendContactMessage(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  // Honeypot first: it costs nothing and catches the cheapest bots. The reply
  // is the same success the form gives a human — a bot that learns it was
  // caught is a bot that gets fixed.
  if (String(formData.get("company") ?? "") !== "") {
    return { status: "sent" };
  }

  switch (verifyContactToken(formData.get("token"))) {
    case "too-fast":
      return {
        status: "error",
        error: "That was quick. Take a moment and submit again.",
      };
    case "stale":
      return {
        status: "error",
        error: "This page has been open a while. Reload it and resend.",
      };
    case "invalid":
      return {
        status: "error",
        error: "Something went wrong with this form. Reload the page.",
      };
    case "ok":
      break;
  }

  const parsed = contactSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    subject: String(formData.get("subject") ?? ""),
    body: String(formData.get("body") ?? ""),
  });

  if (!parsed.success) {
    const fieldErrors: Partial<Record<ContactField, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as ContactField | undefined;
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { status: "error", fieldErrors };
  }

  if (ipRateLimited(await clientIp())) {
    return { status: "error", error: TOO_MANY };
  }

  const since = new Date(Date.now() - IP_WINDOW_MS);
  const [fromEmail, total] = await Promise.all([
    prisma.contactMessage.count({
      where: { email: parsed.data.email, createdAt: { gte: since } },
    }),
    prisma.contactMessage.count({ where: { createdAt: { gte: since } } }),
  ]);

  if (fromEmail >= EMAIL_LIMIT || total >= GLOBAL_LIMIT) {
    return { status: "error", error: TOO_MANY };
  }

  try {
    await prisma.contactMessage.create({ data: parsed.data });
  } catch (error) {
    // Whatever went wrong is ours, and the reader can do nothing with it. The
    // detail goes to the logs; they get a way forward.
    console.error("[contact] failed to store message", error);
    return {
      status: "error",
      error: "We couldn't save that. Try again in a minute.",
    };
  }

  revalidatePath("/admin/messages");
  return { status: "sent" };
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export type HandledState = { ok: true } | { ok: false; error: string };

const handledSchema = z.object({
  id: z.uuid(),
  handled: z.enum(["true", "false"]).transform((v) => v === "true"),
});

/**
 * requireFreshAdmin, not the page's gate: this endpoint is reachable without
 * ever loading /admin/messages, and the cookie cache would let an admin who was
 * demoted five minutes ago keep working the queue.
 */
export async function setMessageHandled(
  _prev: HandledState | null,
  formData: FormData,
): Promise<HandledState> {
  const admin = await requireFreshAdmin();
  // The same flat refusal every admin surface gives — a distinct error would
  // confirm to a stranger that this endpoint means something.
  if (!admin) return { ok: false, error: "Not found." };

  const parsed = handledSchema.safeParse({
    id: formData.get("id"),
    handled: formData.get("handled"),
  });
  if (!parsed.success) return { ok: false, error: "Not found." };

  try {
    await prisma.contactMessage.update({
      where: { id: parsed.data.id },
      data: { handled: parsed.data.handled },
    });
  } catch (error) {
    console.error("[contact] failed to update handled state", error);
    return { ok: false, error: "Couldn't update that message." };
  }

  revalidatePath("/admin/messages");
  return { ok: true };
}
