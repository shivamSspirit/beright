/**
 * Intel Skill for BeRight Protocol
 * News and social media aggregation
 */

import { SkillResponse, NewsArticle, NewsResult, RedditSentiment } from '../types/index';
import { RSS_FEEDS, GOOGLE_NEWS_RSS, OFFICIAL_SOURCES, SOURCE_TIERS, getSourceTier, calculateSourceConfidence } from '../config/platforms';
import { SENTIMENT } from '../config/thresholds';
import { timestamp } from './utils';

/**
 * Parse RSS feed XML (simplified parser)
 */
async function parseRss(url: string, source: string): Promise<NewsArticle[]> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'BeRight/1.0 (Prediction Market Intelligence)' },
    });

    if (!response.ok) return [];

    const text = await response.text();
    const articles: NewsArticle[] = [];

    // Simple XML parsing with regex (avoiding xml2js dependency for now)
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const titleRegex = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/;
    const linkRegex = /<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/;
    const descRegex = /<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/;
    const pubDateRegex = /<pubDate>([\s\S]*?)<\/pubDate>/;

    let match;
    while ((match = itemRegex.exec(text)) !== null && articles.length < 20) {
      const item = match[1];

      const titleMatch = item.match(titleRegex);
      const linkMatch = item.match(linkRegex);
      const descMatch = item.match(descRegex);
      const pubDateMatch = item.match(pubDateRegex);

      if (titleMatch) {
        articles.push({
          title: titleMatch[1].trim().replace(/<[^>]+>/g, ''),
          link: linkMatch?.[1]?.trim() || '',
          description: (descMatch?.[1] || '').replace(/<[^>]+>/g, '').slice(0, 300).trim(),
          pubDate: pubDateMatch?.[1]?.trim() || '',
          source,
          type: 'news',
        });
      }
    }

    return articles;
  } catch (error) {
    console.error(`RSS parse error for ${source}:`, error);
    return [];
  }
}

/**
 * Search Google News
 */
async function searchGoogleNews(query: string, limit = 15): Promise<NewsArticle[]> {
  const url = GOOGLE_NEWS_RSS.replace('{query}', encodeURIComponent(query));
  const articles = await parseRss(url, 'google_news');
  return articles.slice(0, limit);
}

/**
 * Get news from specific feed
 */
async function getFeed(feedName: string): Promise<NewsArticle[]> {
  const url = RSS_FEEDS[feedName];
  if (!url) return [];
  return parseRss(url, feedName);
}

/**
 * Get top news from multiple sources
 */
async function getTopNews(): Promise<NewsArticle[]> {
  const feeds = ['reuters', 'bbc', 'ap'];
  const results = await Promise.all(feeds.map(f => getFeed(f)));
  return results.flat().slice(0, 15);
}

/**
 * Get crypto news
 */
async function getCryptoNews(): Promise<NewsArticle[]> {
  const feeds = ['coindesk', 'cointelegraph', 'decrypt'];
  const results = await Promise.all(feeds.map(f => getFeed(f)));
  return results.flat().slice(0, 15);
}

/**
 * Get finance news
 */
async function getFinanceNews(): Promise<NewsArticle[]> {
  const feeds = ['wsj_markets', 'cnbc', 'bloomberg'];
  const results = await Promise.all(feeds.map(f => getFeed(f)));
  return results.flat().slice(0, 15);
}

/**
 * Get politics news
 */
async function getPoliticsNews(): Promise<NewsArticle[]> {
  const feeds = ['politico', 'hill', 'fivethirtyeight'];
  const results = await Promise.all(feeds.map(f => getFeed(f)));
  return results.flat().slice(0, 15);
}

// ============================================
// OFFICIAL SOURCE FETCHERS (Tier 1 - Highest Authenticity)
// ============================================

/**
 * Get official source feed
 */
async function getOfficialFeed(feedName: string): Promise<NewsArticle[]> {
  const url = OFFICIAL_SOURCES[feedName];
  if (!url) return [];
  const articles = await parseRss(url, feedName);
  // Mark as tier 1 official
  return articles.map(a => ({ ...a, tier: 1 as const, official: true }));
}

