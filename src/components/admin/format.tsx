/**
 * Shared formatting for the admin surface. Money here is often fractions of a
 * cent, so a blanket 2-decimal format would render most of a day's spend as
 * "$0.00" and hide exactly what the page exists to show.
 */

export function formatUsd(value: number): string {
  if (value === 0) return "$0";
  if (value < 0.01) return `$${value.toFixed(4)}`;
  if (value < 1) return `$${value.toFixed(3)}`;
  return `$${value.toFixed(2)}`;
}

export function formatPercent(ratio: number | null, digits = 0): string {
  return ratio === null ? "—" : `${(ratio * 100).toFixed(digits)}%`;
}

export function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

export function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

export function formatMs(value: number | null): string {
  if (value === null) return "—";
  return value >= 1000
    ? `${(value / 1000).toFixed(1)}s`
    : `${Math.round(value)}ms`;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "2026-07-16" -> "Jul 16", without dragging the string through a Date. */
export function formatDayKey(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return day;
  return new Date(year, month - 1, date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
