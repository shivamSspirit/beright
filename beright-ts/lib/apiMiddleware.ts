/**
 * API Middleware for BeRight Protocol
 *
 * Provides:
 * - Rate limiting
 * - Authentication
 * - Request validation
 * - Error handling
 * - Logging (via logger)
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, RateLimitType, getRateLimitHeaders } from './rateLimit';
import { secrets } from './secrets';
import { getRequestLogger } from './logger';
import { z } from 'zod';

export interface ApiContext {
  userId?: string;
  isAuthenticated: boolean;
  requestId: string;
  startTime: number;
}

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
}

type ApiHandler<T = unknown> = (
  request: NextRequest,
  context: ApiContext
) => Promise<NextResponse<ApiResponse<T>> | Response>;

export interface ApiMiddlewareOptions {
  // Rate limiting
  rateLimit?: RateLimitType | false;

  // Authentication
  requireAuth?: boolean;

  // Request validation
  bodySchema?: z.ZodSchema;
  querySchema?: z.ZodSchema;

  // Caching
  cache?: {
    maxAge: number; // seconds
    staleWhileRevalidate?: number; // seconds
  };
}

/**
 * Wrap an API handler with middleware
 *
 * Usage:
 *   export const GET = withMiddleware(
 *     async (request, context) => {
 *       // Your handler logic
 *       return NextResponse.json({ data: result });
 *     },
 *     { rateLimit: 'markets', cache: { maxAge: 60 } }
 *   );
 */
// CORS headers for cross-origin requests
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, X-Wallet-Address, X-Telegram-ID, X-User-ID',
  'Access-Control-Max-Age': '86400',
};

export function withMiddleware<T = unknown>(
  handler: ApiHandler<T>,
  options: ApiMiddlewareOptions = {}
): (request: NextRequest) => Promise<NextResponse | Response> {
  return async (request: NextRequest) => {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    const startTime = Date.now();
    const requestId = generateRequestId();

    // Create context
    const context: ApiContext = {
      isAuthenticated: false,
      requestId,
      startTime,
    };

    // Collect headers to add to response (include CORS)
    const responseHeaders: Record<string, string> = {
      'X-Request-ID': requestId,
      ...CORS_HEADERS,
    };

    try {
      // 1. Rate limiting
      if (options.rateLimit !== false) {
        const limitType = options.rateLimit || 'default';
        const rateLimitResult = await rateLimit(request, limitType);

        // Add rate limit headers
        Object.assign(responseHeaders, rateLimitResult.headers);

        if (!rateLimitResult.allowed) {
          return NextResponse.json(
            {
              error: 'Too Many Requests',
              message: rateLimitResult.error,
            },
            {
              status: 429,
              headers: responseHeaders,
            }
          );
        }
      }

      // 2. Authentication
      const authResult = await authenticate(request);
      context.isAuthenticated = authResult.isAuthenticated;
      context.userId = authResult.userId;

      if (options.requireAuth && !context.isAuthenticated) {
        return NextResponse.json(
          {
            error: 'Unauthorized',
            message: 'Authentication required',
          },
          {
            status: 401,
            headers: responseHeaders,
          }
        );
      }

      // 3. Request validation
      if (options.bodySchema && request.method !== 'GET') {
        try {
          const body = await request.clone().json();
          const parsed = options.bodySchema.safeParse(body);

          if (!parsed.success) {
            return NextResponse.json(
              {
                error: 'Validation Error',
                message: parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
              },
              {
                status: 400,
                headers: responseHeaders,
              }
            );
          }
        } catch {
          return NextResponse.json(
            {
              error: 'Invalid JSON',
              message: 'Request body must be valid JSON',
            },
            {
              status: 400,
              headers: responseHeaders,
            }
          );
        }
      }

      if (options.querySchema) {
        const { searchParams } = new URL(request.url);
        const queryObject = Object.fromEntries(searchParams.entries());
        const parsed = options.querySchema.safeParse(queryObject);

        if (!parsed.success) {
          return NextResponse.json(
            {
              error: 'Validation Error',
              message: parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
            },
            {
              status: 400,
              headers: responseHeaders,
            }
          );
        }
      }

      // 4. Execute handler
      const response = await handler(request, context);

      // 5. Add common headers to response
      if (response instanceof NextResponse) {
        // Add our headers
        Object.entries(responseHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });

        // Add cache headers if configured
        if (options.cache && request.method === 'GET') {
          const cacheControl = options.cache.staleWhileRevalidate
            ? `public, s-maxage=${options.cache.maxAge}, stale-while-revalidate=${options.cache.staleWhileRevalidate}`
            : `public, s-maxage=${options.cache.maxAge}`;
          response.headers.set('Cache-Control', cacheControl);
        }

        // Add timing header
        response.headers.set('X-Response-Time', `${Date.now() - startTime}ms`);
      }

      return response;
    } catch (error) {
      // 6. Error handling with structured logging
      const log = getRequestLogger(requestId, context.userId);
      log.error('API error', error, {
        method: request.method,
        path: new URL(request.url).pathname,
        duration: Date.now() - startTime,
      });

      const message = error instanceof Error ? error.message : 'Internal server error';
      const isKnownError = error instanceof ApiError;

      return NextResponse.json(
        {
          error: isKnownError ? error.message : 'Internal Server Error',
          message: isKnownError ? error.details : 'An unexpected error occurred',
        },
        {
          status: isKnownError ? error.statusCode : 500,
          headers: {
            ...responseHeaders,
            'X-Response-Time': `${Date.now() - startTime}ms`,
          },
        }
      );
    }
  };
}

