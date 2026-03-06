/**
 * Signal Detectors Registry
 *
 * Central registry for all signal detectors.
 *
 * @author BeRight Protocol
 */

import { SignalDetector, SignalType, Signal } from '../types';

import { arbitrageDetector } from './arbitrage';
import { volumeDetector } from './volume';
import { newsDetector } from './news';
import { resolutionDetector } from './resolution';
import { whaleDetector } from './whale';
import { momentumDetector } from './momentum';

// =============================================================================
// DETECTOR REGISTRY
// =============================================================================

/**
 * All available detectors
 */
export const detectors: SignalDetector[] = [
  arbitrageDetector,
  volumeDetector,
  newsDetector,
  resolutionDetector,
  whaleDetector,
  momentumDetector,
  // Future detectors:
  // socialDetector,     // Twitter/Reddit
  // mispricingDetector, // AI model vs market
];

/**
 * Get all enabled detectors
 */
export function getEnabledDetectors(): SignalDetector[] {
  return detectors.filter(d => d.enabled);
}

/**
 * Get detector by name
 */
export function getDetector(name: string): SignalDetector | undefined {
  return detectors.find(d => d.name === name);
}

/**
 * Get detectors by signal type
 */
export function getDetectorsByType(type: SignalType): SignalDetector[] {
  return detectors.filter(d => d.signalTypes.includes(type) && d.enabled);
}

/**
 * Run all enabled detectors
 */
export async function runAllDetectors(): Promise<Signal[]> {
  const enabledDetectors = getEnabledDetectors();
  const startTime = Date.now();

  console.log(`[Detectors] Running ${enabledDetectors.length} detectors...`);

  const results = await Promise.allSettled(
    enabledDetectors.map(async (detector) => {
      try {
        const signals = await detector.detect();
        return { detector: detector.name, signals, error: null };
      } catch (error) {
        console.error(`[Detectors] ${detector.name} failed:`, error);
        return { detector: detector.name, signals: [], error };
      }
    })
  );

  const allSignals: Signal[] = [];
  const stats: Record<string, number> = {};

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allSignals.push(...result.value.signals);
      stats[result.value.detector] = result.value.signals.length;
    }
  }

  const elapsed = Date.now() - startTime;
  console.log(`[Detectors] Found ${allSignals.length} signals in ${elapsed}ms:`, stats);

  return allSignals;
}

/**
 * Check health of all detectors
 */
export async function checkDetectorsHealth(): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};

  const checks = await Promise.allSettled(
    detectors.map(async (detector) => ({
      name: detector.name,
      healthy: detector.enabled && await detector.isHealthy(),
    }))
  );

  for (const check of checks) {
    if (check.status === 'fulfilled') {
      results[check.value.name] = check.value.healthy;
    } else {
      // Find detector name from index - not ideal but works
      results['unknown'] = false;
    }
  }

  return results;
}

// Export individual detectors
export { arbitrageDetector } from './arbitrage';
export { volumeDetector } from './volume';
export { newsDetector } from './news';
export { resolutionDetector } from './resolution';
export { whaleDetector } from './whale';
export { momentumDetector } from './momentum';
