import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Webpack is used because native Turbopack bindings are unavailable in this Windows environment. */
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
