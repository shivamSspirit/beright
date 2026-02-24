/**
 * Social Listener - Twitter/X Client
 *
 * Uses Tavily API to search Twitter/X mentions.
 * (Direct Twitter API requires OAuth setup - Tavily provides easier access)
 *
 * Fallback: Uses news search with Twitter domain filter.
 */

import { SocialMention, SocialSearchResult } from './types';
import { analyzeSentimentWithLabel } from './sentiment';
import { generateContentHash } from './matcher';

// Tavily API endpoint
const TAVILY_API_URL = 'https://api.tavily.com/search';

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  published_date?: string;
  score: number;
}

interface TavilyResponse {
  results: TavilyResult[];
  query: string;
}

/**
 * Search Twitter/X via Tavily
 *
 * Searches for prediction market mentions on Twitter.
 */
export async function searchTwitter(
  keywords: string[],
  options?: {
    limit?: number;
    since?: Date;
  }
): Promise<SocialSearchResult> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.warn('[Twitter] TAVILY_API_KEY not set');
    return {
      mentions: [],
      source: 'twitter',
      query: keywords.join(' '),
      fetchedAt: new Date(),
      hasMore: false,
    };
  }

  const query = `${keywords.join(' OR ')} site:twitter.com OR site:x.com`;

  try {
    const response = await fetch(TAVILY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'basic',
        include_domains: ['twitter.com', 'x.com'],
        max_results: options?.limit || 20,
      }),
    });

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.status}`);
    }

    const data: TavilyResponse = await response.json();

    const mentions: SocialMention[] = data.results.map((result) => {
      const { score, label } = analyzeSentimentWithLabel(result.content);

      // Extract author from URL if possible
      const authorMatch = result.url.match(/twitter\.com\/([^\/]+)|x\.com\/([^\/]+)/);
      const author = authorMatch?.[1] || authorMatch?.[2] || 'unknown';

      return {
        source: 'twitter' as const,
        sourceUrl: result.url,
        author,
        authorHandle: author,
        content: result.content,
        contentHash: generateContentHash(result.content),
        sentiment: score,
        sentimentLabel: label,
        postedAt: result.published_date ? new Date(result.published_date) : new Date(),
        fetchedAt: new Date(),
        // Engagement not available via Tavily
        likes: 0,
        retweets: 0,
        comments: 0,
        engagementScore: result.score * 10, // Use relevance as proxy
      };
    });

    return {
      mentions,
      source: 'twitter',
      query,
      fetchedAt: new Date(),
      hasMore: data.results.length >= (options?.limit || 20),
    };
  } catch (err) {
    console.warn('[Twitter] Search failed:', err);
    return {
      mentions: [],
      source: 'twitter',
      query,
      fetchedAt: new Date(),
      hasMore: false,
    };
  }
}

/**
 * Search Twitter for specific accounts
 */
export async function searchTwitterAccounts(
  accounts: string[],
  keywords?: string[],
  options?: { limit?: number }
): Promise<SocialSearchResult> {
  const accountQueries = accounts.map(a => `from:${a}`).join(' OR ');
  const keywordQuery = keywords?.length ? ` ${keywords.join(' OR ')}` : '';
  const fullQuery = `(${accountQueries})${keywordQuery}`;

  // Use same Tavily search with constructed query
  return searchTwitter([fullQuery], options);
}

/**
 * Get trending prediction market topics on Twitter
 */
export async function getTrendingTopics(): Promise<string[]> {
  const baseKeywords = [
    'polymarket',
    'kalshi',
    'prediction market',
    'betting odds',
    'will win',
  ];

  const result = await searchTwitter(baseKeywords, { limit: 50 });

  // Extract common keywords from results
  const wordCounts: Map<string, number> = new Map();

  for (const mention of result.mentions) {
    const words = mention.content
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 4);

    for (const word of words) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }
  }

  // Return top 20 keywords
  return [...wordCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);
}
