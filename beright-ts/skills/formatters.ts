/**
 * Market Display Formatters for BeRight Protocol
 *
 * Clean, concise, alpha-focused formatting for Telegram responses.
 *
 * Design Principles:
 * 1. CLARITY: Easy to scan at a glance
 * 2. ALPHA: Highlight actionable opportunities
 * 3. GROUPING: Related markets together
 * 4. SIGNALS: Visual indicators for key metrics
 */

import { Market, Platform, ArbitrageOpportunity } from '../types/market';
import { ValidatedMarket, TrustLevel, getTrustIndicator } from '../lib/data/types';

// ============================================
// SIGNAL INDICATORS
// ============================================

/**
 * Price confidence signal
 * Shows how decisive the market is (close to 0 or 100 = decisive)
 */
function priceSignal(yesPrice: number): string {
  const pct = yesPrice <= 1 ? yesPrice * 100 : yesPrice;
  if (pct >= 90) return '🟢'; // Very likely YES
  if (pct <= 10) return '🔴'; // Very likely NO
  if (pct >= 70) return '🟡'; // Leaning YES
  if (pct <= 30) return '🟠'; // Leaning NO
  return '⚪'; // Uncertain/contentious - potential alpha
}

/**
 * Volume signal - indicates activity level
 */
function volumeSignal(volume: number): string {
  if (volume >= 10_000_000) return '🐋'; // $10M+ whale territory
  if (volume >= 1_000_000) return '🔥';  // $1M+ high volume
  if (volume >= 100_000) return '📈';    // Active
  return '';                              // Low volume - no badge
}

/**
 * Time signal - closing soon
 */
function timeSignal(endDate: Date | null): string {
  if (!endDate) return '';
  const hoursLeft = (new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursLeft < 0) return '⏹'; // Ended
  if (hoursLeft <= 24) return '⏰';  // Closing today
  if (hoursLeft <= 72) return '⌛'; // Closing soon
  return '';
}

/**
 * Format resolution date compactly
 */
function fmtDate(date: Date | null): string {
  if (!date) return '';
  const d = new Date(date);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const isThisYear = d.getFullYear() === now.getFullYear();
  if (isThisYear) {
    return `${months[d.getMonth()]} ${d.getDate()}`;
  }
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/**
 * Platform badge
 */
function platformBadge(platform: Platform): string {
  switch (platform) {
    case 'polymarket': return 'PM';
    case 'kalshi': return 'KA';
    case 'manifold': return 'MF';
    case 'limitless': return 'LM';
    case 'metaculus': return 'MC';
  }
}

// ============================================
// COMPACT FORMATTERS
// ============================================

/**
 * Format price as clean percentage
 */
function fmtPct(value: number): string {
  const pct = value <= 1 ? value * 100 : value;
  return `${pct.toFixed(0)}%`;
}

/**
 * Format volume compactly
 */
function fmtVol(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
  return `${amount.toFixed(0)}`;
}

/**
 * Smart title truncation - preserves meaning
 */
function smartTitle(title: string, maxLen: number = 45): string {
  if (title.length <= maxLen) return title;

  // Try to cut at a word boundary
  const truncated = title.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxLen * 0.6) {
    return truncated.slice(0, lastSpace) + '...';
  }
  return truncated + '...';
}

// ============================================
// MARKET GROUPING & CLUSTERING
// ============================================

interface MarketGroup {
  category: string;
  emoji: string;
  markets: Market[];
}

interface MarketCluster {
  topic: string;
  primaryMarket: Market;
  relatedMarkets: Market[];
  totalVolume: number;
}

/**
 * Detect market category from title
 */
function detectCategory(title: string): string {
  const t = title.toLowerCase();

  if (/trump|biden|election|president|congress|senate|governor|vote|gop|democrat|republican|nominate|fed chair/i.test(t)) return 'Politics';
  if (/bitcoin|btc|ethereum|eth|crypto|solana|sol|defi|nft/i.test(t)) return 'Crypto';
  if (/ai|artificial intelligence|chatgpt|openai|claude|llm|machine learning|gpt/i.test(t)) return 'AI';
  if (/apple|google|microsoft|meta|amazon|tesla|nvidia|tech|software/i.test(t)) return 'Tech';
  if (/nfl|nba|mlb|nhl|soccer|football|basketball|sports|game|match|super bowl/i.test(t)) return 'Sports';
  if (/fed|rate|inflation|gdp|economy|recession|jobs|unemployment|stock|s&p|shutdown/i.test(t)) return 'Economy';
  if (/climate|space|nasa|vaccine|covid|health|science/i.test(t)) return 'Science';
  if (/movie|oscar|grammy|celebrity|culture|entertainment/i.test(t)) return 'Culture';

  return 'Other';
}

