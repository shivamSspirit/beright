/**
 * DFlow Predictions API Route
 * POST /api/dflow/predictions - Create a prediction on a DFlow tokenized market
 *
 * This endpoint is specifically designed for DFlow markets and includes:
 * - Market validation via DFlow API
 * - On-chain storage via Solana Memo Program
 * - Token addresses for potential trading
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createPrediction,
  getOrCreateUserByWallet,
  getOrCreateUserByTelegram,
  updatePredictionOnChain,
} from '../../../../lib/db';
import { commitPrediction as commitOnChain } from '../../../../lib/onchain/commit';
import { getDFlowMarket } from '../../../../lib/dflow';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      ticker,           // DFlow market ticker (e.g., "KXBTC-26DEC31-T100K")
      eventTicker,      // Optional: event ticker (e.g., "KXBTC")
      probability,      // Predicted probability (0-1)
      direction,        // YES or NO
      reasoning,        // Optional reasoning
      confidence,       // Optional: low, medium, high
      walletAddress,    // User's wallet address
      telegramId,       // Or telegram ID
    } = body;

    // Validate required fields
    if (!ticker) {
      return NextResponse.json(
        { error: 'Missing required field: ticker (DFlow market ticker)' },
        { status: 400 }
      );
    }

    if (probability === undefined || probability < 0 || probability > 1) {
      return NextResponse.json(
        { error: 'probability must be between 0 and 1' },
        { status: 400 }
      );
    }

    if (direction !== 'YES' && direction !== 'NO') {
      return NextResponse.json(
        { error: 'direction must be YES or NO' },
        { status: 400 }
      );
    }

    if (!walletAddress && !telegramId) {
      return NextResponse.json(
        { error: 'Authentication required: provide walletAddress or telegramId' },
        { status: 401 }
      );
    }

    // Fetch market details from DFlow API
    let market;
    try {
      market = await getDFlowMarket(ticker);
      if (!market) {
        return NextResponse.json(
          { error: `Market not found: ${ticker}` },
          { status: 404 }
        );
      }
    } catch (dflowError) {
      console.error('DFlow API error:', dflowError);
      return NextResponse.json(
        { error: 'Failed to fetch market from DFlow', details: dflowError instanceof Error ? dflowError.message : 'Unknown error' },
        { status: 502 }
      );
    }

    // Check if we have database configured
    const hasDb = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY;

    if (!hasDb) {
      return NextResponse.json(
        { error: 'Database not configured. DFlow predictions require Supabase.' },
        { status: 503 }
      );
    }

    // Get or create user
    let user;
    if (walletAddress) {
      user = await getOrCreateUserByWallet(walletAddress);
    } else {
      user = await getOrCreateUserByTelegram(telegramId);
    }

    // Extract token addresses from market (accounts keyed by currency mint)
    const usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const accountInfo = market.accounts?.[usdcMint];
    const yesMint = accountInfo?.yesMint || null;
    const noMint = accountInfo?.noMint || null;

    // Create prediction in database
    const prediction = await createPrediction(user.id, {
      question: market.title || ticker,
      platform: 'dflow',
      market_id: ticker,
      market_url: `https://pond.dflow.net/market/${ticker}`,
      predicted_probability: probability,
      direction,
      confidence: confidence || 'medium',
      reasoning: reasoning || null,
      resolves_at: market.closeTime ? new Date(market.closeTime * 1000).toISOString() : null,
      tags: eventTicker ? [eventTicker] : [],
    });

    // Commit prediction on-chain
    let onChainResult = null;
    try {
      const userPubkey = walletAddress || `telegram:${telegramId}`;

      onChainResult = await commitOnChain(
        userPubkey,
        ticker,
        probability,
        direction as 'YES' | 'NO'
      );

      // If successful, update prediction with tx signature
      if (onChainResult.success && onChainResult.signature) {
        await updatePredictionOnChain(prediction.id, onChainResult.signature, true);
      }
    } catch (onChainError) {
      console.error('On-chain commit failed (prediction still saved):', onChainError);
    }

    // Return full response with market details and token addresses
    return NextResponse.json({
      success: true,
      prediction: {
        ...prediction,
        // Include market details for convenience
        market: {
          ticker: market.ticker,
          title: market.title,
          status: market.status,
          yesPrice: market.yesBid ? parseFloat(market.yesBid) : null,
          noPrice: market.noBid ? parseFloat(market.noBid) : null,
          volume: market.volume,
          closeTime: market.closeTime,
        },
        // Token addresses for trading
        tokens: {
          yesMint,
          noMint,
          canTrade: !!(yesMint && noMint),
        },
      },
      onChain: onChainResult ? {
        committed: onChainResult.success,
        signature: onChainResult.signature,
        explorerUrl: onChainResult.explorerUrl,
        error: onChainResult.error,
      } : null,
    }, { status: 201 });

  } catch (error) {
    console.error('DFlow Predictions POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create DFlow prediction', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET - List DFlow predictions for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');
    const telegramId = searchParams.get('telegramId');
    const status = searchParams.get('status') as 'pending' | 'resolved' | 'all' || 'all';

    if (!walletAddress && !telegramId) {
      return NextResponse.json(
        { error: 'Provide wallet or telegramId parameter' },
        { status: 400 }
      );
    }

    const hasDb = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY;
    if (!hasDb) {
      return NextResponse.json({ predictions: [], count: 0 });
    }

    // Get user
    let user;
    if (walletAddress) {
      user = await getOrCreateUserByWallet(walletAddress);
    } else {
      user = await getOrCreateUserByTelegram(telegramId!);
    }

    // Get predictions from db filtered by platform='dflow'
    const { getUserPredictions } = await import('../../../../lib/db');
    const allPredictions = await getUserPredictions(user.id, { status, limit: 100 });
    const dflowPredictions = allPredictions.filter(p => p.platform === 'dflow');

    return NextResponse.json({
      count: dflowPredictions.length,
      predictions: dflowPredictions,
    });

  } catch (error) {
    console.error('DFlow Predictions GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch DFlow predictions' },
      { status: 500 }
    );
  }
}
