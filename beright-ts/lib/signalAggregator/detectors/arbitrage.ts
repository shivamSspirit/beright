/**
 * Arbitrage Detector
 *
 * Detects cross-platform price discrepancies using Data Fabric.
 *
 * @author BeRight Protocol
 */

import {
  SignalDetector,
  ArbSignal,
  Signal,
  generateSignalId,
  getSignalEmoji,
  getUrgencyFromConfidence,
  getSignalTTL,
} from '../types';
import { getDataFabric } from '../../dataFabric';

const MIN_SPREAD = 0.02; // 2% minimum spread
const MAX_SIGNALS = 10;

export const arbitrageDetector: SignalDetector = {
  name: 'arbitrage',
  signalTypes: ['ARB_OPPORTUNITY'],
  enabled: true,

  async detect(): Promise<Signal[]> {
    try {
      const fabric = getDataFabric();
      const result = await fabric.getArbitrageOpportunities(MIN_SPREAD);

      const signals: ArbSignal[] = [];

      for (const market of result.markets.slice(0, MAX_SIGNALS)) {
        if (!market.arbitragePlatforms) continue;

        const { buyPlatform, sellPlatform, spread, profitPct } = market.arbitragePlatforms;

        // Find platform data
        const buyData = market.platforms.find(p => p.platform === buyPlatform);
        const sellData = market.platforms.find(p => p.platform === sellPlatform);

        if (!buyData || !sellData) continue;

        // Calculate confidence based on volume and spread
        const volumeScore = Math.min(market.totalVolume / 100000, 1); // Max at $100K
        const spreadScore = Math.min(spread / 0.1, 1); // Max at 10% spread
        const confidence = (volumeScore * 0.4) + (spreadScore * 0.6);

        const signal: ArbSignal = {
          id: generateSignalId('ARB_OPPORTUNITY', market.id, 'internal'),
          type: 'ARB_OPPORTUNITY',
          source: 'internal',
          timestamp: new Date(),
          expiresAt: new Date(Date.now() + getSignalTTL('ARB_OPPORTUNITY')),
          confidence,
          urgency: getUrgencyFromConfidence(confidence),
          title: `${profitPct.toFixed(1)}% Arb: ${market.question.slice(0, 50)}...`,
          description: `Buy on ${buyPlatform} at ${(buyData.yesPrice * 100).toFixed(0)}¢, sell on ${sellPlatform} at ${(sellData.yesPrice * 100).toFixed(0)}¢`,
          emoji: getSignalEmoji('ARB_OPPORTUNITY'),
          market: {
            id: market.id,
            question: market.question,
            platform: buyPlatform,
            url: buyData.url,
            currentPrice: market.consensusPrice,
          },
          data: {
            buyPlatform,
            sellPlatform,
            buyPrice: buyData.yesPrice,
            sellPrice: sellData.yesPrice,
            spread,
            spreadPct: profitPct,
            estimatedProfit: profitPct, // For $100
            requiredCapital: 100,
            buyUrl: buyData.url,
            sellUrl: sellData.url,
          },
          suggestedAction: {
            direction: 'YES',
            size: profitPct > 5 ? 'large' : profitPct > 3 ? 'medium' : 'small',
            reasoning: `${profitPct.toFixed(1)}% risk-free spread between platforms`,
          },
        };

        signals.push(signal);
      }

      console.log(`[ArbDetector] Found ${signals.length} arbitrage opportunities`);
      return signals;
    } catch (error) {
      console.error('[ArbDetector] Error:', error);
      return [];
    }
  },

  async isHealthy(): Promise<boolean> {
    try {
      const fabric = getDataFabric();
      const health = await fabric.getHealthStatus();
      return health.healthy;
    } catch {
      return false;
    }
  },
};

export default arbitrageDetector;
