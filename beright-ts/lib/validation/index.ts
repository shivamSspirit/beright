/**
 * Input Validation Layer
 *
 * Zod schemas for all API inputs with strict validation.
 *
 * Usage:
 *   import { schemas, validate, validateRequest } from '@/lib/validation';
 *
 *   // Validate object
 *   const result = validate(schemas.gatewayRequest, body);
 *   if (!result.success) return errorResponse(result.error);
 *
 *   // Validate request body directly
 *   const { data, error } = await validateRequest(request, schemas.gatewayRequest);
 *   if (error) return error;
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

// ============================================
// BASE TYPES
// ============================================

/**
 * Solana wallet address (base58, 32-44 chars)
 */
export const walletAddressSchema = z
  .string()
  .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'Invalid wallet address')
  .describe('Solana wallet address');

/**
 * UUID v4
 */
export const uuidSchema = z
  .string()
  .uuid('Invalid UUID format')
  .describe('UUID v4');

/**
 * Telegram user ID
 */
export const telegramIdSchema = z
  .string()
  .regex(/^\d{5,15}$/, 'Invalid Telegram ID')
  .describe('Telegram user ID');

/**
 * Probability (0-1)
 */
export const probabilitySchema = z
  .number()
  .min(0, 'Probability must be >= 0')
  .max(1, 'Probability must be <= 1')
  .describe('Probability between 0 and 1');

/**
 * Percentage (0-100)
 */
export const percentageSchema = z
  .number()
  .min(0, 'Percentage must be >= 0')
  .max(100, 'Percentage must be <= 100')
  .describe('Percentage between 0 and 100');

/**
 * Positive number
 */
export const positiveNumberSchema = z
  .number()
  .positive('Must be a positive number')
  .describe('Positive number');

/**
 * Non-negative number
 */
export const nonNegativeSchema = z
  .number()
  .nonnegative('Must be non-negative')
  .describe('Non-negative number');

/**
 * Safe string (no control characters, limited length)
 */
export const safeStringSchema = z
  .string()
  .max(10000, 'String too long (max 10000 chars)')
  .refine(
    (s) => !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(s),
    'String contains invalid control characters'
  )
  .describe('Safe string without control characters');

/**
 * Short safe string (for names, titles)
 */
export const shortStringSchema = z
  .string()
  .min(1, 'String cannot be empty')
  .max(200, 'String too long (max 200 chars)')
  .refine(
    (s) => !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(s),
    'String contains invalid control characters'
  )
  .describe('Short safe string (1-200 chars)');

/**
 * Message text (user input)
 */
export const messageTextSchema = z
  .string()
  .min(1, 'Message cannot be empty')
  .max(4000, 'Message too long (max 4000 chars)')
  .refine(
    (s) => !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(s),
    'Message contains invalid control characters'
  )
  .describe('User message text');

// ============================================
// GATEWAY / CHAT SCHEMAS
// ============================================

export const gatewayRequestSchema = z.object({
  message: messageTextSchema,
  walletAddress: walletAddressSchema.optional(),
  conversationId: uuidSchema.optional(),
  sessionId: z.string().max(100).optional(),
  userId: z.string().max(100).optional(),
}).describe('Gateway API request');

export const conversationCreateSchema = z.object({
  walletAddress: walletAddressSchema,
  title: shortStringSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
}).describe('Create conversation request');

// ============================================
// EXECUTION SCHEMAS
// ============================================

export const executionSideSchema = z.enum(['YES', 'NO']).describe('Trade side');
export const executionTypeSchema = z.enum(['MARKET', 'LIMIT']).describe('Order type');
export const routingStrategySchema = z.enum([
  'BEST_PRICE',
  'BEST_LIQUIDITY',
  'LOWEST_FEES',
  'SPLIT',
]).describe('Routing strategy');

export const executionRequestSchema = z.object({
  marketId: shortStringSchema.describe('Market identifier'),
  side: executionSideSchema,
  type: executionTypeSchema.default('MARKET'),
  size: positiveNumberSchema.describe('Order size'),
  price: probabilitySchema.optional().describe('Limit price (required for LIMIT orders)'),
  platform: z.string().max(50).optional().describe('Target platform'),
  strategy: routingStrategySchema.default('BEST_PRICE'),
  dryRun: z.boolean().default(false).describe('If true, only returns quote'),
}).refine(
  (data) => data.type !== 'LIMIT' || (data.price !== undefined && data.price > 0 && data.price < 1),
  { message: 'LIMIT orders require price between 0 and 1', path: ['price'] }
).describe('Execution API request');

export const quoteRequestSchema = z.object({
  marketId: shortStringSchema,
  side: executionSideSchema,
  size: positiveNumberSchema,
}).describe('Quote request');

// ============================================
// PREDICTION SCHEMAS
// ============================================

export const predictionRecordSchema = z.object({
  question: z.string().max(1000).refine(
    (s) => !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(s),
    'String contains invalid control characters'
  ),
  probability: probabilitySchema,
  side: executionSideSchema,
  reasoning: z.string().max(2000).refine(
    (s) => !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(s),
    'String contains invalid control characters'
  ).optional(),
  marketId: shortStringSchema.optional(),
  platform: z.string().max(50).optional(),
  expiresAt: z.string().datetime().optional(),
}).describe('Prediction record');

// ============================================
// POOL / STAKING SCHEMAS
// ============================================

export const stakeRequestSchema = z.object({
  poolId: shortStringSchema,
  amount: positiveNumberSchema,
}).describe('Stake request');

