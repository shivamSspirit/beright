/**
 * Telegram Formatter
 *
 * Transforms CommandResult data into Telegram-specific markdown.
 *
 * Features:
 * - Markdown formatting (bold, italic, code, links)
 * - Emoji usage for visual clarity
 * - Inline keyboard buttons
 * - Respects Telegram's 4096 char limit
 *
 * @see docs/ADR-001-GATEWAY-SKILL-SEPARATION.md
 */

import { FormattedResponse, Button } from '../types';
import { CommandContext, CommandResult, Mood, ErrorResult } from '../../orchestrator/types';
import {
  Formatter,
  MarketData,
  PositionData,
  TradeData,
  ResearchData,
  ArbitrageData,
  WalletData,
  formatUtils,
  getFormatterRegistry,
} from './types';

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_MESSAGE_LENGTH = 4096;
const SEPARATOR = '─'.repeat(30);

// Mood emojis for Telegram
const MOOD_EMOJIS: Record<Mood, string> = {
  BULLISH: '🟢',
  BEARISH: '🔴',
  NEUTRAL: '⚪',
  ALERT: '🔔',
  EDUCATIONAL: '📚',
  ERROR: '❌',
};

// =============================================================================
// TELEGRAM FORMATTER
// =============================================================================

/**
 * Telegram Formatter
 *
 * Formats CommandResult data for Telegram display.
 */
export class TelegramFormatter implements Formatter {
  name = 'telegram' as const;

  // ===========================================================================
  // GENERIC FORMATTING
  // ===========================================================================

  /**
   * Format a command result
   */
  format(result: CommandResult, context: CommandContext): FormattedResponse {
    if (!result.success && result.error) {
      return this.formatError(result.error, context);
    }

    // Dispatch to type-specific formatter based on handler
    const handlerId = context.route.handler;

    switch (handlerId) {
      case 'hotMarkets':
        return this.formatMarkets(result.data as MarketData[], context);

      case 'dflowSearch':
        return this.formatDFlowSearch(result, context);

      case 'brief':
        return this.formatBrief(result, context);

      case 'positions':
        return this.formatPositionsResult(result, context);

      case 'trade':
        return this.formatTradeResult(result, context);

      case 'research':
        return this.formatResearchResult(result, context);

      case 'alpha':
        return this.formatAlpha(result, context);

      case 'quote':
        return this.formatQuote(result, context);

      case 'arbitrage':
        return this.formatArbitrage(result.data as ArbitrageData[], context);

      case 'wallet':
        return this.formatWallet(result.data as WalletData, context);

      // Kalshi handlers
      case 'kalshiOverview':
        return this.formatKalshiOverview(result, context);

      case 'kalshiMarkets':
        return this.formatKalshiMarkets(result, context);

      case 'kalshiBuy':
        return this.formatKalshiBuy(result, context);

      case 'kalshiSell':
        return this.formatKalshiSell(result, context);

      case 'kalshiPositions':
        return this.formatKalshiPositions(result, context);

      case 'kalshiBalance':
        return this.formatKalshiBalance(result, context);

      case 'kalshiOrders':
        return this.formatKalshiOrders(result, context);

      case 'kalshiCancel':
        return this.formatKalshiCancel(result, context);

      // Portfolio & Analytics handlers
      case 'portfolio':
        return this.formatPortfolio(result, context);

      case 'pnl':
        return this.formatPnl(result, context);

      case 'me':
        return this.formatMe(result, context);

      case 'calibration':
        return this.formatCalibration(result, context);

      case 'leaderboard':
        return this.formatLeaderboard(result, context);

      case 'compare':
        return this.formatCompare(result, context);

      // Predictions & Intelligence handlers
      case 'predict':
        return this.formatPredict(result, context);

      case 'smartPredict':
        return this.formatSmartPredict(result, context);

      case 'intelligence':
        return this.formatIntelligence(result, context);

      case 'recommendations':
        return this.formatRecommendations(result, context);

      case 'feedback':
        return this.formatFeedback(result, context);

      case 'learnings':
        return this.formatLearnings(result, context);

      // Trading & Execution handlers
      case 'swap':
        return this.formatSwap(result, context);

      case 'follow':
        return this.formatFollow(result, context);

      case 'signals':
        return this.formatSignals(result, context);

      // Monitoring & Alerts handlers
      case 'alert':
        return this.formatAlert(result, context);

      case 'whale':
        return this.formatWhale(result, context);

      case 'arbitrage':
        return this.formatArbitrage(result, context);

      case 'subscribe':
        return this.formatSubscribe(result, context);

      // System handlers
      case 'help':
        return this.formatHelp(result, context);

      case 'settings':
        return this.formatSettings(result, context);

      case 'semantic':
        // Semantic responses come pre-formatted from the semantic orchestrator
        return this.formatSemantic(result, context);

      default:
        // Generic fallback formatting
        return this.formatGeneric(result, context);
    }
  }

  /**
   * Format an error
   */
  formatError(error: ErrorResult, _context: CommandContext): FormattedResponse {
    const emoji = MOOD_EMOJIS.ERROR;
    let text = `${emoji} *Error*\n${SEPARATOR}\n\n`;

    text += error.message;

    if (error.recoveryAction) {
      text += `\n\n💡 *Try:* ${error.recoveryAction}`;
    }

    if (error.retryable) {
      text += '\n\n_This error may be temporary. Try again in a moment._';
    }

    return {
      text,
      parseMode: 'Markdown',
    };
  }

  // ===========================================================================
  // TYPE-SPECIFIC FORMATTERS
  // ===========================================================================

  /**
   * Format market list
   */
  formatMarkets(markets: MarketData[], context: CommandContext): FormattedResponse {
    if (!markets || markets.length === 0) {
      return {
        text: `⚪ No markets found.\n\nTry /hot or /dflow <topic>`,
        parseMode: 'Markdown',
      };
    }

    const title = context.route.id === 'hot-markets' ? '🔥 *HOT MARKETS*' : '🎯 *DFLOW MARKETS*';
    let text = `${title}\n${SEPARATOR}\n\n`;

    for (let i = 0; i < Math.min(markets.length, 10); i++) {
      const m = markets[i];
      const priceEmoji = m.yesPrice > 0.7 ? '🟢' : m.yesPrice < 0.3 ? '🔴' : '⚪';

      text += `${i + 1}. ${priceEmoji} *${formatUtils.truncate(m.question, 45)}*\n`;

      if (m.ticker) {
        text += `   Ticker: \`${m.ticker}\`\n`;
      }

      text += `   YES: ${formatUtils.formatPct(m.yesPrice)}`;

      if (m.volume24h) {
        text += ` | Vol: ${formatUtils.formatUsd(m.volume24h)}`;
      }

      text += '\n\n';
    }

    text += `${SEPARATOR}\n`;
    text += `/trade <ticker> YES|NO <amount> - Place trade`;

    return {
      text: this.truncate(text),
      parseMode: 'Markdown',
    };
  }

  /**
   * Format single market
   */
  formatMarket(market: MarketData, _context: CommandContext): FormattedResponse {
    const priceEmoji = market.yesPrice > 0.7 ? '🟢' : market.yesPrice < 0.3 ? '🔴' : '⚪';

    let text = `${priceEmoji} *${market.question}*\n${SEPARATOR}\n\n`;

    if (market.ticker) {
      text += `*Ticker:* \`${market.ticker}\`\n`;
    }

    text += `*Platform:* ${market.platform}\n`;
    text += `*YES:* ${formatUtils.formatPct(market.yesPrice)}\n`;
    text += `*NO:* ${formatUtils.formatPct(market.noPrice)}\n`;

    if (market.volume24h) {
      text += `*24h Volume:* ${formatUtils.formatUsd(market.volume24h)}\n`;
    }

    if (market.liquidity) {
      text += `*Liquidity:* ${formatUtils.formatUsd(market.liquidity)}\n`;
    }

    if (market.closeDate) {
      text += `*Closes:* ${formatUtils.formatDate(market.closeDate)}\n`;
    }

    const buttons: Button[] = [];

    if (market.url) {
      buttons.push({
        label: '🔗 View Market',
        type: 'url',
        value: market.url,
      });
    }

    if (market.ticker) {
      buttons.push({
        label: '📊 Get Quote',
        type: 'callback',
        value: `/quote ${market.ticker} YES 10`,
      });
    }

    return {
      text,
      parseMode: 'Markdown',
      buttons: buttons.length > 0 ? buttons : undefined,
    };
  }

  /**
   * Format positions list
   */
  formatPositions(positions: PositionData[], _context: CommandContext): FormattedResponse {
    if (!positions || positions.length === 0) {
      return {
        text: `📊 *YOUR POSITIONS*\n${SEPARATOR}\n\nNo open positions found.\n\n/hot - Discover markets\n/trade <ticker> YES|NO <amount> - Place trade`,
        parseMode: 'Markdown',
      };
    }

    let text = `📊 *YOUR POSITIONS*\n${SEPARATOR}\n\n`;

    let totalValue = 0;
    let totalPnL = 0;

    for (const pos of positions) {
      const pnlEmoji = pos.unrealizedPnL >= 0 ? '📈' : '📉';
      const pnlSign = pos.unrealizedPnL >= 0 ? '+' : '';

      text += `*${formatUtils.truncate(pos.market.question, 40)}*\n`;
      text += `   ${pos.side}: ${pos.shares.toFixed(2)} @ $${pos.avgPrice.toFixed(4)}\n`;
      text += `   Value: ${formatUtils.formatUsd(pos.currentValue)}\n`;
      text += `   ${pnlEmoji} P&L: ${pnlSign}${formatUtils.formatUsd(pos.unrealizedPnL)} (${pnlSign}${(pos.unrealizedPnLPct * 100).toFixed(1)}%)\n\n`;

      totalValue += pos.currentValue;
      totalPnL += pos.unrealizedPnL;
    }

    text += `${SEPARATOR}\n`;
    text += `*Total Value:* ${formatUtils.formatUsd(totalValue)}\n`;
    text += `*Total P&L:* ${totalPnL >= 0 ? '+' : ''}${formatUtils.formatUsd(totalPnL)}`;

    return {
      text: this.truncate(text),
      parseMode: 'Markdown',
    };
  }

  /**
   * Format trade result
   */
  formatTrade(trade: TradeData, _context: CommandContext): FormattedResponse {
    const emoji = '✅'; // Success emoji for trades

    let text = `${emoji} *TRADE EXECUTED*\n${SEPARATOR}\n\n`;

    text += `*Market:* ${formatUtils.truncate(trade.market.question, 40)}\n`;
    text += `*Side:* ${trade.side}\n`;
    text += `*Amount:* ${formatUtils.formatUsd(trade.amount)}\n`;
    text += `*Shares:* ${trade.shares.toFixed(2)}\n`;
    text += `*Price:* $${trade.price.toFixed(4)}/share\n`;

    if (trade.fees > 0) {
      text += `*Fees:* ${formatUtils.formatUsd(trade.fees)}\n`;
    }

    text += '\n';

    // Routing info
    if (trade.route === 'jupiter') {
      text += `🔀 _Routed via Jupiter (better price)_`;
    } else {
      text += `⚡ _Direct DFlow execution_`;
    }

    if (trade.savings && trade.savings > 0.01) {
      text += `\n💰 _Saved ${(trade.savings * 100).toFixed(2)}% vs alternative_`;
    }

    text += '\n\n';
    text += `*Transaction:*\n\`${trade.signature.slice(0, 20)}...\``;

    const buttons: Button[] = [
      {
        label: '🔗 View on Solscan',
        type: 'url',
        value: `https://solscan.io/tx/${trade.signature}`,
      },
    ];

    return {
      text,
      parseMode: 'Markdown',
      buttons,
    };
  }

  /**
   * Format research result
   */
  formatResearch(research: ResearchData, _context: CommandContext): FormattedResponse {
    const confidenceEmoji = {
      high: '🎯',
      medium: '📊',
      low: '🤔',
    }[research.synthesis.confidence];

    let text = `🔍 *${research.query.toUpperCase()}*\n${SEPARATOR}\n\n`;

    if (research.synthesis.probability !== undefined) {
      text += `*Probability:* ${(research.synthesis.probability * 100).toFixed(0)}%\n`;
    }

    text += `*Confidence:* ${confidenceEmoji} ${research.synthesis.confidence}\n\n`;

    text += `*Analysis:*\n${research.synthesis.narrative}\n\n`;

    if (research.synthesis.keyFactors.length > 0) {
      text += `*Key Factors:*\n`;
      for (const factor of research.synthesis.keyFactors.slice(0, 5)) {
        text += `• ${factor}\n`;
      }
      text += '\n';
    }

    if (research.synthesis.risks.length > 0) {
      text += `*Risks:*\n`;
      for (const risk of research.synthesis.risks.slice(0, 3)) {
        text += `⚠️ ${risk}\n`;
      }
      text += '\n';
    }

    text += `${SEPARATOR}\n`;
    text += `📈 ${research.markets.length} markets | 📰 ${research.sources.length} sources`;

    return {
      text: this.truncate(text),
      parseMode: 'Markdown',
    };
  }

