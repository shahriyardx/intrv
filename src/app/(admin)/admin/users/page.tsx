import { MagnifyingGlassIcon, UsersIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatCount, formatDate } from "@/components/admin/format";
import { Pagination } from "@/components/admin/pagination";
import { SectionHeading } from "@/components/admin/section-heading";
import { UserRowActions } from "@/components/admin/user-row-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getAdminViewer,
  listAdminUsers,
  USERS_PAGE_SIZE,
} from "@/server/dal/admin";

/**
 * Metadata is rendered into the static shell, which is served to whoever asks —
 * it is produced before the gate below ever runs. A static `title` naming this
 * surface would hand an anonymous probe the one fact the notFound() is there to
 * withhold. Non-admins get {}, which inherits the root title, exactly like the
 * 404 they are about to be shown.
 */
export async function generateMetadata(): Promise<Metadata> {
  const admin = await getAdminViewer();
  if (!admin) return {};
  return { title: "Users · Admin", robots: { index: false, follow: false } };
}

export default async function AdminUsersPage(props: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const admin = await getAdminViewer();
  if (!admin) notFound();

  const { q, page: rawPage } = await props.searchParams;
  // `?page=-5` parses to a truthy -5, which would render a nonsense row range.
  const requested = Number.parseInt(rawPage ?? "1", 10);
  const query = q?.trim() || undefined;

  // Use the page the DAL actually served, not the one asked for: it clamps, and
  // disagreeing with it is how a "no users" empty state appears on a populated
  // table with no pagination to escape from.
  const { rows, total, page } = await listAdminUsers({
    query,
    page: Number.isFinite(requested) && requested > 0 ? requested : 1,
  });

  return (
    <div className="space-y-6">
      <SectionHeading label={`${formatCount(total)} total`} title="Users">
        {/* A plain GET form: search that survives JS being slow or absent, and
            leaves a URL you can paste to a colleague. */}
        <form className="flex gap-2" action="/admin/users">
          <Input
            name="q"
            defaultValue={query ?? ""}
            placeholder="Email or name"
            aria-label="Search users"
            className="h-8 w-56"
          />
          <Button type="submit" variant="outline" size="sm">
            <MagnifyingGlassIcon aria-hidden />
            Search
          </Button>
        </form>
      </SectionHeading>

      {rows.length === 0 ? (
        <EmptyState
          icon={<UsersIcon weight="duotone" />}
          title={query ? `Nobody matches "${query}"` : "No users yet"}
          description={
            query
              ? "Search checks email and name."
              : "Users appear here after their first sign-up. Interviews taken signed-out have no user at all."
          }
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Sessions</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono">
                    {row.email}
                    {row.id === admin.userId ? (
                      <span className="ml-2 text-muted-foreground">(you)</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="max-w-40 truncate">
                    {row.name}
                  </TableCell>
                  <TableCell>
                    {row.role === "admin" ? (
                      <Badge>admin</Badge>
                    ) : (
                      <Badge variant="outline">{row.role ?? "user"}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.banned ? (
                      <Badge variant="destructive" title={row.banReason ?? ""}>
                        banned
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">active</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular">
                    {formatCount(row.sessionsTaken)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(row.createdAt)}
                  </TableCell>
                  <TableCell>
                    <UserRowActions
                      userId={row.id}
                      email={row.email}
                      role={row.role}
                      banned={row.banned}
                      isSelf={row.id === admin.userId}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Pagination
            basePath="/admin/users"
            page={page}
            total={total}
            pageSize={USERS_PAGE_SIZE}
            params={{ q: query }}
            unit="users"
          />
        </>
      )}
    </div>
  );
}
