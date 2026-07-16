"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AXIS_PROPS,
  GRID_PROPS,
  LABEL_PROPS,
  SCORE_DOMAIN,
  SCORE_TICKS,
  SERIES,
  TooltipCard,
} from "@/components/analytics/chart-kit";

/** Recharts hands label content raw geometry; nothing here is user input. */
function ValueLabel(props: {
  x?: string | number;
  y?: string | number;
  width?: string | number;
  height?: string | number;
  value?: string | number;
}) {
  const x = Number(props.x ?? 0);
  const y = Number(props.y ?? 0);
  const width = Number(props.width ?? 0);
  const height = Number(props.height ?? 0);

  return (
    <text
      x={x + width + 6}
      y={y + height / 2}
      dy={4}
      {...LABEL_PROPS}
      textAnchor="start"
    >
      {`${Math.round(Number(props.value ?? 0))}%`}
    </text>
  );
}

export type BarDatum = {
  id: string;
  /** Already truncated by the caller — the axis gutter is fixed. */
  label: string;
  /** 0-100. */
  value: number;
  /** Untruncated, for the tooltip. */
  title: string;
  rows: { label: string; value: string }[];
};

/**
 * Horizontal bars for a 0-100 measure across named categories — topics,
 * concepts, question types.
 *
 * One hue for every bar, deliberately. Shading bars darker-where-bigger would
 * double-encode length as colour and spend the only free channel on something
 * the bar already says. Every bar is directly labelled with its value, so the
 * chart never depends on colour alone, and each page pairs it with a table.
 */
export function ScoreBarChart({
  data,
  labelWidth = 132,
}: {
  data: BarDatum[];
  labelWidth?: number;
}) {
  // Grow with the data instead of fixing a height: a fixed box either crops the
  // x-axis band or leaves a scrollbar inside the card.
  const height = data.length * 34 + 44;

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 48, bottom: 4, left: 0 }}
          barCategoryGap="22%"
        >
          <CartesianGrid {...GRID_PROPS} horizontal={false} />
          <XAxis
            type="number"
            domain={[...SCORE_DOMAIN]}
            ticks={SCORE_TICKS}
            {...AXIS_PROPS}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={labelWidth}
            {...AXIS_PROPS}
            tick={{ ...AXIS_PROPS.tick, fontFamily: "var(--font-sans)" }}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const datum = payload[0]?.payload as BarDatum | undefined;
              if (!datum) return null;
              return <TooltipCard title={datum.title} rows={datum.rows} />;
            }}
          />
          <Bar
            dataKey="value"
            fill={SERIES}
            // Rounded at the data end, square at the baseline.
            radius={[0, 4, 4, 0]}
            maxBarSize={24}
            // Recharts renders nothing at all for a 0% bar — no rectangle, and
            // no label either, so the row came out blank and read as missing
            // data rather than as a real zero. A 2px stub keeps the row on the
            // page; the number printed beside it is what states the value.
            minPointSize={2}
            isAnimationActive={false}
          >
            {/* A custom renderer rather than `position="right"`: recharts draws
                no rectangle for a 0% bar and then drops its label with it, so a
                real zero rendered as a blank row — indistinguishable from data
                we don't have. This draws the label off the bar's end whether or
                not there is a bar to sit against. */}
            <LabelList dataKey="value" content={<ValueLabel />} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
