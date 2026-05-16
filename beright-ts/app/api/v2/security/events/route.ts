/**
 * Security Events API
 *
 * Query and filter security events.
 * ADMIN ONLY - requires admin or service role authentication.
 *
 * GET /api/v2/security/events
 *   ?hours=24           - Time range (default: 24)
 *   &severity=warning   - Filter by severity
 *   &eventType=auth_failure - Filter by event type
 *   &limit=100          - Max results (default: 100)
 *
 * @author BeRight Protocol
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getRecentSecurityEvents, SecuritySeverity, SecurityEventType } from '../../../../../lib/middleware';

/**
 * GET /api/v2/security/events
 */
export const GET = requireAdmin(async (request: NextRequest, ctx) => {
  try {
    const url = request.nextUrl;

    // Parse query parameters
    const hours = parseInt(url.searchParams.get('hours') || '24', 10);
    const severity = url.searchParams.get('severity') as SecuritySeverity | null;
    const eventType = url.searchParams.get('eventType') as SecurityEventType | null;
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500);

    const startTime = Date.now();

    // Fetch events
    const events = await getRecentSecurityEvents(hours, {
      severity: severity || undefined,
      eventType: eventType || undefined,
      limit,
    });

    // Group by severity for summary
    const summary = {
      total: events.length,
      bySeverity: {
        debug: events.filter(e => e.severity === 'debug').length,
        info: events.filter(e => e.severity === 'info').length,
        warning: events.filter(e => e.severity === 'warning').length,
        error: events.filter(e => e.severity === 'error').length,
        critical: events.filter(e => e.severity === 'critical').length,
      },
      bySuccess: {
        success: events.filter(e => e.success !== false).length,
        failure: events.filter(e => e.success === false).length,
      },
    };

    return NextResponse.json({
      success: true,
      data: {
        events: events.map(e => ({
          eventType: e.eventType,
          action: e.action,
          severity: e.severity,
          success: e.success,
          walletAddress: e.walletAddress,
          telegramId: e.telegramId,
          ipAddress: e.ipAddress,
          requestId: e.requestId,
          details: e.details,
          errorMessage: e.errorMessage,
        })),
        summary,
      },
      meta: {
        requestId: ctx.requestId,
        hours,
        filters: {
          severity: severity || 'all',
          eventType: eventType || 'all',
        },
        latencyMs: Date.now() - startTime,
      },
    });
  } catch (error) {
    console.error('[API v2/security/events] Error:', error);
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
