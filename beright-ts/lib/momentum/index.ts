/**
 * Momentum Score Engine
 *
 * AIXBT-style momentum scoring for prediction markets.
 * Calculates a 0-100 composite score per market based on:
 *   - Signal velocity (30%)
 *   - Volume trend (25%)
 *   - Smart money activity (25%)
 *   - Arbitrage activity (10%)
 *   - Social mentions (10%)
 *   × Resolution proximity multiplier
 *
 * Usage:
 *   // Update single market
 *   await updateMarketMomentum(marketId, platform, { volume24h, endDate });
 *
 *   // Bulk update (orchestrator step)
 *   const count = await runMomentumUpdate();
 *
 *   // Get ranked markets
 *   const hot = await getHotMarkets(20);
 */

import { supabaseAdmin, isSupabaseConfigured } from '../supabase/client';
import { getHotMarkets as fetchHotMarkets } from '../markets';
import {
  MomentumScore,
  MomentumRecord,
  MarketWithMomentum,
  MomentumHistoryEntry,
  DEFAULT_MOMENTUM_CONFIG,
} from './types';
import {
  calculateAllComponents,
  calculateCompositeScore,
} from './components';
import {
  appendToHistory,
  parseHistory,
  getWaveformData,
  calculateTrend,
  detectBreakout,
} from './waveform';

const config = DEFAULT_MOMENTUM_CONFIG;

/**
 * Update momentum score for a single market
 */
export async function updateMarketMomentum(
  marketId: string,
  marketTitle: string,
  platform: string,
  options?: {
    volume24h?: number;
    currentPrice?: number;
    endDate?: Date | string | null;
  }
): Promise<MomentumScore | null> {
  if (!isSupabaseConfigured) return null;

  try {
    // Calculate all components
    const { components, multipliers } = await calculateAllComponents(
      marketId,
      platform,
      options?.volume24h,
      options?.endDate
    );

    // Calculate composite score
    const momentumScore = calculateCompositeScore(components, multipliers);
    const isHot = momentumScore >= config.hotThreshold;

    // Check for breakout
    const { data: existing } = await supabaseAdmin
      .from('market_momentum')
      .select('momentum_history')
      .eq('market_id', marketId)
      .eq('platform', platform)
      .single();

    const existingHistory = parseHistory(existing?.momentum_history);
    const isBreakout = detectBreakout(momentumScore, existingHistory);

    // Update history with today's score
    const updatedHistory = appendToHistory(existingHistory, {
      score: momentumScore,
      components,
    });

    // Upsert to database
    const { error } = await supabaseAdmin
      .from('market_momentum')
      .upsert({
        market_id: marketId,
        market_title: marketTitle,
        platform,
        momentum_score: momentumScore,
        is_hot: isHot,
        signal_velocity: components.signalVelocity,
        volume_trend: components.volumeTrend,
        smart_money_score: components.smartMoneyScore,
        arb_activity: components.arbActivity,
        social_score: components.socialScore,
        resolution_multiplier: multipliers.resolutionMultiplier,
        current_price: options?.currentPrice,
        volume_24h: options?.volume24h,
        end_date: options?.endDate,
        momentum_history: updatedHistory,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'market_id,platform',
      });

    if (error) {
      console.warn('[Momentum] Failed to update:', marketId, error.message);
      return null;
    }

    // If breakout detected, could emit signal here (Phase 2)
    if (isBreakout) {
      console.log(`[Momentum] Breakout detected: ${marketTitle} (${momentumScore})`);
    }

    return {
      marketId,
      marketTitle,
      platform,
      momentumScore,
      isHot,
      components,
      multipliers,
      currentPrice: options?.currentPrice,
      volume24h: options?.volume24h,
      endDate: options?.endDate ? new Date(options.endDate) : undefined,
      updatedAt: new Date(),
    };
  } catch (err) {
    console.warn('[Momentum] Update failed:', marketId, err);
    return null;
  }
}

