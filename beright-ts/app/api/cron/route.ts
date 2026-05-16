/**
 * Cron Job Endpoint for BeRight Protocol
 *
 * This endpoint is called by Vercel Cron to run scheduled tasks:
 * 1. Morning briefs (sent at each subscriber's preferred time)
 * 2. Proactive agent alerts (market opportunities)
 *
 * Schedule: Every hour at minute 0 (0 * * * *)
 *
 * To test locally: curl http://localhost:3000/api/cron
 */

import { NextResponse } from 'next/server';
import { runProactiveAgent } from '../../../skills/proactiveAgent';

// Verify the request is from Vercel Cron (in production)
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

  return false;
}

export async function GET(request: Request) {
  // Verify this is a legitimate cron request
  if (!verifyCronRequest(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const startTime = Date.now();

  try {
    console.log('[Cron] Starting scheduled tasks...');

    // Run the proactive agent (includes morning briefs + alerts)
    const result = await runProactiveAgent();

    const duration = Date.now() - startTime;

    console.log(`[Cron] Completed in ${duration}ms:`, result);

    return NextResponse.json({
      success: true,
      duration: `${duration}ms`,
      result: {
        alertsGenerated: result.alertsGenerated,
        alertsSent: result.alertsSent,
        marketsScanned: result.marketsScanned,
        briefsSent: result.briefsSent,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron] Error running scheduled tasks:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers
export async function POST(request: Request) {
  return GET(request);
}
