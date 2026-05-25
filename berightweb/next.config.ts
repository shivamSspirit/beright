import type { NextConfig } from "next";
import path from "path";

// API URL: prefer configured env, but bypass legacy broken api.beright.fun host.
const rawApiUrl = process.env.NEXT_PUBLIC_API_URL;
const API_URL =
  !rawApiUrl || rawApiUrl.includes('api.beright.fun')
    ? 'https://beright-protocol-production-3b61.up.railway.app'
    : rawApiUrl;

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployments
  output: 'standalone',

  // Hide dev indicators in production builds
  devIndicators: false,

  // Fix Turbopack monorepo root detection
  turbopack: {
    root: path.join(__dirname, ".."),
  },

  // Proxy API requests to beright-ts backend
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