  /**
   * Format research result (from new handler)
   */
  private formatResearchResult(result: CommandResult, _context: CommandContext): FormattedResponse {
    const data = result.data as {
      query: string;
      timestamp: string;
      markets: MarketData[];
      marketCount: number;
      news: { articles: Array<{ title: string; link: string }>; articleCount: number; sources: string[] };
      reddit: { posts: Array<{ title: string }>; sentiment: string; postCount: number };
      analysis: { sentiment: string; confidence: string; consensusProbability?: number; signalStrength: number };
      synthesis?: {
        narrative: string;
        probability: number;
        confidence: 'low' | 'medium' | 'high';
        recommendation: 'YES' | 'NO' | 'SKIP';
        keyFactors: string[];
        risks: string[];
      };
    };

    const confidenceEmoji = {
      high: '🎯',
      medium: '📊',
      low: '🤔',
    }[data.synthesis?.confidence || data.analysis?.confidence || 'low'] || '🤔';

    let text = `🔍 *${data.query.toUpperCase()}*\n${SEPARATOR}\n\n`;

    // Show synthesis if available
    if (data.synthesis) {
      if (data.synthesis.probability !== undefined) {
        text += `*Probability:* ${data.synthesis.probability.toFixed(0)}%\n`;
      }
      text += `*Recommendation:* ${data.synthesis.recommendation}\n`;
      text += `*Confidence:* ${confidenceEmoji} ${data.synthesis.confidence}\n\n`;
      text += `*Analysis:*\n${data.synthesis.narrative}\n\n`;

      if (data.synthesis.keyFactors && data.synthesis.keyFactors.length > 0) {
        text += `*Key Factors:*\n`;
        for (const factor of data.synthesis.keyFactors.slice(0, 5)) {
          text += `• ${factor}\n`;
        }
        text += '\n';
      }

      if (data.synthesis.risks && data.synthesis.risks.length > 0) {
        text += `*Risks:*\n`;
        for (const risk of data.synthesis.risks.slice(0, 3)) {
          text += `⚠️ ${risk}\n`;
        }
        text += '\n';
      }
    } else {
      // Fallback to basic analysis
      text += `*Sentiment:* ${data.analysis?.sentiment || 'unknown'}\n`;
      text += `*Confidence:* ${confidenceEmoji} ${data.analysis?.confidence || 'low'}\n\n`;

      if (data.analysis?.consensusProbability) {
        text += `*Consensus:* ${(data.analysis.consensusProbability * 100).toFixed(0)}%\n\n`;
      }
    }

    // Markets found
    if (data.markets && data.markets.length > 0) {
      text += `*Related Markets:*\n`;
      for (const m of data.markets.slice(0, 3)) {
        text += `• ${formatUtils.truncate(m.question, 40)} (${formatUtils.formatPct(m.yesPrice)})\n`;
      }
      text += '\n';
    }

    text += `${SEPARATOR}\n`;
    text += `📈 ${data.marketCount} markets | 📰 ${data.news?.articleCount || 0} articles | 💬 ${data.reddit?.postCount || 0} posts`;

    return {
      text: this.truncate(text),
      parseMode: 'Markdown',
    };
  }

  /**
   * Format arbitrage opportunities
   */
  formatArbitrage(opportunities: ArbitrageData[], _context: CommandContext): FormattedResponse {
    if (!opportunities || opportunities.length === 0) {
      return {
        text: `⚖️ *ARBITRAGE SCAN*\n${SEPARATOR}\n\nNo significant opportunities found right now.\n\nTry again later or /hot for trending markets.`,
        parseMode: 'Markdown',
      };
    }

    let text = `⚖️ *ARBITRAGE OPPORTUNITIES*\n${SEPARATOR}\n\n`;

    for (const opp of opportunities.slice(0, 5)) {
      const spreadEmoji = opp.spreadPct > 5 ? '🔥' : opp.spreadPct > 2 ? '📊' : '📈';

      text += `${spreadEmoji} *${formatUtils.truncate(opp.question, 40)}*\n`;
      text += `   Spread: ${opp.spreadPct.toFixed(1)}%\n`;
      text += `   Direction: ${opp.direction}\n`;

      for (const p of opp.platforms) {
        text += `   • ${p.platform}: YES ${formatUtils.formatPct(p.yesPrice)}\n`;
      }

      text += '\n';
    }

    text += `${SEPARATOR}\n`;
    text += `_Spreads update frequently. Verify before trading._`;

    return {
      text: this.truncate(text),
      parseMode: 'Markdown',
    };
  }

  /**
   * Format wallet info
   */
  formatWallet(wallet: WalletData, _context: CommandContext): FormattedResponse {
    const title = wallet.isNew ? '🔐 *NEW WALLET CREATED*' : '👛 *YOUR WALLET*';

    let text = `${title}\n${SEPARATOR}\n\n`;

    text += `*Address:*\n\`${wallet.publicKey}\`\n\n`;

    text += `*Balances:*\n`;
    text += `◎ SOL: ${wallet.solBalance.toFixed(4)}\n`;
    text += `💵 USDC: ${wallet.usdcBalance.toFixed(2)}\n\n`;

    if (wallet.isNew) {
      text += `📥 *Fund your wallet to trade:*\n`;
      text += `Send SOL or USDC to this address.\n\n`;
      text += `*Next Steps:*\n`;
      text += `/dflow bitcoin - Search markets\n`;
      text += `/trade <ticker> YES 10 - Buy $10 of YES`;
    } else {
      text += `*Commands:*\n`;
      text += `/dflow <query> - Search markets\n`;
      text += `/trade <ticker> YES|NO <amount> - Place trade\n`;
      text += `/positions - View positions`;
    }

    return {
      text,
      parseMode: 'Markdown',
    };
  }

  /**
   * Format morning brief
   */
  formatBrief(result: CommandResult, _context: CommandContext): FormattedResponse {
    const data = result.data as {
      generatedAt: string;
      hotMarkets: MarketData[];
      arbitrageOpportunities: Array<{
        topic: string;
        spread: number;
        platformA: string;
        platformB: string;
        priceAYes: number;
        priceBYes: number;
      }>;
      whaleAlerts: Array<{
        whaleName: string;
        totalUsd: number;
      }>;
      userStats: {
        brierScore: number;
        accuracy: number;
        pendingPredictions: number;
        streak: number;
        streakType: 'win' | 'loss' | 'none';
        rank: number | null;
      };
      marketMovers: Array<{
        title: string;
        currentPrice: number;
        change24h: number;
      }>;
      trustData?: {
        dataQualityScore: number;
        totalValidated: number;
        totalFiltered: number;
      };
    };

    const date = new Date().toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

    let text = `🌅 *BERIGHT MORNING BRIEF*\n${date}\n\n`;

    // Top Movers Section
    const bigMovers = (data.marketMovers || [])
      .filter(m => Math.abs(m.change24h) > 1)
      .slice(0, 3);

    if (bigMovers.length > 0) {
      text += `📈 *TOP MOVERS (24H)*\n`;
      for (const mover of bigMovers) {
        const arrow = mover.change24h >= 0 ? '🟢' : '🔴';
        const sign = mover.change24h >= 0 ? '+' : '';
        text += `${arrow} ${formatUtils.truncate(mover.title, 35)}\n`;
        text += `   ${formatUtils.formatPct(mover.currentPrice)} (${sign}${mover.change24h.toFixed(1)}%)\n`;
      }
      text += '\n';
    }

    // Markets to Watch
    text += `🔥 *MARKETS TO WATCH*\n`;
    for (const market of (data.hotMarkets || []).slice(0, 4)) {
      const mover = data.marketMovers?.find(m => m.title === market.question);
      const changeStr = mover && Math.abs(mover.change24h) > 0.5
        ? ` (${mover.change24h >= 0 ? '+' : ''}${mover.change24h.toFixed(0)}%)`
        : '';
      text += `• ${formatUtils.truncate(market.question, 38)}\n`;
      text += `  📊 ${formatUtils.formatPct(market.yesPrice)}${changeStr}\n`;
    }

    // Alpha Alerts
    if (data.arbitrageOpportunities && data.arbitrageOpportunities.length > 0) {
      text += `\n🚨 *ALPHA ALERT*\n`;
      const topArb = data.arbitrageOpportunities[0];
      text += `${formatUtils.formatPct(topArb.spread)} spread on "${formatUtils.truncate(topArb.topic, 30)}"\n`;
      text += `${topArb.platformA}: ${formatUtils.formatPct(topArb.priceAYes)} vs ${topArb.platformB}: ${formatUtils.formatPct(topArb.priceBYes)}\n`;
    }

    // Whale Watch
    if (data.whaleAlerts && data.whaleAlerts.length > 0) {
      text += `\n🐋 *WHALE WATCH*\n`;
      const topWhale = data.whaleAlerts[0];
      text += `@${topWhale.whaleName} moved ${formatUtils.formatUsd(topWhale.totalUsd)}\n`;
    }

    // User Stats
    text += `\n📊 *YOUR STATS*\n`;
    if (data.userStats.streak > 0) {
      const streakEmoji = data.userStats.streakType === 'win' ? '🔥' : '❄️';
      text += `Streak: ${data.userStats.streak} ${streakEmoji} | `;
    }
    text += `Pending: ${data.userStats.pendingPredictions}`;
    if (data.userStats.rank) {
      text += ` | Rank: #${data.userStats.rank}`;
    }
    text += '\n';

    if (data.userStats.brierScore > 0) {
      const grade = data.userStats.brierScore < 0.15 ? '⭐' : data.userStats.brierScore < 0.2 ? '✨' : '📊';
      text += `Brier: ${data.userStats.brierScore.toFixed(3)} ${grade} | Acc: ${(data.userStats.accuracy * 100).toFixed(0)}%\n`;
    }

    // Data Quality (Trust Engine)
    if (data.trustData) {
      text += `\n📊 *DATA QUALITY*\n`;
      text += `Score: ${data.trustData.dataQualityScore}/100 | `;
      text += `Validated: ${data.trustData.totalValidated}\n`;
    }

    // Call to Action
    text += `\n${SEPARATOR}\n`;
    text += `/predict <question> - Make a prediction\n`;
    text += `/hot - View trending markets\n`;
    text += `/arb - Scan for opportunities`;

    return {
      text: this.truncate(text),
      parseMode: 'Markdown',
    };
  }

  /**
   * Format alpha opportunities
   */
  formatAlpha(result: CommandResult, _context: CommandContext): FormattedResponse {
    const data = result.data as {
      timestamp: string;
      highConviction: Array<{
        market: MarketData;
        signal: 'high_conviction' | 'contentious' | 'high_volume';
        direction?: 'YES' | 'NO';
        confidence: number;
      }>;
      contentious: Array<{
        market: MarketData;
        signal: 'high_conviction' | 'contentious' | 'high_volume';
        direction?: 'YES' | 'NO';
        confidence: number;
      }>;
      highVolume: Array<{
        market: MarketData;
        signal: 'high_conviction' | 'contentious' | 'high_volume';
        direction?: 'YES' | 'NO';
        confidence: number;
      }>;
      totalOpportunities: number;
    };

    let text = `🎯 *ALPHA OPPORTUNITIES*\n${SEPARATOR}\n\n`;

    // High Conviction Section
    if (data.highConviction && data.highConviction.length > 0) {
      text += `🔥 *HIGH CONVICTION*\n`;
      text += `_Decisive markets (>90% or <10%) with volume_\n\n`;
      for (const alpha of data.highConviction) {
        const dirEmoji = alpha.direction === 'YES' ? '🟢' : '🔴';
        text += `${dirEmoji} *${formatUtils.truncate(alpha.market.question, 40)}*\n`;
        text += `   ${formatUtils.formatPct(alpha.market.yesPrice)} | ${alpha.direction}\n`;
        text += `   Vol: ${formatUtils.formatUsd(alpha.market.volume24h || 0)}\n\n`;
      }
    }

    // Contentious Section
    if (data.contentious && data.contentious.length > 0) {
      text += `⚖️ *CONTENTIOUS (EDGE POTENTIAL)*\n`;
      text += `_Uncertain markets (40-60%) - research opportunity_\n\n`;
      for (const alpha of data.contentious) {
        text += `⚪ *${formatUtils.truncate(alpha.market.question, 40)}*\n`;
        text += `   ${formatUtils.formatPct(alpha.market.yesPrice)} | Conf: ${(alpha.confidence * 100).toFixed(0)}%\n\n`;
      }
    }

    // High Volume Section
    if (data.highVolume && data.highVolume.length > 0) {
      text += `📊 *HIGH VOLUME*\n`;
      text += `_Markets with significant liquidity (>$1M)_\n\n`;
      for (const alpha of data.highVolume) {
        const dirEmoji = alpha.direction === 'YES' ? '🟢' : '🔴';
        text += `${dirEmoji} *${formatUtils.truncate(alpha.market.question, 40)}*\n`;
        text += `   ${formatUtils.formatPct(alpha.market.yesPrice)} | Vol: ${formatUtils.formatUsd(alpha.market.volume24h || 0)}\n\n`;
      }
    }

    if (data.totalOpportunities === 0) {
      text += `No major opportunities detected right now.\n\n`;
      text += `Try /hot for trending markets or /research <topic> for deep analysis.`;
    } else {
      text += `${SEPARATOR}\n`;
      text += `Total: ${data.totalOpportunities} opportunities found\n`;
      text += `/trade <ticker> YES|NO <amount> - Execute trade`;
    }

    return {
      text: this.truncate(text),
      parseMode: 'Markdown',
    };
  }

  /**
   * Format DFlow search results
   */
  formatDFlowSearch(result: CommandResult, _context: CommandContext): FormattedResponse {
    const data = result.data as {
      query: string;
      timestamp: string;
      markets: Array<{
        ticker: string;
        eventTicker: string;
        title: string;
        subtitle?: string;
        yesPrice: number;
        noPrice: number;
        spread: number;
        volume24h: number;
        liquidity: number;
        status: string;
        closeTime: Date;
        url: string;
      }>;
      totalResults: number;
      hasMore: boolean;
    };

    if (!data.markets || data.markets.length === 0) {
      return {
        text: `⚪ *No DFlow markets found for "${data.query}"*\n\nTry a different search term or /hot for trending markets.`,
        parseMode: 'Markdown',
      };
    }

    let text = `🎯 *DFLOW MARKETS*\n`;
    text += `Query: "${data.query}"\n${SEPARATOR}\n\n`;

    for (let i = 0; i < Math.min(data.markets.length, 10); i++) {
      const m = data.markets[i];
      const priceEmoji = m.yesPrice > 0.7 ? '🟢' : m.yesPrice < 0.3 ? '🔴' : '⚪';

      text += `${i + 1}. ${priceEmoji} *${formatUtils.truncate(m.title, 42)}*\n`;
      text += `   Ticker: \`${m.ticker}\`\n`;
      text += `   YES: ${formatUtils.formatPct(m.yesPrice)}`;

      if (m.spread > 0.01) {
        text += ` | Spread: ${formatUtils.formatPct(m.spread)}`;
      }

      text += '\n';

      if (m.volume24h > 0) {
        text += `   Vol 24h: ${formatUtils.formatUsd(m.volume24h)}`;
        if (m.liquidity > 0) {
          text += ` | Liq: ${formatUtils.formatUsd(m.liquidity)}`;
        }
        text += '\n';
      }

      text += '\n';
    }

    text += `${SEPARATOR}\n`;
    text += `${data.totalResults} results found`;
    if (data.hasMore) {
      text += ' (showing top 10)';
    }
    text += '\n\n';
    text += `/trade <ticker> YES|NO <amount> - Execute trade\n`;
    text += `/quote <ticker> YES|NO <amount> - Get quote`;

    return {
      text: this.truncate(text),
      parseMode: 'Markdown',
    };
  }

