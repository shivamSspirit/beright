/**
 * Validation Schemas for BeRight Protocol
 * Zod schemas for runtime validation with TypeScript inference
 */

import { z } from 'zod';

// ============================================================================
// Platform & Market Schemas
// ============================================================================

/**
 * Supported prediction market platforms
 */
export const PlatformSchema = z.enum([
  'polymarket',
  'kalshi',
  'limitless',
  'manifold',
  'metaculus',
  'jupiter',
]);

export type Platform = z.infer<typeof PlatformSchema>;

/**
 * Market status
 */
export const MarketStatusSchema = z.enum(['active', 'resolved', 'closed']);

export type MarketStatus = z.infer<typeof MarketStatusSchema>;

/**
 * On-chain data for tokenized markets
 */
export const OnChainDataSchema = z.object({
  yesMint: z.string().nullable(),
  noMint: z.string().nullable(),
  marketLedger: z.string().nullable(),
});

/**
 * Orderbook data
 */
export const OrderbookDataSchema = z.object({
  yesBid: z.number(),
  yesAsk: z.number(),
  noBid: z.number(),
  noAsk: z.number(),
  spread: z.number(),
});

/**
 * Market data schema
 */
export const MarketSchema = z.object({
  platform: PlatformSchema,
  marketId: z.string().nullable(),
  title: z.string(),
  question: z.string(),
  yesPrice: z.number().min(0).max(1),
  noPrice: z.number().min(0).max(1),
  yesPct: z.number().min(0).max(100),
  noPct: z.number().min(0).max(100),
  volume: z.number().min(0),
  volume24h: z.number().optional(),
  liquidity: z.number().min(0),
  endDate: z.date().nullable(),
  createdAt: z.date().nullable().optional(),
  status: MarketStatusSchema,
  url: z.string().url(),
  onChain: OnChainDataSchema.optional(),
  orderbook: OrderbookDataSchema.optional(),
});

export type Market = z.infer<typeof MarketSchema>;

// ============================================================================
// Trade Schemas
// ============================================================================

/**
 * Trade side
 */
export const TradeSideSchema = z.enum(['yes', 'no']);

export type TradeSide = z.infer<typeof TradeSideSchema>;

/**
 * Order type
 */
export const OrderTypeSchema = z.enum(['market', 'limit']);

export type OrderType = z.infer<typeof OrderTypeSchema>;

/**
 * Trade request schema
 */
export const TradeRequestSchema = z.object({
  platform: PlatformSchema,
  marketId: z.string().min(1, 'Market ID is required'),
  side: TradeSideSchema,
  quantity: z.number().positive('Quantity must be positive'),
  price: z.number().min(0.01).max(0.99).optional(),
  orderType: OrderTypeSchema.default('market'),
  slippageTolerance: z.number().min(0).max(0.5).default(0.02),
});

export type TradeRequest = z.infer<typeof TradeRequestSchema>;

/**
 * Trade result schema
 */
export const TradeResultSchema = z.object({
  success: z.boolean(),
  platform: PlatformSchema,
  marketId: z.string(),
  side: TradeSideSchema,
  filledQuantity: z.number(),
  averagePrice: z.number(),
  totalCost: z.number(),
  fees: z.number(),
  transactionId: z.string().optional(),
  timestamp: z.string().datetime(),
});

export type TradeResult = z.infer<typeof TradeResultSchema>;

// ============================================================================
// API Request/Response Schemas
// ============================================================================

/**
 * Pagination parameters
 */
export const PaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export type Pagination = z.infer<typeof PaginationSchema>;

/**
 * Market search parameters
 */
export const MarketSearchSchema = z.object({
  query: z.string().optional(),
  platform: PlatformSchema.optional(),
  status: MarketStatusSchema.optional(),
  minVolume: z.number().min(0).optional(),
  maxVolume: z.number().min(0).optional(),
  sortBy: z.enum(['volume', 'liquidity', 'endDate', 'createdAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  ...PaginationSchema.shape,
});

export type MarketSearch = z.infer<typeof MarketSearchSchema>;

/**
 * Research request schema
 */
export const ResearchRequestSchema = z.object({
  query: z.string().min(3, 'Query must be at least 3 characters'),
  platforms: z.array(PlatformSchema).optional(),
  includeNews: z.boolean().default(true),
  includeSocial: z.boolean().default(true),
  depth: z.enum(['quick', 'standard', 'deep']).default('standard'),
});

export type ResearchRequest = z.infer<typeof ResearchRequestSchema>;

// ============================================================================
// User & Auth Schemas
// ============================================================================

/**
 * User tier levels
 */
export const UserTierSchema = z.enum(['free', 'basic', 'pro', 'whale']);

export type UserTier = z.infer<typeof UserTierSchema>;

/**
 * User profile schema
 */
export const UserProfileSchema = z.object({
  userId: z.string().uuid(),
  telegramId: z.number().optional(),
  walletAddress: z.string().optional(),
  tier: UserTierSchema,
  brierScore: z.number().min(0).max(1).optional(),
  predictionCount: z.number().int().min(0),
  createdAt: z.string().datetime(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate data against a schema with detailed error messages
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * Validate or throw with formatted error message
 */
export function validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Create a partial schema (all fields optional)
 */
export function partial<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.partial();
}

/**
 * Format Zod errors for API response
 */
export function formatZodErrors(error: z.ZodError): Array<{
  field: string;
  message: string;
}> {
  return error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }));
}

// ============================================================================
// Coercion Schemas (for API input parsing)
// ============================================================================

/**
 * Number that can be passed as string
 */
export const CoercedNumber = z.coerce.number();

/**
 * Boolean that can be passed as string
 */
export const CoercedBoolean = z
  .union([z.boolean(), z.string()])
  .transform((val) => {
    if (typeof val === 'boolean') return val;
    return val.toLowerCase() === 'true' || val === '1';
  });

/**
 * Date that can be passed as string
 */
export const CoercedDate = z.coerce.date();
