import type { Route } from "next";
import { Badge } from "@/components/ui/badge";
import type { SessionSummary } from "@/server/dal/interview";

type Status = SessionSummary["status"];

/**
 * Plain words, not jargon: a student reading their history should not have to
 * learn our enum. Only GRADED sessions have a score, so the rest need a status
 * that explains the empty cell.
 */
const STATUS_LABELS: Record<Status, string> = {
  GENERATING: "Generating",
  READY: "Unfinished",
  SUBMITTED: "Grading",
  GRADED: "Graded",
  FAILED: "Failed",
  ABANDONED: "Abandoned",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <Badge
      variant={status === "FAILED" ? "destructive" : "outline"}
      className="text-[0.625rem] font-normal"
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}

/**
 * Where a session row points. A graded session has a result to read; anything
 * else sends them back to the session itself, which knows how to explain its
 * own state.
 */
export function sessionHref(session: { id: string; status: Status }): Route {
  return (
    session.status === "GRADED" ? `/s/${session.id}/result` : `/s/${session.id}`
  ) as Route;
}
