import {
  ArrowLeftIcon,
  ArrowSquareOutIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate } from "@/components/admin/format";
import { PostEditor } from "@/components/admin/post-editor";
import { SectionHeading } from "@/components/admin/section-heading";
import { Button } from "@/components/ui/button";
import { getAdminViewer } from "@/server/dal/admin";
import { getAdminPost } from "@/server/dal/blog";

type Props = { params: Promise<{ id: string }> };

/** Neutral for non-admins — see the note in (admin)/admin/users/page.tsx. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const admin = await getAdminViewer();
  if (!admin) return {};

  const { id } = await params;
  const post = await getAdminPost(id);

  return {
    title: post ? `${post.title} · Admin` : "Post · Admin",
    robots: { index: false, follow: false },
  };
}

export default async function EditPostPage({ params }: Props) {
  // Checked here, not merely in the layout: a layout does not re-run on client
  // navigation, and the actions this page calls re-check again themselves.
  const admin = await getAdminViewer();
  if (!admin) notFound();

  const { id } = await params;
  const post = await getAdminPost(id);
  if (!post) notFound();

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link href="/admin/posts">
          <ArrowLeftIcon aria-hidden />
          All posts
        </Link>
      </Button>

      <SectionHeading
        label={
          post.status === "PUBLISHED" && post.publishedAt
            ? `Published ${formatDate(post.publishedAt)}`
            : "Draft"
        }
        title={post.title}
      >
        {post.status === "PUBLISHED" ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/blog/${post.slug}` as Route}>
              View live
              <ArrowSquareOutIcon aria-hidden />
            </Link>
          </Button>
        ) : null}
      </SectionHeading>

      <PostEditor post={post} />
    </div>
  );
}
