/**
 * Forecasters API
 * GET /api/forecasters          → top forecasters leaderboard
 * GET /api/forecasters?id=123   → specific forecaster by telegram_id
 * GET /api/forecasters?wallet=0x → forecaster by wallet address
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTopForecasters, getForecasterProfile } from '../../../lib/reputation';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const telegramId = searchParams.get('id');
  const domain = searchParams.get('domain') as any;
  const limit = parseInt(searchParams.get('limit') || '10');

  // Single forecaster by telegram ID
  if (telegramId) {
    const profile = await getForecasterProfile(parseInt(telegramId));
    if (!profile) {
      return NextResponse.json({ error: 'Forecaster not found' }, { status: 404 });
    }
    return NextResponse.json({ forecaster: profile });
  }

  // Top forecasters leaderboard
  const forecasters = await getTopForecasters({
    limit,
    domain,
    minPredictions: 3,
  });

  return NextResponse.json({
    forecasters,
    total: forecasters.length,
    domain: domain || 'overall',
  });
}
