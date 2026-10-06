import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [],
  },
  // All API routes are dynamic; uploads are served through the app.
  experimental: {},
};

export default nextConfig;
