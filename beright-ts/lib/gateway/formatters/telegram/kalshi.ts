/**
 * Kalshi-Specific Formatting for Telegram
 * Formats Kalshi markets, orders, positions, balance
 */

import type { FormattedResponse } from '../../types';
import type { CommandContext, CommandResult } from '../../../orchestrator/types';
import {
  createResponse,
  createSuccessResponse,
  ExtendedResponse,
  sectionHeader,
  kvLine,
  bold,
  italic,
  link,
  formatUsd,
  formatPct,
  formatDate,
  truncate,
  getPnLEmoji,
  STATUS_EMOJIS,
  SEPARATOR,
} from './common';

const KALSHI_EMOJI = '🟢';

/**
 * Kalshi data types for type-safe access
 */
interface KalshiOverviewData {
  isDemo?: boolean;
  balance?: number;
  portfolioValue?: number;
  totalValue?: number;
  positions?: KalshiPositionData[];
  payoutBalance?: number;
}

interface KalshiPositionData {
  title?: string;
  ticker?: string;
  market_ticker?: string;
  position?: number;
  pnl?: number;
  avgPrice?: number;
  currentValue?: number;
}

interface KalshiMarketData {
  ticker: string;
  title?: string;
  yes_bid?: number;
  lastPrice?: number;
  volume?: number;
  closeTime?: string;
}

interface KalshiOrderData {
  order_id?: string;
  id?: string;
  title?: string;
  ticker?: string;
  side?: string;
  action?: string;
  count?: number;
  quantity?: number;
  price?: number;
  yes_price?: number;
  cost?: number;
  proceeds?: number;
  status?: string;
  remaining_count?: number;
}

/**
 * Format Kalshi overview (balance + positions summary)
 */
export function formatKalshiOverview(
  result: CommandResult,
  _context: CommandContext
): ExtendedResponse {
  const data = (result.data || {}) as KalshiOverviewData;

  let text = `${bold(`${KALSHI_EMOJI} KALSHI OVERVIEW`)}\n${SEPARATOR}\n\n`;

  // Demo mode warning
  if (data?.isDemo) {
    text += `⚠️ ${italic('DEMO MODE - Not real money')}\n\n`;
  }

  // Balance
  if (data?.balance !== undefined) {
    text += `${sectionHeader('Balance', '💰')}\n`;
    text += `${kvLine('Available', formatUsd(data.balance / 100))}\n`; // Kalshi uses cents

    if (data.portfolioValue !== undefined) {
      text += `${kvLine('Portfolio', formatUsd(data.portfolioValue / 100))}\n`;
    }

    if (data.totalValue !== undefined) {
      text += `${kvLine('Total', formatUsd(data.totalValue / 100))}\n`;
    }

    text += '\n';
  }

  // Positions summary
  if (data?.positions && data.positions.length > 0) {
    text += `${sectionHeader('Positions', '📊')}\n`;
    text += `${data.positions.length} open position${data.positions.length > 1 ? 's' : ''}\n`;

    let totalPnL = 0;
    for (const pos of data.positions.slice(0, 3)) {
      const pnlEmoji = getPnLEmoji(pos.pnl || 0);
      text += `${pnlEmoji} ${truncate(pos.title || pos.ticker || 'Unknown', 30)}\n`;
      totalPnL += pos.pnl || 0;
    }

    if (data.positions.length > 3) {
      text += italic(`...and ${data.positions.length - 3} more\n`);
    }

    text += `\n${kvLine('Total P&L', formatUsd(totalPnL / 100))}\n`;
  } else {
    text += italic('No open positions.\n');
  }

  // Quick actions hint
  text += '\n' + italic('Use /kalshi markets, /kalshi buy, /kalshi positions');

  return createResponse(text, { mood: 'NEUTRAL', data });
}

/**
 * Format Kalshi markets list
 */
