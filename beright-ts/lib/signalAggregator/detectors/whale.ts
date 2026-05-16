/**
 * Whale Detector
 *
 * Detects large trades on prediction markets using DFlow trade data.
 * Monitors for significant position changes that may signal alpha.
 *
 * @author BeRight Protocol
 */

import {
  SignalDetector,
  WhaleSignal,
  Signal,
  generateSignalId,
  getSignalEmoji,
  getUrgencyFromConfidence,
  getSignalTTL,
} from '../types';
import { getDFlowClient, getDFlowTrades, DFlowTrade } from '../../dflow';
import { getDataFabric } from '../../dataFabric';

// Whale thresholds
const WHALE_THRESHOLD_USD = 5000;     // $5K+ = whale bet
const MEGA_WHALE_THRESHOLD = 25000;   // $25K+ = mega whale
const MAX_SIGNALS = 10;
const LOOKBACK_MINUTES = 30;          // Look at trades from last 30 min

// Known whale wallets (add more as discovered)
const KNOWN_WHALES: Record<string, { label: string; accuracy?: number }> = {
  // Add known addresses here
  // 'abc123...': { label: 'Polymarket Pro', accuracy: 0.72 },
};

/**
 * Estimate USD value of a trade
 * DFlow prices are in cents (0-100), count is number of contracts
 */
function estimateTradeValue(trade: DFlowTrade): number {
  // Each contract pays $1 if correct, price is probability
  // Cost = price * count (in dollars)
  const priceInDollars = trade.yesPrice / 100;
  return priceInDollars * trade.count;
}

/**
 * Detect whale trades for a specific market
 */
async function detectWhalesForMarket(
  ticker: string,
  marketTitle: string
): Promise<WhaleSignal[]> {
  try {
    const trades = await getDFlowTrades(ticker, 100);
    if (!trades.length) return [];

    const signals: WhaleSignal[] = [];
    const cutoffTime = Date.now() - (LOOKBACK_MINUTES * 60 * 1000);

    // Group by approximate "session" to detect coordinated trades
    const recentTrades = trades.filter(t => t.createdTime * 1000 > cutoffTime);

    for (const trade of recentTrades) {
      const value = estimateTradeValue(trade);

      if (value < WHALE_THRESHOLD_USD) continue;

      const isMegaWhale = value >= MEGA_WHALE_THRESHOLD;
      const direction = trade.takerSide === 'yes' ? 'YES' : 'NO';

      // Check if known whale
      const knownWhale = KNOWN_WHALES[trade.tradeId]; // Would need wallet from enhanced API
      const walletLabel = knownWhale?.label || (isMegaWhale ? 'Mega Whale' : 'Whale');
      const historicalAccuracy = knownWhale?.accuracy;

      // Calculate confidence
      let confidence = 0.5;
      if (isMegaWhale) confidence += 0.2;
      if (historicalAccuracy && historicalAccuracy > 0.6) confidence += 0.15;
      confidence = Math.min(confidence, 0.95);

      const signal: WhaleSignal = {
        id: generateSignalId('WHALE_BET', ticker, 'internal'),
        type: 'WHALE_BET',
        source: 'internal',
        timestamp: new Date(trade.createdTime * 1000),
        expiresAt: new Date(Date.now() + getSignalTTL('WHALE_BET')),
        confidence,
        urgency: getUrgencyFromConfidence(confidence),
        title: `${isMegaWhale ? '🐋' : '🐳'} $${(value / 1000).toFixed(1)}K ${direction} on ${marketTitle.slice(0, 30)}...`,
        description: `${walletLabel} bought $${value.toFixed(0)} of ${direction} at ${(trade.yesPrice / 100 * 100).toFixed(0)}¢`,
        emoji: getSignalEmoji('WHALE_BET'),
        market: {
          id: ticker,
          question: marketTitle,
          platform: 'kalshi', // DFlow routes to Kalshi
          currentPrice: trade.yesPrice / 100,
        },
        data: {
          wallet: trade.tradeId.slice(0, 8) + '...', // Placeholder
          walletLabel,
          amount: value,
          direction,
          platform: 'kalshi', // DFlow routes to Kalshi
          txHash: trade.tradeId,
          historicalAccuracy,
          isSmartMoney: !!knownWhale || isMegaWhale,
        },
        suggestedAction: {
          direction,
          size: isMegaWhale ? 'medium' : 'small',
          reasoning: `${walletLabel} bet $${value.toFixed(0)} on ${direction}${historicalAccuracy ? ` (${(historicalAccuracy * 100).toFixed(0)}% historical accuracy)` : ''}`,
        },
      };

      signals.push(signal);
    }

    return signals;
  } catch (error) {
    console.error(`[WhaleDetector] Error for ${ticker}:`, error);
    return [];
  }
}

