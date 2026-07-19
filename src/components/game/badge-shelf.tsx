"use client";

import { BadgeArt } from "@/components/game/badge-art";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ShelfBadge = {
  id: string;
  name: string;
  description: string;
  tier: string;
};

/**
 * A row of earned badges, each openable for what it is.
 *
 * **Popover, not tooltip.** The first attempt used Radix's Tooltip with a
 * controlled `open`, and it could be opened but never closed: Tooltip's trigger
 * closes on pointer-down by design, so the click handler that was meant to
 * toggle it reopened it a moment later. Tooltip is a hover primitive — hover is
 * pointer-only, and this sits on a public page people open on phones. Popover
 * is the one built for click, and it brings outside-click, Escape and focus
 * handling with it rather than having them reimplemented here.
 *
 * Styling comes from ui/popover.tsx, which mirrors ui/tooltip.tsx — including
 * its arrow offset. Hand-rolling that here left the arrow floating in the gap
 * above the panel.
 *
 * Only earned badges are ever passed in: what someone has not done is not a
 * thing to publish about them.
 */
export function BadgeShelf({
  badges,
  className,
  size = "size-8",
}: {
  badges: ShelfBadge[];
  className?: string;
  size?: string;
}) {
  if (badges.length === 0) return null;

  return (
    <ul className={cn("flex flex-wrap items-center gap-2", className)}>
      {badges.map((badge) => (
        <li key={badge.id}>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex rounded-sm transition-opacity hover:opacity-75 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
              >
                <BadgeArt
                  id={badge.id}
                  earned
                  className={size}
                  title={badge.name}
                />
              </button>
            </PopoverTrigger>

            <PopoverContent
              side="bottom"
              collisionPadding={12}
              className="flex flex-col gap-0.5"
            >
              <span className="flex items-baseline gap-2">
                <span className="font-medium">{badge.name}</span>
                <span className="font-mono text-[0.625rem] uppercase tracking-[0.12em] opacity-70">
                  {badge.tier}
                </span>
              </span>
              <span className="opacity-80">{badge.description}</span>
            </PopoverContent>
          </Popover>
        </li>
      ))}
    </ul>
  );
}
