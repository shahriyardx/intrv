"use client";

import { ArrowRightIcon } from "@phosphor-icons/react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { Difficulty } from "@/lib/schemas";
import {
  type ReviewActionError,
  startPlannedSession,
} from "@/server/actions/review";

/**
 * Starts a planned practice session for one suggestion. topic/difficulty are
 * re-validated server-side inside the action; this island only carries them and
 * shows the pending label while generation is set up.
 */
export function StartPlannedButton({
  topic,
  difficulty,
}: {
  topic: string;
  difficulty: Difficulty;
}) {
  const [state, formAction, pending] = useActionState<
    ReviewActionError | null,
    FormData
  >(async () => (await startPlannedSession(topic, difficulty)) ?? null, null);

  return (
    <form action={formAction}>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Preparing…" : "Start"}
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
