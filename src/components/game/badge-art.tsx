import { cn } from "@/lib/utils";
import type { BadgeTier } from "@/server/learning/badges";

/**
 * Badge artwork: a struck medallion per badge.
 *
 * Three layers, and each carries one fact so nothing is decoration:
 *
 * - **Hue = family.** Five hues over twelve badges, not twelve. The colour tells
 *   you what is being measured (volume, habit, precision, breadth, retention),
 *   so the wall reads as groups rather than confetti. Pulled from the validated
 *   `--chart-*` ramp, which is already checked in both themes.
 * - **Ring = tier.** Bronze is a bare ring, silver adds eight ticks, gold a
 *   double ring with twelve. Tier is legible from the frame alone — it never
 *   depends on telling one metal colour from another, which is exactly the
 *   distinction a colour-blind reader loses.
 * - **Glyph = identity.** A geometric engraving on a 32-unit grid, 1.5 stroke,
 *   round caps. Drawn, not iconographic: this is a technical product, so the
 *   marks are compass points and bar stacks, not trophies and ribbons.
 *
 * Locked badges drop the hue entirely and render in muted ink. Desaturating a
 * colour would still read as "a colour"; removing it reads as "not yet", and
 * the silhouette still identifies which badge it is.
 *
 * Everything is `currentColor`-free and token-driven so light and dark both
 * work without a second asset.
 */

type Family = "volume" | "habit" | "precision" | "breadth" | "retention";

/** One hue per family, from the validated dataviz ramp. */
const FAMILY_HUE: Record<Family, string> = {
  volume: "var(--chart-1)", // blue — how much you've done
  habit: "var(--chart-6)", // orange — showing up
  precision: "var(--chart-5)", // green — getting it exactly right
  breadth: "var(--chart-7)", // violet — range
  retention: "var(--chart-4)", // amber — what stuck
};

/** Ticks around the ring, evenly spaced. Silver gets 8, gold 12. */
function ticks(count: number, inner: number, outer: number) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      // Keyed by the angle it sits at: fixed geometry, so this is a real
      // identity rather than a position that could shift under it.
      id: `t${angle.toFixed(4)}`,
      x1: 16 + cos * inner,
      y1: 16 + sin * inner,
      x2: 16 + cos * outer,
      y2: 16 + sin * outer,
    };
  }).map(({ id, ...line }) => <line key={id} {...line} />);
}

function Frame({ tier }: { tier: BadgeTier }) {
  return (
    <g>
      <circle cx="16" cy="16" r="15" fill="none" strokeWidth="1" />
      {tier === "gold" ? (
        <circle cx="16" cy="16" r="12.6" fill="none" strokeWidth="0.75" />
      ) : null}
      {tier === "silver" ? (
        <g strokeWidth="1" strokeLinecap="round">
          {ticks(8, 12.4, 14.1)}
        </g>
      ) : null}
      {tier === "gold" ? (
        <g strokeWidth="1" strokeLinecap="round">
          {ticks(12, 13.4, 14.4)}
        </g>
      ) : null}
    </g>
  );
}

/**
 * The engravings. Each is a bare fragment drawn inside the medallion, centred
 * on (16,16) and staying within about a 16-unit square so the ring never
 * crowds it.
 */