const CATEGORY_EMOJIS: Record<string, string> = {
  'Politics': '🏛',
  'Crypto': '₿',
  'Tech': '💻',
  'Sports': '🏆',
  'Economy': '📊',
  'AI': '🤖',
  'Science': '🔬',
  'Culture': '🎬',
  'Other': '📌',
};

/**
 * Cluster related markets together (e.g., all "Fed Chair nominee" markets)
 * Returns deduplicated clusters sorted by total volume
 */
function clusterRelatedMarkets(markets: Market[]): MarketCluster[] {
  const clusters: MarketCluster[] = [];
  const used = new Set<string>();

  // Sort by volume first
  const sorted = [...markets].sort((a, b) => b.volume - a.volume);

  for (const market of sorted) {
    if (used.has(market.marketId || market.title)) continue;

    // Find related markets (similar topic patterns)
    const related: Market[] = [];
    const basePattern = extractTopicPattern(market.title);

    for (const other of sorted) {
      if (other === market) continue;
      if (used.has(other.marketId || other.title)) continue;

      const otherPattern = extractTopicPattern(other.title);
      if (patternsMatch(basePattern, otherPattern)) {
        related.push(other);
        used.add(other.marketId || other.title);
      }
    }

    used.add(market.marketId || market.title);

    clusters.push({
      topic: basePattern,
      primaryMarket: market,
      relatedMarkets: related,
      totalVolume: market.volume + related.reduce((sum, m) => sum + m.volume, 0),
    });
  }

  return clusters.sort((a, b) => b.totalVolume - a.totalVolume);
}

/**
 * Extract the topic pattern from a market title
 * e.g., "Will Trump nominate Kevin Warsh..." -> "trump nominate fed chair"
 */
function extractTopicPattern(title: string): string {
  const t = title.toLowerCase();

  // Common pattern matching
  if (/trump.*nominate.*fed|fed.*chair.*nomin/i.test(t)) return 'fed_chair_nominee';
  if (/government.*shut.*down|shutdown/i.test(t)) return 'government_shutdown';
  if (/bitcoin.*\d+k|btc.*price/i.test(t)) return 'bitcoin_price';
  if (/ethereum.*\d+|eth.*price/i.test(t)) return 'ethereum_price';
  if (/trump.*tariff|tariff.*china|tariff.*canada|tariff.*mexico/i.test(t)) return 'tariffs';
  if (/president.*202[4-8]|election.*202[4-8]/i.test(t)) return 'presidential_election';
  if (/ai.*generat|ai.*oscar|ai.*film|ai.*movie/i.test(t)) return 'ai_entertainment';
  if (/fed.*rate|interest.*rate.*cut|rate.*hike/i.test(t)) return 'fed_rates';

  // Fallback: use first 3 significant words
  const words = t.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3).slice(0, 3);
  return words.join('_') || 'general';
}

/**
 * Check if two topic patterns are related
 */
function patternsMatch(a: string, b: string): boolean {
  return a === b;
}

/**
 * Categorize markets by topic
 */
function categorizeMarkets(markets: Market[]): MarketGroup[] {
  const groups: Map<string, Market[]> = new Map();

  for (const market of markets) {
    const category = detectCategory(market.title.toLowerCase());
    if (!groups.has(category)) {
      groups.set(category, []);
    }
    groups.get(category)!.push(market);
  }

  return Array.from(groups.entries())
    .map(([category, markets]) => ({
      category,
      emoji: CATEGORY_EMOJIS[category] || '📌',
      markets,
    }))
    .sort((a, b) => b.markets.length - a.markets.length);
}

// ============================================
// MAIN FORMATTERS
// ============================================

/**
 * Format trending markets - ACTIONABLE VIEW
 *
 * Design goals:
 * - Show TICKER so user can trade
 * - Include ready-to-copy trade command
 * - Clear visual hierarchy
 * - Cluster related markets to reduce noise
 */
