'use client';

import { useState, useEffect, useCallback } from 'react';
import { useMode } from '@/context/ModeContext';
import { UserPrediction } from '@/lib/types';

/**
 * Minimal prediction data needed for saving
 */
export interface SavePredictionInput {
  id: string;
  question: string;
  marketOdds: number;
  platform?: string;
}

/**
 * On-chain prediction structure returned from calibration program
 */
export interface OnChainPrediction {
  id: string;
  marketId: string;
  probability: number;
  direction: 'YES' | 'NO';
  createdAt: string;
  resolvedAt?: string | null;
  outcome?: boolean | null;
  brierScore?: number | null;
  onChainTx?: string;
  explorerUrl?: string;
}

/**
 * Forecaster stats from on-chain
 */
export interface ForecasterStats {
  totalPredictions: number;
  resolvedPredictions: number;
  avgBrierScore: number;
  accuracy: number;
  correctPredictions: number;
  streak: number;
  maxStreak: number;
}

export interface StoredPrediction {
  id: string;
  marketId: string;
  question: string;
  platform: string;
  direction: 'YES' | 'NO';
  probability: number;
  marketOdds: number;
  walletAddress: string;
  createdAt: string;
  resolvedAt?: string;
  outcome?: boolean;
  brierScore?: number;
  onChainTx?: string;
  explorerUrl?: string;
}

// localStorage key for predictions
const PREDICTIONS_STORAGE_KEY = 'beright_predictions';

/**
 * Hook to manage user predictions
 * Demo mode: Uses localStorage for immediate persistence
 * Production: Will use on-chain calibration program + Supabase
 */
