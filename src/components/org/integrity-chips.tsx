import { WarningIcon } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";

/**
 * Client-reported anti-cheat signals for one attempt. These are signals, never
 * verdicts: "left the tab", not "cheated". A blurred window or a paste has
 * innocent explanations, so the copy describes the event and leaves the
 * judgement to the reader.
 *
 * Each chip carries an icon and a word — never colour alone — so it reads the
 * same to someone who can't distinguish the accent. Zero counts stay muted so
 * the eye lands on the attempts that actually tripped a signal.
 */
export function IntegrityChips({
  integrity,
}: {
  integrity: { blurs: number; pastes: number } | null;
}) {
  const blurs = integrity?.blurs ?? 0;
  const pastes = integrity?.pastes ?? 0;

  if (blurs === 0 && pastes === 0) {
    return <span className="text-xs text-muted-foreground">Clean</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {blurs > 0 ? <Chip label={`Left tab ×${blurs}`} /> : null}
      {pastes > 0 ? <Chip label={`Pasted ×${pastes}`} /> : null}
    </div>
  );
}

function Chip({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 border border-partial/40 bg-partial-muted px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-[0.08em] text-partial",
        className,
      )}
    >
      <WarningIcon weight="fill" className="size-3 shrink-0" aria-hidden />
      {label}
    </span>
  );
}
