/**
 * Next.js Middleware for BeRight Protocol API
 * Handles CORS for all API routes
 */

import { NextRequest, NextResponse } from 'next/server';

// CORS configuration
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
];

// In production, add your domains
if (process.env.NEXT_PUBLIC_APP_URL) {
  ALLOWED_ORIGINS.push(process.env.NEXT_PUBLIC_APP_URL);
}

// Add Vercel frontend URL (required for production)
if (process.env.VERCEL_FRONTEND_URL) {
  ALLOWED_ORIGINS.push(process.env.VERCEL_FRONTEND_URL);
}

// Allow all Vercel preview deployments
const VERCEL_PATTERN = /^https:\/\/.*\.vercel\.app$/;

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin') || '';
  const isAllowedOrigin = ALLOWED_ORIGINS.includes(origin) || origin === '' || VERCEL_PATTERN.test(origin);

  // Handle preflight OPTIONS request
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': isAllowedOrigin ? origin : ALLOWED_ORIGINS[0],
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, X-Wallet-Address, X-Telegram-ID, X-User-ID',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // For actual requests, add CORS headers to response
  const response = NextResponse.next();

  response.headers.set(
    'Access-Control-Allow-Origin',
    isAllowedOrigin ? origin || '*' : ALLOWED_ORIGINS[0]
  );
  response.headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS, PATCH'
  );
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-API-Key, X-Wallet-Address, X-Telegram-ID, X-User-ID'
  );

  return response;
}

// Only run middleware on API routes
export const config = {
  matcher: '/api/:path*',
};
