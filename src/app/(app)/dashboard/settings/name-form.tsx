"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { type AccountState, updateDisplayName } from "@/server/actions/account";

const INITIAL: AccountState = { status: "idle" };

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a display name.")
    .max(80, "Keep it under 80 characters."),
});

type Values = z.infer<typeof schema>;

export function NameForm({ name }: { name: string }) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name },
  });
  const [state, setState] = useState<AccountState>(INITIAL);
  const [pending, startTransition] = useTransition();

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const data = new FormData();
      data.set("name", values.name);
      // The action re-validates and owns the stored value; we mirror its result.
      const result = await updateDisplayName(INITIAL, data);
      setState(result);
      if (result.status === "saved") form.reset({ name: result.name });
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      <Field>
        <FieldLabel htmlFor="name">Display name</FieldLabel>
        <div className="flex flex-wrap items-start gap-2">
          <Input
            id="name"
            maxLength={80}
            aria-invalid={form.formState.errors.name ? true : undefined}
            aria-describedby="name-status"
            className="max-w-xs"
            {...form.register("name")}
          />
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
        <FieldError errors={[form.formState.errors.name]} />
      </Field>

      <p id="name-status" aria-live="polite" className="min-h-4 text-xs">
        {state.status === "error" ? (
          <span className="text-incorrect">{state.error}</span>
        ) : state.status === "saved" ? (
          <span className="text-muted-foreground">
            Saved. You're {state.name}.
          </span>
        ) : null}
      </p>
    </form>
  );
}
