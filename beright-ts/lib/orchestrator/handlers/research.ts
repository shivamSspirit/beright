/**
 * Research Handler
 *
 * Deep research on any topic using multi-source intelligence:
 * - Prediction markets (Polymarket, Kalshi, etc.)
 * - News (Tavily or RSS fallback)
 * - Reddit sentiment
 * - LLM synthesis
 *
 * @see docs/ADR-002-TELEGRAM-AS-GATEWAY.md
 */

import {
  CommandHandler,
  CommandContext,
  CommandResult,
} from '../types';
import { registerHandler } from './registry';
import { research as executeResearch } from '../../../skills/research';
import { Market } from '../../../types/market';

// =============================================================================
// TYPES
// =============================================================================

/**
 * News article
 */
export interface NewsArticle {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  source?: string;
}

/**
 * Reddit sentiment
 */
export interface RedditSentiment {
  posts: Array<{
    title: string;
    url: string;
    score: number;
    comments: number;
    subreddit: string;
  }>;
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  postCount: number;
}

/**
 * Research synthesis (LLM-generated)
 */
export interface ResearchSynthesis {
  narrative: string;
  probability: number;
  confidence: 'low' | 'medium' | 'high';
  recommendation: 'YES' | 'NO' | 'SKIP';
  keyFactors: string[];
  risks: string[];
  tokensUsed?: number;
}

/**
 * Research result data
 */
export interface ResearchResult {
  query: string;
  timestamp: string;

  // Markets
  markets: Market[];
  marketCount: number;

  // News
  news: {
    articles: NewsArticle[];
    articleCount: number;
    sources: string[];
  };

  // Social
  reddit: RedditSentiment;

  // Analysis
  analysis: {
    sentiment: 'bullish' | 'bearish' | 'neutral' | 'mixed';
    confidence: 'low' | 'medium' | 'high';
    consensusProbability?: number;
    signalStrength: number;
  };

  // LLM synthesis (optional - may not be available)
  synthesis?: ResearchSynthesis;
}

// =============================================================================
// HANDLER
// =============================================================================

/**
 * Research Handler
 *
 * Executes deep research on a topic and returns structured data.
 */
export const researchHandler: CommandHandler<ResearchResult> = {
  id: 'research',
  skillsUsed: ['research', 'markets', 'news', 'reddit', 'llm'],

  async execute(context: CommandContext): Promise<CommandResult<ResearchResult>> {
    const startTime = Date.now();

    try {
      // Extract query from params or arguments
      const query = (context.params.query as string) ||
                    context.arguments?.join(' ') ||
                    '';

      if (!query || query.length < 2) {
        return {
          success: false,
          error: {
            code: 'INVALID_QUERY',
            message: 'Please provide a topic to research. Example: /research bitcoin halving',
            retryable: false,
          },
          meta: {
            handlerId: 'research',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: [],
            apiCallsMade: 0,
          },
          hints: {
            mood: 'NEUTRAL',
            suggestedActions: ['/research bitcoin', '/research fed rates', '/research trump'],
          },
        };
      }

      // Execute research using existing skill
      const skillResponse = await executeResearch(query);
      const reportData = skillResponse.data as {
        query: string;
        timestamp: string;
        markets: Market[];
        news: { topic: string; articleCount: number; articles: NewsArticle[]; sources: string[] };
        reddit: RedditSentiment;
        analysis: {
          sentiment: string;
          confidence: string;
          consensusProbability?: number;
          signalStrength?: number;
        };
        synthesis?: ResearchSynthesis;
      };

      // Transform to our result format
      const result: ResearchResult = {
        query: reportData.query,
        timestamp: reportData.timestamp,
        markets: reportData.markets || [],
        marketCount: reportData.markets?.length || 0,
        news: {
          articles: reportData.news?.articles || [],
          articleCount: reportData.news?.articleCount || 0,
          sources: reportData.news?.sources || [],
        },
        reddit: reportData.reddit || {
          posts: [],
          sentiment: 'neutral',
          postCount: 0,
        },
        analysis: {
          sentiment: (reportData.analysis?.sentiment || 'neutral') as ResearchResult['analysis']['sentiment'],
          confidence: (reportData.analysis?.confidence || 'low') as ResearchResult['analysis']['confidence'],
          consensusProbability: reportData.analysis?.consensusProbability,
          signalStrength: reportData.analysis?.signalStrength || 0,
        },
        synthesis: reportData.synthesis,
      };

      // Determine mood based on analysis
      const mood = result.synthesis?.recommendation === 'YES' ? 'BULLISH'
        : result.synthesis?.recommendation === 'NO' ? 'BEARISH'
        : 'NEUTRAL';

      return {
        success: true,
        data: result,
        meta: {
          handlerId: 'research',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['research', 'markets', 'news', 'reddit', 'llm'],
          apiCallsMade: 4, // markets, news, reddit, llm
        },
        hints: {
          mood,
          suggestedActions: result.markets.length > 0
            ? [`/trade ${result.markets[0].marketId} YES 10`]
            : ['/hot'],
        },
      };
    } catch (error) {
      console.error('[ResearchHandler] Error:', error);

      return {
        success: false,
        error: {
          code: 'RESEARCH_FAILED',
          message: error instanceof Error ? error.message : 'Research failed',
          retryable: true,
          recoveryAction: 'Try a different query or try again',
        },
        meta: {
          handlerId: 'research',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['research'],
          apiCallsMade: 0,
        },
        hints: {
          mood: 'ERROR',
        },
      };
    }
  },
};

// =============================================================================
// AUTO-REGISTER
// =============================================================================

registerHandler(researchHandler);

// =============================================================================
// EXPORTS
// =============================================================================

export default researchHandler;