  /**
   * Format trade quote
   */
  formatQuote(result: CommandResult, _context: CommandContext): FormattedResponse {
    const data = result.data as {
      ticker: string;
      marketTitle: string;
      side: 'YES' | 'NO';
      amountUsd: number;
      quotes: {
        dflow?: {
          outputAmount: number;
          effectivePrice: number;
          priceImpact: number;
        };
        jupiter?: {
          outputAmount: number;
          effectivePrice: number;
          priceImpact: number;
          route?: string[];
        };
      };
      recommended: 'dflow' | 'jupiter';
      reason: string;
      savingsPct: number;
    };

    let text = `📊 *TRADE QUOTE*\n${SEPARATOR}\n\n`;

    text += `*Market:* ${formatUtils.truncate(data.marketTitle, 40)}\n`;
    text += `*Side:* ${data.side}\n`;
    text += `*Amount:* ${formatUtils.formatUsd(data.amountUsd)}\n\n`;

    // DFlow quote
    if (data.quotes.dflow) {
      const dflow = data.quotes.dflow;
      text += `⚡ *DFlow Direct:*\n`;
      text += `   Output: ${dflow.outputAmount.toFixed(2)} tokens\n`;
      text += `   Price: $${dflow.effectivePrice.toFixed(4)}/token\n`;
      text += `   Impact: ${(dflow.priceImpact * 100).toFixed(2)}%\n\n`;
    }

    // Jupiter quote
    if (data.quotes.jupiter) {
      const jupiter = data.quotes.jupiter;
      text += `🔀 *Jupiter Route:*\n`;
      text += `   Output: ${jupiter.outputAmount.toFixed(2)} tokens\n`;
      text += `   Price: $${jupiter.effectivePrice.toFixed(4)}/token\n`;
      text += `   Impact: ${(jupiter.priceImpact * 100).toFixed(2)}%\n`;
      if (jupiter.route && jupiter.route.length > 0) {
        text += `   Path: ${jupiter.route.join(' → ')}\n`;
      }
      text += '\n';
    }

    text += `${SEPARATOR}\n`;
    const recEmoji = data.recommended === 'jupiter' ? '🔀' : '⚡';
    text += `*Recommended:* ${recEmoji} ${data.recommended.toUpperCase()}\n`;
    text += `*Reason:* ${data.reason}\n`;

    if (data.savingsPct > 0.001) {
      text += `*Savings:* ${(data.savingsPct * 100).toFixed(2)}%\n`;
    }

    text += `\n/trade ${data.ticker} ${data.side} ${data.amountUsd} - Execute trade`;

    return {
      text: this.truncate(text),
      parseMode: 'Markdown',
    };
  }

  /**
   * Format trade execution result
   */
  formatTradeResult(result: CommandResult, _context: CommandContext): FormattedResponse {
    const data = result.data as {
      success: boolean;
      ticker: string;
      marketTitle: string;
      side: 'YES' | 'NO';
      amountUsd: number;
      outputAmount: number;
      effectivePrice: number;
      route: 'dflow' | 'jupiter';
      signature?: string;
      savingsPct?: number;
      solscanUrl?: string;
    };

    let text = `✅ *TRADE EXECUTED*\n${SEPARATOR}\n\n`;

    text += `*Market:* ${formatUtils.truncate(data.marketTitle, 40)}\n`;
    text += `*Side:* ${data.side}\n`;
    text += `*Amount:* ${formatUtils.formatUsd(data.amountUsd)}\n`;
    text += `*Received:* ~${data.outputAmount.toFixed(2)} ${data.side} tokens\n`;
    text += `*Price:* $${data.effectivePrice.toFixed(4)}/token\n\n`;

    // Routing info
    if (data.route === 'jupiter') {
      text += `🔀 _Routed via Jupiter (better price)_\n`;
    } else {
      text += `⚡ _Direct DFlow execution_\n`;
    }

    if (data.savingsPct && data.savingsPct > 0.001) {
      text += `💰 _Saved ${(data.savingsPct * 100).toFixed(2)}% vs alternative_\n`;
    }

    text += '\n';

    if (data.signature) {
      text += `*Transaction:*\n\`${data.signature.slice(0, 20)}...\`\n`;
    }

    text += `\n/positions - Check your positions`;

    const buttons: Button[] = [];
    if (data.solscanUrl) {
      buttons.push({
        label: '🔗 View on Solscan',
        type: 'url',
        value: data.solscanUrl,
      });
    }

    return {
      text: this.truncate(text),
      parseMode: 'Markdown',
      buttons: buttons.length > 0 ? buttons : undefined,
    };
  }

  /**
   * Format positions result
   */
  formatPositionsResult(result: CommandResult, _context: CommandContext): FormattedResponse {
    const data = result.data as {
      publicKey: string;
      balance: { sol: number; usdc: number };
      positions: Array<{
        marketTicker: string;
        marketTitle: string;
        side: 'YES' | 'NO';
        shares: number;
        avgPrice: number;
        currentPrice: number;
        currentValue: number;
        unrealizedPnL: number;
        unrealizedPnLPct: number;
      }>;
      totalValue: number;
      totalUnrealizedPnL: number;
    };

    let text = `📊 *YOUR POSITIONS*\n${SEPARATOR}\n\n`;

    // Wallet address (truncated)
    text += `*Wallet:* \`${data.publicKey.slice(0, 8)}...${data.publicKey.slice(-4)}\`\n\n`;

    // Balances
    text += `*Balances:*\n`;
    text += `◎ SOL: ${data.balance.sol.toFixed(4)}\n`;
    text += `💵 USDC: ${data.balance.usdc.toFixed(2)}\n\n`;

    if (data.positions.length === 0) {
      text += `No open positions found.\n\n`;
      text += `/dflow - Search markets\n`;
      text += `/trade <ticker> YES|NO <amount> - Place trade`;
    } else {
      // Positions list
      for (const pos of data.positions) {
        const pnlEmoji = pos.unrealizedPnL >= 0 ? '📈' : '📉';
        const pnlSign = pos.unrealizedPnL >= 0 ? '+' : '';

        text += `*${formatUtils.truncate(pos.marketTitle, 40)}*\n`;
        text += `   ${pos.side}: ${pos.shares.toFixed(2)} @ $${pos.avgPrice.toFixed(4)}\n`;
        text += `   Value: ${formatUtils.formatUsd(pos.currentValue)}\n`;
        text += `   ${pnlEmoji} P&L: ${pnlSign}${formatUtils.formatUsd(pos.unrealizedPnL)} (${pnlSign}${(pos.unrealizedPnLPct * 100).toFixed(1)}%)\n\n`;
      }

      // Totals
      text += `${SEPARATOR}\n`;
      text += `*Total Value:* ${formatUtils.formatUsd(data.totalValue)}\n`;

      const totalSign = data.totalUnrealizedPnL >= 0 ? '+' : '';
      text += `*Total P&L:* ${totalSign}${formatUtils.formatUsd(data.totalUnrealizedPnL)}`;
    }

    return {
      text: this.truncate(text),
      parseMode: 'Markdown',
    };
  }

  /**
   * Format help text
   */
  formatHelp(
    commands: { id: string; description: string }[],
    _context: CommandContext
  ): FormattedResponse {
    let text = `🤖 *BERIGHT COMMANDS*\n${SEPARATOR}\n\n`;

    for (const cmd of commands) {
      text += `/${cmd.id} - ${cmd.description}\n`;
    }

    text += `\n${SEPARATOR}\n`;
    text += `_Need help? Ask any question in natural language!_`;

    return {
      text,
      parseMode: 'Markdown',
    };
  }

  // ===========================================================================
  // PORTFOLIO & ANALYTICS FORMATTERS
  // ===========================================================================

  /**
   * Format portfolio
   */
  private formatPortfolio(result: CommandResult, _context: CommandContext): FormattedResponse {
    const data = result.data as {
      timestamp: string;
      summary: {
        totalPositions: number;
        openPositions: number;
        totalInvested: number;
        currentValue: number;
        unrealizedPnL: number;
        unrealizedPnLPct: number;
        realizedPnL: number;
        totalPnL: number;
        winRate: number;
      };
      positions: Array<{
        id: string;
        marketTitle: string;
        platform: string;
        direction: 'YES' | 'NO';
        shares: number;
        avgEntryPrice: number;
        currentPrice: number;
        currentValue: number;
        unrealizedPnL: number;
        unrealizedPnLPct: number;
      }>;
      allocation: {
        byPlatform: Record<string, number>;
        byDirection: { yes: number; no: number };
      };
    };

    let text = `📊 *PORTFOLIO*\n${SEPARATOR}\n\n`;

    // Summary
    const pnlEmoji = data.summary.totalPnL >= 0 ? '📈' : '📉';
    const pnlSign = data.summary.totalPnL >= 0 ? '+' : '';

    text += `*Summary*\n`;
    text += `Invested: ${formatUtils.formatUsd(data.summary.totalInvested)}\n`;
    text += `Current: ${formatUtils.formatUsd(data.summary.currentValue)}\n`;
    text += `${pnlEmoji} P&L: ${pnlSign}${formatUtils.formatUsd(data.summary.totalPnL)} (${pnlSign}${data.summary.unrealizedPnLPct.toFixed(1)}%)\n`;
    text += `Win Rate: ${(data.summary.winRate * 100).toFixed(0)}%\n\n`;

    if (data.positions.length === 0) {
      text += `No open positions.\n\n`;
      text += `/hot - Find trending markets\n`;
      text += `/kalshi - Trade on Kalshi`;
      return {
        text,
        parseMode: 'Markdown',
      };
    }

    // Positions
    text += `*Open Positions (${data.summary.openPositions})*\n`;
    for (const pos of data.positions.slice(0, 8)) {
      const posPnlSign = pos.unrealizedPnL >= 0 ? '+' : '';
      text += `*${pos.direction}* ${formatUtils.truncate(pos.marketTitle, 30)}\n`;
      text += `  Entry: ${(pos.avgEntryPrice * 100).toFixed(1)}¢ → ${(pos.currentPrice * 100).toFixed(1)}¢\n`;
      text += `  P&L: ${posPnlSign}${formatUtils.formatUsd(pos.unrealizedPnL)} (${posPnlSign}${pos.unrealizedPnLPct.toFixed(1)}%)\n`;
    }

    if (data.positions.length > 8) {
      text += `\n... and ${data.positions.length - 8} more positions\n`;
    }

    text += `\n${SEPARATOR}\n`;
    text += `/pnl - Detailed P&L report\n`;
    text += `/kalshi positions - Kalshi positions`;

    return {
      text: this.truncate(text),
      parseMode: 'Markdown',
    };
  }

  /**
   * Format P&L report
   */
  private formatPnl(result: CommandResult, _context: CommandContext): FormattedResponse {
    const data = result.data as {
      timestamp: string;
      period: string;
      days: number;
      trades: number;
      volume: number;
      realizedPnL: number;
      unrealizedPnL: number;
      totalPnL: number;
      byPlatform: Record<string, number>;
      allTime: {
        totalPnL: number;
        winRate: number;
        totalTrades: number;
      };
    };

    const pnlEmoji = data.totalPnL >= 0 ? '📈' : '📉';
    const pnlSign = data.totalPnL >= 0 ? '+' : '';

    let text = `${pnlEmoji} *P&L REPORT*\n${SEPARATOR}\n\n`;

    text += `*${data.days}-Day Performance*\n`;
    text += `Trades: ${data.trades}\n`;
    text += `Volume: ${formatUtils.formatUsd(data.volume)}\n`;
    text += `Realized: ${data.realizedPnL >= 0 ? '+' : ''}${formatUtils.formatUsd(data.realizedPnL)}\n`;
    text += `Unrealized: ${data.unrealizedPnL >= 0 ? '+' : ''}${formatUtils.formatUsd(data.unrealizedPnL)}\n`;
    text += `*Total: ${pnlSign}${formatUtils.formatUsd(data.totalPnL)}*\n\n`;

    // By platform
    if (Object.keys(data.byPlatform).length > 0) {
      text += `*By Platform*\n`;
      for (const [platform, pnl] of Object.entries(data.byPlatform)) {
        const sign = pnl >= 0 ? '+' : '';
        text += `  ${platform}: ${sign}${formatUtils.formatUsd(pnl)}\n`;
      }
      text += '\n';
    }

    // All-time
    text += `*All-Time*\n`;
    text += `Total P&L: ${data.allTime.totalPnL >= 0 ? '+' : ''}${formatUtils.formatUsd(data.allTime.totalPnL)}\n`;
    text += `Win Rate: ${(data.allTime.winRate * 100).toFixed(0)}%\n`;
    text += `Trades: ${data.allTime.totalTrades}\n\n`;

    text += `${SEPARATOR}\n`;
    text += `/pnl 30 - 30-day report\n`;
    text += `/portfolio - View positions`;

    return {
      text: this.truncate(text),
      parseMode: 'Markdown',
    };
  }

  /**
   * Format user profile
   */
  private formatMe(result: CommandResult, _context: CommandContext): FormattedResponse {
    const data = result.data as {
      timestamp: string;
      userId: string;
      predictions: {
        total: number;
        resolved: number;
        pending: number;
        accuracy: number;
        brierScore: number;
      };
      trading: {
        totalPositions: number;
        openPositions: number;
        totalPnL: number;
        winRate: number;
      };
      streak: {
        current: number;
        type: 'win' | 'loss' | 'none';
        best: number;
      };
      grade: {
        letter: string;
        emoji: string;
        title: string;
      };
      achievements: string[];
    };

    let text = `👤 *YOUR PROFILE*\n${SEPARATOR}\n\n`;

    // Grade
    text += `${data.grade.emoji} *Grade: ${data.grade.letter}* - ${data.grade.title}\n\n`;

    // Predictions
    text += `🎯 *Predictions*\n`;
    text += `Total: ${data.predictions.total} (${data.predictions.resolved} resolved, ${data.predictions.pending} pending)\n`;
    text += `Accuracy: ${(data.predictions.accuracy * 100).toFixed(0)}%\n`;
    text += `Brier Score: ${data.predictions.brierScore.toFixed(3)}\n\n`;

    // Trading
    text += `📈 *Trading*\n`;
    text += `Positions: ${data.trading.totalPositions} (${data.trading.openPositions} open)\n`;
    text += `Total P&L: ${data.trading.totalPnL >= 0 ? '+' : ''}${formatUtils.formatUsd(data.trading.totalPnL)}\n`;
    text += `Win Rate: ${(data.trading.winRate * 100).toFixed(0)}%\n\n`;

    // Streak
    if (data.streak.current > 0) {
      const streakEmoji = data.streak.type === 'win' ? '🔥' : '❄️';
      text += `${streakEmoji} *Streak:* ${data.streak.current} ${data.streak.type}s`;
      if (data.streak.best > data.streak.current) {
        text += ` (best: ${data.streak.best})`;
      }
      text += '\n\n';
    }

    // Achievements
    if (data.achievements.length > 0) {
      text += `🏆 *Achievements*\n`;
      for (const achievement of data.achievements.slice(0, 5)) {
        text += `${achievement}\n`;
      }
    }

    text += `\n${SEPARATOR}\n`;
    text += `/calibration - Detailed stats\n`;
    text += `/leaderboard - Rankings`;

    return {
      text: this.truncate(text),
      parseMode: 'Markdown',
    };
  }

