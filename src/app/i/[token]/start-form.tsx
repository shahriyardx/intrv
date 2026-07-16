"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRightIcon, SpinnerGapIcon } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { DataLabel } from "@/components/ui/prose";
import { startScreenSession } from "@/server/actions/org";

// Client-side mirror of startScreenSchema — UX only; the action re-validates.
const schema = z.object({
  candidateName: z
    .string()
    .trim()
    .min(1, "Enter your name.")
    .max(80, "Keep your name under 80 characters."),
  candidateEmail: z
    .string()
    .trim()
    .min(1, "Enter your email address.")
    .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "Enter a valid email address.")
    .max(160, "Keep your email under 160 characters."),
});

type Values = z.infer<typeof schema>;

/**
 * The candidate's entry point. Anonymous by design — no account, just a name
 * and an email so the recruiter knows whose report they're reading. On success
 * the action creates the timed session and redirects into it; it only returns
 * here to report an error.
 */
export function StartScreenForm({ token }: { token: string }) {
  // reactCompiler breaks RHF v7's formState Proxy subscription — opt out.
  "use no memo";
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { candidateName: "", candidateEmail: "" },
  });
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const data = new FormData();
      data.set("candidateName", values.candidateName);
      data.set("candidateEmail", values.candidateEmail);
      // Success redirects into the session; only an error object returns.
      const result = await startScreenSession(token, null, data);
      if (result && !result.ok) setServerError(result.error);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Field>
        <FieldLabel htmlFor="candidate-name">
          <DataLabel>Your name</DataLabel>
        </FieldLabel>
        <Input
          id="candidate-name"
          maxLength={80}
          autoComplete="name"
          placeholder="Jane Doe"
          aria-invalid={errors.candidateName ? true : undefined}
          className="h-11"
          {...form.register("candidateName")}
        />
        <FieldError errors={[errors.candidateName]} />
      </Field>

      <Field>
        <FieldLabel htmlFor="candidate-email">
          <DataLabel>Your email</DataLabel>
        </FieldLabel>
        <Input
          id="candidate-email"
          type="email"
          maxLength={160}
          autoComplete="email"
          placeholder="jane@example.com"
          aria-invalid={errors.candidateEmail ? true : undefined}
          className="h-11"
          {...form.register("candidateEmail")}
        />
        <FieldError errors={[errors.candidateEmail]} />
      </Field>

      {serverError ? (
        <p role="alert" className="text-destructive text-sm">
          {serverError}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="min-w-44">
        {pending ? (
          <>
            <SpinnerGapIcon className="size-4 animate-spin" />
            Starting…
          </>
        ) : (
          <>
            Start the interview
            <ArrowRightIcon className="size-4" />
          </>
        )}
      </Button>
      <p className="text-muted-foreground text-xs">
        The timer starts as soon as you begin. Make sure you're ready.
      </p>
    </form>
  );
}
