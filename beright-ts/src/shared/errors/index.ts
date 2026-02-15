/**
 * Error exports for BeRight Protocol
 */

export { AppError, ErrorCode, errorCodeToHttpStatus } from './AppError';
export type { ErrorMetadata } from './AppError';

export {
  PredictionError,
  MarketError,
  UserError,
  ArbitrageError,
  BlockchainError,
} from './DomainError';
