import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { DataLabel } from "@/components/ui/prose";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublishedPost } from "@/server/dal/blog";

type Props = { params: Promise<{ slug: string }> };

/**
 * No generateStaticParams here, deliberately. Under cacheComponents it must
 * return at least one param — an empty array is a build error — and posts are
 * written at runtime, so there is no honest list to give it at build time. The
 * placeholder-param workaround trades a real build-time check for a fake one.
 * Plain dynamic rendering is correct for a database-backed page: the read is
 * one indexed query, and a publish shows up immediately.
 */

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPost(slug);

  // A draft and a typo are the same thing to a stranger: neither gets a title
  // that confirms the post exists.
  if (!post) return { title: "Post not found" };

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.publishedAt.toISOString(),
    },
  };
}

/**
 * Synchronous, exactly like r/[shareId]: `params` is runtime data under
 * cacheComponents, so awaiting it up here — never mind the query it feeds —
 * would leave the route with no prerenderable shell, which the build reports as
 * a blocking-route error. The promise goes down into the boundary instead.
 */
export default function BlogPostPage({ params }: Props) {
  return (
    // The (marketing) layout owns the shell and the padding; this is the
    // reading measure inside it.
    <article className="w-full max-w-3xl">
      <Suspense fallback={<PostSkeleton />}>
        <Post params={params} />
      </Suspense>
    </article>
  );
}

async function Post({ params }: Props) {
  const { slug } = await params;

  // getPublishedPost only ever returns PUBLISHED posts with a real publishedAt.
  // A draft is therefore indistinguishable from a slug that was never used —
  // both land on the same 404, which is the point.
  const post = await getPublishedPost(slug);
  if (!post) notFound();

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-3 mb-10">
        <Link href="/blog">
          <ArrowLeftIcon aria-hidden />
          Blog
        </Link>
      </Button>

      <header className="mb-10">
        <DataLabel>
          <time dateTime={post.publishedAt.toISOString()}>
            {post.publishedAt.toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </time>
          <span aria-hidden> · </span>
          {/* "approx" because it is words/200, not a measurement. */}
          <span>~{post.readingMinutes} min read</span>
        </DataLabel>
        <h1 className="mt-3 font-display text-display-lg text-balance">
          {post.title}
        </h1>
        <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
          {post.excerpt}
        </p>
      </header>

      <hr className="mb-10" />

      <Markdown className="text-base">{post.body}</Markdown>

      <footer className="mt-16 border-t pt-8">
        <Button asChild variant="outline">
          <Link href="/blog">
            <ArrowLeftIcon aria-hidden />
            All posts
          </Link>
        </Button>
      </footer>
    </>
  );
}

function PostSkeleton() {
  return (
    <div className="space-y-10">
      <Skeleton className="h-8 w-24" />
      <div className="space-y-3">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-10 w-4/5" />
        <Skeleton className="h-4 w-full" />
      </div>
      <div className="space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    </div>
  );
}
