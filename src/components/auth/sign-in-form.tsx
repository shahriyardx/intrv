"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  GoogleLogoIcon,
  SpinnerGapIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { DataLabel } from "@/components/ui/prose";
import { authClient, safeNextPath } from "@/lib/auth-client";

// Mirrors emailAndPassword.minPasswordLength in src/lib/auth.ts. No account can
// have a shorter password, so checking it here saves a rate-limited round-trip.
const MIN_PASSWORD = 8;

const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address.")
    // Deliberately loose: the server owns the real verdict, and a strict regex
    // only ever rejects an address that would have worked.
    .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "That isn't an email address."),
  password: z
    .string()
    .min(MIN_PASSWORD, `Passwords are at least ${MIN_PASSWORD} characters.`),
});

type SignInValues = z.infer<typeof signInSchema>;

export function SignInForm({
  next,
  googleEnabled,
}: {
  next?: string;
  googleEnabled: boolean;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [googlePending, setGooglePending] = useState(false);
  // Held true from a successful submit until navigation replaces the page, so
  // the button never flickers back to life mid-redirect.
  const [redirecting, setRedirecting] = useState(false);

  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const destination = safeNextPath(next);
  const { errors, isSubmitting } = form.formState;
  const pending = isSubmitting || redirecting;
  const busy = pending || googlePending;

  const onSubmit = form.handleSubmit(async ({ email, password }) => {
    setFormError(null);
    const result = await authClient.signIn.email({ email, password });

    if (result.error) {
      // Whatever better-auth says — wrong password, rate limited, banned — is
      // more use to the reader than a house-written euphemism for it.
      setFormError(result.error.message ?? "Could not sign you in. Try again.");
      return;
    }

    setRedirecting(true);
    router.push(destination as Route);
    router.refresh();
  });

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
        <Field>
          <FieldLabel htmlFor="signin-email">
            <DataLabel>Email</DataLabel>
          </FieldLabel>
          <Input
            id="signin-email"
            type="email"
            autoComplete="email"
            autoFocus
            aria-invalid={errors.email ? true : undefined}
            className="h-10 text-sm"
            {...form.register("email")}
          />
          <FieldError errors={[errors.email]} />
        </Field>

        <Field>
          <FieldLabel htmlFor="signin-password">
            <DataLabel>Password</DataLabel>
          </FieldLabel>
          <Input
            id="signin-password"
            type="password"
            autoComplete="current-password"
            aria-invalid={errors.password ? true : undefined}
            className="h-10 text-sm"
            {...form.register("password")}
          />
          <FieldError errors={[errors.password]} />
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

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
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

      <p className="text-muted-foreground text-xs">
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
