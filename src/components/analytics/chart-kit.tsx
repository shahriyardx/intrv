"use client";

import type { ReactNode } from "react";

/**
 * The pieces every chart on this page shares.
 *
 * Colour comes from var(--chart-N), which is validated against our exact
 * surfaces in globals.css and re-declared under .dark — so an SVG attribute
 * pointing at the variable is what makes these charts theme-aware. Never
 * hand-pick a hex here.
 *
 * All four dashboard charts plot a single measure, so they all use slot 1 and
 * none carries a legend: there is one colour, and the heading already says what
 * it is. Slots 3/4/5 fall under 3:1 on paper and are deliberately unused.
 */
export const SERIES = "var(--chart-1)";

/** Hairline, solid, one step off the surface. Never dashed — dashes read as a threshold. */
export const GRID_PROPS = {
  stroke: "var(--border)",
  strokeWidth: 1,
} as const;

/** Axis text wears a text token, never the series colour. */
export const AXIS_PROPS = {
  stroke: "var(--border)",
  tick: {
    fill: "var(--muted-foreground)",
    fontSize: 11,
    fontFamily: "var(--font-mono)",
  },
  tickLine: false,
} as const;

/** Direct labels are ink, not the series hue — a light fill is illegible as text. */
export const LABEL_PROPS = {
  fill: "var(--foreground)",
  fontSize: 11,
  fontFamily: "var(--font-mono)",
} as const;

/** 0-100 with clean ticks. A score axis that stops at the max exaggerates every gap. */
export const SCORE_DOMAIN = [0, 100] as const;
export const SCORE_TICKS = [0, 25, 50, 75, 100];

type TooltipRow = { label: string; value: string };

/**
 * Recharts' default tooltip is a white box with a black border — invisible
 * intent in dark mode. This one wears the popover tokens like every other
 * floating surface in the app.
 */
export function TooltipCard({
  title,
  rows,
  children,
}: {
  title: string;
  rows?: TooltipRow[];
  children?: ReactNode;
}) {
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      <p className="max-w-56 text-pretty text-xs font-medium">{title}</p>
      {rows?.length ? (
        <dl className="mt-1.5 space-y-0.5">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline gap-3">
              <dt className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
                {row.label}
              </dt>
              <dd className="ml-auto font-mono text-xs tabular">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {children}
    </div>
  );
}
