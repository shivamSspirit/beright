/**
 * Next.js Proxy for BeRight Protocol API
 *
 * Handles:
 * 1. CORS for all API routes
 * 2. Mode injection (demo/production) via headers for instant mode detection
 * 3. Owner-only production mode access control
 *
 * Mode Priority:
 * 1. Query parameter (?mode=demo) - highest, also syncs to cookie
 * 2. Cookie (beright_mode) - persisted user preference
 * 3. Environment variable (BERIGHT_MODE) - deployment default
 * 4. Default to 'demo' for safety
 *
 * Access Control:
 * - Production mode only accessible by owner email (OWNER_EMAIL env var)
 * - All other users (wallet connects, other emails) are forced to demo mode
 */

import { NextRequest, NextResponse } from 'next/server';

// ============================================
// MODE CONFIGURATION
// ============================================

const MODE_COOKIE = 'beright_mode';
const MODE_HEADER = 'x-beright-mode';
const NETWORK_HEADER = 'x-beright-network';
const USER_EMAIL_HEADER = 'x-user-email';
const MODE_QUERY = 'mode';
const VALID_MODES = ['demo', 'production'] as const;
const DEFAULT_MODE = 'demo';

// Owner email for production mode access control
const OWNER_EMAIL = process.env.OWNER_EMAIL?.toLowerCase().trim();

type BeRightMode = (typeof VALID_MODES)[number];

function validateMode(value: string | null | undefined): BeRightMode {
  if (value && VALID_MODES.includes(value as BeRightMode)) {
    return value as BeRightMode;
  }
  return DEFAULT_MODE;
}

/**
 * Validate mode access based on user email
 * Forces demo mode for non-owners requesting production
 */
function validateModeAccess(requestedMode: BeRightMode, userEmail: string | null): BeRightMode {
  // Demo mode is always allowed
  if (requestedMode === 'demo') {
    return 'demo';
  }

  // Production mode requires owner email
  if (requestedMode === 'production') {
    const normalizedEmail = userEmail?.toLowerCase().trim();
    if (normalizedEmail && OWNER_EMAIL && normalizedEmail === OWNER_EMAIL) {
      return 'production';
    }
    // Force demo for non-owners
    return 'demo';
  }

  return 'demo';
}

// ============================================
// CORS CONFIGURATION
// ============================================

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

// ============================================
// PROXY HANDLER
// ============================================

export function proxy(request: NextRequest) {
  const origin = request.headers.get('origin') || '';
  const isAllowedOrigin = ALLOWED_ORIGINS.includes(origin) || origin === '' || VERCEL_PATTERN.test(origin);

  // ============================================
  // MODE DETECTION (runs on every request)
  // ============================================

  const url = new URL(request.url);

  // Priority: query > header > cookie > env > default
  const queryMode = url.searchParams.get(MODE_QUERY);
  const headerMode = request.headers.get(MODE_HEADER); // Client-sent mode header
  const cookieMode = request.cookies.get(MODE_COOKIE)?.value;
  const envMode = process.env.BERIGHT_MODE;

  const requestedMode = validateMode(queryMode) !== DEFAULT_MODE
    ? validateMode(queryMode)
    : validateMode(headerMode) !== DEFAULT_MODE
      ? validateMode(headerMode)
      : validateMode(cookieMode) !== DEFAULT_MODE
        ? validateMode(cookieMode)
        : validateMode(envMode);

  // Get user email from header (sent by frontend)
  const userEmail = request.headers.get(USER_EMAIL_HEADER);

  // Validate mode access - forces demo for non-owners requesting production
  const mode = validateModeAccess(requestedMode, userEmail);

  const network = mode === 'production' ? 'mainnet-beta' : 'devnet';

  // ============================================
  // PREFLIGHT (OPTIONS) HANDLING
  // ============================================

  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': isAllowedOrigin ? origin : ALLOWED_ORIGINS[0],
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, X-Wallet-Address, X-Telegram-ID, X-User-ID, x-beright-mode, x-beright-network, x-user-email',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // ============================================
  // INJECT MODE HEADERS INTO REQUEST
  // ============================================

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(MODE_HEADER, mode);
  requestHeaders.set(NETWORK_HEADER, network);

  // Create response with modified request headers
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // ============================================
  // ADD CORS HEADERS TO RESPONSE
  // ============================================

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
    'Content-Type, Authorization, X-API-Key, X-Wallet-Address, X-Telegram-ID, X-User-ID, x-beright-mode, x-beright-network, x-user-email'
  );

  // ============================================
  // SYNC QUERY MODE TO COOKIE (for persistence)
  // ============================================

  if (queryMode && VALID_MODES.includes(queryMode as BeRightMode)) {
    response.cookies.set(MODE_COOKIE, queryMode, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: 'lax',
    });
  }

  return response;
}

// Only run middleware on API routes
export const config = {
  matcher: '/api/:path*',
};
