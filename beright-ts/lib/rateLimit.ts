/**
 * Rate Limiting for BeRight Protocol
 *
 * Uses Upstash Redis for distributed rate limiting.
 * Implements sliding window rate limiting with:
 * - Per-user limits
 * - Per-endpoint limits
 * - Platform API quota tracking
 *
 * Falls back to in-memory rate limiting if Redis is unavailable.
 */

import { secrets } from './secrets';
import { logger } from './logger';

// Rate limit configurations
export interface RateLimitConfig {
  // Requests allowed in the window
  limit: number;
  // Window size in seconds
  window: number;
  // Optional: cost per request (for weighted limits)
  cost?: number;
}

// Predefined rate limits by endpoint type
export const RATE_LIMITS = {
  // General API endpoints
  default: { limit: 100, window: 60 }, // 100 req/min

  // Read operations (higher limits)
  markets: { limit: 60, window: 60 }, // 60 req/min
  leaderboard: { limit: 30, window: 60 }, // 30 req/min
  predictions_read: { limit: 60, window: 60 }, // 60 req/min

  // Write operations (lower limits)
  predictions_write: { limit: 10, window: 60 }, // 10 predictions/min
  alerts: { limit: 20, window: 60 }, // 20 alerts/min

  // Expensive operations (strict limits)
  research: { limit: 5, window: 60 }, // 5 req/min (AI-intensive)
  arbitrage: { limit: 10, window: 60 }, // 10 req/min
  whale: { limit: 10, window: 60 }, // 10 req/min

  // Trading operations (very strict)
  trade_quote: { limit: 20, window: 60 }, // 20 quotes/min
  trade_execute: { limit: 5, window: 60 }, // 5 trades/min

  // Platform API quotas (shared across all users)
  platform_polymarket: { limit: 100, window: 60 },
  platform_kalshi: { limit: 60, window: 60 },
  platform_manifold: { limit: 100, window: 60 },
  platform_metaculus: { limit: 30, window: 60 },
} as const;

export type RateLimitType = keyof typeof RATE_LIMITS;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  reset: number; // Unix timestamp when the window resets
  retryAfter?: number; // Seconds until retry is allowed
}

// In-memory fallback store
const memoryStore = new Map<string, { count: number; expires: number }>();

/**
 * Check rate limit using Upstash Redis
 */
