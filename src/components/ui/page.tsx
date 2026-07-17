import { cn } from "@/lib/utils";

/**
 * The one page width, shared with SiteHeader's inner container so a page's
 * heading sits on the same left edge as the logo above it. Import it rather
 * than retyping the classes: the drift this replaces was seven different
 * max-widths across the app, each individually defensible and collectively
 * arbitrary.
 */
export const shell = "mx-auto w-full max-w-6xl px-6";

/**
 * A readable line length inside the shell.
 *
 * The shell is sized for dense data — tables, stat rows, charts. Prose set to
 * that full width runs past 130 characters a line, which is roughly half again
 * the point where the eye starts losing its place returning to the left margin.
 * So anything meant to be *read* — marketing copy, a question prompt, feedback —
 * gets capped here, and is left-aligned within the shell rather than centred, so
 * it still lines up with everything else on the page.
 */
export function Measure({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("w-full max-w-3xl", className)}>{children}</div>;
}
