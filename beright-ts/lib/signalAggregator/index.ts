/**
 * BeRight Signal Aggregator
 *
 * Unified alpha signal stream from multiple sources.
 * Part of the Bloomberg Terminal architecture.
 *
 * @author BeRight Protocol
 * @version 3.0.0
 */

import { EventEmitter } from 'events';
import {
  Signal,
  SignalType,
  SignalFilter,
  SignalStreamEvent,
  AggregatorStats,
  SignalSource,
} from './types';
import {
  runAllDetectors,
  checkDetectorsHealth,
  getEnabledDetectors,
  detectors,
} from './detectors';

// =============================================================================
// SIGNAL STORE
// =============================================================================

interface SignalStore {
  signals: Signal[];
  maxSize: number;
  dedupeWindow: number; // ms
}

const store: SignalStore = {
  signals: [],
  maxSize: 1000,
  dedupeWindow: 5 * 60 * 1000, // 5 minutes
};

/**
 * Add signal to store (with deduplication)
 */
function addSignal(signal: Signal): boolean {
  // Check for duplicate (same type, market, and within dedupe window)
  const isDupe = store.signals.some(s =>
    s.type === signal.type &&
    s.market?.id === signal.market?.id &&
    (new Date().getTime() - s.timestamp.getTime()) < store.dedupeWindow
  );

  if (isDupe) {
    return false;
  }

  // Add to front of array
  store.signals.unshift(signal);

  // Trim if over max size
  if (store.signals.length > store.maxSize) {
    store.signals = store.signals.slice(0, store.maxSize);
  }

  return true;
}

/**
 * Get signals with optional filtering
 */
function getSignals(filter?: SignalFilter): Signal[] {
  let result = [...store.signals];

  if (filter?.types?.length) {
    result = result.filter(s => filter.types!.includes(s.type));
  }

  if (filter?.sources?.length) {
    result = result.filter(s => filter.sources!.includes(s.source));
  }

  if (filter?.minConfidence !== undefined) {
    result = result.filter(s => s.confidence >= filter.minConfidence!);
  }

  if (filter?.urgency?.length) {
    result = result.filter(s => filter.urgency!.includes(s.urgency));
  }

  if (filter?.marketId) {
    result = result.filter(s => s.market?.id === filter.marketId);
  }

  if (filter?.platforms?.length) {
    result = result.filter(s =>
      s.market?.platform && filter.platforms!.includes(s.market.platform)
    );
  }

  if (filter?.since) {
    result = result.filter(s => s.timestamp >= filter.since!);
  }

  // Remove expired signals
  const now = new Date();
  result = result.filter(s => !s.expiresAt || s.expiresAt > now);

  if (filter?.limit) {
    result = result.slice(0, filter.limit);
  }

  return result;
}

// =============================================================================
// SIGNAL AGGREGATOR CLASS
// =============================================================================

export class SignalAggregator extends EventEmitter {
  private pollingInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastPollAt?: Date;
  private pollIntervalMs = 60000; // 1 minute default

  constructor() {
    super();
  }

  /**
   * Start the signal aggregator
   */
  start(pollIntervalMs?: number): void {
    if (this.isRunning) {
      console.log('[SignalAggregator] Already running');
      return;
    }

    this.pollIntervalMs = pollIntervalMs || this.pollIntervalMs;
    this.isRunning = true;

    console.log(`[SignalAggregator] Starting with ${this.pollIntervalMs / 1000}s interval`);

    // Run immediately
    this.poll();

    // Set up polling
    this.pollingInterval = setInterval(() => {
      this.poll();
    }, this.pollIntervalMs);
  }

