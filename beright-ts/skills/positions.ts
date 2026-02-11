/**
 * Position Management for BeRight Protocol
 * Tracks open positions, calculates P&L, manages portfolio
 *
 * Commands:
 * /portfolio - View all positions with P&L
 * /position <marketId> - View specific position
 * /close <marketId> - Close a position (sell)
 * /pnl - Daily/weekly/all-time P&L report
 */

import * as fs from 'fs';
import * as path from 'path';
import { SkillResponse, Market, Platform } from '../types/index';
import { searchMarkets } from './markets';
import { formatUsd, formatPct, timestamp } from './utils';

const MEMORY_DIR = path.join(process.cwd(), 'memory');
const POSITIONS_FILE = path.join(MEMORY_DIR, 'positions.json');
const TRADES_HISTORY_FILE = path.join(MEMORY_DIR, 'trades-history.json');

// ============================================
// TYPES
// ============================================

export interface Position {
  id: string;
  telegramId: string;
  marketId: string;
  marketTitle: string;
  platform: Platform;
  direction: 'YES' | 'NO';
  shares: number;           // Number of shares
  avgEntryPrice: number;    // Average price paid per share (0-1)
  totalCost: number;        // Total USDC spent
  currentPrice: number;     // Current market price (0-1)
  unrealizedPnl: number;    // Current P&L if sold now
  unrealizedPnlPct: number; // P&L percentage
  status: 'open' | 'closed' | 'settled';
  openedAt: string;
  closedAt?: string;
  closePrice?: number;
  realizedPnl?: number;
  settlementDate?: string;
  notes?: string;
}

export interface TradeHistory {
  id: string;
  telegramId: string;
  positionId: string;
  marketId: string;
  platform: Platform;
  action: 'BUY' | 'SELL' | 'SETTLEMENT';
  direction: 'YES' | 'NO';
  shares: number;
  price: number;
  totalUsd: number;
  timestamp: string;
  txSignature?: string;
}

export interface PortfolioSummary {
  totalPositions: number;
  openPositions: number;
  totalInvested: number;
  currentValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  realizedPnl: number;
  totalPnl: number;
  winRate: number;
  bestPosition: Position | null;
  worstPosition: Position | null;
}

// ============================================
// STORAGE
// ============================================

