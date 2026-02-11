/**
 * BeRight Frontend Types
 * Synced with beright-ts/types/
 */

// ============ CORE TYPES ============

export type Category = 'crypto' | 'politics' | 'economics' | 'tech' | 'sports';

// API platform names (lowercase, from backend)
export type ApiPlatform = 'polymarket' | 'kalshi' | 'manifold' | 'limitless' | 'metaculus';

// Display platform names (capitalized, for UI)
export type Platform = 'Kalshi' | 'Polymarket' | 'Manifold' | 'Limitless' | 'Metaculus';

// ============ PREDICTION TYPES ============

export interface Prediction {
  id: string;
  question: string;
  category: Category;
  marketOdds: number; // 0-100
  platform: Platform;
  volume: string;
  resolvesAt: string;
  aiPrediction: number; // 0-100
  aiReasoning: string;
  aiEvidence: {
    for: string[];
    against: string[];
  };
  // Extended fields from API
  url?: string;
  liquidity?: number;
  status?: 'active' | 'closed' | 'resolved';
}

export interface UserPrediction {
  id: string;
  predictionId: string;
  question: string;
  probability: number; // 0-1
  direction: 'YES' | 'NO';
  reasoning?: string;
  createdAt: Date;
  resolvedAt?: Date;
  outcome?: boolean;
  brierScore?: number;
  onChainTx?: string;
  explorerUrl?: string;
}

// ============ USER TYPES ============

export interface UserStats {
  totalPredictions: number;
  resolvedPredictions: number;
  pendingPredictions: number;
  accuracy: number; // 0-100
  brierScore: number; // 0-1, lower is better
  winStreak: number;
  lossStreak: number;
  vsAiWins: number;
  vsAiLosses: number;
  rank: number;
  onChainCount: number;
}

export interface User {
  id: string;
  walletAddress?: string;
  telegramId?: string;
  telegramUsername?: string;
  displayName?: string;
  createdAt: string;
  stats?: UserStats;
}

// ============ LEADERBOARD TYPES ============

export interface LeaderboardEntry {
  rank: number;
  userId?: string;
  username: string;
  displayName?: string;
  walletAddress?: string;
  avatar?: string;
  accuracy: number;
  brierScore: number;
  totalPredictions: number;
  vsAiWinRate: number;
  streak: number;
  streakType?: 'win' | 'loss';
  isCurrentUser?: boolean;
  onChainCount?: number;
}

// ============ MARKET TYPES ============

export interface Market {
  id: string | null;
  platform: ApiPlatform;
  title: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  yesPct: number;
  noPct: number;
  volume: number;
  liquidity: number;
  endDate: string | null;
  status: 'active' | 'closed' | 'resolved';
  url: string;
}

export interface ArbitrageOpportunity {
  topic: string;
  platformA: ApiPlatform;
  platformB: ApiPlatform;
  marketATitle?: string;
  marketBTitle?: string;
  priceA: number;
  priceB: number;
  spread: number;
  profitPercent: number;
  strategy: string;
  confidence: number;
  volumeA?: number;
  volumeB?: number;
}

// ============ AGENT TYPES ============

export interface AgentActivity {
  type: 'arbitrage' | 'whale' | 'prediction' | 'decision' | 'heartbeat';
  timestamp: string;
  summary: string;
  data: any;
}

export interface WhaleAlert {
  wallet: string;
  whaleName: string;
  whaleAccuracy: number;
  signature: string;
  timestamp: string | null;
  type: string;
  totalUsd: number;
  fee: number;
  description: string;
}

// ============ UI STATE TYPES ============

export interface SwipeDirection {
  direction: 'left' | 'right' | 'up' | 'down';
  prediction: Prediction;
  userChoice: 'yes' | 'no' | 'skip' | 'save';
}

export interface FilterOptions {
  category?: Category;
  platform?: Platform;
  minVolume?: number;
  sortBy?: 'volume' | 'closing' | 'popularity';
}
