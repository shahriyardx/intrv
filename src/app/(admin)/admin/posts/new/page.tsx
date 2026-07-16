import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostEditor } from "@/components/admin/post-editor";
import { SectionHeading } from "@/components/admin/section-heading";
import { Button } from "@/components/ui/button";
import { getAdminViewer } from "@/server/dal/admin";

/** Neutral for non-admins — see the note in (admin)/admin/users/page.tsx. */
export async function generateMetadata(): Promise<Metadata> {
  const admin = await getAdminViewer();
  if (!admin) return {};
  return { title: "New post · Admin", robots: { index: false, follow: false } };
}

export default async function NewPostPage() {
  // Checked here, not merely in the layout: a layout does not re-run on client
  // navigation, and savePostAction re-checks again on its own behalf.
  const admin = await getAdminViewer();
  if (!admin) notFound();

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link href="/admin/posts">
          <ArrowLeftIcon aria-hidden />
          All posts
        </Link>
      </Button>

      <SectionHeading label="Draft" title="New post" />

      <PostEditor />
    </div>
  );
}
