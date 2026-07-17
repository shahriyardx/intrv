import { FileTextIcon, PlusIcon } from "@phosphor-icons/react/dist/ssr";
import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
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
import { getActiveOrg, listScreens } from "@/server/dal/org";
import { getViewer } from "@/server/dal/session";

/**
 * The organization dashboard — one org per account, so there is no list and no
 * slug in the URL: the active org comes from the session. A personal account
 * that reaches here isn't an org account and is sent back to their dashboard.
 */
export default async function OrgDashboardPage() {
  const org = await getActiveOrg();
  if (!org) redirect("/dashboard");

  const viewer = await getViewer();
  const screens = await listScreens(viewer, org.id);
  const canManage = org.role === "owner" || org.role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-display-md">{org.name}</h2>
          <p className="mt-1 font-mono text-[0.625rem] text-muted-foreground uppercase tracking-[0.12em]">
            you're {org.role === "member" ? "a" : "an"} {org.role}
          </p>
        </div>
        {canManage ? (
          <Button asChild size="sm">
            <Link href={"/org/screens/new" as Route}>
              <PlusIcon className="size-4" />
              New screen
            </Link>
          </Button>
        ) : null}
      </div>

      {screens.length === 0 ? (
        <EmptyState
          icon={<FileTextIcon weight="duotone" />}
          title="No screens yet"
          description="A screen is a frozen interview you send to candidates. Generate one and share its link — every candidate answers the identical set."
          action={
            canManage ? (
              <Button asChild>
                <Link href={"/org/screens/new" as Route}>Create a screen</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Topic</TableHead>
              <TableHead>Difficulty</TableHead>
              <TableHead className="text-right">Candidates</TableHead>
              <TableHead className="text-right">Avg score</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {screens.map((screen) => (
              <TableRow key={screen.id}>
                <TableCell className="max-w-56 truncate">
                  <Link
                    href={`/org/screens/${screen.id}` as Route}
                    className="underline-offset-4 hover:underline"
                  >
                    {screen.title}
                  </Link>
                </TableCell>
                <TableCell className="max-w-40 truncate text-muted-foreground">
                  {screen.topic}
                </TableCell>
                <TableCell className="text-muted-foreground capitalize">
                  {screen.difficulty.toLowerCase()}
                </TableCell>
                <TableCell className="text-right font-mono tabular">
                  {screen.candidateCount}
                </TableCell>
                <TableCell className="text-right font-mono tabular">
                  {screen.avgScore === null
                    ? "—"
                    : `${Math.round(screen.avgScore)}%`}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={screen.active ? "secondary" : "outline"}
                    className="text-[0.625rem]"
                  >
                    {screen.active ? "active" : "closed"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
