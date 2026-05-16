/**
 * Social Listener - Type Definitions
 *
 * Types for social media monitoring (Twitter/X, Reddit)
 * to detect prediction market sentiment and narrative emergence.
 */

export type SocialSource = 'twitter' | 'reddit' | 'telegram' | 'discord' | 'news';

export type SentimentLabel = 'bullish' | 'neutral' | 'bearish';

export interface SocialMention {
  id?: string;
  source: SocialSource;
  sourceId?: string;              // Tweet ID, Reddit post ID
  sourceUrl?: string;             // Direct link

  // Author
  author?: string;
  authorHandle?: string;
  authorFollowers?: number;
  isVerified?: boolean;

  // Content
  content: string;
  contentHash?: string;           // MD5 for deduplication

  // Market linking
  marketId?: string;
  marketTitle?: string;
  platform?: string;
  matchConfidence?: number;       // 0-1

  // Sentiment
  sentiment?: number;             // -1 to 1
  sentimentLabel?: SentimentLabel;

  // Engagement
  likes?: number;
  retweets?: number;
  comments?: number;
  engagementScore?: number;

  // Timestamps
  postedAt?: Date;
  fetchedAt?: Date;
  createdAt?: Date;
}

export interface SocialVelocity {
  marketId: string;
  platform: string;

  // Counts
  mentions1h: number;
  mentions24h: number;
  mentions7d: number;

  // Velocity (acceleration)
  velocity1h: number;             // mentions_1h / avg_hourly baseline
  velocity24h: number;            // mentions_24h / avg_daily baseline

  // Sentiment
  avgSentiment1h: number;
  avgSentiment24h: number;

  // Top mentions for display
  topMentions: Array<{
    source: SocialSource;
    author: string;
    content: string;
    engagement: number;
  }>;

  updatedAt: Date;
}

export interface TrackedAccount {
  source: SocialSource;
  accountHandle: string;
  displayName?: string;
  accountType: 'forecaster' | 'analyst' | 'news' | 'influencer' | 'official';
  forecasterTelegramId?: number;
  followers?: number;
  priority: number;               // 1-10
  isActive: boolean;
}

export interface SocialKeyword {
  keyword: string;
  keywordType: 'market_title' | 'entity' | 'ticker' | 'hashtag' | 'custom';
  marketId?: string;
  platform?: string;
  priority: number;
  isActive: boolean;
}

export interface IngestionState {
  source: SocialSource;
  lastFetchAt?: Date;
  lastPostId?: string;
  postsFetchedTotal: number;
  errorsCount: number;
  lastError?: string;
}

export interface SocialSearchQuery {
  keywords: string[];
  accounts?: string[];
  source: SocialSource;
  limit?: number;
  since?: Date;
}

export interface SocialSearchResult {
  mentions: SocialMention[];
  source: SocialSource;
  query: string;
  fetchedAt: Date;
  hasMore: boolean;
  cursor?: string;
}

export interface SocialConfig {
  // API keys (from env)
  twitterBearerToken?: string;
  redditClientId?: string;
  redditClientSecret?: string;

  // Rate limits
  twitterRateLimit: number;       // requests per 15 min
  redditRateLimit: number;        // requests per minute

  // Batch sizes
  batchSize: number;
  maxMentionsPerFetch: number;

  // Sentiment thresholds
  bullishThreshold: number;       // > this = bullish
  bearishThreshold: number;       // < this = bearish
}

export const DEFAULT_SOCIAL_CONFIG: SocialConfig = {
  twitterRateLimit: 300,          // Twitter API v2 free tier
  redditRateLimit: 60,            // Reddit API
  batchSize: 100,
  maxMentionsPerFetch: 500,
  bullishThreshold: 0.2,
  bearishThreshold: -0.2,
};
