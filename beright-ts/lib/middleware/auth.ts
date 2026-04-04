/**
 * Unified Authentication Middleware
 *
 * Provides consistent auth across all API routes.
 *
 * Auth Methods:
 * 1. Bearer token (Privy JWT)
 * 2. X-API-Key header (programmatic access)
 * 3. X-Wallet-Address header (wallet-based auth)
 * 4. Service role (internal services)
 *
 * Usage:
 *   import { withAuth, requireAuth, requireAdmin } from '@/lib/middleware/auth';
 *
 *   // Optional auth (extracts context if present)
 *   export const GET = withAuth(async (req, ctx) => { ... });
 *
 *   // Required auth (returns 401 if not authenticated)
 *   export const POST = requireAuth(async (req, ctx) => { ... });
 *
 *   // Admin only
 *   export const DELETE = requireAdmin(async (req, ctx) => { ... });
 */

import { NextRequest, NextResponse } from 'next/server';
import { secrets } from '../secrets';
import { logSecurityEvent } from './securityLogger';

// ============================================
// TYPES
// ============================================

export type AuthSource = 'bearer' | 'api_key' | 'wallet' | 'service' | 'telegram' | 'anonymous';
export type UserTier = 'public' | 'verified' | 'admin' | 'service';

export interface AuthContext {
  authenticated: boolean;
  source: AuthSource;
  tier: UserTier;

  // Identifiers (at least one present if authenticated)
  walletAddress?: string;
  userId?: string;
  telegramId?: string;
  apiKeyId?: string;

  // Rate limiting info
  rateLimit: {
    limit: number;
    remaining: number;
    reset: Date;
  };

  // Request metadata
  requestId: string;
  ip: string;
  userAgent: string;
}

export interface AuthOptions {
  required?: boolean;
  allowedTiers?: UserTier[];
  allowedSources?: AuthSource[];
  skipRateLimit?: boolean;
}

type AuthenticatedHandler = (
  request: NextRequest,
  context: AuthContext
) => Promise<NextResponse> | NextResponse;

// ============================================
// CONFIGURATION
// ============================================

// Super admin wallet addresses
const ADMIN_WALLETS = new Set(
  (process.env.ADMIN_WALLET_ADDRESSES || '').split(',').filter(Boolean)
);

// Super admin Telegram ID
const SUPER_ADMIN_TELEGRAM_ID = process.env.SUPER_ADMIN_TELEGRAM_ID || '5504043269';

// API keys (format: key_id:key_hash)
// In production, these should be stored in database
const API_KEYS = new Map<string, { tier: UserTier; userId?: string }>();

// Service role key (for internal service-to-service calls)
const SERVICE_ROLE_KEY = process.env.INTERNAL_SERVICE_KEY;

// Rate limits by tier
const RATE_LIMITS: Record<UserTier, { perMinute: number; perHour: number }> = {
  public: { perMinute: 10, perHour: 100 },
  verified: { perMinute: 30, perHour: 500 },
  admin: { perMinute: 100, perHour: 2000 },
  service: { perMinute: 1000, perHour: 10000 },
};

// In-memory rate limit store (use Redis in production)
const rateLimitStore = new Map<string, { count: number; reset: number }>();

// ============================================
// CORE AUTH FUNCTIONS
// ============================================

/**
 * Extract auth context from request
 */
export async function extractAuthContext(request: NextRequest): Promise<AuthContext> {
  const requestId = generateRequestId();
  const ip = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || 'unknown';

  // Base context
  const ctx: AuthContext = {
    authenticated: false,
    source: 'anonymous',
    tier: 'public',
    rateLimit: {
      limit: RATE_LIMITS.public.perMinute,
      remaining: RATE_LIMITS.public.perMinute,
      reset: new Date(Date.now() + 60000),
    },
    requestId,
    ip,
    userAgent,
  };

  // Try service role first (highest priority)
  const serviceKey = request.headers.get('x-service-key');
  if (serviceKey && SERVICE_ROLE_KEY && serviceKey === SERVICE_ROLE_KEY) {
    ctx.authenticated = true;
    ctx.source = 'service';
    ctx.tier = 'service';
    ctx.userId = 'service';
    return applyRateLimit(ctx, 'service');
  }

  // Try Bearer token (Privy JWT)
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const jwtResult = await verifyJWT(token);
    if (jwtResult) {
      ctx.authenticated = true;
      ctx.source = 'bearer';
      ctx.walletAddress = jwtResult.walletAddress;
      ctx.userId = jwtResult.userId;
      ctx.tier = determineTier(jwtResult.walletAddress);
      return applyRateLimit(ctx, ctx.walletAddress || ctx.userId || ip);
    }
  }

  // Try API key
  const apiKey = request.headers.get('x-api-key');
  if (apiKey) {
    const keyInfo = validateApiKey(apiKey);
    if (keyInfo) {
      ctx.authenticated = true;
      ctx.source = 'api_key';
      ctx.tier = keyInfo.tier;
      ctx.apiKeyId = apiKey.slice(0, 8);
      ctx.userId = keyInfo.userId;
      return applyRateLimit(ctx, ctx.apiKeyId);
    }
  }

  // Try wallet address header (for simple wallet auth)
  const walletHeader = request.headers.get('x-wallet-address');
  if (walletHeader && isValidWalletAddress(walletHeader)) {
    ctx.authenticated = true;
    ctx.source = 'wallet';
    ctx.walletAddress = walletHeader;
    ctx.tier = determineTier(walletHeader);
    return applyRateLimit(ctx, walletHeader);
  }

  // Try Telegram ID header (for Telegram bot forwarding)
  const telegramId = request.headers.get('x-telegram-id');
  if (telegramId) {
    ctx.authenticated = true;
    ctx.source = 'telegram';
    ctx.telegramId = telegramId;
    ctx.tier = telegramId === SUPER_ADMIN_TELEGRAM_ID ? 'admin' : 'verified';
    return applyRateLimit(ctx, telegramId);
  }

  // Anonymous - apply rate limit by IP
  return applyRateLimit(ctx, ip);
}

