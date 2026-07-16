import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dynamic-by-default data with opt-in `use cache`, plus PPR (a static shell
  // that streams dynamic holes). Replaces the removed `experimental.ppr`.
  cacheComponents: true,
  // Stable in 16 — no longer `experimental.typedRoutes`.
  typedRoutes: true,
  reactCompiler: true,
};

export default nextConfig;