/**
 * Get Federal Reserve news (rates, policy)
 */
async function getFedNews(): Promise<NewsArticle[]> {
  const feeds = ['fed', 'fed_speeches'];
  const results = await Promise.all(feeds.map(f => getOfficialFeed(f)));
  return results.flat().slice(0, 10);
}

/**
 * Get SEC filings and press releases
 */
async function getSecNews(): Promise<NewsArticle[]> {
  const feeds = ['sec_filings', 'sec_press'];
  const results = await Promise.all(feeds.map(f => getOfficialFeed(f)));
  return results.flat().slice(0, 10);
}

/**
 * Get economic data (BLS, Treasury)
 */
async function getEconomicNews(): Promise<NewsArticle[]> {
  const feeds = ['bls', 'treasury', 'cftc'];
  const results = await Promise.all(feeds.map(f => getOfficialFeed(f)));
  return results.flat().slice(0, 10);
}

/**
 * Get government/political official sources
 */
async function getGovNews(): Promise<NewsArticle[]> {
  const feeds = ['whitehouse', 'congress_bills', 'state_dept'];
  const results = await Promise.all(feeds.map(f => getOfficialFeed(f)));
  return results.flat().slice(0, 10);
}

/**
 * Get health-related official sources (FDA, CDC)
 */
async function getHealthNews(): Promise<NewsArticle[]> {
  const feeds = ['fda', 'cdc'];
  const results = await Promise.all(feeds.map(f => getOfficialFeed(f)));
  return results.flat().slice(0, 10);
}

/**
 * Get all official sources for a topic
 */
async function getOfficialNews(topic: string): Promise<NewsArticle[]> {
  const topicLower = topic.toLowerCase();
  const articles: NewsArticle[] = [];

  // Determine which official feeds are relevant
  const feedPromises: Promise<NewsArticle[]>[] = [];

  if (['fed', 'rate', 'interest', 'fomc', 'powell', 'monetary'].some(w => topicLower.includes(w))) {
    feedPromises.push(getFedNews());
  }

  if (['sec', 'filing', 'stock', 'ipo', 'company', 'earnings'].some(w => topicLower.includes(w))) {
    feedPromises.push(getSecNews());
  }

  if (['jobs', 'unemployment', 'cpi', 'inflation', 'gdp', 'economy', 'treasury'].some(w => topicLower.includes(w))) {
    feedPromises.push(getEconomicNews());
  }

  if (['trump', 'biden', 'election', 'congress', 'bill', 'law', 'president', 'senate', 'house'].some(w => topicLower.includes(w))) {
    feedPromises.push(getGovNews());
  }

  if (['drug', 'fda', 'vaccine', 'health', 'pharma', 'cdc', 'covid', 'disease'].some(w => topicLower.includes(w))) {
    feedPromises.push(getHealthNews());
  }

  if (feedPromises.length > 0) {
    const results = await Promise.all(feedPromises);
    articles.push(...results.flat());
  }

  return articles;
}

/**
 * Search for topic across news sources
 * Now includes official sources first (highest authenticity)
 */
export async function searchNews(topic: string): Promise<NewsResult & { sourceConfidence: number; officialCount: number }> {
  const topicLower = topic.toLowerCase();

  // Fetch all sources in parallel for speed
  const [officialArticles, googleArticles, extraArticles] = await Promise.all([
    // Tier 1: Official sources (highest authenticity)
    getOfficialNews(topic),

    // Tier 5: Google News (aggregated)
    searchGoogleNews(topic),

    // Tier 3-4: Specialized feeds based on topic
    (async () => {
      if (['crypto', 'bitcoin', 'ethereum', 'solana'].some(w => topicLower.includes(w))) {
        return getCryptoNews();
      } else if (['fed', 'rate', 'inflation', 'economy', 'stock'].some(w => topicLower.includes(w))) {
        return getFinanceNews();
      } else if (['trump', 'biden', 'election', 'congress'].some(w => topicLower.includes(w))) {
        return getPoliticsNews();
      }
      return [];
    })(),
  ]);

  // Combine with official sources FIRST (priority)
  const allArticles = [
    ...officialArticles,           // Tier 1 first
    ...extraArticles.slice(0, 5),  // Tier 3-4 second
    ...googleArticles,             // Tier 5 last
  ];

  const sources = [...new Set(allArticles.map(a => a.source))];
  const sourceConfidence = calculateSourceConfidence(sources);
  const officialCount = officialArticles.length;

  return {
    topic,
    articleCount: allArticles.length,
    articles: allArticles.slice(0, 25),
    sources,
    sourceConfidence,
    officialCount,
  };
}