export function formatKalshiMarkets(
  result: CommandResult,
  _context: CommandContext
): ExtendedResponse {
  const data = (result.data || {}) as { markets?: KalshiMarketData[] };
  const markets = data.markets || [];

  if (markets.length === 0) {
    return createResponse(`${KALSHI_EMOJI} No Kalshi markets found.`, { mood: 'NEUTRAL' });
  }

  let text = `${bold(`${KALSHI_EMOJI} KALSHI MARKETS`)}\n${SEPARATOR}\n\n`;

  for (const market of markets.slice(0, 10)) {
    const yesPct = market.yes_bid || market.lastPrice || 0;

    text += `${bold(truncate(market.title || market.ticker, 45))}\n`;
    text += `   Ticker: \`${market.ticker}\`\n`;
    text += `   YES: ${yesPct}¢ | NO: ${100 - yesPct}¢\n`;

    if (market.volume) {
      text += `   Vol: ${formatUsd(market.volume / 100)}`;
    }

    if (market.closeTime) {
      text += ` | Closes: ${formatDate(market.closeTime)}`;
    }

    text += '\n\n';
  }

  if (markets.length > 10) {
    text += italic(`...and ${markets.length - 10} more`);
  }

  return createResponse(text, { mood: 'NEUTRAL', data: result.data });
}

/**
 * Format Kalshi buy confirmation
 */
