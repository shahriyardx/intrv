"use client";

import { LightningIcon, SpinnerGapIcon } from "@phosphor-icons/react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { startDailyChallenge } from "@/server/actions/daily";

/**
 * Starts today's challenge. On the first visit of a UTC day the action blocks
 * while the set is generated (~60-120s), so the pending copy is deliberately
 * patient and explains the wait rather than looking hung. The action redirects
 * on success; a returned value is an error.
 */
export function StartDailyButton() {
  const [state, formAction, pending] = useActionState(
    startDailyChallenge,
    null,
  );

  return (
    <form action={formAction} className="space-y-3">
      <Button type="submit" size="lg" disabled={pending} className="min-w-52">
        {pending ? (
          <>
            <SpinnerGapIcon className="size-4 animate-spin" />
            Preparing…
          </>
        ) : (
          <>
            <LightningIcon className="size-4" weight="fill" />
            Start today's challenge
          </>
        )}
      </Button>

      {pending ? (
        <p className="max-w-sm text-muted-foreground text-xs">
          If you're the first player today, we're writing today's ten questions
          now — this takes up to a couple of minutes. Hang tight.
        </p>
      ) : null}

      {state?.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
