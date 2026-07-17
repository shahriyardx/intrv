import { WarningIcon } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { DataLabel } from "@/components/ui/prose";
import { cn } from "@/lib/utils";

/**
 * A single number with its name and, when there is one, the context that stops
 * it being misread. Serif and tabular to match the score on the result page —
 * the house voice for a figure.
 *
 * `tone` is for a number that is itself the bad news (a failure rate, a
 * collapsed cache ratio). The warning tone renders its own icon and a
 * assessment-reader prefix here rather than trusting each caller to add one: a red
 * number and a black one are the same number to a reader who cannot tell them
 * apart, so colour is never allowed to be the only signal.
 */
export function StatTile({
  label,
  value,
  note,
  tone = "default",
  className,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: "default" | "warning";
  className?: string;
}) {
  const isWarning = tone === "warning";

  return (
    <div className={cn("border-t pt-4", className)}>
      <DataLabel>{label}</DataLabel>
      <p
        className={cn(
          "mt-2 flex items-center gap-1.5 font-display text-display-md tabular leading-none",
          isWarning && "text-partial",
        )}
      >
        {isWarning ? (
          <>
            <WarningIcon
              aria-hidden
              className="size-4 shrink-0"
              weight="fill"
            />
            <span className="sr-only">Warning: </span>
          </>
        ) : null}
        {value}
      </p>
      {note ? (
        <p className="mt-2 text-xs text-muted-foreground">{note}</p>
      ) : null}
    </div>
  );
}

/** The standard four-across row these tiles are laid out in. */
export function StatRow({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
      {children}
    </div>
  );
}
