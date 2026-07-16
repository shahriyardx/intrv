"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { SpinnerGapIcon } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { DataLabel } from "@/components/ui/prose";
import { createOrganization } from "@/server/actions/org";

// Client-side mirror of orgNameSchema in the action. UX only — the action
// re-validates with its own schema, which stays the security boundary.
const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Give the organization a name of at least 2 characters.")
    .max(80, "Keep the organization name under 80 characters."),
});

type Values = z.infer<typeof schema>;

/**
 * Creating an org redirects to it on success, so the action only ever returns
 * here to report a server-side error (e.g. the 3-org cap).
 */
export function CreateOrgForm() {
  // reactCompiler breaks RHF v7's formState Proxy subscription — opt out.
  "use no memo";
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  });
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = form.handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const data = new FormData();
      data.set("name", values.name);
      // Success redirects (throws NEXT_REDIRECT); only an error object returns.
      const result = await createOrganization(null, data);
      if (result && !result.ok) setServerError(result.error);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Field>
        <FieldLabel htmlFor="org-name">
          <DataLabel>Organization name</DataLabel>
        </FieldLabel>
        <Input
          id="org-name"
          maxLength={80}
          placeholder="e.g. Acme Engineering"
          aria-invalid={form.formState.errors.name ? true : undefined}
          className="h-11"
          {...form.register("name")}
        />
        <FieldError errors={[form.formState.errors.name]} />
      </Field>

      {serverError ? (
        <p role="alert" className="text-destructive text-sm">
          {serverError}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="min-w-40">
        {pending ? (
          <>
            <SpinnerGapIcon className="size-4 animate-spin" />
            Creating…
          </>
        ) : (
          "Create organization"
        )}
      </Button>
    </form>
  );
}
