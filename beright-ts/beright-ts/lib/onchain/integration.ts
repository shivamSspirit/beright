/**
 * BeRight On-Chain Integration Layer
 *
 * Bridges prediction skills with on-chain commitment system
 * Provides automatic Supabase persistence and retry logic
 */

import {
  commitPrediction,
  resolvePrediction,
  fetchPrediction,
  verifyPrediction,
  calculateBrierScore,
  Direction,
  MemoTxResult,
} from './index';
import { createClient } from '../supabase/client';

export interface PredictionData {
  userId: string;
  userPubkey: string;
  question: string;
  marketId: string;
  platform: string;
  probability: number;
  direction: Direction;
  confidence?: 'low' | 'medium' | 'high';
  reasoning?: string;
  marketUrl?: string;
}

export interface ResolutionData {
  predictionId: string;
  outcome: boolean; // true = YES won
  resolvedAt?: Date;
}

/**
 * Commit a prediction with automatic Supabase persistence
 *
 * This is the main entry point for making predictions from skills
 */
export async function commitPredictionWithPersistence(
  data: PredictionData
): Promise<{
  success: boolean;
  predictionId?: string;
  txSignature?: string;
  error?: string;
}> {
  try {
    const supabase = createClient();

    // 1. Commit to Solana blockchain
    const txResult = await commitPrediction(
      data.userPubkey,
      data.marketId,
      data.probability,
      data.direction
    );

    if (!txResult.success) {
      console.error('On-chain commit failed:', txResult.error);
      return {
        success: false,
        error: `On-chain commit failed: ${txResult.error}`,
      };
    }

    // 2. Save to Supabase
    const { data: prediction, error: dbError } = await supabase
      .from('predictions')
      .insert({
        user_id: data.userId,
        question: data.question,
        platform: data.platform,
        market_id: data.marketId,
        market_url: data.marketUrl,
        predicted_probability: data.probability,
        direction: data.direction,
        confidence: data.confidence,
        reasoning: data.reasoning,
        on_chain_tx: txResult.signature,
        on_chain_confirmed: true,
      })
      .select('id')
      .single();

    if (dbError) {
      console.error('Supabase insert failed:', dbError);
      return {
        success: false,
        txSignature: txResult.signature,
        error: `Database error: ${dbError.message}`,
      };
    }

    console.log(`✅ Prediction committed: DB=${prediction.id}, TX=${txResult.signature}`);

    return {
      success: true,
      predictionId: prediction.id,
      txSignature: txResult.signature,
    };
  } catch (error: any) {
    console.error('commitPredictionWithPersistence error:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Resolve a prediction with automatic Brier score calculation and persistence
 */
export async function resolvePredictionWithPersistence(
  data: ResolutionData
): Promise<{
  success: boolean;
  txSignature?: string;
  brierScore?: number;
  error?: string;
}> {
  try {
    const supabase = createClient();

    // 1. Fetch prediction from database
    const { data: prediction, error: fetchError } = await supabase
      .from('predictions')
      .select('*')
      .eq('id', data.predictionId)
      .single();

    if (fetchError || !prediction) {
      return {
        success: false,
        error: `Prediction not found: ${fetchError?.message}`,
      };
    }

    if (!prediction.on_chain_tx) {
      return {
        success: false,
        error: 'Prediction has no on-chain commitment',
      };
    }

    // 2. Calculate Brier score
    const brierScore = calculateBrierScore({
      probability: prediction.predicted_probability,
      direction: prediction.direction as Direction,
      outcome: data.outcome,
    });

    // 3. Commit resolution to chain
    const txResult = await resolvePrediction(
      prediction.on_chain_tx,
      prediction.predicted_probability,
      prediction.direction as Direction,
      data.outcome
    );

    if (!txResult.success) {
      console.error('On-chain resolution failed:', txResult.error);
      return {
        success: false,
        error: `On-chain resolution failed: ${txResult.error}`,
      };
    }

    // 4. Update Supabase
    const { error: updateError } = await supabase
      .from('predictions')
      .update({
        outcome: data.outcome,
        brier_score: brierScore,
        resolved_at: data.resolvedAt || new Date().toISOString(),
      })
      .eq('id', data.predictionId);

    if (updateError) {
      console.error('Supabase update failed:', updateError);
      return {
        success: false,
        txSignature: txResult.signature,
        brierScore,
        error: `Database error: ${updateError.message}`,
      };
    }

    console.log(`✅ Prediction resolved: Brier=${brierScore.toFixed(4)}, TX=${txResult.signature}`);

    return {
      success: true,
      txSignature: txResult.signature,
      brierScore,
    };
  } catch (error: any) {
    console.error('resolvePredictionWithPersistence error:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Verify a prediction from the database
 */
export async function verifyDatabasePrediction(
  predictionId: string
): Promise<{
  valid: boolean;
  errors: string[];
  details?: any;
}> {
  try {
    const supabase = createClient();

    // Fetch prediction
    const { data: prediction, error } = await supabase
      .from('predictions')
      .select('*')
      .eq('id', predictionId)
      .single();

    if (error || !prediction) {
      return {
        valid: false,
        errors: [`Prediction not found: ${error?.message}`],
      };
    }

    if (!prediction.on_chain_tx) {
      return {
        valid: false,
        errors: ['No on-chain transaction'],
      };
    }

    // Verify on-chain
    const onChainResult = await fetchPrediction(prediction.on_chain_tx);

    if (!onChainResult.found) {
      return {
        valid: false,
        errors: [`On-chain verification failed: ${onChainResult.error}`],
      };
    }

    // Compare database vs chain
    const onChainData = onChainResult.prediction!;
    const errors: string[] = [];

    if (Math.abs(onChainData.probability - prediction.predicted_probability) > 0.0001) {
      errors.push('Probability mismatch between DB and chain');
    }

    if (onChainData.direction !== prediction.direction) {
      errors.push('Direction mismatch between DB and chain');
    }

    if (onChainData.marketId !== prediction.market_id) {
      errors.push('Market ID mismatch between DB and chain');
    }

    return {
      valid: errors.length === 0,
      errors,
      details: {
        database: prediction,
        onChain: onChainData,
      },
    };
  } catch (error: any) {
    return {
      valid: false,
      errors: [`Verification error: ${error.message}`],
    };
  }
}

/**
 * Get user's on-chain verified statistics
 */
export async function getUserOnChainStats(
  userId: string
): Promise<{
  totalPredictions: number;
  onChainPredictions: number;
  verificationRate: number;
  resolvedPredictions: number;
  avgBrierScore: number;
  accuracy: number;
}> {
  try {
    const supabase = createClient();

    const { data: predictions, error } = await supabase
      .from('predictions')
      .select('*')
      .eq('user_id', userId);

    if (error || !predictions) {
      console.error('getUserOnChainStats error:', error);
      return {
        totalPredictions: 0,
        onChainPredictions: 0,
        verificationRate: 0,
        resolvedPredictions: 0,
        avgBrierScore: 0,
        accuracy: 0,
      };
    }

    const total = predictions.length;
    const onChain = predictions.filter(p => p.on_chain_confirmed).length;
    const resolved = predictions.filter(p => p.resolved_at).length;

    const brierScores = predictions
      .filter(p => p.brier_score !== null)
      .map(p => p.brier_score);

    const avgBrier = brierScores.length > 0
      ? brierScores.reduce((a, b) => a + b, 0) / brierScores.length
      : 0;

    const correct = predictions.filter(
      p => p.outcome !== null &&
           ((p.outcome && p.direction === 'YES') || (!p.outcome && p.direction === 'NO'))
    ).length;

    const accuracy = resolved > 0 ? correct / resolved : 0;

    return {
      totalPredictions: total,
      onChainPredictions: onChain,
      verificationRate: total > 0 ? onChain / total : 0,
      resolvedPredictions: resolved,
      avgBrierScore: avgBrier,
      accuracy,
    };
  } catch (error: any) {
    console.error('getUserOnChainStats error:', error);
    return {
      totalPredictions: 0,
      onChainPredictions: 0,
      verificationRate: 0,
      resolvedPredictions: 0,
      avgBrierScore: 0,
      accuracy: 0,
    };
  }
}

/**
 * Batch verify all predictions for a user
 */
export async function batchVerifyUserPredictions(
  userId: string
): Promise<{
  total: number;
  verified: number;
  failed: number;
  errors: Array<{ predictionId: string; error: string }>;
}> {
  try {
    const supabase = createClient();

    const { data: predictions, error } = await supabase
      .from('predictions')
      .select('id, on_chain_tx')
      .eq('user_id', userId)
      .not('on_chain_tx', 'is', null);

    if (error || !predictions) {
      return { total: 0, verified: 0, failed: 0, errors: [] };
    }

    const results = await Promise.all(
      predictions.map(p => verifyDatabasePrediction(p.id))
    );

    const verified = results.filter(r => r.valid).length;
    const failed = results.filter(r => !r.valid).length;
    const errors = results
      .filter(r => !r.valid)
      .map((r, i) => ({
        predictionId: predictions[i].id,
        error: r.errors.join(', '),
      }));

    return {
      total: predictions.length,
      verified,
      failed,
      errors,
    };
  } catch (error: any) {
    console.error('batchVerifyUserPredictions error:', error);
    return { total: 0, verified: 0, failed: 0, errors: [] };
  }
}
