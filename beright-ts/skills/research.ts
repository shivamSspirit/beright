/**
 * Research Skill for BeRight Protocol
 * Superforecaster-style analysis with market data + news + social
 *
 * Enhanced with Tavily for:
 * - Real-time web search (instead of just RSS)
 * - AI-powered fact verification
 * - Deep research reports
 */

import { SkillResponse, ResearchReport, Analysis, Market } from '../types/index';
import { RESEARCH, SENTIMENT } from '../config/thresholds';
import { getSourceTier, calculateSourceConfidence } from '../config/platforms';
import { searchMarkets, formatMarkets } from './markets';
import { searchNews } from './intel';
import { formatUsd, formatPct, timestamp } from './utils';
import {
  isTavilyConfigured,
  tavilySearch,
  tavilyNewsSearch,
  tavilyFinanceSearch,
  tavilyResearch,
  getFactsForPrediction,
  getNewsContext,
  verifyClaim,
  TavilySearchResponse,
} from '../lib/tavily';

// ============================================
// EDUCATIONAL/CONCEPT QUERY DETECTION
// ============================================

/**
 * Detect if query is educational/conceptual vs market-specific
 * Educational: "what is arbitrage", "prediction markets", "how forecasting works"
 * Market-specific: "bitcoin 100k", "trump election", "fed rate decision"
 */
