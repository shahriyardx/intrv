"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  CheckCircleIcon,
  SpinnerGapIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { DataLabel } from "@/components/ui/prose";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  type ContactField,
  type ContactState,
  sendContactMessage,
} from "@/server/actions/contact";

const INITIAL: ContactState = { status: "idle" };

/**
 * Mirrors ContactMessage.body VarChar(4000), which is what both this counter
 * and the action's schema answer to.
 */
const BODY_MAX = 4000;

/** Past this the counter stops being decoration and starts being a warning. */
const COUNTER_WARN_AT = BODY_MAX - 200;

// Client-side mirror of the action's contactSchema — UX only. The action
// re-validates everything (including control-char and rate-limit checks), which
// stays the security boundary.
const schema = z.object({
  name: z.string().trim().min(1, "Tell us what to call you.").max(80),
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address.")
    .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "That isn't an email address.")
    .max(160),
  subject: z
    .string()
    .trim()
    .min(1, "Give it a subject — it's what we scan the queue by.")
    .max(160),
  body: z
    .string()
    .trim()
    .min(10, "Ten characters minimum — give us something to work with.")
    .max(BODY_MAX),
});

type Values = z.infer<typeof schema>;

export function ContactForm({ token }: { token: string }) {
  // reactCompiler breaks RHF v7's formState Proxy subscription — opt out.
  "use no memo";
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", subject: "", body: "" },
  });
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { errors } = form.formState;
  // A stable ref, not the submit event's currentTarget: RHF awaits async
  // validation before calling this, by which point React has nulled the event's
  // currentTarget. The ref still carries the honeypot and the hidden token.
  const formRef = useRef<HTMLFormElement>(null);

  const onSubmit = form.handleSubmit(() => {
    if (!formRef.current) return;
    const data = new FormData(formRef.current);
    setFormError(null);
    startTransition(async () => {
      const result = await sendContactMessage(INITIAL, data);
      if (result.status === "sent") {
        setSent(true);
        return;
      }
      if (result.status === "error") {
        if (result.fieldErrors) {
          for (const [field, message] of Object.entries(result.fieldErrors)) {
            form.setError(field as ContactField, { message });
          }
        }
        if (result.error) setFormError(result.error);
      }
    });
  });

  if (sent) return <Sent />;

  const bodyLength = form.watch("body")?.length ?? 0;

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-5">
      {/* The signed stamp of when this form was served. The action refuses a
          submission that beats a human to it, or one carrying no stamp. */}
      <input type="hidden" name="token" value={token} />

      <Honeypot />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="contact-name">
            <DataLabel>Name</DataLabel>
          </FieldLabel>
          <Input
            id="contact-name"
            autoComplete="name"
            maxLength={80}
            disabled={pending}
            aria-invalid={errors.name ? true : undefined}
            className="h-10 text-sm"
            {...form.register("name")}
          />
          <FieldError errors={[errors.name]} />
        </Field>

        <Field>
          <FieldLabel htmlFor="contact-email">
            <DataLabel>Email</DataLabel>
          </FieldLabel>
          <Input
            id="contact-email"
            type="email"
            autoComplete="email"
            maxLength={160}
            disabled={pending}
            aria-invalid={errors.email ? true : undefined}
            className="h-10 text-sm"
            {...form.register("email")}
          />
          <FieldError errors={[errors.email]} />
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor="contact-subject">
          <DataLabel>Subject</DataLabel>
        </FieldLabel>
        <Input
          id="contact-subject"
          autoComplete="off"
          maxLength={160}
          placeholder="Short answers are graded too harshly"
          disabled={pending}
          aria-invalid={errors.subject ? true : undefined}
          className="h-10 text-sm"
          {...form.register("subject")}
        />
        <FieldError errors={[errors.subject]} />
      </Field>

      <Field>
        <FieldLabel htmlFor="contact-body">
          <DataLabel>Message</DataLabel>
        </FieldLabel>
        <Textarea
          id="contact-body"
          rows={8}
          maxLength={BODY_MAX}
          disabled={pending}
          aria-invalid={errors.body ? true : undefined}
          aria-describedby="contact-body-counter"
          className="min-h-40 text-sm"
          {...form.register("body")}
        />
        <div className="flex items-start justify-between gap-4">
          <FieldError errors={[errors.body]} />
          {/* Polite, and only interesting near the ceiling: a count announced on
              every keystroke makes the field unusable with a screen reader. */}
          <p
            id="contact-body-counter"
            aria-live="polite"
            className={cn(
              "ml-auto shrink-0 font-mono text-[0.6875rem] tabular",
              bodyLength > COUNTER_WARN_AT
                ? "text-destructive"
                : "text-muted-foreground",
            )}
          >
            {bodyLength} / {BODY_MAX}
          </p>
        </div>
      </Field>

      {formError ? (
        <p
          role="alert"
          className="flex items-start gap-2 border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive text-xs"
        >
          <WarningIcon
            className="mt-px size-3.5 shrink-0"
            weight="fill"
            aria-hidden
          />
          {formError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg" className="min-w-40" disabled={pending}>
          {pending ? (
            <>
              <SpinnerGapIcon className="size-4 animate-spin" />
              Sending…
            </>
          ) : (
            "Send message"
          )}
        </Button>
        <p className="text-muted-foreground text-xs">
          Your address is only ever used to write back.
        </p>
      </div>
    </form>
  );
}

/**
 * A field nobody is meant to find: hidden from sighted users and from assistive
 * tech alike, so anything in it came from something reading the markup rather
 * than the page.
 *
 * Off-screen rather than `display:none`: a browser skips a hidden field, but so
 * do the bots worth catching — they fill in what the DOM offers. This stays a
 * real, laid-out field, out of the tab order and out of the accessibility tree.
 */
function Honeypot() {
  return (
    <div
      aria-hidden
      className="-left-[9999px] pointer-events-none absolute top-0 h-px w-px overflow-hidden"
    >
      <label htmlFor="contact-company">Company</label>
      <input
        id="contact-company"
        name="company"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        defaultValue=""
      />
    </div>
  );
}

/**
 * Replaces the form rather than announcing itself and vanishing. The only
 * question the sender has is "did that go anywhere", and this answers it.
 */
function Sent() {
  return (
    // <output>, not a div with role="status": this is literally the result of a
    // form submission, and it carries the live region for free.
    <output className="block border border-correct/30 bg-correct-muted/40 p-8">
      <CheckCircleIcon
        className="size-6 text-correct"
        weight="duotone"
        aria-hidden
      />
      <h2 className="mt-4 font-display text-display-md">We've got it.</h2>
      <div className="mt-3 max-w-[54ch] space-y-3 text-muted-foreground text-sm leading-relaxed">
        <p>
          Your message is saved and in the queue. Nothing was emailed to you and
          there's no auto-reply — it went into a list a person reads, and if it
          needs an answer you'll get one at the address you gave us.
        </p>
        <p>
          Thought of something else? Send another. We'll work out that they're
          the same conversation.
        </p>
      </div>
    </output>
  );
}