const GLYPHS: Record<string, React.ReactNode> = {
  // One run: a single struck dot, ringed. The whole point is that it is one.
  "first-run": (
    <>
      <circle cx="16" cy="16" r="6" fill="none" />
      <circle cx="16" cy="16" r="2.2" strokeWidth="0" fill="currentColor" />
    </>
  ),

  // Ten: a short stack of bars, growing.
  "ten-runs": (
    <>
      <line x1="10" y1="20.5" x2="22" y2="20.5" />
      <line x1="10" y1="16" x2="19" y2="16" />
      <line x1="10" y1="11.5" x2="15.5" y2="11.5" />
    </>
  ),

  // Fifty: the same stack filled out into a block — volume, not a milestone.
  "fifty-runs": (
    <>
      <rect x="9.5" y="9.5" width="5" height="5" rx="0.6" />
      <rect x="17.5" y="9.5" width="5" height="5" rx="0.6" />
      <rect x="9.5" y="17.5" width="5" height="5" rx="0.6" />
      <rect
        x="17.5"
        y="17.5"
        width="5"
        height="5"
        rx="0.6"
        strokeWidth="0"
        fill="currentColor"
      />
    </>
  ),

  // Three days: a small flame.
  "streak-3": (
    <path d="M16 9.5c2.6 2.4 4.4 4.6 4.4 7.1a4.4 4.4 0 1 1-8.8 0c0-1.4.6-2.6 1.7-3.9.5 1 1 1.5 1.7 1.8-.2-1.9.2-3.4 1-5Z" />
  ),

  // A week: seven marks, unbroken. Counted rather than drawn as a calendar —
  // at 36px a seven-cell grid collapses into a smudge, seven dots do not.
  "streak-7": (
    <>
      {[10, 12, 14, 16, 18, 20, 22].map((x) => (
        <circle
          key={x}
          cx={x}
          cy="16"
          r="1.15"
          strokeWidth="0"
          fill="currentColor"
        />
      ))}
      <line x1="10" y1="20.6" x2="22" y2="20.6" strokeWidth="1.2" />
    </>
  ),

  // Thirty: a filled month block.
  "streak-30": (
    <>
      <rect x="8.5" y="9.5" width="15" height="13" rx="1.2" />
      <line x1="8.5" y1="13.5" x2="23.5" y2="13.5" />
      <line x1="12.5" y1="9.5" x2="12.5" y2="7.8" />
      <line x1="19.5" y1="9.5" x2="19.5" y2="7.8" />
      <path d="m12.5 18 2.4 2.4 4.6-4.6" strokeWidth="1.8" />
    </>
  ),

  // Perfect: dead centre. The crosshair is what separates it from first-run —
  // two sets of concentric rings are the same mark at this size.
  perfect: (
    <>
      <circle cx="16" cy="16" r="6.4" fill="none" />
      <circle cx="16" cy="16" r="2.6" fill="none" />
      <line x1="16" y1="7.4" x2="16" y2="10.4" strokeLinecap="round" />
      <line x1="16" y1="21.6" x2="16" y2="24.6" strokeLinecap="round" />
      <line x1="7.4" y1="16" x2="10.4" y2="16" strokeLinecap="round" />
      <line x1="21.6" y1="16" x2="24.6" y2="16" strokeLinecap="round" />
    </>
  ),

  // Five perfect: a five-pointed mark, struck solid.
  "perfect-5": (
    <path
      d="m16 8.6 2.3 4.9 5.2.7-3.8 3.7 1 5.3-4.7-2.6-4.7 2.6 1-5.3-3.8-3.7 5.2-.7Z"
      strokeWidth="0"
      fill="currentColor"
    />
  ),

  // Breadth: a compass rose — going out in several directions.
  explorer: (
    <>
      <circle cx="16" cy="16" r="6.8" fill="none" />
      <path
        d="M16 9.6 17.6 15 23 16.4 17.6 17.8 16 23.2 14.4 17.8 9 16.4 14.4 15Z"
        strokeWidth="0"
        fill="currentColor"
      />
    </>
  ),

  // Deep end: descending, into the harder water.
  "deep-end": (
    <>
      <path d="m10 11.5 6 4 6-4" />
      <path d="m10 16.5 6 4 6-4" />
      <line x1="16" y1="20.5" x2="16" y2="23" />
    </>
  ),

  // It stuck: an anchor — the thing that holds.
  retained: (
    <>
      <circle cx="16" cy="10.8" r="2" fill="none" />
      <line x1="16" y1="12.8" x2="16" y2="22.5" />
      <line x1="12" y1="15.2" x2="20" y2="15.2" />
      <path d="M10.5 18.4c0 3 2.5 4.6 5.5 4.6s5.5-1.6 5.5-4.6" />
    </>
  ),

  // Daily habit: a day mark, rayed.
  "daily-10": (
    <>
      <circle cx="16" cy="16" r="4.2" fill="none" />
      <g strokeLinecap="round">{ticks(8, 6.6, 8.8)}</g>
    </>
  ),
};

/** Which family each badge belongs to — drives the hue, nothing else. */
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
};

/** A ringed dot, for a badge id that has no engraving yet. */
const FALLBACK = <circle cx="16" cy="16" r="5.5" fill="none" />;

export function BadgeArt({
  id,
  tier,
  earned,
  className,
}: {
  id: string;
  tier: BadgeTier;
  earned: boolean;
  className?: string;
}) {
  const hue = FAMILY_HUE[BADGE_FAMILY[id] ?? "volume"];
  const glyph = GLYPHS[id] ?? FALLBACK;

  // Locked: no hue at all. A greyed-out colour still reads as a colour; ink
  // reads as "not yet", and the silhouette still says which badge it is.
  const color = earned ? hue : "var(--muted-foreground)";

  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: aria-hidden; the badge name sits beside it in text
    <svg
      viewBox="0 0 32 32"
      className={cn("size-9 shrink-0", !earned && "opacity-55", className)}
      aria-hidden
      focusable="false"
      style={{ color }}
    >
      {/* The tinted disc. Kept low so twelve of these together stay quiet. */}
      <circle
        cx="16"
        cy="16"
        r="15.5"
        fill={
          earned
            ? `color-mix(in oklab, ${hue} 13%, transparent)`
            : "color-mix(in oklab, var(--muted-foreground) 7%, transparent)"
        }
      />
      <g stroke="currentColor" fill="none">
        <Frame tier={tier} />
        <g strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          {glyph}
        </g>
      </g>
    </svg>
  );
}
