/**
 * Portfolio Formatting for Telegram
 * Formats positions, P&L, portfolio summaries
 */

import type { FormattedResponse } from '../../types';
import type { CommandContext, CommandResult } from '../../../orchestrator/types';
import type { PositionData } from '../types';
import {
  createResponse,
  ExtendedResponse,
  sectionHeader,
  kvLine,
  bold,
  italic,
  formatUsd,
  formatPct,
  truncate,
  getPnLEmoji,
  PLATFORM_EMOJIS,
  STATUS_EMOJIS,
  SEPARATOR,
} from './common';

/**
 * Extended position data with platform
 */
interface ExtendedPositionData extends PositionData {
  platform?: string;
  quantity?: number;
  ticker?: string;
}

/**
 * Balance data
 */
interface BalanceData {
  available?: number;
  locked?: number;
}

/**
 * Performance data
 */
interface PerformanceData {
  totalPnL?: number;
  winRate?: number;
  tradesCount?: number;
}

/**
 * Trade data
 */
interface TradeData {
  market?: string;
  ticker?: string;
  side?: string;
  pnl: number;
}

/**
 * Portfolio result data
 */
interface PortfolioData {
  balance?: number | BalanceData;
  positions?: ExtendedPositionData[];
  performance?: PerformanceData;
}

/**
 * PnL summary data
 */
interface PnLSummaryData {
  totalPnL?: number;
  realizedPnL?: number;
  unrealizedPnL?: number;
}

/**
 * PnL result data
 */
interface PnLData {
  summary?: PnLSummaryData;
  byPlatform?: Record<string, number>;
  recentTrades?: TradeData[];
}

/**
 * User stats data
 */
interface UserStatsData {
  predictionCount?: number;
  brierScore?: number;
  winRate?: number;
  totalPnL?: number;
}

/**
 * Wallet data
 */
interface WalletEntry {
  address: string;
  platform: string;
}

/**
 * User profile data
 */
interface UserProfileData {
  username?: string;
  tier?: string;
  stats?: UserStatsData;
  wallets?: WalletEntry[];
}

/**
 * Prediction data
 */
interface PredictionData {
  market: string;
  probability: number;
  outcome?: string;
  correct?: boolean;
}

/**
 * Calibration result data
 */
interface CalibrationData {
  brierScore?: number;
  predictionCount?: number;
  resolvedCount?: number;
  pendingCount?: number;
  recentPredictions?: PredictionData[];
}

/**
 * Leaderboard user data
 */
interface LeaderboardUser {
  id?: string;
  username?: string;
  name?: string;
  brierScore?: number;
  predictionCount?: number;
}

/**
 * Leaderboard result data
 */
interface LeaderboardData {
  users?: LeaderboardUser[];
  leaderboard?: LeaderboardUser[];
  userRank?: number;
}

/**
 * Positions result data
 */
interface PositionsResultData {
  positions?: ExtendedPositionData[];
}

/**
 * Format positions list
 */
export function formatPositions(
  positions: ExtendedPositionData[],
  _context: CommandContext
): ExtendedResponse {
  if (!positions || positions.length === 0) {
    return createResponse(
      '📊 No open positions.\n\n' +
      italic('Start trading to see your positions here!'),
      { mood: 'NEUTRAL' }
    );
  }

  let text = `${bold('📊 YOUR POSITIONS')}\n${SEPARATOR}\n\n`;

  let totalValue = 0;
  let totalPnL = 0;

  for (const pos of positions) {
    const pnlEmoji = getPnLEmoji(pos.unrealizedPnL);
    const pnlSign = pos.unrealizedPnL >= 0 ? '+' : '';
    const platformEmoji = PLATFORM_EMOJIS[pos.platform || pos.market?.platform || ''] || '📊';

    text += `${platformEmoji} ${bold(truncate(pos.market?.question || pos.ticker || 'Unknown', 40))}\n`;
    text += `   Side: ${pos.side.toUpperCase()} | Qty: ${pos.quantity || pos.shares}\n`;
    text += `   Value: ${formatUsd(pos.currentValue)}\n`;
    text += `   ${pnlEmoji} P&L: ${pnlSign}${formatUsd(pos.unrealizedPnL)} (${pnlSign}${formatPct(pos.unrealizedPnLPct)})\n\n`;

    totalValue += pos.currentValue;
    totalPnL += pos.unrealizedPnL;
  }

  text += SEPARATOR + '\n';
  text += `${kvLine('Total Value', formatUsd(totalValue))}\n`;

  const totalPnLEmoji = getPnLEmoji(totalPnL);
  const totalPnLSign = totalPnL >= 0 ? '+' : '';
  text += `${totalPnLEmoji} ${kvLine('Total P&L', `${totalPnLSign}${formatUsd(totalPnL)}`)}`;

  return createResponse(text, {
    mood: totalPnL >= 0 ? 'BULLISH' : 'BEARISH',
    data: { positions, totalValue, totalPnL },
  });
}

