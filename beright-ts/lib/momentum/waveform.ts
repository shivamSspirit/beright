/**
 * Momentum Score Engine - Waveform History Management
 *
 * Manages the 30d/90d time series data for momentum visualization.
 * Each market stores daily momentum snapshots for chart rendering.
 */

import { MomentumHistoryEntry, MomentumComponents } from './types';

/**
 * Add a new entry to momentum history
 *
 * Maintains chronological order and trims to 90 entries max.
 * Called once per day per market (via orchestrator).
 */
export function appendToHistory(
  existingHistory: MomentumHistoryEntry[],
  newEntry: {
    score: number;
    components: MomentumComponents;
  }
): MomentumHistoryEntry[] {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Check if we already have an entry for today
  const existingTodayIndex = existingHistory.findIndex(
    (entry) => entry.date === today
  );

  let updated: MomentumHistoryEntry[];

  if (existingTodayIndex >= 0) {
    // Replace today's entry (multiple updates per day take latest)
    updated = [...existingHistory];
    updated[existingTodayIndex] = {
      date: today,
      score: newEntry.score,
      components: newEntry.components,
    };
  } else {
    // Add new entry
    updated = [
      ...existingHistory,
      {
        date: today,
        score: newEntry.score,
        components: newEntry.components,
      },
    ];
  }

  // Sort by date descending (newest first) and trim to 90 entries
  return updated
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 90);
}

/**
 * Get last N days of history for chart rendering
 */
export function getRecentHistory(
  history: MomentumHistoryEntry[],
  days: 30 | 90 = 30
): MomentumHistoryEntry[] {
  return history
    .sort((a, b) => a.date.localeCompare(b.date)) // chronological
    .slice(-days);
}

/**
 * Extract simple waveform data for API response
 * (just date + score, no component breakdown)
 */
export function getWaveformData(
  history: MomentumHistoryEntry[],
  days: 30 | 90 = 30
): Array<{ date: string; score: number }> {
  return getRecentHistory(history, days).map(({ date, score }) => ({
    date,
    score,
  }));
}

/**
 * Calculate momentum trend (rising, falling, stable)
 *
 * Compares last 7 days average to previous 7 days.
 */
export function calculateTrend(
  history: MomentumHistoryEntry[]
): 'rising' | 'falling' | 'stable' {
  if (history.length < 14) return 'stable';

  const sorted = [...history].sort((a, b) => b.date.localeCompare(a.date));
  const recent7 = sorted.slice(0, 7);
  const previous7 = sorted.slice(7, 14);

  const recentAvg = recent7.reduce((sum, e) => sum + e.score, 0) / recent7.length;
  const previousAvg = previous7.reduce((sum, e) => sum + e.score, 0) / previous7.length;

  const change = recentAvg - previousAvg;

  if (change > 5) return 'rising';
  if (change < -5) return 'falling';
  return 'stable';
}

/**
 * Calculate peak momentum in time window
 */
export function getPeakMomentum(
  history: MomentumHistoryEntry[],
  days: 30 | 90 = 30
): { date: string; score: number } | null {
  const recent = getRecentHistory(history, days);
  if (recent.length === 0) return null;

  return recent.reduce((peak, entry) =>
    entry.score > peak.score ? entry : peak
  );
}

/**
 * Calculate average momentum in time window
 */
export function getAverageMomentum(
  history: MomentumHistoryEntry[],
  days: 30 | 90 = 30
): number {
  const recent = getRecentHistory(history, days);
  if (recent.length === 0) return 0;

  return recent.reduce((sum, e) => sum + e.score, 0) / recent.length;
}

/**
 * Detect momentum breakouts (sudden spikes)
 *
 * Returns true if current score is > 2 stddev above 30d average.
 */
export function detectBreakout(
  currentScore: number,
  history: MomentumHistoryEntry[]
): boolean {
  const recent = getRecentHistory(history, 30);
  if (recent.length < 7) return false;

  const scores = recent.map((e) => e.score);
  const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  const variance = scores.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / scores.length;
  const stddev = Math.sqrt(variance);

  // Breakout if > 2 standard deviations above average
  return currentScore > avg + 2 * stddev;
}

/**
 * Format history for Supabase JSONB storage
 */
export function serializeHistory(history: MomentumHistoryEntry[]): string {
  return JSON.stringify(history);
}

/**
 * Parse history from Supabase JSONB
 */
export function parseHistory(jsonb: unknown): MomentumHistoryEntry[] {
  if (!jsonb) return [];
  if (typeof jsonb === 'string') {
    try {
      return JSON.parse(jsonb) as MomentumHistoryEntry[];
    } catch {
      return [];
    }
  }
  if (Array.isArray(jsonb)) {
    return jsonb as MomentumHistoryEntry[];
  }
  return [];
}
