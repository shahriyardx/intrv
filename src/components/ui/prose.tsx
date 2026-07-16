import type { ComponentProps } from "react";
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

/** Small mono label — the "this is data" signal. */
export function DataLabel({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
