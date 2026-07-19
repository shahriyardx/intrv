import { cn } from "@/lib/utils";
import type { BadgeTier } from "@/server/learning/badges";

/**
 * Badge artwork: two panes of coloured glass per badge.
 *
 * Each mark is built from exactly two translucent shapes — a soft back pane and
 * a sharper front one — in two hues that belong together. Where they overlap,
 * the blend makes a third tone the code never names. That is the whole visual
 * idea, and it is why nothing here has an outline or a container: the shape of
 * the object *is* the badge, so a rocket reads as a rocket rather than as a
 * rocket parked inside a coin.
 *
 * Colour still carries meaning rather than decoration. Five hue pairs cover
 * twelve badges, one per family — volume, habit, precision, breadth,
 * retention — so the grid reads as groups instead of confetti. Every hue comes
 * from the validated `--chart-*` ramp, which is already checked in both themes.
 *
 * **Tier is not drawn.** An earlier version spent a ring on it, which forced
 * every badge into a circle and made twelve different objects look like twelve
 * coins. Bronze/silver/gold is already spelled out in text beside each badge,
 * which is both clearer and readable to someone who cannot see the artwork at
 * all.
 *
 * Locked badges collapse to one neutral ink at low opacity. Desaturating a
 * colour still reads as a colour; removing it reads as "not yet", and the
 * silhouette still says which badge it is.
 */

type Family = "volume" | "habit" | "precision" | "breadth" | "retention";

/**
 * A hue pair per family: the back pane and the front one. Neighbours on the
 * ramp rather than opposites — two hues that argue produce mud where they
 * overlap, which is exactly the area meant to look like glass.
 */
const FAMILY_HUES: Record<Family, { back: string; front: string }> = {
  // blue → violet: how much you've done
  volume: { back: "var(--chart-1)", front: "var(--chart-7)" },
  // orange → red: showing up, day after day
  habit: { back: "var(--chart-4)", front: "var(--chart-6)" },
  // teal → green: getting it exactly right
  precision: { back: "var(--chart-5)", front: "var(--chart-2)" },
  // violet → pink: range
  breadth: { back: "var(--chart-7)", front: "var(--chart-3)" },
  // amber → orange: what stuck
  retention: { back: "var(--chart-4)", front: "var(--chart-6)" },
};

const BADGE_FAMILY: Record<string, Family> = {
  "first-run": "volume",
  "ten-runs": "volume",
  "fifty-runs": "volume",
  "streak-3": "habit",
  "streak-7": "habit",
  "streak-30": "habit",
  "daily-10": "habit",
  perfect: "precision",
  "perfect-5": "precision",
  explorer: "breadth",
  "deep-end": "breadth",
  retained: "retention",
  "hundred-runs": "volume",
  "level-5": "volume",
  "level-15": "volume",
  "streak-14": "habit",
  "daily-30": "habit",
  "perfect-10": "precision",
  "topics-15": "breadth",
  "expert-20": "breadth",
};

/** Opacity of each pane. Low enough that the overlap is visibly a third tone. */
const BACK_ALPHA = 0.38;
const FRONT_ALPHA = 0.72;

/**
 * The marks. Each is `(back, front)` — two shapes, drawn on a 32-unit grid,
 * filling it edge to edge because there is no frame to sit inside.
 *
 * They are objects, not diagrams: a rocket for a first launch, a sprout for
 * something that took root, a paper plane for going further out. Playful is the
 * point — this is the half of the product that is a game.
 */
