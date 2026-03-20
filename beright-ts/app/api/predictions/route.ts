/**
 * Predictions API Route
 * GET /api/predictions - Get user's predictions
 * POST /api/predictions - Create a new prediction
 *
 * Demo Mode: Returns mock predictions with fake Solana signatures
 * Production Mode: Returns real predictions with on-chain commits
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createPrediction,
  getUserPredictions,
  resolvePrediction,
  getOrCreateUserByWallet,
  getOrCreateUserByTelegram,
  updatePredictionOnChain,
  updatePredictionResolutionTx,
} from '../../../lib/db';
import {
  commitPredictionWithCalibration,
  resolvePrediction as resolveOnChain,
} from '../../../lib/onchain/commit';
import {
  resolvePredictionOnChain,
  getForecasterPredictions,
} from '../../../lib/onchain/calibration';
import { isDemo } from '../../../lib/mode';
import { generateMockSignature, generateMockPredictionCommit } from '../../../lib/demo/mockConfirmations';

// For now, we'll also support file-based predictions for local dev
import { addPrediction, listPending, getCalibrationStats } from '../../../skills/calibration';

// Mock predictions for demo mode
function getDemoPredictions(limit: number = 10) {
  const demoPredictions = [
    {
      id: 'demo-pred-001',
      question: 'Will BTC reach $120k by end of March 2026?',
      platform: 'polymarket',
      market_id: 'btc-120k-mar-2026',
      predicted_probability: 0.72,
      direction: 'YES',
      confidence: 'high',
      reasoning: 'Strong institutional inflows and ETF momentum',
      status: 'pending',
      created_at: '2026-03-15T10:30:00Z',
      on_chain_tx: generateMockSignature(),
      on_chain_confirmed: true,
    },
    {
      id: 'demo-pred-002',
      question: 'Will ETH flip BTC by market cap in 2026?',
      platform: 'polymarket',
      market_id: 'eth-flip-btc-2026',
      predicted_probability: 0.15,
      direction: 'NO',
      confidence: 'high',
      reasoning: 'BTC dominance remains strong post-halving',
      status: 'resolved',
      outcome: false,
      brier_score: 0.0225,
      created_at: '2026-01-10T14:00:00Z',
      resolved_at: '2026-03-01T00:00:00Z',
      on_chain_tx: generateMockSignature(),
      on_chain_confirmed: true,
    },
    {
      id: 'demo-pred-003',
      question: 'Will Fed cut rates in Q1 2026?',
      platform: 'kalshi',
      market_id: 'fed-rate-cut-q1-2026',
      predicted_probability: 0.65,
      direction: 'YES',
      confidence: 'medium',
      reasoning: 'Inflation trending down, soft landing likely',
      status: 'resolved',
      outcome: true,
      brier_score: 0.1225,
      created_at: '2025-12-15T09:00:00Z',
      resolved_at: '2026-03-18T18:00:00Z',
      on_chain_tx: generateMockSignature(),
      on_chain_confirmed: true,
    },
    {
      id: 'demo-pred-004',
      question: 'Will SOL reach $400 by April 2026?',
      platform: 'polymarket',
      market_id: 'sol-400-apr-2026',
      predicted_probability: 0.45,
      direction: 'YES',
      confidence: 'medium',
      reasoning: 'Strong DeFi activity but facing competition',
      status: 'pending',
      created_at: '2026-03-18T11:00:00Z',
      on_chain_tx: generateMockSignature(),
      on_chain_confirmed: true,
    },
    {
      id: 'demo-pred-005',
      question: 'Will GPT-5 be released before July 2026?',
      platform: 'metaculus',
      market_id: 'gpt5-release-jul-2026',
      predicted_probability: 0.78,
      direction: 'YES',
      confidence: 'high',
      reasoning: 'OpenAI roadmap and competitive pressure from Claude',
      status: 'pending',
      created_at: '2026-03-17T16:30:00Z',
      on_chain_tx: generateMockSignature(),
      on_chain_confirmed: true,
    },
  ];

  return demoPredictions.slice(0, limit).map(p => ({
    ...p,
    _demo: true,
  }));
}

function getDemoStats() {
  return {
    totalPredictions: 47,
    resolvedPredictions: 32,
    pendingPredictions: 15,
    brierScore: 0.142,
    accuracy: 0.72,
    streak: 5,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status') as 'pending' | 'resolved' | 'all' || 'all';
    const limit = parseInt(searchParams.get('limit') || '50');

    // ============================================
    // DEMO MODE: Return mock predictions
    // ============================================
    if (isDemo()) {
      const demoPredictions = getDemoPredictions(limit);
      const stats = getDemoStats();

      // Filter by status if requested
      let filtered = demoPredictions;
      if (status === 'pending') {
        filtered = demoPredictions.filter(p => p.status === 'pending');
      } else if (status === 'resolved') {
        filtered = demoPredictions.filter(p => p.status === 'resolved');
      }

      return NextResponse.json({
        success: true,
        count: filtered.length,
        predictions: filtered,
        stats,
        meta: { source: 'demo', network: 'devnet' },
      });
    }

    // ============================================
    // PRODUCTION MODE: Real predictions
    // ============================================

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

    // ============================================
    // DEMO MODE: Return mock prediction creation
    // ============================================
    if (isDemo()) {
      const mockCommit = generateMockPredictionCommit({
        question: question,
        probability: probability,
        direction: direction as 'YES' | 'NO',
      });

      const demoPrediction = {
        id: `demo-pred-${Date.now()}`,
        question,
        platform: platform || 'demo',
        market_id: marketId,
        market_url: marketUrl,
        predicted_probability: probability,
        direction,
        confidence: confidence || 'medium',
        reasoning,
        tags: tags || [],
        status: 'pending',
        created_at: new Date().toISOString(),
        on_chain_tx: mockCommit.signature,
        on_chain_confirmed: true,
        _demo: true,
      };

      // Generate additional mock signatures for calibration tracking
      const calibrationTx = generateMockSignature();
      const forecasterPda = `Demo${(walletAddress || 'Wallet').substring(0, 8)}Pda111111111111111111111`;

      return NextResponse.json({
        success: true,
        prediction: demoPrediction,
        onChain: {
          committed: true,
          memoTx: mockCommit.signature,
          calibrationTx: calibrationTx,
          forecasterPda: forecasterPda,
          explorerUrl: mockCommit.explorerUrl,
          _demo: true,
        },
        meta: { source: 'demo', network: 'devnet' },
      }, { status: 201 });
    }

    // ============================================
    // PRODUCTION MODE: Real prediction creation
    // ============================================

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

      // Create prediction in database
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

      // Commit prediction on-chain with calibration tracking
      let onChainResult = null;
      try {
        const userPubkey = walletAddress || `telegram:${telegramId}`;
        const chainMarketId = marketId || question.substring(0, 50);

        onChainResult = await commitPredictionWithCalibration(
          userPubkey,
          chainMarketId,
          probability,
          direction as 'YES' | 'NO',
          0 // category
        );

        // If successful, update prediction with tx signatures
        if (onChainResult.success && onChainResult.memoTx) {
          await updatePredictionOnChain(prediction.id, onChainResult.memoTx, true);
          (prediction as any).on_chain_tx = onChainResult.memoTx;
          (prediction as any).on_chain_confirmed = true;
          (prediction as any).calibration_tx = onChainResult.calibrationTx;
          (prediction as any).forecaster_pda = onChainResult.forecasterPda;
        }
      } catch (onChainError) {
        console.error('On-chain commit failed (prediction still saved):', onChainError);
      }

      return NextResponse.json({
        success: true,
        prediction,
        onChain: onChainResult ? {
          committed: onChainResult.success,
          memoTx: onChainResult.memoTx,
          calibrationTx: onChainResult.calibrationTx,
          forecasterPda: onChainResult.forecasterPda,
          explorerUrl: onChainResult.memoTx
            ? `https://solscan.io/tx/${onChainResult.memoTx}?cluster=devnet`
            : undefined,
          error: onChainResult.error,
        } : null,
      }, { status: 201 });
    } else {
      // Use local file-based system
      const prediction = addPrediction(question, probability, direction, reasoning || '', {
        platform,
        marketUrl,
        confidence,
        tags,
      });

      return NextResponse.json({
        success: true,
        prediction,
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
    const { predictionId, outcome } = body;

    if (!predictionId || outcome === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: predictionId, outcome' },
        { status: 400 }
      );
    }

    // ============================================
    // DEMO MODE: Return mock resolution
    // ============================================
    if (isDemo()) {
      // Calculate a mock Brier score based on outcome
      const mockProbability = 0.65;
      const brierScore = Math.pow(mockProbability - (outcome ? 1 : 0), 2);

      const resolvedPrediction = {
        id: predictionId,
        status: 'resolved',
        outcome,
        brier_score: brierScore,
        resolved_at: new Date().toISOString(),
        on_chain_resolution_tx: generateMockSignature(),
        _demo: true,
      };

      return NextResponse.json({
        success: true,
        prediction: resolvedPrediction,
        onChain: {
          resolved: true,
          signature: resolvedPrediction.on_chain_resolution_tx,
          explorerUrl: `https://solscan.io/tx/${resolvedPrediction.on_chain_resolution_tx}?cluster=devnet`,
          _demo: true,
        },
        meta: { source: 'demo', network: 'devnet' },
      });
    }

    // ============================================
    // PRODUCTION MODE: Real resolution
    // ============================================

    // Check if we have database configured
    const hasDb = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY;

    if (hasDb) {
      const prediction = await resolvePrediction(predictionId, outcome);

      // If prediction was committed on-chain, also resolve on-chain
      let onChainResult = null;
      const predictionAny = prediction as any;
      if (predictionAny.on_chain_tx) {
        try {
          onChainResult = await resolveOnChain(
            predictionAny.on_chain_tx,
            prediction.predicted_probability,
            prediction.direction as 'YES' | 'NO',
            outcome
          );

          // If successful, update prediction with resolution tx signature
          if (onChainResult.success && onChainResult.signature) {
            await updatePredictionResolutionTx(prediction.id, onChainResult.signature);
            predictionAny.on_chain_resolution_tx = onChainResult.signature;
          }
        } catch (onChainError) {
          console.error('On-chain resolution failed (DB updated):', onChainError);
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
        } : null,
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
