import { ListChecksIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatCount, formatDateTime } from "@/components/admin/format";
import { Pagination } from "@/components/admin/pagination";
import { SectionHeading } from "@/components/admin/section-heading";
import { SessionDetail } from "@/components/admin/session-detail";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  getAdminSessionDetail,
  getAdminViewer,
  listAdminSessions,
  SESSION_STATUSES,
  SESSIONS_PAGE_SIZE,
  type SessionStatus,
} from "@/server/dal/admin";

/** Neutral for non-admins — see the note in (admin)/admin/page.tsx. */
export async function generateMetadata(): Promise<Metadata> {
  const admin = await getAdminViewer();
  if (!admin) return {};
  return { title: "Sessions · Admin", robots: { index: false, follow: false } };
}

function parseStatus(raw: string | undefined): SessionStatus | undefined {
  return SESSION_STATUSES.find((status) => status === raw);
}

export default async function AdminSessionsPage(props: {
  searchParams: Promise<{ status?: string; page?: string; session?: string }>;
}) {
  const admin = await getAdminViewer();
  if (!admin) notFound();

  const {
    status: rawStatus,
    page: rawPage,
    session: selectedId,
  } = await props.searchParams;

  const status = parseStatus(rawStatus);
  // `?page=-5` parses to a truthy -5, which would render a nonsense row range.
  const requested = Number.parseInt(rawPage ?? "1", 10);

  // Use the page the DAL served, not the one asked for — it clamps.
  const [{ rows, total, page }, detail] = await Promise.all([
    listAdminSessions({
      status,
      page: Number.isFinite(requested) && requested > 0 ? requested : 1,
    }),
    selectedId ? getAdminSessionDetail(selectedId) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <SectionHeading
        label={`${formatCount(total)} ${status ? status.toLowerCase() : "total"}`}
        title="Sessions"
      />

      <nav className="flex flex-wrap gap-1" aria-label="Filter by status">
        <FilterLink href="/admin/sessions" label="All" active={!status} />
        {SESSION_STATUSES.map((option) => (
          <FilterLink
            key={option}
            href={`/admin/sessions?status=${option}` as Route}
            label={option.toLowerCase()}
            active={status === option}
          />
        ))}
      </nav>

      {detail ? <SessionDetail session={detail} /> : null}

      {rows.length === 0 ? (
        <EmptyState
          icon={<ListChecksIcon weight="duotone" />}
          title={
            status ? `No ${status.toLowerCase()} sessions` : "No sessions yet"
          }
          description="Every interview taken — signed in or not — lands here."
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Topic</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="text-right">Questions</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.id === selectedId ? "selected" : undefined}
                >
                  <TableCell className="max-w-56 truncate">
                    <Link
                      href={
                        `/admin/sessions?session=${row.id}${status ? `&status=${status}` : ""}${page > 1 ? `&page=${page}` : ""}` as Route
                      }
                      className="underline-offset-4 hover:underline"
                    >
                      {row.topic}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono">
                    {row.ownerEmail ?? (
                      // Not a missing value: a signed-out session has no owner
                      // by design, and the id in the URL is its only key.
                      <span className="text-muted-foreground">anonymous</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.status.toLowerCase()}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular">
                    {row.score === null ? "—" : `${row.score}%`}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular">
                    {row.questionCount}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDateTime(row.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Pagination
            basePath="/admin/sessions"
            page={page}
            total={total}
            pageSize={SESSIONS_PAGE_SIZE}
            params={{ status }}
            unit="sessions"
          />
        </>
      )}
    </div>
  );
}

function FilterLink({
  href,
  label,
  active,
}: {
  href: Route;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "border px-2.5 py-1 font-mono text-[0.6875rem] uppercase tracking-[0.08em] transition-colors",
        active
          ? "border-foreground bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );
}
