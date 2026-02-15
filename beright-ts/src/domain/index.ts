/**
 * Domain Layer exports for BeRight Protocol
 *
 * This is the core business logic layer - platform agnostic.
 */

// Entities
export {
  Market,
  Prediction,
  User,
  ArbitrageOpportunity,
  calculateUserStats,
} from './entities';

export type {
  CreateMarketInput,
  CreatePredictionInput,
  ResolvePredictionInput,
  CreateUserInput,
  UserStats,
  ArbitrageStrategy,
  CreateArbitrageInput,
} from './entities';

// Value Objects
export {
  Probability,
  BrierScore,
  Price,
  averageBrierScore,
  createPricePair,
} from './value-objects';

export type {
  BrierQuality,
  BrierInterpretation,
  PricePair,
} from './value-objects';

// Ports (Interfaces)
export type {
  // Repositories
  PredictionRepository,
  PredictionFilter,
  PredictionPagination,
  PredictionStats,
  UserRepository,
  UserFilter,
  LeaderboardEntry,
  MarketRepository,
  MarketCacheOptions,
  ArbitrageHistoryFilter,
  // Providers
  MarketProvider,
  MarketAggregator,
  MarketSearchOptions,
  ProviderHealth,
  MarketComparison,
} from './ports';