function isEducationalQuery(query: string): boolean {
  const lowerQuery = query.toLowerCase().trim();

  // Explicit educational patterns
  const educationalPatterns = [
    /^what (is|are|does)/i,
    /^how (do|does|to|can)/i,
    /^explain/i,
    /^define/i,
    /^meaning of/i,
    /^tell me about/i,
    /^learn about/i,
    /^understand/i,
    /^introduction to/i,
    /^guide to/i,
    /^basics of/i,
    /^overview of/i,
  ];

  for (const pattern of educationalPatterns) {
    if (pattern.test(lowerQuery)) return true;
  }

  // Conceptual topics (not events/markets)
  const conceptualTopics = [
    'prediction market',
    'prediction markets',
    'forecasting',
    'superforecaster',
    'superforecasting',
    'arbitrage',
    'market making',
    'odds',
    'probability',
    'calibration',
    'brier score',
    'base rate',
    'base rates',
    'bayesian',
    'trading strategy',
    'trading strategies',
    'polymarket',
    'kalshi',
    'manifold',
    'metaculus',
    'wisdom of crowds',
  ];

  for (const topic of conceptualTopics) {
    if (lowerQuery === topic || lowerQuery === `${topic}s`) {
      return true;
    }
  }

  // Check if query lacks specific event markers
  const eventMarkers = [
    /\b(will|won't|would|could)\b/i,  // Future predictions
    /\b(202\d|next|this)\b/i,          // Year/time references
    /\b(election|price|win|lose|pass|fail|launch|release)\b/i,  // Event words
    /\b(bitcoin|btc|eth|trump|biden|fed|congress|senate)\b/i,   // Specific entities
    /\b(above|below|reach|hit)\b/i,    // Price targets
    /\$\d+/,                           // Dollar amounts
  ];

  const hasEventMarker = eventMarkers.some(pattern => pattern.test(lowerQuery));

  // Short generic queries without event markers are likely educational
  if (!hasEventMarker && lowerQuery.split(' ').length <= 3) {
    return true;
  }

  return false;
}

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
 * Uses Tavily when available for better accuracy
 */
export async function research(query: string): Promise<SkillResponse> {
  try {
    console.log(`Researching: ${query}`);

    // Check if Tavily is available for enhanced research
    const useTavily = isTavilyConfigured();
    if (useTavily) {
      console.log('  Using Tavily-enhanced research...');
    }

    // Fetch data in parallel
    console.log('  Fetching market data...');
    const marketsPromise = searchMarkets(query);

    console.log('  Fetching news...');
    const newsPromise = useTavily
      ? getNewsContext(query)  // Tavily news search
      : searchNews(query);     // Fallback to RSS

    console.log('  Fetching Reddit sentiment...');
    const redditPromise = searchReddit(query);

    // If Tavily available, also get fact verification
    const factsPromise = useTavily
      ? getFactsForPrediction(query)
      : Promise.resolve(null);

    const [markets, news, reddit, facts] = await Promise.all([
      marketsPromise,
      newsPromise,
      redditPromise,
      factsPromise,
    ]);

    // Convert Tavily news to standard format if needed
    const normalizedNews: { articles: any[]; articleCount: number; sources?: string[]; sourceConfidence?: number; officialCount?: number } = useTavily
      ? convertTavilyNews(news as any)
      : news as { articles: any[]; articleCount: number; sources?: string[]; sourceConfidence?: number; officialCount?: number };

    // Analyze
    const analysis = analyze(markets, normalizedNews, reddit);

    // Enhance analysis with Tavily facts
    if (facts && facts.facts.length > 0) {
      (analysis as any).tavilyFacts = facts.facts;
      (analysis as any).tavilyAnswer = facts.answer;
      (analysis as any).tavilyConfidence = facts.confidence;
      (analysis as any).tavilySources = facts.sources;

      // Boost confidence if Tavily confirms with high confidence
      if (facts.confidence === 'high') {
        analysis.confidence = 'high';
        (analysis as any).dataQuality = 'excellent';
      }
    }

    const report: ResearchReport = {
      query,
      timestamp: timestamp(),
      markets,
      news: {
        topic: query,
        articleCount: normalizedNews.articleCount,
        articles: normalizedNews.articles,
        sources: normalizedNews.sources || [],
      },
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
 * Convert Tavily news context to standard news format
 */
function convertTavilyNews(tavilyNews: {
  headlines: Array<{ title: string; url: string; date?: string }>;
  summary?: string;
  sentiment: string;
  lastUpdated: string;
}): { articles: any[]; articleCount: number; sources?: string[]; sourceConfidence?: number; officialCount?: number } {
  const articles = tavilyNews.headlines.map(h => ({
    title: h.title,
    link: h.url,
    source: new URL(h.url).hostname.replace('www.', ''),
    pubDate: h.date || '',
    description: '',
    type: 'news',
  }));

  const sources = [...new Set(articles.map(a => a.source))];

  return {
    articles,
    articleCount: articles.length,
    sources,
    sourceConfidence: 90, // Tavily provides high-quality sources
    officialCount: 0,
  };
}

/**
 * Deep research using Tavily's research endpoint
 * Provides comprehensive analysis with multi-step research
 *
 * Now detects educational queries and formats appropriately
 */
export async function deepResearch(query: string): Promise<SkillResponse> {
  if (!isTavilyConfigured()) {
    return {
      text: '❌ Deep research requires Tavily API key.\nSet TAVILY_API_KEY in your environment.',
      mood: 'ERROR',
    };
  }

  try {
    console.log(`Deep researching: ${query}`);

    // Detect if this is an educational/conceptual query
    const isEducational = isEducationalQuery(query);
    console.log(`  Query type: ${isEducational ? 'EDUCATIONAL' : 'MARKET-SPECIFIC'}`);

    // For educational queries, only do web research (skip market search)
    // For market queries, include market data
    const researchPromise = tavilyResearch(query);
    const marketsPromise = isEducational ? Promise.resolve([]) : searchMarkets(query);
    const factsPromise = getFactsForPrediction(query);

    const [researchResult, markets, facts] = await Promise.all([
      researchPromise,
      marketsPromise,
      factsPromise,
    ]);

    // Check if Tavily returned meaningful content
    const hasReport = researchResult.report && researchResult.report.trim().length > 50;

    let output = '';

    if (isEducational) {
      // EDUCATIONAL FORMAT - Focus on explaining the concept
      output = `
${'='.repeat(60)}
📚 LEARN: ${query.toUpperCase()}
${'='.repeat(60)}

Generated: ${timestamp().slice(0, 19)}
Type: Educational Overview

`;

      if (hasReport) {
        output += `📖 OVERVIEW
${'─'.repeat(50)}

${researchResult.report}

`;
      }

      // Add key facts as educational points
      if (facts.facts.length > 0) {
        output += `
💡 KEY POINTS
${'─'.repeat(50)}
`;
        for (const fact of facts.facts.slice(0, 7)) {
          output += `• ${fact}\n`;
        }
      }

      // Add sources for further reading
      if (researchResult.sources.length > 0) {
        output += `
📚 LEARN MORE
${'─'.repeat(50)}
`;
        for (const source of researchResult.sources.slice(0, 5)) {
          output += `• ${source.title}\n  ${source.url}\n\n`;
        }
      }

      output += `
💬 RELATED COMMANDS
${'─'.repeat(50)}
• /hot - See trending prediction markets
• /arb - Find arbitrage opportunities
• /brief - Get today's market briefing
• /research <specific topic> - Research a specific market
`;

    } else {
      // MARKET-SPECIFIC FORMAT - Include odds and trading context
      output = `
${'='.repeat(60)}
🔬 DEEP RESEARCH: ${query.toUpperCase()}
${'='.repeat(60)}

Generated: ${timestamp().slice(0, 19)}
Research time: ${(researchResult.responseTime / 1000).toFixed(1)}s
Powered by: Tavily AI Research

`;

      if (hasReport) {
        output += `📋 RESEARCH REPORT
${'─'.repeat(50)}

${researchResult.report}

`;
      } else {
        output += `📋 RESEARCH REPORT
${'─'.repeat(50)}

No detailed report available. See facts and market data below.

`;
      }

      // Add market data if available
      if (markets.length > 0) {
        output += `
📈 CURRENT MARKET ODDS
${'─'.repeat(50)}
`;
        for (const m of markets.slice(0, 5)) {
          const platform = m.platform.charAt(0).toUpperCase() + m.platform.slice(1);
          const yes = formatPct(m.yesPrice);
          const vol = m.volume > 0 ? formatUsd(m.volume) : 'N/A';
          output += `${platform.padEnd(15)} YES: ${yes.padEnd(10)} Vol: ${vol}\n`;
        }
      }

      // Add verified facts
      if (facts.facts.length > 0) {
        output += `
✅ VERIFIED FACTS (${facts.confidence} confidence)
${'─'.repeat(50)}
`;
        for (const fact of facts.facts.slice(0, 5)) {
          output += `• ${fact}\n`;
        }
      }

      // Add sources
      if (researchResult.sources.length > 0) {
        output += `
📚 SOURCES
${'─'.repeat(50)}
`;
        for (const source of researchResult.sources.slice(0, 5)) {
          output += `• ${source.title}\n  ${source.url}\n`;
        }
      }

      output += `
💡 METHODOLOGY
${'─'.repeat(50)}
This report uses multi-step AI research:
1. Web search across trusted sources
2. Content extraction and synthesis
3. Cross-reference verification
4. Prediction market data correlation

Always verify critical information independently.
`;
    }

    return {
      text: output,
      mood: 'EDUCATIONAL',
      data: { research: researchResult, markets, facts, isEducational },
    };
  } catch (error) {
    console.error('Deep research error:', error);
    return {
      text: `Deep research failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Verify a claim using Tavily
 */
export async function verifyClaimSkill(claim: string): Promise<SkillResponse> {
  if (!isTavilyConfigured()) {
    return {
      text: '❌ Claim verification requires Tavily API key.\nSet TAVILY_API_KEY in your environment.',
      mood: 'ERROR',
    };
  }

  try {
    const result = await verifyClaim(claim);

    const statusEmoji = result.verified ? '✅' : '❌';
    const status = result.verified ? 'SUPPORTED' : 'QUESTIONABLE';

    let output = `
${'='.repeat(50)}
🔍 CLAIM VERIFICATION
${'='.repeat(50)}

CLAIM: "${claim}"

STATUS: ${statusEmoji} ${status}
CONFIDENCE: ${result.confidence}%

📋 EVIDENCE
${'─'.repeat(40)}
`;

    for (const evidence of result.evidence.slice(0, 3)) {
      output += `• ${evidence}\n\n`;
    }

    output += `
📚 SOURCES
${'─'.repeat(40)}
`;
    for (const source of result.sources.slice(0, 3)) {
      output += `• ${source.title}\n  ${source.url}\n`;
    }

    output += `
💡 NOTE
${'─'.repeat(40)}
This is an automated fact-check. For high-stakes decisions,
always verify with primary sources and expert analysis.
`;

    return {
      text: output,
      mood: result.verified ? 'EDUCATIONAL' : 'ALERT',
      data: result,
    };
  } catch (error) {
    return {
      text: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
  const command = args[0];
  const query = args.slice(1).join(' ');

  (async () => {
    if (command === 'quick' && query) {
      const result = await quickLookup(query);
      console.log(result.text);
    } else if (command === 'deep' && query) {
      const result = await deepResearch(query);
      console.log(result.text);
    } else if (command === 'verify' && query) {
      const result = await verifyClaimSkill(query);
      console.log(result.text);
    } else if (args.length > 0 && command !== 'quick' && command !== 'deep' && command !== 'verify') {
      const fullQuery = args.join(' ');
      const result = await research(fullQuery);
      console.log(result.text);
    } else {
      console.log('Research CLI - BeRight Protocol\n');
      console.log('Usage:');
      console.log('  npx ts-node skills/research.ts <query>        - Full research report');
      console.log('  npx ts-node skills/research.ts quick <query>  - Quick market lookup');
      console.log('  npx ts-node skills/research.ts deep <query>   - Deep AI research (Tavily)');
      console.log('  npx ts-node skills/research.ts verify <claim> - Fact-check a claim (Tavily)');
      console.log('\nExamples:');
      console.log('  npx ts-node skills/research.ts "bitcoin 100k"');
      console.log('  npx ts-node skills/research.ts deep "Fed rate decision impact"');
      console.log('  npx ts-node skills/research.ts verify "Bitcoin is above 50k"');
    }
  })();
}
