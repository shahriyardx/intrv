import { UsersThreeIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDuration } from "@/components/org/format";
import { IntegrityChips } from "@/components/org/integrity-chips";
import { InviteLink } from "@/components/org/invite-link";
import { ScreenControls } from "@/components/org/screen-controls";
import { Badge } from "@/components/ui/badge";
import { DataLabel } from "@/components/ui/prose";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { env } from "@/lib/env";
import { getScreenReport } from "@/server/dal/org";
import { getViewer } from "@/server/dal/session";

type Props = { params: Promise<{ screenId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { screenId } = await params;
  const viewer = await getViewer();
  const report = await getScreenReport(viewer, screenId);
  return { title: report?.screen.title ?? "Screen" };
}

export default async function ScreenReportPage({ params }: Props) {
  const { screenId } = await params;
  const viewer = await getViewer();

  const report = await getScreenReport(viewer, screenId);
  if (!report) notFound();

  const { screen, candidates, canManage } = report;
  const inviteUrl = `${env.BETTER_AUTH_URL}/i/${screen.inviteToken}`;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <DataLabel>
            <Link
              href={"/org" as Route}
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              {screen.orgName}
            </Link>{" "}
            / Screen
          </DataLabel>
          <h2 className="mt-2 font-display text-display-md">{screen.title}</h2>
          <p className="mt-1 font-mono text-[0.625rem] text-muted-foreground uppercase tracking-[0.12em]">
            {screen.topic} · {screen.difficulty.toLowerCase()} ·{" "}
            {screen.questionCount} questions ·{" "}
            {screen.timeLimitMs
              ? `${screen.timeLimitMs / 60_000} min`
              : "untimed"}
          </p>
        </div>
        <Badge
          variant={screen.active ? "secondary" : "outline"}
          className="text-[0.625rem]"
        >
          {screen.active ? "active" : "closed"}
        </Badge>
      </div>

      <section className="space-y-4 rounded-md border p-5">
        <div className="flex items-baseline justify-between gap-4">
          <DataLabel as="h3">Invite link</DataLabel>
          {!screen.active ? (
            <span className="text-muted-foreground text-xs">
              Closed — new candidates are turned away.
            </span>
          ) : null}
        </div>
        <InviteLink url={inviteUrl} />
        <p className="text-muted-foreground text-xs">
          Anyone with this link can take the screen — no account needed. Rotate
          it to revoke every link you've shared.
        </p>
        {canManage ? (
          <div className="border-t pt-4">
            <ScreenControls screenId={screen.id} active={screen.active} />
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <DataLabel as="h3">Candidates</DataLabel>
          <span className="font-mono text-muted-foreground text-xs tabular">
            {candidates.length}{" "}
            {candidates.length === 1 ? "attempt" : "attempts"}
          </span>
        </div>

        {candidates.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-md border border-dashed px-6 py-12 text-center">
            <span
              aria-hidden
              className="mb-4 flex size-10 items-center justify-center rounded-sm bg-muted text-muted-foreground [&_svg]:size-5"
            >
              <UsersThreeIcon weight="duotone" />
            </span>
            <p className="font-display text-display-md">No attempts yet</p>
            <p className="mt-2 max-w-sm text-pretty text-muted-foreground text-sm leading-relaxed">
              Share the invite link above. Every candidate who takes the screen
              shows up here with their score and anti-cheat signals.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="text-right">Duration</TableHead>
                <TableHead>Signals</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidates.map((c) => {
                const name = c.name ?? "Anonymous";
                return (
                  <TableRow key={c.id}>
                    <TableCell className="max-w-40 truncate font-medium">
                      {c.status === "GRADED" ? (
                        <Link
                          href={`/org/screens/${screen.id}/c/${c.id}` as Route}
                          className="underline-offset-4 hover:underline"
                        >
                          {name}
                        </Link>
                      ) : (
                        name
                      )}
                    </TableCell>
                    <TableCell className="max-w-48 truncate font-mono text-muted-foreground text-xs">
                      {c.email ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[0.625rem]">
                        {c.status.toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular">
                      {c.score === null ? "—" : `${Math.round(c.score)}%`}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground tabular">
                      {formatDuration(c.durationMs)}
                    </TableCell>
                    <TableCell>
                      <IntegrityChips integrity={c.integrity} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