export function formatTrendingMarkets(markets: Market[]): string {
  if (markets.length === 0) {
    return 'No trending markets found.';
  }

  // Cluster related markets to avoid clutter
  const clusters = clusterRelatedMarkets(markets);

  let output = `🔥 *HOT MOVERS*\n${'━'.repeat(40)}\n`;

  // Show top 6 clusters (after deduplication)
  const topClusters = clusters.slice(0, 6);

  for (let i = 0; i < topClusters.length; i++) {
    const cluster = topClusters[i];
    const m = cluster.primaryMarket;
    const ticker = m.marketId || '';
    const category = detectCategory(m.title);
    const catEmoji = CATEGORY_EMOJIS[category] || '';
    const dateStr = fmtDate(m.endDate);

    // Shorten title - extract the key question
    const shortTitle = shortenTitle(m.title);

    // Determine momentum signal based on price position
    const pricePct = m.yesPrice * 100;

    // Direction indicator
    let momentumIcon = '📊';
    let momentumText = '';
    if (pricePct > 65) {
      momentumIcon = '📈';
      momentumText = ' ⬆️ BULLISH';
    } else if (pricePct < 35) {
      momentumIcon = '📉';
      momentumText = ' ⬇️ BEARISH';
    } else {
      momentumIcon = '⚖️';
      momentumText = ' CONTESTED';
    }

    // Volume signal (hot indicator)
    let volSignal = '';
    if (cluster.totalVolume > 1000000) volSignal = '🔥🔥🔥';
    else if (cluster.totalVolume > 100000) volSignal = '🔥🔥';
    else if (cluster.totalVolume > 10000) volSignal = '🔥';

    output += `\n${momentumIcon} *${shortTitle}*\n`;

    // Stats line with momentum
    output += `   ${pricePct.toFixed(0)}% YES${momentumText}\n`;
    output += `   Vol: $${fmtVol(cluster.totalVolume)} ${volSignal}`;
    if (dateStr) output += `  •  ${dateStr}`;
    output += `  ${catEmoji}\n`;

    // Platform link (clickable)
    if (m.url) {
      output += `   🔗 [Trade on ${m.platform}](${m.url})\n`;
    }

    // Edge calculation - show potential profit
    if (ticker) {
      const betSide = pricePct > 50 ? 'YES' : 'NO';
      const cost = pricePct > 50 ? pricePct : (100 - pricePct);
      const profit = 100 - cost;
      output += `   💰 ${betSide} @ ${cost.toFixed(0)}¢ → Win ${profit.toFixed(0)}¢ per $1\n`;
    }
  }

  output += `\n${'━'.repeat(40)}\n`;
  output += `💡 *Quick Actions:*\n`;
  output += `• /arb - Find cross-platform arbitrage\n`;
  output += `• /closing - Markets expiring soon\n`;
  output += `• /research <topic> - Deep analysis`;

  return output;
}

/**
 * Shorten market title to key question
 * "Will Trump next nominate Kevin Warsh as Fed Chair?" -> "Kevin Warsh as Fed Chair?"
 */
function shortenTitle(title: string): string {
  // Remove common prefixes
  let short = title
    .replace(/^Will\s+/i, '')
    .replace(/^Trump\s+(next\s+)?nominate\s+/i, '')
    .replace(/^the\s+US\s+government\s+/i, 'Gov ')
    .replace(/^In\s+early\s+\d{4},\s+will\s+/i, '')
    .replace(/^an?\s+AI\s+/i, 'AI ');

  // Capitalize first letter
  short = short.charAt(0).toUpperCase() + short.slice(1);

  return smartTitle(short, 38);
}

/**
 * Extract person name from nomination-style markets
 * "Will Trump nominate Kevin Warsh..." -> "Warsh"
 */
