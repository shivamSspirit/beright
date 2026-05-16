/**
 * Momentum Score Engine - Type Definitions
 *
 * AIXBT-style momentum scoring for prediction markets.
 * Composite 0-100 score per market based on signal activity.
 */

export interface MomentumComponents {
  signalVelocity: number;      // 0-1: signals per day vs 7d baseline
  volumeTrend: number;         // 0-1: volume vs 7d average
  smartMoneyScore: number;     // 0-1: weighted by forecaster Brier
  arbActivity: number;         // 0-1: cross-platform arb frequency
  socialScore: number;         // 0-1: social mention velocity
}

export interface MomentumMultipliers {
  resolutionMultiplier: number; // 1.0 → 3.0 as resolution approaches
}

export interface MomentumScore {
  marketId: string;
  marketTitle: string;
  platform: string;

  // Composite score
  momentumScore: number;       // 0-100
  isHot: boolean;              // momentum > 70

  // Components (each 0-1)
  components: MomentumComponents;
  multipliers: MomentumMultipliers;

  // Market metadata
  currentPrice?: number;
  volume24h?: number;
  endDate?: Date;

  // Timestamps
  updatedAt: Date;
}

export interface MomentumHistoryEntry {
  date: string;                // ISO date
  score: number;               // 0-100
  components: MomentumComponents;
}

export interface MomentumRecord extends MomentumScore {
  id?: string;
  momentumHistory: MomentumHistoryEntry[];
  createdAt?: Date;
}

export interface MomentumConfig {
  // Component weights (must sum to 1.0)
  weights: {
    signalVelocity: number;    // default: 0.30
    volumeTrend: number;       // default: 0.25
    smartMoneyScore: number;   // default: 0.25
    arbActivity: number;       // default: 0.10
    socialScore: number;       // default: 0.10
  };

  // Thresholds
  hotThreshold: number;        // default: 70
  signalLookbackDays: number;  // default: 7
  volumeLookbackDays: number;  // default: 7

  // Resolution proximity config
  resolutionBoostStartHours: number;  // default: 168 (7 days)
  resolutionBoostMaxMultiplier: number; // default: 3.0
}

export const DEFAULT_MOMENTUM_CONFIG: MomentumConfig = {
  weights: {
    signalVelocity: 0.30,
    volumeTrend: 0.25,
    smartMoneyScore: 0.25,
    arbActivity: 0.10,
    socialScore: 0.10,
  },
  hotThreshold: 70,
  signalLookbackDays: 7,
  volumeLookbackDays: 7,
  resolutionBoostStartHours: 168, // 7 days
  resolutionBoostMaxMultiplier: 3.0,
};

// Market with momentum for API responses
export interface MarketWithMomentum {
  marketId: string;
  marketTitle: string;
  platform: string;
  momentumScore: number;
  isHot: boolean;
  currentPrice?: number;
  volume24h?: number;
  endDate?: string;
  updatedAt: string;

  // Breakdown for detail view
  breakdown?: {
    signalVelocity: number;
    volumeTrend: number;
    smartMoneyScore: number;
    arbActivity: number;
    socialScore: number;
    resolutionMultiplier: number;
  };

  // Waveform for charts
  waveform?: Array<{
    date: string;
    score: number;
  }>;
}
