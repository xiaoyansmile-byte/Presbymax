import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@prosbymax/core", "@prosbymax/types", "@prosbymax/ui"]
};

export default nextConfig;
