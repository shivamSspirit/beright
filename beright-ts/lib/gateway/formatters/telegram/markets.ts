/**
 * Market Formatting for Telegram
 * Formats market data, search results, comparisons
 */

import type { FormattedResponse } from '../../types';
import type { CommandContext, CommandResult } from '../../../orchestrator/types';
import type { MarketData } from '../types';
import {
  createResponse,
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
  getPriceEmoji,
  PLATFORM_EMOJIS,
  STATUS_EMOJIS,
  SEPARATOR,
} from './common';

/**
 * Extended market data with optional properties
 */
interface ExtendedMarketData extends MarketData {
  priceChange24h?: number;
  title?: string;
  yes_price?: number;
  volume?: number;
  change?: number;
}

/**
 * Arbitrage opportunity (formatter-specific format)
 */
interface ArbitrageOpportunity {
  platformA?: string;
  platformB?: string;
  topic?: string;
  question?: string;
  priceA?: number;
  priceB?: number;
  spread?: number;
  spreadPct?: number;
  strategy?: string;
  direction?: string;
  confidence?: string;
  platforms?: { platform: string; yesPrice: number; noPrice: number }[];
}

/**
 * DFlow search result data
 */
interface DFlowSearchData {
  markets?: ExtendedMarketData[];
}

/**
 * Compare result data
 */
interface CompareData {
  markets?: ExtendedMarketData[];
  query?: string;
  arbitrage?: ArbitrageOpportunity[];
}

/**
 * Alpha result data
 */
interface AlphaData {
  trending?: ExtendedMarketData[];
  arbitrage?: ArbitrageOpportunity[];
  movers?: ExtendedMarketData[];
}

/**
 * Brief result data
 */
interface BriefData {
  summary?: string;
  highlights?: string[];
  topMarkets?: ExtendedMarketData[];
}

/**
 * Format a list of markets (hot markets, search results)
 */
export function formatMarkets(
  markets: ExtendedMarketData[],
  context: CommandContext
): ExtendedResponse {
  if (!markets || markets.length === 0) {
    return createResponse('📊 No markets found.', { mood: 'NEUTRAL' });
  }

  const title = context.route.handler === 'hotMarkets' ? '🔥 HOT MARKETS' : '🔍 SEARCH RESULTS';
  let text = `${bold(title)}\n${SEPARATOR}\n\n`;

  for (let i = 0; i < Math.min(markets.length, 10); i++) {
    const m = markets[i];
    const platformEmoji = PLATFORM_EMOJIS[m.platform] || '📊';
    const priceEmoji = getPriceEmoji(m.priceChange24h || 0);

    text += `${i + 1}. ${priceEmoji} ${bold(truncate(m.question, 45))}\n`;
    text += `   ${platformEmoji} ${m.platform}`;
    text += ` | YES: ${formatPct(m.yesPrice)}`;

    if (m.volume24h) {
      text += ` | Vol: ${formatUsd(m.volume24h)}`;
    }

    text += '\n\n';
  }

  if (markets.length > 10) {
    text += italic(`...and ${markets.length - 10} more`);
  }

  return createResponse(text, { mood: 'NEUTRAL', data: { markets } });
}

/**
 * Format a single market detail
 */
export function formatMarket(
  market: ExtendedMarketData,
  _context: CommandContext
): ExtendedResponse {
  const platformEmoji = PLATFORM_EMOJIS[market.platform] || '📊';

  let text = `${platformEmoji} ${bold(market.question)}\n${SEPARATOR}\n\n`;

  text += `${kvLine('YES', formatPct(market.yesPrice))}\n`;
  text += `${kvLine('NO', formatPct(market.noPrice))}\n`;
  text += '\n';

  if (market.volume24h) {
    text += `${kvLine('24h Volume', formatUsd(market.volume24h))}\n`;
  }

  if (market.liquidity) {
    text += `${kvLine('Liquidity', formatUsd(market.liquidity))}\n`;
  }

  if (market.closeDate) {
    text += `${kvLine('Closes', formatDate(market.closeDate))}\n`;
  }

  text += '\n';
  if (market.url) {
    text += link('🔗 View on ' + market.platform, market.url);
  }

  return createResponse(text, { mood: 'NEUTRAL', data: market });
}

/**
 * Format DFlow search results
 */
export function formatDFlowSearch(
  result: CommandResult,
  _context: CommandContext
): ExtendedResponse {
  const data = (result.data || {}) as DFlowSearchData;
  const markets = data.markets || [];

  if (markets.length === 0) {
    return createResponse('🔷 No DFlow markets found.', { mood: 'NEUTRAL' });
  }

  let text = `${bold('🔷 DFLOW MARKETS')}\n${SEPARATOR}\n\n`;

  for (const market of markets.slice(0, 10)) {
    const priceEmoji = getPriceEmoji(0);
    text += `${priceEmoji} ${bold(truncate(market.title || market.question, 45))}\n`;
    text += `   YES: ${formatPct(market.yesPrice || market.yes_price || 0)}`;

    if (market.volume) {
      text += ` | Vol: ${formatUsd(market.volume)}`;
    }

    text += '\n\n';
  }

  return createResponse(text, { mood: 'NEUTRAL', data: result.data });
}

/**
 * Format arbitrage opportunities
 */
