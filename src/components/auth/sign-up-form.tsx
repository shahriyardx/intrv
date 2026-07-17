"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  BuildingsIcon,
  GoogleLogoIcon,
  SpinnerGapIcon,
  UserIcon,
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
import { cn } from "@/lib/utils";
import { createOrganization } from "@/server/actions/org";

// Mirrors emailAndPassword.minPasswordLength in src/lib/auth.ts.
const MIN_PASSWORD = 8;

const signUpSchema = z
  .object({
    accountType: z.enum(["personal", "org"]),
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
    orgName: z.string().trim().max(80).optional(),
  })
  // The org name is only required when signing up as an organization.
  .refine((d) => d.accountType !== "org" || (d.orgName?.length ?? 0) >= 2, {
    message: "Give your organization a name of at least 2 characters.",
    path: ["orgName"],
  });

type SignUpValues = z.infer<typeof signUpSchema>;

export function SignUpForm({
  next,
  googleEnabled,
}: {
  next?: string;
  googleEnabled: boolean;
}) {
  // reactCompiler optimizes away RHF v7's formState/watch Proxy access-tracking,
  // so error/isSubmitting/watch changes wouldn't re-render. Opt out until RHF v8.
  "use no memo";
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [googlePending, setGooglePending] = useState(false);
  // Held true from a successful submit until navigation replaces the page.
  const [redirecting, setRedirecting] = useState(false);

  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      accountType: "personal",
      name: "",
      email: "",
      password: "",
      orgName: "",
    },
  });

  const destination = safeNextPath(next);
  const { errors, isSubmitting } = form.formState;
  const isOrg = form.watch("accountType") === "org";
  const pending = isSubmitting || redirecting;
  const busy = pending || googlePending;

  const onSubmit = form.handleSubmit(
    async ({ accountType, name, email, password, orgName }) => {
      setFormError(null);
      const result = await authClient.signUp.email({ name, email, password });

      if (result.error) {
        // A personal signup on an existing email is just "sign in instead".
        // But an organization signup can be a STRANDED retry: the account was
        // created on a first attempt and org creation failed after, leaving a
        // signed-out personal-looking account. Try to sign in with the given
        // credentials and, if that works, continue to org creation below.
        const genericErr =
          result.error.message ?? "Could not create your account. Try again.";
        if (accountType !== "org") {
          setFormError(genericErr);
          return;
        }
        const signIn = await authClient.signIn.email({ email, password });
        if (signIn.error) {
          // Wrong password, or a genuine duplicate we can't recover — surface
          // the original signup error.
          setFormError(genericErr);
          return;
        }
        // Signed in as the stranded account; fall through to org creation.
      }

      setRedirecting(true);

      if (accountType === "org") {
        // Create the one org, which flips the account to an org account (sets
        // activeOrganizationId) and redirects to /org.
        const data = new FormData();
        data.set("name", orgName ?? "");
        const orgResult = await createOrganization(null, data);
        if (orgResult && !orgResult.ok) {
          // A stranded retry whose org actually landed the first time: they
          // already have one, so send them to it rather than error.
          if ("code" in orgResult && orgResult.code === "has_org") {
            router.push("/org");
            router.refresh();
            return;
          }
          setRedirecting(false);
          setFormError(orgResult.error);
        }
        return;
      }

      // No email verification is configured, so sign-up returns a live session
      // and we go straight through rather than parking on "check your inbox".
      router.push(destination as Route);
      router.refresh();
    },
  );

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
        <fieldset className="space-y-2">
          <legend className="mb-2">
            <DataLabel>Account type</DataLabel>
          </legend>
          <div className="grid grid-cols-2 gap-2">
            <AccountTypeCard
              value="personal"
              icon={<UserIcon weight="duotone" className="size-4" />}
              title="Personal"
              blurb="Practice interviews and track your progress."
              register={form.register("accountType")}
            />
            <AccountTypeCard
              value="org"
              icon={<BuildingsIcon weight="duotone" className="size-4" />}
              title="Organization"
              blurb="Assessment candidates with frozen interviews and reports."
              register={form.register("accountType")}
            />
          </div>
        </fieldset>

        {isOrg ? (
          <Field>
            <FieldLabel htmlFor="signup-org">
              <DataLabel>Organization name</DataLabel>
            </FieldLabel>
            <Input
              id="signup-org"
              type="text"
              maxLength={80}
              placeholder="e.g. Acme Engineering"
              aria-invalid={errors.orgName ? true : undefined}
              className="h-10 text-sm"
              {...form.register("orgName")}
            />
            <FieldError errors={[errors.orgName]} />
          </Field>
        ) : null}

        <Field>
          <FieldLabel htmlFor="signup-name">
            <DataLabel>{isOrg ? "Your name" : "Name"}</DataLabel>
          </FieldLabel>
          <Input
            id="signup-name"
            type="text"
            autoComplete="name"
            maxLength={80}
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
              {isOrg ? "Creating organization…" : "Creating account…"}
            </>
          ) : isOrg ? (
            "Create organization account"
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

function AccountTypeCard({
  value,
  icon,
  title,
  blurb,
  register,
}: {
  value: "personal" | "org";
  icon: React.ReactNode;
  title: string;
  blurb: string;
  register: ReturnType<ReturnType<typeof useForm<SignUpValues>>["register"]>;
}) {
  return (
    <label className="cursor-pointer">
      <input
        type="radio"
        value={value}
        className="peer sr-only"
        {...register}
      />
      <div
        className={cn(
          "h-full rounded-md border p-3 transition-colors",
          "peer-checked:border-foreground peer-checked:bg-secondary peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
        )}
      >
        <span className="flex items-center gap-1.5 font-medium text-sm">
          {icon}
          {title}
        </span>
        <span className="mt-1 block text-muted-foreground text-xs leading-snug">
          {blurb}
        </span>
      </div>
    </label>
  );
}
