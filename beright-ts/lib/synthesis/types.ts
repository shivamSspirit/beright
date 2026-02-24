/**
 * Synthesis Agent Types
 *
 * Type definitions for the market synthesis system.
 */

import { EvaluatedSignal } from '../signals/types';

export interface SynthesisInput {
  signals: EvaluatedSignal[];
  momentumData?: {
    hotMarkets: Array<{ marketId: string; title: string; score: number }>;
    trendingCategories: string[];
  };
  socialData?: {
    topMentions: Array<{ content: string; sentiment: number; source: string }>;
    overallSentiment: number;
  };
  timeRange: {
    start: Date;
    end: Date;
  };
}

export interface MarketTheme {
  name: string;
  signals: EvaluatedSignal[];
  sentiment: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  narrative: string;
}

export interface SynthesisReport {
  id: string;
  createdAt: Date;
  timeRange: {
    start: Date;
    end: Date;
  };

  // Executive summary
  headline: string;
  summary: string;

  // Key themes extracted
  themes: MarketTheme[];

  // Top signals (ranked by importance)
  topSignals: Array<{
    signal: EvaluatedSignal;
    importance: number;
    reasoning: string;
  }>;

  // Market sentiment
  overallSentiment: 'bullish' | 'bearish' | 'neutral' | 'mixed';
  sentimentScore: number; // -1 to 1

  // Actionable insights
  recommendations: Array<{
    action: 'BUY' | 'SELL' | 'WATCH' | 'AVOID';
    market: string;
    reasoning: string;
    confidence: number;
  }>;

  // Metadata
  signalsProcessed: number;
  tokensUsed: number;
  modelId: string;
}

export interface SynthesisConfig {
  maxSignals: number;
  maxThemes: number;
  maxRecommendations: number;
  model: 'fast' | 'quality';
  includeRecommendations: boolean;
}

export const DEFAULT_SYNTHESIS_CONFIG: SynthesisConfig = {
  maxSignals: 30,
  maxThemes: 5,
  maxRecommendations: 5,
  model: 'quality',
  includeRecommendations: true,
};
