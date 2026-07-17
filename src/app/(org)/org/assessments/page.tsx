import { FileTextIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SectionHeading } from "@/components/admin/section-heading";
import { AssessmentsTable } from "@/components/org/assessments-table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getActiveOrg, listAssessments } from "@/server/dal/org";
import { getViewer } from "@/server/dal/session";

export const metadata: Metadata = { title: "Assessments" };

export default async function OrgAssessmentsPage() {
  const org = await getActiveOrg();
  if (!org) redirect("/dashboard");

  const viewer = await getViewer();
  const assessments = await listAssessments(viewer, org.id);
  const canManage = org.role === "owner" || org.role === "admin";

  return (
    <div className="space-y-6">
      {/* No New assessment button here: the org header carries it on every page. */}
      <SectionHeading label="Assessments" title="Every assessment" />

      {assessments.length === 0 ? (
        <EmptyState
          icon={<FileTextIcon weight="duotone" />}
          title="No assessments yet"
          description="An assessment is a frozen interview you send to candidates. Every candidate answers the identical set, so their scores are comparable."
          action={
            canManage ? (
              <Button asChild>
                <Link href={"/org/assessments/new" as Route}>
                  Create an assessment
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <AssessmentsTable assessments={assessments} />
      )}
    </div>
  );
}