  /**
   * Stop the signal aggregator
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    console.log('[SignalAggregator] Stopped');
  }

  /**
   * Poll all detectors for new signals
   */
  async poll(): Promise<Signal[]> {
    try {
      const signals = await runAllDetectors();
      let newCount = 0;

      for (const signal of signals) {
        if (addSignal(signal)) {
          newCount++;
          this.emit('signal', signal);
        }
      }

      this.lastPollAt = new Date();

      // Emit heartbeat
      this.emit('heartbeat', {
        type: 'heartbeat',
        data: null,
        timestamp: new Date(),
      } as SignalStreamEvent);

      if (newCount > 0) {
        console.log(`[SignalAggregator] Added ${newCount} new signals`);
      }

      return signals;
    } catch (error) {
      console.error('[SignalAggregator] Poll error:', error);
      this.emit('error', error);
      return [];
    }
  }

  /**
   * Get signals with optional filtering
   */
  getSignals(filter?: SignalFilter): Signal[] {
    return getSignals(filter);
  }

  /**
   * Get latest signals
   */
  getLatest(limit: number = 20): Signal[] {
    return getSignals({ limit });
  }

  /**
   * Get signals by type
   */
  getByType(type: SignalType, limit: number = 20): Signal[] {
    return getSignals({ types: [type], limit });
  }

  /**
   * Get signals for a specific market
   */
  getForMarket(marketId: string): Signal[] {
    return getSignals({ marketId });
  }

  /**
   * Get high-urgency signals
   */
  getUrgent(): Signal[] {
    return getSignals({ urgency: ['high', 'critical'] });
  }

  /**
   * Get aggregator statistics
   */
  async getStats(): Promise<AggregatorStats> {
    const signals = store.signals;

    // Count by type
    const signalsByType: Record<SignalType, number> = {} as any;
    for (const signal of signals) {
      signalsByType[signal.type] = (signalsByType[signal.type] || 0) + 1;
    }

    // Count by source
    const signalsBySource: Record<SignalSource, number> = {} as any;
    for (const signal of signals) {
      signalsBySource[signal.source] = (signalsBySource[signal.source] || 0) + 1;
    }

    // Average confidence
    const avgConfidence = signals.length > 0
      ? signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length
      : 0;

    // Health check
    const health = await checkDetectorsHealth();
    const detectorsHealthy = Object.values(health).filter(v => v).length;

    return {
      totalSignals: signals.length,
      signalsByType,
      signalsBySource,
      avgConfidence,
      lastSignalAt: signals[0]?.timestamp,
      detectorsHealthy,
      detectorsTotal: detectors.length,
    };
  }

  /**
   * Check if aggregator is healthy
   */
  async isHealthy(): Promise<boolean> {
    const health = await checkDetectorsHealth();
    return Object.values(health).some(v => v);
  }

  /**
   * Clear signal store
   */
  clear(): void {
    store.signals = [];
    console.log('[SignalAggregator] Store cleared');
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let instance: SignalAggregator | null = null;

/**
 * Get the singleton SignalAggregator instance
 */
export function getSignalAggregator(): SignalAggregator {
  if (!instance) {
    instance = new SignalAggregator();
  }
  return instance;
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Start signal aggregation
 */
export function startSignalAggregator(pollIntervalMs?: number): SignalAggregator {
  const aggregator = getSignalAggregator();
  aggregator.start(pollIntervalMs);
  return aggregator;
}

/**
 * Get latest signals
 */
export async function getLatestSignals(limit: number = 20): Promise<Signal[]> {
  const aggregator = getSignalAggregator();

  // Run a poll if no signals yet
  if (aggregator.getLatest(1).length === 0) {
    await aggregator.poll();
  }

  return aggregator.getLatest(limit);
}

/**
 * Get signals by type
 */
export async function getSignalsByType(type: SignalType, limit: number = 20): Promise<Signal[]> {
  const aggregator = getSignalAggregator();

  // Run a poll if no signals yet
  if (aggregator.getLatest(1).length === 0) {
    await aggregator.poll();
  }

  return aggregator.getByType(type, limit);
}

/**
 * Subscribe to new signals
 */
export function onNewSignal(callback: (signal: Signal) => void): () => void {
  const aggregator = getSignalAggregator();
  aggregator.on('signal', callback);

  // Return unsubscribe function
  return () => {
    aggregator.off('signal', callback);
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export * from './types';
export * from './detectors';

export default SignalAggregator;