/**
 * Authenticate request
 */
async function authenticate(request: NextRequest): Promise<{
  isAuthenticated: boolean;
  userId?: string;
}> {
  // Check for Authorization header
  const authHeader = request.headers.get('Authorization');

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);

    // TODO: Validate JWT token with Supabase
    // For now, extract user ID from token (placeholder)
    try {
      // This would be replaced with actual Supabase JWT validation
      const supabase = secrets.getSupabaseCredentials();
      if (supabase) {
        // In production, validate the JWT and extract user
        // For now, we'll trust the X-User-ID header set by Supabase middleware
        const userId = request.headers.get('X-User-ID');
        if (userId) {
          return { isAuthenticated: true, userId };
        }
      }
    } catch {
      // Invalid token
    }
  }

  // Check for API key
  const apiKey = request.headers.get('X-API-Key');
  if (apiKey) {
    // TODO: Validate API key against database
    return { isAuthenticated: true, userId: `apikey:${apiKey.substring(0, 8)}` };
  }

  // Check for wallet address (for unsigned requests)
  const walletAddress = request.headers.get('X-Wallet-Address');
  if (walletAddress) {
    return { isAuthenticated: true, userId: `wallet:${walletAddress}` };
  }

  // Check for Telegram ID
  const telegramId = request.headers.get('X-Telegram-ID');
  if (telegramId) {
    return { isAuthenticated: true, userId: `telegram:${telegramId}` };
  }

  return { isAuthenticated: false };
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Custom API error class
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public details?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static badRequest(message: string, details?: string): ApiError {
    return new ApiError(message, 400, details);
  }

  static unauthorized(message = 'Unauthorized', details?: string): ApiError {
    return new ApiError(message, 401, details);
  }

  static forbidden(message = 'Forbidden', details?: string): ApiError {
    return new ApiError(message, 403, details);
  }

  static notFound(message = 'Not Found', details?: string): ApiError {
    return new ApiError(message, 404, details);
  }

  static tooManyRequests(message = 'Too Many Requests', details?: string): ApiError {
    return new ApiError(message, 429, details);
  }

  static internal(message = 'Internal Server Error', details?: string): ApiError {
    return new ApiError(message, 500, details);
  }
}

/**
 * Helper to create JSON response with proper typing
 */
export function jsonResponse<T>(
  data: T,
  options: { status?: number; headers?: Record<string, string> } = {}
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    { data },
    {
      status: options.status || 200,
      headers: options.headers,
    }
  );
}

/**
 * Helper to create error response
 */
export function errorResponse(
  error: string,
  message: string,
  status: number = 500,
  headers?: Record<string, string>
): NextResponse<ApiResponse<never>> {
  return NextResponse.json(
    { error, message },
    { status, headers }
  );
}