function loadPositions(): Position[] {
  try {
    if (fs.existsSync(POSITIONS_FILE)) {
      return JSON.parse(fs.readFileSync(POSITIONS_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('Error loading positions:', error);
  }
  return [];
}

function savePositions(positions: Position[]): void {
  try {
    if (!fs.existsSync(MEMORY_DIR)) {
      fs.mkdirSync(MEMORY_DIR, { recursive: true });
    }
    fs.writeFileSync(POSITIONS_FILE, JSON.stringify(positions, null, 2));
  } catch (error) {
    console.error('Error saving positions:', error);
  }
}

function loadTradeHistory(): TradeHistory[] {
  try {
    if (fs.existsSync(TRADES_HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(TRADES_HISTORY_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('Error loading trade history:', error);
  }
  return [];
}

function saveTradeHistory(history: TradeHistory[]): void {
  try {
    if (!fs.existsSync(MEMORY_DIR)) {
      fs.mkdirSync(MEMORY_DIR, { recursive: true });
    }
    fs.writeFileSync(TRADES_HISTORY_FILE, JSON.stringify(history, null, 2));
  } catch (error) {
    console.error('Error saving trade history:', error);
  }
}

// ============================================
// POSITION MANAGEMENT
// ============================================

/**
 * Open a new position or add to existing
 */
export function openPosition(
  telegramId: string,
  market: Market,
  direction: 'YES' | 'NO',
  shares: number,
  pricePerShare: number,
  txSignature?: string
): Position {
  const positions = loadPositions();
  const history = loadTradeHistory();

  // Check for existing position in same market/direction
  let position = positions.find(
    p => p.telegramId === telegramId &&
        p.marketId === market.marketId &&
        p.direction === direction &&
        p.status === 'open'
  );

  const totalCost = shares * pricePerShare;

  if (position) {
    // Average into existing position
    const newTotalShares = position.shares + shares;
    const newTotalCost = position.totalCost + totalCost;
    position.avgEntryPrice = newTotalCost / newTotalShares;
    position.shares = newTotalShares;
    position.totalCost = newTotalCost;
  } else {
    // Create new position
    position = {
      id: `pos_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      telegramId,
      marketId: market.marketId || `gen_${Date.now()}`,
      marketTitle: market.title,
      platform: market.platform,
      direction,
      shares,
      avgEntryPrice: pricePerShare,
      totalCost,
      currentPrice: direction === 'YES' ? market.yesPrice : market.noPrice,
      unrealizedPnl: 0,
      unrealizedPnlPct: 0,
      status: 'open',
      openedAt: timestamp(),
      settlementDate: market.endDate?.toISOString(),
    };
    positions.push(position);
  }

  // Update P&L
  updatePositionPnl(position);

  // Record trade
  history.push({
    id: `trade_${Date.now()}`,
    telegramId,
    positionId: position.id,
    marketId: market.marketId || position.marketId,
    platform: market.platform,
    action: 'BUY',
    direction,
    shares,
    price: pricePerShare,
    totalUsd: totalCost,
    timestamp: timestamp(),
    txSignature,
  });

  savePositions(positions);
  saveTradeHistory(history);

  return position;
}

/**
 * Close a position (sell shares)
 */
export function closePosition(
  telegramId: string,
  positionId: string,
  sellPrice: number,
  sharesToSell?: number,
  txSignature?: string
): { position: Position; realizedPnl: number } | null {
  const positions = loadPositions();
  const history = loadTradeHistory();

  const positionIndex = positions.findIndex(
    p => p.id === positionId && p.telegramId === telegramId
  );

  if (positionIndex === -1) return null;

  const position = positions[positionIndex];
  const sellShares = sharesToSell || position.shares;

  if (sellShares > position.shares) {
    throw new Error('Cannot sell more shares than owned');
  }

  const proceeds = sellShares * sellPrice;
  const costBasis = sellShares * position.avgEntryPrice;
  const realizedPnl = proceeds - costBasis;

  // Record trade
  history.push({
    id: `trade_${Date.now()}`,
    telegramId,
    positionId: position.id,
    marketId: position.marketId,
    platform: position.platform,
    action: 'SELL',
    direction: position.direction,
    shares: sellShares,
    price: sellPrice,
    totalUsd: proceeds,
    timestamp: timestamp(),
    txSignature,
  });

  if (sellShares === position.shares) {
    // Full close
    position.status = 'closed';
    position.closedAt = timestamp();
    position.closePrice = sellPrice;
    position.realizedPnl = realizedPnl;
    position.shares = 0;
  } else {
    // Partial close
    position.shares -= sellShares;
    position.totalCost = position.shares * position.avgEntryPrice;
    position.realizedPnl = (position.realizedPnl || 0) + realizedPnl;
    updatePositionPnl(position);
  }

  savePositions(positions);
  saveTradeHistory(history);

  return { position, realizedPnl };
}

/**
 * Settle a position (market resolved)
 */
export function settlePosition(
  positionId: string,
  outcome: boolean // true = YES wins, false = NO wins
): Position | null {
  const positions = loadPositions();
  const position = positions.find(p => p.id === positionId);

  if (!position || position.status !== 'open') return null;

  // If direction matches outcome, each share pays $1
  // Otherwise, shares are worth $0
  const won = (position.direction === 'YES' && outcome) ||
              (position.direction === 'NO' && !outcome);

  const settlementValue = won ? position.shares : 0;
  const realizedPnl = settlementValue - position.totalCost;

  position.status = 'settled';
  position.closedAt = timestamp();
  position.closePrice = won ? 1 : 0;
  position.realizedPnl = realizedPnl;
  position.shares = 0;

  savePositions(positions);

  return position;
}

/**
 * Update position's current P&L based on market price
 */
function updatePositionPnl(position: Position): void {
  if (position.status !== 'open') return;

  const currentValue = position.shares * position.currentPrice;
  position.unrealizedPnl = currentValue - position.totalCost;
  position.unrealizedPnlPct = position.totalCost > 0
    ? (position.unrealizedPnl / position.totalCost) * 100
    : 0;
}

/**
 * Refresh all positions with current market prices
 */
export async function refreshPositionPrices(telegramId?: string): Promise<number> {
  const positions = loadPositions();
  const openPositions = positions.filter(
    p => p.status === 'open' && (!telegramId || p.telegramId === telegramId)
  );

  let updated = 0;

  for (const position of openPositions) {
    try {
      // Fetch current market data
      const markets = await searchMarkets(position.marketTitle.slice(0, 30), [position.platform]);
      const market = markets.find(m => m.marketId === position.marketId);

      if (market) {
        position.currentPrice = position.direction === 'YES'
          ? market.yesPrice
          : market.noPrice;
        updatePositionPnl(position);
        updated++;
      }
    } catch (error) {
      console.error(`Failed to refresh position ${position.id}:`, error);
    }
  }

  savePositions(positions);
  return updated;
}

// ============================================
// PORTFOLIO QUERIES
// ============================================

/**
 * Get all positions for a user
 */
export function getUserPositions(telegramId: string, status?: 'open' | 'closed' | 'settled'): Position[] {
  const positions = loadPositions();
  return positions.filter(
    p => p.telegramId === telegramId && (!status || p.status === status)
  );
}

/**
 * Get portfolio summary
 */
export function getPortfolioSummary(telegramId: string): PortfolioSummary {
  const positions = getUserPositions(telegramId);
  const openPositions = positions.filter(p => p.status === 'open');
  const closedPositions = positions.filter(p => p.status !== 'open');

  const totalInvested = openPositions.reduce((sum, p) => sum + p.totalCost, 0);
  const currentValue = openPositions.reduce((sum, p) => sum + (p.shares * p.currentPrice), 0);
  const unrealizedPnl = currentValue - totalInvested;
  const realizedPnl = closedPositions.reduce((sum, p) => sum + (p.realizedPnl || 0), 0);

  const wins = closedPositions.filter(p => (p.realizedPnl || 0) > 0).length;
  const winRate = closedPositions.length > 0 ? wins / closedPositions.length : 0;

  // Best/worst positions
  let bestPosition: Position | null = null;
  let worstPosition: Position | null = null;

  for (const p of openPositions) {
    if (!bestPosition || p.unrealizedPnlPct > bestPosition.unrealizedPnlPct) {
      bestPosition = p;
    }
    if (!worstPosition || p.unrealizedPnlPct < worstPosition.unrealizedPnlPct) {
      worstPosition = p;
    }
  }

  return {
    totalPositions: positions.length,
    openPositions: openPositions.length,
    totalInvested,
    currentValue,
    unrealizedPnl,
    unrealizedPnlPct: totalInvested > 0 ? (unrealizedPnl / totalInvested) * 100 : 0,
    realizedPnl,
    totalPnl: unrealizedPnl + realizedPnl,
    winRate,
    bestPosition,
    worstPosition,
  };
}

/**
 * Get P&L report for time period
 */
export function getPnlReport(telegramId: string, days: number = 7): {
  period: string;
  trades: number;
  volume: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  byCategory: Record<string, number>;
} {
  const history = loadTradeHistory().filter(t => t.telegramId === telegramId);
  const positions = getUserPositions(telegramId);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const periodTrades = history.filter(t => new Date(t.timestamp) > cutoff);
  const volume = periodTrades.reduce((sum, t) => sum + t.totalUsd, 0);

  // Calculate realized P&L from closed positions in period
  const closedInPeriod = positions.filter(
    p => p.closedAt && new Date(p.closedAt) > cutoff
  );
  const realizedPnl = closedInPeriod.reduce((sum, p) => sum + (p.realizedPnl || 0), 0);

  // Unrealized P&L from open positions
  const openPositions = positions.filter(p => p.status === 'open');
  const unrealizedPnl = openPositions.reduce((sum, p) => sum + p.unrealizedPnl, 0);

  // Group by platform/category
  const byCategory: Record<string, number> = {};
  for (const p of positions) {
    const pnl = p.status === 'open' ? p.unrealizedPnl : (p.realizedPnl || 0);
    byCategory[p.platform] = (byCategory[p.platform] || 0) + pnl;
  }

  return {
    period: `${days}d`,
    trades: periodTrades.length,
    volume,
    realizedPnl,
    unrealizedPnl,
    totalPnl: realizedPnl + unrealizedPnl,
    byCategory,
  };
}

/**
 * Get positions expiring soon (for settlement reminders)
 */
export function getExpiringPositions(telegramId: string, withinDays: number = 7): Position[] {
  const positions = getUserPositions(telegramId, 'open');
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + withinDays);

  return positions.filter(p => {
    if (!p.settlementDate) return false;
    const settlement = new Date(p.settlementDate);
    return settlement <= cutoff && settlement > new Date();
  });
}

// ============================================
// TELEGRAM HANDLERS
// ============================================

/**
 * Handle /portfolio command
 */
export async function handlePortfolio(telegramId: string): Promise<SkillResponse> {
  // Refresh prices first
  await refreshPositionPrices(telegramId);

  const summary = getPortfolioSummary(telegramId);
  const positions = getUserPositions(telegramId, 'open');

  if (positions.length === 0) {
    return {
      text: `
*PORTFOLIO*
${'─'.repeat(35)}

No open positions.

*Commands:*
/buy <market> YES/NO <amount> - Open position
/hot - Find trending markets
/arb - Find arbitrage opportunities
`,
      mood: 'NEUTRAL',
    };
  }

  let positionsList = '';
  for (const p of positions.slice(0, 8)) {
    const pnlEmoji = p.unrealizedPnl >= 0 ? '+' : '';
    const pnlColor = p.unrealizedPnl >= 0 ? '' : '';
    positionsList += `
*${p.direction}* ${p.marketTitle.slice(0, 35)}
  Entry: ${(p.avgEntryPrice * 100).toFixed(1)}c | Now: ${(p.currentPrice * 100).toFixed(1)}c
  P&L: ${pnlEmoji}$${p.unrealizedPnl.toFixed(2)} (${pnlEmoji}${p.unrealizedPnlPct.toFixed(1)}%)
`;
  }

  const totalPnlEmoji = summary.totalPnl >= 0 ? '+' : '';

  return {
    text: `
*PORTFOLIO*
${'─'.repeat(35)}

*Summary*
Invested: $${summary.totalInvested.toFixed(2)}
Current:  $${summary.currentValue.toFixed(2)}
P&L:      ${totalPnlEmoji}$${summary.totalPnl.toFixed(2)} (${totalPnlEmoji}${summary.unrealizedPnlPct.toFixed(1)}%)

*Open Positions (${summary.openPositions})*
${positionsList}

${positions.length > 8 ? `... and ${positions.length - 8} more\n` : ''}
*Commands:*
/pnl - Detailed P&L report
/close <id> - Close position
/alerts - Set price alerts
`,
    mood: summary.totalPnl >= 0 ? 'BULLISH' : 'BEARISH',
    data: { summary, positions },
  };
}

/**
 * Handle /pnl command
 */
export async function handlePnl(telegramId: string, days?: number): Promise<SkillResponse> {
  const period = days || 7;
  const report = getPnlReport(telegramId, period);
  const allTimeReport = getPnlReport(telegramId, 365);

  const pnlEmoji = report.totalPnl >= 0 ? '+' : '';

  let categoryBreakdown = '';
  for (const [platform, pnl] of Object.entries(report.byCategory)) {
    const emoji = pnl >= 0 ? '+' : '';
    categoryBreakdown += `  ${platform}: ${emoji}$${pnl.toFixed(2)}\n`;
  }

  return {
    text: `
*P&L REPORT*
${'─'.repeat(35)}

*${period}-Day Performance*
Trades:     ${report.trades}
Volume:     $${formatUsd(report.volume)}
Realized:   ${report.realizedPnl >= 0 ? '+' : ''}$${report.realizedPnl.toFixed(2)}
Unrealized: ${report.unrealizedPnl >= 0 ? '+' : ''}$${report.unrealizedPnl.toFixed(2)}
*Total:     ${pnlEmoji}$${report.totalPnl.toFixed(2)}*

*By Platform*
${categoryBreakdown}
*All-Time*
Total P&L: ${allTimeReport.totalPnl >= 0 ? '+' : ''}$${allTimeReport.totalPnl.toFixed(2)}
Win Rate:  ${(getPortfolioSummary(telegramId).winRate * 100).toFixed(0)}%

/pnl 30 - 30-day report
/portfolio - View positions
`,
    mood: report.totalPnl >= 0 ? 'BULLISH' : 'BEARISH',
    data: report,
  };
}

/**
 * Handle /expiring command - positions settling soon
 */
export function handleExpiring(telegramId: string): SkillResponse {
  const expiring = getExpiringPositions(telegramId, 7);

  if (expiring.length === 0) {
    return {
      text: `No positions settling in the next 7 days.`,
      mood: 'NEUTRAL',
    };
  }

  let list = '';
  for (const p of expiring) {
    const daysLeft = Math.ceil(
      (new Date(p.settlementDate!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    list += `
*${p.direction}* ${p.marketTitle.slice(0, 35)}
  Settles: ${daysLeft}d | P&L: ${p.unrealizedPnl >= 0 ? '+' : ''}$${p.unrealizedPnl.toFixed(2)}
`;
  }

  return {
    text: `
*POSITIONS SETTLING SOON*
${'─'.repeat(35)}
${list}

Consider:
- Taking profit if odds moved in your favor
- Cutting losses if outlook changed
- Letting it ride if you're confident
`,
    mood: 'ALERT',
    data: expiring,
  };
}

// ============================================
// CLI
// ============================================

if (process.argv[1]?.endsWith('positions.ts')) {
  const args = process.argv.slice(2);
  const command = args[0];

  (async () => {
    if (command === 'list') {
      const telegramId = args[1] || 'test_user';
      const positions = getUserPositions(telegramId);
      console.log(`Positions for ${telegramId}:`);
      for (const p of positions) {
        console.log(`  ${p.direction} ${p.marketTitle.slice(0, 40)}`);
        console.log(`    Entry: ${(p.avgEntryPrice * 100).toFixed(1)}c | Current: ${(p.currentPrice * 100).toFixed(1)}c`);
        console.log(`    P&L: $${p.unrealizedPnl.toFixed(2)} (${p.unrealizedPnlPct.toFixed(1)}%)`);
      }
    } else if (command === 'summary') {
      const telegramId = args[1] || 'test_user';
      const summary = getPortfolioSummary(telegramId);
      console.log('Portfolio Summary:', JSON.stringify(summary, null, 2));
    } else if (command === 'refresh') {
      const count = await refreshPositionPrices();
      console.log(`Refreshed ${count} positions`);
    } else {
      console.log(`
Usage:
  ts-node positions.ts list [telegramId]     - List positions
  ts-node positions.ts summary [telegramId]  - Portfolio summary
  ts-node positions.ts refresh               - Refresh all prices
`);
    }
  })();
}

export default { getUserPositions, getPortfolioSummary, openPosition, closePosition };
