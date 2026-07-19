"use client";

import { BadgeArt } from "@/components/game/badge-art";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
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
 * **Popover, not tooltip.** A first attempt controlled a Tooltip's `open` and
 * it could be opened but never closed: Tooltip's trigger closes on pointer-down
 * by design, so the toggle handler reopened it a beat later. Tooltip is a hover
 * primitive regardless, and hover is pointer-only on a page people open on
 * phones. Popover is the one built for click and brings outside-click, Escape
 * and focus handling with it.
 *
 * The primitive is shadcn's, unmodified. A hand-written stand-in came before
 * it and drew its own arrow, which floated in the gap above the panel — the
 * house popover has no arrow at all, which is both the correct look here and
 * one less thing to get wrong.
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

            {/* Narrower than the w-72 default: this is one line of name and one
                of description, and a fixed 18rem panel hanging off a 32px mark
                reads as a menu rather than a label. */}
            <PopoverContent
              side="bottom"
              collisionPadding={12}
              className="w-auto max-w-60 gap-1.5"
            >
              <PopoverHeader className="flex-row items-baseline gap-2">
                <PopoverTitle>{badge.name}</PopoverTitle>
                <span className="font-mono text-[0.625rem] text-muted-foreground uppercase tracking-[0.12em]">
                  {badge.tier}
                </span>
              </PopoverHeader>
              <PopoverDescription>{badge.description}</PopoverDescription>
            </PopoverContent>
          </Popover>
        </li>
      ))}
    </ul>
  );
}
