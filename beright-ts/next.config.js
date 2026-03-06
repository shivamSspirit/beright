/** @type {import('next').NextConfig} */
const nextConfig = {
  // External packages for server components (moved from experimental in Next.js 16)
  serverExternalPackages: ['@solana/web3.js'],

  // Turbopack config with root set for monorepo
  turbopack: {
    root: require('path').resolve(__dirname, '..'),
  },

  // Configure webpack for Node.js modules used in skills
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't bundle Node.js modules for client-side
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
      };
    }
    return config;
  },

  // Environment variables that can be exposed to the browser
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },

  // Disable x-powered-by header
  poweredByHeader: false,

  // Enable strict mode for React
  reactStrictMode: true,

  // CORS headers for API routes (allow frontend to call from Vercel)
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,DELETE,PATCH,POST,PUT,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