/**
 * Bulk update momentum for all active markets
 *
 * Called by orchestrator every 5 minutes.
 * Returns count of markets updated.
 */
export async function runMomentumUpdate(): Promise<number> {
  console.log('[Momentum] Running bulk momentum update...');
  const startTime = Date.now();

  try {
    // Fetch hot markets from all platforms
    const markets = await fetchHotMarkets(100, ['polymarket', 'kalshi', 'manifold', 'limitless']);

    if (markets.length === 0) {
      console.log('[Momentum] No markets to update');
      return 0;
    }

    // Update each market's momentum (parallel with rate limiting)
    const BATCH_SIZE = 10;
    let updated = 0;

    for (let i = 0; i < markets.length; i += BATCH_SIZE) {
      const batch = markets
        .slice(i, i + BATCH_SIZE)
        .filter((m) => m.marketId && m.title && m.platform);

      const results = await Promise.allSettled(
        batch.map((m) =>
          updateMarketMomentum(m.marketId!, m.title!, m.platform, {
            volume24h: m.volume24h || m.volume,
            currentPrice: m.yesPrice,
            endDate: m.endDate,
          })
        )
      );

      updated += results.filter((r) => r.status === 'fulfilled' && r.value).length;
    }

    console.log(`[Momentum] Updated ${updated}/${markets.length} markets in ${Date.now() - startTime}ms`);
    return updated;
  } catch (err) {
    console.error('[Momentum] Bulk update failed:', err);
    return 0;
  }
}

/**
 * Get ranked markets by momentum score
 */
export async function getRankedMarkets(options?: {
  limit?: number;
  hotOnly?: boolean;
  platform?: string;
}): Promise<MarketWithMomentum[]> {
  if (!isSupabaseConfigured) return [];

  try {
    let query = supabaseAdmin
      .from('market_momentum')
      .select('*')
      .order('momentum_score', { ascending: false })
      .limit(options?.limit || 50);

    if (options?.hotOnly) {
      query = query.eq('is_hot', true);
    }

    if (options?.platform) {
      query = query.eq('platform', options.platform);
    }

    const { data, error } = await query;

    if (error || !data) return [];

    return data.map((row: any) => ({
      marketId: row.market_id,
      marketTitle: row.market_title,
      platform: row.platform,
      momentumScore: row.momentum_score,
      isHot: row.is_hot,
      currentPrice: row.current_price,
      volume24h: row.volume_24h,
      endDate: row.end_date,
      updatedAt: row.updated_at,
      breakdown: {
        signalVelocity: row.signal_velocity,
        volumeTrend: row.volume_trend,
        smartMoneyScore: row.smart_money_score,
        arbActivity: row.arb_activity,
        socialScore: row.social_score,
        resolutionMultiplier: row.resolution_multiplier,
      },
    }));
  } catch (err) {
    console.warn('[Momentum] Failed to get ranked markets:', err);
    return [];
  }
}

/**
 * Get hot markets (momentum > 70)
 */
export async function getHotMarkets(limit: number = 20): Promise<MarketWithMomentum[]> {
  return getRankedMarkets({ limit, hotOnly: true });
}

/**
 * Get momentum details for a specific market
 */
export async function getMarketMomentum(
  marketId: string,
  platform: string
): Promise<MarketWithMomentum | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabaseAdmin
      .from('market_momentum')
      .select('*')
      .eq('market_id', marketId)
      .eq('platform', platform)
      .single();

    if (error || !data) return null;

    const history = parseHistory(data.momentum_history);

    return {
      marketId: data.market_id,
      marketTitle: data.market_title,
      platform: data.platform,
      momentumScore: data.momentum_score,
      isHot: data.is_hot,
      currentPrice: data.current_price,
      volume24h: data.volume_24h,
      endDate: data.end_date,
      updatedAt: data.updated_at,
      breakdown: {
        signalVelocity: data.signal_velocity,
        volumeTrend: data.volume_trend,
        smartMoneyScore: data.smart_money_score,
        arbActivity: data.arb_activity,
        socialScore: data.social_score,
        resolutionMultiplier: data.resolution_multiplier,
      },
      waveform: getWaveformData(history, 30),
    };
  } catch (err) {
    console.warn('[Momentum] Failed to get market momentum:', err);
    return null;
  }
}

