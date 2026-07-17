import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ContactForm } from "@/components/marketing/contact-form";
import { Measure } from "@/components/ui/page";
import { DataLabel, Prose } from "@/components/ui/prose";
import { Skeleton } from "@/components/ui/skeleton";
import { issueContactToken } from "@/server/dal/contact";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Tell us what's broken, what's confusing, or what's missing. A person reads every message.",
};

const EXPECTATIONS = [
  {
    title: "A person reads it",
    body: "Not a ticket system, not a bot. Intrv is small and free, so there's no SLA and no queue position — but nothing sent here goes into a void either.",
  },
  {
    title: "Days, sometimes longer",
    body: "That's the honest answer on reply time. If it matters that it's soon, say why in the message — that's what gets something looked at first.",
  },
  {
    title: "Some things we can't do",
    body: "We can't recover an interview you took signed out and lost the link to: that link is the only key it ever had. And we can't say what gets built next, because mostly we don't know yet.",
  },
  {
    title: "It's not an email",
    body: "There's no mail provider here. Your message is stored and read in an admin queue, and a reply comes back to the address you gave us.",
  },
];

export default function ContactPage() {
  return (
    <Measure>
      <DataLabel>Contact</DataLabel>
      <h1 className="mt-3 font-display text-display-lg text-balance">
        Tell us what went wrong
      </h1>

      <Prose className="mt-8 text-lg text-muted-foreground">
        <p>
          Bugs, bad grading, a question that made no sense, something you think
          is missing — all of it is worth sending. This form is the whole
          support department.
        </p>
      </Prose>

      <section className="mt-10 border-l-2 border-accent pl-5">
        <h2 className="font-display text-base">If something's broken</h2>
        <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
          Four things turn a report we can't act on into one we can: what you
          were doing, the topic you'd picked, roughly when it happened, and what
          you expected instead. If you still have the interview link, paste it —
          it's the fastest way for us to see what you saw.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="sr-only">Send a message</h2>
        {/* FormSlot is request-time by necessity (see below), so it gets its own
            boundary — without one, the whole route loses its static shell. */}
        <Suspense fallback={<FormSkeleton />}>
          <FormSlot />
        </Suspense>
      </section>

      <section className="mt-16 border-t pt-10">
        <h2 className="font-display text-display-md">What to expect</h2>
        <dl className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {EXPECTATIONS.map((item) => (
            <div key={item.title}>
              <dt className="font-display text-base">{item.title}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.body}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </Measure>
  );
}

/**
 * The token is minted per request and signed, so the action can tell how long
 * the form was actually on screen. connection() is what marks that request-time:
 * under cacheComponents a prerender would bake one token into the static shell
 * and hand every visitor the same stamp — one that expires for all of them at
 * the same moment.
 */
async function FormSlot() {
  await connection();
  return <ContactForm token={issueContactToken()} />;
}

function FormSkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      <div className="grid gap-5 sm:grid-cols-2">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
      <Skeleton className="h-16" />
      <Skeleton className="h-48" />
      <Skeleton className="h-11 w-40" />
    </div>
  );
}
