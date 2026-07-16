import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The nothing-here state for a list or panel. `icon` is a node rather than a
 * component so callers pick their own import — the server and client builds of
 * the icon set are not interchangeable.
 *
 * An empty state without an action is a dead end, so `action` is where a
 * caller puts the one thing that fills it.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
} & Omit<ComponentProps<"div">, "title">) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-md border border-dashed px-6 py-14 text-center",
        className,
      )}
      {...props}
    >
      {icon ? (
        <span
          aria-hidden
          className="mb-5 flex size-10 items-center justify-center rounded-sm bg-muted text-muted-foreground [&_svg]:size-5"
        >
          {icon}
        </span>
      ) : null}
      <p className="font-display text-display-md">{title}</p>
      {description ? (
        <p className="mt-2 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
