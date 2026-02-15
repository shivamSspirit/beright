/**
 * DomainError - Domain-specific errors for BeRight Protocol
 *
 * These errors represent business rule violations and domain-specific failures.
 */

import { AppError, ErrorCode, ErrorMetadata } from './AppError';

/**
 * PredictionError - Errors related to predictions
 */
export class PredictionError extends AppError {
  constructor(code: ErrorCode, message: string, metadata?: ErrorMetadata) {
    super(code, message, metadata);
    this.name = 'PredictionError';
  }

  static invalidProbability(value: number): PredictionError {
    return new PredictionError(
      ErrorCode.INVALID_PROBABILITY,
      `Probability must be between 0 and 1, got: ${value}`,
      { value }
    );
  }

  static invalidDirection(value: string): PredictionError {
    return new PredictionError(
      ErrorCode.INVALID_DIRECTION,
      `Direction must be YES or NO, got: ${value}`,
      { value }
    );
  }

  static alreadyResolved(predictionId: string): PredictionError {
    return new PredictionError(
      ErrorCode.PREDICTION_ALREADY_RESOLVED,
      `Prediction ${predictionId} has already been resolved`,
      { predictionId }
    );
  }

  static notFound(predictionId: string): PredictionError {
    return new PredictionError(
      ErrorCode.PREDICTION_NOT_FOUND,
      `Prediction not found: ${predictionId}`,
      { predictionId }
    );
  }

  static missingQuestion(): PredictionError {
    return new PredictionError(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'Prediction question is required'
    );
  }
}

/**
 * MarketError - Errors related to markets
 */
export class MarketError extends AppError {
  constructor(code: ErrorCode, message: string, metadata?: ErrorMetadata) {
    super(code, message, metadata);
    this.name = 'MarketError';
  }

  static notFound(marketId: string, platform?: string): MarketError {
    return new MarketError(
      ErrorCode.MARKET_NOT_FOUND,
      `Market not found: ${marketId}${platform ? ` on ${platform}` : ''}`,
      { marketId, platform }
    );
  }

  static providerUnavailable(platform: string, reason?: string): MarketError {
    const code = ({
      kalshi: ErrorCode.KALSHI_ERROR,
      polymarket: ErrorCode.POLYMARKET_ERROR,
      dflow: ErrorCode.DFLOW_ERROR,
    }[platform.toLowerCase()] || ErrorCode.EXTERNAL_SERVICE_ERROR);

    return new MarketError(
      code,
      `${platform} is unavailable${reason ? `: ${reason}` : ''}`,
      { platform, reason }
    );
  }

  static invalidPrice(value: number): MarketError {
    return new MarketError(
      ErrorCode.VALIDATION_ERROR,
      `Invalid price: ${value}. Must be between 0 and 1`,
      { value }
    );
  }
}

/**
 * UserError - Errors related to users
 */
export class UserError extends AppError {
  constructor(code: ErrorCode, message: string, metadata?: ErrorMetadata) {
    super(code, message, metadata);
    this.name = 'UserError';
  }

  static notFound(identifier: string | number): UserError {
    return new UserError(
      ErrorCode.USER_NOT_FOUND,
      `User not found: ${identifier}`,
      { identifier }
    );
  }

  static invalidWalletAddress(address: string): UserError {
    return new UserError(
      ErrorCode.VALIDATION_ERROR,
      `Invalid wallet address: ${address}`,
      { address }
    );
  }
}

/**
 * ArbitrageError - Errors related to arbitrage operations
 */
export class ArbitrageError extends AppError {
  constructor(code: ErrorCode, message: string, metadata?: ErrorMetadata) {
    super(code, message, metadata);
    this.name = 'ArbitrageError';
  }

  static noOpportunities(): ArbitrageError {
    return new ArbitrageError(
      ErrorCode.NOT_FOUND,
      'No arbitrage opportunities found'
    );
  }

  static scanFailed(reason: string): ArbitrageError {
    return new ArbitrageError(
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      `Arbitrage scan failed: ${reason}`,
      { reason }
    );
  }
}

/**
 * BlockchainError - Errors related to blockchain operations
 */
export class BlockchainError extends AppError {
  constructor(code: ErrorCode, message: string, metadata?: ErrorMetadata) {
    super(code, message, metadata);
    this.name = 'BlockchainError';
  }

  static transactionFailed(reason: string, txId?: string): BlockchainError {
    return new BlockchainError(
      ErrorCode.SOLANA_ERROR,
      `Transaction failed: ${reason}`,
      { reason, txId }
    );
  }

  static walletNotConfigured(): BlockchainError {
    return new BlockchainError(
      ErrorCode.CONFIGURATION_ERROR,
      'Solana wallet not configured'
    );
  }

  static insufficientFunds(required: number, available: number): BlockchainError {
    return new BlockchainError(
      ErrorCode.VALIDATION_ERROR,
      `Insufficient funds: need ${required}, have ${available}`,
      { required, available }
    );
  }
}

export default {
  PredictionError,
  MarketError,
  UserError,
  ArbitrageError,
  BlockchainError,
};
