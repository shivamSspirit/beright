/**
 * Resolution Near Detector
 *
 * Detects markets that are closing soon with potential edge.
 *
 * @author BeRight Protocol
 */

import {
  SignalDetector,
  ResolutionNearSignal,
  Signal,
  generateSignalId,
  getSignalEmoji,
  getUrgencyFromConfidence,
  getSignalTTL,
} from '../types';
import { getDataFabric } from '../../dataFabric';

const HOURS_THRESHOLD = 48; // Markets closing within 48 hours
const MIN_VOLUME = 5000;    // $5K minimum volume
const MAX_SIGNALS = 10;

// Price extremes that might indicate edge
const EXTREME_THRESHOLD_LOW = 0.1;   // Below 10¢
const EXTREME_THRESHOLD_HIGH = 0.9;  // Above 90¢

export const resolutionDetector: SignalDetector = {
  name: 'resolution',
  signalTypes: ['RESOLUTION_NEAR'],
  enabled: true,

  async detect(): Promise<Signal[]> {
    try {
      const fabric = getDataFabric();
      const result = await fabric.getClosingSoon(HOURS_THRESHOLD);

      const signals: ResolutionNearSignal[] = [];

      for (const market of result.markets) {
        if (market.totalVolume < MIN_VOLUME) continue;
        if (!market.closeDate) continue;

        const hoursRemaining = (market.closeDate.getTime() - Date.now()) / (1000 * 60 * 60);
        if (hoursRemaining <= 0) continue;

        const price = market.consensusPrice;
        const primaryPlatform = market.platforms[0];
        if (!primaryPlatform) continue;

        // Determine expected resolution based on price
        let expectedResolution: 'YES' | 'NO' | 'UNCERTAIN' = 'UNCERTAIN';
        if (price >= EXTREME_THRESHOLD_HIGH) expectedResolution = 'YES';
        else if (price <= EXTREME_THRESHOLD_LOW) expectedResolution = 'NO';

        // Calculate confidence based on time remaining and price extremity
        const timeScore = 1 - (hoursRemaining / HOURS_THRESHOLD); // Higher as deadline approaches
        const priceExtremity = Math.abs(price - 0.5) * 2; // 0 at 50%, 1 at extremes
        const volumeScore = Math.min(market.totalVolume / 100000, 1);

        const confidence = (timeScore * 0.3) + (priceExtremity * 0.4) + (volumeScore * 0.3);

        // Determine urgency
        let urgency = getUrgencyFromConfidence(confidence);
        if (hoursRemaining < 6) urgency = 'critical';
        else if (hoursRemaining < 12) urgency = 'high';

        const signal: ResolutionNearSignal = {
          id: generateSignalId('RESOLUTION_NEAR', market.id, 'internal'),
          type: 'RESOLUTION_NEAR',
          source: 'internal',
          timestamp: new Date(),
          expiresAt: market.closeDate,
          confidence,
          urgency,
          title: `⏰ ${hoursRemaining.toFixed(0)}h: ${market.question.slice(0, 40)}...`,
          description: `Closing ${hoursRemaining < 24 ? 'TODAY' : 'SOON'} at ${(price * 100).toFixed(0)}¢ (${expectedResolution === 'UNCERTAIN' ? 'contested' : `leaning ${expectedResolution}`})`,
          emoji: getSignalEmoji('RESOLUTION_NEAR'),
          market: {
            id: market.id,
            question: market.question,
            platform: primaryPlatform.platform,
            url: primaryPlatform.url,
            currentPrice: price,
          },
          data: {
            closeDate: market.closeDate,
            hoursRemaining,
            currentPrice: price,
            expectedResolution,
            volume24h: market.totalVolume24h,
          },
          suggestedAction: expectedResolution !== 'UNCERTAIN' && priceExtremity > 0.3 ? {
            direction: expectedResolution,
            size: confidence > 0.7 ? 'medium' : 'small',
            reasoning: `Market ${hoursRemaining < 24 ? 'closes today' : 'closing soon'} with strong ${expectedResolution} lean`,
          } : undefined,
        };

        signals.push(signal);

        if (signals.length >= MAX_SIGNALS) break;
      }

      // Sort by hours remaining (most urgent first)
      signals.sort((a, b) => a.data.hoursRemaining - b.data.hoursRemaining);

      console.log(`[ResolutionDetector] Found ${signals.length} closing markets`);
      return signals;
    } catch (error) {
      console.error('[ResolutionDetector] Error:', error);
      return [];
    }
  },

  async isHealthy(): Promise<boolean> {
    return true;
  },
};

export default resolutionDetector;
