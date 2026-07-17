"use client";

import { ArrowRightIcon, SpinnerGapIcon } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { startAssessmentSession } from "@/server/actions/org";

/**
 * The candidate's entry point. There is nothing to fill in: the name and email
 * the recruiter reads come from the signed-in account, server-side, so the
 * report says who actually sat the assessment rather than whatever was typed
 * into a box. On success the action creates the timed session and redirects
 * into it; it only returns here to report an error.
 */
export function StartAssessmentForm({ token }: { token: string }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setServerError(null);
        startTransition(async () => {
          const result = await startAssessmentSession(token);
          if (result && !result.ok) setServerError(result.error);
        });
      }}
    >
      {serverError ? (
        <p role="alert" className="text-destructive text-sm">
          {serverError}
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

      <p className="text-muted-foreground text-xs">
        The timer starts as soon as you begin. Make sure you're ready.
      </p>
    </form>
  );
}
