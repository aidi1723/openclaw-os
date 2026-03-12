import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const nextConfig = (phase: string): NextConfig => {
  const staticExport = process.env.AGENTCORE_STATIC_EXPORT === "1";

  return {
    // Avoid dev/build clobbering the same .next folder (can cause /_next/static 404 and "乱码").
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
    output: staticExport ? "export" : undefined,
    images: staticExport ? { unoptimized: true } : undefined,
    trailingSlash: staticExport,
  };
};

export default nextConfig;
