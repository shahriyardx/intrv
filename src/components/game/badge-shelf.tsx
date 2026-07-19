"use client";

import { Popover } from "radix-ui";
import { BadgeArt } from "@/components/game/badge-art";
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
          <Popover.Root>
            <Popover.Trigger asChild>
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
            </Popover.Trigger>

            <Popover.Portal>
              <Popover.Content
                side="bottom"
                sideOffset={8}
                collisionPadding={12}
                className="z-50 flex w-fit max-w-64 origin-(--radix-popover-content-transform-origin) flex-col gap-0.5 bg-foreground px-3 py-2 text-background text-xs data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
              >
                <span className="flex items-baseline gap-2">
                  <span className="font-medium">{badge.name}</span>
                  <span className="font-mono text-[0.625rem] uppercase tracking-[0.12em] opacity-70">
                    {badge.tier}
                  </span>
                </span>
                <span className="opacity-80">{badge.description}</span>
                <Popover.Arrow className="size-2.5 translate-y-[-1px] rotate-45 bg-foreground fill-foreground" />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </li>
      ))}
    </ul>
  );
}
