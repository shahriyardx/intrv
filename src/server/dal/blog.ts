import "server-only";
import { prisma } from "@/lib/db";

/**
 * Reads for the blog. The public functions here are the only ones the
 * (marketing) pages may call, and every one of them constrains the query to
 * PUBLISHED posts with a real publishedAt — a draft must not be reachable by
 * guessing its URL, and that rule is enforced in the `where`, never by the
 * caller remembering to check.
 */

export type PostStatus = "DRAFT" | "PUBLISHED";

export const POST_STATUSES: readonly PostStatus[] = ["DRAFT", "PUBLISHED"];

export type PublicPostListItem = {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: Date;
  readingMinutes: number;
};

export type PublicPost = PublicPostListItem & { body: string };

const WORDS_PER_MINUTE = 200;

/**
 * Whitespace-split word count over the raw Markdown, so syntax (`##`, link
 * URLs) counts toward the total. It is an estimate and the UI says so; a
 * precise figure would mean rendering to text for a number nobody acts on.
 */
export function readingMinutes(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/**
 * The public index caps out rather than paginating: this is an editorial list
 * that is expected to hold tens of posts, and a cap that is never reached is
 * cheaper than pagination nobody uses. Revisit when it is reached.
 */
const PUBLIC_INDEX_LIMIT = 100;

const PUBLISHED = {
  status: "PUBLISHED",
  publishedAt: { not: null },
} as const;

export async function listPublishedPosts(): Promise<PublicPostListItem[]> {
  const posts = await prisma.post.findMany({
    where: PUBLISHED,
    orderBy: { publishedAt: "desc" },
    take: PUBLIC_INDEX_LIMIT,
    // body is read only to count its words — the DTO below drops it, so no
    // listing ever ships a full post to the client.
    select: {
      slug: true,
      title: true,
      excerpt: true,
      publishedAt: true,
      body: true,
    },
  });

  // flatMap, not a `!` on publishedAt: the `where` guarantees it is non-null,
  // but the type should be narrowed by evidence rather than by assertion.
  return posts.flatMap((post) =>
    post.publishedAt === null
      ? []
      : [
          {
            slug: post.slug,
            title: post.title,
            excerpt: post.excerpt,
            publishedAt: post.publishedAt,
            readingMinutes: readingMinutes(post.body),
          },
        ],
  );
}

export async function getPublishedPost(
  slug: string,
): Promise<PublicPost | null> {
  const post = await prisma.post.findFirst({
    where: { slug, ...PUBLISHED },
    select: {
      slug: true,
      title: true,
      excerpt: true,
      publishedAt: true,
      body: true,
    },
  });

  if (!post || post.publishedAt === null) return null;

  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    publishedAt: post.publishedAt,
    body: post.body,
    readingMinutes: readingMinutes(post.body),
  };
}

// ---------------------------------------------------------------------------
// Admin
//
// These read drafts, so every caller must have passed getAdminViewer() first.
// ---------------------------------------------------------------------------

export type AdminPostRow = {
  id: string;
  slug: string;
  title: string;
  status: PostStatus;
  publishedAt: Date | null;
  /** null when the author's account has since been deleted — see the schema. */
  authorEmail: string | null;
  updatedAt: Date;
};

export type AdminPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  status: PostStatus;
  publishedAt: Date | null;
};

export const POSTS_PAGE_SIZE = 25;

export async function listAdminPosts(opts: {
  status?: PostStatus;
  page?: number;
}): Promise<{ rows: AdminPostRow[]; total: number; page: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const where = opts.status ? { status: opts.status } : {};

  const [rows, total] = await Promise.all([
    prisma.post.findMany({
      where,
      // Drafts have no publishedAt, so ordering by it would file every draft
      // together at one end. updatedAt is what "what was I just working on"
      // means here.
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * POSTS_PAGE_SIZE,
      take: POSTS_PAGE_SIZE,
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        publishedAt: true,
        updatedAt: true,
        author: { select: { email: true } },
      },
    }),
    prisma.post.count({ where }),
  ]);

  return {
    rows: rows.map(({ author, ...row }) => ({
      ...row,
      authorEmail: author?.email ?? null,
    })),
    total,
    page,
  };
}

export async function getAdminPost(id: string): Promise<AdminPost | null> {
  return prisma.post.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      body: true,
      status: true,
      publishedAt: true,
    },
  });
}
