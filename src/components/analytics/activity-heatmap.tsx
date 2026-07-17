import { cn } from "@/lib/utils";
import type { ActivityCalendar, Cell } from "@/server/learning/activity";

/**
 * A year of graded-session activity, GitHub-style: one square per day, columns
 * are weeks, rows are Sun→Sat. Server-rendered — the only interactivity is a
 * native title tooltip, so there is no client bundle to ship for it.
 *
 * The accent is spent here as a five-step opacity ramp rather than a second
 * hue: it is the same "you're doing well" signal as the streak flame, kept to
 * one colour so the grid reads as intensity, not category.
 */
const LEVEL_CLASS: Record<Cell["level"], string> = {
  0: "bg-muted",
  1: "bg-accent/25",
  2: "bg-accent/45",
  3: "bg-accent/70",
  4: "bg-accent",
};

const WEEKDAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

export function ActivityHeatmap({ calendar }: { calendar: ActivityCalendar }) {
  return (
    <div className="space-y-3">
      {/* Horizontal scroll on narrow screens rather than squashing the squares
          into unreadable slivers. */}
      <div className="overflow-x-auto">
        <div className="flex w-max gap-3">
          <WeekdayColumn />

          <div className="space-y-1">
            <MonthRow columns={calendar.columns} />
            <div className="flex gap-1">
              {calendar.columns.map((week) => (
                <div key={week[0].dayIndex} className="flex flex-col gap-1">
                  {week.map((cell) => (
                    <DayCell key={cell.dayIndex} cell={cell} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Legend />
    </div>
  );
}

function DayCell({ cell }: { cell: Cell }) {
  if (cell.future) {
    // A spacer that keeps the last column full but is not a real day.
    return <span aria-hidden className="size-3 rounded-[2px]" />;
  }

  const label =
    cell.count === 0
      ? `No interviews on ${cell.date}`
      : `${cell.count} interview${cell.count === 1 ? "" : "s"} on ${cell.date}`;

  return (
    <span
      title={label}
      className={cn("size-3 rounded-[2px]", LEVEL_CLASS[cell.level])}
    >
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** Weekday labels aligned to the 7 rows; only alternate ones, GitHub-style. */
function WeekdayColumn() {
  return (
    // mt matches the month-label row height above the grid so rows line up.
    <div className="mt-[1.125rem] flex flex-col gap-1">
      {WEEKDAY_LABELS.map((label, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed 7-row legend
          key={i}
          className="flex h-3 items-center font-mono text-[0.5625rem] text-muted-foreground leading-none"
        >
          {label}
        </span>
      ))}
    </div>
  );
}

/** A month abbreviation over the first column that falls in a new month. */
function MonthRow({ columns }: { columns: Cell[][] }) {
  let lastMonth = "";

  return (
    <div className="flex gap-1">
      {columns.map((week) => {
        // The Sunday cell dates the column.
        const month = week[0].date.slice(0, 7);
        const show = month !== lastMonth;
        if (show) lastMonth = month;
        const name = show
          ? new Date(`${week[0].date}T00:00:00Z`).toLocaleString("en-US", {
              month: "short",
              timeZone: "UTC",
            })
          : "";

        return (
          <span
            key={week[0].dayIndex}
            className="w-3 font-mono text-[0.5625rem] text-muted-foreground leading-none"
          >
            {name}
          </span>
        );
      })}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-1.5 font-mono text-[0.625rem] text-muted-foreground uppercase tracking-[0.12em]">
      <span>Less</span>
      {([0, 1, 2, 3, 4] as const).map((level) => (
        <span
          key={level}
          className={cn("size-3 rounded-[2px]", LEVEL_CLASS[level])}
        />
      ))}
      <span>More</span>
    </div>
  );
}