export const unstakeRequestSchema = z.object({
  poolId: shortStringSchema,
  amount: positiveNumberSchema.optional(), // Optional = unstake all
}).describe('Unstake request');

export const createPoolSchema = z.object({
  name: z.string().min(1).max(50).refine(
    (s) => !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(s),
    'String contains invalid control characters'
  ),
  description: z.string().max(500).refine(
    (s) => !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(s),
    'String contains invalid control characters'
  ).optional(),
  minStake: nonNegativeSchema.optional(),
  maxStake: positiveNumberSchema.optional(),
}).describe('Create pool request');

// ============================================
// USER SCHEMAS
// ============================================

export const linkTelegramSchema = z.object({
  telegramId: telegramIdSchema,
  username: z.string().max(50).optional(),
  verificationCode: z.string().length(6).optional(),
}).describe('Link Telegram account');

export const userProfileUpdateSchema = z.object({
  displayName: z.string().min(1).max(50).refine(
    (s) => !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(s),
    'String contains invalid control characters'
  ).optional(),
  bio: z.string().max(500).refine(
    (s) => !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(s),
    'String contains invalid control characters'
  ).optional(),
  avatarUrl: z.string().url().max(500).optional(),
  settings: z.record(z.unknown()).optional(),
}).describe('User profile update');

// ============================================
// PAGINATION / COMMON QUERY SCHEMAS
// ============================================

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  cursor: z.string().max(100).optional(),
}).describe('Pagination parameters');

export const marketQuerySchema = z.object({
  category: z.string().max(50).optional(),
  platform: z.string().max(50).optional(),
  status: z.enum(['open', 'closed', 'all']).default('open'),
  search: z.string().max(200).optional(),
  sortBy: z.enum(['volume', 'liquidity', 'created', 'closes']).default('volume'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
}).merge(paginationSchema).describe('Market query parameters');

// ============================================
// VALIDATION HELPERS
// ============================================

export interface ValidationResult<T> {
  success: true;
  data: T;
}

export interface ValidationError {
  success: false;
  error: string;
  details: z.ZodIssue[];
}

/**
 * Validate data against schema
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> | ValidationError {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errorMessages = result.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');

  return {
    success: false,
    error: errorMessages,
    details: result.error.issues,
  };
}

/**
 * Validate request body and return NextResponse on error
 */
export async function validateRequest<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): Promise<{ data: T; error?: never } | { data?: never; error: NextResponse }> {
  try {
    const body = await request.json();
    const result = validate(schema, body);

    if (!result.success) {
      return {
        error: NextResponse.json(
          {
            success: false,
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: result.error,
          },
          { status: 400 }
        ),
      };
    }

    return { data: result.data };
  } catch {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON body',
          code: 'INVALID_JSON',
        },
        { status: 400 }
      ),
    };
  }
}

/**
 * Validate query parameters
 */
export function validateQuery<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): ValidationResult<T> | ValidationError {
  const params: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    params[key] = value;
  });

  return validate(schema, params);
}

/**
 * Create a validated route handler
 */
export function withValidation<T>(
  schema: z.ZodSchema<T>,
  handler: (request: NextRequest, data: T) => Promise<NextResponse>
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    const { data, error } = await validateRequest(request, schema);
    if (error) return error;
    return handler(request, data);
  };
}

// ============================================
// SANITIZATION HELPERS
// ============================================

/**
 * Sanitize string for safe storage/display
 * Removes control characters and trims whitespace
 */
export function sanitizeString(input: string, maxLength = 10000): string {
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control chars
    .trim()
    .slice(0, maxLength);
}

/**
 * Sanitize object keys and values recursively
 */
export function sanitizeObject(obj: Record<string, unknown>, maxDepth = 5): Record<string, unknown> {
  if (maxDepth <= 0) return {};

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const safeKey = sanitizeString(key, 100);

    if (typeof value === 'string') {
      result[safeKey] = sanitizeString(value);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      result[safeKey] = value;
    } else if (value === null) {
      result[safeKey] = null;
    } else if (Array.isArray(value)) {
      result[safeKey] = value.slice(0, 100).map((item) => {
        if (typeof item === 'object' && item !== null) {
          return sanitizeObject(item as Record<string, unknown>, maxDepth - 1);
        }
        return typeof item === 'string' ? sanitizeString(item) : item;
      });
    } else if (typeof value === 'object') {
      result[safeKey] = sanitizeObject(value as Record<string, unknown>, maxDepth - 1);
    }
  }

  return result;
}

// ============================================
// EXPORT SCHEMAS NAMESPACE
// ============================================

export const schemas = {
  // Base types
  walletAddress: walletAddressSchema,
  uuid: uuidSchema,
  telegramId: telegramIdSchema,
  probability: probabilitySchema,
  percentage: percentageSchema,
  positiveNumber: positiveNumberSchema,
  safeString: safeStringSchema,
  shortString: shortStringSchema,
  messageText: messageTextSchema,

  // Gateway / Chat
  gatewayRequest: gatewayRequestSchema,
  conversationCreate: conversationCreateSchema,

  // Execution
  executionRequest: executionRequestSchema,
  quoteRequest: quoteRequestSchema,

  // Predictions
  predictionRecord: predictionRecordSchema,

  // Pools / Staking
  stakeRequest: stakeRequestSchema,
  unstakeRequest: unstakeRequestSchema,
  createPool: createPoolSchema,

  // Users
  linkTelegram: linkTelegramSchema,
  userProfileUpdate: userProfileUpdateSchema,

  // Common
  pagination: paginationSchema,
  marketQuery: marketQuerySchema,
} as const;
