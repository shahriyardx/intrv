import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

/**
 * Only the marketing surface belongs here. Everything else this app serves is
 * either a live session or somebody's result, and neither is a page a search
 * engine has any business holding a copy of.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = env.BETTER_AUTH_URL.replace(/\/$/, "");

  // No lastModified: `new Date()` would read the clock, and a prerender under
  // cacheComponents rejects that. Neither route changes on a schedule anyway.
  return [
    {
      url: origin,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${origin}/start`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}
