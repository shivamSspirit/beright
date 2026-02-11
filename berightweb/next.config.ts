import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Proxy API requests to beright-ts backend
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*',
      },
    ];
  },
};

export default nextConfig;