async function checkRedisRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const upstash = secrets.getUpstashCredentials();
  if (!upstash) {
    throw new Error('Upstash not configured');
  }

  const now = Date.now();
  const windowMs = config.window * 1000;
  const windowStart = now - windowMs;

  try {
    // Use Upstash REST API for sliding window rate limiting
    // ZREMRANGEBYSCORE removes old entries, ZADD adds new, ZCARD counts
    const response = await fetch(`${upstash.url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${upstash.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        // Remove entries outside the window
        ['ZREMRANGEBYSCORE', key, '0', windowStart.toString()],
        // Add current request
        ['ZADD', key, now.toString(), `${now}-${Math.random()}`],
        // Count entries in window
        ['ZCARD', key],
        // Set expiry on the key
        ['EXPIRE', key, config.window.toString()],
      ]),
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      throw new Error(`Upstash error: ${response.status}`);
    }

    const results = await response.json() as any[];

    // Results: [ZREMRANGEBYSCORE result, ZADD result, ZCARD result, EXPIRE result]
    const count = results[2]?.result || 0;
    const cost = config.cost || 1;
    const remaining = Math.max(0, config.limit - count * cost);
    const allowed = count <= config.limit / cost;

    return {
      allowed,
      remaining,
      limit: config.limit,
      reset: Math.ceil((now + windowMs) / 1000),
      retryAfter: allowed ? undefined : Math.ceil(windowMs / 1000),
    };
  } catch (error) {
    logger.error('Redis rate limit error', error);
    throw error;
  }
}

/**
 * Check rate limit using in-memory store (fallback)
 */
function checkMemoryRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const windowMs = config.window * 1000;

  // Clean up expired entries periodically
  if (Math.random() < 0.01) {
    for (const [k, v] of memoryStore.entries()) {
      if (v.expires < now) {
        memoryStore.delete(k);
      }
    }
  }

  const entry = memoryStore.get(key);
  const cost = config.cost || 1;

  if (!entry || entry.expires < now) {
    // New window
    memoryStore.set(key, {
      count: cost,
      expires: now + windowMs,
    });

    return {
      allowed: true,
      remaining: config.limit - cost,
      limit: config.limit,
      reset: Math.ceil((now + windowMs) / 1000),
    };
  }

  // Existing window
  const newCount = entry.count + cost;
  const allowed = newCount <= config.limit;

  if (allowed) {
    entry.count = newCount;
  }

  return {
    allowed,
    remaining: Math.max(0, config.limit - newCount),
    limit: config.limit,
    reset: Math.ceil(entry.expires / 1000),
    retryAfter: allowed ? undefined : Math.ceil((entry.expires - now) / 1000),
  };
}

/**
 * Check rate limit for a given key
 *
 * @param identifier - Unique identifier (userId, IP, etc.)
 * @param limitType - Type of rate limit to apply
 * @returns Rate limit result
 */
export async function checkRateLimit(
  identifier: string,
  limitType: RateLimitType = 'default'
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[limitType];
  const key = `ratelimit:${limitType}:${identifier}`;

  // Try Redis first, fall back to memory
  const upstash = secrets.getUpstashCredentials();

  if (upstash) {
    try {
      return await checkRedisRateLimit(key, config);
    } catch {
      // Fall back to memory
      logger.warn('Redis rate limit failed, using memory fallback', { identifier, limitType });
    }
  }

  return checkMemoryRateLimit(key, config);
}

/**
 * Check rate limit for platform API calls
 */
export async function checkPlatformRateLimit(
  platform: 'polymarket' | 'kalshi' | 'manifold' | 'metaculus'
): Promise<RateLimitResult> {
  const limitType = `platform_${platform}` as RateLimitType;
  return checkRateLimit('global', limitType);
}

/**
 * Get rate limit headers for HTTP response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toString(),
  };

  if (result.retryAfter) {
    headers['Retry-After'] = result.retryAfter.toString();
  }

  return headers;
}

/**
 * Extract identifier from request
 * Priority: userId > API key > IP
 */
export function getIdentifierFromRequest(request: Request): string {
  // Check for user ID in headers (set by auth middleware)
  const userId = request.headers.get('X-User-ID');
  if (userId) {
    return `user:${userId}`;
  }

  // Check for API key
  const apiKey = request.headers.get('X-API-Key');
  if (apiKey) {
    return `apikey:${apiKey.substring(0, 16)}`;
  }

  // Fall back to IP
  const forwardedFor = request.headers.get('X-Forwarded-For');
  const ip = forwardedFor?.split(',')[0]?.trim() || 'unknown';
  return `ip:${ip}`;
}

/**
 * Rate limit middleware for Next.js API routes
 *
 * Usage:
 *   const { allowed, headers, error } = await rateLimit(request, 'predictions_write');
 *   if (!allowed) {
 *     return NextResponse.json({ error }, { status: 429, headers });
 *   }
 */
export async function rateLimit(
  request: Request,
  limitType: RateLimitType = 'default'
): Promise<{
  allowed: boolean;
  headers: Record<string, string>;
  error?: string;
  result: RateLimitResult;
}> {
  const identifier = getIdentifierFromRequest(request);
  const result = await checkRateLimit(identifier, limitType);
  const headers = getRateLimitHeaders(result);

  if (!result.allowed) {
    return {
      allowed: false,
      headers,
      error: `Rate limit exceeded. Try again in ${result.retryAfter} seconds.`,
      result,
    };
  }

  return {
    allowed: true,
    headers,
    result,
  };
}

/**
 * Decrement rate limit (for refunds on failed requests)
 */
export async function refundRateLimit(
  identifier: string,
  limitType: RateLimitType = 'default'
): Promise<void> {
  const key = `ratelimit:${limitType}:${identifier}`;
  const upstash = secrets.getUpstashCredentials();

  if (upstash) {
    try {
      // Remove the most recent entry
      await fetch(`${upstash.url}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${upstash.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(['ZPOPMAX', key]),
        signal: AbortSignal.timeout(2000),
      });
    } catch {
      // Ignore refund failures
    }
  } else {
    // Memory fallback
    const entry = memoryStore.get(key);
    if (entry && entry.count > 0) {
      entry.count--;
    }
  }
}
