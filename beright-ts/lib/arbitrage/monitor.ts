/**
 * Real-Time Arbitrage Monitor
 *
 * Professional-grade early detection system that:
 * 1. Pre-matches markets across platforms (cached registry)
 * 2. Monitors prices continuously (every 30 seconds)
 * 3. Detects opportunities the moment they appear
 * 4. Sends instant alerts via telegram
 * 5. Tracks opportunity lifecycle (appearance → capture → closure)
 *
 * This is how professional arbitrage traders operate.
 * Speed is everything - opportunities last seconds, not minutes.
 */

import { Market, Platform } from '../../types/index';
import { searchMarkets } from '../../skills/markets';
import {
  matchMarkets,
  extractMetadata,
  calculateEquivalence,
} from './marketMatcher';
import { analyzeArbitrage } from './calculator';
import {
  ValidatedMarketPair,
  ValidatedArbitrageOpportunity,
  ArbitrageConfig,
  DEFAULT_ARBITRAGE_CONFIG,
} from './types';

// ============================================
// MARKET REGISTRY (Pre-matched pairs)
// ============================================

interface MarketRegistryEntry {
  marketA: {
    platform: Platform;
    marketId: string;
    title: string;
  };
  marketB: {
    platform: Platform;
    marketId: string;
    title: string;
  };
  equivalenceScore: number;
  lastUpdated: Date;
}

interface MarketRegistry {
  entries: MarketRegistryEntry[];
  lastFullRefresh: Date;
  version: number;
}

// Global registry cache
let registry: MarketRegistry = {
  entries: [],
  lastFullRefresh: new Date(0),
  version: 0,
};

// ============================================
// OPPORTUNITY TRACKING
// ============================================

interface TrackedOpportunity {
  id: string;
  pair: MarketRegistryEntry;
  firstSeen: Date;
  lastSeen: Date;
  peakProfit: number;
  currentProfit: number;
  status: 'active' | 'captured' | 'closed';
  priceHistory: Array<{
    timestamp: Date;
    priceA: number;
    priceB: number;
    profit: number;
  }>;
  alertSent: boolean;
}

// Active opportunities
const activeOpportunities: Map<string, TrackedOpportunity> = new Map();

// Historical opportunities (last 100)
const historicalOpportunities: TrackedOpportunity[] = [];

// ============================================
// MONITOR STATE
// ============================================

interface MonitorState {
  isRunning: boolean;
  lastScan: Date;
  scanCount: number;
  opportunitiesFound: number;
  alertsSent: number;
  errors: string[];
}

const monitorState: MonitorState = {
  isRunning: false,
  lastScan: new Date(0),
  scanCount: 0,
  opportunitiesFound: 0,
  alertsSent: 0,
  errors: [],
};

// Alert callback
type AlertCallback = (opportunity: TrackedOpportunity) => Promise<void>;
let alertCallback: AlertCallback | null = null;

// ============================================
// REGISTRY MANAGEMENT
// ============================================

/**
 * Refresh the market registry - match all markets across platforms
 * This is expensive, so we do it periodically (every 5 minutes)
 */
export async function refreshRegistry(
  platforms: Platform[] = ['polymarket', 'kalshi', 'manifold'],
  config: ArbitrageConfig = DEFAULT_ARBITRAGE_CONFIG
): Promise<void> {
  console.log('[Registry] Refreshing market registry...');
  const startTime = Date.now();

  try {
    // Fetch all markets
    const marketsByPlatform: Record<Platform, Market[]> = {} as any;

    await Promise.all(
      platforms.map(async (platform) => {
        try {
          const markets = await searchMarkets('', [platform]);
          marketsByPlatform[platform] = markets.slice(0, 100); // Top 100 per platform
          console.log(`[Registry] ${platform}: ${markets.length} markets`);
        } catch (err) {
          console.error(`[Registry] Failed to fetch ${platform}:`, err);
          marketsByPlatform[platform] = [];
        }
      })
    );

    // Match across all platform pairs
    const newEntries: MarketRegistryEntry[] = [];

    for (let i = 0; i < platforms.length; i++) {
      for (let j = i + 1; j < platforms.length; j++) {
        const platformA = platforms[i];
        const platformB = platforms[j];
        const marketsA = marketsByPlatform[platformA] || [];
        const marketsB = marketsByPlatform[platformB] || [];

        if (marketsA.length === 0 || marketsB.length === 0) continue;

        // Use lower threshold for registry (we'll validate on each scan)
        const pairs = matchMarkets(marketsA, marketsB, {
          ...config,
          minEquivalenceScore: 0.30, // Lower threshold for registry
          minTitleSimilarity: 0.20,
        });

        for (const pair of pairs) {
          newEntries.push({
            marketA: {
              platform: pair.marketA.platform,
              marketId: pair.marketA.marketId || '',
              title: pair.marketA.title,
            },
            marketB: {
              platform: pair.marketB.platform,
              marketId: pair.marketB.marketId || '',
              title: pair.marketB.title,
            },
            equivalenceScore: pair.equivalence.overallScore,
            lastUpdated: new Date(),
          });
        }
      }
    }

    // Update registry
    registry = {
      entries: newEntries,
      lastFullRefresh: new Date(),
      version: registry.version + 1,
    };

    const duration = Date.now() - startTime;
    console.log(`[Registry] Refreshed: ${newEntries.length} matched pairs in ${duration}ms`);

  } catch (error) {
    console.error('[Registry] Refresh failed:', error);
    monitorState.errors.push(`Registry refresh failed: ${error}`);
  }
}