const MARKS: Record<string, { back: string; front: string }> = {
  // First run — a rocket leaving the pad.
  "first-run": {
    back: "M16 2c4.4 3.7 6.8 8.7 6.8 14.4 0 3.4-.9 6.4-2.4 9H11.6c-1.5-2.6-2.4-5.6-2.4-9C9.2 10.7 11.6 5.7 16 2Z",
    front:
      "M11.6 25.4h8.8l-1 2.6a1 1 0 0 1-.9.6h-5a1 1 0 0 1-.9-.6l-1-2.6ZM9.2 16.6 4.6 21a1 1 0 0 0-.3.7v3.5l4.9-3.4v-5.2Zm13.6 0 4.6 4.4a1 1 0 0 1 .3.7v3.5l-4.9-3.4v-5.2Z",
  },

  // Ten runs — a stack that has started to build.
  "ten-runs": {
    back: "M4 21a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v7H6a2 2 0 0 1-2-2v-5Z",
    front:
      "M13 13a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v15h-8a2 2 0 0 1-2-2V13Zm9-9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v24h-6V4Z",
  },

  // Fifty runs — a summit, with the climb behind it.
  "fifty-runs": {
    back: "M2 27 11 12l6 10-3.5 5H2Z",
    front: "M12 27 21 9l9 18H12Zm9-13.5 2.6 5.2h-5.2L21 13.5Z",
  },

  // Three days — a small flame, just caught.
  "streak-3": {
    back: "M16 3c5 4.4 8 8.6 8 13.2a8 8 0 0 1-16 0C8 12.9 9.4 10.4 12 8c.7 2 1.6 3.2 3 3.9-.5-3.6.1-6.3 1-8.9Z",
    front:
      "M16 30a5 5 0 0 1-5-5c0-2.3 1.6-4.2 3.2-6.4.5 1.3 1.1 2 2 2.5-.3-2.3.4-4 1.4-5.6 2.4 2.6 3.4 5.2 3.4 7.5a5 5 0 0 1-5 5Z",
  },

  // A week — a campfire. Three days is a flame you are still shielding; seven
  // is a fire someone built, with logs under it. Same family, different object,
  // so the two do not read as the same badge twice.
  "streak-7": {
    back: "M16 1c5.2 4.4 8.4 8.8 8.4 13.6 0 4.2-2.6 7.4-6.2 8.6H13.8c-3.6-1.2-6.2-4.4-6.2-8.6C7.6 11 9.2 8.2 12 5.6c.8 2.2 1.7 3.4 3.1 4.2C14.4 6 15 3.5 16 1Z",
    front:
      "M4.8 24.4a1.6 1.6 0 0 1 2.2-.6l18 9.4-1.5 2.8-18-9.4a1.6 1.6 0 0 1-.7-2.2Zm22.4 0a1.6 1.6 0 0 1-.7 2.2l-18 9.4-1.5-2.8 18-9.4a1.6 1.6 0 0 1 2.2.6Z",
  },

  // Thirty days — a month, marked off.
  "streak-30": {
    back: "M3 8a3 3 0 0 1 3-3h20a3 3 0 0 1 3 3v18a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8Z",
    front:
      "M3 13h26v3H3v-3Zm6-11a1.5 1.5 0 0 1 1.5 1.5V7a1.5 1.5 0 0 1-3 0V3.5A1.5 1.5 0 0 1 9 2Zm14 0a1.5 1.5 0 0 1 1.5 1.5V7a1.5 1.5 0 0 1-3 0V3.5A1.5 1.5 0 0 1 23 2ZM10.6 21.4l3.2 3.2 7.4-7.4 2.1 2.1-9.5 9.5-5.3-5.3 2.1-2.1Z",
  },

  // Clean sheet — a dart in the middle of the board.
  perfect: {
    back: "M16 3a13 13 0 1 1 0 26 13 13 0 0 1 0-26Zm0 6a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z",
    front:
      "M16 12.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Zm4.6-1.1 6.6-6.6-.5 4.3 4.3-.5-6.6 6.6-3.8-3.8Z",
  },

  // Five perfect — a crown, because five in a row is a flourish.
  "perfect-5": {
    back: "M4 24h24a2 2 0 0 1 0 4H4a2 2 0 0 1 0-4Z",
    front:
      "M2 8.5 9.5 15 16 4l6.5 11L30 8.5 27 22H5L2 8.5Zm14-1.2 4.4 7.4h-8.8L16 7.3Z",
  },

  // Explorer — a paper plane, going somewhere new.
  explorer: {
    back: "M30 3 2 14.5l10 3.8L30 3Z",
    front: "M30 3 12 18.3l1.2 10.4 4.6-6.2 7.4 3.3L30 3Z",
  },

  // Deep end — a loaded bar. Hard and expert are the heavy plates, and a
  // dumbbell says "this was the difficult one" without another arrow or
  // chevron, which every other progress mark in the app already uses.
  "deep-end": {
    back: "M2 12.5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 7 12.5v7A1.5 1.5 0 0 1 5.5 21h-2A1.5 1.5 0 0 1 2 19.5v-7Zm23 0a1.5 1.5 0 0 1 1.5-1.5h2a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5h-2a1.5 1.5 0 0 1-1.5-1.5v-7Z",
    front:
      "M7 9a2 2 0 0 1 2-2h1.5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V9Zm12.5 0a2 2 0 0 1 2-2H23a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-1.5a2 2 0 0 1-2-2V9ZM12 14.5h8v3h-8v-3Z",
  },

  // It stuck — a sprout that took root.
  retained: {
    back: "M6 22h20l-1.6 7.2a1 1 0 0 1-1 .8H8.6a1 1 0 0 1-1-.8L6 22Z",
    front:
      "M15 22V13.5c-4.4 0-8-3.4-8-7.6 4.4 0 8 3.4 8 7.6V13c0-4 3.2-7.3 7.2-7.3.7 0 1.4.1 2 .3-.5 4.4-4.3 7.8-8.9 7.8h-.3V22h-3Z",
  },

  // A hundred runs — a trophy. The summit was fifty; this is what you get for
  // keeping going after it.
  "hundred-runs": {
    back: "M9 3h14v10a7 7 0 0 1-14 0V3Z",
    front:
      "M14 19h4v5h-4v-5Zm-5 6h14a1.5 1.5 0 0 1 0 3H9a1.5 1.5 0 0 1 0-3ZM7 4H3.5A1.5 1.5 0 0 0 2 5.5v2A6.5 6.5 0 0 0 8.5 14H9v-3h-.5A3.5 3.5 0 0 1 5 7.5V7h2V4Zm18 0h3.5A1.5 1.5 0 0 1 30 5.5v2A6.5 6.5 0 0 1 23.5 14H23v-3h.5A3.5 3.5 0 0 0 27 7.5V7h-2V4Z",
  },

  // Level five — rank chevrons. The one mark that is a symbol rather than an
  // object, because a level is not a thing you can hold.
  "level-5": {
    back: "M16 17 6 26h20l-10-9Z",
    front: "M16 6 4 17h5.5L16 11.2 22.5 17H28L16 6Z",
  },

  // Level fifteen — the same chevrons, doubled and topped with a star.
  "level-15": {
    back: "M16 20 6 29h20l-10-9Zm0-7L6 22h20l-10-9Z",
    front:
      "M16 1l2.9 6 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5L6.6 7.9 13.1 7 16 1Z",
  },

  // Two weeks — a torch. The campfire stayed put; this one you carry.
  "streak-14": {
    back: "M16 2c4.6 3.8 7.2 7.4 7.2 11.4a7.2 7.2 0 0 1-14.4 0C8.8 10.4 10.2 8 12.6 5.8c.7 1.9 1.5 3 2.7 3.6C14.7 6.2 15.2 4.1 16 2Z",
    front:
      "M12.4 20h7.2l-1.1 9.2a1 1 0 0 1-1 .8h-3a1 1 0 0 1-1-.8L12.4 20Zm3.6-5.4c1.8 1.9 2.7 3.4 2.7 4.8a2.7 2.7 0 1 1-5.4 0c0-1.4.9-2.9 2.7-4.8Z",
  },

  // Thirty dailies — an alarm clock, because a daily is a thing you show up for.
  "daily-30": {
    back: "M16 6a11 11 0 1 1 0 22 11 11 0 0 1 0-22Z",
    front:
      "M15 10h2v7.6l4.4 2.6-1 1.7-5.4-3.2V10ZM5.8 2.4l3.4 2.4-2 2.9-3.4-2.4a1.8 1.8 0 0 1 2-2.9Zm20.4 0a1.8 1.8 0 0 1 2 2.9l-3.4 2.4-2-2.9 3.4-2.4ZM8.6 27.4l-2.4 2.8a1.6 1.6 0 0 1-2.4-2.1l2.4-2.8 2.4 2.1Zm14.8 0 2.4-2.1 2.4 2.8a1.6 1.6 0 0 1-2.4 2.1l-2.4-2.8Z",
  },

  // Ten perfect — a cut gem. Flawless, and it took a while.
  "perfect-10": {
    back: "M8 4h16l6 8-14 17L2 12l6-8Z",
    front: "M8 4h16l6 8H2l6-8Zm-6 8h28L16 29 2 12Zm14-8-4 8 4 17 4-17-4-8Z",
  },

  // Fifteen topics — a globe. Breadth, literally.
  "topics-15": {
    back: "M16 2a14 14 0 1 1 0 28 14 14 0 0 1 0-28Z",
    front:
      "M2.6 12h26.8v3H2.6v-3Zm0 8h26.8v3H2.6v-3ZM16 2c3.9 0 7 6.3 7 14s-3.1 14-7 14-7-6.3-7-14S12.1 2 16 2Zm0 3c-2.2 0-4 4.9-4 11s1.8 11 4 11 4-4.9 4-11-1.8-11-4-11Z",
  },

  // Twenty at hard or expert — a shield. You went where it was defended.
  "expert-20": {
    back: "M16 2 4 6.5v10c0 6.6 5 11.6 12 13.5 7-1.9 12-6.9 12-13.5v-10L16 2Z",
    front:
      "M16 6.5 8 9.4v7c0 4.5 3.3 7.9 8 9.4V6.5Zm-2.4 6.8 2.4 2.4 4.8-4.8 2.1 2.1-6.9 6.9-4.5-4.5 2.1-2.1Z",
  },

  // Daily habit — the sun coming up again.
  "daily-10": {
    back: "M16 6a10 10 0 0 1 10 10H6A10 10 0 0 1 16 6Z",
    front:
      "M2 19h28a1.5 1.5 0 0 1 0 3H2a1.5 1.5 0 0 1 0-3Zm4 6h20a1.5 1.5 0 0 1 0 3H6a1.5 1.5 0 0 1 0-3ZM16 1a1.3 1.3 0 0 1 1.3 1.3v2.4a1.3 1.3 0 0 1-2.6 0V2.3A1.3 1.3 0 0 1 16 1ZM4.6 5.6l1.9 1.9a1.3 1.3 0 0 1-1.8 1.8L2.8 7.4a1.3 1.3 0 0 1 1.8-1.8Zm22.8 0a1.3 1.3 0 0 1 0 1.8l-1.9 1.9a1.3 1.3 0 0 1-1.8-1.8l1.9-1.9a1.3 1.3 0 0 1 1.8 0Z",
  },
};

