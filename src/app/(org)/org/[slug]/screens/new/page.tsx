import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NewScreenForm } from "@/components/org/new-screen-form";
import { DataLabel } from "@/components/ui/prose";
import { getOrgBySlug } from "@/server/dal/org";
import { getViewer } from "@/server/dal/session";

type Props = { params: Promise<{ slug: string }> };

export const metadata: Metadata = { title: "New screen" };

export default async function NewScreenPage({ params }: Props) {
  const { slug } = await params;
  const viewer = await getViewer();

  const org = await getOrgBySlug(viewer, slug);
  // Not a member, or only a plain member: nothing to see. notFound() rather
  // than a 403, and the action re-checks the role regardless.
  if (!org || (org.role !== "owner" && org.role !== "admin")) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <DataLabel>
        <Link
          href={`/org/${org.slug}` as Route}
          className="underline-offset-4 hover:text-foreground hover:underline"
        >
          {org.name}
        </Link>{" "}
        / New screen
      </DataLabel>
      <h2 className="mt-2 font-display text-display-lg">
        Create a screening interview
      </h2>
      <p className="mt-3 max-w-prose text-sm text-muted-foreground">
        We write the questions once and freeze them, so every candidate answers
        the identical set. You'll get a link to share and a report as answers
        come in.
      </p>
      <div className="mt-10">
        <NewScreenForm orgId={org.id} />
      </div>
    </div>
  );
}
