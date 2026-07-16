"use client";

import { ArrowRightIcon, SpinnerGapIcon } from "@phosphor-icons/react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataLabel } from "@/components/ui/prose";
import { startScreenSession } from "@/server/actions/org";

/**
 * The candidate's entry point. Anonymous by design — no account, just a name
 * and an email so the recruiter knows whose report they're reading. On success
 * the action creates the timed session and redirects into it; it only returns
 * here to report an error.
 */
export function StartScreenForm({ token }: { token: string }) {
  const action = startScreenSession.bind(null, token);
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label asChild>
          <DataLabel>Your name</DataLabel>
        </Label>
        <Input
          name="candidateName"
          required
          maxLength={80}
          autoComplete="name"
          placeholder="Jane Doe"
          className="h-11"
        />
      </div>

      <div className="space-y-2">
        <Label asChild>
          <DataLabel>Your email</DataLabel>
        </Label>
        <Input
          name="candidateEmail"
          type="email"
          required
          maxLength={160}
          autoComplete="email"
          placeholder="jane@example.com"
          className="h-11"
        />
      </div>

      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
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
      <p className="text-xs text-muted-foreground">
        The timer starts as soon as you begin. Make sure you're ready.
      </p>
    </form>
  );
}
