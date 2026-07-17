import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit .next/standalone — a self-contained server.js plus only the traced
  // node_modules. The Dockerfile copies that rather than the whole tree.
  output: "standalone",
  // Dynamic-by-default data with opt-in `use cache`, plus PPR (a static shell
  // that streams dynamic holes). Replaces the removed `experimental.ppr`.
  cacheComponents: true,
  // Stable in 16 — no longer `experimental.typedRoutes`.
  typedRoutes: true,
  reactCompiler: true,
};

export default nextConfig;
