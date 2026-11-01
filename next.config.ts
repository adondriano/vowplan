import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Tree-shake barrel-file packages into per-icon/per-component modules.
    optimizePackageImports: ["lucide-react", "recharts"],
  },
};

export default nextConfig;