  /**
   * Format calibration stats
   */
  private formatCalibration(result: CommandResult, _context: CommandContext): FormattedResponse {
    const data = result.data as {
      timestamp: string;
      totalPredictions: number;
      resolvedPredictions: number;
      pendingPredictions: number;
      overallBrierScore: number;
      accuracy: number;
      grade: {
        letter: string;
        emoji: string;
        title: string;
      };
      calibrationByBucket: Array<{
        range: string;
        predictions: number;
        actualRate: number;
        expectedRate: number;
        calibrationError: number;
      }>;
      streak: {
        current: number;
        type: 'win' | 'loss' | 'none';
        best: number;
      };
    };

    let text = `🎯 *CALIBRATION REPORT*\n${SEPARATOR}\n\n`;

    // Grade
    text += `${data.grade.emoji} *Grade: ${data.grade.letter}* - ${data.grade.title}\n\n`;

    // Overall stats
    text += `*Overall Stats*\n`;
    text += `Predictions: ${data.totalPredictions} (${data.resolvedPredictions} resolved, ${data.pendingPredictions} pending)\n`;
    text += `Brier Score: ${data.overallBrierScore.toFixed(4)} ${data.overallBrierScore < 0.2 ? '✅' : '⚠️'}\n`;
    text += `Accuracy: ${(data.accuracy * 100).toFixed(1)}%\n`;

    // Streak
    if (data.streak.current > 0) {
      const streakEmoji = data.streak.type === 'win' ? '🔥' : '❄️';
      text += `Streak: ${data.streak.current} ${data.streak.type}s ${streakEmoji}\n`;
    }
    text += '\n';

    // Calibration by bucket
    if (data.calibrationByBucket.length > 0) {
      text += `*Calibration by Confidence*\n`;
      text += `\`Range     Pred  Expected Actual  Err\`\n`;
      for (const bucket of data.calibrationByBucket.slice(0, 6)) {
        text += `\`${bucket.range.padEnd(10)}${String(bucket.predictions).padEnd(6)}${(bucket.expectedRate * 100).toFixed(0).padEnd(9)}%${(bucket.actualRate * 100).toFixed(0).padEnd(7)}%${(bucket.calibrationError * 100).toFixed(0)}%\`\n`;
      }
      text += '\n';
    }

    // Benchmarks
    text += `*Brier Score Benchmarks*\n`;
    text += `< 0.10 = Superforecaster Elite 🏆\n`;
    text += `< 0.15 = Superforecaster ⭐\n`;
    text += `< 0.20 = Very Good ✨\n`;
    text += `0.25 = Random Guessing 🎲\n\n`;

    text += `${SEPARATOR}\n`;
    text += `/me - Your profile\n`;
    text += `/compare - vs Market`;

    return {
      text: this.truncate(text),
      parseMode: 'Markdown',
    };
  }

  /**
   * Format leaderboard
   */
  private formatLeaderboard(result: CommandResult, _context: CommandContext): FormattedResponse {
    const data = result.data as {
      timestamp: string;
      category: string;
      entries: Array<{
        rank: number;
        userId: string;
        username?: string;
        brierScore: number;
        accuracy: number;
        predictions: number;
        streak: number;
        grade: string;
        isCurrentUser: boolean;
      }>;
      totalParticipants: number;
      currentUserRank?: number;
      currentUserStats?: {
        rank: number;
        brierScore: number;
        accuracy: number;
        grade: string;
      };
      period: string;
    };

    let text = `🏆 *LEADERBOARD*\n${SEPARATOR}\n\n`;

    text += `*Top Forecasters (${data.period})*\n`;
    text += `${data.totalParticipants} participants\n\n`;

    for (const entry of data.entries.slice(0, 10)) {
      const rankEmoji = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : '  ';
      const youTag = entry.isCurrentUser ? ' ← You' : '';
      const name = entry.username || `User ${entry.userId.slice(0, 6)}`;

      text += `${rankEmoji} *#${entry.rank}* ${name}${youTag}\n`;
      text += `   Brier: ${entry.brierScore.toFixed(3)} | Acc: ${(entry.accuracy * 100).toFixed(0)}% | ${entry.predictions} pred\n`;
    }

    // Current user if not in top 10
    if (data.currentUserStats && data.currentUserRank && data.currentUserRank > 10) {
      text += `\n...\n\n`;
      text += `*#${data.currentUserRank}* You\n`;
      text += `   Brier: ${data.currentUserStats.brierScore.toFixed(3)} | Grade: ${data.currentUserStats.grade}\n`;
    }

    text += `\n${SEPARATOR}\n`;
    text += `/calibration - Your stats\n`;
    text += `/me - Your profile`;

    return {
      text: this.truncate(text),
      parseMode: 'Markdown',
    };
  }

  /**
   * Format comparison report
   */
  private formatCompare(result: CommandResult, _context: CommandContext): FormattedResponse {
    const data = result.data as {
      timestamp: string;
      userId: string;
      totalPending: number;
      comparisons: Array<{
        predictionId: string;
        question: string;
        userDirection: 'YES' | 'NO';
        userProbability: number;
        marketProbability?: number;
        baseRate?: number;
        divergenceLevel: 'aligned' | 'slight' | 'moderate' | 'strong';
        isContrarian: boolean;
        analysis: string;
        suggestion?: string;
      }>;
      summary: {
        alignedWithMarket: number;
        contrarianPredictions: number;
        avgDivergence: number;
        overallAssessment: string;
      };
    };

    let text = `📊 *PREDICTION COMPARISON*\n${SEPARATOR}\n\n`;

    // Summary
    text += `*Summary*\n`;
    text += `Pending: ${data.totalPending}\n`;
    text += `Aligned with market: ${data.summary.alignedWithMarket}\n`;
    text += `Contrarian positions: ${data.summary.contrarianPredictions}\n`;
    text += `Avg divergence: ${(data.summary.avgDivergence * 100).toFixed(1)}%\n\n`;

    text += `💬 ${data.summary.overallAssessment}\n\n`;

    if (data.comparisons.length === 0) {
      text += `No pending predictions to compare.\n\n`;
      text += `/predict <question> - Make a prediction`;
      return {
        text,
        parseMode: 'Markdown',
      };
    }

    text += `*Your Predictions vs Market*\n`;
    for (const comp of data.comparisons.slice(0, 6)) {
      const divergenceEmoji =
        comp.divergenceLevel === 'aligned' ? '✅' :
        comp.divergenceLevel === 'slight' ? '🔹' :
        comp.divergenceLevel === 'moderate' ? '🔶' : '⚠️';

      text += `${divergenceEmoji} *${formatUtils.truncate(comp.question, 35)}*\n`;
      text += `   You: ${comp.userDirection} @ ${(comp.userProbability * 100).toFixed(0)}%\n`;

      if (comp.marketProbability !== undefined) {
        text += `   Market: ${(comp.marketProbability * 100).toFixed(0)}%\n`;
      }

      text += `   ${comp.analysis}\n`;

      if (comp.suggestion) {
        text += `   💡 ${comp.suggestion}\n`;
      }
    }

    if (data.comparisons.length > 6) {
      text += `\n... and ${data.comparisons.length - 6} more\n`;
    }

    text += `\n${SEPARATOR}\n`;
    text += `/calibration - Your stats`;

    return {
      text: this.truncate(text),
      parseMode: 'Markdown',
    };
  }

  // ===========================================================================
  // PREDICTIONS & INTELLIGENCE FORMATTERS
  // ===========================================================================

  /**
   * Format predict result
   */
  private formatPredict(result: CommandResult, _context: CommandContext): FormattedResponse {
    const data = result.data as {
      timestamp: string;
      prediction: {
        id: string;
        question: string;
        direction: 'YES' | 'NO';
        probability: number;
        marketTicker?: string;
        onChainTx?: string;
      };
      matchedMarket?: {
        ticker: string;
        title: string;
        yesPrice: number;
        noPrice: number;
        similarity: number;
        closeTime?: string;
      };
      intelligence?: {
        baseRate: number;
        recommendedRange: { low: number; high: number };
        biasWarnings: string[];
      };
      autoResolve: boolean;
    };

    let text = `✅ *PREDICTION RECORDED*\n${SEPARATOR}\n\n`;

    text += `📊 *${formatUtils.truncate(data.prediction.question, 50)}*\n\n`;
    text += `🎯 Direction: ${data.prediction.direction}\n`;
    text += `📈 Probability: ${(data.prediction.probability * 100).toFixed(0)}%\n`;

    if (data.prediction.onChainTx) {
      text += `⛓️ On-Chain: \`${data.prediction.onChainTx.slice(0, 12)}...\`\n`;
    }

    if (data.matchedMarket) {
      text += `\n🔗 *LINKED MARKET*\n`;
      text += `${data.matchedMarket.title}\n`;
      text += `Ticker: \`${data.matchedMarket.ticker}\`\n`;
      text += `Current: YES ${(data.matchedMarket.yesPrice * 100).toFixed(0)}¢ / NO ${(data.matchedMarket.noPrice * 100).toFixed(0)}¢\n`;
      text += `Match: ${(data.matchedMarket.similarity * 100).toFixed(0)}%\n`;
      if (data.matchedMarket.closeTime) {
        text += `Closes: ${new Date(data.matchedMarket.closeTime).toLocaleDateString()}\n`;
      }
      text += `\n✨ _This prediction will AUTO-RESOLVE when the market closes!_\n`;
    } else {
      text += `\n⚠️ No matching market found. Manual resolution required.\n`;
    }

    if (data.intelligence) {
      text += `\n📈 *INTELLIGENCE*\n`;
      text += `Base Rate: ${(data.intelligence.baseRate * 100).toFixed(0)}%\n`;
      text += `Recommended: ${(data.intelligence.recommendedRange.low * 100).toFixed(0)}%-${(data.intelligence.recommendedRange.high * 100).toFixed(0)}%\n`;
      if (data.intelligence.biasWarnings.length > 0) {
        text += `⚠️ ${data.intelligence.biasWarnings[0]}\n`;
      }
    }

    text += `\n${SEPARATOR}\n`;
    text += `/compare - vs Market\n`;
    text += `/calibration - Your stats`;

    return {
      text: this.truncate(text),
      parseMode: 'Markdown',
    };
  }

  /**
   * Format smartPredict result
   */
  private formatSmartPredict(result: CommandResult, _context: CommandContext): FormattedResponse {
    const data = result.data as {
      timestamp: string;
      mode: 'search' | 'predict';
      searchQuery?: string;
      markets?: Array<{
        ticker: string;
        title: string;
        yesPrice: number;
        noPrice: number;
        volume: number;
        closeTime?: string;
        similarity: number;
      }>;
      prediction?: {
        id: string;
        question: string;
        direction: 'YES' | 'NO';
        probability: number;
        marketTicker?: string;
        onChainTx?: string;
      };
      matchedMarket?: {
        ticker: string;
        title: string;
        yesPrice: number;
        similarity: number;
      };
      intelligence?: {
        baseRate: number;
        recommendedRange: { low: number; high: number };
        biasWarnings: string[];
      };
      autoResolve: boolean;
    };

    // Search mode
    if (data.mode === 'search') {
      if (!data.markets || data.markets.length === 0) {
        return {
          text: `⚪ *No markets found for "${data.searchQuery}"*\n\nTry a different search term.`,
          parseMode: 'Markdown',
        };
      }

      let text = `🔍 *MARKETS FOR: ${data.searchQuery}*\n${SEPARATOR}\n\n`;

      for (let i = 0; i < Math.min(data.markets.length, 5); i++) {
        const m = data.markets[i];
        text += `${i + 1}. *${formatUtils.truncate(m.title, 40)}*\n`;
        text += `   Ticker: \`${m.ticker}\`\n`;
        text += `   YES: ${(m.yesPrice * 100).toFixed(0)}¢ | NO: ${(m.noPrice * 100).toFixed(0)}¢\n`;
        if (m.closeTime) {
          text += `   Closes: ${new Date(m.closeTime).toLocaleDateString()}\n`;
        }
        text += '\n';
      }

      text += `${SEPARATOR}\n`;
      text += `📝 To predict:\n`;
      text += `/smartpredict ${data.markets[0].ticker} 65 YES`;

      return {
        text: this.truncate(text),
        parseMode: 'Markdown',
      };
    }

    // Predict mode - reuse formatPredict
    return this.formatPredict(result, _context);
  }

