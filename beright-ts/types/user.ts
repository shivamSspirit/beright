// User types for BeRight

export type ForecasterTier = 'superforecaster' | 'elite' | 'verified' | 'rookie' | 'unranked';

export interface UserStats {
  brierScore: number;
  accuracy: number;
  pendingPredictions: number;
  streak: number;
  streakType: 'win' | 'loss' | 'none';
  rank: number | null;
  grade: string;
  isOnChainVerified?: boolean;
  walletAddress?: string;
  tier?: ForecasterTier;
  totalPredictions?: number;
  resolvedPredictions?: number;
}

export interface OnChainCalibration {
  walletAddress: string;
  isOnChainVerified: boolean;
  brierScore: number;
  accuracy: number;
  totalPredictions: number;
  resolvedPredictions: number;
  streak: number;
  tier: string;
  grade: string;
  forecasterPda: string;
  programId: string;
}

export interface Forecaster {
  address: string;
  rank: number;
  brierScore: number;
  accuracy: number;
  totalPredictions: number;
  resolvedPredictions: number;
  streak: number;
  tier: ForecasterTier;
  grade: string;
  isOnChainVerified: boolean;
}

export interface Prediction {
  id: string;
  marketId: string;
  marketTitle: string;
  platform: string;
  prediction: 'YES' | 'NO';
  confidence: number;
  timestamp: string;
  resolved: boolean;
  outcome?: 'correct' | 'incorrect';
  brierContribution?: number;
}
