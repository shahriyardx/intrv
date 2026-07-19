"use client";

import { ArrowRightIcon, SpinnerGapIcon } from "@phosphor-icons/react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { acceptChallenge } from "@/server/actions/challenge";

/**
 * Clones the challenger's question set and drops the viewer into the runner.
 * acceptChallenge redirects on success, so anything it returns is a failure.
 */
export function AcceptChallengeButton({ shareId }: { shareId: string }) {
  const [pending, start] = useTransition();

  return (
    <Button
      size="lg"
      className="min-w-52"
      disabled={pending}
      onClick={() => {
        start(async () => {
          const result = await acceptChallenge(shareId);
          if (result && !result.ok) toast.error(result.error);
        });
      }}
    >
      {pending ? (
        <>
          <SpinnerGapIcon className="size-4 animate-spin" />
          Setting up…
        </>
      ) : (
        <>
          Accept the challenge
          <ArrowRightIcon className="size-4" />
        </>
      )}
    </Button>
  );
}
