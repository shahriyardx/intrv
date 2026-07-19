import { BadgeArt } from "@/components/game/badge-art";
import { cn } from "@/lib/utils";
import type { Badge as BadgeModel, BadgeTier } from "@/server/learning/badges";

/**
 * Badges, earned and not. The locked ones are shown on purpose — a badge you
 * cannot see is not a goal — but they are muted and carry their own progress
 * counter so the grid reads as a to-do list rather than a wall of failure.
 *
 * The artwork is in badge-art.tsx: hue names the family, the ring names the
 * tier, the engraving names the badge. Tier is never carried by colour alone.
 */
const TIER_LABEL: Record<BadgeTier, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
};

export function BadgeGrid({
  badges,
  className,
}: {
  badges: BadgeModel[];
  className?: string;
}) {
  return (
    <ul
      className={cn(
        "grid gap-px border bg-border sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {badges.map((badge) => (
        <BadgeCard key={badge.id} badge={badge} />
      ))}
    </ul>
  );
}

function BadgeCard({ badge }: { badge: BadgeModel }) {
  return (
    <li
      className={cn(
        "flex gap-3.5 bg-background p-4",
        !badge.earned && "text-muted-foreground",
      )}
    >
      <BadgeArt
        id={badge.id}
        tier={badge.tier}
        earned={badge.earned}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <p
            className={cn(
              "truncate text-sm",
              badge.earned && "font-medium text-foreground",
            )}
          >
            {badge.name}
          </p>
          <span className="shrink-0 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
            {badge.earned ? TIER_LABEL[badge.tier] : badge.progressLabel}
          </span>
        </div>

        <p className="text-xs leading-relaxed">{badge.description}</p>

        {badge.earned ? (
          <p className="sr-only">Earned.</p>
        ) : (
          <>
            <p className="sr-only">
              Not earned: {badge.progressLabel} of the way there.
            </p>
            <div
              aria-hidden
              className="h-0.5 w-full overflow-hidden rounded-full bg-secondary"
            >
              <div
                className="h-full rounded-full bg-muted-foreground/50"
                style={{ width: `${badge.percent}%` }}
              />
            </div>
          </>
        )}
      </div>
    </li>
  );
}
