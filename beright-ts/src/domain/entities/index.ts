/**
 * Entity exports for BeRight Protocol
 */

export { Market } from './Market';
export type { CreateMarketInput } from './Market';

export { Prediction } from './Prediction';
export type { CreatePredictionInput, ResolvePredictionInput } from './Prediction';

export { User, calculateUserStats } from './User';
export type { CreateUserInput, UserStats } from './User';

export { ArbitrageOpportunity } from './ArbitrageOpportunity';
export type { ArbitrageStrategy, CreateArbitrageInput } from './ArbitrageOpportunity';
