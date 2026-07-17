"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Prose } from "@/components/ui/prose";
import { isValidUsername, USERNAME_MAX, USERNAME_MIN } from "@/lib/username";
import { changeUsername, type UsernameState } from "@/server/actions/account";

const INITIAL: UsernameState = { status: "idle" };

// Client mirror of the server rule via the shared validator — UX only; the
// action re-checks with the same lib/username.ts and returns the precise
// per-problem message, so a single message here is enough.
const schema = z.object({
  username: z.string().refine(isValidUsername, {
    message: `${USERNAME_MIN}–${USERNAME_MAX} characters: lowercase letters, numbers, and single hyphens.`,
  }),
});

type Values = z.infer<typeof schema>;

/**
 * A username is changeable exactly once. After that this renders read-only: the
 * server is the real gate (it checks the DB flag, not the cookie), so the lock
 * here is only to explain, never to enforce.
 */
export function UsernameForm({
  username,
  changed,
}: {
  username: string | null;
  changed: boolean;
}) {
  // reactCompiler breaks RHF v7's formState Proxy subscription — opt out.
  "use no memo";
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { username: username ?? "" },
  });
  const [state, setState] = useState<UsernameState>(INITIAL);
  const [current, setCurrent] = useState(username);
  const [locked, setLocked] = useState(changed);
  const [pending, startTransition] = useTransition();

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const data = new FormData();
      data.set("username", values.username);
      const result = await changeUsername(INITIAL, data);
      setState(result);
      if (result.status === "saved") {
        setCurrent(result.username);
        setLocked(true);
        form.reset({ username: result.username });
      }
    });
  });

  if (locked) {
    return (
      <div className="space-y-2">
        <FieldLabel htmlFor="username-locked">Username</FieldLabel>
        <Input
          id="username-locked"
          readOnly
          value={current ?? ""}
          className="max-w-xs font-mono"
        />
        <Prose className="text-xs text-muted-foreground">
          <p>
            Your profile lives at{" "}
            <span className="font-mono">/u/{current}</span>. A username can only
            be changed once, and you've used that change.
          </p>
        </Prose>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      <Field>
        <FieldLabel htmlFor="username">Username</FieldLabel>
        <div className="flex flex-wrap items-start gap-2">
          <Input
            id="username"
            minLength={USERNAME_MIN}
            maxLength={USERNAME_MAX}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={form.formState.errors.username ? true : undefined}
            aria-describedby="username-status"
            className="max-w-xs font-mono"
            {...form.register("username")}
          />
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
        <FieldError errors={[form.formState.errors.username]} />
      </Field>

      <Prose className="text-xs text-muted-foreground">
        <p>
          {USERNAME_MIN}–{USERNAME_MAX} characters: lowercase letters, numbers,
          and hyphens.{" "}
          <strong className="text-foreground">You can change this once</strong>,
          so pick one you'll keep — it's your public profile at{" "}
          <span className="font-mono">/u/{current}</span>.
        </p>
      </Prose>

      <p id="username-status" aria-live="polite" className="min-h-4 text-xs">
        {state.status === "error" ? (
          <span className="text-incorrect">{state.error}</span>
        ) : state.status === "saved" ? (
          <span className="text-muted-foreground">
            Saved. You're {state.username}.
          </span>
        ) : null}
      </p>
    </form>
  );
}
