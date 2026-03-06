/**
 * Base Rate Estimation
 *
 * Outside view analysis using reference class forecasting.
 * "How often do events like this happen?"
 *
 * @author BeRight Protocol
 */

import { OutsideViewAnalysis, ConfidenceLevel } from './types';
import { llmChat } from '../llm';
import { MarketCategory } from '../dataFabric/types';

// =============================================================================
// KNOWN BASE RATES
// =============================================================================

/**
 * Pre-computed base rates for common reference classes
 * Based on historical data and academic research
 */
const KNOWN_BASE_RATES: Record<string, {
  rate: number;
  confidence: ConfidenceLevel;
  sampleSize?: number;
  source?: string;
}> = {
  // Elections
  'incumbent_reelection_us_president': { rate: 0.67, confidence: 'high', sampleSize: 18, source: 'Historical data since 1900' },
  'incumbent_loses_trailing_polls': { rate: 0.35, confidence: 'medium', sampleSize: 12, source: 'Gallup polling history' },
  'polling_leader_wins_election': { rate: 0.82, confidence: 'high', sampleSize: 50, source: '538 analysis' },
  'third_party_wins_us': { rate: 0.0, confidence: 'very_high', sampleSize: 100, source: 'Never happened since 1860' },

  // Crypto
  'bitcoin_new_ath_within_year': { rate: 0.45, confidence: 'medium', sampleSize: 10, source: 'Historical BTC cycles' },
  'altcoin_outperforms_btc_bull': { rate: 0.60, confidence: 'low', sampleSize: 8, source: 'Crypto market data' },
  'crypto_regulatory_approval': { rate: 0.30, confidence: 'low', sampleSize: 20, source: 'SEC/CFTC history' },

  // Economics
  'fed_rate_cut_next_meeting': { rate: 0.25, confidence: 'medium', source: 'Fed Funds futures implied' },
  'recession_within_year': { rate: 0.15, confidence: 'medium', sampleSize: 80, source: 'NBER recession data' },
  'inflation_target_met': { rate: 0.40, confidence: 'medium', source: 'Fed target history' },

  // Sports
  'higher_seed_wins_playoff': { rate: 0.65, confidence: 'high', sampleSize: 1000, source: 'Sports reference' },
  'defending_champion_repeats': { rate: 0.25, confidence: 'high', sampleSize: 100, source: 'Historical data' },

  // Technology
  'product_launches_on_announced_date': { rate: 0.70, confidence: 'medium', sampleSize: 50, source: 'Tech industry data' },
  'startup_reaches_announced_milestone': { rate: 0.30, confidence: 'low', source: 'Startup statistics' },

  // General
  'expert_consensus_correct': { rate: 0.65, confidence: 'medium', source: 'Tetlock research' },
  'prediction_market_correct': { rate: 0.70, confidence: 'high', source: 'Polymarket/Metaculus data' },
};

// =============================================================================
// CATEGORY BASE RATES
// =============================================================================

/**
 * Default base rates by category (when no specific reference class found)
 */
const CATEGORY_BASE_RATES: Record<MarketCategory, number> = {
  politics: 0.50,      // Binary events, high uncertainty
  crypto: 0.45,        // Volatile, hard to predict
  sports: 0.55,        // Some predictability
  economics: 0.50,     // Complex systems
  science: 0.60,       // More predictable long-term
  entertainment: 0.50, // Highly variable
  technology: 0.55,    // Moderate predictability
  world: 0.50,         // High uncertainty
  other: 0.50,         // Default
};

// =============================================================================
// BASE RATE ESTIMATION
// =============================================================================

/**
 * Find the best matching reference class for a question
 */
