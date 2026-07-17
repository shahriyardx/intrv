import { NotePencilIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { Measure } from "@/components/ui/page";
import { DataLabel } from "@/components/ui/prose";
import { Skeleton } from "@/components/ui/skeleton";
import { listPublishedPosts, type PublicPostListItem } from "@/server/dal/blog";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Notes on interviewing, question design, and what we learned building Intrv.",
  openGraph: {
    title: "Blog · Intrv",
    description:
      "Notes on interviewing, question design, and what we learned building Intrv.",
    type: "website",
  },
};

function formatPostDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * The header does not depend on the database, so it belongs in the prerendered
 * shell. The list reads Postgres on every request — uncached IO, which under
 * cacheComponents must sit inside a Suspense boundary or the route has no
 * static shell to serve at all.
 */
export default function BlogIndexPage() {
  return (
    // The (marketing) layout owns the shell and the padding; this is the
    // reading measure inside it.
    <Measure>
      <header className="mb-12">
        <DataLabel>Writing</DataLabel>
        <h1 className="mt-2 font-display text-display-lg text-balance">Blog</h1>
        <p className="mt-4 max-w-[52ch] text-pretty leading-relaxed text-muted-foreground">
          Notes on interviewing, question design, and what we learned building
          Intrv.
        </p>
      </header>

      <Suspense fallback={<PostListSkeleton />}>
        <PostList />
      </Suspense>
    </Measure>
  );
}

async function PostList() {
  const posts = await listPublishedPosts();

  if (posts.length === 0) {
    return (
      <EmptyState
        icon={<NotePencilIcon weight="duotone" />}
        title="Nothing published yet"
        description="We're writing. Check back soon — or go take an interview in the meantime."
      />
    );
  }

  return (
    // A list, not a grid of cards: this is a serif-display product and the
    // titles are the thing worth looking at.
    <ul className="divide-y border-t border-b">
      {posts.map((post) => (
        <PostRow key={post.slug} post={post} />
      ))}
    </ul>
  );
}

function PostRow({ post }: { post: PublicPostListItem }) {
  return (
    <li>
      <Link
        href={`/blog/${post.slug}` as Route}
        className="group block py-7 transition-opacity hover:opacity-100"
      >
        <p className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-muted-foreground">
          <time dateTime={post.publishedAt.toISOString()}>
            {formatPostDate(post.publishedAt)}
          </time>
          <span aria-hidden> · </span>
          {/* "approx" because it is words/200, not a measurement. */}
          <span>~{post.readingMinutes} min read</span>
        </p>
        <h2 className="mt-2 font-display text-2xl text-balance underline-offset-[6px] group-hover:underline">
          {post.title}
        </h2>
        <p className="mt-2 max-w-[60ch] text-pretty text-sm leading-relaxed text-muted-foreground">
          {post.excerpt}
        </p>
      </Link>
    </li>
  );
}

function PostListSkeleton() {
  return (
    <div className="space-y-10 border-t pt-7">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-7 w-4/5" />
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}
