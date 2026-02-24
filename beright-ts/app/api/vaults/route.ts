/**
 * Vaults API
 * GET /api/vaults                      → top signal channels
 * GET /api/vaults?slug=alpha-macro-123 → specific channel by slug
 * GET /api/vaults?forecaster=12345     → channel by forecaster telegram_id
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getTopChannels,
  getChannelBySlug,
  getChannelByForecaster,
  getChannelSignals,
} from '../../../lib/channels/client';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');
  const forecasterId = searchParams.get('forecaster');
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
  const withSignals = searchParams.get('signals') === 'true';

  // Single channel by slug
  if (slug) {
    const channel = await getChannelBySlug(slug);
    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }
    const signals = withSignals ? await getChannelSignals(channel.id, 20) : [];
    return NextResponse.json({ channel, signals });
  }

  // Single channel by forecaster telegram_id
  if (forecasterId) {
    const channel = await getChannelByForecaster(parseInt(forecasterId));
    if (!channel) {
      return NextResponse.json({ error: 'No active channel for this forecaster' }, { status: 404 });
    }
    const signals = withSignals ? await getChannelSignals(channel.id, 10) : [];
    return NextResponse.json({ channel, signals });
  }

  // Top channels leaderboard
  const channels = await getTopChannels(limit);
  return NextResponse.json({
    channels,
    total: channels.length,
    timestamp: new Date().toISOString(),
  });
}
