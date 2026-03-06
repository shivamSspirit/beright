/**
 * Data Fabric Health Check API v2
 *
 * @author BeRight Protocol
 */

import { NextResponse } from 'next/server';
import { getDataFabric } from '../../../../lib/dataFabric';

/**
 * GET /api/v2/health
 *
 * Returns health status of Data Fabric and all providers.
 */
export async function GET() {
  try {
    const startTime = Date.now();
    const fabric = getDataFabric();
    const health = await fabric.getHealthStatus();

    const healthyProviders = Object.entries(health.providers)
      .filter(([_, v]) => v)
      .map(([k]) => k);

    const unhealthyProviders = Object.entries(health.providers)
      .filter(([_, v]) => !v)
      .map(([k]) => k);

    return NextResponse.json({
      success: true,
      status: health.healthy ? 'healthy' : 'degraded',
      data: {
        overall: health.healthy,
        providers: health.providers,
        healthyProviders,
        unhealthyProviders,
        cache: health.cacheStats,
      },
      meta: {
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - startTime,
        version: '2.0.0',
      },
    }, {
      status: health.healthy ? 200 : 503,
    });
  } catch (error) {
    console.error('[API v2/health] Error:', error);
    return NextResponse.json(
      {
        success: false,
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
