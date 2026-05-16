/**
 * API: GET /api/markets/momentum
 *
 * Returns momentum details for a specific market.
 *
 * Query params:
 *   - marketId: string (required)
 *   - platform: string (required)
 *   - days: 30 | 90 (default: 30) - waveform history days
 *
 * Response:
 *   {
 *     market: MarketWithMomentum | null,
 *     waveform: { date: string, score: number }[]
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMarketMomentum, getMarketWaveform } from '../../../../lib/momentum';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const marketId = searchParams.get('marketId');
    const platform = searchParams.get('platform');
    const days = (parseInt(searchParams.get('days') || '30', 10) === 90 ? 90 : 30) as 30 | 90;

    if (!marketId || !platform) {
      return NextResponse.json(
        { error: 'marketId and platform are required' },
        { status: 400 }
      );
    }

    const [market, waveform] = await Promise.all([
      getMarketMomentum(marketId, platform),
      getMarketWaveform(marketId, platform, days),
    ]);

    if (!market) {
      return NextResponse.json(
        { error: 'Market momentum not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      market,
      waveform,
    });
  } catch (error) {
    console.error('[API] /api/markets/momentum error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market momentum' },
      { status: 500 }
    );
  }
}
