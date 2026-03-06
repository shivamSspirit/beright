/**
 * News Catalyst Detector
 *
 * Detects breaking news relevant to prediction markets using Tavily.
 *
 * @author BeRight Protocol
 */

import {
  SignalDetector,
  NewsSignal,
  Signal,
  generateSignalId,
  getSignalEmoji,
  getUrgencyFromConfidence,
  getSignalTTL,
} from '../types';
import { getDataFabric } from '../../dataFabric';
import { UnifiedMarket } from '../../dataFabric/types';

// Check if Tavily is available
let tavilyAvailable = false;
let tavilySearch: any = null;

try {
  const tavily = require('../../tavily');
  tavilySearch = tavily.tavilySearch;
  tavilyAvailable = tavily.isTavilyConfigured?.() ?? !!process.env.TAVILY_API_KEY;
} catch {
  console.log('[NewsDetector] Tavily not available, using fallback');
}

const MAX_SIGNALS = 10;
const NEWS_RECENCY_HOURS = 24;

// Sentiment keywords
const BULLISH_WORDS = ['win', 'surge', 'gain', 'positive', 'success', 'rise', 'breakthrough', 'victory', 'ahead', 'lead'];
const BEARISH_WORDS = ['lose', 'fall', 'drop', 'negative', 'fail', 'decline', 'defeat', 'behind', 'crash', 'scandal'];

/**
 * Detect sentiment from text
 */
function detectSentiment(text: string): 'positive' | 'negative' | 'neutral' {
  const lower = text.toLowerCase();
  let bullishScore = 0;
  let bearishScore = 0;

  for (const word of BULLISH_WORDS) {
    if (lower.includes(word)) bullishScore++;
  }

  for (const word of BEARISH_WORDS) {
    if (lower.includes(word)) bearishScore++;
  }

  if (bullishScore > bearishScore + 1) return 'positive';
  if (bearishScore > bullishScore + 1) return 'negative';
  return 'neutral';
}

/**
 * Calculate relevance score between news and market
 */
function calculateRelevance(newsText: string, marketQuestion: string): number {
  const newsWords = new Set(newsText.toLowerCase().split(/\W+/).filter(w => w.length > 3));
  const marketWords = new Set(marketQuestion.toLowerCase().split(/\W+/).filter(w => w.length > 3));

  let overlap = 0;
  for (const word of marketWords) {
    if (newsWords.has(word)) overlap++;
  }

  return marketWords.size > 0 ? overlap / marketWords.size : 0;
}

/**
 * Search for news related to a market
 */
async function searchNewsForMarket(market: UnifiedMarket): Promise<NewsSignal | null> {
  if (!tavilyAvailable || !tavilySearch) return null;

  try {
    // Extract key terms from market question
    const query = market.question
      .replace(/\?/g, '')
      .replace(/will|be|the|a|an|in|on|at|to|for|of/gi, '')
      .trim()
      .slice(0, 100);

    const results = await tavilySearch(query, {
      searchDepth: 'basic',
      maxResults: 5,
      includeDomains: ['reuters.com', 'apnews.com', 'bbc.com', 'nytimes.com', 'wsj.com', 'bloomberg.com'],
    });

    if (!results?.results?.length) return null;

    // Find most relevant result
    let bestResult = null;
    let bestRelevance = 0;

    for (const result of results.results) {
      const relevance = calculateRelevance(result.title + ' ' + (result.content || ''), market.question);
      if (relevance > bestRelevance && relevance > 0.2) {
        bestRelevance = relevance;
        bestResult = result;
      }
    }

    if (!bestResult || bestRelevance < 0.3) return null;

    const sentiment = detectSentiment(bestResult.title + ' ' + (bestResult.content || ''));
    const confidence = Math.min(bestRelevance * 1.5, 0.95);

    const primaryPlatform = market.platforms[0];

    const signal: NewsSignal = {
      id: generateSignalId('NEWS_CATALYST', market.id, 'tavily'),
      type: 'NEWS_CATALYST',
      source: 'tavily',
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + getSignalTTL('NEWS_CATALYST')),
      confidence,
      urgency: getUrgencyFromConfidence(confidence),
      title: `News: ${bestResult.title.slice(0, 60)}...`,
      description: `${sentiment === 'positive' ? '📈' : sentiment === 'negative' ? '📉' : '➡️'} ${bestResult.content?.slice(0, 150) || bestResult.title}...`,
      emoji: getSignalEmoji('NEWS_CATALYST'),
      market: {
        id: market.id,
        question: market.question,
        platform: primaryPlatform?.platform || 'polymarket',
        url: primaryPlatform?.url,
        currentPrice: market.consensusPrice,
      },
      data: {
        headline: bestResult.title,
        source: new URL(bestResult.url).hostname.replace('www.', ''),
        url: bestResult.url,
        sentiment,
        relevanceScore: bestRelevance,
        publishedAt: bestResult.publishedDate ? new Date(bestResult.publishedDate) : new Date(),
        summary: bestResult.content?.slice(0, 300),
      },
      suggestedAction: sentiment !== 'neutral' ? {
        direction: sentiment === 'positive' ? 'YES' : 'NO',
        size: confidence > 0.7 ? 'medium' : 'small',
        reasoning: `${sentiment === 'positive' ? 'Positive' : 'Negative'} news may move price ${sentiment === 'positive' ? 'up' : 'down'}`,
      } : undefined,
    };

    return signal;
  } catch (error) {
    console.error('[NewsDetector] Search error:', error);
    return null;
  }
}

export const newsDetector: SignalDetector = {
  name: 'news',
  signalTypes: ['NEWS_CATALYST'],
  enabled: tavilyAvailable,

  async detect(): Promise<Signal[]> {
    if (!tavilyAvailable) {
      console.log('[NewsDetector] Tavily not configured, skipping');
      return [];
    }

    try {
      const fabric = getDataFabric();

      // Focus on high-volume, active markets
      const result = await fabric.getMarkets({
        limit: 20,
        sortBy: 'volume',
        sortOrder: 'desc',
        minVolume: 10000,
      });

      const signals: NewsSignal[] = [];

      // Search news for top markets (with rate limiting)
      for (const market of result.markets.slice(0, 10)) {
        const signal = await searchNewsForMarket(market);
        if (signal) {
          signals.push(signal);
        }

        // Rate limit: 1 request per 500ms
        await new Promise(resolve => setTimeout(resolve, 500));

        if (signals.length >= MAX_SIGNALS) break;
      }

      console.log(`[NewsDetector] Found ${signals.length} news catalysts`);
      return signals;
    } catch (error) {
      console.error('[NewsDetector] Error:', error);
      return [];
    }
  },

  async isHealthy(): Promise<boolean> {
    return tavilyAvailable;
  },
};

export default newsDetector;
