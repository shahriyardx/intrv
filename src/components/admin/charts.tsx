import { CaretDownIcon } from "@phosphor-icons/react/dist/ssr";
import { DataLabel } from "@/components/ui/prose";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AiDay } from "@/server/dal/admin";
import {
  formatCount,
  formatDayKey,
  formatPercent,
  formatTokens,
  formatUsd,
} from "./format";

/**
 * These charts are hand-drawn SVG/CSS rather than a charting library because
 * they are read, not interrogated: fixed windows, no zoom, no legend juggling.
 * That keeps the admin surface out of the client bundle entirely.
 *
 * Colours come from --chart-N and nowhere else. Three of the light-mode slots
 * sit under 3:1 against paper, so every chart here ships direct labels and a
 * table view — the colour is never the only way to read a value.
 */

function TableView({
  summary,
  children,
}: {
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group mt-4">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground">
        <CaretDownIcon
          className="size-3 transition-transform group-open:rotate-180"
          aria-hidden
        />
        {summary}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

export function SpendChart({ days }: { days: AiDay[] }) {
  const max = Math.max(...days.map((d) => d.costUsd));
  const peakIndex = days.findIndex((d) => d.costUsd === max);

  return (
    <figure>
      <div className="flex h-40 items-end gap-[2px]" aria-hidden>
        {days.map((day, i) => {
          // A zero day still gets a visible hairline: an absent bar and a
          // zero-spend bar must not look identical.
          const height = max === 0 ? 0 : (day.costUsd / max) * 100;
          return (
            <div
              key={day.day}
              className="flex flex-1 flex-col justify-end"
              style={{ height: "100%" }}
            >
              {i === peakIndex && max > 0 ? (
                <span className="mb-1 text-center font-mono text-[0.625rem] tabular text-muted-foreground">
                  {formatUsd(max)}
                </span>
              ) : null}
              <div
                className="w-full rounded-t-[4px] bg-[var(--chart-1)]"
                style={{
                  height: `${Math.max(height, day.costUsd > 0 ? 2 : 1)}%`,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[0.625rem] text-muted-foreground">
        <span>{formatDayKey(days[0]?.day ?? "")}</span>
        <span>{formatDayKey(days.at(-1)?.day ?? "")}</span>
      </div>

      <TableView summary="Table view">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Day</TableHead>
              <TableHead className="text-right">Spend</TableHead>
              <TableHead className="text-right">Calls</TableHead>
              <TableHead className="text-right">Failures</TableHead>
              <TableHead className="text-right">Cache hits</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {days.map((day) => {
              const prompt = day.cacheHitTokens + day.cacheMissTokens;
              return (
                <TableRow key={day.day}>
                  <TableCell className="font-mono">
                    {formatDayKey(day.day)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular">
                    {formatUsd(day.costUsd)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular">
                    {formatCount(day.calls)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular">
                    {formatCount(day.failures)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular">
                    {prompt === 0
                      ? "—"
                      : formatPercent(day.cacheHitTokens / prompt)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableView>
    </figure>
  );
}

const W = 560;
const H = 150;
// The y axis carries the meaning of every point's height, so it gets room for
// its labels rather than a gridline the reader has to guess at.
const PAD_LEFT = 34;
const PLOT_W = W - PAD_LEFT;

export function CacheRatioChart({ days }: { days: AiDay[] }) {
  const points = days.map((day, i) => {
    const prompt = day.cacheHitTokens + day.cacheMissTokens;
    return {
      day: day.day,
      ratio: prompt === 0 ? null : day.cacheHitTokens / prompt,
      x:
        days.length === 1
          ? PAD_LEFT + PLOT_W / 2
          : PAD_LEFT + (i / (days.length - 1)) * PLOT_W,
    };
  });

  const withData = points.filter(
    (p): p is (typeof points)[number] & { ratio: number } => p.ratio !== null,
  );
  const last = withData.at(-1);

  const y = (ratio: number) => H - ratio * H;

  // A gap in the line is honest: a day with no calls has no ratio, and joining
  // across it would invent a trend.
  const segments: string[] = [];
  let run: string[] = [];
  for (const point of points) {
    if (point.ratio === null) {
      if (run.length > 1) segments.push(run.join(" "));
      run = [];
      continue;
    }
    run.push(`${point.x.toFixed(1)},${y(point.ratio).toFixed(1)}`);
  }
  if (run.length > 1) segments.push(run.join(" "));

  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-40 w-full overflow-visible"
        role="img"
        aria-label={`Prompt cache hit ratio per day. Latest ${formatPercent(last?.ratio ?? null)}.`}
      >
        <title>Cache hit ratio by day</title>
        {[0, 0.5, 1].map((tick) => (
          <g key={tick}>
            <line
              x1={PAD_LEFT}
              x2={W}
              y1={y(tick)}
              y2={y(tick)}
              className="stroke-border"
              strokeWidth="1"
            />
            <text
              x={PAD_LEFT - 6}
              y={y(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted-foreground font-mono text-[10px]"
            >
              {formatPercent(tick)}
            </text>
          </g>
        ))}
        {segments.map((segment) => (
          <polyline
            key={segment.slice(0, 24)}
            points={segment}
            fill="none"
            stroke="var(--chart-5)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {withData.map((point) => (
          <circle
            key={point.day}
            cx={point.x}
            cy={y(point.ratio)}
            r="4"
            fill="var(--chart-5)"
            className="stroke-background"
            strokeWidth="2"
          />
        ))}
        {/* The latest point is the one anyone opens this chart to read. */}
        {last ? (
          <text
            x={last.x - 8}
            y={y(last.ratio) - 10}
            textAnchor="end"
            className="fill-foreground font-mono text-[10px]"
          >
            {formatPercent(last.ratio)}
          </text>
        ) : null}
      </svg>
      <div className="mt-2 flex items-baseline justify-between font-mono text-[0.625rem] text-muted-foreground">
        <span>{formatDayKey(days[0]?.day ?? "")}</span>
        <span className="tabular">
          {last ? `latest ${formatPercent(last.ratio)}` : "no calls yet"}
        </span>
        <span>{formatDayKey(days.at(-1)?.day ?? "")}</span>
      </div>

      <TableView summary="Table view">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Day</TableHead>
              <TableHead className="text-right">Hit ratio</TableHead>
              <TableHead className="text-right">Hit tokens</TableHead>
              <TableHead className="text-right">Miss tokens</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {days.map((day) => {
              const prompt = day.cacheHitTokens + day.cacheMissTokens;
              return (
                <TableRow key={day.day}>
                  <TableCell className="font-mono">
                    {formatDayKey(day.day)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular">
                    {prompt === 0
                      ? "—"
                      : formatPercent(day.cacheHitTokens / prompt)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular">
                    {formatTokens(day.cacheHitTokens)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular">
                    {formatTokens(day.cacheMissTokens)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableView>
    </figure>
  );
}

/** Ranked horizontal bars — the one form that always has room for its labels. */
export function RankedBars({
  rows,
  colorVar = "--chart-4",
}: {
  rows: { label: string; value: number; display: string; note?: string }[];
  colorVar?: string;
}) {
  // Scale to the largest row, not to a floor of 1: these values are usually
  // fractions of a dollar, and a floor of 1 would render every bar as a stub.
  const max = Math.max(...rows.map((r) => r.value));

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.label} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-4 text-xs">
            <span className="truncate font-mono">{row.label}</span>
            <span className="shrink-0 font-mono tabular text-muted-foreground">
              {row.display}
              {row.note ? (
                <span className="ml-2 text-muted-foreground">{row.note}</span>
              ) : null}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{
                width: barWidth(row.value, max),
                background: `var(${colorVar})`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * The 1% floor keeps a real-but-tiny value visible — a $0.002 row against a $12
 * max would otherwise round to nothing. It must never apply to zero, though: a
 * bar drawn for no data reads as "a few", which is the one thing the reader is
 * here to tell apart. Exported for that test.
 */
export function barWidth(value: number, max: number): string {
  if (value <= 0 || max <= 0) return "0%";

  return `${Math.max((value / max) * 100, 1)}%`;
}

export function ChartCard({
  label,
  title,
  description,
  children,
}: {
  label: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border p-5">
      <DataLabel>{label}</DataLabel>
      <h3 className="mt-1 font-display text-lg">{title}</h3>
      {description ? (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}
