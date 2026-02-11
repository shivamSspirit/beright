/**
 * Prediction Verification API Route
 * GET /api/predictions/verify?commitTx=... - Verify an on-chain prediction
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  fetchPrediction,
  fetchResolution,
  verifyPrediction,
  generateVerificationProof,
} from '../../../../lib/onchain';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const commitTx = searchParams.get('commitTx');
    const resolutionTx = searchParams.get('resolutionTx');
    const marketResolutionTime = searchParams.get('marketResolutionTime');

    if (!commitTx) {
      return NextResponse.json(
        { error: 'Missing required parameter: commitTx' },
        { status: 400 }
      );
    }

    // Fetch prediction from blockchain
    const predictionResult = await fetchPrediction(commitTx);

    if (!predictionResult.found) {
      return NextResponse.json(
        { error: 'Prediction not found on-chain', details: predictionResult.error },
        { status: 404 }
      );
    }

    // If resolution TX provided, fetch and verify complete lifecycle
    if (resolutionTx) {
      const resolutionResult = await fetchResolution(resolutionTx);

      if (!resolutionResult.found) {
        return NextResponse.json(
          { error: 'Resolution not found on-chain', details: resolutionResult.error },
          { status: 404 }
        );
      }

      // Verify the complete prediction lifecycle
      const marketTime = marketResolutionTime
        ? parseInt(marketResolutionTime)
        : Math.floor(Date.now() / 1000); // Default to now if not provided

      const verification = await verifyPrediction(commitTx, resolutionTx, marketTime);

      return NextResponse.json({
        valid: verification.valid,
        errors: verification.errors,
        prediction: predictionResult.prediction,
        resolution: resolutionResult.resolution,
        commitTime: predictionResult.blockTime,
        resolveTime: resolutionResult.blockTime,
        details: verification.details,
        proof: generateVerificationProof(commitTx, resolutionTx),
      });
    }

    // Return just the prediction if no resolution
    return NextResponse.json({
      found: true,
      prediction: predictionResult.prediction,
      commitTime: predictionResult.blockTime,
      proof: generateVerificationProof(commitTx),
    });
  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify prediction', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
