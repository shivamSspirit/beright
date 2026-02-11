/**
 * Research Skill for BeRight Protocol
 * Superforecaster-style analysis with market data + news + social
 */

import { SkillResponse, ResearchReport, Analysis, Market } from '../types/index';
import { RESEARCH, SENTIMENT } from '../config/thresholds';
import { getSourceTier, calculateSourceConfidence } from '../config/platforms';
import { searchMarkets, formatMarkets } from './markets';
import { searchNews } from './intel';
import { formatUsd, formatPct, timestamp } from './utils';

/**
 * Search Reddit for sentiment (inline to avoid circular dependency)
 */
async function searchReddit(query: string) {
  try {
    const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&limit=25&sort=relevance&t=week`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'BeRight/1.0' },
    });

    if (!response.ok) {
      return { postCount: 0, totalComments: 0, engagementLevel: 'LOW' as const, topSubreddits: [] };
    }

    const data = await response.json() as any;
    const posts = data?.data?.children || [];

    let totalComments = 0;
    const subredditCounts: Record<string, number> = {};

    for (const post of posts) {
      totalComments += post.data?.num_comments || 0;
      const sub = post.data?.subreddit;
      if (sub) subredditCounts[sub] = (subredditCounts[sub] || 0) + 1;
    }

    const topSubreddits = Object.entries(subredditCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5) as [string, number][];

    let engagementLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (posts.length > 20 || totalComments > 500) engagementLevel = 'HIGH';
    else if (posts.length > 10 || totalComments > 100) engagementLevel = 'MEDIUM';

    return { postCount: posts.length, totalComments, engagementLevel, topSubreddits };
  } catch {
    return { postCount: 0, totalComments: 0, engagementLevel: 'LOW' as const, topSubreddits: [] };
  }
}

/**
 * Analyze data to generate insights
 * Now includes source-tier based confidence scoring
 */
function analyze(
  markets: Market[],
  news: { articles: any[]; articleCount: number; sources?: string[]; sourceConfidence?: number; officialCount?: number },
  reddit: { postCount: number; totalComments: number; engagementLevel: string }
): Analysis & { sourceConfidence: number; officialCount: number; dataQuality: string } {
  const analysis: Analysis & { sourceConfidence: number; officialCount: number; dataQuality: string } = {
    marketSummary: '',
    consensusPrice: null,
    priceRange: null,
    newsSentiment: 'neutral',
    socialSentiment: 'neutral',
    confidence: 'low',
    keyFactors: [],
    sourceConfidence: news.sourceConfidence || 50,
    officialCount: news.officialCount || 0,
    dataQuality: 'unknown',
  };

  // Market analysis
  if (markets.length > 0) {
    const prices = markets
      .map(m => m.yesPct)
      .filter(p => p > 0);

    if (prices.length > 0) {
      analysis.consensusPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      analysis.priceRange = [Math.min(...prices), Math.max(...prices)];

      if (analysis.priceRange[1] - analysis.priceRange[0] > 10) {
        analysis.marketSummary = 'High disagreement across platforms';
        analysis.keyFactors.push('Price divergence suggests arbitrage opportunity');
      } else {
        analysis.marketSummary = 'Markets in rough consensus';
      }
    }
  }

  // News sentiment with tier-weighted analysis
  if (news.articles && news.articles.length > 0) {
    let bullCount = 0;
    let bearCount = 0;
    let tier1Weight = 0;

    for (const article of news.articles.slice(0, 15)) {
      const text = (article.title || '').toLowerCase();
      const tierInfo = getSourceTier(article.source);
      const weight = tierInfo ? (6 - tierInfo.tier) : 1; // Tier 1 = weight 5, Tier 5 = weight 1

      if (tierInfo?.tier === 1) tier1Weight += weight;

      for (const word of SENTIMENT.bullish) {
        if (text.includes(word)) bullCount += weight;
      }
      for (const word of SENTIMENT.bearish) {
        if (text.includes(word)) bearCount += weight;
      }
    }

    if (bullCount > bearCount + RESEARCH.bullishThreshold * 2) {
      analysis.newsSentiment = 'bullish';
    } else if (bearCount > bullCount + RESEARCH.bearishThreshold * 2) {
      analysis.newsSentiment = 'bearish';
    }

    // Key factors with source quality
    if (analysis.officialCount > 0) {
      analysis.keyFactors.push(`📋 ${analysis.officialCount} official/government sources (Tier 1)`);
    }
    analysis.keyFactors.push(`📰 News coverage: ${news.articleCount} articles (${analysis.sourceConfidence}% confidence)`);
  }

  // Reddit sentiment (lower weight - Tier 5)
  if (reddit.postCount > 10) {
    if (reddit.engagementLevel === 'HIGH') {
      analysis.socialSentiment = 'active';
      analysis.keyFactors.push('⚠️ High social engagement (verify with official sources)');
    }
    analysis.keyFactors.push(`📱 Reddit: ${reddit.postCount} posts (Tier 5 - use with caution)`);
  }

  // Enhanced confidence level based on source quality
  const dataPoints = markets.length + (news.articles?.length > 0 ? 1 : 0) + (reddit.postCount > 5 ? 1 : 0);
  const hasOfficialSources = analysis.officialCount > 0;
  const highSourceConfidence = analysis.sourceConfidence >= 80;

  if (dataPoints >= 5 && hasOfficialSources && highSourceConfidence) {
    analysis.confidence = 'high';
    analysis.dataQuality = 'excellent';
  } else if (dataPoints >= 3 && (hasOfficialSources || highSourceConfidence)) {
    analysis.confidence = 'high';
    analysis.dataQuality = 'good';
  } else if (dataPoints >= RESEARCH.minDataPoints) {
    analysis.confidence = 'medium';
    analysis.dataQuality = 'moderate';
  } else {
    analysis.dataQuality = 'limited';
  }

  return analysis;
}

/**
 * Format research report with source quality indicators
 */
function formatResearchReport(report: ResearchReport): string {
  const { query, markets, news, reddit, analysis } = report;

  // Data quality emoji
  const qualityEmoji: Record<string, string> = {
    excellent: '🟢',
    good: '🟡',
    moderate: '🟠',
    limited: '🔴',
    unknown: '⚪',
  };

  const dataQuality = (analysis as any).dataQuality || 'unknown';
  const sourceConfidence = (analysis as any).sourceConfidence || 50;
  const officialCount = (analysis as any).officialCount || 0;

  // Header
  let output = `
${'='.repeat(60)}
📊 RESEARCH: ${query.toUpperCase()}
${'='.repeat(60)}

Generated: ${report.timestamp.slice(0, 19)}
Data Quality: ${qualityEmoji[dataQuality]} ${dataQuality.toUpperCase()} (${sourceConfidence}% source confidence)
Official Sources: ${officialCount > 0 ? `✅ ${officialCount} verified` : '⚠️ None found'}
`;

  // Current Odds
  output += '\n📈 CURRENT ODDS\n';
  output += '-'.repeat(40) + '\n';

  if (markets.length > 0) {
    output += `${'Platform'.padEnd(15)} ${'YES'.padEnd(10)} ${'Volume'.padEnd(15)}\n`;

    for (const m of markets.slice(0, 6)) {
      const platform = m.platform.charAt(0).toUpperCase() + m.platform.slice(1);
      const yes = formatPct(m.yesPrice);
      const vol = m.volume > 0 ? formatUsd(m.volume) : 'N/A';
      output += `${platform.padEnd(15)} ${yes.padEnd(10)} ${vol.padEnd(15)}\n`;
    }
  } else {
    output += 'No active markets found\n';
  }

  // Consensus
  if (analysis.consensusPrice !== null) {
    output += `\nCONSENSUS: ${analysis.consensusPrice.toFixed(1)}%`;
    if (analysis.priceRange) {
      output += ` (range: ${analysis.priceRange[0].toFixed(0)}%-${analysis.priceRange[1].toFixed(0)}%)`;
    }
    output += '\n';
  }

  // News Summary
  output += `\n📰 NEWS SUMMARY (${news.articleCount} articles)\n`;
  output += '-'.repeat(40) + '\n';

  if (news.articles && news.articles.length > 0) {
    for (const article of news.articles.slice(0, 5)) {
      const source = (article.source || 'unknown').toUpperCase();
      const title = (article.title || '').slice(0, 60);
      output += `• [${source}] ${title}...\n`;
    }
  } else {
    output += 'No recent news found\n';
  }

  output += `\nNews sentiment: ${analysis.newsSentiment.toUpperCase()}\n`;

  // Social Pulse
  output += '\n📱 SOCIAL PULSE\n';
  output += '-'.repeat(40) + '\n';
  output += `Reddit posts: ${reddit.postCount}\n`;
  output += `Total comments: ${reddit.totalComments}\n`;
  output += `Engagement: ${reddit.engagementLevel}\n`;

  if (reddit.topSubreddits && reddit.topSubreddits.length > 0) {
    output += 'Top subreddits: ';
    output += reddit.topSubreddits.slice(0, 3).map(([s]) => `r/${s}`).join(', ') + '\n';
  }

  // Key Factors
  output += '\n🔑 KEY FACTORS\n';
  output += '-'.repeat(40) + '\n';
  for (const factor of analysis.keyFactors) {
    output += `• ${factor}\n`;
  }

  // Assessment
  output += '\n📊 ASSESSMENT\n';
  output += '-'.repeat(40) + '\n';
  output += `Market summary: ${analysis.marketSummary || 'Insufficient data'}\n`;
  output += `Confidence level: ${analysis.confidence.toUpperCase()}\n`;

  // Learning Moment with Source Tier Education
  output += `
💡 FORECASTING WISDOM
-----------------------------------------
SOURCE HIERARCHY (Most → Least Reliable):
T1 🏛️ Official (Fed, SEC, Gov) — 100% authentic
T2 📡 Wire Services (Reuters, AP) — 95% reliable
T3 📰 Major News (Bloomberg, WSJ) — 90% reliable
T4 📑 Specialized (CoinDesk, Politico) — 85% reliable
T5 📱 Social/Aggregated (Reddit, Google News) — 70% reliable

GOOD FORECASTERS:
• Prioritize T1-T2 sources for facts
• Use T3-T4 for analysis and context
• Treat T5 as early signals, not truth
• Cross-verify before high-confidence calls

Always ask: "What's my source quality?"
`;

  return output;
}

/**
 * Full research on a topic
 */
export async function research(query: string): Promise<SkillResponse> {
  try {
    console.log(`Researching: ${query}`);

    // Fetch data in parallel
    console.log('  Fetching market data...');
    const marketsPromise = searchMarkets(query);

    console.log('  Fetching news...');
    const newsPromise = searchNews(query);

    console.log('  Fetching Reddit sentiment...');
    const redditPromise = searchReddit(query);

    const [markets, news, reddit] = await Promise.all([
      marketsPromise,
      newsPromise,
      redditPromise,
    ]);

    // Analyze
    const analysis = analyze(markets, news, reddit);

    const report: ResearchReport = {
      query,
      timestamp: timestamp(),
      markets,
      news,
      reddit,
      analysis,
    };

    return {
      text: formatResearchReport(report),
      mood: analysis.confidence === 'high' ? 'EDUCATIONAL' : 'NEUTRAL',
      data: report,
    };
  } catch (error) {
    return {
      text: `Research failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Quick market lookup
 */
export async function quickLookup(query: string): Promise<SkillResponse> {
  try {
    const markets = await searchMarkets(query);

    if (!markets.length) {
      return { text: `No markets found for: ${query}`, mood: 'NEUTRAL' };
    }

    return {
      text: formatMarkets(markets, `Markets: ${query}`),
      mood: 'NEUTRAL',
      data: markets,
    };
  } catch (error) {
    return {
      text: `Lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

// CLI interface
if (process.argv[1]?.endsWith('research.ts')) {
  const args = process.argv.slice(2);

  if (args[0] === 'quick' && args.length > 1) {
    const query = args.slice(1).join(' ');
    quickLookup(query).then(r => console.log(r.text));
  } else if (args.length > 0) {
    const query = args.join(' ');
    research(query).then(r => console.log(r.text));
  } else {
    console.log('Usage:');
    console.log('  ts-node research.ts <query>       - Full research report');
    console.log('  ts-node research.ts quick <query> - Quick market lookup');
  }
}