export function formatArbitrage(
  opportunities: ArbitrageOpportunity[],
  _context: CommandContext
): ExtendedResponse {
  if (!opportunities || opportunities.length === 0) {
    return createResponse(
      '💰 No arbitrage opportunities found.\n\n' +
      italic('Arbitrages are rare and fleeting. Check back later!'),
      { mood: 'NEUTRAL' }
    );
  }

  let text = `${bold('💰 ARBITRAGE OPPORTUNITIES')}\n${SEPARATOR}\n\n`;

  for (const arb of opportunities.slice(0, 5)) {
    const platformA = PLATFORM_EMOJIS[arb.platformA || ''] || '📊';
    const platformB = PLATFORM_EMOJIS[arb.platformB || ''] || '📊';

    text += `${STATUS_EMOJIS.fire} ${bold(truncate(arb.topic || arb.question || 'Unknown', 40))}\n`;
    text += `   ${platformA} ${arb.platformA || 'A'}: ${formatPct(arb.priceA || 0)}\n`;
    text += `   ${platformB} ${arb.platformB || 'B'}: ${formatPct(arb.priceB || 0)}\n`;
    text += `   ${STATUS_EMOJIS.money} Spread: ${bold(formatPct(arb.spread || arb.spreadPct || 0))}\n`;

    if (arb.strategy) {
      text += `   📋 ${italic(arb.strategy)}\n`;
    }

    text += '\n';
  }

  if (opportunities.length > 5) {
    text += italic(`...and ${opportunities.length - 5} more`);
  }

  return createResponse(text, { mood: 'ALERT', data: { opportunities } });
}

/**
 * Format odds comparison
 */
export function formatCompare(
  result: CommandResult,
  _context: CommandContext
): ExtendedResponse {
  const data = (result.data || {}) as CompareData;

  if (!data.markets || data.markets.length === 0) {
    return createResponse('📊 No comparable markets found.', { mood: 'NEUTRAL' });
  }

  let text = `${bold('📊 ODDS COMPARISON')}\n${SEPARATOR}\n\n`;

  if (data.query) {
    text += `Query: ${italic(data.query)}\n\n`;
  }

  // Group by platform
  const byPlatform: Record<string, ExtendedMarketData[]> = {};
  for (const market of data.markets) {
    if (!byPlatform[market.platform]) {
      byPlatform[market.platform] = [];
    }
    byPlatform[market.platform].push(market);
  }

  for (const [platform, markets] of Object.entries(byPlatform)) {
    const emoji = PLATFORM_EMOJIS[platform] || '📊';
    text += `${emoji} ${bold(platform.toUpperCase())}\n`;

    for (const m of markets.slice(0, 3)) {
      text += `   ${truncate(m.question, 35)}\n`;
      text += `   YES: ${formatPct(m.yesPrice)} | NO: ${formatPct(m.noPrice)}\n\n`;
    }
  }

  // Show arbitrage if exists
  if (data.arbitrage && data.arbitrage.length > 0) {
    text += `\n${STATUS_EMOJIS.money} ${bold('ARBITRAGE DETECTED!')}\n`;
    const arb = data.arbitrage[0];
    text += `   Spread: ${formatPct(arb.spread || arb.spreadPct || 0)}\n`;
  }

  return createResponse(text, { mood: 'NEUTRAL', data });
}

/**
 * Format alpha/opportunities
 */
export function formatAlpha(
  result: CommandResult,
  _context: CommandContext
): ExtendedResponse {
  const data = (result.data || {}) as AlphaData;

  let text = `${bold('🎯 ALPHA & OPPORTUNITIES')}\n${SEPARATOR}\n\n`;

  if (data.trending && data.trending.length > 0) {
    text += `${sectionHeader('Trending', '🔥')}\n`;
    for (const m of data.trending.slice(0, 3)) {
      text += `• ${truncate(m.question, 40)} - ${formatPct(m.yesPrice)}\n`;
    }
    text += '\n';
  }

  if (data.arbitrage && data.arbitrage.length > 0) {
    text += `${sectionHeader('Arbitrage', '💰')}\n`;
    for (const arb of data.arbitrage.slice(0, 2)) {
      text += `• ${truncate(arb.topic || arb.question || 'Unknown', 35)} - ${formatPct(arb.spread || arb.spreadPct || 0)} spread\n`;
    }
    text += '\n';
  }

  if (data.movers && data.movers.length > 0) {
    text += `${sectionHeader('Big Movers', '📈')}\n`;
    for (const m of data.movers.slice(0, 3)) {
      const change = m.change || m.priceChange24h || 0;
      const dir = change > 0 ? '↑' : '↓';
      text += `• ${truncate(m.question, 35)} ${dir}${formatPct(Math.abs(change))}\n`;
    }
  }

  if (!data.trending?.length && !data.arbitrage?.length && !data.movers?.length) {
    text += italic('No significant alpha detected right now. Check back later!');
  }

  return createResponse(text, { mood: 'BULLISH', data });
}

/**
 * Format brief/summary
 */
export function formatBrief(
  result: CommandResult,
  _context: CommandContext
): ExtendedResponse {
  const data = (result.data || {}) as BriefData;

  let text = `${bold('📰 MARKET BRIEF')}\n${SEPARATOR}\n\n`;

  if (data.summary) {
    text += `${data.summary}\n\n`;
  }

  if (data.highlights && data.highlights.length > 0) {
    text += `${sectionHeader('Highlights', '⭐')}\n`;
    for (const h of data.highlights.slice(0, 5)) {
      text += `• ${h}\n`;
    }
    text += '\n';
  }

  if (data.topMarkets && data.topMarkets.length > 0) {
    text += `${sectionHeader('Top Markets', '🔥')}\n`;
    for (const m of data.topMarkets.slice(0, 3)) {
      text += `• ${truncate(m.question, 40)} - ${formatPct(m.yesPrice)}\n`;
    }
  }

  return createResponse(text, { mood: 'NEUTRAL', data });
}
