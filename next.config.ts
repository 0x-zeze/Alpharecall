import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: [
    "@mysten-incubation/memwal",
    "@mysten/seal",
    "@mysten/sui",
    "@grpc/grpc-js",
    "@grpc/proto-loader",
  ],
  outputFileTracingIncludes: {
    "/api/**/*": ["./proto/**/*"],
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
