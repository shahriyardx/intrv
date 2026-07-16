import { FileTextIcon, PlusIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
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
import { getOrgBySlug, listScreens } from "@/server/dal/org";
import { getViewer } from "@/server/dal/session";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const viewer = await getViewer();
  const org = await getOrgBySlug(viewer, slug);
  return { title: org?.name ?? "Organization" };
}

export default async function OrgDetailPage({ params }: Props) {
  const { slug } = await params;
  const viewer = await getViewer();

  const org = await getOrgBySlug(viewer, slug);
  // notFound(), never a 403: a non-member learns nothing about whether the org
  // exists — the same doctrine as /admin.
  if (!org) notFound();

  const screens = await listScreens(viewer, org.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-display-md">{org.name}</h2>
          <p className="mt-1 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
            {org.slug} · you're {article(org.role)} {org.role}
          </p>
        </div>
        {org.role === "owner" || org.role === "admin" ? (
          <Button asChild size="sm">
            <Link href={`/org/${org.slug}/screens/new` as Route}>
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
            org.role === "owner" || org.role === "admin" ? (
              <Button asChild>
                <Link href={`/org/${org.slug}/screens/new` as Route}>
                  Create a screen
                </Link>
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
                    href={`/org/${org.slug}/screens/${screen.id}` as Route}
                    className="underline-offset-4 hover:underline"
                  >
                    {screen.title}
                  </Link>
                </TableCell>
                <TableCell className="max-w-40 truncate text-muted-foreground">
                  {screen.topic}
                </TableCell>
                <TableCell className="capitalize text-muted-foreground">
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

function article(role: string): string {
  return role === "admin" || role === "owner" ? "an" : "a";
}
