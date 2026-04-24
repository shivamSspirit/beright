/**
 * Core type definitions for the Forecaster Scoring Engine
 */

export type Platform = 'polymarket' | 'metaculus' | 'kalshi' | 'manifold';

export type PredictionDirection = 'YES' | 'NO';

export interface Prediction {
  id: string;
  forecasterId: string;
  platform: Platform;
  marketId: string;
  marketTitle: string;
  predictedProbability: number;  // 0.0 - 1.0
  direction: PredictionDirection;

  // For CLOB platforms
  entryPrice?: number;  // Price traded at
  exitPrice?: number;   // If position closed
  positionSize?: number;  // Amount wagered

  // Outcome (null if unresolved)
  outcome?: boolean;  // true = YES, false = NO
  resolvedAt?: Date;

  // Timing
  predictedAt: Date;
  marketOpenTime?: Date;
  marketCloseTime?: Date;

  // Context for scoring
  communityMedian?: number;  // Community consensus
  communitySpread?: number;  // stddev of community predictions
  difficulty?: number;  // Community spread (high = hard)
  category?: string;
  volume?: number;  // Market volume

  // Calculated metrics
  brierScore?: number;  // Calculated on resolution
  logScore?: number;
  isLateEntry?: boolean;  // Predicted in last 10% of market duration
  isExtremePrice?: boolean;  // Trade at <0.2 or >0.8

  createdAt: Date;
  updatedAt: Date;
}

export interface ForecasterIdentity {
  id: string;

  // Platform identifiers
  polymarketWallet?: string;
  metaculusUsername?: string;
  kalshiUserId?: string;
  manifoldUsername?: string;

  // On-chain reference
  solanaForecasterPda?: string;

  // Linkage metadata
  linkageConfidence: number;  // 0.0 - 1.0
  linkageMethod: 'self_declared' | 'behavioral' | 'cryptographic';
  verifiedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export interface ComponentScores {
  // S1: Dual-path calibrated Brier
  s1TradeImplied: number | null;  // For CLOB platforms
  s1CalibrationBinned: number | null;  // For forecast platforms
  s1Composite: number;  // Weighted average

  // S2: Resolution (informativeness)
  s2Resolution: number;

  // S3: Edge
  s3EconomicEdge: number | null;  // For CLOB platforms
  s3InformationalEdge: number | null;  // For forecast platforms
  s3Composite: number;

  // S4: Difficulty-weighted
  s4DifficultyWeighted: number;

  // S5: Volume & Consistency
  s5VolumeConsistency: number;

  // S6: Cross-platform consistency (NEW)
  s6CrossPlatform: number;
}

export interface PlatformStats {
  polymarketResolvedTrades: number;
  metaculusResolvedQuestions: number;
  kalshiResolvedTrades: number;
  manifoldResolvedQuestions: number;

  // Platform-specific composite scores (for S6 calculation)
  polymarketComposite: number | null;
  metaculusComposite: number | null;
  kalshiComposite: number | null;
  manifoldComposite: number | null;
}

export interface AntiGamingSignals {
  mmArbRatio: number;  // % trades at extreme prices (<0.2 or >0.8)
  lateEntryRatio: number;  // % predictions in last 10% of duration
  questionDifficultyAvg: number;  // Avg community spread

  flags: AntiGamingFlag[];
}

export type AntiGamingFlag =
  | 'LIKELY_MM_WALLET'
  | 'LATE_ENTRY_GAMER'
  | 'EASY_QUESTION_FARMER';

export interface ForecasterScore {
  forecasterId: string;
  identity: ForecasterIdentity;

  // Component scores (0-1000 each)
  components: ComponentScores;

  // Platform statistics
  platformStats: PlatformStats;

  // Composite scores
  rawCompositeScore: number;  // 0-1000 before confidence weighting
  confidenceWeight: number;  // 0.0-1.0 (Bayesian shrinkage)
  finalCompositeScore: number;  // 0-1000 after confidence weighting

  // Tier assignment
  tier: 1 | 2 | 3 | 4 | 5;

  // Anti-gaming
  antiGaming: AntiGamingSignals;

  // Statistics
  totalPredictions: number;
  totalResolved: number;
  avgBrierScore: number;
  accuracy: number;  // % correct

  // Timestamps
  lastScoreUpdate: Date;
  calculatedAt: Date;
}

export interface ScoreWeights {
  s1: number;  // Calibrated Brier
  s2: number;  // Resolution
  s3: number;  // Edge
  s4: number;  // Difficulty
  s5: number;  // Volume & Consistency
  s6: number;  // Cross-Platform
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  s1: 0.28,
  s2: 0.22,
  s3: 0.18,
  s4: 0.13,
  s5: 0.08,
  s6: 0.11,
};

// Murphy-Yates decomposition
export interface BrierDecomposition {
  uncertainty: number;  // Inherent difficulty
  resolution: number;   // Informativeness
  reliability: number;  // Calibration error
}

// Calibration bins for S1
export const CALIBRATION_BINS = [
  0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0
];

// Normalization constants (to be locked in Phase 4)
export interface NormalizationConstants {
  s1Mean: number;
  s1Std: number;
  s2Mean: number;
  s2Std: number;
  s3Mean: number;
  s3Std: number;
  s4Mean: number;
  s4Std: number;
  s5Mean: number;
  s5Std: number;
  s6Mean: number;
  s6Std: number;
}

// Placeholder constants (will be replaced in Phase 4)
export const TEMP_NORM_CONSTANTS: NormalizationConstants = {
  s1Mean: 500,
  s1Std: 150,
  s2Mean: 500,
  s2Std: 150,
  s3Mean: 500,
  s3Std: 150,
  s4Mean: 500,
  s4Std: 150,
  s5Mean: 500,
  s5Std: 150,
  s6Mean: 500,
  s6Std: 150,
};