  /**
   * Format intelligence result
   */
  private formatIntelligence(result: CommandResult, _context: CommandContext): FormattedResponse {
    const data = result.data as {
      timestamp: string;
      question: string;
      marketTicker?: string;
      marketPrice?: number;
      baseRate: {
        rate: number;
        sampleSize: number;
        confidence: 'low' | 'medium' | 'high';
        similarMarkets: Array<{ title: string; result: string; price: number }>;
      };
      consensus: {
        aggregatedProbability: number;
        sources: Array<{ platform: string; probability: number; volume?: number }>;
        divergence: number;
      };
      keyFactors: string[];
      biasWarnings: string[];
      recommendedRange: { low: number; high: number };
    };

    let text = `🔮 *PREDICTION INTELLIGENCE*\n${SEPARATOR}\n\n`;

    text += `📋 *Question:* ${data.question}\n\n`;

    // Market price
    if (data.marketPrice !== undefined) {
      text += `📊 *Current Market:* ${(data.marketPrice * 100).toFixed(0)}% YES\n\n`;
    }

    // Base rate
    const confEmoji = { high: '🎯', medium: '📊', low: '🤔' }[data.baseRate.confidence];
    text += `📈 *BASE RATE ANALYSIS*\n`;
    text += `Historical rate: ${(data.baseRate.rate * 100).toFixed(0)}%\n`;
    text += `Sample size: ${data.baseRate.sampleSize} similar markets\n`;
    text += `Confidence: ${confEmoji} ${data.baseRate.confidence.toUpperCase()}\n`;

    if (data.baseRate.similarMarkets.length > 0) {
      text += '\nSimilar resolved:\n';
      for (const m of data.baseRate.similarMarkets.slice(0, 3)) {
        text += `• ${formatUtils.truncate(m.title, 35)}... → ${m.result.toUpperCase()}\n`;
      }
    }
    text += '\n';

    // Consensus
    if (data.consensus.sources.length > 0) {
      text += `📊 *MARKET CONSENSUS*\n`;
      text += `Aggregated: ${(data.consensus.aggregatedProbability * 100).toFixed(0)}%\n`;
      text += `Sources: ${data.consensus.sources.length}\n`;
      text += `Divergence: ${(data.consensus.divergence * 100).toFixed(0)}%\n\n`;
    }

    // Recommended range
    text += `🎯 *RECOMMENDED RANGE*\n`;
    text += `${(data.recommendedRange.low * 100).toFixed(0)}% - ${(data.recommendedRange.high * 100).toFixed(0)}%\n\n`;

    // Key factors
    if (data.keyFactors.length > 0) {
      text += `💡 *KEY FACTORS*\n`;
      for (const factor of data.keyFactors.slice(0, 3)) {
        text += `• ${factor}\n`;
      }
      text += '\n';
    }

    // Bias warnings
    if (data.biasWarnings.length > 0) {
      text += `⚠️ *BIAS WARNINGS*\n`;
      for (const warning of data.biasWarnings.slice(0, 2)) {
        text += `• ${warning}\n`;
      }
    }

    text += `\n${SEPARATOR}\n`;
    text += `/predict - Make a prediction\n`;
    text += `/smartpredict - AI-assisted prediction`;

    return {
      text: this.truncate(text),
      parseMode: 'Markdown',
    };
  }

  /**
   * Format recommendations result
   */
  private formatRecommendations(result: CommandResult, _context: CommandContext): FormattedResponse {
    const data = result.data as {
      timestamp: string;
      userId: string;
      hasProfile: boolean;
      profile?: {
        avgBrier: number;
        totalPredictions: number;
        strongCategories: string[];
        weakCategories: string[];
        recentAccuracy: number;
        tier: string;
      };
      forYou: Array<{
        ticker: string;
        title: string;
        category: string;
        currentPrice: number;
        volume: number;
        reason: string;
        confidence: string;
        matchScore: number;
      }>;
      trending: Array<{
        ticker: string;
        title: string;
        currentPrice: number;
        volume: number;
        reason: string;
      }>;
      undervalued: Array<{
        ticker: string;
        title: string;
        currentPrice: number;
        reason: string;
        suggestedAction?: { direction: string; probability: number; rationale: string };
      }>;
      educational: Array<{
        ticker: string;
        title: string;
        currentPrice: number;
        reason: string;
      }>;
      totalRecommendations: number;
    };

    let text = `🎯 *MARKET RECOMMENDATIONS*\n${SEPARATOR}\n\n`;

    // Profile summary
    if (data.profile) {
      text += `📊 *Your Profile*\n`;
      text += `Level: ${data.profile.tier} (Brier: ${data.profile.avgBrier.toFixed(3)})\n`;
      text += `Strong in: ${data.profile.strongCategories.join(', ') || 'Building track record'}\n`;
      text += `Recent accuracy: ${(data.profile.recentAccuracy * 100).toFixed(0)}%\n\n`;
    }

    // For you
    if (data.forYou.length > 0) {
      text += `✨ *RECOMMENDED FOR YOU*\n`;
      for (const rec of data.forYou.slice(0, 4)) {
        const priceEmoji = rec.currentPrice > 0.7 ? '🟢' : rec.currentPrice < 0.3 ? '🔴' : '⚪';
        text += `${priceEmoji} *${formatUtils.truncate(rec.title, 35)}*\n`;
        text += `   \`${rec.ticker}\` | ${(rec.currentPrice * 100).toFixed(0)}¢\n`;
        text += `   ${rec.reason}\n\n`;
      }
    }

    // Trending
    if (data.trending.length > 0) {
      text += `🔥 *TRENDING*\n`;
      for (const rec of data.trending.slice(0, 3)) {
        text += `• ${formatUtils.truncate(rec.title, 35)}\n`;
        text += `  ${(rec.currentPrice * 100).toFixed(0)}¢ | Vol: ${formatUtils.formatUsd(rec.volume)}\n`;
      }
      text += '\n';
    }

    // Undervalued
    if (data.undervalued.length > 0) {
      text += `💎 *POTENTIAL VALUE*\n`;
      for (const rec of data.undervalued.slice(0, 2)) {
        text += `• ${formatUtils.truncate(rec.title, 35)}\n`;
        text += `  ${rec.reason}\n`;
        if (rec.suggestedAction) {
          text += `  💡 Consider: ${rec.suggestedAction.direction} @ ${rec.suggestedAction.probability}%\n`;
        }
      }
      text += '\n';
    }

    // Educational
    if (data.educational.length > 0) {
      text += `📚 *GOOD FOR PRACTICE*\n`;
      for (const rec of data.educational.slice(0, 2)) {
        text += `• ${formatUtils.truncate(rec.title, 35)} (${(rec.currentPrice * 100).toFixed(0)}¢)\n`;
      }
    }

    text += `\n${SEPARATOR}\n`;
    text += `📝 To predict: /smartpredict <ticker> <prob> YES|NO`;

    return {
      text: this.truncate(text),
      parseMode: 'Markdown',
    };
  }

  /**
   * Format feedback result
   */
  private formatFeedback(result: CommandResult, _context: CommandContext): FormattedResponse {
    const data = result.data as {
      timestamp: string;
      userId: string;
      totalPredictions: number;
      resolvedPredictions: number;
      avgBrierScore: number;
      tier: string;
      calibrationGrade: string;
      calibrationBuckets: Array<{
        range: string;
        count: number;
        expectedRate: number;
        actualRate: number;
        calibrationError: number;
      }>;
      overconfidenceScore: number;
      isOverconfident: boolean;
      isUnderconfident: boolean;
      trends: Array<{
        period: string;
        avgBrier: number;
        count: number;
        direction: string;
      }>;
      isImproving: boolean;
      strongAreas: string[];
      weakAreas: string[];
      biasPatterns: string[];
      recommendations: string[];
      achievements: string[];
      streak?: { type: string; count: number };
    };

    let text = `📊 *CALIBRATION FEEDBACK*\n${SEPARATOR}\n\n`;

    // Tier and grade
    text += `🎖️ *TIER:* ${data.tier.toUpperCase()}\n`;
    text += `📈 Brier Score: ${data.avgBrierScore.toFixed(4)}\n`;
    text += `📊 Calibration Grade: ${data.calibrationGrade}\n`;
    text += `📋 Predictions: ${data.resolvedPredictions} resolved / ${data.totalPredictions} total\n\n`;

    // Streak
    if (data.streak && data.streak.count > 0) {
      const emoji = data.streak.type === 'win' ? '🔥' : '❄️';
      text += `${emoji} Current Streak: ${data.streak.count} ${data.streak.type}s\n\n`;
    }

    // Achievements
    if (data.achievements.length > 0) {
      text += `🏆 *ACHIEVEMENTS*\n`;
      for (const achievement of data.achievements.slice(0, 3)) {
        text += `${achievement}\n`;
      }
      text += '\n';
    }

    // Calibration tendency
    text += `📉 *CALIBRATION ANALYSIS*\n`;
    if (data.isOverconfident) {
      text += `⚠️ Tendency: OVERCONFIDENT (+${(data.overconfidenceScore * 100).toFixed(0)}%)\n`;
    } else if (data.isUnderconfident) {
      text += `⚠️ Tendency: UNDERCONFIDENT (${(data.overconfidenceScore * 100).toFixed(0)}%)\n`;
    } else {
      text += `✅ Well-calibrated (${(data.overconfidenceScore * 100).toFixed(1)}% deviation)\n`;
    }
    text += '\n';

    // Trends
    if (data.trends.length > 0) {
      text += `📈 *PERFORMANCE TREND*\n`;
      for (const trend of data.trends) {
        const emoji = trend.direction === 'improving' ? '📈' : trend.direction === 'declining' ? '📉' : '➡️';
        text += `${trend.period}: ${trend.avgBrier.toFixed(3)} Brier (${trend.count} preds) ${emoji}\n`;
      }
      text += `Overall: ${data.isImproving ? '✅ Improving!' : 'Keep working at it!'}\n\n`;
    }

    // Strengths & weaknesses
    if (data.strongAreas.length > 0 || data.weakAreas.length > 0) {
      text += `💪 *STRENGTHS & WEAKNESSES*\n`;
      if (data.strongAreas.length > 0) {
        text += `Strong: ${data.strongAreas.join(', ')}\n`;
      }
      if (data.weakAreas.length > 0) {
        text += `Weak: ${data.weakAreas.join(', ')}\n`;
      }
      text += '\n';
    }

    // Bias patterns
    if (data.biasPatterns.length > 0) {
      text += `⚠️ *BIAS PATTERNS*\n`;
      for (const pattern of data.biasPatterns.slice(0, 2)) {
        text += `• ${pattern}\n`;
      }
      text += '\n';
    }

    // Recommendations
    if (data.recommendations.length > 0) {
      text += `💡 *RECOMMENDATIONS*\n`;
      for (const rec of data.recommendations.slice(0, 3)) {
        text += `• ${rec}\n`;
      }
    }

    text += `\n${SEPARATOR}\n`;
    text += `/learnings - View detailed insights`;

    return {
      text: this.truncate(text),
      parseMode: 'Markdown',
    };
  }

  /**
   * Format learnings result
   */
  private formatLearnings(result: CommandResult, _context: CommandContext): FormattedResponse {
    const data = result.data as {
      timestamp: string;
      userId: string;
      analyzedPredictions: number;
      bestPredictions: Array<{
        question: string;
        direction: string;
        probability: number;
        brierScore: number;
        wasCorrect: boolean;
      }>;
      worstPredictions: Array<{
        question: string;
        direction: string;
        probability: number;
        brierScore: number;
        wasCorrect: boolean;
      }>;
      recentLessons: Array<{
        question: string;
        wasCorrect: boolean;
        brierScore: number;
        quality: string;
        lesson: string;
        category: string;
      }>;
      patterns: Array<{
        pattern: string;
        frequency: number;
        impact: number;
        recommendation: string;
      }>;
      personalRules: string[];
      summary: {
        avgBrier: number;
        correctRate: number;
        overconfidenceFrequency: number;
        biggestImprovement: string;
      };
    };

    let text = `📚 *LEARNING INSIGHTS*\n${SEPARATOR}\n\n`;

    // Overview
    text += `📊 *Overview*\n`;
    text += `Analyzed: ${data.analyzedPredictions} predictions\n`;
    text += `Correct rate: ${(data.summary.correctRate * 100).toFixed(0)}%\n`;
    text += `Avg Brier: ${data.summary.avgBrier.toFixed(4)}\n\n`;

    // Best predictions
    if (data.bestPredictions.length > 0) {
      text += `⭐ *YOUR BEST PREDICTIONS*\n`;
      for (const pred of data.bestPredictions.slice(0, 3)) {
        text += `• ${formatUtils.truncate(pred.question, 35)}...\n`;
        text += `  ${pred.direction} @ ${(pred.probability * 100).toFixed(0)}% → Brier: ${pred.brierScore.toFixed(4)} ✅\n`;
      }
      text += '\n';
    }

    // Worst predictions
    if (data.worstPredictions.length > 0) {
      text += `📉 *LEARN FROM THESE*\n`;
      for (const pred of data.worstPredictions.slice(0, 3)) {
        const lesson = data.recentLessons.find(l => l.question === pred.question);
        text += `• ${formatUtils.truncate(pred.question, 35)}...\n`;
        text += `  ${pred.direction} @ ${(pred.probability * 100).toFixed(0)}% → Brier: ${pred.brierScore.toFixed(4)} ${pred.wasCorrect ? '' : '❌'}\n`;
        if (lesson) {
          text += `  ${lesson.lesson}\n`;
        }
      }
      text += '\n';
    }

    // Patterns
    if (data.patterns.length > 0) {
      text += `🔍 *PATTERNS DETECTED*\n`;
      for (const pattern of data.patterns.slice(0, 2)) {
        text += `• ${pattern.pattern}\n`;
        text += `  Found in ${pattern.frequency} predictions\n`;
        text += `  💡 ${pattern.recommendation}\n`;
      }
      text += '\n';
    }

    // Personal rules
    if (data.personalRules.length > 0) {
      text += `📋 *YOUR FORECASTING RULES*\n`;
      for (const rule of data.personalRules.slice(0, 3)) {
        text += `${rule}\n`;
      }
      text += '\n';
    }

    // Biggest improvement
    text += `🎯 *BIGGEST IMPROVEMENT OPPORTUNITY*\n`;
    text += `${data.summary.biggestImprovement}`;

    text += `\n\n${SEPARATOR}\n`;
    text += `/feedback - Calibration report`;

    return {
      text: this.truncate(text),
      parseMode: 'Markdown',
    };
  }

  // ===========================================================================
  // TRADING & EXECUTION FORMATTERS
  // ===========================================================================

