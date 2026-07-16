import { MinusIcon, TrophyIcon, XIcon } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import { getRematchComparison } from "@/server/dal/challenge";
import type { SessionDetail } from "@/server/dal/interview";

/**
 * Head-to-head banner for a REMATCH result: the viewer's score against the
 * person who challenged them. Async server component that resolves the
 * comparison itself and renders nothing when the session is not a rematch (or
 * the source has gone), so it is safe to mount unconditionally on the result
 * page. The outcome is carried by an icon + word, never colour alone.
 */
export async function RematchBanner({ session }: { session: SessionDetail }) {
  if (session.mode !== "REMATCH" || session.rematchOfId === null) return null;

  const comparison = await getRematchComparison(session.id);
  if (!comparison) return null;

  const you = session.score ?? 0;
  const them = comparison.opponentScore;

  const outcome = you > them ? "won" : you < them ? "lost" : "tied";

  const { Icon, label } = {
    won: { Icon: TrophyIcon, label: "You won" },
    lost: { Icon: XIcon, label: "You lost" },
    tied: { Icon: MinusIcon, label: "You tied" },
  }[outcome];

  return (
    <div className="no-print mb-8 flex items-center gap-4 border border-l-2 border-l-accent bg-accent/5 px-5 py-4">
      <Icon aria-hidden className="size-5 shrink-0 text-accent" weight="fill" />
      <div className="min-w-0">
        <p className="font-display text-lg">
          {label} <span className="text-muted-foreground">·</span>{" "}
          <span
            className={cn(
              "tabular",
              outcome === "won" && "text-correct",
              outcome === "lost" && "text-incorrect",
            )}
          >
            {Math.round(you)}%
          </span>{" "}
          <span className="text-muted-foreground">vs</span>{" "}
          <span className="tabular">{them}%</span>{" "}
          <span className="text-muted-foreground">
            by {comparison.opponentName}
          </span>
        </p>
        <p className="mt-0.5 text-muted-foreground text-xs">
          Rematch on {comparison.topic}
        </p>
      </div>
    </div>
  );
}
