import type { ComponentProps, ElementType } from "react";
import { cn } from "@/lib/utils";

/** Question and feedback prose. Measure-capped — long lines hurt comprehension. */
export function Prose({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "max-w-[68ch] text-pretty leading-relaxed [&_p+p]:mt-4",
        className,
      )}
      {...props}
    />
  );
}

type DataLabelElement = "span" | "h1" | "h2" | "h3" | "dt";

/**
 * Small mono label — the "this is data" signal.
 *
 * Defaults to a span, but takes `as` because this styling is often the only
 * thing naming a section: rendered as a span it leaves that section with no
 * heading and no accessible name. The look is identical either way.
 */
export function DataLabel({
  className,
  as,
  ...props
}: Omit<ComponentProps<"span">, "ref"> & { as?: DataLabelElement }) {
  // ElementType rather than a generic: the callers only ever pass className and
  // children, and a fully polymorphic ref type costs more than it earns here.
  const Tag: ElementType = as ?? "span";
  return (
    <Tag
      className={cn(
        "font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