function findReferenceClass(question: string, category: MarketCategory): string | null {
  const q = question.toLowerCase();

  // Election patterns
  if (category === 'politics') {
    if (/\b(incumbent|reelect|re-elect)\b/.test(q)) {
      if (/\b(trailing|behind|losing)\b/.test(q)) {
        return 'incumbent_loses_trailing_polls';
      }
      return 'incumbent_reelection_us_president';
    }
    if (/\b(poll|polling|lead)\b/.test(q)) {
      return 'polling_leader_wins_election';
    }
    if (/\b(third party|independent)\b/.test(q)) {
      return 'third_party_wins_us';
    }
  }

  // Crypto patterns
  if (category === 'crypto') {
    if (/\b(ath|all.time.high|new high)\b/.test(q)) {
      return 'bitcoin_new_ath_within_year';
    }
    if (/\b(approval|approve|sec|cftc|regulatory)\b/.test(q)) {
      return 'crypto_regulatory_approval';
    }
  }

  // Economics patterns
  if (category === 'economics') {
    if (/\b(rate cut|cut rate|lower rate)\b/.test(q)) {
      return 'fed_rate_cut_next_meeting';
    }
    if (/\b(recession)\b/.test(q)) {
      return 'recession_within_year';
    }
    if (/\b(inflation|cpi|target)\b/.test(q)) {
      return 'inflation_target_met';
    }
  }

  // Sports patterns
  if (category === 'sports') {
    if (/\b(playoff|championship|final)\b/.test(q)) {
      return 'higher_seed_wins_playoff';
    }
    if (/\b(repeat|back.to.back|defending)\b/.test(q)) {
      return 'defending_champion_repeats';
    }
  }

  // Technology patterns
  if (category === 'technology') {
    if (/\b(launch|release|ship)\b/.test(q)) {
      return 'product_launches_on_announced_date';
    }
  }

  return null;
}

/**
 * Estimate base rate using LLM when no known reference class
 */
async function estimateBaseRateWithLLM(
  question: string,
  category: MarketCategory
): Promise<OutsideViewAnalysis> {
  const prompt = `You are a superforecaster performing reference class forecasting.

QUESTION: "${question}"
CATEGORY: ${category}

Your task:
1. Identify the most appropriate reference class (similar events/questions historically)
2. Estimate the base rate (how often events in this class resolve YES)
3. Provide reasoning

Respond in JSON format:
{
  "referenceClass": "Brief description of the reference class",
  "baseRate": 0.XX,
  "confidence": "low" | "medium" | "high",
  "reasoning": "Explanation of why this reference class applies and the base rate estimate",
  "historicalExamples": [
    { "event": "Similar past event", "outcome": true/false, "year": YYYY }
  ]
}

Be calibrated. Don't anchor on 50% unless that's truly the base rate. Consider:
- How often have similar events happened historically?
- What's the selection bias in your examples?
- Is this truly a representative reference class?`;

  try {
    const response = await llmChat({
      system: 'You are an expert in reference class forecasting and base rate estimation.',
      user: prompt,
      maxTokens: 500,
      temperature: 0.3,
      quality: 'smart',
    });

    // Parse JSON from response
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      referenceClass: parsed.referenceClass || 'General prediction market question',
      baseRate: Math.max(0.01, Math.min(0.99, parsed.baseRate || 0.5)),
      confidence: parsed.confidence || 'low',
      reasoning: parsed.reasoning || 'LLM-estimated base rate',
      historicalExamples: parsed.historicalExamples,
    };
  } catch (error) {
    console.error('[BaseRates] LLM estimation failed:', error);

    // Fallback to category default
    return {
      referenceClass: `General ${category} question`,
      baseRate: CATEGORY_BASE_RATES[category],
      confidence: 'very_low',
      reasoning: `Fallback to category default. No specific reference class identified.`,
    };
  }
}

// =============================================================================
// MAIN EXPORT
// =============================================================================

/**
 * Estimate base rate for a market question
 */
export async function estimateBaseRate(
  question: string,
  category: MarketCategory
): Promise<OutsideViewAnalysis> {
  // First, try to find a known reference class
  const refClass = findReferenceClass(question, category);

  if (refClass && KNOWN_BASE_RATES[refClass]) {
    const known = KNOWN_BASE_RATES[refClass];

    return {
      referenceClass: refClass.replace(/_/g, ' '),
      baseRate: known.rate,
      sampleSize: known.sampleSize,
      confidence: known.confidence,
      reasoning: `Using known reference class: ${refClass}. ${known.source || ''}`,
    };
  }

  // Otherwise, use LLM to estimate
  return estimateBaseRateWithLLM(question, category);
}

/**
 * Get base rate from known reference class (fast, no LLM)
 */
export function getKnownBaseRate(
  referenceClass: string
): { rate: number; confidence: ConfidenceLevel } | null {
  const known = KNOWN_BASE_RATES[referenceClass];
  if (known) {
    return { rate: known.rate, confidence: known.confidence };
  }
  return null;
}

/**
 * List all known reference classes
 */
export function listReferenceClasses(): string[] {
  return Object.keys(KNOWN_BASE_RATES);
}

export default {
  estimateBaseRate,
  getKnownBaseRate,
  listReferenceClasses,
  KNOWN_BASE_RATES,
  CATEGORY_BASE_RATES,
};
