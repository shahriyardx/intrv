import { LightningIcon } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import type { LevelProgress } from "@/server/learning/levels";

/**
 * The level bar — the one piece of the game loop that has to be legible at a
 * glance. Editorial rather than arcade: a hairline track, a mono counter, and
 * the accent reserved for the fill.
 *
 * The bar is decorative; the numbers beside it carry the same information in
 * text, so a reader who cannot see the fill loses nothing.
 */
export function LevelBar({
  level,
  className,
  compact = false,
}: {
  level: LevelProgress;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-2.5">
          <span className="font-display text-display-md leading-none tabular">
            {level.level}
          </span>
          <span className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
            {level.title}
          </span>
        </div>
        <span className="font-mono text-muted-foreground text-xs tabular">
          {level.intoLevel.toLocaleString()} /{" "}
          {level.levelSpan.toLocaleString()} XP
        </span>
      </div>

      <div
        aria-hidden
        className="h-1.5 w-full overflow-hidden rounded-full bg-secondary"
      >
        {/* Zero must render as zero: no min-width floor, no visible sliver. */}
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${level.percent}%` }}
        />
      </div>

      {compact ? null : (
        <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
          <LightningIcon aria-hidden weight="fill" className="size-3.5" />
          {level.toNext.toLocaleString()} XP to level {level.level + 1} ·{" "}
          {level.xp.toLocaleString()} total
        </p>
      )}
    </div>
  );
}