  /**
   * Format swap result
   */
  private formatSwap(result: CommandResult, _context: CommandContext): FormattedResponse {
    const data = result.data as {
      timestamp: string;
      mode: 'quote' | 'execute';
      inputToken: string;
      outputToken: string;
      inputAmount: number;
      outputAmount: number;
      rate: number;
      priceImpact: number;
      routeSteps: number;
      txSignature?: string;
      solscanUrl?: string;
      isSimulation?: boolean;
    };

    const isExecuted = data.mode === 'execute' && !data.isSimulation;
    const emoji = isExecuted ? '✅' : '💱';
    const title = isExecuted ? 'SWAP EXECUTED' : 'SWAP QUOTE';

    let text = `${emoji} *${title}*\n${SEPARATOR}\n\n`;

    text += `*From:* ${data.inputAmount.toFixed(6)} ${data.inputToken}\n`;
    text += `*To:* ${data.outputAmount.toFixed(6)} ${data.outputToken}\n\n`;

    text += `*Rate:* 1 ${data.inputToken} = ${data.rate.toFixed(6)} ${data.outputToken}\n`;
    text += `*Price Impact:* ${(data.priceImpact * 100).toFixed(3)}%\n`;
    text += `*Route Steps:* ${data.routeSteps}\n\n`;

    // Price impact warning
    if (data.priceImpact > 0.01) {
      text += `⚠️ _High price impact! Consider a smaller trade._\n\n`;
    } else {
      text += `✅ _Price impact acceptable_\n\n`;
    }

    if (data.mode === 'execute') {
      if (data.isSimulation) {
        text += `⚠️ _This was a simulation. Set SOLANA_PRIVATE_KEY to execute real trades._\n`;
      } else if (data.txSignature) {
        text += `*Transaction:*\n\`${data.txSignature.slice(0, 20)}...\`\n`;
      }
    } else {
      text += `💡 _Add --execute to swap:_\n`;
      text += `/swap ${data.inputToken} ${data.outputToken} ${data.inputAmount} --execute`;
    }

    const buttons: Button[] = [];
    if (data.solscanUrl) {
      buttons.push({
        label: '🔗 View on Solscan',
        type: 'url',
        value: data.solscanUrl,
      });
    }

    return {
      text: this.truncate(text),
      parseMode: 'Markdown',
      buttons: buttons.length > 0 ? buttons : undefined,
    };
  }

  /**
   * Format follow/unfollow result
   */
  private formatFollow(result: CommandResult, _context: CommandContext): FormattedResponse {
    const data = result.data as {
      timestamp: string;
      action: 'follow' | 'unfollow' | 'list';
      success: boolean;
      message?: string;
      targetUsername?: string;
      targetStats?: {
        brierScore: number;
        accuracy: number;
        resolvedPredictions: number;
      };
      following?: Array<{
        telegramId: string;
        username?: string;
        brierScore: number;
        accuracy: number;
        resolvedPredictions: number;
        grade: string;
      }>;
      followerCount?: number;
    };

    if (data.action === 'list') {
      // Show following list
      let text = `📡 *COPY TRADING*\n${SEPARATOR}\n\n`;

      if (!data.following || data.following.length === 0) {
        text += `You're not following anyone yet.\n\n`;
        text += `/follow @username - Follow a forecaster\n`;
        text += `/signals - View signals from top forecasters\n`;
        text += `/leaderboard - Find top performers`;
      } else {
        text += `*Following:* ${data.following.length}\n`;
        if (data.followerCount !== undefined) {
          text += `*Followers:* ${data.followerCount}\n`;
        }
        text += '\n';

        for (const user of data.following) {
          const username = user.username ? `@${user.username}` : `User-${user.telegramId.slice(-4)}`;
          text += `${this.getGradeEmoji(user.grade)} *${username}*\n`;
          text += `   Brier: ${user.brierScore.toFixed(3)} | Acc: ${(user.accuracy * 100).toFixed(0)}%\n\n`;
        }

        text += `${SEPARATOR}\n`;
        text += `/signals - View their predictions\n`;
        text += `/unfollow @username - Stop following`;
      }

      return {
        text: this.truncate(text),
        parseMode: 'Markdown',
      };
    }

    // Follow/unfollow action
    const emoji = data.success ? (data.action === 'follow' ? '✅' : '👋') : '❌';
    let text = `${emoji} ${data.message || (data.success ? 'Success' : 'Failed')}\n`;

    if (data.success && data.action === 'follow' && data.targetStats) {
      text += `\n*Stats:*\n`;
      text += `Brier: ${data.targetStats.brierScore.toFixed(3)}\n`;
      text += `Accuracy: ${(data.targetStats.accuracy * 100).toFixed(0)}%\n`;
      text += `Predictions: ${data.targetStats.resolvedPredictions}\n`;
      text += `\n/signals - See their predictions`;
    }

    return {
      text,
      parseMode: 'Markdown',
    };
  }

  /**
   * Format signals result
   */
  private formatSignals(result: CommandResult, _context: CommandContext): FormattedResponse {
    const data = result.data as {
      timestamp: string;
      userId: string;
      source: 'followed' | 'top';
      signals: Array<{
        id: string;
        forecasterTelegramId: string;
        forecasterUsername?: string;
        forecasterGrade: string;
        prediction: {
          id: string;
          question: string;
          direction: 'YES' | 'NO';
          probability: number;
          outcome?: boolean;
          isResolved: boolean;
          wasCorrect?: boolean;
          createdAt: string;
        };
        createdAt: string;
      }>;
      followingCount: number;
      hasMore: boolean;
    };

    const title = data.source === 'followed' ? 'SIGNALS FROM FOLLOWED' : 'TOP FORECASTER SIGNALS';
    let text = `📡 *${title}*\n${SEPARATOR}\n\n`;

    if (data.signals.length === 0) {
      text += `No recent signals in the last 7 days.\n\n`;
      if (data.source === 'followed') {
        text += `/follow @username - Follow more forecasters\n`;
      }
      text += `/leaderboard - Find top performers`;

      return {
        text,
        parseMode: 'Markdown',
      };
    }

    for (const signal of data.signals.slice(0, 8)) {
      const pred = signal.prediction;
      const username = signal.forecasterUsername ? `@${signal.forecasterUsername}` : 'Anonymous';
      const outcome = pred.isResolved
        ? (pred.wasCorrect ? '✅' : '❌')
        : '⏳';

      text += `${signal.forecasterGrade} *${username}*\n`;
      text += `${outcome} ${formatUtils.truncate(pred.question, 40)}...\n`;
      text += `   ${pred.direction} @ ${(pred.probability * 100).toFixed(0)}%\n`;
      text += `   ${new Date(pred.createdAt).toLocaleDateString()}\n\n`;
    }

    text += `${SEPARATOR}\n`;
    if (data.source === 'top') {
      text += `/follow @username - Start following`;
    } else {
      text += `/follow @username - Follow more\n`;
      text += `/predict - Make your own prediction`;
    }

    return {
      text: this.truncate(text),
      parseMode: 'Markdown',
    };
  }

  /**
   * Helper for grade emoji
   */
  private getGradeEmoji(grade: string): string {
    const gradeMap: Record<string, string> = {
      'Elite': '🏆',
      'Expert': '⭐',
      'Advanced': '✨',
      'Intermediate': '👍',
      'Beginner': '📊',
      'New': '🆕',
    };
    return gradeMap[grade] || '📊';
  }

  // ===========================================================================
  // MONITORING & ALERTS FORMATTERS
  // ===========================================================================

  /**
   * Format alert result
   */
  private formatAlert(result: CommandResult, _context: CommandContext): FormattedResponse {
    const data = result.data as {
      timestamp: string;
      action: 'create' | 'delete' | 'list';
      success: boolean;
      message?: string;
      alert?: {
        id: string;
        marketQuery: string;
        marketTitle?: string;
        platform?: string;
        direction: 'YES' | 'NO';
        condition: 'above' | 'below';
        threshold: number;
        currentPrice?: number;
        status: string;
        createdAt: string;
        triggeredAt?: string;
        triggerCount: number;
      };
      alerts?: Array<{
        id: string;
        marketQuery: string;
        marketTitle?: string;
        direction: 'YES' | 'NO';
        condition: 'above' | 'below';
        threshold: number;
        currentPrice?: number;
        status: string;
        triggerCount: number;
      }>;
      totalAlerts?: number;
    };

    if (data.action === 'list') {
      let text = `🔔 *YOUR ALERTS*\n${SEPARATOR}\n\n`;

      if (!data.alerts || data.alerts.length === 0) {
        text += `No active alerts.\n\n`;
        text += `Create one with:\n`;
        text += `/alert bitcoin below 80\n`;
        text += `/alert fed rate above 60`;
      } else {
        for (const alert of data.alerts) {
          const statusEmoji = alert.status === 'active' ? '🟢' : alert.status === 'triggered' ? '🔔' : '⚪';
          text += `${statusEmoji} \`${alert.id.slice(0, 8)}\`\n`;
          text += `   ${formatUtils.truncate(alert.marketTitle || alert.marketQuery, 35)}\n`;
          text += `   ${alert.direction} ${alert.condition} ${alert.threshold}%`;
          if (alert.currentPrice !== undefined) {
            text += ` (now: ${(alert.currentPrice * 100).toFixed(0)}%)`;
          }
          text += `\n\n`;
        }
        text += `${SEPARATOR}\n`;
        text += `/alert delete <id> - Remove alert`;
      }

      return {
        text: this.truncate(text),
        parseMode: 'Markdown',
      };
    }

    if (data.action === 'create' && data.alert) {
      let text = `🔔 *ALERT CREATED*\n${SEPARATOR}\n\n`;
      text += `📊 ${formatUtils.truncate(data.alert.marketTitle || data.alert.marketQuery, 40)}\n\n`;
      text += `Trigger: ${data.alert.direction} ${data.alert.condition} ${data.alert.threshold}%\n`;
      if (data.alert.currentPrice !== undefined) {
        text += `Current: ${(data.alert.currentPrice * 100).toFixed(1)}%\n`;
      }
      text += `ID: \`${data.alert.id.slice(0, 8)}\`\n\n`;
      text += `${SEPARATOR}\n`;
      text += `/alert - View all alerts`;

      return {
        text,
        parseMode: 'Markdown',
      };
    }

    if (data.action === 'delete') {
      return {
        text: `🔔 ${data.success ? 'Alert deleted' : data.message || 'Alert not found'}`,
        parseMode: 'Markdown',
      };
    }

    return {
      text: data.message || 'Alert action completed',
      parseMode: 'Markdown',
    };
  }

  /**
   * Format whale result
   */
  private formatWhale(result: CommandResult, _context: CommandContext): FormattedResponse {
    const data = result.data as {
      timestamp: string;
      mode: 'scan' | 'check' | 'add';
      movements?: Array<{
        wallet: string;
        whaleName: string;
        whaleAccuracy: number;
        signature: string;
        timestamp: string | null;
        type: string;
        totalUsd: number;
        fee: number;
        description: string;
      }>;
      totalMovements?: number;
      totalVolume?: number;
      wallet?: {
        address: string;
        balance: { sol: number; usdc: number } | null;
        recentTransactions: Array<{ totalUsd: number; type: string }>;
      };
      added?: { address: string; name: string };
    };

    if (data.mode === 'add' && data.added) {
      let text = `🐋 *WHALE ADDED*\n${SEPARATOR}\n\n`;
      text += `Name: ${data.added.name}\n`;
      text += `Address: \`${data.added.address.slice(0, 8)}...${data.added.address.slice(-6)}\`\n\n`;
      text += `/whale - View whale activity`;

      return {
        text,
        parseMode: 'Markdown',
      };
    }

    if (data.mode === 'check' && data.wallet) {
      let text = `🐋 *WALLET CHECK*\n${SEPARATOR}\n\n`;
      text += `Address: \`${data.wallet.address.slice(0, 8)}...${data.wallet.address.slice(-6)}\`\n\n`;

      if (data.wallet.balance) {
        text += `*Balances:*\n`;
        text += `   SOL: ${data.wallet.balance.sol.toFixed(4)}\n`;
        text += `   USDC: ${formatUtils.formatUsd(data.wallet.balance.usdc)}\n\n`;
      }

      if (data.wallet.recentTransactions.length > 0) {
        text += `*Recent Activity:*\n`;
        for (const tx of data.wallet.recentTransactions.slice(0, 5)) {
          text += `   ${tx.type}: ${formatUtils.formatUsd(tx.totalUsd)}\n`;
        }
      } else {
        text += `No recent transactions.\n`;
      }

      return {
        text: this.truncate(text),
        parseMode: 'Markdown',
      };
    }

    // Default: scan mode
    let text = `🐋 *WHALE ACTIVITY*\n${SEPARATOR}\n\n`;

    if (!data.movements || data.movements.length === 0) {
      text += `No whale movements detected.\n\n`;
      text += `/whale add <address> <name> - Track a wallet`;
    } else {
      text += `Found ${data.totalMovements} movements\n`;
      if (data.totalVolume) {
        text += `Total Volume: ${formatUtils.formatUsd(data.totalVolume)}\n`;
      }
      text += `\n`;

      for (const m of data.movements.slice(0, 8)) {
        const acc = m.whaleAccuracy > 70 ? '🎯' : m.whaleAccuracy > 50 ? '📊' : '❓';
        text += `${acc} *${m.whaleName}*\n`;
        text += `   ${m.type}: ${formatUtils.formatUsd(m.totalUsd)}\n`;
        text += `   ${formatUtils.truncate(m.description, 40)}\n\n`;
      }

      text += `${SEPARATOR}\n`;
      text += `/whale check <address> - Check wallet`;
    }

    return {
      text: this.truncate(text),
      parseMode: 'Markdown',
    };
  }

