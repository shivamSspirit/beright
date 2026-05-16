/**
 * Portfolio Alerts API v2
 *
 * Risk alerts and notifications.
 *
 * @author BeRight Protocol
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPortfolioManager, getAlertManager, AlertPriority, AlertType } from '../../../../../lib/portfolio';

/**
 * GET /api/v2/portfolio/alerts
 *
 * Get portfolio alerts.
 *
 * Query Parameters:
 * - unacknowledged: boolean (default: true)
 * - priority: 'low' | 'medium' | 'high' | 'critical'
 * - type: AlertType
 * - limit: number (default: 50)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const unacknowledgedOnly = searchParams.get('unacknowledged') !== 'false';
    const priority = searchParams.get('priority') as AlertPriority | undefined;
    const type = searchParams.get('type') as AlertType | undefined;
    const limit = parseInt(searchParams.get('limit') || '50');

    const portfolio = getPortfolioManager();
    await portfolio.initialize();

    const alerts = portfolio.getAlerts({
      unacknowledgedOnly,
      priority,
      limit,
    });

    // Filter by type if specified
    const filtered = type
      ? alerts.filter(a => a.type === type)
      : alerts;

    // Group by priority
    const byPriority = {
      critical: filtered.filter(a => a.priority === 'critical'),
      high: filtered.filter(a => a.priority === 'high'),
      medium: filtered.filter(a => a.priority === 'medium'),
      low: filtered.filter(a => a.priority === 'low'),
    };

    // Transform alerts to match frontend expectations (timestamp instead of createdAt)
    const formattedAlerts = filtered.map(alert => ({
      id: alert.id,
      type: alert.type,
      priority: alert.priority,
      title: alert.title,
      message: alert.message,
      timestamp: alert.createdAt.toISOString(),
      acknowledged: alert.acknowledged,
      data: alert.data,
    }));

    return NextResponse.json({
      success: true,
      data: {
        alerts: formattedAlerts,
        summary: {
          total: filtered.length,
          byPriority: {
            critical: byPriority.critical.length,
            high: byPriority.high.length,
            medium: byPriority.medium.length,
            low: byPriority.low.length,
          },
        },
      },
      meta: {
        filters: {
          unacknowledgedOnly,
          priority,
          type,
          limit,
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[API v2/portfolio/alerts] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v2/portfolio/alerts/acknowledge
 *
 * Acknowledge an alert.
 *
 * Body:
 * - alertId: string (required)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { alertId } = body;

    if (!alertId) {
      return NextResponse.json(
        { success: false, error: 'alertId is required' },
        { status: 400 }
      );
    }

    const portfolio = getPortfolioManager();
    const acknowledged = portfolio.acknowledgeAlert(alertId);

    if (!acknowledged) {
      return NextResponse.json(
        { success: false, error: 'Alert not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        alertId,
        acknowledged: true,
        acknowledgedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[API v2/portfolio/alerts] Acknowledge error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
