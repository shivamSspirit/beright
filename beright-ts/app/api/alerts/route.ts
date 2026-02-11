/**
 * Alerts API Route
 * GET /api/alerts - Get user's alerts
 * POST /api/alerts - Create a new alert
 * DELETE /api/alerts - Delete an alert
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAlert, getUserAlerts, triggerAlert } from '../../../lib/db';
import { scanAll as scanArbitrage } from '../../../skills/arbitrage';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const type = searchParams.get('type') as 'arbitrage' | 'whale' | 'price' | 'resolution' | null;
    const scan = searchParams.get('scan') === 'true'; // Trigger a fresh scan

    // If scan is requested, do a fresh arbitrage scan
    if (scan && type === 'arbitrage') {
      const opportunities = await scanArbitrage();
      return NextResponse.json({
        type: 'arbitrage',
        count: opportunities.length,
        alerts: opportunities.slice(0, 10).map(opp => ({
          topic: opp.topic,
          platformA: opp.platformA,
          platformB: opp.platformB,
          priceA: opp.priceAYes,
          priceB: opp.priceBYes,
          spread: opp.spread,
          spreadPct: (opp.spread * 100).toFixed(1) + '%',
          profitPercent: opp.profitPercent,
          strategy: opp.strategy,
          confidence: opp.matchConfidence,
          volumeA: opp.volumeA,
          volumeB: opp.volumeB,
        })),
      });
    }

    // Check if we have database configured
    const hasDb = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY;

    if (hasDb && userId) {
      // Use database
      const alerts = await getUserAlerts(userId);
      const filtered = type ? alerts.filter(a => a.type === type) : alerts;

      return NextResponse.json({
        count: filtered.length,
        alerts: filtered,
      });
    } else {
      // Return empty for local mode (alerts require DB)
      return NextResponse.json({
        count: 0,
        alerts: [],
        note: 'Alerts require Supabase connection. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.',
      });
    }
  } catch (error) {
    console.error('Alerts GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alerts', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: any = await request.json();
    const {
      userId,
      type,
      marketId,
      condition,
      expiresAt,
    } = body;

    // Validate required fields
    if (!userId || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, type' },
        { status: 400 }
      );
    }

    if (!['arbitrage', 'whale', 'price', 'resolution'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid alert type. Must be: arbitrage, whale, price, or resolution' },
        { status: 400 }
      );
    }

    // Check if we have database configured
    const hasDb = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY;

    if (!hasDb) {
      return NextResponse.json(
        { error: 'Alerts require Supabase connection. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.' },
        { status: 503 }
      );
    }

    // Create alert
    const alert = await createAlert(userId, {
      type,
      market_id: marketId,
      condition: condition || {},
      expires_at: expiresAt,
    });

    return NextResponse.json({
      success: true,
      alert,
    }, { status: 201 });
  } catch (error) {
    console.error('Alerts POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create alert', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const alertId = searchParams.get('alertId');

    if (!alertId) {
      return NextResponse.json(
        { error: 'Missing alertId parameter' },
        { status: 400 }
      );
    }

    // Check if we have database configured
    const hasDb = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY;

    if (!hasDb) {
      return NextResponse.json(
        { error: 'Alerts require Supabase connection' },
        { status: 503 }
      );
    }

    // For now, we'll just mark it as triggered (soft delete)
    const alert = await triggerAlert(alertId);

    return NextResponse.json({
      success: true,
      alert,
    });
  } catch (error) {
    console.error('Alerts DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete alert', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
