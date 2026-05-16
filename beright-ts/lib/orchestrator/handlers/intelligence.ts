/**
 * Intelligence Handler
 *
 * Get market intelligence: base rates, consensus, bias warnings.
 *
 * @see docs/ADR-002-TELEGRAM-AS-GATEWAY.md
 */

import {
  CommandHandler,
  CommandContext,
  CommandResult,
} from '../types';
import { registerHandler } from './registry';
import { getIntelligence, getUserCalibrationProfile } from '../../../skills/intelligence';

// =============================================================================
// TYPES
// =============================================================================

export interface SimilarMarket {
  title: string;
  result: 'yes' | 'no';
  price: number;
}

export interface ConsensusSource {
  platform: string;
  probability: number;
  volume?: number;
}

export interface IntelligenceResult {
  timestamp: string;
  question: string;
  marketTicker?: string;
  marketPrice?: number;
  baseRate: {
    rate: number;
    sampleSize: number;
    confidence: 'low' | 'medium' | 'high';
    similarMarkets: SimilarMarket[];
  };
  consensus: {
    aggregatedProbability: number;
    sources: ConsensusSource[];
    divergence: number;
  };
  keyFactors: string[];
  biasWarnings: string[];
  recommendedRange: { low: number; high: number };
  calibrationTip?: string;
  userProfile?: {
    avgBrier: number;
    overconfidenceTendency: number;
    strongCategories: string[];
    weakCategories: string[];
  };
}

// =============================================================================
// HANDLER
// =============================================================================

export const intelligenceHandler: CommandHandler<IntelligenceResult> = {
  id: 'intelligence',
  skillsUsed: ['intelligence', 'dflow', 'calibration'],

  async execute(context: CommandContext): Promise<CommandResult<IntelligenceResult>> {
    const startTime = Date.now();

    try {
      const args = context.arguments || [];
      const userId = context.userId || context.gatewayContext?.chatId?.toString() || 'anonymous';

      if (args.length === 0) {
        return {
          success: false,
          error: {
            code: 'MISSING_QUESTION',
            message: 'Usage: /intelligence "Will Bitcoin hit $100k by 2026?"',
            retryable: false,
          },
          meta: {
            handlerId: 'intelligence',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: [],
            apiCallsMade: 0,
          },
          hints: { mood: 'NEUTRAL' },
        };
      }

      // Check if first arg is a ticker
      const firstArg = args[0];
      const isTicker = /^[A-Z0-9-]+$/.test(firstArg) && firstArg.length > 3;

      const question = isTicker ? args.slice(1).join(' ') || firstArg : args.join(' ');
      const marketTicker = isTicker ? firstArg : undefined;

      // Get intelligence report
      const report = await getIntelligence(question, marketTicker);

      // Get user calibration profile for personalized tips
      let userProfile: IntelligenceResult['userProfile'];
      try {
        const profile = await getUserCalibrationProfile(userId);
        if (profile) {
          userProfile = {
            avgBrier: profile.avgBrier,
            overconfidenceTendency: profile.overconfidenceTendency,
            strongCategories: profile.strongCategories,
            weakCategories: profile.weakCategories,
          };
        }
      } catch (e) {
        // Profile is optional
      }

      const result: IntelligenceResult = {
        timestamp: new Date().toISOString(),
        question: report.question,
        marketTicker,
        marketPrice: report.marketPrice,
        baseRate: {
          rate: report.baseRate.rate,
          sampleSize: report.baseRate.sampleSize,
          confidence: report.baseRate.confidence,
          similarMarkets: report.baseRate.similarMarkets,
        },
        consensus: {
          aggregatedProbability: report.consensus.aggregatedProbability,
          sources: report.consensus.sources,
          divergence: report.consensus.divergence,
        },
        keyFactors: report.keyFactors,
        biasWarnings: report.biasWarnings,
        recommendedRange: report.recommendedRange,
        calibrationTip: report.calibrationTip,
        userProfile,
      };

      return {
        success: true,
        data: result,
        meta: {
          handlerId: 'intelligence',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['intelligence', 'dflow', 'calibration'],
          apiCallsMade: 2 + report.consensus.sources.length,
        },
        hints: {
          mood: 'EDUCATIONAL',
          suggestedActions: ['/predict', '/smartpredict'],
        },
      };
    } catch (error) {
      console.error('[IntelligenceHandler] Error:', error);

      return {
        success: false,
        error: {
          code: 'INTELLIGENCE_FAILED',
          message: error instanceof Error ? error.message : 'Failed to get intelligence',
          retryable: true,
        },
        meta: {
          handlerId: 'intelligence',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['intelligence'],
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

registerHandler(intelligenceHandler);

export default intelligenceHandler;
