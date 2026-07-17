import { FileTextIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SectionHeading } from "@/components/admin/section-heading";
import { ScreensTable } from "@/components/org/screens-table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getActiveOrg, listScreens } from "@/server/dal/org";
import { getViewer } from "@/server/dal/session";

export const metadata: Metadata = { title: "Screens" };

export default async function OrgScreensPage() {
  const org = await getActiveOrg();
  if (!org) redirect("/dashboard");

  const viewer = await getViewer();
  const screens = await listScreens(viewer, org.id);
  const canManage = org.role === "owner" || org.role === "admin";

  return (
    <div className="space-y-6">
      {/* No New screen button here: the org header carries it on every page. */}
      <SectionHeading label="Screens" title="Every screen" />

      {screens.length === 0 ? (
        <EmptyState
          icon={<FileTextIcon weight="duotone" />}
          title="No screens yet"
          description="A screen is a frozen interview you send to candidates. Every candidate answers the identical set, so their scores are comparable."
          action={
            canManage ? (
              <Button asChild>
                <Link href={"/org/screens/new" as Route}>Create a screen</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ScreensTable screens={screens} />
      )}
    </div>
  );
}
