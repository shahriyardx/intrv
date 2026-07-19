"use client";

import { CheckIcon } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { retireReviewItems } from "@/server/actions/review";

/**
 * "I've got this" — retires review items without answering them.
 *
 * The bulk variants ask first. Retiring one concept is a small, obvious act;
 * clearing a whole queue is not, and there is no undo beyond missing the
 * concept again later, so the destructive-feeling ones get a confirm step
 * rather than a toast-and-hope.
 */
export function RetireButton({
  itemId,
  concept,
  all,
  label,
  confirmLabel,
  size = "sm",
  variant = "ghost",
  className,
}: {
  itemId?: string;
  concept?: string;
  all?: boolean;
  label: string;
  /** When set, the first click asks and the second commits. */
  confirmLabel?: string;
  size?: "default" | "sm";
  variant?: "ghost" | "outline";
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const commit = () => {
    setError(null);
    startTransition(async () => {
      const result = await retireReviewItems({ itemId, concept, all });
      if (!result.ok) setError(result.error);
      setAsking(false);
    });
  };

  const needsConfirm = Boolean(confirmLabel) && !asking;

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Button
        type="button"
        size={size}
        variant={asking ? "outline" : variant}
        disabled={pending}
        onClick={(e) => {
          // This button is rendered inside a <summary> on the mistakes page;
          // without this the click would also toggle the fold open.
          e.preventDefault();
          e.stopPropagation();
          if (needsConfirm) setAsking(true);
          else commit();
        }}
      >
        {!pending && !asking ? (
          <CheckIcon data-icon="inline-start" aria-hidden />
        ) : null}
        {pending ? "Clearing…" : asking ? confirmLabel : label}
      </Button>

      {asking && !pending ? (
        <Button
          type="button"
          size={size}
          variant="ghost"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setAsking(false);
          }}
        >
          Cancel
        </Button>
      ) : null}

      {error ? (
        <span className="text-incorrect text-xs" aria-live="polite">
          {error}
        </span>
      ) : null}
    </span>
  );
}
