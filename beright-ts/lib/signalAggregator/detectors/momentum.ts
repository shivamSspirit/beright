/**
 * Momentum Detector
 *
 * Detects strong directional price moves in prediction markets.
 * Tracks price history and identifies significant momentum.
 *
 * @author BeRight Protocol
 */

import {
  SignalDetector,
  MomentumSignal,
  Signal,
  generateSignalId,
  getSignalEmoji,
  getUrgencyFromConfidence,
  getSignalTTL,
} from '../types';
import { getDataFabric } from '../../dataFabric';
import { UnifiedMarket } from '../../dataFabric/types';

// Price history tracking (in-memory)
interface PricePoint {
  price: number;
  timestamp: Date;
}

const priceHistory: Map<string, PricePoint[]> = new Map();

// Momentum thresholds
const MOMENTUM_THRESHOLD = 0.05;       // 5% move = momentum
const STRONG_MOMENTUM_THRESHOLD = 0.10; // 10% move = strong
const HISTORY_HOURS = 24;              // Track 24h of history
const SAMPLE_INTERVAL_MS = 15 * 60 * 1000; // Sample every 15 min
const MAX_SIGNALS = 10;

/**
 * Update price history for a market
 */
function updatePriceHistory(marketId: string, price: number): void {
  const now = new Date();
  const history = priceHistory.get(marketId) || [];

  // Add new point if enough time has passed
  const lastPoint = history[history.length - 1];
  if (!lastPoint || (now.getTime() - lastPoint.timestamp.getTime()) >= SAMPLE_INTERVAL_MS) {
    history.push({ price, timestamp: now });
  }

  // Trim old points
  const cutoff = new Date(now.getTime() - HISTORY_HOURS * 60 * 60 * 1000);
  const trimmed = history.filter(p => p.timestamp > cutoff);

  priceHistory.set(marketId, trimmed);
}

/**
 * Get historical prices at specific intervals
 */
function getHistoricalPrices(marketId: string): {
  price1hAgo: number | null;
  price24hAgo: number | null;
} {
  const history = priceHistory.get(marketId);
  if (!history || history.length < 2) {
    return { price1hAgo: null, price24hAgo: null };
  }

  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

  // Find closest point to 1h ago
  let price1hAgo: number | null = null;
  let closestTo1h = Infinity;
  for (const point of history) {
    const diff = Math.abs(point.timestamp.getTime() - oneHourAgo);
    if (diff < closestTo1h && diff < 30 * 60 * 1000) { // Within 30 min
      closestTo1h = diff;
      price1hAgo = point.price;
    }
  }

  // Find closest point to 24h ago
  let price24hAgo: number | null = null;
  let closestTo24h = Infinity;
  for (const point of history) {
    const diff = Math.abs(point.timestamp.getTime() - twentyFourHoursAgo);
    if (diff < closestTo24h && diff < 2 * 60 * 60 * 1000) { // Within 2 hours
      closestTo24h = diff;
      price24hAgo = point.price;
    }
  }

  return { price1hAgo, price24hAgo };
}

/**
 * Detect momentum for a market
 */
function detectMomentum(market: UnifiedMarket): MomentumSignal | null {
  const currentPrice = market.consensusPrice;
  const marketId = market.id;

  // Update history
  updatePriceHistory(marketId, currentPrice);

  // Get historical prices
  const { price1hAgo, price24hAgo } = getHistoricalPrices(marketId);

  // Calculate changes
  const change1h = price1hAgo !== null ? currentPrice - price1hAgo : 0;
  const change24h = price24hAgo !== null ? currentPrice - price24hAgo : 0;

  // Check if momentum threshold met
  const absChange1h = Math.abs(change1h);
  const absChange24h = Math.abs(change24h);

  if (absChange1h < MOMENTUM_THRESHOLD && absChange24h < MOMENTUM_THRESHOLD) {
    return null;
  }

  // Determine momentum strength and direction
  const primaryChange = absChange1h >= absChange24h ? change1h : change24h;
  const direction = primaryChange > 0 ? 'up' : 'down';
  const maxChange = Math.max(absChange1h, absChange24h);
  const strength = maxChange >= STRONG_MOMENTUM_THRESHOLD ? 'strong' :
                   maxChange >= MOMENTUM_THRESHOLD ? 'moderate' : 'weak';

  // Calculate confidence
  const volumeScore = Math.min((market.totalVolume24h || 0) / 50000, 1);
  const changeScore = Math.min(maxChange / 0.15, 1);
  const confidence = (volumeScore * 0.4) + (changeScore * 0.6);

  const primaryPlatform = market.platforms[0];
  if (!primaryPlatform) return null;

  const signal: MomentumSignal = {
    id: generateSignalId('PRICE_MOMENTUM', marketId, 'internal'),
    type: 'PRICE_MOMENTUM',
    source: 'internal',
    timestamp: new Date(),
    expiresAt: new Date(Date.now() + getSignalTTL('PRICE_MOMENTUM')),
    confidence,
    urgency: getUrgencyFromConfidence(confidence),
    title: `${direction === 'up' ? '🚀' : '📉'} ${(maxChange * 100).toFixed(0)}% ${direction}: ${market.question.slice(0, 35)}...`,
    description: `Price moved from ${((currentPrice - primaryChange) * 100).toFixed(0)}% to ${(currentPrice * 100).toFixed(0)}% (${strength} momentum)`,
    emoji: getSignalEmoji('PRICE_MOMENTUM'),
    market: {
      id: marketId,
      question: market.question,
      platform: primaryPlatform.platform,
      url: primaryPlatform.url,
      currentPrice,
    },
    data: {
      platform: primaryPlatform.platform,
      priceNow: currentPrice,
      price1hAgo: price1hAgo || currentPrice,
      price24hAgo: price24hAgo || currentPrice,
      change1h,
      change24h,
      direction,
      strength,
    },
    suggestedAction: strength !== 'weak' ? {
      direction: direction === 'up' ? 'YES' : 'NO',
      size: strength === 'strong' ? 'medium' : 'small',
      reasoning: `${strength.charAt(0).toUpperCase() + strength.slice(1)} ${direction}ward momentum detected`,
    } : undefined,
  };

  return signal;
}

export const momentumDetector: SignalDetector = {
  name: 'momentum',
  signalTypes: ['PRICE_MOMENTUM'],
  enabled: true,

  async detect(): Promise<Signal[]> {
    try {
      const fabric = getDataFabric();
      const result = await fabric.getMarkets({
        limit: 50,
        sortBy: 'volume',
        sortOrder: 'desc',
        minVolume: 1000,
      });

      const signals: MomentumSignal[] = [];

      for (const market of result.markets) {
        const signal = detectMomentum(market);
        if (signal) {
          signals.push(signal);
        }

        if (signals.length >= MAX_SIGNALS) break;
      }

      // Sort by change magnitude
      signals.sort((a, b) => {
        const aMax = Math.max(Math.abs(a.data.change1h), Math.abs(a.data.change24h));
        const bMax = Math.max(Math.abs(b.data.change1h), Math.abs(b.data.change24h));
        return bMax - aMax;
      });

      console.log(`[MomentumDetector] Found ${signals.length} momentum signals`);
      return signals;
    } catch (error) {
      console.error('[MomentumDetector] Error:', error);
      return [];
    }
  },

  async isHealthy(): Promise<boolean> {
    return true;
  },
};

export default momentumDetector;