  /**
   * Format arbitrage result
   */
  private formatArbitrage(result: CommandResult, _context: CommandContext): FormattedResponse {
    const data = result.data as {
      timestamp: string;
      query?: string;
      opportunities: Array<{
        topic: string;
        platformA: string;
        platformB: string;
        marketATitle?: string;
        marketBTitle?: string;
        priceAYes: number;
        priceBYes: number;
        spread: number;
        strategy: string;
        profitPercent: number;
        matchConfidence: number;
        volumeA?: number;
        volumeB?: number;
      }>;
      totalOpportunities: number;
      bestSpread?: number;
      platformsScanned: string[];
      scanDurationMs: number;
    };

    let text = `📊 *ARBITRAGE SCAN*\n${SEPARATOR}\n\n`;

    if (data.query) {
      text += `Query: "${data.query}"\n`;
    }
    text += `Scanned: ${data.platformsScanned.join(', ')}\n`;
    text += `Duration: ${data.scanDurationMs}ms\n\n`;

    if (data.opportunities.length === 0) {
      text += `No arbitrage opportunities found.\n\n`;
      text += `Try:\n`;
      text += `/arb bitcoin\n`;
      text += `/arb election`;
    } else {
      text += `Found ${data.totalOpportunities} opportunities\n`;
      if (data.bestSpread) {
        text += `Best Spread: ${(data.bestSpread * 100).toFixed(1)}%\n`;
      }
      text += `\n`;

      for (const opp of data.opportunities.slice(0, 6)) {
        const spreadEmoji = opp.spread > 0.1 ? '🔥' : opp.spread > 0.05 ? '⚡' : '📈';
        text += `${spreadEmoji} *${formatUtils.truncate(opp.topic, 35)}*\n`;
        text += `   ${opp.platformA}: ${(opp.priceAYes * 100).toFixed(0)}%\n`;
        text += `   ${opp.platformB}: ${(opp.priceBYes * 100).toFixed(0)}%\n`;
        text += `   Spread: ${(opp.spread * 100).toFixed(1)}% | Profit: ${opp.profitPercent.toFixed(1)}%\n`;
        if (opp.matchConfidence < 0.9) {
          text += `   ⚠️ Match confidence: ${(opp.matchConfidence * 100).toFixed(0)}%\n`;
        }
        text += `\n`;
      }

      text += `${SEPARATOR}\n`;
      text += `/research <topic> - Deep dive on opportunity`;
    }

    return {
      text: this.truncate(text),
      parseMode: 'Markdown',
    };
  }

  /**
   * Format subscribe result
   */
  private formatSubscribe(result: CommandResult, _context: CommandContext): FormattedResponse {
    const data = result.data as {
      timestamp: string;
      action: 'subscribe' | 'unsubscribe' | 'update' | 'status';
      success: boolean;
      message?: string;
      subscription?: {
        telegramId: string;
        username?: string;
        alerts: Array<{
          type: 'arb' | 'whale' | 'price' | 'brief';
          enabled: boolean;
          threshold?: number;
        }>;
        briefTime: string;
        timezone: string;
        lastBriefSent?: string;
        createdAt: string;
      };
    };

    if (data.action === 'subscribe') {
      let text = `✅ *SUBSCRIBED*\n${SEPARATOR}\n\n`;
      text += `You're now receiving alerts!\n\n`;

      if (data.subscription) {
        text += `*Enabled Alerts:*\n`;
        for (const alert of data.subscription.alerts) {
          const emoji = alert.enabled ? '✅' : '❌';
          let line = `${emoji} ${alert.type.toUpperCase()}`;
          if (alert.threshold) {
            line += ` (${alert.type === 'arb' ? alert.threshold + '%' : '$' + alert.threshold.toLocaleString()})`;
          }
          text += `   ${line}\n`;
        }
        text += `\n📅 Daily brief: ${data.subscription.briefTime} UTC\n`;
      }

      text += `\n${SEPARATOR}\n`;
      text += `/alerts - Customize settings`;

      return {
        text,
        parseMode: 'Markdown',
      };
    }

    if (data.action === 'unsubscribe') {
      return {
        text: `👋 *UNSUBSCRIBED*\n\n${data.message || 'You will no longer receive alerts.'}\n\n/subscribe - Re-enable alerts`,
        parseMode: 'Markdown',
      };
    }

    if (data.action === 'update') {
      return {
        text: `✅ ${data.message || 'Settings updated'}\n\n/alerts - View all settings`,
        parseMode: 'Markdown',
      };
    }

    // Status
    if (data.subscription) {
      let text = `🔔 *YOUR ALERT SETTINGS*\n${SEPARATOR}\n\n`;

      for (const alert of data.subscription.alerts) {
        const emoji = alert.enabled ? '✅' : '❌';
        let line = `${emoji} *${alert.type.toUpperCase()}*`;
        if (alert.threshold) {
          line += ` - ${alert.type === 'arb' ? alert.threshold + '%' : '$' + alert.threshold.toLocaleString()}`;
        }
        text += `${line}\n`;
      }

      text += `\n📅 Daily brief: ${data.subscription.briefTime} UTC\n`;

      if (data.subscription.lastBriefSent) {
        text += `Last sent: ${new Date(data.subscription.lastBriefSent).toLocaleDateString()}\n`;
      }

      text += `\n${SEPARATOR}\n`;
      text += `Commands:\n`;
      text += `/alerts on arb - Enable arb alerts\n`;
      text += `/alerts off whale - Disable whale alerts\n`;
      text += `/alerts threshold arb 5 - Set 5% threshold\n`;
      text += `/alerts time 09:00 - Set brief time\n`;
      text += `/unsubscribe - Stop all alerts`;

      return {
        text: this.truncate(text),
        parseMode: 'Markdown',
      };
    }

    return {
      text: data.message || 'Subscription updated',
      parseMode: 'Markdown',
    };
  }

  // ===========================================================================
  // SYSTEM FORMATTERS
  // ===========================================================================

  /**
   * Format help result
   */
  private formatHelp(result: CommandResult, _context: CommandContext): FormattedResponse {
    const data = result.data as {
      timestamp: string;
      mode: 'overview' | 'category' | 'command';
      categories?: Array<{
        name: string;
        commands: Array<{
          command: string;
          description: string;
          examples?: string[];
          tier: string;
        }>;
      }>;
      totalCommands?: number;
      category?: {
        name: string;
        commands: Array<{
          command: string;
          description: string;
          examples?: string[];
          tier: string;
        }>;
      };
      command?: {
        command: string;
        description: string;
        examples?: string[];
        tier: string;
        aliases?: string[];
        requiresAuth?: boolean;
        requiresWallet?: boolean;
      };
    };

    if (data.mode === 'command' && data.command) {
      let text = `*${data.command.command}*\n${SEPARATOR}\n\n`;
      text += `${data.command.description}\n\n`;

      if (data.command.examples && data.command.examples.length > 0) {
        text += `*Examples:*\n`;
        for (const ex of data.command.examples) {
          text += `  \`${ex}\`\n`;
        }
        text += `\n`;
      }

      if (data.command.aliases && data.command.aliases.length > 0) {
        text += `*Also try:* ${data.command.aliases.slice(0, 3).join(', ')}\n`;
      }

      if (data.command.requiresAuth) {
        text += `\n_Requires authentication_`;
      }
      if (data.command.requiresWallet) {
        text += `\n_Requires wallet_`;
      }

      return {
        text,
        parseMode: 'Markdown',
      };
    }

    if (data.mode === 'category' && data.category) {
      let text = `*${data.category.name.toUpperCase()}*\n${SEPARATOR}\n\n`;

      for (const cmd of data.category.commands) {
        text += `\`${cmd.command}\` - ${cmd.description}\n`;
      }

      text += `\n${SEPARATOR}\n`;
      text += `/help <command> - Details on any command`;

      return {
        text: this.truncate(text),
        parseMode: 'Markdown',
      };
    }

    // Overview
    let text = `*BERIGHT COMMANDS*\n${SEPARATOR}\n\n`;

    // Show condensed categories
    const priorityCategories = ['Market Discovery', 'Trading', 'Portfolio & Analytics', 'Predictions', 'Alerts & Notifications'];

    for (const cat of data.categories || []) {
      if (priorityCategories.includes(cat.name)) {
        text += `*${cat.name}*\n`;
        for (const cmd of cat.commands.slice(0, 4)) {
          text += `  \`${cmd.command}\` - ${formatUtils.truncate(cmd.description, 30)}\n`;
        }
        if (cat.commands.length > 4) {
          text += `  _+${cat.commands.length - 4} more..._\n`;
        }
        text += `\n`;
      }
    }

    text += `${SEPARATOR}\n`;
    text += `${data.totalCommands || 0} commands available\n`;
    text += `/help <category> - View category\n`;
    text += `/help <command> - Command details`;

    return {
      text: this.truncate(text),
      parseMode: 'Markdown',
    };
  }

  /**
   * Format settings result
   */
  private formatSettings(result: CommandResult, _context: CommandContext): FormattedResponse {
    const data = result.data as {
      timestamp: string;
      action: 'view' | 'update';
      success: boolean;
      message?: string;
      settings?: {
        userId: string;
        memberSince: string;
        lastActive: string;
        totalMessages: number;
        riskTolerance?: 'low' | 'medium' | 'high';
        communicationStyle?: string;
        preferredTopics?: string[];
        favoriteCommands?: string[];
        predictionsCount?: number;
        calibrationScore?: number;
      };
      updated?: {
        field: string;
        value: string;
      };
    };

    if (data.action === 'update') {
      return {
        text: `${data.message || 'Settings updated'}\n\n/settings - View all settings`,
        parseMode: 'Markdown',
      };
    }

    // View settings
    if (!data.settings) {
      return {
        text: 'Unable to load settings',
        parseMode: 'Markdown',
      };
    }

    const s = data.settings;
    let text = `*YOUR SETTINGS*\n${SEPARATOR}\n\n`;

    // Account info
    const memberDate = new Date(s.memberSince).toLocaleDateString();
    text += `*Account*\n`;
    text += `  Member since: ${memberDate}\n`;
    text += `  Messages: ${s.totalMessages}\n\n`;

    // Preferences
    text += `*Preferences*\n`;
    text += `  Risk: ${s.riskTolerance || 'not set'}\n`;
    text += `  Style: ${s.communicationStyle || 'not set'}\n`;

    if (s.preferredTopics && s.preferredTopics.length > 0) {
      text += `  Topics: ${s.preferredTopics.slice(0, 3).join(', ')}\n`;
    }

    // Track record
    if (s.predictionsCount || s.calibrationScore) {
      text += `\n*Track Record*\n`;
      if (s.predictionsCount) {
        text += `  Predictions: ${s.predictionsCount}\n`;
      }
      if (s.calibrationScore) {
        text += `  Calibration: ${(s.calibrationScore * 100).toFixed(0)}%\n`;
      }
    }

    text += `\n${SEPARATOR}\n`;
    text += `*Update Settings:*\n`;
    text += `/settings risk low|medium|high\n`;
    text += `/settings style brief|detailed\n`;
    text += `/settings topic <interest>`;

    return {
      text: this.truncate(text),
      parseMode: 'Markdown',
    };
  }

  // ===========================================================================
  // KALSHI FORMATTERS
  // ===========================================================================

  /**
   * Format Kalshi overview
   */
  private formatKalshiOverview(result: CommandResult, _context: CommandContext): FormattedResponse {
    const data = result.data as {
      timestamp: string;
      exchange: { active: boolean; tradingActive: boolean };
      hotMarkets: Array<{
        ticker: string;
        title: string;
        yesPrice: number;
        volume24h: number;
        category?: string;
      }>;
      totalMarkets: number;
      portfolio?: {
        balance: number;
        available: number;
        positions: number;
        orders: number;
        isDemo: boolean;
      };
      isConfigured: boolean;
    };

    const demoTag = data.portfolio?.isDemo ? ' 🎮 DEMO' : '';
    let text = `📊 *KALSHI${demoTag}*\n${SEPARATOR}\n\n`;

    // Exchange status
    const statusEmoji = data.exchange.tradingActive ? '🟢' : '🔴';
    text += `${statusEmoji} Exchange: ${data.exchange.tradingActive ? 'Active' : 'Inactive'}\n`;
    text += `📈 Markets: ${data.totalMarkets}\n\n`;

    // Portfolio if configured
    if (data.portfolio) {
      text += `💰 *YOUR ACCOUNT*\n`;
      text += `Balance: ${formatUtils.formatUsd(data.portfolio.balance)}\n`;
      text += `Available: ${formatUtils.formatUsd(data.portfolio.available)}\n`;
      text += `Positions: ${data.portfolio.positions} | Orders: ${data.portfolio.orders}\n\n`;
    }

    // Hot markets
    if (data.hotMarkets && data.hotMarkets.length > 0) {
      text += `🔥 *HOT MARKETS*\n`;
      for (let i = 0; i < Math.min(data.hotMarkets.length, 5); i++) {
        const m = data.hotMarkets[i];
        const priceEmoji = m.yesPrice > 70 ? '🟢' : m.yesPrice < 30 ? '🔴' : '⚪';
        text += `${i + 1}. ${priceEmoji} ${formatUtils.truncate(m.title, 35)}\n`;
        text += `   \`${m.ticker}\` | YES: ${m.yesPrice}¢ | Vol: ${formatUtils.formatUsd(m.volume24h)}\n`;
      }
    }

    text += `\n${SEPARATOR}\n`;
    text += `/kalshi markets <query> - Search markets\n`;
    text += `/kalshi buy <ticker> <yes|no> <contracts> [price]`;

    return {
      text: this.truncate(text),
      parseMode: 'Markdown',
    };
  }

  /**
   * Format Kalshi markets search
   */
  private formatKalshiMarkets(result: CommandResult, _context: CommandContext): FormattedResponse {
    const data = result.data as {
      query: string;
      timestamp: string;
      markets: Array<{
        ticker: string;
        eventTicker: string;
        title: string;
        subtitle?: string;
        category?: string;
        yesPrice: number;
        noPrice: number;
        yesBid: number;
        yesAsk: number;
        spread: number;
        volume24h: number;
        openInterest: number;
        closeTime: string;
        status: string;
      }>;
      totalResults: number;
      hasMore: boolean;
    };

    if (!data.markets || data.markets.length === 0) {
      return {
        text: `⚪ *No Kalshi markets found for "${data.query}"*\n\nTry a different search or /kalshi for popular markets.`,
        parseMode: 'Markdown',
      };
    }

    let text = `🎯 *KALSHI MARKETS*\n`;
    text += `Query: "${data.query}"\n${SEPARATOR}\n\n`;

    for (let i = 0; i < Math.min(data.markets.length, 10); i++) {
      const m = data.markets[i];
      const priceEmoji = m.yesPrice > 70 ? '🟢' : m.yesPrice < 30 ? '🔴' : '⚪';

      text += `${i + 1}. ${priceEmoji} *${formatUtils.truncate(m.title, 40)}*\n`;
      text += `   Ticker: \`${m.ticker}\`\n`;
      text += `   YES: ${m.yesPrice}¢ (Bid: ${m.yesBid}¢ / Ask: ${m.yesAsk}¢)\n`;

      if (m.volume24h > 0) {
        text += `   Vol: ${formatUtils.formatUsd(m.volume24h)}`;
        if (m.openInterest > 0) {
          text += ` | OI: ${m.openInterest}`;
        }
        text += '\n';
      }

      text += '\n';
    }

    text += `${SEPARATOR}\n`;
    text += `${data.totalResults} results found`;
    if (data.hasMore) {
      text += ' (showing top 10)';
    }
    text += '\n\n';
    text += `/kalshi buy <ticker> <yes|no> <contracts> [price]`;

    return {
      text: this.truncate(text),
      parseMode: 'Markdown',
    };
  }

