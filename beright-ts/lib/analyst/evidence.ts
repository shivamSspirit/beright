/**
 * Evidence Gathering
 *
 * Inside view analysis - gathering and weighing specific evidence.
 * "What's different about this specific case?"
 *
 * @author BeRight Protocol
 */

import { InsideViewAnalysis, EvidenceFactor, ConfidenceLevel } from './types';
import { UnifiedMarket } from '../dataFabric/types';
import { llmChat } from '../llm';

// Use Serper for web search
import { serperNewsSearch, isSerperConfigured } from '../serper';

const searchAvailable = isSerperConfigured();

// =============================================================================
// EVIDENCE GATHERING
// =============================================================================

/**
 * Gather news evidence for a market
 */
async function gatherNewsEvidence(
  question: string,
  limit: number = 5
): Promise<EvidenceFactor[]> {
  if (!searchAvailable) {
    return [];
  }

  try {
    const query = question.replace(/\?/g, '').slice(0, 100);
    const response = await serperNewsSearch(query, { num: limit });

    if (!response?.results?.length) return [];

    const factors: EvidenceFactor[] = [];

    for (const result of response.results) {
      const sentiment = detectSentiment(result.title + ' ' + (result.snippet || ''));
      const weight = getWeightFromRelevance(0.7); // Serper doesn't provide relevance score

      factors.push({
        factor: result.title.slice(0, 100),
        source: result.source || new URL(result.url).hostname.replace('www.', ''),
        weight,
        direction: sentiment,
        confidence: 0.7,
      });
    }

    return factors;
  } catch (error) {
    console.error('[Evidence] News gathering failed:', error);
    return [];
  }
}

/**
 * Detect sentiment from text
 */
function detectSentiment(text: string): 'bullish' | 'bearish' {
  const lower = text.toLowerCase();

  const bullishWords = ['win', 'surge', 'gain', 'positive', 'success', 'rise', 'ahead', 'lead', 'increase', 'boost', 'strong'];
  const bearishWords = ['lose', 'fall', 'drop', 'negative', 'fail', 'decline', 'behind', 'crash', 'decrease', 'weak', 'struggle'];

  let bullish = 0;
  let bearish = 0;

  for (const word of bullishWords) {
    if (lower.includes(word)) bullish++;
  }
  for (const word of bearishWords) {
    if (lower.includes(word)) bearish++;
  }

  return bullish >= bearish ? 'bullish' : 'bearish';
}

/**
 * Convert relevance score to weight
 */
function getWeightFromRelevance(score: number): 'weak' | 'moderate' | 'strong' {
  if (score >= 0.8) return 'strong';
  if (score >= 0.5) return 'moderate';
  return 'weak';
}

/**
 * Gather market-specific evidence using LLM
 */