/**
 * Determine user tier from wallet address
 */
function determineTier(walletAddress?: string): UserTier {
  if (!walletAddress) return 'public';
  if (ADMIN_WALLETS.has(walletAddress)) return 'admin';
  // All wallet-connected users are verified
  return 'verified';
}

/**
 * Verify JWT token (Privy or Supabase)
 */
async function verifyJWT(token: string): Promise<{ walletAddress?: string; userId?: string } | null> {
  try {
    // Decode JWT without verification first to check issuer
    const [, payloadBase64] = token.split('.');
    if (!payloadBase64) return null;

    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());

    // For development, accept the token if it has valid structure
    // In production, verify with Privy or Supabase
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_JWT_VERIFY === 'true') {
      return {
        walletAddress: payload.wallet_address || payload.walletAddress,
        userId: payload.sub || payload.user_id,
      };
    }

    // Privy verification
    if (payload.iss?.includes('privy')) {
      // TODO: Add Privy verification when API key is configured
      // For now, trust the token structure
      return {
        walletAddress: payload.wallet_address,
        userId: payload.sub,
      };
    }

    // Supabase verification
    if (payload.iss?.includes('supabase')) {
      const supabase = secrets.getSupabaseCredentials();
      if (!supabase) return null;

      // The token should be verified by Supabase client
      // For API routes, we trust headers if service role is used
      return {
        walletAddress: payload.wallet_address,
        userId: payload.sub,
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Validate API key
 */
function validateApiKey(key: string): { tier: UserTier; userId?: string } | null {
  // Check static API keys
  const keyInfo = API_KEYS.get(key);
  if (keyInfo) return keyInfo;

  // Check environment variable API keys
  const envApiKey = process.env.BERIGHT_API_KEY;
  if (envApiKey && key === envApiKey) {
    return { tier: 'verified' };
  }

  const adminApiKey = process.env.BERIGHT_ADMIN_API_KEY;
  if (adminApiKey && key === adminApiKey) {
    return { tier: 'admin' };
  }

  return null;
}

/**
 * Validate Solana wallet address
 */
function isValidWalletAddress(address: string): boolean {
  // Basic Solana address validation (base58, 32-44 chars)
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

/**
 * Apply rate limiting
 */
function applyRateLimit(ctx: AuthContext, identifier: string): AuthContext {
  const limits = RATE_LIMITS[ctx.tier];
  const now = Date.now();
  const key = `rate:${identifier}`;

  let record = rateLimitStore.get(key);
  if (!record || now > record.reset) {
    record = { count: 0, reset: now + 60000 };
    rateLimitStore.set(key, record);
  }

  record.count++;

  ctx.rateLimit = {
    limit: limits.perMinute,
    remaining: Math.max(0, limits.perMinute - record.count),
    reset: new Date(record.reset),
  };

  return ctx;
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Get client IP from request
 */
function getClientIP(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  const realIP = request.headers.get('x-real-ip');
  if (realIP) return realIP;
  return '127.0.0.1';
}

// ============================================
// MIDDLEWARE WRAPPERS
// ============================================

/**
 * Wrap handler with optional auth
 * Extracts auth context but doesn't require authentication
 */
export function withAuth(handler: AuthenticatedHandler): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    const ctx = await extractAuthContext(request);

    // Add rate limit headers
    const response = await handler(request, ctx);
    response.headers.set('X-Request-ID', ctx.requestId);
    response.headers.set('X-RateLimit-Limit', ctx.rateLimit.limit.toString());
    response.headers.set('X-RateLimit-Remaining', ctx.rateLimit.remaining.toString());
    response.headers.set('X-RateLimit-Reset', ctx.rateLimit.reset.toISOString());

    return response;
  };
}

/**
 * Wrap handler with required auth
 * Returns 401 if not authenticated
 */
export function requireAuth(
  handler: AuthenticatedHandler,
  options: AuthOptions = {}
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    const ctx = await extractAuthContext(request);

    // Check authentication
    if (!ctx.authenticated) {
      await logSecurityEvent({
        eventType: 'auth_failure',
        action: 'api_access_denied',
        severity: 'warning',
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
        requestId: ctx.requestId,
        details: { reason: 'not_authenticated', path: request.nextUrl.pathname },
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
        },
        {
          status: 401,
          headers: {
            'X-Request-ID': ctx.requestId,
            'WWW-Authenticate': 'Bearer, ApiKey',
          },
        }
      );
    }

    // Check allowed tiers
    if (options.allowedTiers && !options.allowedTiers.includes(ctx.tier)) {
      await logSecurityEvent({
        eventType: 'auth_failure',
        action: 'insufficient_tier',
        severity: 'warning',
        walletAddress: ctx.walletAddress,
        telegramId: ctx.telegramId,
        ipAddress: ctx.ip,
        requestId: ctx.requestId,
        details: { tier: ctx.tier, required: options.allowedTiers },
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient permissions',
          code: 'FORBIDDEN',
        },
        { status: 403, headers: { 'X-Request-ID': ctx.requestId } }
      );
    }

    // Check allowed sources
    if (options.allowedSources && !options.allowedSources.includes(ctx.source)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid authentication method',
          code: 'INVALID_AUTH_METHOD',
        },
        { status: 403, headers: { 'X-Request-ID': ctx.requestId } }
      );
    }

    // Check rate limit
    if (!options.skipRateLimit && ctx.rateLimit.remaining <= 0) {
      await logSecurityEvent({
        eventType: 'rate_limit',
        action: 'api_rate_limited',
        severity: 'warning',
        walletAddress: ctx.walletAddress,
        telegramId: ctx.telegramId,
        ipAddress: ctx.ip,
        requestId: ctx.requestId,
        success: false,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded',
          code: 'RATE_LIMITED',
          retryAfter: Math.ceil((ctx.rateLimit.reset.getTime() - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'X-Request-ID': ctx.requestId,
            'X-RateLimit-Limit': ctx.rateLimit.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': ctx.rateLimit.reset.toISOString(),
            'Retry-After': Math.ceil((ctx.rateLimit.reset.getTime() - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // Log successful auth
    await logSecurityEvent({
      eventType: 'api_access',
      action: request.nextUrl.pathname,
      severity: 'debug',
      walletAddress: ctx.walletAddress,
      telegramId: ctx.telegramId,
      ipAddress: ctx.ip,
      requestId: ctx.requestId,
      success: true,
      details: { method: request.method, source: ctx.source, tier: ctx.tier },
    });

    // Call handler
    const response = await handler(request, ctx);

    // Add headers
    response.headers.set('X-Request-ID', ctx.requestId);
    response.headers.set('X-RateLimit-Limit', ctx.rateLimit.limit.toString());
    response.headers.set('X-RateLimit-Remaining', ctx.rateLimit.remaining.toString());
    response.headers.set('X-RateLimit-Reset', ctx.rateLimit.reset.toISOString());

    return response;
  };
}

/**
 * Wrap handler with admin requirement
 */
export function requireAdmin(handler: AuthenticatedHandler): (request: NextRequest) => Promise<NextResponse> {
  return requireAuth(handler, { allowedTiers: ['admin', 'service'] });
}

/**
 * Wrap handler with service role requirement
 */
export function requireService(handler: AuthenticatedHandler): (request: NextRequest) => Promise<NextResponse> {
  return requireAuth(handler, { allowedTiers: ['service'] });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Register an API key (call at startup or from admin endpoint)
 */
export function registerApiKey(key: string, tier: UserTier, userId?: string): void {
  API_KEYS.set(key, { tier, userId });
}

/**
 * Revoke an API key
 */
export function revokeApiKey(key: string): boolean {
  return API_KEYS.delete(key);
}

/**
 * Add admin wallet
 */
export function addAdminWallet(address: string): void {
  ADMIN_WALLETS.add(address);
}

/**
 * Remove admin wallet
 */
export function removeAdminWallet(address: string): boolean {
  return ADMIN_WALLETS.delete(address);
}

/**
 * Clear rate limit for identifier (for testing)
 */
export function clearRateLimit(identifier: string): void {
  rateLimitStore.delete(`rate:${identifier}`);
}

/**
 * Get rate limit info for identifier
 */
export function getRateLimitInfo(identifier: string): { count: number; reset: number } | undefined {
  return rateLimitStore.get(`rate:${identifier}`);
}
