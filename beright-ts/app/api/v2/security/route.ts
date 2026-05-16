/**
 * Security Dashboard API
 *
 * Provides security status, recent events, and statistics.
 * ADMIN ONLY - requires admin or service role authentication.
 *
 * GET /api/v2/security - Get security overview
 * GET /api/v2/security?events=true - Include recent events
 * GET /api/v2/security?stats=true - Include statistics
 *
 * @author BeRight Protocol
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getRecentSecurityEvents, getSecurityStats } from '../../../../lib/middleware';
import { getKillSwitchStatus } from '../../../../lib/killSwitch';
import { getAllMonitorStatuses } from '../../../../lib/solana';
import { getRecentTxAudits } from '../../../../lib/solana/auditLog';
import { secrets } from '../../../../lib/secrets';

/**
 * GET /api/v2/security
 *
 * Returns security dashboard data.
 * Requires admin authentication.
 */
export const GET = requireAdmin(async (request: NextRequest, ctx) => {
  try {
    const url = request.nextUrl;
    const includeEvents = url.searchParams.get('events') === 'true';
    const includeStats = url.searchParams.get('stats') === 'true';
    const hours = parseInt(url.searchParams.get('hours') || '24', 10);

    const startTime = Date.now();

    // Get kill switch status
    const killSwitches = getKillSwitchStatus();

    // Get secrets configuration summary (never includes actual values)
    const secretsStatus = secrets.getConfigSummary();
    const environmentInfo = secrets.getEnvironmentInfo();

    // Get wallet monitor statuses
    const walletMonitors = getAllMonitorStatuses();

    // Build response
    const response: Record<string, unknown> = {
      success: true,
      data: {
        environment: environmentInfo,
        killSwitches: killSwitches.switches,
        secrets: {
          configured: secretsStatus,
          productionReady: secrets.isProductionReady(),
        },
        walletMonitors: walletMonitors.map(w => ({
          address: w.address.slice(0, 8) + '...',
          balanceSol: w.balanceSol,
          isLow: w.isLow,
          recentOutflowSol: w.recentOutflowSol,
          alertsTriggered: w.alertsTriggered,
          lastChecked: w.lastChecked,
        })),
      },
      meta: {
        requestId: ctx.requestId,
        checkedAt: new Date().toISOString(),
        latencyMs: 0,
      },
    };

    // Include recent security events if requested
    if (includeEvents) {
      const events = await getRecentSecurityEvents(hours, { limit: 50 });
      response.data = {
        ...(response.data as Record<string, unknown>),
        recentEvents: events.map(e => ({
          eventType: e.eventType,
          action: e.action,
          severity: e.severity,
          success: e.success,
          walletAddress: e.walletAddress ? e.walletAddress.slice(0, 8) + '...' : null,
          requestId: e.requestId,
          details: e.details,
        })),
      };
    }

    // Include statistics if requested
    if (includeStats) {
      const [securityStats, txAudits] = await Promise.all([
        getSecurityStats(hours),
        getRecentTxAudits(undefined, 20),
      ]);

      // Calculate tx audit stats
      const txStats = {
        total: txAudits.length,
        confirmed: txAudits.filter(t => t.status === 'confirmed').length,
        failed: txAudits.filter(t => t.status === 'failed').length,
        pending: txAudits.filter(t => t.status === 'pending' || t.status === 'sent').length,
      };

      response.data = {
        ...(response.data as Record<string, unknown>),
        statistics: {
          securityEvents: securityStats,
          transactions: txStats,
          timeframeHours: hours,
        },
      };
    }

    // Add latency
    (response.meta as Record<string, unknown>).latencyMs = Date.now() - startTime;

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API v2/security] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: ctx.requestId,
      },
      { status: 500 }
    );
  }
});
