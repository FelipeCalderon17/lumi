import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Pin the workspace root so a stray lockfile in a parent folder is never picked up.
  turbopack: { root: process.cwd() },
  // AGENTS.md is written by people for this repo; don't let `next dev` append its own block.
  agentRules: false,
};

export default nextConfig;