function extractPersonName(title: string): string | null {
  // Match patterns like "nominate [Name]" or "[Name] as"
  const nominateMatch = title.match(/nominate\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
  if (nominateMatch) {
    const fullName = nominateMatch[1];
    const parts = fullName.split(' ');
    return parts[parts.length - 1]; // Return last name
  }
  return null;
}

/**
 * Format markets with alpha signals - ACTIONABLE VIEW
 */
export function formatAlphaMarkets(markets: Market[]): string {
  if (markets.length === 0) {
    return 'No markets found.';
  }

  let output = `*MARKET ALPHA*\n${'─'.repeat(28)}\n\n`;

  // Find interesting signals
  const highVolume = markets.filter(m => m.volume >= 1_000_000);
  const uncertain = markets.filter(m => {
    const pct = m.yesPrice <= 1 ? m.yesPrice * 100 : m.yesPrice;
    return pct >= 40 && pct <= 60;
  });
  const decisive = markets.filter(m => {
    const pct = m.yesPrice <= 1 ? m.yesPrice * 100 : m.yesPrice;
    return pct >= 90 || pct <= 10;
  });

  // SECTION 1: High conviction plays (decisive markets with volume)
  const conviction = decisive.filter(m => m.volume >= 100_000).slice(0, 3);
  if (conviction.length > 0) {
    output += ` *HIGH CONVICTION*\n`;
    for (const m of conviction) {
      const pct = m.yesPrice <= 1 ? m.yesPrice * 100 : m.yesPrice;
      const direction = pct >= 50 ? 'YES' : 'NO';
      output += `${smartTitle(m.title, 35)}\n`;
      output += `*${fmtPct(m.yesPrice)}* ${direction}  $${fmtVol(m.volume)}\n\n`;
    }
  }

  // SECTION 2: Contentious markets (potential alpha in uncertainty)
  const contentious = uncertain.filter(m => m.volume >= 100_000).slice(0, 3);
  if (contentious.length > 0) {
    output += ` *CONTENTIOUS* _(smart money split)_\n`;
    for (const m of contentious) {
      output += `${smartTitle(m.title, 35)}\n`;
      output += `*${fmtPct(m.yesPrice)}* YES  $${fmtVol(m.volume)}\n\n`;
    }
  }

  // SECTION 3: Volume spikes (whale activity)
  const whales = highVolume.slice(0, 3);
  if (whales.length > 0 && whales.some(w => !conviction.includes(w) && !contentious.includes(w))) {
    output += ` *WHALE ACTIVITY*\n`;
    for (const m of whales) {
      if (conviction.includes(m) || contentious.includes(m)) continue;
      output += `${smartTitle(m.title, 35)}\n`;
      output += `*${fmtPct(m.yesPrice)}* YES  $${fmtVol(m.volume)}\n\n`;
    }
  }

  output += `_/arb for arbitrage opportunities_`;

  return output;
}

/**
 * Format grouped markets by category
 */
export function formatGroupedMarkets(markets: Market[]): string {
  if (markets.length === 0) {
    return 'No markets found.';
  }

  const groups = categorizeMarkets(markets);
  let output = `*MARKETS BY CATEGORY*\n${'─'.repeat(28)}\n\n`;

  for (const group of groups.slice(0, 4)) {
    output += `${group.emoji} *${group.category.toUpperCase()}*\n`;

    for (const m of group.markets.slice(0, 3)) {
      output += `  ${smartTitle(m.title, 30)} *${fmtPct(m.yesPrice)}*\n`;
    }
    output += '\n';
  }

  return output;
}

/**
 * Format arbitrage opportunities - CLEAN VIEW
 */
export function formatArbOpportunities(opportunities: ArbitrageOpportunity[]): string {
  if (opportunities.length === 0) {
    return `*NO ARBITRAGE*\nMarkets are efficiently priced across platforms.`;
  }

  let output = `*ARBITRAGE DETECTED*\n${'─'.repeat(28)}\n\n`;

  for (let i = 0; i < Math.min(5, opportunities.length); i++) {
    const opp = opportunities[i];

    output += ` *${opp.profitPercent.toFixed(1)}% SPREAD*\n`;
    output += `${smartTitle(opp.topic, 38)}\n`;
    output += `${platformBadge(opp.platformA)} ${fmtPct(opp.priceAYes)} vs ${platformBadge(opp.platformB)} ${fmtPct(opp.priceBYes)}\n`;
    output += `_${opp.strategy}_\n\n`;
  }

  output += `_Execute via /trade or wallet connect_`;

  return output;
}

/**
 * Format single market detail view
 */
export function formatMarketDetail(market: Market): string {
  const signal = priceSignal(market.yesPrice);
  const vol = volumeSignal(market.volume);
  const time = timeSignal(market.endDate);

  let output = `*${market.title}*\n${'─'.repeat(28)}\n\n`;

  output += `${signal} *${fmtPct(market.yesPrice)}* YES / *${fmtPct(market.noPrice)}* NO\n\n`;

  output += ` Platform: ${market.platform}\n`;
  output += `${vol} Volume: $${fmtVol(market.volume)}\n`;

  if (market.liquidity > 0) {
    output += ` Liquidity: $${fmtVol(market.liquidity)}\n`;
  }

  if (market.endDate) {
    output += `${time} Closes: ${market.endDate.toLocaleDateString()}\n`;
  }

  if (market.orderbook) {
    output += `\n*Orderbook*\n`;
    output += `YES: ${fmtPct(market.orderbook.yesBid)} bid / ${fmtPct(market.orderbook.yesAsk)} ask\n`;
    output += `Spread: ${(market.orderbook.spread * 100).toFixed(1)}%\n`;
  }

  output += `\n[View on ${market.platform}](${market.url})`;

  return output;
}

/**
 * Format odds comparison across platforms
 */
export function formatOddsComparison(query: string, markets: Market[]): string {
  if (markets.length === 0) {
    return `No markets found for "${query}"`;
  }

  let output = `*ODDS: ${query.toUpperCase()}*\n${'─'.repeat(28)}\n\n`;

  // Group by platform
  const byPlatform: Record<string, Market[]> = {};
  for (const m of markets) {
    if (!byPlatform[m.platform]) byPlatform[m.platform] = [];
    byPlatform[m.platform].push(m);
  }

  for (const [platform, pMarkets] of Object.entries(byPlatform)) {
    const best = pMarkets[0];
    output += `*${platformBadge(platform as Platform)}* ${fmtPct(best.yesPrice)} YES  $${fmtVol(best.volume)}\n`;
  }

  // Check for arbitrage
  const prices = markets.map(m => m.yesPrice <= 1 ? m.yesPrice * 100 : m.yesPrice);
  const spread = Math.max(...prices) - Math.min(...prices);

  if (spread > 5) {
    output += `\n *${spread.toFixed(1)}% SPREAD DETECTED*\n`;
    output += `_Potential arbitrage opportunity_`;
  }

  return output;
}

// ============================================
// QUICK RESPONSE HELPERS
// ============================================

/**
 * One-liner market summary for inline responses
 */
export function marketOneLiner(market: Market): string {
  return `${smartTitle(market.title, 30)} *${fmtPct(market.yesPrice)}* ($${fmtVol(market.volume)})`;
}

/**
 * Quick list format (3-5 markets)
 */
export function quickList(markets: Market[], title: string): string {
  let output = `*${title}*\n`;
  for (const m of markets.slice(0, 5)) {
    output += `• ${smartTitle(m.title, 35)} *${fmtPct(m.yesPrice)}*\n`;
  }
  return output;
}

// ============================================
// TRUST ENGINE FORMATTERS
// ============================================

/**
 * Trust level badge for display
 */
export function trustBadge(trustLevel: TrustLevel): string {
  switch (trustLevel) {
    case 'verified': return '✅';
    case 'good': return '🟢';
    case 'unverified': return '🟡';
    case 'suspicious': return '🟠';
    case 'filtered': return '🔴';
    default: return '⚪';
  }
}

/**
 * Format trust score as compact indicator
 */
export function fmtTrust(score: number): string {
  const indicator = getTrustIndicator(score);
  return `${indicator.emoji} ${score}`;
}

/**
 * Format validated market with trust indicator
 */
export function formatValidatedMarket(market: ValidatedMarket, index?: number): string {
  const badge = trustBadge(market.trustLevel);
  const freshness = market.isFresh ? '' : ' ⏱️';
  const shortTitle = shortenTitle(market.title);
  const pricePct = market.yesPrice * 100;

  let output = '';
  if (index !== undefined) {
    output += `${index}. `;
  }

  output += `${badge} [${market.platform.toUpperCase()}]${freshness}\n`;
  output += `   ${shortTitle}\n`;
  output += `   YES: ${pricePct.toFixed(0)}%  |  Trust: ${market.trustScore}/100\n`;

  if (market.volume && market.volume > 0) {
    output += `   Vol: $${fmtVol(market.volume)}`;
  }

  if (market.validation.warnings.length > 0) {
    output += `\n   ⚠️ ${market.validation.warnings[0]}`;
  }

  return output;
}

/**
 * Format trending validated markets with trust indicators
 */
export function formatTrendingValidated(markets: ValidatedMarket[]): string {
  if (markets.length === 0) {
    return 'No trending markets found.';
  }

  let output = `🔥 *HOT MOVERS* (Trust Validated)\n${'━'.repeat(40)}\n`;
  output += `\n_Data validated via Trust Engine_\n\n`;

  for (let i = 0; i < Math.min(markets.length, 8); i++) {
    const m = markets[i];
    const badge = trustBadge(m.trustLevel);
    const shortTitle = shortenTitle(m.title);
    const pricePct = m.yesPrice * 100;
    const catEmoji = CATEGORY_EMOJIS[detectCategory(m.title)] || '';

    // Momentum indicator
    let momentumIcon = '📊';
    let momentumText = '';
    if (pricePct > 65) {
      momentumIcon = '📈';
      momentumText = ' ⬆️ BULLISH';
    } else if (pricePct < 35) {
      momentumIcon = '📉';
      momentumText = ' ⬇️ BEARISH';
    } else {
      momentumIcon = '⚖️';
      momentumText = ' CONTESTED';
    }

    // Volume signal
    let volSignal = '';
    if (m.volume && m.volume > 1000000) volSignal = '🔥🔥🔥';
    else if (m.volume && m.volume > 100000) volSignal = '🔥🔥';
    else if (m.volume && m.volume > 10000) volSignal = '🔥';

    output += `\n${momentumIcon} *${shortTitle}* ${badge}\n`;
    output += `   ${pricePct.toFixed(0)}% YES${momentumText}\n`;
    output += `   Trust: ${m.trustScore}/100 ${catEmoji}`;
    if (m.volume && m.volume > 0) {
      output += `  •  $${fmtVol(m.volume)} ${volSignal}`;
    }
    output += '\n';

    // Link
    if (m.url) {
      output += `   🔗 [Trade on ${m.platform}](${m.url})\n`;
    }
  }

  output += `\n${'━'.repeat(40)}\n`;
  output += `💡 Trust Levels: ✅ Verified | 🟢 Good | 🟡 Unverified | 🟠 Suspicious\n`;
  output += `• /arb - Find validated arbitrage\n`;
  output += `• /trust <market> - View trust details`;

  return output;
}

/**
 * Format data quality summary
 */
export function formatDataQuality(result: {
  totalFetched: number;
  totalValidated: number;
  totalFiltered: number;
  dataQualityScore: number;
  sources: string[];
  warnings: string[];
}): string {
  let output = `📊 *DATA QUALITY REPORT*\n${'─'.repeat(30)}\n\n`;

  output += `Fetched: ${result.totalFetched} markets\n`;
  output += `Validated: ${result.totalValidated} markets\n`;
  output += `Filtered: ${result.totalFiltered} markets\n`;
  output += `Quality Score: ${result.dataQualityScore}/100\n`;
  output += `Sources: ${result.sources.join(', ')}\n`;

  if (result.warnings.length > 0) {
    output += `\n⚠️ *Warnings:*\n`;
    for (const warning of result.warnings.slice(0, 3)) {
      output += `• ${warning}\n`;
    }
  }

  return output;
}

/**
 * Format validated arbitrage opportunity
 */
export function formatValidatedArbitrage(opportunities: Array<{
  marketA: ValidatedMarket;
  marketB: ValidatedMarket;
  spread: number;
  spreadPct: number;
  strategy: string;
  trustScore: number;
  warnings: string[];
}>): string {
  if (opportunities.length === 0) {
    return `✅ *NO VALIDATED ARBITRAGE*\n\nMarkets are efficiently priced. All spreads are within normal range or failed trust validation.`;
  }

  let output = `🎯 *VALIDATED ARBITRAGE*\n${'━'.repeat(40)}\n`;
  output += `_Trust Engine verified - high confidence_\n\n`;

  for (let i = 0; i < Math.min(5, opportunities.length); i++) {
    const opp = opportunities[i];
    const trustBadgeA = trustBadge(opp.marketA.trustLevel);
    const trustBadgeB = trustBadge(opp.marketB.trustLevel);

    output += `💰 *${opp.spreadPct.toFixed(1)}% SPREAD*\n`;
    output += `${smartTitle(opp.marketA.title, 38)}\n`;
    output += `${trustBadgeA} ${opp.marketA.platform} ${(opp.marketA.yesPrice * 100).toFixed(1)}%`;
    output += ` vs ${trustBadgeB} ${opp.marketB.platform} ${(opp.marketB.yesPrice * 100).toFixed(1)}%\n`;
    output += `Trust: ${opp.trustScore}/100\n`;
    output += `_${opp.strategy}_\n`;

    if (opp.warnings.length > 0) {
      output += `⚠️ ${opp.warnings[0]}\n`;
    }
    output += '\n';
  }

  output += `${'━'.repeat(40)}\n`;
  output += `⚠️ Always verify resolution rules before trading`;

  return output;
}
