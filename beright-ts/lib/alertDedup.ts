/**
 * Centralized Alert Deduplication Service
 *
 * Prevents repeated alerts for the same event across ALL notification sources:
 * - Arbitrage alerts
 * - Whale alerts
 * - Hot alpha / trends
 * - Closing soon
 * - New markets
 * - Spread alerts
 * - Morning briefs
 *
 * Used by: arbMonitor.ts, notifications.ts, proactiveAgent.ts, heartbeat.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const MEMORY_DIR = path.join(process.cwd(), 'memory');
const DEDUP_FILE = path.join(MEMORY_DIR, 'alert-dedup.json');

// ============================================
// CONFIGURATION
// ============================================

// Default cooldown periods by alert type (in milliseconds)
const DEFAULT_COOLDOWNS: Record<string, number> = {
  // Arbitrage - 30 min cooldown, but re-alert if profit jumps 5%+
  arb: 30 * 60 * 1000,
  arbitrage: 30 * 60 * 1000,

  // Whale movements - 2 hour cooldown
  whale: 2 * 60 * 60 * 1000,

  // Hot alpha / trends - 4 hour cooldown (these don't change fast)
  hot_alpha: 4 * 60 * 60 * 1000,
  HOT_ALPHA: 4 * 60 * 60 * 1000,
  trend: 4 * 60 * 60 * 1000,

  // Big movers - 2 hour cooldown
  big_mover: 2 * 60 * 60 * 1000,
  BIG_MOVER: 2 * 60 * 60 * 1000,

  // Closing soon - 6 hour cooldown (don't spam about same closing market)
  closing: 6 * 60 * 60 * 1000,
  CLOSING_SOON: 6 * 60 * 60 * 1000,

  // New markets - 24 hour cooldown (only alert once per market)
  new_market: 24 * 60 * 60 * 1000,
  NEW_MARKET: 24 * 60 * 60 * 1000,

  // Spread alerts - 2 hour cooldown
  spread: 2 * 60 * 60 * 1000,
  SPREAD_ALERT: 2 * 60 * 60 * 1000,

  // Morning brief - 24 hour cooldown (once per day)
  brief: 24 * 60 * 60 * 1000,

  // Default for unknown types
  default: 1 * 60 * 60 * 1000, // 1 hour
};

// Threshold for re-alerting if value increased significantly (e.g., profit %)
const SIGNIFICANT_CHANGE_THRESHOLD = 5;

// ============================================
// TYPES
// ============================================

interface DedupEntry {
  key: string;
  type: string;
  sentAt: number;
  value?: number; // For tracking profit %, price, etc.
  metadata?: Record<string, any>;
}

interface DedupState {
  entries: Record<string, DedupEntry>;
  lastCleanup: number;
}

// ============================================
// STATE MANAGEMENT
// ============================================

function loadState(): DedupState {
  try {
    if (fs.existsSync(DEDUP_FILE)) {
      const data = JSON.parse(fs.readFileSync(DEDUP_FILE, 'utf-8'));
      return {
        entries: data.entries || {},
        lastCleanup: data.lastCleanup || Date.now(),
      };
    }
  } catch (e) {
    console.error('[AlertDedup] Error loading state:', e);
  }
  return { entries: {}, lastCleanup: Date.now() };
}

function saveState(state: DedupState): void {
  try {
    if (!fs.existsSync(MEMORY_DIR)) {
      fs.mkdirSync(MEMORY_DIR, { recursive: true });
    }
    fs.writeFileSync(DEDUP_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('[AlertDedup] Error saving state:', e);
  }
}

// ============================================
// CORE DEDUPLICATION LOGIC
// ============================================

/**
 * Generate a unique key for an alert
 *
 * @param type - Alert type (arb, whale, hot_alpha, etc.)
 * @param identifier - Unique identifier (market title, wallet, topic, etc.)
 * @returns Normalized dedup key
 */
export function generateAlertKey(type: string, identifier: string): string {
  const normalizedId = identifier
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 60);
  return `${type}:${normalizedId}`;
}

/**
 * Check if an alert should be sent (not a duplicate)
 *
 * @param type - Alert type
 * @param identifier - Unique identifier for the alert
 * @param currentValue - Optional numeric value (e.g., profit %) for change detection
 * @param customCooldownMs - Optional custom cooldown override
 * @returns true if alert should be sent, false if duplicate
 */
