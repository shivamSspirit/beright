/**
 * LLM Classification Prompts
 *
 * System prompts and user message templates for market classification.
 * Designed for GPT-4o-mini with JSON response format.
 *
 * @author BeRight Protocol
 */

import { ClassificationInput } from './types';

// =============================================================================
// SYSTEM PROMPT
// =============================================================================

/**
 * System prompt for market classification
 */
export const CLASSIFICATION_SYSTEM_PROMPT = `You are a prediction market analyst. Your job is to determine the relationship between two prediction markets from different platforms.

RELATIONSHIP TYPES:

1. EXACT - Same underlying event with equivalent resolution criteria
   - Both markets resolve to the same outcome
   - Differences in wording are superficial
   - Arbitrage is possible between these markets
   Examples:
   - "Will Trump win the 2024 election?" = "Trump to win 2024 US Presidential Election"
   - "BTC above $100K by Dec 31, 2024" = "Bitcoin price > $100,000 on December 31, 2024"

2. RELATED - Correlated but distinct events
   - Outcomes are correlated but not identical
   - One resolving YES doesn't guarantee the other resolves YES
   - Useful for hedging or correlation analysis
   Examples:
   - "Trump wins presidency" vs "Republicans win popular vote"
   - "Fed cuts rates in 2024" vs "Inflation below 3% by end of 2024"

3. OPPOSITE - Inverse or contradictory outcomes
   - If one is YES, the other should be NO (or vice versa)
   - Can be used to validate market efficiency
   Examples:
   - "Democrats win 2024" vs "Republicans win 2024" (mutually exclusive)
   - "BTC above $100K" vs "BTC below $100K" (if same date)

4. UNRELATED - No meaningful connection
   - Different events, topics, or timeframes
   - No correlation worth noting

IMPORTANT CONSIDERATIONS:
- Pay attention to DATES - "by 2024" vs "by 2025" are different events
- Pay attention to THRESHOLDS - "above $100K" vs "above $150K" are different
- Pay attention to RESOLUTION CRITERIA - "win presidency" vs "win popular vote" differ
- Slight wording differences are OK for EXACT if resolution would be identical
- When in doubt, prefer RELATED over EXACT (be conservative)

Respond with valid JSON only. No markdown, no code blocks, just the JSON object.`;

// =============================================================================
// USER PROMPT TEMPLATE
// =============================================================================

/**
 * Generate classification prompt for a market pair
 */
export function generateClassificationPrompt(input: ClassificationInput): string {
  const { marketA, marketB, preScore } = input;

  const formatDate = (date?: Date): string => {
    if (!date) return 'Not specified';
    return date.toISOString().split('T')[0];
  };

  return `Compare these two prediction markets:

MARKET A (${marketA.platform})
Question: ${marketA.question}
${marketA.description ? `Description: ${marketA.description.slice(0, 200)}${marketA.description.length > 200 ? '...' : ''}` : ''}
End Date: ${formatDate(marketA.endDate)}
${marketA.resolutionCriteria ? `Resolution: ${marketA.resolutionCriteria.slice(0, 150)}` : ''}

MARKET B (${marketB.platform})
Question: ${marketB.question}
${marketB.description ? `Description: ${marketB.description.slice(0, 200)}${marketB.description.length > 200 ? '...' : ''}` : ''}
End Date: ${formatDate(marketB.endDate)}
${marketB.resolutionCriteria ? `Resolution: ${marketB.resolutionCriteria.slice(0, 150)}` : ''}

PRE-COMPUTED SIMILARITY SCORES:
- Embedding Similarity: ${(preScore.embeddingSimilarity * 100).toFixed(1)}%
- Entity Overlap: ${(preScore.entityOverlap * 100).toFixed(1)}%
- Date Alignment: ${(preScore.dateAlignment * 100).toFixed(1)}%

Classify the relationship between these markets.

Return JSON:
{
  "type": "exact" | "related" | "opposite" | "unrelated",
  "confidence": 0-100,
  "reasoning": "Brief explanation",
  "resolution_match": true/false,
  "date_match": true/false
}`;
}

// =============================================================================
// CACHE KEY GENERATION
// =============================================================================

/**
 * Generate cache key for a market pair
 * Sorted to ensure consistent key regardless of order
 */
export function generateCacheKey(marketAId: string, marketBId: string): string {
  const sorted = [marketAId, marketBId].sort();
  return `clf:${sorted[0]}:${sorted[1]}`;
}

/**
 * Generate a short hash for logging
 */
export function generateShortHash(marketAId: string, marketBId: string): string {
  const key = generateCacheKey(marketAId, marketBId);
  // Simple hash for logging (not cryptographic)
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).slice(0, 6);
}