async function gatherLLMEvidence(
  market: UnifiedMarket,
  newsContext?: string
): Promise<InsideViewAnalysis> {
  const prompt = `You are a superforecaster analyzing evidence for a prediction market.

MARKET QUESTION: "${market.question}"
CATEGORY: ${market.category}
CURRENT PRICE: ${(market.consensusPrice * 100).toFixed(0)}% YES
${market.closeDate ? `CLOSES: ${market.closeDate.toISOString().split('T')[0]}` : ''}

${newsContext ? `RECENT NEWS CONTEXT:\n${newsContext}\n` : ''}

Analyze the specific evidence for this question. List:
1. Factors suggesting YES (bullish)
2. Factors suggesting NO (bearish)
3. What makes this case unique (different from base rates)

Respond in JSON format:
{
  "bullishFactors": [
    { "factor": "Brief description", "weight": "weak|moderate|strong", "source": "optional source" }
  ],
  "bearishFactors": [
    { "factor": "Brief description", "weight": "weak|moderate|strong", "source": "optional source" }
  ],
  "netDirection": "bullish|bearish|neutral",
  "insideAdjustment": -0.15 to +0.15,
  "uniqueFactors": ["What makes this case different from typical base rate"]
}

Guidelines:
- Be specific and factual
- Weight factors appropriately (most should be moderate)
- Consider recency and reliability of evidence
- insideAdjustment: how much to shift from base rate based on specifics`;

  try {
    const response = await llmChat({
      system: 'You are an expert forecaster who carefully weighs evidence for predictions.',
      user: prompt,
      maxTokens: 800,
      temperature: 0.3,
      quality: 'smart',
    });

    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Convert to typed format
    const bullishFactors: EvidenceFactor[] = (parsed.bullishFactors || []).map((f: any) => ({
      factor: f.factor,
      source: f.source,
      weight: f.weight || 'moderate',
      direction: 'bullish' as const,
      confidence: f.weight === 'strong' ? 0.8 : f.weight === 'moderate' ? 0.6 : 0.4,
    }));

    const bearishFactors: EvidenceFactor[] = (parsed.bearishFactors || []).map((f: any) => ({
      factor: f.factor,
      source: f.source,
      weight: f.weight || 'moderate',
      direction: 'bearish' as const,
      confidence: f.weight === 'strong' ? 0.8 : f.weight === 'moderate' ? 0.6 : 0.4,
    }));

    return {
      bullishFactors,
      bearishFactors,
      netDirection: parsed.netDirection || 'neutral',
      insideAdjustment: Math.max(-0.3, Math.min(0.3, parsed.insideAdjustment || 0)),
      uniqueFactors: parsed.uniqueFactors || [],
    };
  } catch (error) {
    console.error('[Evidence] LLM evidence gathering failed:', error);

    // Minimal fallback
    return {
      bullishFactors: [],
      bearishFactors: [],
      netDirection: 'neutral',
      insideAdjustment: 0,
      uniqueFactors: [],
    };
  }
}

// =============================================================================
// MAIN EXPORT
// =============================================================================

/**
 * Gather all evidence for a market
 */
export async function gatherEvidence(
  market: UnifiedMarket,
  options?: {
    includeNews?: boolean;
    maxNewsSources?: number;
  }
): Promise<InsideViewAnalysis> {
  const includeNews = options?.includeNews ?? true;
  const maxNews = options?.maxNewsSources ?? 5;

  // Gather news evidence if enabled
  let newsContext = '';
  const newsFactors: EvidenceFactor[] = [];

  if (includeNews && searchAvailable) {
    const news = await gatherNewsEvidence(market.question, maxNews);
    newsFactors.push(...news);

    // Build context string for LLM
    if (news.length > 0) {
      newsContext = news.map(n => `- ${n.factor} (${n.source})`).join('\n');
    }
  }

  // Use LLM for comprehensive evidence analysis
  const llmEvidence = await gatherLLMEvidence(market, newsContext);

  // Merge news factors with LLM factors
  const allBullish = [
    ...newsFactors.filter(f => f.direction === 'bullish'),
    ...llmEvidence.bullishFactors,
  ];

  const allBearish = [
    ...newsFactors.filter(f => f.direction === 'bearish'),
    ...llmEvidence.bearishFactors,
  ];

  // Deduplicate (simple approach)
  const seenBullish = new Set<string>();
  const dedupedBullish = allBullish.filter(f => {
    const key = f.factor.toLowerCase().slice(0, 30);
    if (seenBullish.has(key)) return false;
    seenBullish.add(key);
    return true;
  });

  const seenBearish = new Set<string>();
  const dedupedBearish = allBearish.filter(f => {
    const key = f.factor.toLowerCase().slice(0, 30);
    if (seenBearish.has(key)) return false;
    seenBearish.add(key);
    return true;
  });

  return {
    bullishFactors: dedupedBullish.slice(0, 5),
    bearishFactors: dedupedBearish.slice(0, 5),
    netDirection: llmEvidence.netDirection,
    insideAdjustment: llmEvidence.insideAdjustment,
    uniqueFactors: llmEvidence.uniqueFactors,
  };
}

/**
 * Quick evidence summary (no LLM, just news)
 */
export async function quickEvidence(
  question: string
): Promise<EvidenceFactor[]> {
  return gatherNewsEvidence(question, 3);
}

export default {
  gatherEvidence,
  quickEvidence,
};
