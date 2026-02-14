/**
 * Response Types for BeRight Protocol
 * Standardized skill response interfaces
 */

export type Mood =
  | 'BULLISH'      // Opportunity found, positive signal
  | 'BEARISH'      // Warning, negative signal
  | 'NEUTRAL'      // Informational, no strong signal
  | 'ALERT'        // Urgent attention needed (arb, whale)
  | 'EDUCATIONAL'  // Teaching moment
  | 'ERROR';       // Something went wrong

export interface SkillResponse {
  text: string;
  mood?: Mood;
  data?: unknown;
  voice?: string;
  sticker?: string;
}

export interface TelegramMessage {
  message_id: number;
  chat: {
    id: number;
    type: string;
    username?: string;
    first_name?: string;
  };
  from?: {
    id: number;
    username?: string;
    first_name?: string;
  };
  text?: string;
  date: number;
  // Reply context - when user replies to a previous message
  reply_to_message?: {
    message_id: number;
    text?: string;
    from?: {
      id: number;
      username?: string;
      is_bot?: boolean;
    };
    date: number;
  };
}

export interface ResearchReport {
  query: string;
  timestamp: string;
  markets: import('./market').Market[];
  news: NewsResult;
  reddit: RedditSentiment;
  analysis: Analysis;
}

export interface NewsResult {
  topic: string;
  articleCount: number;
  articles: NewsArticle[];
  sources: string[];
}

export interface NewsArticle {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  source: string;
  type: string;
}

export interface RedditSentiment {
  postCount: number;
  totalComments: number;
  engagementLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  topSubreddits: [string, number][];
}

export interface Analysis {
  marketSummary: string;
  consensusPrice: number | null;
  priceRange: [number, number] | null;
  newsSentiment: 'bullish' | 'bearish' | 'neutral';
  socialSentiment: 'active' | 'quiet' | 'neutral';
  confidence: 'low' | 'medium' | 'high';
  keyFactors: string[];
}

export interface WhaleAlert {
  wallet: string;
  whaleName: string;
  whaleAccuracy: number;
  signature: string;
  timestamp: string | null;
  type: string;
  totalUsd: number;
  fee: number;
  description: string;
}