export function formatKalshiBuy(
  result: CommandResult,
  _context: CommandContext
): ExtendedResponse {
  const data = (result.data || {}) as { order?: KalshiOrderData };

  if (!data.order) {
    return createResponse(`${STATUS_EMOJIS.error} Buy order failed.`, { mood: 'ERROR' });
  }

  const order = data.order;

  let text = `${STATUS_EMOJIS.success} ${bold('ORDER PLACED')}\n${SEPARATOR}\n\n`;

  text += `${kvLine('Market', truncate(order.title || order.ticker || 'Unknown', 40))}\n`;
  text += `${kvLine('Side', order.side?.toUpperCase() || 'YES')}\n`;
  text += `${kvLine('Quantity', String(order.count || order.quantity))}\n`;
  text += `${kvLine('Price', `${order.price || order.yes_price}¢`)}\n`;

  if (order.cost) {
    text += `${kvLine('Cost', formatUsd(order.cost / 100))}\n`;
  }

  text += `\n${kvLine('Order ID', `\`${order.order_id || order.id}\``)}\n`;
  text += `${kvLine('Status', order.status?.toUpperCase() || 'PENDING')}`;

  return createResponse(text, { mood: 'BULLISH', data });
}

/**
 * Format Kalshi sell confirmation
 */
export function formatKalshiSell(
  result: CommandResult,
  _context: CommandContext
): ExtendedResponse {
  const data = (result.data || {}) as { order?: KalshiOrderData };

  if (!data.order) {
    return createResponse(`${STATUS_EMOJIS.error} Sell order failed.`, { mood: 'ERROR' });
  }

  const order = data.order;

  let text = `${STATUS_EMOJIS.success} ${bold('SELL ORDER PLACED')}\n${SEPARATOR}\n\n`;

  text += `${kvLine('Market', truncate(order.title || order.ticker || 'Unknown', 40))}\n`;
  text += `${kvLine('Side', order.side?.toUpperCase() || 'YES')}\n`;
  text += `${kvLine('Quantity', String(order.count || order.quantity))}\n`;
  text += `${kvLine('Price', `${order.price || order.yes_price}¢`)}\n`;

  if (order.proceeds) {
    text += `${kvLine('Proceeds', formatUsd(order.proceeds / 100))}\n`;
  }

  text += `\n${kvLine('Order ID', `\`${order.order_id || order.id}\``)}\n`;
  text += `${kvLine('Status', order.status?.toUpperCase() || 'PENDING')}`;

  return createResponse(text, { mood: 'NEUTRAL', data });
}

/**
 * Format Kalshi positions
 */
export function formatKalshiPositions(
  result: CommandResult,
  _context: CommandContext
): ExtendedResponse {
  const data = (result.data || {}) as { positions?: KalshiPositionData[] };
  const positions = data.positions || [];

  if (positions.length === 0) {
    return createResponse(
      `${KALSHI_EMOJI} No Kalshi positions.\n\n` +
      italic('Use /kalshi buy <ticker> to open a position.'),
      { mood: 'NEUTRAL' }
    );
  }

  let text = `${bold(`${KALSHI_EMOJI} KALSHI POSITIONS`)}\n${SEPARATOR}\n\n`;

  let totalValue = 0;
  let totalPnL = 0;

  for (const pos of positions) {
    const pnlEmoji = getPnLEmoji(pos.pnl || 0);
    const positionValue = pos.position ?? 0;
    const side = positionValue > 0 ? 'YES' : 'NO';
    const qty = Math.abs(positionValue);

    text += `${pnlEmoji} ${bold(truncate(pos.title || pos.market_ticker || 'Unknown', 40))}\n`;
    text += `   ${side} x${qty} @ ${pos.avgPrice || '?'}¢\n`;

    if (pos.currentValue !== undefined) {
      text += `   Value: ${formatUsd(pos.currentValue / 100)}`;
      totalValue += pos.currentValue;
    }

    if (pos.pnl !== undefined) {
      const pnlSign = pos.pnl >= 0 ? '+' : '';
      text += ` | P&L: ${pnlSign}${formatUsd(pos.pnl / 100)}`;
      totalPnL += pos.pnl;
    }

    text += '\n\n';
  }

  text += SEPARATOR + '\n';
  text += `${kvLine('Total Value', formatUsd(totalValue / 100))}\n`;

  const totalPnLEmoji = getPnLEmoji(totalPnL);
  text += `${totalPnLEmoji} ${kvLine('Total P&L', formatUsd(totalPnL / 100))}`;

  return createResponse(text, {
    mood: totalPnL >= 0 ? 'BULLISH' : 'BEARISH',
    data: result.data,
  });
}

/**
 * Format Kalshi balance
 */
export function formatKalshiBalance(
  result: CommandResult,
  _context: CommandContext
): ExtendedResponse {
  const data = (result.data || {}) as KalshiOverviewData;

  let text = `${bold(`${KALSHI_EMOJI} KALSHI BALANCE`)}\n${SEPARATOR}\n\n`;

  if (data?.isDemo) {
    text += `⚠️ ${italic('DEMO ACCOUNT')}\n\n`;
  }

  if (data?.balance !== undefined) {
    text += `${kvLine('Available', formatUsd(data.balance / 100))}\n`;
  }

  if (data?.portfolioValue !== undefined) {
    text += `${kvLine('In Positions', formatUsd(data.portfolioValue / 100))}\n`;
  }

  if (data?.payoutBalance !== undefined) {
    text += `${kvLine('Pending Payout', formatUsd(data.payoutBalance / 100))}\n`;
  }

  const total = (data?.balance || 0) + (data?.portfolioValue || 0);
  text += `\n${bold(kvLine('Total', formatUsd(total / 100)))}`;

  return createResponse(text, { mood: 'NEUTRAL', data });
}

/**
 * Format Kalshi orders
 */
export function formatKalshiOrders(
  result: CommandResult,
  _context: CommandContext
): ExtendedResponse {
  const data = (result.data || {}) as { orders?: KalshiOrderData[] };
  const orders = data.orders || [];

  if (orders.length === 0) {
    return createResponse(
      `${KALSHI_EMOJI} No open orders.\n\n` +
      italic('All your limit orders have been filled or canceled.'),
      { mood: 'NEUTRAL' }
    );
  }

  let text = `${bold(`${KALSHI_EMOJI} OPEN ORDERS`)}\n${SEPARATOR}\n\n`;

  for (const order of orders.slice(0, 10)) {
    const sideEmoji = order.side === 'yes' ? '🟢' : '🔴';

    text += `${sideEmoji} ${bold(truncate(order.title || order.ticker || 'Unknown', 35))}\n`;
    text += `   ${order.action?.toUpperCase() || 'BUY'} ${order.side?.toUpperCase()} x${order.remaining_count || order.count}\n`;
    text += `   Price: ${order.yes_price || order.price}¢\n`;
    text += `   ID: \`${order.order_id}\`\n\n`;
  }

  if (orders.length > 10) {
    text += italic(`...and ${orders.length - 10} more orders`);
  }

  text += '\n' + italic('Use /kalshi cancel <order_id> to cancel');

  return createResponse(text, { mood: 'NEUTRAL', data: result.data });
}

/**
 * Format Kalshi cancel confirmation
 */
export function formatKalshiCancel(
  result: CommandResult,
  _context: CommandContext
): ExtendedResponse {
  const data = (result.data || {}) as { canceledCount?: number; order?: KalshiOrderData };

  if (data?.canceledCount !== undefined) {
    return createSuccessResponse(
      'Orders Canceled',
      `${data.canceledCount} order${data.canceledCount > 1 ? 's' : ''} canceled.`,
      { mood: 'NEUTRAL' }
    );
  }

  if (data?.order) {
    return createSuccessResponse(
      'Order Canceled',
      `Order \`${data.order.order_id}\` has been canceled.`,
      { mood: 'NEUTRAL' }
    );
  }

  return createResponse(`${STATUS_EMOJIS.success} Order canceled.`, { mood: 'NEUTRAL', data });
}
