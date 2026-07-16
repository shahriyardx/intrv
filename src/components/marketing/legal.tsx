import { DataLabel } from "@/components/ui/prose";

/**
 * Shared furniture for /privacy and /terms. Both pages are the ones nobody
 * reads, so they get a plain-language summary up top and a real heading
 * hierarchy underneath — a wall of h2s a screen reader can navigate beats a
 * wall of styled divs it cannot.
 */

export function LegalHeader({
  label,
  title,
  updated,
  children,
}: {
  label: string;
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <header>
      <DataLabel>{label}</DataLabel>
      <h1 className="mt-3 font-display text-display-lg">{title}</h1>
      <p className="mt-4 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
        Last updated {updated}
      </p>
      {children}
    </header>
  );
}

export function ShortVersion({ points }: { points: string[] }) {
  return (
    <section
      aria-labelledby="short-version"
      className="mt-10 border-l-2 border-accent bg-muted/50 py-5 pr-5 pl-5"
    >
      <DataLabel as="h2" id="short-version">
        The short version
      </DataLabel>
      <ul className="mt-4 space-y-2.5">
        {points.map((point) => (
          <li
            key={point}
            className="text-pretty text-sm leading-relaxed text-muted-foreground before:mr-2.5 before:text-foreground before:content-['—']"
          >
            {point}
          </li>
        ))}
      </ul>
      <p className="mt-5 text-xs text-muted-foreground">
        That's the gist, not the whole of it. The detail below is what actually
        applies.
      </p>
    </section>
  );
}

export function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="mt-12 border-t pt-8 [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-foreground [&_li]:leading-relaxed [&_p]:leading-relaxed [&_p+p]:mt-4 [&_strong]:font-medium [&_strong]:text-foreground"
    >
      <h2 id={id} className="font-display text-display-md">
        {title}
      </h2>
      <div className="mt-4 max-w-[68ch] text-pretty text-sm text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

/** A tight term/detail list — used for "what we store" and "what we don't". */
export function LegalList({
  items,
}: {
  items: { term: string; detail: string }[];
}) {
  return (
    <dl className="mt-5 space-y-4">
      {items.map((item) => (
        <div key={item.term} className="border-l pl-4">
          <dt className="text-sm font-medium text-foreground">{item.term}</dt>
          <dd className="mt-1 text-pretty text-sm leading-relaxed text-muted-foreground">
            {item.detail}
          </dd>
        </div>
      ))}
    </dl>
  );
}
