/**
 * Predictions API Route
 * GET /api/predictions - Get user's predictions
 * POST /api/predictions - Create a new prediction
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createPrediction,
  getUserPredictions,
  resolvePrediction,
  getOrCreateUserByWallet,
  getOrCreateUserByTelegram,
} from '../../../lib/db';

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

      return NextResponse.json({
        success: true,
        prediction,
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

    // Check if we have database configured
    const hasDb = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY;

    if (hasDb) {
      const prediction = await resolvePrediction(predictionId, outcome);
      return NextResponse.json({
        success: true,
        prediction,
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
