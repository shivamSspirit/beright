/**
 * Signals API
 * GET /api/signals          → recent signals
 * GET /api/signals?type=arb → filter by type
 * GET /api/signals?action=ALERT → filter by action
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRecentSignals } from '../../../lib/signals/index';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') as any;
  const action = searchParams.get('action') as 'ALERT' | 'WATCH' | undefined;
  const limit = parseInt(searchParams.get('limit') || '20');

  const signals = await getRecentSignals({ type, action, limit });

  return NextResponse.json({
    signals,
    total: signals.length,
    timestamp: new Date().toISOString(),
  });
}