/**
 * Format positions result from command
 */
export function formatPositionsResult(
  result: CommandResult,
  context: CommandContext
): ExtendedResponse {
  const data = (result.data || {}) as PositionsResultData;
  const positions = data.positions || [];
  return formatPositions(positions, context);
}

/**
 * Format portfolio summary
 */
export function formatPortfolio(
  result: CommandResult,
  _context: CommandContext
): ExtendedResponse {
  const data = (result.data || {}) as PortfolioData;

  let text = `${bold('📈 PORTFOLIO SUMMARY')}\n${SEPARATOR}\n\n`;

  // Balance section
  if (data.balance !== undefined) {
    text += `${sectionHeader('Balance', '💰')}\n`;
    const balanceValue = typeof data.balance === 'number'
      ? data.balance
      : (data.balance as BalanceData).available || 0;
    text += `${kvLine('Available', formatUsd(balanceValue))}\n`;

    if (typeof data.balance === 'object' && data.balance.locked) {
      text += `${kvLine('In Orders', formatUsd(data.balance.locked))}\n`;
    }

    text += '\n';
  }

  // Positions section
  if (data.positions && data.positions.length > 0) {
    text += `${sectionHeader('Positions', '📊')}\n`;

    let totalValue = 0;
    let totalPnL = 0;

    for (const pos of data.positions.slice(0, 5)) {
      const pnlEmoji = getPnLEmoji(pos.unrealizedPnL);
      text += `${pnlEmoji} ${truncate(pos.market?.question || pos.ticker || 'Unknown', 30)}\n`;
      text += `   ${formatUsd(pos.currentValue)} (${pos.unrealizedPnL >= 0 ? '+' : ''}${formatUsd(pos.unrealizedPnL)})\n`;

      totalValue += pos.currentValue || 0;
      totalPnL += pos.unrealizedPnL || 0;
    }

    if (data.positions.length > 5) {
      text += italic(`...and ${data.positions.length - 5} more positions\n`);
    }

    text += '\n';
    text += `${kvLine('Portfolio Value', formatUsd(totalValue))}\n`;
    text += `${kvLine('Unrealized P&L', `${totalPnL >= 0 ? '+' : ''}${formatUsd(totalPnL)}`)}\n`;
  } else {
    text += italic('No open positions.\n');
  }

  // Performance section
  if (data.performance) {
    text += '\n';
    text += `${sectionHeader('Performance', '📈')}\n`;

    if (data.performance.totalPnL !== undefined) {
      const pnlEmoji = getPnLEmoji(data.performance.totalPnL);
      text += `${pnlEmoji} ${kvLine('Total P&L', formatUsd(data.performance.totalPnL))}\n`;
    }

    if (data.performance.winRate !== undefined) {
      text += `${kvLine('Win Rate', formatPct(data.performance.winRate))}\n`;
    }

    if (data.performance.tradesCount !== undefined) {
      text += `${kvLine('Total Trades', String(data.performance.tradesCount))}\n`;
    }
  }

  return createResponse(text, { mood: 'NEUTRAL', data });
}

