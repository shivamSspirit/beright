/**
 * Demo Mode - Mock Leaderboard Data
 *
 * Realistic leaderboard data for demo presentations.
 * Shows the calibration/Brier score mechanics without real users.
 */

// ============================================
// TYPES
// ============================================

export interface DemoForecaster {
  rank: number;
  id: string;
  displayName: string;
  walletAddress: string;
  avatarUrl?: string;
  brierScore: number;
  accuracy: number;
  predictions: number;
  resolvedPredictions: number;
  streak: number;
  maxStreak: number;
  tier: 'superforecaster' | 'elite' | 'verified' | 'rookie';
  grade: string;
  onChainCount: number;
  joinedAt: string;
  lastActive: string;
}

export interface DemoPrediction {
  id: string;
  forecasterId: string;
  question: string;
  probability: number;
  direction: 'YES' | 'NO';
  outcome?: boolean;
  brierScore?: number;
  createdAt: string;
  resolvedAt?: string;
  onChainTx?: string;
}

// ============================================
// DEMO LEADERBOARD
// ============================================

export const DEMO_LEADERBOARD: DemoForecaster[] = [
  {
    rank: 1,
    id: 'demo-forecaster-1',
    displayName: 'OracleAlpha',
    walletAddress: 'Demo1111111111111111111111111111111111111111',
    brierScore: 0.089,
    accuracy: 91.2,
    predictions: 847,
    resolvedPredictions: 756,
    streak: 23,
    maxStreak: 31,
    tier: 'superforecaster',
    grade: 'S',
    onChainCount: 312,
    joinedAt: '2024-01-15T00:00:00Z',
    lastActive: '2025-03-18T14:30:00Z',
  },
  {
    rank: 2,
    id: 'demo-forecaster-2',
    displayName: 'PredictorPrime',
    walletAddress: 'Demo2222222222222222222222222222222222222222',
    brierScore: 0.112,
    accuracy: 88.5,
    predictions: 623,
    resolvedPredictions: 541,
    streak: 15,
    maxStreak: 28,
    tier: 'superforecaster',
    grade: 'S',
    onChainCount: 245,
    joinedAt: '2024-02-20T00:00:00Z',
    lastActive: '2025-03-18T12:15:00Z',
  },
  {
    rank: 3,
    id: 'demo-forecaster-3',
    displayName: 'MarketMaven',
    walletAddress: 'Demo3333333333333333333333333333333333333333',
    brierScore: 0.128,
    accuracy: 86.3,
    predictions: 512,
    resolvedPredictions: 445,
    streak: 8,
    maxStreak: 22,
    tier: 'elite',
    grade: 'A+',
    onChainCount: 198,
    joinedAt: '2024-03-10T00:00:00Z',
    lastActive: '2025-03-18T16:45:00Z',
  },
  {
    rank: 4,
    id: 'demo-forecaster-4',
    displayName: 'CalibrationKing',
    walletAddress: 'Demo4444444444444444444444444444444444444444',
    brierScore: 0.135,
    accuracy: 85.1,
    predictions: 489,
    resolvedPredictions: 398,
    streak: 12,
    maxStreak: 19,
    tier: 'elite',
    grade: 'A',
    onChainCount: 156,
    joinedAt: '2024-04-05T00:00:00Z',
    lastActive: '2025-03-17T22:30:00Z',
  },
  {
    rank: 5,
    id: 'demo-forecaster-5',
    displayName: 'FutureSeer',
    walletAddress: 'Demo5555555555555555555555555555555555555555',
    brierScore: 0.142,
    accuracy: 84.2,
    predictions: 367,
    resolvedPredictions: 312,
    streak: 6,
    maxStreak: 17,
    tier: 'elite',
    grade: 'A',
    onChainCount: 134,
    joinedAt: '2024-05-12T00:00:00Z',
    lastActive: '2025-03-18T08:20:00Z',
  },
  {
    rank: 6,
    id: 'demo-forecaster-6',
    displayName: 'BayesianBoss',
    walletAddress: 'Demo6666666666666666666666666666666666666666',
    brierScore: 0.158,
    accuracy: 82.8,
    predictions: 445,
    resolvedPredictions: 378,
    streak: 4,
    maxStreak: 15,
    tier: 'elite',
    grade: 'A-',
    onChainCount: 112,
    joinedAt: '2024-03-25T00:00:00Z',
    lastActive: '2025-03-18T10:45:00Z',
  },
  {
    rank: 7,
    id: 'demo-forecaster-7',
    displayName: 'EdgeFinder',
    walletAddress: 'Demo7777777777777777777777777777777777777777',
    brierScore: 0.165,
    accuracy: 81.5,
    predictions: 312,
    resolvedPredictions: 267,
    streak: 9,
    maxStreak: 14,
    tier: 'verified',
    grade: 'B+',
    onChainCount: 98,
    joinedAt: '2024-06-08T00:00:00Z',
    lastActive: '2025-03-17T19:30:00Z',
  },
  {
    rank: 8,
    id: 'demo-forecaster-8',
    displayName: 'AlphaHunter',
    walletAddress: 'Demo8888888888888888888888888888888888888888',
    brierScore: 0.172,
    accuracy: 80.2,
    predictions: 289,
    resolvedPredictions: 234,
    streak: 3,
    maxStreak: 12,
    tier: 'verified',
    grade: 'B+',
    onChainCount: 87,
    joinedAt: '2024-07-15T00:00:00Z',
    lastActive: '2025-03-18T13:15:00Z',
  },
  {
    rank: 9,
    id: 'demo-forecaster-9',
    displayName: 'ProbabilityPro',
    walletAddress: 'Demo9999999999999999999999999999999999999999',
    brierScore: 0.185,
    accuracy: 78.9,
    predictions: 256,
    resolvedPredictions: 198,
    streak: 5,
    maxStreak: 11,
    tier: 'verified',
    grade: 'B',
    onChainCount: 76,
    joinedAt: '2024-08-20T00:00:00Z',
    lastActive: '2025-03-16T21:00:00Z',
  },
  {
    rank: 10,
    id: 'demo-forecaster-10',
    displayName: 'QuantQueen',
    walletAddress: 'DemoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    brierScore: 0.192,
    accuracy: 77.4,
    predictions: 234,
    resolvedPredictions: 187,
    streak: 7,
    maxStreak: 10,
    tier: 'verified',
    grade: 'B',
    onChainCount: 65,
    joinedAt: '2024-09-05T00:00:00Z',
    lastActive: '2025-03-18T15:30:00Z',
  },
  // Add more forecasters for a fuller leaderboard
  {
    rank: 11,
    id: 'demo-forecaster-11',
    displayName: 'SignalSage',
    walletAddress: 'DemoBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
    brierScore: 0.205,
    accuracy: 75.8,
    predictions: 198,
    resolvedPredictions: 156,
    streak: 2,
    maxStreak: 9,
    tier: 'verified',
    grade: 'B-',
    onChainCount: 54,
    joinedAt: '2024-10-10T00:00:00Z',
    lastActive: '2025-03-17T11:45:00Z',
  },
  {
    rank: 12,
    id: 'demo-forecaster-12',
    displayName: 'DataDriven',
    walletAddress: 'DemoCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
    brierScore: 0.218,
    accuracy: 74.2,
    predictions: 178,
    resolvedPredictions: 134,
    streak: 4,
    maxStreak: 8,
    tier: 'rookie',
    grade: 'C+',
    onChainCount: 42,
    joinedAt: '2024-11-15T00:00:00Z',
    lastActive: '2025-03-18T09:00:00Z',
  },
  {
    rank: 13,
    id: 'demo-forecaster-13',
    displayName: 'TrendTracker',
    walletAddress: 'DemoDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
    brierScore: 0.225,
    accuracy: 73.1,
    predictions: 156,
    resolvedPredictions: 112,
    streak: 1,
    maxStreak: 7,
    tier: 'rookie',
    grade: 'C+',
    onChainCount: 35,
    joinedAt: '2024-12-01T00:00:00Z',
    lastActive: '2025-03-16T14:30:00Z',
  },
  {
    rank: 14,
    id: 'demo-forecaster-14',
    displayName: 'InsightIvan',
    walletAddress: 'DemoEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE',
    brierScore: 0.238,
    accuracy: 71.5,
    predictions: 134,
    resolvedPredictions: 98,
    streak: 3,
    maxStreak: 6,
    tier: 'rookie',
    grade: 'C',
    onChainCount: 28,
    joinedAt: '2025-01-10T00:00:00Z',
    lastActive: '2025-03-17T16:00:00Z',
  },
  {
    rank: 15,
    id: 'demo-forecaster-15',
    displayName: 'NewbieNate',
    walletAddress: 'DemoFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
    brierScore: 0.255,
    accuracy: 69.8,
    predictions: 89,
    resolvedPredictions: 67,
    streak: 2,
    maxStreak: 5,
    tier: 'rookie',
    grade: 'C',
    onChainCount: 18,
    joinedAt: '2025-02-15T00:00:00Z',
    lastActive: '2025-03-18T07:30:00Z',
  },
];