export function usePredictions(walletAddress: string | null) {
  const { isDemo } = useMode();
  const [predictions, setPredictions] = useState<StoredPrediction[]>([]);
  const [onChainStats, setOnChainStats] = useState<ForecasterStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load predictions from localStorage (demo) or API (production)
  const loadPredictions = useCallback(async () => {
    if (!walletAddress) {
      setPredictions([]);
      setOnChainStats(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Demo mode: Load from localStorage
      if (isDemo) {
        const stored = localStorage.getItem(PREDICTIONS_STORAGE_KEY);
        if (stored) {
          const allPredictions: StoredPrediction[] = JSON.parse(stored);

          // Clean up: Remove predictions without onChainTx (old format)
          const validPredictions = allPredictions.filter(p => p.onChainTx);
          if (validPredictions.length !== allPredictions.length) {
            console.log('[Predictions] Cleaning up old predictions without onChainTx:',
              allPredictions.length - validPredictions.length, 'removed');
            localStorage.setItem(PREDICTIONS_STORAGE_KEY, JSON.stringify(validPredictions));
          }

          // Filter by wallet address
          const userPredictions = validPredictions.filter(p => p.walletAddress === walletAddress);
          setPredictions(userPredictions.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          ));
          console.log('[Predictions] Loaded from localStorage:', userPredictions.length, 'predictions');
        } else {
          setPredictions([]);
        }
        setIsLoading(false);
        return;
      }

      // Production: Fetch from on-chain calibration program via API
      const response = await fetch(`/api/v2/predictions/user?wallet=${walletAddress}&limit=100`);

      const data = await response.json();

      if (data.success && data.predictions) {
        // Transform on-chain predictions to match StoredPrediction format
        const transformedPredictions: StoredPrediction[] = data.predictions.map((pred: any) => ({
          id: pred.id,
          marketId: pred.marketId,
          question: pred.marketId, // Question not stored on-chain, use marketId as placeholder
          platform: 'onchain',
          direction: pred.direction,
          probability: pred.probability,
          marketOdds: pred.probability * 100,
          walletAddress,
          createdAt: pred.createdAt,
          resolvedAt: pred.resolvedAt,
          outcome: pred.outcome,
          brierScore: pred.brierScore,
          onChainTx: pred.onChainTx,
          explorerUrl: pred.explorerUrl,
        }));

        setPredictions(transformedPredictions);
        setOnChainStats(data.stats ? {
          totalPredictions: data.stats.totalPredictions,
          resolvedPredictions: data.stats.resolvedPredictions,
          avgBrierScore: data.stats.avgBrierScore,
          accuracy: data.stats.accuracy,
          correctPredictions: data.stats.correctPredictions,
          streak: data.stats.streak,
          maxStreak: data.stats.maxStreak,
        } : null);
        console.log('[Predictions] Loaded from on-chain:', transformedPredictions.length, 'predictions');
      } else {
        console.warn('[Predictions] Failed to load from on-chain:', data.error);
        setPredictions([]);
      }
    } catch (err) {
      console.error('[Predictions] Error loading:', err);
      setError('Failed to load predictions');
      setPredictions([]);
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress, isDemo]);

  // Load on mount and when wallet changes
  useEffect(() => {
    loadPredictions();
  }, [loadPredictions]);

  // Save a new prediction - localStorage in demo, API in production
  const savePrediction = useCallback(async (
    prediction: SavePredictionInput,
    choice: 'YES' | 'NO',
    txSignature?: string,
    explorerUrl?: string
  ): Promise<StoredPrediction | null> => {
    if (!walletAddress) {
      setError('Wallet not connected');
      return null;
    }

    setIsSaving(true);
    setError(null);

    try {
      const probability = choice === 'YES'
        ? prediction.marketOdds / 100
        : 1 - prediction.marketOdds / 100;

      // Create prediction record
      const newPrediction: StoredPrediction = {
        id: `pred_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        marketId: prediction.id,
        question: prediction.question,
        platform: prediction.platform || 'unknown',
        direction: choice,
        probability,
        marketOdds: prediction.marketOdds,
        walletAddress,
        createdAt: new Date().toISOString(),
        onChainTx: txSignature,
        explorerUrl: explorerUrl || (txSignature ? `https://solscan.io/tx/${txSignature}?cluster=devnet` : undefined),
      };

      // Demo mode: Save to localStorage
      if (isDemo) {
        console.log('[Predictions] Saving to localStorage:', newPrediction.id, choice);

        const stored = localStorage.getItem(PREDICTIONS_STORAGE_KEY);
        const allPredictions: StoredPrediction[] = stored ? JSON.parse(stored) : [];

        // Check if prediction already exists for this market
        const existingIdx = allPredictions.findIndex(
          p => p.marketId === prediction.id && p.walletAddress === walletAddress
        );

        if (existingIdx >= 0) {
          allPredictions[existingIdx] = newPrediction;
        } else {
          allPredictions.unshift(newPrediction);
        }

        // Keep last 100 predictions
        const trimmed = allPredictions.slice(0, 100);
        localStorage.setItem(PREDICTIONS_STORAGE_KEY, JSON.stringify(trimmed));

        // Update local state
        const userPredictions = trimmed.filter(p => p.walletAddress === walletAddress);
        setPredictions(userPredictions);

        console.log('[Predictions] Saved to localStorage:', newPrediction.id);
        return newPrediction;
      }

      // Production: Save via API
      const response = await fetch('/api/predictions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          marketId: prediction.id,
          question: prediction.question,
          platform: prediction.platform || 'unknown',
          direction: choice,
          probability,
          marketOdds: prediction.marketOdds,
          walletAddress,
          onChainTx: txSignature,
          explorerUrl: newPrediction.explorerUrl,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to save prediction');
      }

      // Update local state
      setPredictions(prev => {
        const existingIdx = prev.findIndex(p => p.marketId === prediction.id);
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = newPrediction;
          return updated;
        }
        return [newPrediction, ...prev];
      });

      return newPrediction;
    } catch (err) {
      console.error('[Predictions] Error saving:', err);
      setError(err instanceof Error ? err.message : 'Failed to save prediction');
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [walletAddress, isDemo]);

  // Get predictions as UserPrediction format (for profile display)
  const getUserPredictions = useCallback((): UserPrediction[] => {
    return predictions.map(p => ({
      id: p.id,
      predictionId: p.marketId,
      question: p.question,
      probability: p.probability,
      direction: p.direction,
      createdAt: new Date(p.createdAt),
      resolvedAt: p.resolvedAt ? new Date(p.resolvedAt) : undefined,
      outcome: p.outcome,
      brierScore: p.brierScore,
      onChainTx: p.onChainTx,
      explorerUrl: p.explorerUrl,
    }));
  }, [predictions]);

  // Get stats - prefer on-chain stats, fallback to calculated
  const getStats = useCallback(() => {
    // If we have on-chain stats, use those
    if (onChainStats) {
      return {
        totalPredictions: onChainStats.totalPredictions,
        resolvedPredictions: onChainStats.resolvedPredictions,
        pendingPredictions: onChainStats.totalPredictions - onChainStats.resolvedPredictions,
        accuracy: onChainStats.accuracy * 100,
        brierScore: onChainStats.avgBrierScore,
        correct: onChainStats.correctPredictions,
        streak: onChainStats.streak,
        maxStreak: onChainStats.maxStreak,
      };
    }

    // Fallback: calculate from local predictions
    const total = predictions.length;
    const resolved = predictions.filter(p => p.outcome !== undefined).length;
    const correct = predictions.filter(p => {
      if (p.outcome === undefined) return false;
      return (p.direction === 'YES' && p.outcome === true) ||
             (p.direction === 'NO' && p.outcome === false);
    }).length;

    const accuracy = resolved > 0 ? (correct / resolved) * 100 : 0;

    const brierScores = predictions
      .filter(p => p.brierScore !== undefined)
      .map(p => p.brierScore!);
    const avgBrier = brierScores.length > 0
      ? brierScores.reduce((a, b) => a + b, 0) / brierScores.length
      : 0;

    return {
      totalPredictions: total,
      resolvedPredictions: resolved,
      pendingPredictions: total - resolved,
      accuracy,
      brierScore: avgBrier,
      correct,
      streak: 0,
      maxStreak: 0,
    };
  }, [predictions, onChainStats]);

  return {
    predictions,
    onChainStats,
    isLoading,
    isSaving,
    error,
    savePrediction,
    loadPredictions,
    getUserPredictions,
    getStats,
    isDemo,
  };
}