/**
 * Timeout wrapper for async operations
 */
async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  const timeout = new Promise<T>((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), ms)
  );
  try {
    return await Promise.race([promise, timeout]);
  } catch {
    return fallback;
  }
}

export const whaleDetector: SignalDetector = {
  name: 'whale',
  signalTypes: ['WHALE_BET', 'SMART_MONEY'],
  enabled: true,

  async detect(): Promise<Signal[]> {
    try {
      // Get hot markets to scan for whales (with 10s timeout)
      const client = getDFlowClient();
      const { events } = await withTimeout(
        client.getEvents({
          limit: 10, // Reduced to speed up
          status: 'active',
          sort: 'volume24h',
          order: 'desc',
          withNestedMarkets: true,
        }),
        10000, // 10 second timeout
        { events: [], cursor: null }
      );

      const allSignals: WhaleSignal[] = [];

      for (const event of events) {
        if (!event.markets?.length) continue;

        for (const market of event.markets) {
          if (market.status !== 'active') continue;

          const signals = await detectWhalesForMarket(market.ticker, market.title);
          allSignals.push(...signals);

          if (allSignals.length >= MAX_SIGNALS) break;
        }

        if (allSignals.length >= MAX_SIGNALS) break;
      }

      // Also check Polymarket/Kalshi via Data Fabric for cross-platform whale detection
      try {
        const fabric = getDataFabric();
        const { markets } = await fabric.getMarkets({
          limit: 10,
          sortBy: 'volume',
          sortOrder: 'desc',
        });

        // For each market with high recent volume, flag as potential whale activity
        for (const market of markets) {
          const volume24h = market.totalVolume24h || 0;
          const avgVolume = market.totalVolume / 30; // Rough daily average

          if (volume24h > avgVolume * 3 && volume24h > WHALE_THRESHOLD_USD * 2) {
            // High volume spike might indicate whale activity
            const primaryPlatform = market.platforms[0];
            if (!primaryPlatform) continue;

            const signal: WhaleSignal = {
              id: generateSignalId('WHALE_BET', market.id, 'internal'),
              type: 'WHALE_BET',
              source: 'internal',
              timestamp: new Date(),
              expiresAt: new Date(Date.now() + getSignalTTL('WHALE_BET')),
              confidence: 0.6,
              urgency: 'medium',
              title: `🐋 High activity: ${market.question.slice(0, 40)}...`,
              description: `$${(volume24h / 1000).toFixed(0)}K volume in 24h (3x+ normal)`,
              emoji: getSignalEmoji('WHALE_BET'),
              market: {
                id: market.id,
                question: market.question,
                platform: primaryPlatform.platform,
                url: primaryPlatform.url,
                currentPrice: market.consensusPrice,
              },
              data: {
                wallet: 'aggregate',
                amount: volume24h,
                direction: market.consensusPrice > 0.5 ? 'YES' : 'NO',
                platform: primaryPlatform.platform,
                isSmartMoney: false,
              },
            };

            allSignals.push(signal);

            if (allSignals.length >= MAX_SIGNALS) break;
          }
        }
      } catch (err) {
        // Data Fabric optional, continue with DFlow signals
      }

      // Sort by amount
      allSignals.sort((a, b) => b.data.amount - a.data.amount);

      console.log(`[WhaleDetector] Found ${allSignals.length} whale signals`);
      return allSignals.slice(0, MAX_SIGNALS);
    } catch (error) {
      console.error('[WhaleDetector] Error:', error);
      return [];
    }
  },

  async isHealthy(): Promise<boolean> {
    try {
      const client = getDFlowClient();
      await client.getEvents({ limit: 1 });
      return true;
    } catch {
      return false;
    }
  },
};

export default whaleDetector;
