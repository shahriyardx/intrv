import type { ReactNode } from "react";
import { DataLabel, Prose } from "@/components/ui/prose";

/**
 * A chart with its name, the sentence that says how to read it, and a table.
 *
 * The table is not optional decoration: it is the WCAG-clean twin of the chart,
 * and it is what makes the whole thing readable when colour or the SVG can't be
 * seen at all. Folded, so it costs nothing to the reader who doesn't need it.
 */
export function ChartPanel({
  title,
  description,
  children,
  table,
}: {
  title: string;
  description: string;
  children: ReactNode;
  table?: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1.5">
        {/* A heading, not a span: it is the only thing naming this section. */}
        <DataLabel as="h2">{title}</DataLabel>
        <Prose className="text-sm text-muted-foreground">
          <p>{description}</p>
        </Prose>
      </div>

      {children}

      {table ? (
        <details className="group">
          <summary className="cursor-pointer list-none text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
            <span className="group-open:hidden">Show as a table</span>
            <span className="hidden group-open:inline">Hide table</span>
          </summary>
          <div className="mt-3">{table}</div>
        </details>
      ) : null}
    </section>
  );
}
