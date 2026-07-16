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

// Mirrors emailAndPassword.minPasswordLength in src/lib/auth.ts. No account can
// have a shorter password, so checking it here saves a rate-limited round-trip.
const MIN_PASSWORD = 8;

type FieldErrors = { email?: string; password?: string };

export function SignInForm({
  next,
  googleEnabled,
}: {
  next?: string;
  googleEnabled: boolean;
}) {
  const router = useRouter();
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
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");

    const errors: FieldErrors = {};
    if (!email) errors.email = "Enter your email address.";
    else if (!EMAIL.test(email)) errors.email = "That isn't an email address.";
    if (!password) errors.password = "Enter your password.";
    else if (password.length < MIN_PASSWORD) {
      errors.password = `Passwords are at least ${MIN_PASSWORD} characters.`;
    }

    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length > 0) return;

    setPending(true);
    const result = await authClient.signIn.email({ email, password });

    if (result.error) {
      setPending(false);
      // Whatever better-auth says — wrong password, rate limited, banned — is
      // more use to the reader than a house-written euphemism for it.
      setFormError(result.error.message ?? "Could not sign you in. Try again.");
      return;
    }

    // Stays pending on purpose: the button must not flicker back to life while
    // the navigation is in flight.
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
          id={emailId}
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          error={fieldErrors.email}
          autoFocus
        />

        <Field
          id={passwordId}
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          error={fieldErrors.password}
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
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>

      <p className="text-xs text-muted-foreground">
        No account?{" "}
        <Link
          href={
            next
              ? (`/sign-up?next=${encodeURIComponent(next)}` as Route)
              : "/sign-up"
          }
          className="text-foreground underline underline-offset-4 hover:no-underline"
        >
          Create one
        </Link>
        .
      </p>
    </div>
  );
}

function Field({
  id,
  label,
  error,
  className,
  ...props
}: React.ComponentProps<typeof Input> & {
  id: string;
  label: string;
  error?: string;
}) {
  const errorId = `${id}-error`;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        <DataLabel>{label}</DataLabel>
      </Label>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
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
