/**
 * Volume Spike Detector
 *
 * Detects unusual trading volume in markets.
 *
 * @author BeRight Protocol
 */

import {
  SignalDetector,
  VolumeSpikeSignal,
  Signal,
  generateSignalId,
  getSignalEmoji,
  getUrgencyFromConfidence,
  getSignalTTL,
} from '../types';
import { getDataFabric } from '../../dataFabric';
import { UnifiedMarket } from '../../dataFabric/types';

// Historical volume tracking (in-memory for now)
const volumeHistory: Map<string, { volumes: number[]; lastUpdate: Date }> = new Map();

const SPIKE_THRESHOLD = 2.0;  // 2x average = spike
const MIN_VOLUME = 1000;      // Minimum $1K volume to consider
const HISTORY_SIZE = 24;      // Keep 24 data points
const MAX_SIGNALS = 10;

/**
 * Update volume history for a market
 */
function updateHistory(marketId: string, volume: number): void {
  const existing = volumeHistory.get(marketId);

  if (existing) {
    existing.volumes.push(volume);
    if (existing.volumes.length > HISTORY_SIZE) {
      existing.volumes.shift();
    }
    existing.lastUpdate = new Date();
  } else {
    volumeHistory.set(marketId, {
      volumes: [volume],
      lastUpdate: new Date(),
    });
  }
}

/**
 * Calculate average volume for a market
 */
function getAverageVolume(marketId: string): number | null {
  const history = volumeHistory.get(marketId);
  if (!history || history.volumes.length < 3) return null;

  const sum = history.volumes.reduce((a, b) => a + b, 0);
  return sum / history.volumes.length;
}

/**
 * Detect volume spikes
 */
function detectSpike(market: UnifiedMarket): VolumeSpikeSignal | null {
  const volume = market.totalVolume24h || market.totalVolume;
  if (volume < MIN_VOLUME) return null;

  // Update history
  updateHistory(market.id, volume);

  // Get average
  const avgVolume = getAverageVolume(market.id);
  if (!avgVolume) return null;

  // Calculate spike multiplier
  const spikeMultiplier = volume / avgVolume;
  if (spikeMultiplier < SPIKE_THRESHOLD) return null;

  // We have a spike!
  const primaryPlatform = market.platforms[0];
  if (!primaryPlatform) return null;

  // Calculate confidence
  const confidence = Math.min((spikeMultiplier - 1) / 5, 1); // Max at 6x spike

  // Estimate price change (would need historical data for accuracy)
  const priceChange = 0; // Placeholder

  const signal: VolumeSpikeSignal = {
    id: generateSignalId('VOLUME_SPIKE', market.id, 'internal'),
    type: 'VOLUME_SPIKE',
    source: 'internal',
    timestamp: new Date(),
    expiresAt: new Date(Date.now() + getSignalTTL('VOLUME_SPIKE')),
    confidence,
    urgency: getUrgencyFromConfidence(confidence),
    title: `${spikeMultiplier.toFixed(1)}x Volume: ${market.question.slice(0, 40)}...`,
    description: `Volume spiked to $${(volume / 1000).toFixed(0)}K (${spikeMultiplier.toFixed(1)}x average)`,
    emoji: getSignalEmoji('VOLUME_SPIKE'),
    market: {
      id: market.id,
      question: market.question,
      platform: primaryPlatform.platform,
      url: primaryPlatform.url,
      currentPrice: market.consensusPrice,
    },
    data: {
      platform: primaryPlatform.platform,
      currentVolume: volume,
      avgVolume,
      spikeMultiplier,
      timeWindowMinutes: 60, // Hourly comparison
      priceChange,
    },
  };

  return signal;
}

export const volumeDetector: SignalDetector = {
  name: 'volume',
  signalTypes: ['VOLUME_SPIKE'],
  enabled: true,

  async detect(): Promise<Signal[]> {
    try {
      const fabric = getDataFabric();
      const result = await fabric.getMarkets({
        limit: 100,
        sortBy: 'volume',
        sortOrder: 'desc',
        minVolume: MIN_VOLUME,
      });

      const signals: VolumeSpikeSignal[] = [];

      for (const market of result.markets) {
        const signal = detectSpike(market);
        if (signal) {
          signals.push(signal);
        }

        if (signals.length >= MAX_SIGNALS) break;
      }

      // Sort by spike multiplier
      signals.sort((a, b) => b.data.spikeMultiplier - a.data.spikeMultiplier);

      console.log(`[VolumeDetector] Found ${signals.length} volume spikes`);
      return signals;
    } catch (error) {
      console.error('[VolumeDetector] Error:', error);
      return [];
    }
  },

  async isHealthy(): Promise<boolean> {
    return true; // Always healthy (uses internal data)
  },
};

export default volumeDetector;
