import { LockSimpleIcon, WarningIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataLabel, Prose } from "@/components/ui/prose";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminSessionDetail } from "@/server/dal/admin";
import { formatDateTime, formatMs, formatUsd } from "./format";

/**
 * The operational view of one session.
 *
 * It renders ClientQuestions, which means the answer key is present only when
 * the session is GRADED — the DTO decided that, not this component, and being
 * an admin does not change the answer. Before grading there is nothing here to
 * leak, which is the point.
 */
export function SessionDetail({ session }: { session: AdminSessionDetail }) {
  const revealed = session.status === "GRADED";

  return (
    <aside className="border p-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <DataLabel>Session</DataLabel>
          <h2 className="mt-1 font-display text-display-md">{session.topic}</h2>
          <p className="mt-2 font-mono text-[0.6875rem] text-muted-foreground">
            {session.id}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/sessions">Close</Link>
        </Button>
      </header>

      <dl className="mt-6 grid gap-4 text-xs sm:grid-cols-4">
        <Field label="Owner">
          {session.ownerEmail ?? (
            <span className="text-muted-foreground">anonymous</span>
          )}
        </Field>
        <Field label="Status">
          <Badge variant="outline">{session.status.toLowerCase()}</Badge>
        </Field>
        <Field label="Score">
          <span className="font-mono tabular">
            {session.score === null ? "—" : `${session.score}%`}
          </span>
        </Field>
        <Field label="Created">{formatDateTime(session.createdAt)}</Field>
      </dl>

      {session.error ? (
        <p className="mt-4 flex items-start gap-2 border border-partial/40 bg-partial-muted px-3 py-2 text-xs">
          <WarningIcon
            aria-hidden
            className="mt-px size-3.5 shrink-0 text-partial"
            weight="fill"
          />
          <span>
            <span className="sr-only">Warning: </span>
            {session.error}
          </span>
        </p>
      ) : null}

      <section className="mt-8 space-y-3">
        <div className="flex items-center gap-2">
          <DataLabel>Questions</DataLabel>
          {revealed ? null : (
            <span className="flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
              <LockSimpleIcon className="size-3" aria-hidden />
              Answer keys stay server-side until this session is graded
            </span>
          )}
        </div>
        {session.questions.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No questions generated.
          </p>
        ) : (
          <ol className="space-y-3">
            {session.questions.map((question) => (
              <li key={question.id} className="border-t pt-3">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-[0.6875rem] tabular text-muted-foreground">
                    {String(question.index + 1).padStart(2, "0")}
                  </span>
                  <Prose className="text-sm">{question.prompt}</Prose>
                </div>
                <p className="mt-2 pl-8 font-mono text-[0.6875rem] text-muted-foreground">
                  {question.type.toLowerCase()}
                  {question.answer?.score !== null &&
                  question.answer?.score !== undefined
                    ? ` · scored ${question.answer.score}`
                    : " · not answered"}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="mt-8 space-y-3">
        <DataLabel>AI calls</DataLabel>
        {session.aiCalls.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No AI calls recorded for this session.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Latency</TableHead>
                <TableHead className="text-right">Tries</TableHead>
                <TableHead>Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {session.aiCalls.map((call) => (
                <TableRow key={call.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDateTime(call.createdAt)}
                  </TableCell>
                  <TableCell className="font-mono">{call.purpose}</TableCell>
                  <TableCell className="font-mono">{call.model}</TableCell>
                  <TableCell className="text-right font-mono tabular">
                    {formatUsd(call.costUsd)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular">
                    {formatMs(call.latencyMs)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular">
                    {call.attempts}
                  </TableCell>
                  <TableCell>
                    {call.ok ? (
                      <span className="text-muted-foreground">ok</span>
                    ) : (
                      <span className="font-mono text-incorrect">
                        {call.errorCode ?? "failed"}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </aside>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt>
        <DataLabel>{label}</DataLabel>
      </dt>
      <dd className="mt-1.5">{children}</dd>
    </div>
  );
}
