/**
 * Price History Tracker for BeRight Protocol
 * Records rolling 48h price snapshots for prediction markets
 * Provides real 24h price changes — replaces Math.random() fake data
 */

import { Market } from '../types/index';
import { getHotMarkets } from './markets';
import * as fs from 'fs';
import * as path from 'path';

interface PriceSnapshot {
  marketId: string;
  platform: string;
  title: string;
  price: number;
  volume: number;
  timestamp: string;
}

interface PriceHistory {
  snapshots: PriceSnapshot[];
  lastUpdate: string;
}

export interface MarketMover {
  title: string;
  platform: string;
  currentPrice: number;
  change24h: number;
  volume: number;
}

const HISTORY_FILE = path.join(process.cwd(), 'memory', 'price-history.json');
const MAX_AGE_MS = 48 * 60 * 60 * 1000; // 48 hours

/**
 * Load price history from file
 */
function loadHistory(): PriceHistory {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
    }
  } catch {
    // Corrupted file, start fresh
  }
  return { snapshots: [], lastUpdate: '' };
}

/**
 * Save price history to file
 */
function saveHistory(history: PriceHistory): void {
  try {
    const dir = path.dirname(HISTORY_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  } catch (error) {
    console.error('Could not save price history:', error);
  }
}

/**
 * Prune snapshots older than 48h
 */
function pruneOld(history: PriceHistory): void {
  const cutoff = Date.now() - MAX_AGE_MS;
  history.snapshots = history.snapshots.filter(
    s => new Date(s.timestamp).getTime() > cutoff
  );
}

/**
 * Record a price snapshot for current hot markets
 * Call this from the heartbeat loop
 */
export async function recordSnapshot(): Promise<number> {
  const markets = await getHotMarkets(20);
  const history = loadHistory();
  const now = new Date().toISOString();

  for (const market of markets) {
    if (!market.marketId) continue;

    history.snapshots.push({
      marketId: market.marketId,
      platform: market.platform,
      title: market.title,
      price: market.yesPrice,
      volume: market.volume,
      timestamp: now,
    });
  }

  pruneOld(history);
  history.lastUpdate = now;
  saveHistory(history);

  return markets.length;
}

/**
 * Get the 24h price change for a specific market
 */
export function getChange24h(marketId: string): number | null {
  const history = loadHistory();
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  // Get snapshots for this market
  const snapshots = history.snapshots
    .filter(s => s.marketId === marketId)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  if (snapshots.length < 2) return null;

  // Current price = latest snapshot
  const current = snapshots[snapshots.length - 1];

  // Find the oldest snapshot within 24h window (or closest to 24h ago)
  const oldSnapshot = snapshots.find(
    s => new Date(s.timestamp).getTime() <= oneDayAgo
  ) || snapshots[0];

  if (oldSnapshot.price === 0) return null;

  // Return percentage point change (e.g., 0.72 -> 0.67 = -5.0)
  return (current.price - oldSnapshot.price) * 100;
}

/**
 * Get top market movers by absolute 24h change
 * This replaces the Math.random() fake data in brief.ts
 */
export async function getMarketMovers(limit = 5): Promise<MarketMover[]> {
  const markets = await getHotMarkets(15);
  const movers: MarketMover[] = [];

  for (const market of markets) {
    if (!market.marketId) continue;

    const change = getChange24h(market.marketId);

    movers.push({
      title: market.title,
      platform: market.platform,
      currentPrice: market.yesPrice,
      change24h: change ?? 0, // 0 if no history yet (honest, not random)
      volume: market.volume,
    });
  }

  // Sort by absolute change (biggest movers first)
  return movers
    .sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h))
    .slice(0, limit);
}

/**
 * Check if we have enough history for meaningful changes
 */
export function hasHistory(): boolean {
  const history = loadHistory();
  if (history.snapshots.length === 0) return false;

  // Need at least 1 hour of data
  const oldest = new Date(history.snapshots[0].timestamp).getTime();
  return Date.now() - oldest > 60 * 60 * 1000;
}

// CLI interface
if (process.argv[1]?.endsWith('priceTracker.ts')) {
  const command = process.argv[2];
  (async () => {
    if (command === 'snapshot') {
      console.log('Recording price snapshot...');
      const count = await recordSnapshot();
      console.log(`Recorded ${count} market prices`);
    } else if (command === 'movers') {
      console.log('Top market movers:');
      const movers = await getMarketMovers();
      for (const m of movers) {
        const sign = m.change24h >= 0 ? '+' : '';
        console.log(`  ${m.title.slice(0, 40)}... ${sign}${m.change24h.toFixed(1)}pp (${m.platform})`);
      }
    } else {
      console.log('Usage:');
      console.log('  ts-node priceTracker.ts snapshot  - Record current prices');
      console.log('  ts-node priceTracker.ts movers    - Show top movers');
    }
  })();
}
