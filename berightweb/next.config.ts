import type { NextConfig } from "next";
import path from "path";

// API URL: Use environment variable in production, localhost in development
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const nextConfig: NextConfig = {
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