/**
 * Analyze sentiment from news articles
 */
function analyzeNewsSentiment(articles: NewsArticle[]): 'bullish' | 'bearish' | 'neutral' {
  let bullCount = 0;
  let bearCount = 0;

  for (const article of articles.slice(0, 10)) {
    const text = (article.title + ' ' + article.description).toLowerCase();

    for (const word of SENTIMENT.bullish) {
      if (text.includes(word)) bullCount++;
    }
    for (const word of SENTIMENT.bearish) {
      if (text.includes(word)) bearCount++;
    }
  }

  if (bullCount > bearCount + 2) return 'bullish';
  if (bearCount > bullCount + 2) return 'bearish';
  return 'neutral';
}

/**
 * Search Reddit (using JSON API)
 */
async function searchReddit(query: string): Promise<RedditSentiment> {
  try {
    const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&limit=25&sort=relevance&t=week`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'BeRight/1.0 (Prediction Market Intelligence)' },
    });

    if (!response.ok) {
      return { postCount: 0, totalComments: 0, engagementLevel: 'LOW', topSubreddits: [] };
    }

    const data = await response.json() as any;
    const posts = data?.data?.children || [];

    let totalComments = 0;
    const subredditCounts: Record<string, number> = {};

    for (const post of posts) {
      const p = post.data;
      totalComments += p.num_comments || 0;

      const sub = p.subreddit;
      subredditCounts[sub] = (subredditCounts[sub] || 0) + 1;
    }

    const topSubreddits = Object.entries(subredditCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5) as [string, number][];

    let engagementLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (posts.length > 20 || totalComments > 500) engagementLevel = 'HIGH';
    else if (posts.length > 10 || totalComments > 100) engagementLevel = 'MEDIUM';

    return {
      postCount: posts.length,
      totalComments,
      engagementLevel,
      topSubreddits,
    };
  } catch (error) {
    console.error('Reddit search error:', error);
    return { postCount: 0, totalComments: 0, engagementLevel: 'LOW', topSubreddits: [] };
  }
}

/**
 * Format news results with source tier info
 */
function formatNewsResults(result: NewsResult & { sourceConfidence?: number; officialCount?: number }): string {
  const sentimentEmoji: Record<string, string> = {
    bullish: '📈',
    bearish: '📉',
    neutral: '➡️',
  };

  const sentiment = analyzeNewsSentiment(result.articles);
  const confidence = result.sourceConfidence || 50;
  const officialCount = result.officialCount || 0;

  // Confidence emoji
  let confidenceEmoji = '🔴';
  if (confidence >= 90) confidenceEmoji = '🟢';
  else if (confidence >= 75) confidenceEmoji = '🟡';
  else if (confidence >= 60) confidenceEmoji = '🟠';

  let output = `
📰 NEWS: ${result.topic.toUpperCase()}
${'='.repeat(40)}

Articles Found: ${result.articleCount}
Official Sources: ${officialCount} ${officialCount > 0 ? '✅' : ''}
Source Confidence: ${confidenceEmoji} ${confidence}%
Sentiment: ${sentimentEmoji[sentiment]} ${sentiment.toUpperCase()}

HEADLINES:
`;

  for (const article of result.articles.slice(0, 10)) {
    const tierInfo = getSourceTier(article.source);
    const tierBadge = tierInfo ? `[T${tierInfo.tier}]` : '[T5]';
    output += `\n${tierBadge} [${article.source.toUpperCase()}] ${article.title.slice(0, 55)}...\n`;
  }

  output += `
📊 SOURCE TIERS
T1 = Official/Gov (100%) | T2 = Wire (95%) | T3 = Major News (90%)
T4 = Specialized (85%) | T5 = Aggregated (70%)
`;

  return output;
}

/**
 * Format social results
 */
function formatSocialResults(query: string, reddit: RedditSentiment): string {
  let output = `
📱 SOCIAL PULSE: ${query.toUpperCase()}
${'='.repeat(40)}

REDDIT
Posts found: ${reddit.postCount}
Total comments: ${reddit.totalComments}
Engagement: ${reddit.engagementLevel}
`;

  if (reddit.topSubreddits.length > 0) {
    output += '\nTop subreddits: ';
    output += reddit.topSubreddits.map(([sub]) => `r/${sub}`).join(', ');
    output += '\n';
  }

  output += `
💡 SOCIAL SIGNALS TIP
High engagement often precedes price moves.
But be skeptical - social media amplifies noise.
`;

  return output;
}

/**
 * News search skill
 */
export async function newsSearch(query: string): Promise<SkillResponse> {
  try {
    const result = await searchNews(query);
    return {
      text: formatNewsResults(result),
      mood: 'NEUTRAL',
      data: result,
    };
  } catch (error) {
    return {
      text: `News search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Social search skill
 */
export async function socialSearch(query: string): Promise<SkillResponse> {
  try {
    const reddit = await searchReddit(query);
    return {
      text: formatSocialResults(query, reddit),
      mood: reddit.engagementLevel === 'HIGH' ? 'ALERT' : 'NEUTRAL',
      data: reddit,
    };
  } catch (error) {
    return {
      text: `Social search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Full intel report (news + social)
 */
export async function intelReport(query: string): Promise<SkillResponse> {
  try {
    const [news, reddit] = await Promise.all([
      searchNews(query),
      searchReddit(query),
    ]);

    const sentiment = analyzeNewsSentiment(news.articles);

    let output = `
🔍 INTEL REPORT: ${query.toUpperCase()}
${'='.repeat(50)}
Generated: ${timestamp().slice(0, 19)}

📰 NEWS SUMMARY
Articles: ${news.articleCount}
Sentiment: ${sentiment.toUpperCase()}

`;

    for (const article of news.articles.slice(0, 5)) {
      output += `• [${article.source.toUpperCase()}] ${article.title.slice(0, 55)}...\n`;
    }

    output += `
📱 SOCIAL PULSE
Reddit posts: ${reddit.postCount}
Comments: ${reddit.totalComments}
Engagement: ${reddit.engagementLevel}
`;

    if (reddit.topSubreddits.length > 0) {
      output += `Subreddits: ${reddit.topSubreddits.map(([s]) => `r/${s}`).join(', ')}\n`;
    }

    output += `
💡 INTEL ASSESSMENT
News sentiment is ${sentiment}.
${reddit.engagementLevel === 'HIGH' ? 'High social engagement suggests active interest.' : 'Social engagement is moderate.'}
Use this as ONE input in your analysis.
`;

    return {
      text: output,
      mood: sentiment === 'bullish' ? 'BULLISH' : sentiment === 'bearish' ? 'BEARISH' : 'NEUTRAL',
      data: { news, reddit, sentiment },
    };
  } catch (error) {
    return {
      text: `Intel report failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

// CLI interface
if (process.argv[1]?.endsWith('intel.ts')) {
  const args = process.argv.slice(2);
  const command = args[0];
  const query = args.slice(1).join(' ');

  (async () => {
    if (command === 'news' && query) {
      const result = await newsSearch(query);
      console.log(result.text);
    } else if (command === 'social' && query) {
      const result = await socialSearch(query);
      console.log(result.text);
    } else if (command === 'report' && query) {
      const result = await intelReport(query);
      console.log(result.text);
    } else if (command === 'top') {
      const articles = await getTopNews();
      console.log('Top News:');
      articles.forEach(a => console.log(`[${a.source}] ${a.title}`));
    } else {
      console.log('Usage:');
      console.log('  ts-node intel.ts news <query>');
      console.log('  ts-node intel.ts social <query>');
      console.log('  ts-node intel.ts report <query>');
      console.log('  ts-node intel.ts top');
    }
  })();
}
