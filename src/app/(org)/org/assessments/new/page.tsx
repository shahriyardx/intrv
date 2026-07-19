import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NewAssessmentForm } from "@/components/org/new-assessment-form";
import { Measure } from "@/components/ui/page";
import { DataLabel } from "@/components/ui/prose";
import { getActiveOrg } from "@/server/dal/org";

export const metadata: Metadata = { title: "New assessment" };

export default async function NewScreenPage() {
  const org = await getActiveOrg();
  // Not an org account, or only a plain member: nothing to see. notFound()
  // rather than a 403, and the action re-checks the role regardless.
  if (!org || (org.role !== "owner" && org.role !== "admin")) notFound();

  return (
    <Measure>
      <DataLabel>
        <Link
          href={"/org" as Route}
          className="underline-offset-4 hover:text-foreground hover:underline"
        >
          {org.name}
        </Link>{" "}
        / New assessment
      </DataLabel>
      <h2 className="mt-2 font-display text-display-lg">
        Create an assessment
      </h2>
      <p className="mt-3 max-w-prose text-muted-foreground text-sm">
        We write the questions once and freeze them, so every candidate answers
        the identical set. You'll get a link to share and a report as answers
        come in.
      </p>
      <div className="mt-10">
        <NewAssessmentForm orgId={org.id} />
      </div>
    </Measure>
  );
}
