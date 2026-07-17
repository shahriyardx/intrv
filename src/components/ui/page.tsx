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
 * Content width inside the shell — full width, by decision: every page matches
 * the navbar's measure rather than sitting in a narrower reading column.
 *
 * Kept as a single component rather than inlining `w-full` so page width has one
 * knob: if a reading cap is ever wanted back (long prose does run wide at this
 * width), it changes here and nowhere else. That single point of control is the
 * reason it stays a wrapper instead of being deleted outright.
 */
export function Measure({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("w-full", className)}>{children}</div>;
}
