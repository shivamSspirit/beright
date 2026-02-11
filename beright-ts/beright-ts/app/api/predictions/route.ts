/**
 * Predictions API Route
 * GET /api/predictions - Get user's predictions
 * POST /api/predictions - Create a new prediction (with on-chain commit)
 * PATCH /api/predictions - Resolve a prediction (with on-chain resolution)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createPrediction,
  getUserPredictions,
  resolvePrediction as dbResolvePrediction,
  getOrCreateUserByWallet,
  getOrCreateUserByTelegram,
} from '../../../lib/db';

// On-chain integration
import {
  commitPrediction,
  resolvePrediction as onchainResolvePrediction,
  getWalletBalance,
} from '../../../lib/onchain';

// For now, we'll also support file-based predictions for local dev
import { addPrediction, listPending, getCalibrationStats } from '../../../skills/calibration';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status') as 'pending' | 'resolved' | 'all' || 'all';
    const limit = parseInt(searchParams.get('limit') || '50');

    // Check if we have database configured
    const hasDb = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY;

    if (hasDb && userId) {
      // Use database
      const predictions = await getUserPredictions(userId, { limit, status });
      return NextResponse.json({
        count: predictions.length,
        predictions,
      });
    } else {
      // Use local file-based system
      const pending = listPending();
      const stats = getCalibrationStats();

      return NextResponse.json({
        count: pending.length,
        predictions: pending,
        stats: {
          totalPredictions: stats.totalPredictions,
          resolvedPredictions: stats.resolvedPredictions,
          pendingPredictions: stats.pendingPredictions,
          brierScore: stats.overallBrierScore,
          accuracy: stats.accuracy,
          streak: stats.streak,
        },
      });
    }
  } catch (error) {
    console.error('Predictions GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch predictions', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: any = await request.json();
    const {
      question,
      probability,
      direction,
      reasoning,
      platform,
      marketId,
      marketUrl,
      confidence,
      tags,
      // Auth can come from wallet or telegram
      walletAddress,
      telegramId,
      // On-chain options
      commitOnChain = true, // Default to true for on-chain commits
    } = body;

    // Validate required fields
    if (!question || probability === undefined || !direction) {
      return NextResponse.json(
        { error: 'Missing required fields: question, probability, direction' },
        { status: 400 }
      );
    }

    if (probability < 0 || probability > 1) {
      return NextResponse.json(
        { error: 'Probability must be between 0 and 1' },
        { status: 400 }
      );
    }

    if (direction !== 'YES' && direction !== 'NO') {
      return NextResponse.json(
        { error: 'Direction must be YES or NO' },
        { status: 400 }
      );
    }

    // Check if we have database configured
    const hasDb = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY;

    if (hasDb) {
      // Get or create user
      let user;
      if (walletAddress) {
        user = await getOrCreateUserByWallet(walletAddress);
      } else if (telegramId) {
        user = await getOrCreateUserByTelegram(telegramId);
      } else {
        return NextResponse.json(
          { error: 'Authentication required: provide walletAddress or telegramId' },
          { status: 401 }
        );
      }

      // Create prediction in database first (without on-chain TX yet)
      const prediction = await createPrediction(user.id, {
        question,
        platform: platform || 'unknown',
        market_id: marketId,
        market_url: marketUrl,
        predicted_probability: probability,
        direction,
        confidence: confidence || 'medium',
        reasoning,
        tags: tags || [],
        resolves_at: null,
      });

      // Commit to blockchain if enabled
      let onChainResult;
      if (commitOnChain) {
        try {
          // Check wallet balance first
          const balance = await getWalletBalance();
          if (!balance.canCommit) {
            console.warn('Insufficient balance for on-chain commit, skipping blockchain step');
            return NextResponse.json({
              success: true,
              prediction,
              onChain: {
                committed: false,
                reason: 'Insufficient SOL balance',
              },
            }, { status: 201 });
          }

          // Commit to Solana
          onChainResult = await commitPrediction(
            walletAddress || user.wallet_address || user.id, // Use wallet or user ID as pubkey
            marketId || `CUSTOM-${Date.now()}`,
            probability,
            direction
          );

          if (onChainResult.success && onChainResult.signature) {
            // Update prediction with on-chain TX signature
            const { supabase } = await import('../../../lib/supabase/client');
            await supabase
              .from('predictions')
              .update({
                on_chain_tx: onChainResult.signature,
                on_chain_committed: true,
              })
              .eq('id', prediction.id);

            console.log(`✅ Prediction ${prediction.id} committed on-chain: ${onChainResult.signature}`);
          }
        } catch (onChainError) {
          console.error('On-chain commit failed:', onChainError);
          // Don't fail the entire request if on-chain fails
          onChainResult = {
            success: false,
            error: onChainError instanceof Error ? onChainError.message : 'Unknown error',
          };
        }
      }

      return NextResponse.json({
        success: true,
        prediction,
        onChain: onChainResult ? {
          committed: onChainResult.success,
          signature: onChainResult.signature,
          explorerUrl: onChainResult.explorerUrl,
          error: onChainResult.error,
        } : undefined,
      }, { status: 201 });
    } else {
      // Use local file-based system (no on-chain for local dev)
      const prediction = addPrediction(question, probability, direction, reasoning || '', {
        platform,
        marketUrl,
        confidence,
        tags,
      });

      return NextResponse.json({
        success: true,
        prediction,
        onChain: {
          committed: false,
          reason: 'Local dev mode (no database configured)',
        },
      }, { status: 201 });
    }
  } catch (error) {
    console.error('Predictions POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create prediction', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH for resolving predictions
export async function PATCH(request: NextRequest) {
  try {
    const body: any = await request.json();
    const { predictionId, outcome, resolveOnChain = true } = body;

    if (!predictionId || outcome === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: predictionId, outcome' },
        { status: 400 }
      );
    }

    // Check if we have database configured
    const hasDb = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY;

    if (hasDb) {
      // Get the prediction first
      const { supabase } = await import('../../../lib/supabase/client');
      const { data: pred, error: fetchError } = await supabase
        .from('predictions')
        .select('*')
        .eq('id', predictionId)
        .single();

      if (fetchError || !pred) {
        return NextResponse.json(
          { error: 'Prediction not found' },
          { status: 404 }
        );
      }

      // Resolve in database
      const prediction = await dbResolvePrediction(predictionId, outcome);

      // Resolve on-chain if the prediction was committed on-chain
      let onChainResult;
      if (resolveOnChain && pred.on_chain_tx && pred.on_chain_committed) {
        try {
          // Check wallet balance first
          const balance = await getWalletBalance();
          if (!balance.canCommit) {
            console.warn('Insufficient balance for on-chain resolution, skipping blockchain step');
            return NextResponse.json({
              success: true,
              prediction,
              onChain: {
                resolved: false,
                reason: 'Insufficient SOL balance',
              },
            });
          }

          // Resolve on Solana
          onChainResult = await onchainResolvePrediction(
            pred.on_chain_tx, // Original commit TX signature
            pred.predicted_probability,
            pred.direction,
            outcome // true = YES won, false = NO won
          );

          if (onChainResult.success && onChainResult.signature) {
            // Update prediction with resolution TX
            await supabase
              .from('predictions')
              .update({
                resolution_tx: onChainResult.signature,
              })
              .eq('id', predictionId);

            console.log(`✅ Prediction ${predictionId} resolved on-chain: ${onChainResult.signature}`);
          }
        } catch (onChainError) {
          console.error('On-chain resolution failed:', onChainError);
          onChainResult = {
            success: false,
            error: onChainError instanceof Error ? onChainError.message : 'Unknown error',
          };
        }
      }

      return NextResponse.json({
        success: true,
        prediction,
        onChain: onChainResult ? {
          resolved: onChainResult.success,
          signature: onChainResult.signature,
          explorerUrl: onChainResult.explorerUrl,
          error: onChainResult.error,
        } : pred.on_chain_tx ? {
          resolved: false,
          reason: 'On-chain resolution not requested or prediction not committed on-chain',
        } : undefined,
      });
    } else {
      // Use local file-based system
      const { resolvePrediction: localResolve } = await import('../../../skills/calibration');
      const prediction = localResolve(predictionId, outcome);

      if (!prediction) {
        return NextResponse.json(
          { error: 'Prediction not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        prediction,
        onChain: {
          resolved: false,
          reason: 'Local dev mode (no database configured)',
        },
      });
    }
  } catch (error) {
    console.error('Predictions PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to resolve prediction', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
