/**
 * Latency Tracker - Microsecond Precision Timing
 *
 * Uses process.hrtime.bigint() for nanosecond precision,
 * converted to microseconds for practical use.
 *
 * @author BeRight Protocol
 */

import { LatencyMetrics } from '../../config/execution';

// ============================================================================
// TYPES
// ============================================================================

export interface LatencyStats {
  count: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface TimingLabel {
  label: string;
  startNs: bigint;
  endNs?: bigint;
}

// ============================================================================
// LATENCY TRACKER CLASS
// ============================================================================

export class LatencyTracker {
  private timings: Map<string, TimingLabel> = new Map();
  private history: LatencyMetrics[] = [];
  private maxHistorySize: number;

  constructor(maxHistorySize: number = 1000) {
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * Start timing a labeled operation
   */
  start(label: string): void {
    this.timings.set(label, {
      label,
      startNs: process.hrtime.bigint(),
    });
  }

  /**
   * End timing and return microseconds elapsed
   */
  end(label: string): number {
    const timing = this.timings.get(label);
    if (!timing) {
      console.warn(`[LatencyTracker] No start time for label: ${label}`);
      return 0;
    }

    timing.endNs = process.hrtime.bigint();
    const elapsedNs = timing.endNs - timing.startNs;
    const elapsedUs = Number(elapsedNs) / 1000; // nanoseconds to microseconds

    return elapsedUs;
  }

  /**
   * Measure a function execution time
   */
  async measure<T>(label: string, fn: () => Promise<T>): Promise<{ result: T; microseconds: number }> {
    this.start(label);
    const result = await fn();
    const microseconds = this.end(label);
    return { result, microseconds };
  }

  /**
   * Measure a synchronous function execution time
   */
  measureSync<T>(label: string, fn: () => T): { result: T; microseconds: number } {
    this.start(label);
    const result = fn();
    const microseconds = this.end(label);
    return { result, microseconds };
  }

  /**
   * Get elapsed microseconds for a label (without ending)
   */
  elapsed(label: string): number {
    const timing = this.timings.get(label);
    if (!timing) return 0;

    const now = process.hrtime.bigint();
    const elapsedNs = now - timing.startNs;
    return Number(elapsedNs) / 1000;
  }

  /**
   * Build complete latency metrics from individual timings
   */
  buildMetrics(slot?: number): LatencyMetrics {
    const metrics: LatencyMetrics = {
      quoteUs: this.getElapsed('quote'),
      buildUs: this.getElapsed('build'),
      signUs: this.getElapsed('sign'),
      submitUs: this.getElapsed('submit'),
      confirmUs: this.getElapsed('confirm'),
      totalUs: this.getElapsed('total'),
      slot,
      timestamp: Date.now(),
    };

    // Add to history
    this.addToHistory(metrics);

    return metrics;
  }

  /**
   * Get elapsed time for a label (returns 0 if not found)
   */
  private getElapsed(label: string): number {
    const timing = this.timings.get(label);
    if (!timing) return 0;
    if (timing.endNs) {
      return Number(timing.endNs - timing.startNs) / 1000;
    }
    return 0;
  }

  /**
   * Add metrics to history (with size limit)
   */
  private addToHistory(metrics: LatencyMetrics): void {
    this.history.push(metrics);
    if (this.history.length > this.maxHistorySize) {
      this.history.shift(); // Remove oldest
    }
  }

  /**
   * Get statistics for a specific metric
   */
  getStats(metricKey: keyof Omit<LatencyMetrics, 'slot' | 'timestamp'>): LatencyStats {
    if (this.history.length === 0) {
      return { count: 0, min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
    }

    const values = this.history
      .map((m) => m[metricKey])
      .filter((v): v is number => typeof v === 'number' && v > 0)
      .sort((a, b) => a - b);

    if (values.length === 0) {
      return { count: 0, min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
    }

    const count = values.length;
    const min = values[0];
    const max = values[count - 1];
    const avg = values.reduce((a, b) => a + b, 0) / count;
    const p50 = values[Math.floor(count * 0.5)];
    const p95 = values[Math.floor(count * 0.95)];
    const p99 = values[Math.floor(count * 0.99)];

    return { count, min, max, avg, p50, p95, p99 };
  }

  /**
   * Get all stats for all metrics
   */
  getAllStats(): Record<string, LatencyStats> {
    return {
      quote: this.getStats('quoteUs'),
      build: this.getStats('buildUs'),
      sign: this.getStats('signUs'),
      submit: this.getStats('submitUs'),
      confirm: this.getStats('confirmUs'),
      total: this.getStats('totalUs'),
    };
  }

  /**
   * Get recent history
   */
  getHistory(limit: number = 100): LatencyMetrics[] {
    return this.history.slice(-limit);
  }

  /**
   * Clear all timings and history
   */
  clear(): void {
    this.timings.clear();
    this.history = [];
  }

  /**
   * Reset current timings (keep history)
   */
  reset(): void {
    this.timings.clear();
  }

  /**
   * Format metrics for logging
   */
  static formatMetrics(metrics: LatencyMetrics): string {
    const toMs = (us: number) => (us / 1000).toFixed(2);
    return [
      `quote: ${toMs(metrics.quoteUs)}ms`,
      `build: ${toMs(metrics.buildUs)}ms`,
      `sign: ${toMs(metrics.signUs)}ms`,
      `submit: ${toMs(metrics.submitUs)}ms`,
      `confirm: ${toMs(metrics.confirmUs)}ms`,
      `total: ${toMs(metrics.totalUs)}ms`,
    ].join(' | ');
  }

  /**
   * Format stats for logging
   */
  static formatStats(stats: LatencyStats): string {
    const toMs = (us: number) => (us / 1000).toFixed(2);
    return [
      `count: ${stats.count}`,
      `min: ${toMs(stats.min)}ms`,
      `max: ${toMs(stats.max)}ms`,
      `avg: ${toMs(stats.avg)}ms`,
      `p50: ${toMs(stats.p50)}ms`,
      `p95: ${toMs(stats.p95)}ms`,
      `p99: ${toMs(stats.p99)}ms`,
    ].join(' | ');
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let globalTracker: LatencyTracker | null = null;

export function getLatencyTracker(): LatencyTracker {
  if (!globalTracker) {
    globalTracker = new LatencyTracker();
  }
  return globalTracker;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Measure execution time of an async function (standalone)
 */
export async function measureAsync<T>(fn: () => Promise<T>): Promise<{ result: T; microseconds: number }> {
  const start = process.hrtime.bigint();
  const result = await fn();
  const end = process.hrtime.bigint();
  const microseconds = Number(end - start) / 1000;
  return { result, microseconds };
}

/**
 * Measure execution time of a sync function (standalone)
 */
export function measureSync<T>(fn: () => T): { result: T; microseconds: number } {
  const start = process.hrtime.bigint();
  const result = fn();
  const end = process.hrtime.bigint();
  const microseconds = Number(end - start) / 1000;
  return { result, microseconds };
}

/**
 * Convert microseconds to formatted string
 */
export function formatMicroseconds(us: number): string {
  if (us < 1000) {
    return `${us.toFixed(0)}μs`;
  }
  const ms = us / 1000;
  if (ms < 1000) {
    return `${ms.toFixed(2)}ms`;
  }
  const s = ms / 1000;
  return `${s.toFixed(2)}s`;
}

/**
 * Create a timing decorator for class methods
 */
export function timed(target: object, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: unknown[]) {
    const tracker = getLatencyTracker();
    const label = `${target.constructor.name}.${propertyKey}`;
    tracker.start(label);

    try {
      const result = await originalMethod.apply(this, args);
      const elapsed = tracker.end(label);
      console.log(`[Timing] ${label}: ${formatMicroseconds(elapsed)}`);
      return result;
    } catch (error) {
      tracker.end(label);
      throw error;
    }
  };

  return descriptor;
}

export default LatencyTracker;
