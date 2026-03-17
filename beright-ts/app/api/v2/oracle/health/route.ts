/**
 * GET /api/v2/oracle/health
 *
 * Oracle system health check.
 * Returns platform status, metrics, and data quality indicators.
 *
 * Use this endpoint to:
 * - Monitor oracle availability
 * - Check data freshness
 * - Assess confidence levels across feeds
 */

import { NextResponse } from 'next/server';
import { getOracleHealth, getOracleMetrics } from '@/lib/oracle';

export async function GET() {
  try {
    const [health, metrics] = await Promise.all([
      getOracleHealth(),
      Promise.resolve(getOracleMetrics()),
    ]);

    // Add internal metrics to response
    const response = {
      ...health,
      internalMetrics: {
        requestCount: metrics.requestCount,
        cacheHitRate: metrics.requestCount > 0
          ? metrics.cacheHits / metrics.requestCount
          : 0,
        avgLatencyMs: metrics.avgLatencyMs,
        errorCount: metrics.errorCount,
        lastError: metrics.lastError,
        uptimeSeconds: Math.round((Date.now() - metrics.startTime.getTime()) / 1000),
      },
    };

    // Return appropriate status code
    const statusCode = health.status === 'operational' ? 200 :
                       health.status === 'degraded' ? 200 : 503;

    return NextResponse.json(response, {
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Oracle-Status': health.status,
      },
    });
  } catch (error) {
    console.error('Oracle health check error:', error);
    return NextResponse.json(
      {
        healthy: false,
        status: 'down',
        error: error instanceof Error ? error.message : 'Health check failed',
        platforms: [],
        metrics: {
          totalFeeds: 0,
          highConfidenceFeeds: 0,
          staleFeeds: 0,
          avgConfidence: 0,
          avgLatencyMs: 0,
        },
        uptimeSeconds: 0,
        lastHealthCheck: new Date(),
      },
      { status: 503 }
    );
  }
}
