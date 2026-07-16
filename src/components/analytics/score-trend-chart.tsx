"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AXIS_PROPS,
  GRID_PROPS,
  SCORE_DOMAIN,
  SCORE_TICKS,
  SERIES,
  TooltipCard,
} from "@/components/analytics/chart-kit";
import { formatScore } from "@/components/analytics/format";

export type TrendDatum = {
  sessionId: string;
  topic: string;
  difficulty: string;
  score: number;
  /** Preformatted on the server: the axis needs a short label, not a Date. */
  label: string;
  fullDate: string;
};

/**
 * Score over time. One series, so no legend — the heading names it — and only
 * the last point is directly labelled: a number on every dot is noise, and the
 * axis plus the tooltip carry the rest.
 */
export function ScoreTrendChart({ data }: { data: TrendDatum[] }) {
  const last = data.at(-1);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 16, right: 44, bottom: 4, left: 0 }}
        >
          <CartesianGrid {...GRID_PROPS} vertical={false} />
          <XAxis
            dataKey="label"
            {...AXIS_PROPS}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            {...AXIS_PROPS}
            domain={[...SCORE_DOMAIN]}
            ticks={SCORE_TICKS}
            width={36}
            tickFormatter={(v: number) => `${v}`}
          />
          <Tooltip
            cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0]?.payload as TrendDatum | undefined;
              if (!point) return null;

              return (
                <TooltipCard
                  title={point.topic}
                  rows={[
                    { label: "Score", value: `${formatScore(point.score)}%` },
                    {
                      label: "Level",
                      value: point.difficulty.toLowerCase(),
                    },
                    { label: "Date", value: point.fullDate },
                  ]}
                />
              );
            }}
          />
          <Line
            // Linear, not a spline: each point is one sitting, and a smooth
            // curve would draw scores between them that never happened.
            type="linear"
            dataKey="score"
            stroke={SERIES}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            // A 2px ring in the surface colour keeps a dot legible where it
            // crosses the line, and makes it a big enough hover target.
            dot={{
              r: 4,
              fill: SERIES,
              stroke: "var(--background)",
              strokeWidth: 2,
            }}
            activeDot={{
              r: 6,
              fill: SERIES,
              stroke: "var(--background)",
              strokeWidth: 2,
            }}
            isAnimationActive={false}
            label={(props: {
              x?: string | number;
              y?: string | number;
              index?: number;
            }) => {
              // Direct-label the endpoint only.
              if (props.index !== data.length - 1 || !last) return <g />;
              const x = Number(props.x ?? 0);
              const y = Number(props.y ?? 0);
              return (
                <text
                  x={x + 8}
                  y={y}
                  dy={4}
                  fill="var(--foreground)"
                  fontSize={11}
                  fontFamily="var(--font-mono)"
                >
                  {formatScore(last.score)}%
                </text>
              );
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
