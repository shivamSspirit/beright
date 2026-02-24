/**
 * Social Listener - Reddit Client
 *
 * Monitors prediction market subreddits:
 * - r/polymarket
 * - r/predictit
 * - r/politics (for political market context)
 * - r/economics (for macro market context)
 * - r/cryptocurrency (for crypto market context)
 */

import { SocialMention, SocialSearchResult } from './types';
import { analyzeSentimentWithLabel } from './sentiment';
import { generateContentHash } from './matcher';

// Reddit API (no auth needed for public read)
const REDDIT_BASE_URL = 'https://www.reddit.com';

// Subreddits to monitor
const PREDICTION_SUBREDDITS = [
  'polymarket',
  'predictit',
  'Manifold',
  'predictionmarkets',
];

const CONTEXT_SUBREDDITS = [
  'politics',
  'economics',
  'cryptocurrency',
  'wallstreetbets',
  'investing',
];

interface RedditPost {
  data: {
    id: string;
    title: string;
    selftext: string;
    author: string;
    subreddit: string;
    permalink: string;
    score: number;
    upvote_ratio: number;
    num_comments: number;
    created_utc: number;
    url: string;
  };
}

interface RedditResponse {
  data: {
    children: RedditPost[];
    after?: string;
  };
}

/**
 * Fetch posts from a subreddit
 */
async function fetchSubreddit(
  subreddit: string,
  options?: {
    sort?: 'hot' | 'new' | 'top';
    limit?: number;
    after?: string;
  }
): Promise<{ posts: RedditPost[]; after?: string }> {
  const sort = options?.sort || 'hot';
  const limit = options?.limit || 25;

  let url = `${REDDIT_BASE_URL}/r/${subreddit}/${sort}.json?limit=${limit}`;
  if (options?.after) {
    url += `&after=${options.after}`;
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'BeRight/1.0 (prediction market intelligence)',
      },
    });

    if (!response.ok) {
      throw new Error(`Reddit API error: ${response.status}`);
    }

    const data: RedditResponse = await response.json();

    return {
      posts: data.data.children,
      after: data.data.after,
    };
  } catch (err) {
    console.warn(`[Reddit] Failed to fetch r/${subreddit}:`, err);
    return { posts: [] };
  }
}

/**
 * Search Reddit for keywords
 */
async function searchReddit(
  query: string,
  options?: {
    subreddit?: string;
    limit?: number;
    sort?: 'relevance' | 'hot' | 'new' | 'top';
    time?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
  }
): Promise<RedditPost[]> {
  const limit = options?.limit || 25;
  const sort = options?.sort || 'relevance';
  const time = options?.time || 'day';

  let url = `${REDDIT_BASE_URL}/search.json?q=${encodeURIComponent(query)}&limit=${limit}&sort=${sort}&t=${time}`;

  if (options?.subreddit) {
    url = `${REDDIT_BASE_URL}/r/${options.subreddit}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&limit=${limit}&sort=${sort}&t=${time}`;
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'BeRight/1.0 (prediction market intelligence)',
      },
    });

    if (!response.ok) {
      throw new Error(`Reddit search error: ${response.status}`);
    }

    const data: RedditResponse = await response.json();
    return data.data.children;
  } catch (err) {
    console.warn('[Reddit] Search failed:', err);
    return [];
  }
}

/**
 * Convert Reddit post to SocialMention
 */
function postToMention(post: RedditPost): SocialMention {
  const text = `${post.data.title} ${post.data.selftext}`.trim();
  const { score, label } = analyzeSentimentWithLabel(text);

  return {
    source: 'reddit',
    sourceId: post.data.id,
    sourceUrl: `https://reddit.com${post.data.permalink}`,
    author: post.data.author,
    authorHandle: `u/${post.data.author}`,
    content: text.slice(0, 1000), // Truncate long posts
    contentHash: generateContentHash(text),
    sentiment: score,
    sentimentLabel: label,
    likes: post.data.score,
    retweets: 0, // Reddit doesn't have retweets
    comments: post.data.num_comments,
    engagementScore: post.data.score + post.data.num_comments * 3,
    postedAt: new Date(post.data.created_utc * 1000),
    fetchedAt: new Date(),
  };
}

/**
 * Fetch prediction market subreddits
 */
export async function fetchPredictionSubreddits(
  options?: { limit?: number }
): Promise<SocialSearchResult> {
  const limit = Math.ceil((options?.limit || 50) / PREDICTION_SUBREDDITS.length);
  const allMentions: SocialMention[] = [];

  for (const subreddit of PREDICTION_SUBREDDITS) {
    const { posts } = await fetchSubreddit(subreddit, { limit, sort: 'hot' });
    const mentions = posts.map(postToMention);
    allMentions.push(...mentions);

    // Rate limit between subreddits
    await new Promise(r => setTimeout(r, 500));
  }

  return {
    mentions: allMentions,
    source: 'reddit',
    query: PREDICTION_SUBREDDITS.join('+'),
    fetchedAt: new Date(),
    hasMore: allMentions.length >= (options?.limit || 50),
  };
}

/**
 * Search Reddit for prediction market keywords
 */
export async function searchRedditMentions(
  keywords: string[],
  options?: { limit?: number }
): Promise<SocialSearchResult> {
  const query = keywords.join(' OR ');
  const posts = await searchReddit(query, {
    limit: options?.limit || 50,
    sort: 'new',
    time: 'day',
  });

  const mentions = posts.map(postToMention);

  return {
    mentions,
    source: 'reddit',
    query,
    fetchedAt: new Date(),
    hasMore: mentions.length >= (options?.limit || 50),
  };
}

/**
 * Fetch context subreddits for broader sentiment
 */
export async function fetchContextSubreddits(
  topic: 'politics' | 'crypto' | 'economics',
  options?: { limit?: number }
): Promise<SocialSearchResult> {
  const subreddits = {
    politics: ['politics', 'news'],
    crypto: ['cryptocurrency', 'bitcoin'],
    economics: ['economics', 'wallstreetbets'],
  };

  const targetSubs = subreddits[topic];
  const limit = Math.ceil((options?.limit || 30) / targetSubs.length);
  const allMentions: SocialMention[] = [];

  for (const subreddit of targetSubs) {
    const { posts } = await fetchSubreddit(subreddit, { limit, sort: 'hot' });
    const mentions = posts.map(postToMention);
    allMentions.push(...mentions);

    await new Promise(r => setTimeout(r, 500));
  }

  return {
    mentions: allMentions,
    source: 'reddit',
    query: targetSubs.join('+'),
    fetchedAt: new Date(),
    hasMore: false,
  };
}

/**
 * Get trending topics from prediction subreddits
 */
export async function getRedditTrending(): Promise<string[]> {
  const result = await fetchPredictionSubreddits({ limit: 100 });

  const wordCounts: Map<string, number> = new Map();

  for (const mention of result.mentions) {
    const words = mention.content
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 4 && !w.startsWith('http'));

    for (const word of words) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }
  }

  return [...wordCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);
}
