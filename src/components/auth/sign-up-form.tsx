"use client";

import {
  GoogleLogoIcon,
  SpinnerGapIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataLabel } from "@/components/ui/prose";
import { authClient, safeNextPath } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

// Deliberately loose: the server owns the real verdict, and a strict regex here
// only ever rejects an address that would have worked.
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Mirrors emailAndPassword.minPasswordLength in src/lib/auth.ts.
const MIN_PASSWORD = 8;

type FieldErrors = { name?: string; email?: string; password?: string };

export function SignUpForm({
  next,
  googleEnabled,
}: {
  next?: string;
  googleEnabled: boolean;
}) {
  const router = useRouter();
  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const formErrorId = useId();

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);

  const destination = safeNextPath(next);
  const busy = pending || googlePending;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");

    const errors: FieldErrors = {};
    if (!name) errors.name = "Tell us what to call you.";
    if (!email) errors.email = "Enter your email address.";
    else if (!EMAIL.test(email)) errors.email = "That isn't an email address.";
    if (password.length < MIN_PASSWORD) {
      errors.password = `At least ${MIN_PASSWORD} characters.`;
    }

    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length > 0) return;

    setPending(true);
    const result = await authClient.signUp.email({ name, email, password });

    if (result.error) {
      setPending(false);
      // "User already exists" and friends come from better-auth. Surfacing the
      // real message beats a generic failure the reader can't act on.
      setFormError(
        result.error.message ?? "Could not create your account. Try again.",
      );
      return;
    }

    // No email verification is configured, so sign-up returns a live session and
    // we can go straight through rather than parking on a "check your inbox".
    router.push(destination as Route);
    router.refresh();
  }

  async function onGoogle() {
    setFormError(null);
    setGooglePending(true);

    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL: destination,
    });

    if (result.error) {
      setGooglePending(false);
      setFormError(result.error.message ?? "Google sign-in failed. Try again.");
    }
  }

  return (
    <div className="space-y-6">
      {googleEnabled ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            disabled={busy}
            onClick={onGoogle}
          >
            {googlePending ? (
              <SpinnerGapIcon className="size-4 animate-spin" />
            ) : (
              <GoogleLogoIcon className="size-4" weight="fill" />
            )}
            Continue with Google
          </Button>
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <DataLabel>or</DataLabel>
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      ) : null}

      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <Field
          id={nameId}
          label="Name"
          name="name"
          type="text"
          autoComplete="name"
          maxLength={80}
          error={fieldErrors.name}
          autoFocus
        />

        <Field
          id={emailId}
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          error={fieldErrors.email}
        />

        <Field
          id={passwordId}
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          error={fieldErrors.password}
          hint={`${MIN_PASSWORD} characters minimum`}
        />

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

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={busy}
          aria-describedby={formError ? formErrorId : undefined}
        >
          {pending ? (
            <>
              <SpinnerGapIcon className="size-4 animate-spin" />
              Creating account…
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>

      <p className="text-xs text-muted-foreground">
        Already have an account?{" "}
        <Link
          href={
            next
              ? (`/sign-in?next=${encodeURIComponent(next)}` as Route)
              : "/sign-in"
          }
          className="text-foreground underline underline-offset-4 hover:no-underline"
        >
          Sign in
        </Link>
        .
      </p>
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  className,
  ...props
}: React.ComponentProps<typeof Input> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
}) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>
          <DataLabel>{label}</DataLabel>
        </Label>
        {hint ? (
          <span id={hintId} className="text-xs text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </div>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn("h-10 text-sm", className)}
        {...props}
      />
      {error ? (
        // role="alert" as well as aria-describedby: the latter is only read once
        // focus reaches the field, so without this a failed submit is announced
        // as nothing at all.
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
