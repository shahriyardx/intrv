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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { DataLabel } from "@/components/ui/prose";
import { authClient, safeNextPath } from "@/lib/auth-client";

// Mirrors emailAndPassword.minPasswordLength in src/lib/auth.ts.
const MIN_PASSWORD = 8;

const signUpSchema = z.object({
  name: z.string().trim().min(1, "Tell us what to call you.").max(80),
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address.")
    // Deliberately loose: the server owns the real verdict.
    .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "That isn't an email address."),
  password: z
    .string()
    .min(MIN_PASSWORD, `At least ${MIN_PASSWORD} characters.`),
});

type SignUpValues = z.infer<typeof signUpSchema>;

export function SignUpForm({
  next,
  googleEnabled,
}: {
  next?: string;
  googleEnabled: boolean;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [googlePending, setGooglePending] = useState(false);
  // Held true from a successful submit until navigation replaces the page.
  const [redirecting, setRedirecting] = useState(false);

  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const destination = safeNextPath(next);
  const { errors, isSubmitting } = form.formState;
  const pending = isSubmitting || redirecting;
  const busy = pending || googlePending;

  const onSubmit = form.handleSubmit(async ({ name, email, password }) => {
    setFormError(null);
    const result = await authClient.signUp.email({ name, email, password });

    if (result.error) {
      // "User already exists" and friends come from better-auth. Surfacing the
      // real message beats a generic failure the reader can't act on.
      setFormError(
        result.error.message ?? "Could not create your account. Try again.",
      );
      return;
    }

    // No email verification is configured, so sign-up returns a live session and
    // we can go straight through rather than parking on a "check your inbox".
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
          <FieldLabel htmlFor="signup-name">
            <DataLabel>Name</DataLabel>
          </FieldLabel>
          <Input
            id="signup-name"
            type="text"
            autoComplete="name"
            maxLength={80}
            autoFocus
            aria-invalid={errors.name ? true : undefined}
            className="h-10 text-sm"
            {...form.register("name")}
          />
          <FieldError errors={[errors.name]} />
        </Field>

        <Field>
          <FieldLabel htmlFor="signup-email">
            <DataLabel>Email</DataLabel>
          </FieldLabel>
          <Input
            id="signup-email"
            type="email"
            autoComplete="email"
            aria-invalid={errors.email ? true : undefined}
            className="h-10 text-sm"
            {...form.register("email")}
          />
          <FieldError errors={[errors.email]} />
        </Field>

        <Field>
          <FieldLabel htmlFor="signup-password">
            <DataLabel>Password</DataLabel>
          </FieldLabel>
          <Input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            aria-invalid={errors.password ? true : undefined}
            className="h-10 text-sm"
            {...form.register("password")}
          />
          {errors.password ? (
            <FieldError errors={[errors.password]} />
          ) : (
            <FieldDescription>
              {MIN_PASSWORD} characters minimum
            </FieldDescription>
          )}
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
              Creating account…
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>

      <p className="text-muted-foreground text-xs">
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