export function shouldSendAlert(
  type: string,
  identifier: string,
  currentValue?: number,
  customCooldownMs?: number
): boolean {
  const state = loadState();
  const key = generateAlertKey(type, identifier);
  const existing = state.entries[key];

  if (!existing) {
    return true; // Never sent before
  }

  const cooldownMs = customCooldownMs || DEFAULT_COOLDOWNS[type] || DEFAULT_COOLDOWNS.default;
  const elapsed = Date.now() - existing.sentAt;

  // Cooldown not expired
  if (elapsed < cooldownMs) {
    // Check if value changed significantly (re-alert on big moves)
    if (currentValue !== undefined && existing.value !== undefined) {
      const change = Math.abs(currentValue - existing.value);
      if (change >= SIGNIFICANT_CHANGE_THRESHOLD) {
        console.log(`[AlertDedup] Re-alerting ${key}: value changed by ${change.toFixed(2)}`);
        return true;
      }
    }

    console.log(`[AlertDedup] Skipping duplicate: ${key} (${Math.round(elapsed / 60000)}min ago)`);
    return false;
  }

  // Cooldown expired, ok to send
  return true;
}

/**
 * Record that an alert was sent (for future deduplication)
 *
 * @param type - Alert type
 * @param identifier - Unique identifier
 * @param value - Optional numeric value to track
 * @param metadata - Optional additional data
 */
export function recordAlertSent(
  type: string,
  identifier: string,
  value?: number,
  metadata?: Record<string, any>
): void {
  const state = loadState();
  const key = generateAlertKey(type, identifier);

  state.entries[key] = {
    key,
    type,
    sentAt: Date.now(),
    value,
    metadata,
  };

  // Cleanup old entries every hour
  const ONE_HOUR = 60 * 60 * 1000;
  if (Date.now() - state.lastCleanup > ONE_HOUR) {
    cleanupOldEntries(state);
    state.lastCleanup = Date.now();
  }

  saveState(state);
}

/**
 * Check and record in one call (convenience function)
 *
 * @returns true if alert should be sent (and records it), false if duplicate
 */
export function checkAndRecordAlert(
  type: string,
  identifier: string,
  value?: number,
  metadata?: Record<string, any>
): boolean {
  if (!shouldSendAlert(type, identifier, value)) {
    return false;
  }
  recordAlertSent(type, identifier, value, metadata);
  return true;
}

/**
 * Remove entries older than their cooldown period * 2
 */
function cleanupOldEntries(state: DedupState): void {
  const now = Date.now();
  let cleaned = 0;

  for (const key of Object.keys(state.entries)) {
    const entry = state.entries[key];
    const maxAge = (DEFAULT_COOLDOWNS[entry.type] || DEFAULT_COOLDOWNS.default) * 2;

    if (now - entry.sentAt > maxAge) {
      delete state.entries[key];
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[AlertDedup] Cleaned up ${cleaned} old entries`);
  }
}

/**
 * Get dedup statistics
 */
export function getDedupStats(): {
  totalEntries: number;
  byType: Record<string, number>;
  oldestEntry: number | null;
  newestEntry: number | null;
} {
  const state = loadState();
  const entries = Object.values(state.entries);

  const byType: Record<string, number> = {};
  let oldest: number | null = null;
  let newest: number | null = null;

  for (const entry of entries) {
    byType[entry.type] = (byType[entry.type] || 0) + 1;
    if (oldest === null || entry.sentAt < oldest) oldest = entry.sentAt;
    if (newest === null || entry.sentAt > newest) newest = entry.sentAt;
  }

  return {
    totalEntries: entries.length,
    byType,
    oldestEntry: oldest,
    newestEntry: newest,
  };
}

/**
 * Clear all dedup entries (for testing/reset)
 */
export function clearDedupCache(): void {
  saveState({ entries: {}, lastCleanup: Date.now() });
  console.log('[AlertDedup] Cache cleared');
}

/**
 * Force expire a specific alert (allow immediate re-send)
 */
export function expireAlert(type: string, identifier: string): boolean {
  const state = loadState();
  const key = generateAlertKey(type, identifier);

  if (state.entries[key]) {
    delete state.entries[key];
    saveState(state);
    console.log(`[AlertDedup] Expired: ${key}`);
    return true;
  }
  return false;
}