/** A soft lozenge, for a badge id that has no mark yet. */
const FALLBACK = {
  back: "M6 8a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V8Z",
  front: "M11 14h10v4H11v-4Z",
};

export function BadgeArt({
  id,
  earned,
  className,
  title,
}: {
  id: string;
  /** Accepted so callers need not know tier is undrawn; see the note above. */
  tier?: BadgeTier;
  earned: boolean;
  className?: string;
  /**
   * The badge's name. Supply it wherever the mark stands alone — the overview
   * shelf, the header — where it becomes both the hover label and the only
   * thing a screen reader has to go on. Omit it beside a visible name, where
   * announcing it again is noise.
   */
  title?: string;
}) {
  const hues = FAMILY_HUES[BADGE_FAMILY[id] ?? "volume"];
  const mark = MARKS[id] ?? FALLBACK;

  // Locked: one neutral ink, both panes. A greyed colour still reads as a
  // colour; ink reads as "not yet".
  const back = earned ? hues.back : "var(--muted-foreground)";
  const front = earned ? hues.front : "var(--muted-foreground)";

  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-9 shrink-0", !earned && "opacity-45", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <path d={mark.back} fill={back} fillOpacity={BACK_ALPHA} />
      <path
        d={mark.front}
        fill={front}
        fillOpacity={earned ? FRONT_ALPHA : BACK_ALPHA + 0.15}
        fillRule="evenodd"
      />
    </svg>
  );
}
