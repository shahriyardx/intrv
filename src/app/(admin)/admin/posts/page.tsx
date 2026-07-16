import { NotePencilIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatCount, formatDate } from "@/components/admin/format";
import { Pagination } from "@/components/admin/pagination";
import { SectionHeading } from "@/components/admin/section-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { getAdminViewer } from "@/server/dal/admin";
import {
  listAdminPosts,
  POST_STATUSES,
  POSTS_PAGE_SIZE,
  type PostStatus,
} from "@/server/dal/blog";

/** Neutral for non-admins — see the note in (admin)/admin/users/page.tsx. */
export async function generateMetadata(): Promise<Metadata> {
  const admin = await getAdminViewer();
  if (!admin) return {};
  return { title: "Posts · Admin", robots: { index: false, follow: false } };
}

function parseStatus(raw: string | undefined): PostStatus | undefined {
  return POST_STATUSES.find((status) => status === raw);
}

export default async function AdminPostsPage(props: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  // The layout checked too, and that is not redundant: a layout does not re-run
  // on client navigation and never runs for the Server Functions this page's
  // links lead to.
  const admin = await getAdminViewer();
  if (!admin) notFound();

  const { status: rawStatus, page: rawPage } = await props.searchParams;

  const status = parseStatus(rawStatus);
  // `?page=-5` parses to a truthy -5, which would render a nonsense row range.
  const requested = Number.parseInt(rawPage ?? "1", 10);

  // Use the page the DAL served, not the one asked for — it clamps.
  const { rows, total, page } = await listAdminPosts({
    status,
    page: Number.isFinite(requested) && requested > 0 ? requested : 1,
  });

  return (
    <div className="space-y-6">
      <SectionHeading
        label={`${formatCount(total)} ${status ? status.toLowerCase() : "total"}`}
        title="Posts"
      >
        <Button asChild size="sm">
          <Link href="/admin/posts/new">New post</Link>
        </Button>
      </SectionHeading>

      <nav className="flex flex-wrap gap-1" aria-label="Filter by status">
        <FilterLink href="/admin/posts" label="All" active={!status} />
        {POST_STATUSES.map((option) => (
          <FilterLink
            key={option}
            href={`/admin/posts?status=${option}` as Route}
            label={option.toLowerCase()}
            active={status === option}
          />
        ))}
      </nav>

      {rows.length === 0 ? (
        <EmptyState
          icon={<NotePencilIcon weight="duotone" />}
          title={
            status ? `No ${status.toLowerCase()} posts` : "Nothing written yet"
          }
          description="Posts written here appear on /blog once published."
          action={
            <Button asChild>
              <Link href="/admin/posts/new">Write the first one</Link>
            </Button>
          }
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Published</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="max-w-64">
                    <Link
                      href={`/admin/posts/${row.id}` as Route}
                      className="block truncate underline-offset-4 hover:underline"
                    >
                      {row.title}
                    </Link>
                    <span className="block truncate font-mono text-[0.6875rem] text-muted-foreground">
                      /{row.slug}
                    </span>
                  </TableCell>
                  <TableCell>
                    {row.status === "PUBLISHED" ? (
                      <Badge>published</Badge>
                    ) : (
                      <Badge variant="outline">draft</Badge>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {row.publishedAt ? (
                      formatDate(row.publishedAt)
                    ) : (
                      // Not a missing value: a post that has never been
                      // published has no date to show.
                      <span>—</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono">
                    {row.authorEmail ?? (
                      // The author's account was deleted; the writing outlives
                      // it by design (onDelete: SetNull).
                      <span className="text-muted-foreground">unknown</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(row.updatedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Pagination
            basePath="/admin/posts"
            page={page}
            total={total}
            pageSize={POSTS_PAGE_SIZE}
            params={{ status }}
            unit="posts"
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
