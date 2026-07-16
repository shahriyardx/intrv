import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

/**
 * A share id is a capability, not an invitation: the link works for whoever
 * holds it, which is exactly why /r/* must not end up in an index where nobody
 * holds it deliberately. /s/*, /dashboard/* and /admin/* are private outright.
 * robots.txt is a request, not a control — the pages carry `robots: noindex`
 * of their own, and access is still decided in the DAL.
 */
export default function robots(): MetadataRoute.Robots {
  const origin = env.BETTER_AUTH_URL.replace(/\/$/, "");

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/s/", "/r/", "/dashboard/", "/admin/", "/api/"],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
