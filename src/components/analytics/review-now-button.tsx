"use client";

import { ArrowRightIcon } from "@phosphor-icons/react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  type ReviewActionError,
  startReviewSession,
} from "@/server/actions/review";

/**
 * Kicks off a review session. The action redirects on success, so the only
 * thing this island renders back is the "nothing due" error — which the caller
 * already gates against, making it a rare-race fallback rather than a normal
 * state. useActionState is here for the pending label during generation setup.
 */
export function ReviewNowButton({
  label = "Review now",
  size = "default",
}: {
  label?: string;
  size?: "default" | "sm";
}) {
  const [state, formAction, pending] = useActionState<
    ReviewActionError | null,
    FormData
  >(async () => {
    // startReviewSession takes no args; the redirect throws past this return.
    return (await startReviewSession()) ?? null;
  }, null);

  return (
    <form action={formAction}>
      <Button type="submit" size={size} disabled={pending}>
        {pending ? "Preparing…" : label}
        {!pending && <ArrowRightIcon data-icon="inline-end" aria-hidden />}
      </Button>
      {state?.ok === false ? (
        <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