/**
 * Format P&L report
 */
export function formatPnl(
  result: CommandResult,
  _context: CommandContext
): ExtendedResponse {
  const data = (result.data || {}) as PnLData;

  let text = `${bold('💰 P&L REPORT')}\n${SEPARATOR}\n\n`;

  // Summary
  if (data.summary) {
    const totalPnL = data.summary.totalPnL || 0;
    const pnlEmoji = getPnLEmoji(totalPnL);
    const pnlSign = totalPnL >= 0 ? '+' : '';

    text += `${pnlEmoji} ${bold('Total P&L:')} ${pnlSign}${formatUsd(totalPnL)}\n\n`;

    if (data.summary.realizedPnL !== undefined) {
      text += `${kvLine('Realized', formatUsd(data.summary.realizedPnL))}\n`;
    }

    if (data.summary.unrealizedPnL !== undefined) {
      text += `${kvLine('Unrealized', formatUsd(data.summary.unrealizedPnL))}\n`;
    }

    text += '\n';
  }

  // By platform
  if (data.byPlatform && Object.keys(data.byPlatform).length > 0) {
    text += `${sectionHeader('By Platform', '📊')}\n`;

    for (const [platform, pnl] of Object.entries(data.byPlatform)) {
      const emoji = PLATFORM_EMOJIS[platform] || '📊';
      const pnlValue = pnl as number;
      const pnlEmoji = getPnLEmoji(pnlValue);
      text += `${emoji} ${platform}: ${pnlEmoji} ${pnlValue >= 0 ? '+' : ''}${formatUsd(pnlValue)}\n`;
    }

    text += '\n';
  }

  // Recent trades
  if (data.recentTrades && data.recentTrades.length > 0) {
    text += `${sectionHeader('Recent Trades', '📝')}\n`;

    for (const trade of data.recentTrades.slice(0, 5)) {
      const pnlEmoji = getPnLEmoji(trade.pnl || 0);
      text += `${pnlEmoji} ${truncate(trade.market || trade.ticker || 'Unknown', 30)}\n`;
      text += `   ${trade.side?.toUpperCase() || 'TRADE'}: ${trade.pnl >= 0 ? '+' : ''}${formatUsd(trade.pnl)}\n`;
    }
  }

  return createResponse(text, {
    mood: (data.summary?.totalPnL || 0) >= 0 ? 'BULLISH' : 'BEARISH',
    data,
  });
}

/**
 * Format user profile (/me)
 */
export function formatMe(
  result: CommandResult,
  _context: CommandContext
): ExtendedResponse {
  const data = (result.data || {}) as UserProfileData;

  let text = `${bold('👤 YOUR PROFILE')}\n${SEPARATOR}\n\n`;

  if (data.username) {
    text += `${kvLine('Username', data.username)}\n`;
  }

  if (data.tier) {
    const tierEmojis: Record<string, string> = {
      free: '🆓',
      basic: '⭐',
      pro: '💎',
      whale: '🐋',
    };
    text += `${kvLine('Tier', `${tierEmojis[data.tier] || ''} ${data.tier.toUpperCase()}`)}\n`;
  }

  text += '\n';

  // Stats
  if (data.stats) {
    text += `${sectionHeader('Stats', '📊')}\n`;

    if (data.stats.predictionCount !== undefined) {
      text += `${kvLine('Predictions', String(data.stats.predictionCount))}\n`;
    }

    if (data.stats.brierScore !== undefined) {
      text += `${kvLine('Brier Score', data.stats.brierScore.toFixed(3))}\n`;
    }

    if (data.stats.winRate !== undefined) {
      text += `${kvLine('Win Rate', formatPct(data.stats.winRate))}\n`;
    }

    if (data.stats.totalPnL !== undefined) {
      const pnlEmoji = getPnLEmoji(data.stats.totalPnL);
      text += `${pnlEmoji} ${kvLine('Total P&L', formatUsd(data.stats.totalPnL))}\n`;
    }
  }

  // Connected wallets
  if (data.wallets && data.wallets.length > 0) {
    text += '\n';
    text += `${sectionHeader('Wallets', '💳')}\n`;

    for (const wallet of data.wallets) {
      const shortAddr = wallet.address.slice(0, 6) + '...' + wallet.address.slice(-4);
      text += `• ${shortAddr} (${wallet.platform})\n`;
    }
  }

  return createResponse(text, { mood: 'NEUTRAL', data });
}