  /**
   * Format Kalshi buy result
   */
  private formatKalshiBuy(result: CommandResult, _context: CommandContext): FormattedResponse {
    const data = result.data as {
      success: boolean;
      ticker: string;
      marketTitle: string;
      side: 'yes' | 'no';
      contracts: number;
      price: number;
      cost: number;
      orderId?: string;
      status?: string;
      isDemo: boolean;
      timestamp: string;
    };

    const demoTag = data.isDemo ? ' 🎮 DEMO' : '';
    let text = `✅ *KALSHI BUY ORDER${demoTag}*\n${SEPARATOR}\n\n`;

    text += `*Market:* ${formatUtils.truncate(data.marketTitle, 40)}\n`;
    text += `*Ticker:* \`${data.ticker}\`\n`;
    text += `*Side:* ${data.side.toUpperCase()}\n`;
    text += `*Contracts:* ${data.contracts}\n`;
    text += `*Price:* ${data.price}¢/contract\n`;
    text += `*Total Cost:* ${formatUtils.formatUsd(data.cost / 100)}\n\n`;

    if (data.orderId) {
      text += `*Order ID:* \`${data.orderId.slice(0, 16)}...\`\n`;
    }
    if (data.status) {
      text += `*Status:* ${data.status}\n`;
    }

    text += `\n/kalshi positions - Check positions\n`;
    text += `/kalshi orders - Check orders`;

    return {
      text: this.truncate(text),
      parseMode: 'Markdown',
    };
  }

  /**
   * Format Kalshi sell result
   */
  private formatKalshiSell(result: CommandResult, _context: CommandContext): FormattedResponse {
    const data = result.data as {
      success: boolean;
      ticker: string;
      marketTitle: string;
      side: 'yes' | 'no';
      contracts: number;
      price: number;
      proceeds: number;
      orderId?: string;
      status?: string;
      isDemo: boolean;
      timestamp: string;
    };

    const demoTag = data.isDemo ? ' 🎮 DEMO' : '';
    let text = `✅ *KALSHI SELL ORDER${demoTag}*\n${SEPARATOR}\n\n`;

    text += `*Market:* ${formatUtils.truncate(data.marketTitle, 40)}\n`;
    text += `*Ticker:* \`${data.ticker}\`\n`;
    text += `*Side:* ${data.side.toUpperCase()}\n`;
    text += `*Contracts:* ${data.contracts}\n`;
    text += `*Price:* ${data.price}¢/contract\n`;
    text += `*Proceeds:* ${formatUtils.formatUsd(data.proceeds / 100)}\n\n`;

    if (data.orderId) {
      text += `*Order ID:* \`${data.orderId.slice(0, 16)}...\`\n`;
    }
    if (data.status) {
      text += `*Status:* ${data.status}\n`;
    }

    text += `\n/kalshi positions - Check positions\n`;
    text += `/kalshi balance - Check balance`;

    return {
      text: this.truncate(text),
      parseMode: 'Markdown',
    };
  }

  /**
   * Format Kalshi positions
   */
  private formatKalshiPositions(result: CommandResult, _context: CommandContext): FormattedResponse {
    const data = result.data as {
      positions: Array<{
        ticker: string;
        marketTitle: string;
        side: 'YES' | 'NO';
        contracts: number;
        avgPrice: number;
        currentPrice: number;
        currentValue: number;
        unrealizedPnL: number;
        unrealizedPnLPct: number;
        restingOrders: number;
      }>;
      totalPositions: number;
      totalValue: number;
      totalUnrealizedPnL: number;
      isDemo: boolean;
      timestamp: string;
    };

    const demoTag = data.isDemo ? ' 🎮 DEMO' : '';
    let text = `📊 *KALSHI POSITIONS${demoTag}*\n${SEPARATOR}\n\n`;

    if (data.positions.length === 0) {
      text += `No open positions found.\n\n`;
      text += `/kalshi markets - Search markets\n`;
      text += `/kalshi buy <ticker> <yes|no> <contracts>`;
      return {
        text,
        parseMode: 'Markdown',
      };
    }

    for (const pos of data.positions) {
      const pnlEmoji = pos.unrealizedPnL >= 0 ? '📈' : '📉';
      const pnlSign = pos.unrealizedPnL >= 0 ? '+' : '';

      text += `*${formatUtils.truncate(pos.marketTitle, 35)}*\n`;
      text += `   \`${pos.ticker}\`\n`;
      text += `   ${pos.side}: ${pos.contracts} @ ${pos.avgPrice}¢ → ${pos.currentPrice}¢\n`;
      text += `   Value: ${formatUtils.formatUsd(pos.currentValue / 100)}\n`;
      text += `   ${pnlEmoji} P&L: ${pnlSign}${formatUtils.formatUsd(pos.unrealizedPnL / 100)} (${pnlSign}${pos.unrealizedPnLPct.toFixed(1)}%)\n`;
      if (pos.restingOrders > 0) {
        text += `   📝 ${pos.restingOrders} resting orders\n`;
      }
      text += '\n';
    }

    text += `${SEPARATOR}\n`;
    text += `*Total Positions:* ${data.totalPositions}\n`;
    text += `*Total Value:* ${formatUtils.formatUsd(data.totalValue / 100)}\n`;
    const totalPnLSign = data.totalUnrealizedPnL >= 0 ? '+' : '';
    text += `*Total P&L:* ${totalPnLSign}${formatUtils.formatUsd(data.totalUnrealizedPnL / 100)}`;

    return {
      text: this.truncate(text),
      parseMode: 'Markdown',
    };
  }

  /**
   * Format Kalshi balance
   */
  private formatKalshiBalance(result: CommandResult, _context: CommandContext): FormattedResponse {
    const data = result.data as {
      balance: {
        total: number;
        available: number;
        inPositions: number;
        pendingSettlement: number;
      };
      positions: {
        open: number;
        totalValue: number;
      };
      orders: {
        resting: number;
        pendingValue: number;
      };
      history: {
        totalTrades: number;
        realizedPnL: number;
        winRate: number;
      };
      isDemo: boolean;
      timestamp: string;
    };

    const demoTag = data.isDemo ? ' 🎮 DEMO' : '';
    let text = `💰 *KALSHI BALANCE${demoTag}*\n${SEPARATOR}\n\n`;

    // Balance
    text += `*BALANCE*\n`;
    text += `Total: ${formatUtils.formatUsd(data.balance.total)}\n`;
    text += `Available: ${formatUtils.formatUsd(data.balance.available)}\n`;
    text += `In Positions: ${formatUtils.formatUsd(data.balance.inPositions)}\n`;
    if (data.balance.pendingSettlement > 0) {
      text += `Pending Settlement: ${formatUtils.formatUsd(data.balance.pendingSettlement)}\n`;
    }
    text += '\n';

    // Positions
    text += `*POSITIONS*\n`;
    text += `Open: ${data.positions.open}\n`;
    text += `Value: ${formatUtils.formatUsd(data.positions.totalValue)}\n\n`;

    // Orders
    text += `*ORDERS*\n`;
    text += `Resting: ${data.orders.resting}\n`;
    text += `Pending Value: ${formatUtils.formatUsd(data.orders.pendingValue)}\n\n`;

    // History
    if (data.history.totalTrades > 0) {
      text += `*HISTORY*\n`;
      text += `Trades: ${data.history.totalTrades}\n`;
      const pnlSign = data.history.realizedPnL >= 0 ? '+' : '';
      text += `Realized P&L: ${pnlSign}${formatUtils.formatUsd(data.history.realizedPnL)}\n`;
      text += `Win Rate: ${(data.history.winRate * 100).toFixed(1)}%\n`;
    }

    text += `\n${SEPARATOR}\n`;
    text += `/kalshi positions - View positions\n`;
    text += `/kalshi orders - View orders`;

    return {
      text: this.truncate(text),
      parseMode: 'Markdown',
    };
  }

  /**
   * Format Kalshi orders
   */
  private formatKalshiOrders(result: CommandResult, _context: CommandContext): FormattedResponse {
    const data = result.data as {
      orders: Array<{
        orderId: string;
        ticker: string;
        side: 'yes' | 'no';
        action: 'buy' | 'sell';
        contracts: number;
        remainingContracts: number;
        price: number;
        status: string;
        createdAt: string;
      }>;
      totalOrders: number;
      totalPendingValue: number;
      isDemo: boolean;
      timestamp: string;
    };

    const demoTag = data.isDemo ? ' 🎮 DEMO' : '';
    let text = `📝 *KALSHI ORDERS${demoTag}*\n${SEPARATOR}\n\n`;

    if (data.orders.length === 0) {
      text += `No resting orders found.\n\n`;
      text += `/kalshi markets - Search markets\n`;
      text += `/kalshi buy <ticker> <yes|no> <contracts>`;
      return {
        text,
        parseMode: 'Markdown',
      };
    }

    for (const order of data.orders) {
      const actionEmoji = order.action === 'buy' ? '🟢' : '🔴';
      text += `${actionEmoji} \`${order.ticker}\`\n`;
      text += `   ${order.action.toUpperCase()} ${order.side.toUpperCase()}\n`;
      text += `   ${order.remainingContracts}/${order.contracts} @ ${order.price}¢\n`;
      text += `   Status: ${order.status}\n`;
      text += `   ID: \`${order.orderId.slice(0, 12)}...\`\n\n`;
    }

    text += `${SEPARATOR}\n`;
    text += `*Total Orders:* ${data.totalOrders}\n`;
    text += `*Pending Value:* ${formatUtils.formatUsd(data.totalPendingValue / 100)}\n\n`;
    text += `/kalshi cancel <orderId> - Cancel order\n`;
    text += `/kalshi cancel all - Cancel all orders`;

    return {
      text: this.truncate(text),
      parseMode: 'Markdown',
    };
  }

  /**
   * Format Kalshi cancel result
   */
  private formatKalshiCancel(result: CommandResult, _context: CommandContext): FormattedResponse {
    const data = result.data as {
      success: boolean;
      orderId?: string;
      canceledCount?: number;
      cancelAll: boolean;
      ticker?: string;
      isDemo: boolean;
      timestamp: string;
    };

    const demoTag = data.isDemo ? ' 🎮 DEMO' : '';
    let text = `✅ *KALSHI CANCEL${demoTag}*\n${SEPARATOR}\n\n`;

    if (data.cancelAll) {
      text += `Canceled ${data.canceledCount} order(s)`;
      if (data.ticker) {
        text += ` for \`${data.ticker}\``;
      }
      text += '\n';
    } else {
      text += `Order \`${data.orderId}\` canceled\n`;
    }

    text += `\n/kalshi orders - View remaining orders\n`;
    text += `/kalshi positions - View positions`;

    return {
      text: this.truncate(text),
      parseMode: 'Markdown',
    };
  }

  // ===========================================================================
  // SEMANTIC RESPONSES
  // ===========================================================================

  /**
   * Format semantic (LLM-generated) responses
   *
   * These come pre-formatted from the semantic orchestrator,
   * so we just pass them through with appropriate mood emoji.
   */
  private formatSemantic(result: CommandResult, _context: CommandContext): FormattedResponse {
    const data = result.data as { text: string; mood?: string } | undefined;

    if (!data || !data.text) {
      return this.formatGeneric(result, _context);
    }

    // The text is already formatted by the semantic orchestrator
    // Just add mood emoji if appropriate
    const mood = result.hints?.mood || 'NEUTRAL';
    const emoji = MOOD_EMOJIS[mood];

    // Don't double-add emoji if the text already starts with an emoji
    // Check for common emoji ranges without the 'u' flag
    const startsWithEmoji = /^[\uD83C-\uDBFF][\uDC00-\uDFFF]/.test(data.text) ||
                            /^[\u2600-\u27BF]/.test(data.text);
    const text = startsWithEmoji ? data.text : `${emoji} ${data.text}`;

    return {
      text: this.truncate(text),
      parseMode: 'Markdown',
    };
  }

  // ===========================================================================
  // GENERIC FALLBACK
  // ===========================================================================

  /**
   * Generic formatting for unknown data types
   */
  private formatGeneric(result: CommandResult, _context: CommandContext): FormattedResponse {
    const mood = result.hints?.mood || 'NEUTRAL';
    const emoji = MOOD_EMOJIS[mood];

    let text = `${emoji} *Result*\n${SEPARATOR}\n\n`;

    if (typeof result.data === 'string') {
      text += result.data;
    } else if (typeof result.data === 'object') {
      text += '```\n' + JSON.stringify(result.data, null, 2).slice(0, 3000) + '\n```';
    } else {
      text += String(result.data);
    }

    return {
      text: this.truncate(text),
      parseMode: 'Markdown',
    };
  }

  // ===========================================================================
  // UTILITIES
  // ===========================================================================

  /**
   * Get mood emoji
   */
  getMoodEmoji(mood: Mood): string {
    return MOOD_EMOJIS[mood] || '⚪';
  }

  /**
   * Format price
   */
  formatPrice(price: number): string {
    return formatUtils.formatPct(price);
  }

  /**
   * Format currency
   */
  formatCurrency(amount: number): string {
    return formatUtils.formatUsd(amount);
  }

  /**
   * Format percentage
   */
  formatPercentage(value: number): string {
    return formatUtils.formatPct(value);
  }

  /**
   * Format date
   */
  formatDate(date: Date): string {
    return formatUtils.formatDate(date);
  }

  /**
   * Truncate text to Telegram's max length
   */
  truncate(text: string, maxLength: number = MAX_MESSAGE_LENGTH): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 100) + '\n\n_...truncated_';
  }
}

// =============================================================================
// AUTO-REGISTER
// =============================================================================

// Register Telegram formatter
getFormatterRegistry().register(new TelegramFormatter());

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

let telegramFormatterInstance: TelegramFormatter | null = null;

/**
 * Get Telegram formatter instance
 */
export function getTelegramFormatter(): TelegramFormatter {
  if (!telegramFormatterInstance) {
    telegramFormatterInstance = new TelegramFormatter();
  }
  return telegramFormatterInstance;
}