// ============================================
// DEMO PREDICTIONS (Sample)
// ============================================

export const DEMO_PREDICTIONS: DemoPrediction[] = [
  {
    id: 'demo-pred-1',
    forecasterId: 'demo-forecaster-1',
    question: 'Will Bitcoin reach $100,000 by end of 2025?',
    probability: 75,
    direction: 'YES',
    outcome: undefined, // Not yet resolved
    createdAt: '2025-03-15T10:30:00Z',
    onChainTx: 'DemoTx111111111111111111111111111111111111111111111111111111111111111111111111111111111111',
  },
  {
    id: 'demo-pred-2',
    forecasterId: 'demo-forecaster-1',
    question: 'Will the Fed cut rates in Q1 2025?',
    probability: 35,
    direction: 'NO',
    outcome: true, // Resolved YES (prediction was wrong)
    brierScore: 0.42,
    createdAt: '2025-01-05T14:20:00Z',
    resolvedAt: '2025-03-31T00:00:00Z',
    onChainTx: 'DemoTx222222222222222222222222222222222222222222222222222222222222222222222222222222222222',
  },
  {
    id: 'demo-pred-3',
    forecasterId: 'demo-forecaster-2',
    question: 'Will Ethereum reach $5,000 by end of Q1 2025?',
    probability: 45,
    direction: 'NO',
    outcome: false, // Resolved NO (prediction was right)
    brierScore: 0.08,
    createdAt: '2025-01-10T09:15:00Z',
    resolvedAt: '2025-03-31T00:00:00Z',
    onChainTx: 'DemoTx333333333333333333333333333333333333333333333333333333333333333333333333333333333333',
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get demo leaderboard
 */
export function getDemoLeaderboard(limit: number = 50): DemoForecaster[] {
  return DEMO_LEADERBOARD.slice(0, limit);
}

/**
 * Get demo forecaster by ID
 */
export function getDemoForecasterById(id: string): DemoForecaster | undefined {
  return DEMO_LEADERBOARD.find(f => f.id === id);
}

/**
 * Get demo forecaster by wallet address
 */
export function getDemoForecasterByWallet(wallet: string): DemoForecaster | undefined {
  return DEMO_LEADERBOARD.find(f => f.walletAddress === wallet);
}

/**
 * Get demo predictions for a forecaster
 */
export function getDemoPredictions(forecasterId: string): DemoPrediction[] {
  return DEMO_PREDICTIONS.filter(p => p.forecasterId === forecasterId);
}

/**
 * Calculate demo user stats
 */
export function getDemoUserStats(forecasterId: string): {
  totalPredictions: number;
  resolvedPredictions: number;
  brierScore: number;
  accuracy: number;
  streak: number;
  onChainCount: number;
} {
  const forecaster = getDemoForecasterById(forecasterId);
  if (!forecaster) {
    return {
      totalPredictions: 0,
      resolvedPredictions: 0,
      brierScore: 0.25,
      accuracy: 50,
      streak: 0,
      onChainCount: 0,
    };
  }

  return {
    totalPredictions: forecaster.predictions,
    resolvedPredictions: forecaster.resolvedPredictions,
    brierScore: forecaster.brierScore,
    accuracy: forecaster.accuracy,
    streak: forecaster.streak,
    onChainCount: forecaster.onChainCount,
  };
}

/**
 * Get tier distribution for demo stats
 */
export function getDemoTierDistribution(): Record<string, number> {
  const distribution: Record<string, number> = {
    superforecaster: 0,
    elite: 0,
    verified: 0,
    rookie: 0,
  };

  DEMO_LEADERBOARD.forEach(f => {
    distribution[f.tier]++;
  });

  return distribution;
}

/**
 * Get demo leaderboard summary
 */
export function getDemoLeaderboardSummary(): {
  totalForecasters: number;
  totalPredictions: number;
  totalOnChain: number;
  avgBrierScore: number;
  avgAccuracy: number;
} {
  const totalForecasters = DEMO_LEADERBOARD.length;
  const totalPredictions = DEMO_LEADERBOARD.reduce((sum, f) => sum + f.predictions, 0);
  const totalOnChain = DEMO_LEADERBOARD.reduce((sum, f) => sum + f.onChainCount, 0);
  const avgBrierScore = DEMO_LEADERBOARD.reduce((sum, f) => sum + f.brierScore, 0) / totalForecasters;
  const avgAccuracy = DEMO_LEADERBOARD.reduce((sum, f) => sum + f.accuracy, 0) / totalForecasters;

  return {
    totalForecasters,
    totalPredictions,
    totalOnChain,
    avgBrierScore: Number(avgBrierScore.toFixed(3)),
    avgAccuracy: Number(avgAccuracy.toFixed(1)),
  };
}
