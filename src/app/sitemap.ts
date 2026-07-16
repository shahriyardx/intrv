import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { listPublishedPosts } from "@/server/dal/blog";

/**
 * Only the marketing surface belongs here. Everything else this app serves is
 * either a live session or somebody's result, and neither is a page a search
 * engine has any business holding a copy of.
 *
 * Reading published posts makes this dynamic, which is correct: frozen at build
 * time it would never list a post published after the deploy.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = env.BETTER_AUTH_URL.replace(/\/$/, "");

  // No lastModified on these: `new Date()` would read the clock, and a
  // prerender under cacheComponents rejects that. None of them change on a
  // schedule anyway — posts carry a real timestamp from the database.
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: origin, changeFrequency: "monthly", priority: 1 },
    { url: `${origin}/start`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${origin}/blog`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${origin}/leaderboard`, changeFrequency: "daily", priority: 0.6 },
    { url: `${origin}/about`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${origin}/contact`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${origin}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${origin}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ];

  const posts = await listPublishedPosts();

  return [
    ...staticRoutes,
    ...posts.map((post) => ({
      url: `${origin}/blog/${post.slug}`,
      lastModified: post.publishedAt ?? undefined,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
