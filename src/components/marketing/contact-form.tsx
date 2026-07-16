"use client";

import {
  CheckCircleIcon,
  SpinnerGapIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataLabel } from "@/components/ui/prose";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  type ContactState,
  sendContactMessage,
} from "@/server/actions/contact";

const INITIAL: ContactState = { status: "idle" };

/**
 * Mirrors ContactMessage.body VarChar(4000), which is what both this counter
 * and the action's schema answer to. It isn't imported from the action: a
 * "use server" module can only export async functions.
 */
const BODY_MAX = 4000;

/** Past this the counter stops being decoration and starts being a warning. */
const COUNTER_WARN_AT = BODY_MAX - 200;

export function ContactForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(
    sendContactMessage,
    INITIAL,
  );

  // Controlled, and that is load-bearing: React resets an uncontrolled form
  // once its action settles, so a rejected submission would hand back four
  // empty fields and a list of what was wrong with them.
  const [values, setValues] = useState({
    name: "",
    email: "",
    subject: "",
    body: "",
  });
  const set = (field: keyof typeof values) => (value: string) =>
    setValues((prev) => ({ ...prev, [field]: value }));

  const nameId = useId();
  const emailId = useId();
  const subjectId = useId();
  const bodyId = useId();
  const counterId = useId();
  const formErrorId = useId();

  if (state.status === "sent") return <Sent />;

  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const formError = state.status === "error" ? state.error : undefined;

  return (
    <form action={formAction} noValidate className="space-y-5">
      {/* The signed stamp of when this form was served. The action refuses a
          submission that beats a human to it, or one carrying no stamp. */}
      <input type="hidden" name="token" value={token} />

      <Honeypot />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id={nameId}
          label="Name"
          name="name"
          autoComplete="name"
          maxLength={80}
          value={values.name}
          onValueChange={set("name")}
          error={fieldErrors?.name}
          disabled={pending}
        />
        <Field
          id={emailId}
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          maxLength={160}
          value={values.email}
          onValueChange={set("email")}
          error={fieldErrors?.email}
          disabled={pending}
        />
      </div>

      <Field
        id={subjectId}
        label="Subject"
        name="subject"
        autoComplete="off"
        maxLength={160}
        placeholder="Short answers are graded too harshly"
        value={values.subject}
        onValueChange={set("subject")}
        error={fieldErrors?.subject}
        disabled={pending}
      />

      <div className="space-y-2">
        <Label htmlFor={bodyId}>
          <DataLabel>Message</DataLabel>
        </Label>
        <Textarea
          id={bodyId}
          name="body"
          rows={8}
          maxLength={BODY_MAX}
          value={values.body}
          onChange={(event) => set("body")(event.target.value)}
          disabled={pending}
          aria-invalid={fieldErrors?.body ? true : undefined}
          aria-describedby={
            fieldErrors?.body ? `${bodyId}-error ${counterId}` : counterId
          }
          className="min-h-40 text-sm"
        />
        <div className="flex items-start justify-between gap-4">
          {fieldErrors?.body ? (
            <p
              id={`${bodyId}-error`}
              role="alert"
              className="text-xs text-destructive"
            >
              {fieldErrors.body}
            </p>
          ) : (
            <span />
          )}
          {/* Polite, and only interesting near the ceiling: a count announced on
              every keystroke makes the field unusable with a screen reader. */}
          <p
            id={counterId}
            aria-live="polite"
            className={cn(
              "shrink-0 font-mono text-[0.6875rem] tabular",
              values.body.length > COUNTER_WARN_AT
                ? "text-destructive"
                : "text-muted-foreground",
            )}
          >
            {values.body.length} / {BODY_MAX}
          </p>
        </div>
      </div>

      {formError ? (
        <p
          id={formErrorId}
          role="alert"
          className="flex items-start gap-2 border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
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
        <Button
          type="submit"
          size="lg"
          className="min-w-40"
          disabled={pending}
          aria-describedby={formError ? formErrorId : undefined}
        >
          {pending ? (
            <>
              <SpinnerGapIcon className="size-4 animate-spin" />
              Sending…
            </>
          ) : (
            "Send message"
          )}
        </Button>
        <p className="text-xs text-muted-foreground">
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
      className="pointer-events-none absolute top-0 -left-[9999px] h-px w-px overflow-hidden"
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
 * question the sender has is "did that go anywhere", and a toast answers it for
 * four seconds.
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
      <div className="mt-3 max-w-[54ch] space-y-3 text-sm leading-relaxed text-muted-foreground">
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

function Field({
  id,
  label,
  error,
  className,
  onValueChange,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "onChange"> & {
  id: string;
  label: string;
  error?: string;
  onValueChange: (value: string) => void;
}) {
  const errorId = `${id}-error`;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        <DataLabel>{label}</DataLabel>
      </Label>
      <Input
        id={id}
        onChange={(event) => onValueChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn("h-10 text-sm", className)}
        {...props}
      />
      {error ? (
        // role="alert" as well as aria-describedby: the latter is only read once
        // focus reaches the field, so without it a failed submit is announced as
        // nothing at all.
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
