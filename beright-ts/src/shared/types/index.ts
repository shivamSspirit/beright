/**
 * Type exports for BeRight Protocol
 */

export { Result, isOk, isErr } from './Result';
export type { Ok, Err, AsyncResult } from './Result';

export type {
  Platform,
  Direction,
  Confidence,
  MarketStatus,
  UserSource,
  Mood,
  UUID,
  ISOTimestamp,
  WalletAddress,
  TxSignature,
  PaginationOptions,
  PaginatedResult,
  TimeRange,
  SortOptions,
  FilterOptions,
  Brand,
  DeepPartial,
  DeepRequired,
  KeysOfType,
  OmitByType,
  NonUndefined,
  EnvConfig,
} from './Common';

export {
  assertNever,
  isDefined,
  isNonEmptyString,
  isNonEmptyArray,
} from './Common';
