"use client";

import {
  ChatCircleIcon,
  PaperPlaneRightIcon,
  SpinnerGapIcon,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { RichText } from "@/components/session/rich-text";
import { Button } from "@/components/ui/button";
import { DataLabel } from "@/components/ui/prose";
import { Textarea } from "@/components/ui/textarea";
import { useTRPC } from "@/trpc/client";

type Turn = { role: "student" | "assistant"; text: string };

/** Client-side cap. The server independently caps the sent array at 8 turns. */
const MAX_STUDENT_TURNS = 5;

/**
 * A quiet chat that drills into one graded question. Collapsed to a link until
 * the student opens it; every reply streams token by token from the discussion
 * router. It shows nothing the graded result page doesn't already reveal — the
 * correct answer and explanation are on the page beside it.
 */
export function DiscussPanel({
  sessionId,
  questionId,
}: {
  sessionId: string;
  questionId: string;
}) {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  // The turns array currently being asked (already trimmed to <=8), or null idle.
  const [submitted, setSubmitted] = useState<Turn[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery(
    trpc.discussion.drill.queryOptions(
      { sessionId, questionId, turns: submitted ?? [] },
      {
        enabled: submitted !== null,
        trpc: { context: { stream: true } },
        staleTime: Number.POSITIVE_INFINITY,
        gcTime: 0,
        retry: false,
      },
    ),
  );

  const reply = (query.data ?? []).join("");

  // Commit only once the stream has fully finished. A streaming query reports
  // status "success" on its very first render — with the data array still empty
  // — and only then fills in per yield. Acting on "success" alone therefore
  // committed an empty reply and, worse, ran setSubmitted(null), which with
  // gcTime: 0 tore the query down and ABORTED the in-flight stream: the server
  // finished generating (telemetry showed a full, ok reply) but the client had
  // already hung up. fetchStatus "idle" is the real "the generator returned"
  // signal; until then, keep waiting and let the array grow.
  useEffect(() => {
    if (submitted === null) return;
    if (query.fetchStatus !== "idle") return;

    if (query.status === "success") {
      const text = reply.trim();
      // An empty completion is a failure, not an answer: committing "(no reply)"
      // as an assistant turn would also feed that placeholder back as context on
      // the next question. Surface it as retryable and leave history clean — the
      // student's question stays in `turns`, so Send tries again from there.
      if (!text) {
        setError("The tutor didn't answer that time. Try asking again.");
      } else {
        setTurns((prev) => [...prev, { role: "assistant", text }]);
      }
      setSubmitted(null);
    } else if (query.status === "error") {
      setError("Couldn't reach the tutor just now. Try again.");
      setSubmitted(null);
    }
  }, [query.status, query.fetchStatus, reply, submitted]);

  const studentTurns = turns.filter((t) => t.role === "student").length;
  const atLimit = studentTurns >= MAX_STUDENT_TURNS;
  const streaming = submitted !== null;

  const send = () => {
    const text = draft.trim();
    if (!text || streaming || atLimit) return;
    setError(null);
    const next: Turn[] = [...turns, { role: "student", text }];
    setTurns(next);
    setDraft("");
    // Last turn must be the new student question; send only the most recent 8.
    setSubmitted(next.slice(-8));
  };

  if (!open) {
    return (
      <div className="mt-4 border-t pt-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-muted-foreground text-xs transition-colors hover:text-foreground"
        >
          <ChatCircleIcon className="size-3.5" />
          Discuss with AI
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 border-l-2 border-l-muted pl-4">
      <DataLabel as="dt">Discuss with AI</DataLabel>

      {turns.length || streaming ? (
        <div className="mt-3 space-y-3">
          {turns.map((turn, i) =>
            turn.role === "student" ? (
              <p
                // biome-ignore lint/suspicious/noArrayIndexKey: turns are append-only and positional
                key={i}
                className="text-foreground text-sm"
              >
                <span className="text-muted-foreground">You: </span>
                {turn.text}
              </p>
            ) : (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: turns are append-only and positional
                key={i}
                className="text-muted-foreground text-sm"
              >
                <RichText>{turn.text}</RichText>
              </div>
            ),
          )}

          {streaming ? (
            <div className="text-muted-foreground text-sm">
              {reply ? (
                <RichText>{reply}</RichText>
              ) : (
                <SpinnerGapIcon className="size-3.5 animate-spin" />
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mt-3 text-partial text-xs">{error}</p> : null}

      {atLimit ? (
        <p className="mt-3 text-muted-foreground text-xs">
          That's the limit for this question. Everything above stays here to
          re-read.
        </p>
      ) : (
        <div className="mt-3 flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            maxLength={2000}
            disabled={streaming}
            placeholder={
              turns.length
                ? "Ask a follow-up…"
                : "Ask why the answer is what it is…"
            }
            className="min-h-9"
            rows={1}
          />
          <Button
            type="button"
            size="sm"
            onClick={send}
            disabled={streaming || !draft.trim()}
            aria-label="Send"
          >
            {streaming ? (
              <SpinnerGapIcon className="size-3.5 animate-spin" />
            ) : (
              <PaperPlaneRightIcon className="size-3.5" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
