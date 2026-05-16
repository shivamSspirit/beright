/**
 * Oracle Cron Job Endpoint
 *
 * Autonomous forecaster that runs every 6 hours:
 * 1. Discovers trending markets from Polymarket + Jupiter
 * 2. Generates superforecaster-style predictions
 * 3. Saves to oracle_forecasts table
 * 4. Builds track record for credibility
 *
 * Schedule: Every 6 hours (cron: 0 at minute, every 6 hours)
 *
 * Manual test:
 *   curl http://localhost:3001/api/cron/oracle
 *   curl -X POST http://localhost:3001/api/cron/oracle
 *
 * @author BeRight Protocol
 */

import { NextResponse } from 'next/server';
import { runOracleForecaster } from '../../../../lib/oracle';

/**
 * Verify the request is from Vercel Cron (in production)
 */
function verifyCronRequest(request: Request): boolean {
  // In development, allow all requests
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }

  // In production, verify the Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return true;
  }

  // Also check x-vercel-cron-secret (Vercel's native header)
  const vercelCronSecret = request.headers.get('x-vercel-cron-secret');
  if (vercelCronSecret === process.env.CRON_SECRET) {
    return true;
  }

  return false;
}

/**
 * GET /api/cron/oracle
 *
 * Main entry point for the Oracle cron job.
 * Called by Vercel Cron every 6 hours.
 */
export async function GET(request: Request) {
  // Verify this is a legitimate cron request
  if (!verifyCronRequest(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const startTime = Date.now();

  try {
    console.log('[Oracle Cron] Starting autonomous forecasting run...');

    // Parse target count from query params (optional)
    const url = new URL(request.url);
    const targetCount = parseInt(url.searchParams.get('count') || '10', 10);

    // Run the Oracle forecaster
    const result = await runOracleForecaster(Math.min(targetCount, 20)); // Cap at 20

    const duration = Date.now() - startTime;

    console.log(`[Oracle Cron] Completed in ${duration}ms:`, {
      forecasts: result.forecasts,
      scanned: result.scanned,
      failed: result.failed,
    });

    return NextResponse.json({
      success: result.success,
      data: {
        runId: result.runId,
        forecasts: result.forecasts,
        scanned: result.scanned,
        skipped: result.skipped,
        failed: result.failed,
        duration_ms: result.duration_ms,
      },
      errors: result.errors.length > 0 ? result.errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[Oracle Cron] Fatal error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/oracle
 *
 * Alternative trigger for manual runs.
 * Supports JSON body with configuration.
 */
export async function POST(request: Request) {
  // Verify this is a legitimate cron request
  if (!verifyCronRequest(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const startTime = Date.now();

  try {
    // Parse body for configuration
    let targetCount = 10;
    try {
      const body = await request.json();
      if (body.count && typeof body.count === 'number') {
        targetCount = Math.min(body.count, 20);
      }
    } catch {
      // No body or invalid JSON, use defaults
    }

    console.log(`[Oracle Cron] Manual run triggered with count=${targetCount}`);

    // Run the Oracle forecaster
    const result = await runOracleForecaster(targetCount);

    return NextResponse.json({
      success: result.success,
      data: {
        runId: result.runId,
        forecasts: result.forecasts,
        scanned: result.scanned,
        skipped: result.skipped,
        failed: result.failed,
        duration_ms: result.duration_ms,
      },
      errors: result.errors.length > 0 ? result.errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[Oracle Cron] Fatal error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * Runtime configuration for Vercel
 */
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds max (Vercel Pro)