/**
 * Format calibration stats
 */
export function formatCalibration(
  result: CommandResult,
  _context: CommandContext
): ExtendedResponse {
  const data = (result.data || {}) as CalibrationData;

  let text = `${bold('🎯 CALIBRATION')}\n${SEPARATOR}\n\n`;

  if (data.brierScore !== undefined) {
    const scoreEmoji = data.brierScore < 0.25 ? '🏆' : data.brierScore < 0.5 ? '👍' : '📈';
    text += `${scoreEmoji} ${bold('Brier Score:')} ${data.brierScore.toFixed(3)}\n`;
    text += italic(getBrierInterpretation(data.brierScore)) + '\n\n';
  }

  if (data.predictionCount !== undefined) {
    text += `${kvLine('Total Predictions', String(data.predictionCount))}\n`;
  }

  if (data.resolvedCount !== undefined) {
    text += `${kvLine('Resolved', String(data.resolvedCount))}\n`;
  }

  if (data.pendingCount !== undefined) {
    text += `${kvLine('Pending', String(data.pendingCount))}\n`;
  }

  text += '\n';

  // Recent predictions
  if (data.recentPredictions && data.recentPredictions.length > 0) {
    text += `${sectionHeader('Recent Predictions', '📝')}\n`;

    for (const pred of data.recentPredictions.slice(0, 5)) {
      const statusEmoji = pred.correct === true ? '✅' : pred.correct === false ? '❌' : '⏳';
      text += `${statusEmoji} ${truncate(pred.market, 35)}\n`;
      text += `   You: ${formatPct(pred.probability)} | Actual: ${pred.outcome || 'pending'}\n`;
    }
  }

  return createResponse(text, { mood: 'EDUCATIONAL', data });
}

/**
 * Format leaderboard
 */
export function formatLeaderboard(
  result: CommandResult,
  _context: CommandContext
): ExtendedResponse {
  const data = (result.data || {}) as LeaderboardData;
  const users = data.users || data.leaderboard || [];

  let text = `${bold('🏆 LEADERBOARD')}\n${SEPARATOR}\n\n`;

  if (users.length === 0) {
    text += italic('No leaderboard data available yet.');
    return createResponse(text, { mood: 'NEUTRAL' });
  }

  const medals = ['🥇', '🥈', '🥉'];

  for (let i = 0; i < Math.min(users.length, 10); i++) {
    const user = users[i];
    const rank = i < 3 ? medals[i] : `${i + 1}.`;
    const name = user.username || user.name || `User ${user.id?.slice(0, 6) || 'Unknown'}`;

    text += `${rank} ${bold(name)}\n`;

    if (user.brierScore !== undefined) {
      text += `   Brier: ${user.brierScore.toFixed(3)}`;
    }

    if (user.predictionCount !== undefined) {
      text += ` | Predictions: ${user.predictionCount}`;
    }

    text += '\n';
  }

  // Show user's rank if available
  if (data.userRank) {
    text += '\n' + SEPARATOR + '\n';
    text += `📍 ${bold('Your Rank:')} #${data.userRank}`;
  }

  return createResponse(text, { mood: 'NEUTRAL', data });
}

/**
 * Get interpretation of Brier score
 */
function getBrierInterpretation(score: number): string {
  if (score < 0.1) return 'Exceptional! You\'re a superforecaster.';
  if (score < 0.2) return 'Excellent calibration.';
  if (score < 0.3) return 'Good calibration.';
  if (score < 0.4) return 'Room for improvement.';
  return 'Keep practicing your forecasting skills.';
}
