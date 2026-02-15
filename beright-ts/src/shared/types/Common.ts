/**
 * Common Types for BeRight Protocol
 *
 * Shared type definitions used across the application.
 */

/**
 * Platform identifiers
 */
export type Platform = 'polymarket' | 'kalshi' | 'dflow' | 'manifold' | 'metaculus' | 'limitless';

/**
 * Prediction direction
 */
export type Direction = 'YES' | 'NO';

/**
 * Confidence level
 */
export type Confidence = 'low' | 'medium' | 'high';

/**
 * Market status
 */
export type MarketStatus = 'open' | 'closed' | 'resolved' | 'cancelled';

/**
 * User source/interface
 */
export type UserSource = 'telegram' | 'web' | 'api' | 'cli' | 'discord';

/**
 * Mood for responses (affects formatting)
 */
export type Mood =
  | 'NEUTRAL'
  | 'BULLISH'
  | 'BEARISH'
  | 'EDUCATIONAL'
  | 'ALPHA'
  | 'ERROR'
  | 'WARNING';

/**
 * UUID type (string alias for clarity)
 */
export type UUID = string;

/**
 * ISO timestamp string
 */
export type ISOTimestamp = string;

/**
 * Wallet address (Solana base58)
 */
export type WalletAddress = string;

/**
 * Transaction signature
 */
export type TxSignature = string;

/**
 * Pagination options
 */
export interface PaginationOptions {
  limit?: number;
  offset?: number;
  cursor?: string;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

/**
 * Time range filter
 */
export interface TimeRange {
  start?: Date;
  end?: Date;
}

/**
 * Sort options
 */
export interface SortOptions<T extends string = string> {
  field: T;
  direction: 'asc' | 'desc';
}

/**
 * Generic filter builder
 */
export interface FilterOptions<T extends Record<string, unknown> = Record<string, unknown>> {
  where?: Partial<T>;
  search?: string;
  timeRange?: TimeRange;
  sort?: SortOptions;
  pagination?: PaginationOptions;
}

/**
 * Branded type helper for nominal typing
 * Usage: type UserId = Brand<string, 'UserId'>
 */
export type Brand<T, B> = T & { readonly __brand: B };

/**
 * Make all properties deeply partial
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Make all properties deeply required
 */
export type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P];
};

/**
 * Extract keys of type from object
 */
export type KeysOfType<T, V> = {
  [K in keyof T]: T[K] extends V ? K : never;
}[keyof T];

/**
 * Omit properties by value type
 */
export type OmitByType<T, V> = {
  [K in keyof T as T[K] extends V ? never : K]: T[K];
};

/**
 * Ensure type is not undefined
 */
export type NonUndefined<T> = T extends undefined ? never : T;

/**
 * Type for environment config
 */
export interface EnvConfig {
  readonly NODE_ENV: 'development' | 'production' | 'test';
  readonly SUPABASE_URL?: string;
  readonly SUPABASE_ANON_KEY?: string;
  readonly SUPABASE_SERVICE_ROLE_KEY?: string;
  readonly TELEGRAM_BOT_TOKEN?: string;
  readonly KALSHI_API_KEY?: string;
  readonly KALSHI_EMAIL?: string;
  readonly KALSHI_PASSWORD?: string;
  readonly TAVILY_API_KEY?: string;
  readonly SOLANA_RPC_URL?: string;
  readonly SOLANA_PRIVATE_KEY?: string;
}

/**
 * Type assertion helper
 */
export function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${x}`);
}

/**
 * Type guard for non-null/undefined
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Type guard for non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard for non-empty array
 */
export function isNonEmptyArray<T>(value: T[] | null | undefined): value is T[] {
  return Array.isArray(value) && value.length > 0;
}
