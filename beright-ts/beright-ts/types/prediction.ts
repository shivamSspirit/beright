/**
 * Extended Prediction Types with On-Chain Support
 */

import { Direction } from '../lib/onchain/types';

export interface PredictionWithOnChain {
  id: string;
  userId: string;
  question: string;
  platform: string;
  marketId?: string;
  marketUrl?: string;
  predictedProbability: number;
  direction: Direction;
  confidence: 'low' | 'medium' | 'high';
  reasoning?: string;
  tags: string[];
  createdAt: string;
  resolvesAt?: string;
  resolvedAt?: string;
  outcome?: boolean;
  brierScore?: number;

  // On-chain fields
  onChainTx?: string; // Commit transaction signature
  onChainCommitted?: boolean;
  resolutionTx?: string; // Resolution transaction signature
}

export interface CreatePredictionRequest {
  question: string;
  probability: number; // 0-1
  direction: Direction;
  reasoning?: string;
  platform?: string;
  marketId?: string;
  marketUrl?: string;
  confidence?: 'low' | 'medium' | 'high';
  tags?: string[];
  walletAddress?: string;
  telegramId?: string;
  commitOnChain?: boolean; // Default true
}

export interface CreatePredictionResponse {
  success: boolean;
  prediction: PredictionWithOnChain;
  onChain?: {
    committed: boolean;
    signature?: string;
    explorerUrl?: string;
    error?: string;
    reason?: string;
  };
}

export interface ResolvePredictionRequest {
  predictionId: string;
  outcome: boolean; // true = YES, false = NO
  resolveOnChain?: boolean; // Default true
}

export interface ResolvePredictionResponse {
  success: boolean;
  prediction: PredictionWithOnChain;
  onChain?: {
    resolved: boolean;
    signature?: string;
    explorerUrl?: string;
    error?: string;
    reason?: string;
  };
}

export interface VerifyPredictionRequest {
  commitTx: string;
  resolutionTx?: string;
  marketResolutionTime?: number; // Unix timestamp
}

export interface VerifyPredictionResponse {
  found: boolean;
  valid?: boolean;
  errors?: string[];
  prediction: any; // PredictionCommit from on-chain types
  resolution?: any; // ResolutionCommit from on-chain types
  commitTime?: number;
  resolveTime?: number;
  details?: any;
  proof: {
    proofUrl: string;
    commitExplorer: string;
    resolveExplorer?: string;
    verifyCommand: string;
  };
}