/**
 * Get momentum waveform history for charts
 */
export async function getMarketWaveform(
  marketId: string,
  platform: string,
  days: 30 | 90 = 30
): Promise<Array<{ date: string; score: number }>> {
  if (!isSupabaseConfigured) return [];

  try {
    const { data, error } = await supabaseAdmin
      .from('market_momentum')
      .select('momentum_history')
      .eq('market_id', marketId)
      .eq('platform', platform)
      .single();

    if (error || !data) return [];

    const history = parseHistory(data.momentum_history);
    return getWaveformData(history, days);
  } catch (err) {
    return [];
  }
}

/**
 * Format momentum for Telegram display
 */
export function formatMomentumReport(markets: MarketWithMomentum[]): string {
  if (markets.length === 0) {
    return '*No hot markets detected*\n\nMarkets are quiet right now.';
  }

  let text = '*🔥 HOT MARKETS BY MOMENTUM*\n';
  text += '─'.repeat(32) + '\n\n';

  for (let i = 0; i < Math.min(markets.length, 10); i++) {
    const m = markets[i];
    const trend = m.breakdown?.signalVelocity && m.breakdown.signalVelocity > 0.5
      ? '📈'
      : m.breakdown?.signalVelocity && m.breakdown.signalVelocity < 0.2
      ? '📉'
      : '➡️';

    text += `${i + 1}. ${trend} *${m.marketTitle.slice(0, 40)}*\n`;
    text += `   📊 Momentum: ${m.momentumScore.toFixed(1)} `;
    text += m.isHot ? '🔥' : '';
    text += `\n   💰 ${m.platform} | `;
    text += m.currentPrice ? `${(m.currentPrice * 100).toFixed(0)}%` : 'N/A';
    text += '\n\n';
  }

  text += `_Updated: ${new Date().toLocaleTimeString()}_`;
  return text;
}

/**
 * Format single market momentum detail
 */
export function formatMarketMomentumDetail(m: MarketWithMomentum): string {
  let text = `*${m.marketTitle}*\n`;
  text += '─'.repeat(32) + '\n\n';

  text += `📊 *Momentum Score: ${m.momentumScore.toFixed(1)}*`;
  text += m.isHot ? ' 🔥 HOT\n' : '\n';

  text += '\n*Component Breakdown:*\n';

  if (m.breakdown) {
    const b = m.breakdown;
    text += `├ Signal Velocity: ${(b.signalVelocity * 100).toFixed(0)}%\n`;
    text += `├ Volume Trend: ${(b.volumeTrend * 100).toFixed(0)}%\n`;
    text += `├ Smart Money: ${(b.smartMoneyScore * 100).toFixed(0)}%\n`;
    text += `├ Arb Activity: ${(b.arbActivity * 100).toFixed(0)}%\n`;
    text += `├ Social Score: ${(b.socialScore * 100).toFixed(0)}%\n`;
    text += `└ Resolution Boost: ${b.resolutionMultiplier.toFixed(2)}x\n`;
  }

  text += `\n*Market Info:*\n`;
  text += `├ Platform: ${m.platform}\n`;
  text += `├ Price: ${m.currentPrice ? (m.currentPrice * 100).toFixed(1) + '%' : 'N/A'}\n`;
  text += `├ Volume 24h: $${m.volume24h ? m.volume24h.toLocaleString() : 'N/A'}\n`;
  text += `└ End Date: ${m.endDate ? new Date(m.endDate).toLocaleDateString() : 'N/A'}\n`;

  text += `\n_Last updated: ${new Date(m.updatedAt).toLocaleTimeString()}_`;

  return text;
}

// Re-export types
export * from './types';
export * from './components';
export * from './waveform';