/**
 * Get current registry
 */
export function getRegistry(): MarketRegistry {
  return registry;
}

// ============================================
// PRICE MONITORING
// ============================================

/**
 * Fetch current prices for a registered pair
 */
async function fetchPairPrices(
  entry: MarketRegistryEntry
): Promise<{ priceA: number; priceB: number; marketA: Market; marketB: Market } | null> {
  try {
    // Fetch both markets in parallel
    const [marketsA, marketsB] = await Promise.all([
      searchMarkets(entry.marketA.title.slice(0, 30), [entry.marketA.platform]),
      searchMarkets(entry.marketB.title.slice(0, 30), [entry.marketB.platform]),
    ]);

    // Find the specific markets
    const marketA = marketsA.find(m =>
      m.marketId === entry.marketA.marketId ||
      m.title.toLowerCase().includes(entry.marketA.title.slice(0, 20).toLowerCase())
    );

    const marketB = marketsB.find(m =>
      m.marketId === entry.marketB.marketId ||
      m.title.toLowerCase().includes(entry.marketB.title.slice(0, 20).toLowerCase())
    );

    if (!marketA || !marketB) {
      return null;
    }

    return {
      priceA: marketA.yesPrice,
      priceB: marketB.yesPrice,
      marketA,
      marketB,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Calculate profit opportunity for a price pair
 */
function calculateProfit(priceA: number, priceB: number): {
  hasArbitrage: boolean;
  profit: number;
  strategy: string;
} {
  // Cross-platform spread: Buy YES on lower + NO on higher
  // Cost = lower_yes + (1 - higher_yes)
  // Profit = 1 - Cost

  const costBuyAYes_BNo = priceA + (1 - priceB);
  const costBuyBYes_ANo = priceB + (1 - priceA);

  // Account for ~2% total fees
  const feeAdjustment = 0.02;

  if (costBuyAYes_BNo < 1 - feeAdjustment) {
    const profit = (1 - costBuyAYes_BNo - feeAdjustment) * 100;
    return {
      hasArbitrage: true,
      profit,
      strategy: `Buy YES @ A (${(priceA * 100).toFixed(1)}%) + NO @ B (${((1 - priceB) * 100).toFixed(1)}%)`,
    };
  }

  if (costBuyBYes_ANo < 1 - feeAdjustment) {
    const profit = (1 - costBuyBYes_ANo - feeAdjustment) * 100;
    return {
      hasArbitrage: true,
      profit,
      strategy: `Buy YES @ B (${(priceB * 100).toFixed(1)}%) + NO @ A (${((1 - priceA) * 100).toFixed(1)}%)`,
    };
  }

  return { hasArbitrage: false, profit: 0, strategy: '' };
}

// ============================================
// OPPORTUNITY DETECTION
// ============================================

/**
 * Scan all registered pairs for opportunities
 */
export async function scanForOpportunities(
  config: ArbitrageConfig = DEFAULT_ARBITRAGE_CONFIG
): Promise<TrackedOpportunity[]> {
  const startTime = Date.now();
  const newOpportunities: TrackedOpportunity[] = [];

  // Refresh registry if stale (> 5 minutes)
  const registryAge = Date.now() - registry.lastFullRefresh.getTime();
  if (registryAge > 5 * 60 * 1000 || registry.entries.length === 0) {
    await refreshRegistry(['polymarket', 'kalshi', 'manifold'], config);
  }

  console.log(`[Monitor] Scanning ${registry.entries.length} registered pairs...`);

  // Check each registered pair
  for (const entry of registry.entries) {
    const prices = await fetchPairPrices(entry);
    if (!prices) continue;

    const { priceA, priceB, marketA, marketB } = prices;
    const { hasArbitrage, profit, strategy } = calculateProfit(priceA, priceB);

    const pairId = `${entry.marketA.platform}:${entry.marketA.marketId}-${entry.marketB.platform}:${entry.marketB.marketId}`;

    if (hasArbitrage && profit >= config.minNetProfitPct * 100) {
      // Check if already tracking
      let tracked = activeOpportunities.get(pairId);

      if (!tracked) {
        // NEW opportunity!
        tracked = {
          id: pairId,
          pair: entry,
          firstSeen: new Date(),
          lastSeen: new Date(),
          peakProfit: profit,
          currentProfit: profit,
          status: 'active',
          priceHistory: [],
          alertSent: false,
        };
        activeOpportunities.set(pairId, tracked);
        monitorState.opportunitiesFound++;

        console.log(`[Monitor] 🚨 NEW OPPORTUNITY: ${profit.toFixed(2)}% on ${entry.marketA.title.slice(0, 30)}`);
      }

      // Update tracking
      tracked.lastSeen = new Date();
      tracked.currentProfit = profit;
      tracked.peakProfit = Math.max(tracked.peakProfit, profit);
      tracked.priceHistory.push({
        timestamp: new Date(),
        priceA,
        priceB,
        profit,
      });

      // Send alert if not already sent
      if (!tracked.alertSent && alertCallback) {
        await alertCallback(tracked);
        tracked.alertSent = true;
        monitorState.alertsSent++;
      }

      newOpportunities.push(tracked);

    } else {
      // Check if opportunity closed
      const tracked = activeOpportunities.get(pairId);
      if (tracked && tracked.status === 'active') {
        tracked.status = 'closed';
        tracked.currentProfit = 0;

        // Move to historical
        historicalOpportunities.unshift(tracked);
        if (historicalOpportunities.length > 100) {
          historicalOpportunities.pop();
        }

        activeOpportunities.delete(pairId);
        console.log(`[Monitor] Opportunity closed: ${entry.marketA.title.slice(0, 30)} (was ${tracked.peakProfit.toFixed(2)}%)`);
      }
    }
  }

  monitorState.lastScan = new Date();
  monitorState.scanCount++;

  const duration = Date.now() - startTime;
  console.log(`[Monitor] Scan complete: ${newOpportunities.length} active opportunities (${duration}ms)`);

  return newOpportunities;
}

// ============================================
// CONTINUOUS MONITORING
// ============================================

let monitorInterval: NodeJS.Timeout | null = null;

/**
 * Start continuous monitoring
 */
export function startMonitor(
  intervalMs: number = 30000, // 30 seconds default
  onAlert?: AlertCallback,
  config: ArbitrageConfig = DEFAULT_ARBITRAGE_CONFIG
): void {
  if (monitorState.isRunning) {
    console.log('[Monitor] Already running');
    return;
  }

  alertCallback = onAlert || null;
  monitorState.isRunning = true;
  monitorState.errors = [];

  console.log(`[Monitor] Starting continuous monitoring (interval: ${intervalMs}ms)`);

  // Initial scan
  scanForOpportunities(config).catch(err => {
    console.error('[Monitor] Initial scan error:', err);
    monitorState.errors.push(`Scan error: ${err}`);
  });

  // Schedule continuous scans
  monitorInterval = setInterval(() => {
    scanForOpportunities(config).catch(err => {
      console.error('[Monitor] Scan error:', err);
      monitorState.errors.push(`Scan error: ${err}`);
    });
  }, intervalMs);
}

/**
 * Stop monitoring
 */
export function stopMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
  monitorState.isRunning = false;
  console.log('[Monitor] Stopped');
}

/**
 * Get monitor status
 */
export function getMonitorStatus(): MonitorState & {
  activeOpportunities: TrackedOpportunity[];
  registrySize: number;
} {
  return {
    ...monitorState,
    activeOpportunities: Array.from(activeOpportunities.values()),
    registrySize: registry.entries.length,
  };
}

/**
 * Get active opportunities
 */
export function getActiveOpportunities(): TrackedOpportunity[] {
  return Array.from(activeOpportunities.values());
}

/**
 * Get historical opportunities
 */
export function getHistoricalOpportunities(): TrackedOpportunity[] {
  return historicalOpportunities;
}

// ============================================
// ALERT FORMATTING
// ============================================

/**
 * Build market URL based on platform and market ID
 */
function buildMarketUrl(platform: Platform, marketId: string): string {
  switch (platform.toLowerCase()) {
    case 'polymarket':
      // Polymarket uses slug/condition ID in URL
      return `https://polymarket.com/event/${marketId}`;

    case 'kalshi':
    case 'dflow':
      // Kalshi URLs use series ticker (lowercase)
      // Remove numeric/date suffixes: KXTRUMP-26FEB14 → kxtrump
      const slug = marketId
        .replace(/-\d{1,2}[A-Z]{3}\d{2}$/i, '') // Remove date suffix (-26FEB14)
        .replace(/-\d+$/i, '')                   // Remove numeric suffix (-29)
        .replace(/-[A-Z]{1,3}$/i, '')           // Remove short suffix (-KW)
        .toLowerCase();
      return `https://kalshi.com/markets/${slug}`;

    case 'manifold':
      return `https://manifold.markets/${marketId}`;

    default:
      return '#';
  }
}

/**
 * Format opportunity for telegram alert
 */
export function formatOpportunityAlert(opp: TrackedOpportunity): string {
  const age = Math.round((Date.now() - opp.firstSeen.getTime()) / 1000);

  // Build URLs for both markets
  const urlA = buildMarketUrl(opp.pair.marketA.platform, opp.pair.marketA.marketId);
  const urlB = buildMarketUrl(opp.pair.marketB.platform, opp.pair.marketB.marketId);

  return `
🚨 *ARBITRAGE ALERT*

${opp.pair.marketA.title.slice(0, 50)}

📊 *PROFIT: ${opp.currentProfit.toFixed(2)}%*

*Platform A:* ${opp.pair.marketA.platform}
[View Market →](${urlA})

*Platform B:* ${opp.pair.marketB.platform}
[View Market →](${urlB})

Match confidence: ${(opp.pair.equivalenceScore * 100).toFixed(0)}%
First seen: ${age}s ago
Peak profit: ${opp.peakProfit.toFixed(2)}%

⚡ ACT FAST - Opportunities close quickly!
`;
}

// Export for use in arbMonitor.ts
export { buildMarketUrl };

// ============================================
// CLI / INTEGRATION
// ============================================

/**
 * One-time scan (for telegram /arb command)
 */
export async function quickScan(): Promise<{
  opportunities: TrackedOpportunity[];
  registrySize: number;
  scanTime: number;
}> {
  const startTime = Date.now();
  const opportunities = await scanForOpportunities();

  return {
    opportunities,
    registrySize: registry.entries.length,
    scanTime: Date.now() - startTime,
  };
}

// CLI
if (process.argv[1]?.endsWith('monitor.ts')) {
  const command = process.argv[2] || 'scan';

  console.log('═'.repeat(60));
  console.log('BeRight Arbitrage Monitor');
  console.log('═'.repeat(60));

  if (command === 'start') {
    // Start continuous monitoring
    startMonitor(30000, async (opp) => {
      console.log('\n' + formatOpportunityAlert(opp));
    });

    console.log('Press Ctrl+C to stop');

  } else if (command === 'scan') {
    // Single scan
    quickScan().then(result => {
      console.log(`\nRegistry: ${result.registrySize} matched pairs`);
      console.log(`Scan time: ${result.scanTime}ms`);
      console.log(`Active opportunities: ${result.opportunities.length}`);

      for (const opp of result.opportunities) {
        console.log(formatOpportunityAlert(opp));
      }
    });

  } else if (command === 'registry') {
    // Show registry
    refreshRegistry().then(() => {
      console.log(`\nRegistry: ${registry.entries.length} matched pairs`);
      for (const entry of registry.entries.slice(0, 20)) {
        console.log(`  ${entry.marketA.platform}: ${entry.marketA.title.slice(0, 30)}`);
        console.log(`  ${entry.marketB.platform}: ${entry.marketB.title.slice(0, 30)}`);
        console.log(`  Equivalence: ${(entry.equivalenceScore * 100).toFixed(0)}%`);
        console.log('');
      }
    });

  } else {
    console.log('Usage:');
    console.log('  npx ts-node lib/arbitrage/monitor.ts scan     - One-time scan');
    console.log('  npx ts-node lib/arbitrage/monitor.ts start    - Continuous monitoring');
    console.log('  npx ts-node lib/arbitrage/monitor.ts registry - Show matched pairs');
  }
}
