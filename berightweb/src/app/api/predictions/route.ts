import { NextRequest, NextResponse } from 'next/server';

/**
 * Predictions API
 * POST: Save a new prediction
 * GET: Fetch user's predictions
 *
 * In demo mode: Returns success with mock data (actual storage happens client-side)
 * In production: Would store to Supabase
 */

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
}

// POST: Save a new prediction
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      marketId,
      question,
      platform,
      direction,
      probability,
      marketOdds,
      walletAddress,
      isDemo,
    } = body;

    // Validate required fields
    if (!marketId || !question || !direction || !walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create prediction record
    const prediction: StoredPrediction = {
      id: `pred_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      marketId,
      question,
      platform: platform || 'unknown',
      direction,
      probability: probability || (direction === 'YES' ? marketOdds / 100 : 1 - marketOdds / 100),
      marketOdds: marketOdds || 50,
      walletAddress,
      createdAt: new Date().toISOString(),
    };

    // In demo mode, we just return success
    // Client-side localStorage will handle persistence
    if (isDemo) {
      return NextResponse.json({
        success: true,
        prediction,
        message: 'Prediction saved (demo mode)',
        storage: 'localStorage',
      });
    }

    // TODO: Production mode - store to Supabase
    // For now, return success (client will also save locally)
    return NextResponse.json({
      success: true,
      prediction,
      message: 'Prediction saved',
    });
  } catch (error) {
    console.error('[Predictions API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save prediction' },
      { status: 500 }
    );
  }
}

// GET: Fetch user's predictions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');
    const isDemo = searchParams.get('isDemo') === 'true';

    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Wallet address required' },
        { status: 400 }
      );
    }

    // In demo mode, return empty array - client will use localStorage
    if (isDemo) {
      return NextResponse.json({
        success: true,
        predictions: [],
        message: 'Use localStorage for demo mode predictions',
        storage: 'localStorage',
      });
    }

    // TODO: Production mode - fetch from Supabase
    return NextResponse.json({
      success: true,
      predictions: [],
      message: 'No predictions found',
    });
  } catch (error) {
    console.error('[Predictions API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch predictions' },
      { status: 500 }
    );
  }
}
