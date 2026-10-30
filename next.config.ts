import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Pin the workspace root so a stray lockfile in a parent folder is never picked up.
  turbopack: { root: process.cwd() },
};

export default nextConfig;
