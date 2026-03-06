/**
 * Superforecaster Engine
 *
 * Main analysis engine implementing Philip Tetlock's methodology.
 * Combines outside view (base rates) with inside view (specific evidence).
 *
 * @author BeRight Protocol
 */

import {
  AnalystOutput,
  QuickTake,
  OutsideViewAnalysis,
  InsideViewAnalysis,
  SynthesisAnalysis,
  TradingRecommendation,
  UncertaintyAnalysis,
  ConfidenceLevel,
  AnalysisRequest,
  calculateKelly,
  getConfidenceLevel,
  getAction,
  confidenceToScore,
} from './types';
import { UnifiedMarket } from '../dataFabric/types';
import { estimateBaseRate } from './baserates';
import { gatherEvidence } from './evidence';
import { llmChat } from '../llm';

// =============================================================================
// SYNTHESIS
// =============================================================================

/**
 * Synthesize outside and inside views into final probability
 */
function synthesizeViews(
  outsideView: OutsideViewAnalysis,
  insideView: InsideViewAnalysis,
  marketPrice: number
): SynthesisAnalysis {
  const chain: SynthesisAnalysis['probabilityChain'] = [];

  // Step 1: Start with base rate
  let probability = outsideView.baseRate;
  chain.push({
    step: 'Base Rate (Outside View)',
    value: probability,
    reasoning: `Reference class: ${outsideView.referenceClass}. Historical rate: ${(probability * 100).toFixed(0)}%`,
  });

  // Step 2: Apply inside view adjustment
  const adjustment = insideView.insideAdjustment;
  const adjustedProb = Math.max(0.01, Math.min(0.99, probability + adjustment));

  if (Math.abs(adjustment) > 0.01) {
    chain.push({
      step: 'Inside View Adjustment',
      value: adjustedProb,
      reasoning: `${adjustment > 0 ? 'Bullish' : 'Bearish'} evidence suggests ${adjustment > 0 ? '+' : ''}${(adjustment * 100).toFixed(0)}% adjustment. Net direction: ${insideView.netDirection}`,
    });
    probability = adjustedProb;
  }

  // Step 3: Consider market wisdom (regression toward market)
  // We don't fully trust our estimate - blend with market
  const outsideConfidence = confidenceToScore(outsideView.confidence);
  const blendWeight = Math.min(0.7, outsideConfidence); // Max 70% our view

  const blendedProb = probability * blendWeight + marketPrice * (1 - blendWeight);

  if (Math.abs(blendedProb - probability) > 0.01) {
    chain.push({
      step: 'Market Wisdom Blend',
      value: blendedProb,
      reasoning: `Blending our estimate (${(probability * 100).toFixed(0)}%) with market (${(marketPrice * 100).toFixed(0)}%) at ${(blendWeight * 100).toFixed(0)}% weight based on confidence`,
    });
    probability = blendedProb;
  }

  // Step 4: Extremize if high confidence with strong evidence
  const hasStrongEvidence =
    insideView.bullishFactors.some(f => f.weight === 'strong') ||
    insideView.bearishFactors.some(f => f.weight === 'strong');

  if (hasStrongEvidence && outsideConfidence >= 0.7) {
    // Push probability slightly toward extremes
    const direction = probability > 0.5 ? 1 : -1;
    const extremized = probability + direction * 0.03;
    const clampedExtreme = Math.max(0.02, Math.min(0.98, extremized));

    chain.push({
      step: 'Extremization (Strong Evidence)',
      value: clampedExtreme,
      reasoning: 'Strong evidence with high confidence warrants slight extremization',
    });
    probability = clampedExtreme;
  }

  // Final clamp
  probability = Math.max(0.01, Math.min(0.99, probability));

  // Generate synthesis reasoning
  const synthesisReasoning = generateSynthesisReasoning(outsideView, insideView, probability, marketPrice);

  return {
    method: 'Weighted synthesis: Base rate + Inside adjustment + Market blend',
    probabilityChain: chain,
    finalProbability: probability,
    synthesisReasoning,
  };
}

/**
 * Generate human-readable synthesis reasoning
 */
function generateSynthesisReasoning(
  outside: OutsideViewAnalysis,
  inside: InsideViewAnalysis,
  finalProb: number,
  marketPrice: number
): string {
  const parts: string[] = [];

  // Base rate context
  parts.push(
    `Starting from a base rate of ${(outside.baseRate * 100).toFixed(0)}% based on ${outside.referenceClass}.`
  );

  // Inside view summary
  const bullCount = inside.bullishFactors.length;
  const bearCount = inside.bearishFactors.length;

  if (bullCount > 0 || bearCount > 0) {
    parts.push(
      `Weighing ${bullCount} bullish and ${bearCount} bearish factors yields a ${inside.netDirection} inside view.`
    );
  }

  // Unique factors
  if (inside.uniqueFactors.length > 0) {
    parts.push(`Key differentiator: ${inside.uniqueFactors[0]}`);
  }

  // Edge assessment
  const edge = finalProb - marketPrice;
  if (Math.abs(edge) >= 0.03) {
    const direction = edge > 0 ? 'underpriced' : 'overpriced';
    parts.push(
      `Market appears ${direction} by ~${Math.abs(edge * 100).toFixed(0)} points.`
    );
  } else {
    parts.push('Market pricing appears approximately fair.');
  }

  return parts.join(' ');
}

// =============================================================================
// RECOMMENDATION
// =============================================================================

/**
 * Generate trading recommendation
 */
function generateRecommendation(
  finalProb: number,
  marketPrice: number,
  confidence: ConfidenceLevel,
  outsideView: OutsideViewAnalysis,
  insideView: InsideViewAnalysis
): TradingRecommendation {
  const edge = finalProb - marketPrice;
  const action = getAction(edge, confidence);

  // Determine direction
  let direction: 'YES' | 'NO' | null = null;
  if (edge > 0.02) {
    direction = 'YES';
  } else if (edge < -0.02) {
    direction = 'NO';
  }

  // Position sizing via Kelly
  const kellyFraction = calculateKelly(Math.abs(edge), direction === 'YES' ? marketPrice : 1 - marketPrice);
  const halfKelly = kellyFraction / 2;

  // Suggested size
  let suggestedSize: TradingRecommendation['suggestedSize'] = 'skip';
  if (halfKelly >= 0.15) suggestedSize = 'large';
  else if (halfKelly >= 0.08) suggestedSize = 'medium';
  else if (halfKelly >= 0.03) suggestedSize = 'small';

  // Entry/exit prices
  const entryPrice = marketPrice;
  const targetPrice = direction === 'YES'
    ? Math.min(0.95, marketPrice + Math.abs(edge) * 0.7)
    : Math.max(0.05, marketPrice - Math.abs(edge) * 0.7);
  const stopLoss = direction === 'YES'
    ? Math.max(0.02, marketPrice - 0.15)
    : Math.min(0.98, marketPrice + 0.15);

  // Generate reasoning
  const reasoning = generateRecommendationReasoning(action, edge, confidence, direction);
  const edgeExplanation = `Model: ${(finalProb * 100).toFixed(0)}% vs Market: ${(marketPrice * 100).toFixed(0)}%. Edge: ${edge > 0 ? '+' : ''}${(edge * 100).toFixed(1)}%`;

  // Warnings
  const warnings: string[] = [];

  if (confidence === 'low' || confidence === 'very_low') {
    warnings.push('Low confidence in analysis - consider smaller position');
  }

  if (outsideView.confidence === 'very_low') {
    warnings.push('Base rate estimate has low confidence');
  }

  if (insideView.bullishFactors.length === 0 && insideView.bearishFactors.length === 0) {
    warnings.push('Limited specific evidence available');
  }

  if (Math.abs(edge) > 0.2) {
    warnings.push('Large edge detected - verify market efficiency');
  }

  return {
    action,
    direction,
    suggestedSize,
    kellyFraction,
    halfKelly,
    entryPrice,
    targetPrice,
    stopLoss,
    reasoning,
    edgeExplanation,
    warnings,
  };
}

/**
 * Generate recommendation reasoning
 */
function generateRecommendationReasoning(
  action: TradingRecommendation['action'],
  edge: number,
  confidence: ConfidenceLevel,
  direction: 'YES' | 'NO' | null
): string {
  if (action === 'NO_TRADE') {
    if (Math.abs(edge) < 0.02) {
      return 'Insufficient edge for profitable trade after fees.';
    }
    return 'Low confidence prevents meaningful position.';
  }

  const strength = action.includes('STRONG') ? 'significant' : 'modest';
  const confStr = confidence === 'high' || confidence === 'very_high' ? 'high' : 'moderate';

  return `${strength} edge of ${Math.abs(edge * 100).toFixed(1)}% on ${direction} side with ${confStr} confidence supports ${action.toLowerCase().replace('_', ' ')}.`;
}

// =============================================================================
// UNCERTAINTY
// =============================================================================

/**
 * Analyze uncertainty and limitations
 */
async function analyzeUncertainty(
  market: UnifiedMarket,
  outsideView: OutsideViewAnalysis,
  insideView: InsideViewAnalysis,
  finalProb: number
): Promise<UncertaintyAnalysis> {
  // Known unknowns
  const knownUnknowns: string[] = [];

  if (market.closeDate) {
    const daysUntil = Math.ceil((market.closeDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntil > 30) {
      knownUnknowns.push(`${daysUntil} days until resolution - much can change`);
    }
  }

  if (outsideView.confidence === 'low' || outsideView.confidence === 'very_low') {
    knownUnknowns.push('Base rate estimation has limited historical data');
  }

  if (insideView.uniqueFactors.length > 0) {
    knownUnknowns.push(`Unique factors may not be fully captured: ${insideView.uniqueFactors[0]}`);
  }

  // Potential surprises (generic + category-specific)
  const potentialSurprises: UncertaintyAnalysis['potentialSurprises'] = [];

  if (market.category === 'politics') {
    potentialSurprises.push({
      event: 'Major scandal or controversy',
      impact: 'major',
      probability: 'possible',
    });
    potentialSurprises.push({
      event: 'Candidate withdrawal or health issue',
      impact: 'extreme',
      probability: 'unlikely',
    });
  } else if (market.category === 'crypto') {
    potentialSurprises.push({
      event: 'Regulatory announcement',
      impact: 'major',
      probability: 'possible',
    });
    potentialSurprises.push({
      event: 'Exchange hack or failure',
      impact: 'extreme',
      probability: 'unlikely',
    });
  } else if (market.category === 'sports') {
    potentialSurprises.push({
      event: 'Key player injury',
      impact: 'major',
      probability: 'possible',
    });
  }

  // Always add general surprise
  potentialSurprises.push({
    event: 'Unexpected event outside current model',
    impact: 'major',
    probability: 'unlikely',
  });

  // Model limitations
  const modelLimitations: string[] = [
    'Analysis based on publicly available information only',
    'Base rates may not perfectly match this specific scenario',
    'News sentiment analysis is simplistic',
    'No access to private order flow or insider information',
  ];

  // Contrarian check - generate steel man for opposite view
  const contrarian = await generateContrarianView(market, finalProb, insideView);

  // Confidence interval
  const spread = finalProb < 0.5 ? finalProb : 1 - finalProb;
  const uncertainty = Math.max(0.1, 0.3 - (outsideView.confidence === 'high' ? 0.1 : 0));

  const confidenceInterval = {
    low: Math.max(0.02, finalProb - uncertainty),
    mid: finalProb,
    high: Math.min(0.98, finalProb + uncertainty),
  };

  return {
    knownUnknowns,
    potentialSurprises,
    modelLimitations,
    contrarian,
    confidenceInterval,
  };
}

/**
 * Generate contrarian (steel man) view
 */
async function generateContrarianView(
  market: UnifiedMarket,
  ourProb: number,
  insideView: InsideViewAnalysis
): Promise<UncertaintyAnalysis['contrarian']> {
  // Use the opposite factors for steel man
  const oppositeFactors = ourProb > 0.5 ? insideView.bearishFactors : insideView.bullishFactors;

  if (oppositeFactors.length > 0) {
    const strongestOpposite = oppositeFactors
      .sort((a, b) => {
        const weights = { strong: 3, moderate: 2, weak: 1 };
        return weights[b.weight] - weights[a.weight];
      })[0];

    return {
      steelManOpposite: `Best case for ${ourProb > 0.5 ? 'NO' : 'YES'}: ${strongestOpposite.factor}`,
      whyWeDisagree: `While valid, our analysis weights other factors more heavily, particularly the base rate and net evidence direction.`,
    };
  }

  return {
    steelManOpposite: `Market may have information we don't - the ${ourProb > 0.5 ? 'NO' : 'YES'} side could know something.`,
    whyWeDisagree: 'Our systematic analysis of available evidence suggests otherwise.',
  };
}

// =============================================================================
// MAIN ANALYSIS FUNCTION
// =============================================================================

/**
 * Full superforecaster analysis of a market
 */
export async function analyze(
  market: UnifiedMarket,
  options?: {
    includeNews?: boolean;
    userContext?: string;
    priorBelief?: number;
  }
): Promise<AnalystOutput> {
  const startTime = Date.now();
  const sourcesUsed: string[] = [];

  // 1. Outside View - Base rate estimation
  const outsideView = await estimateBaseRate(market.question, market.category);
  sourcesUsed.push('base-rate-estimation');

  // 2. Inside View - Evidence gathering
  const insideView = await gatherEvidence(market, {
    includeNews: options?.includeNews ?? true,
  });

  if (insideView.bullishFactors.length > 0 || insideView.bearishFactors.length > 0) {
    sourcesUsed.push('evidence-gathering');
  }

  // 3. Synthesis
  const marketPrice = market.consensusPrice;
  const synthesis = synthesizeViews(outsideView, insideView, marketPrice);

  // Apply user prior if provided (Bayesian update)
  let finalProb = synthesis.finalProbability;
  if (options?.priorBelief !== undefined) {
    // Simple blend: 70% model, 30% user prior
    finalProb = finalProb * 0.7 + options.priorBelief * 0.3;
    finalProb = Math.max(0.01, Math.min(0.99, finalProb));
    sourcesUsed.push('user-prior');
  }

  // 4. Calculate edge and direction
  const edge = finalProb - marketPrice;
  const direction: 'YES' | 'NO' | 'NEUTRAL' =
    edge > 0.02 ? 'YES' : edge < -0.02 ? 'NO' : 'NEUTRAL';
  const confidence = getConfidenceLevel(finalProb);

  // 5. Trading recommendation
  const recommendation = generateRecommendation(
    finalProb,
    marketPrice,
    confidence,
    outsideView,
    insideView
  );

  // 6. Uncertainty analysis
  const uncertainty = await analyzeUncertainty(market, outsideView, insideView, finalProb);

  // 7. Assemble output
  const computeTimeMs = Date.now() - startTime;

  return {
    market: {
      id: market.id,
      question: market.question,
      category: market.category,
      closeDate: market.closeDate,
      url: market.platforms[0]?.url,
    },
    analyzedAt: new Date(),
    analysisVersion: '3.0.0',
    prediction: {
      probability: finalProb,
      marketPrice,
      edge,
      direction,
      confidence,
    },
    reasoning: {
      outsideView,
      insideView,
      synthesis,
    },
    recommendation,
    uncertainty,
    metadata: {
      dataPoints: insideView.bullishFactors.length + insideView.bearishFactors.length + 1,
      sourcesUsed,
      modelConfidence: confidenceToScore(confidence),
      computeTimeMs,
    },
  };
}

// =============================================================================
// QUICK TAKE
// =============================================================================

/**
 * Quick analysis (faster, less detailed)
 */
export async function quickTake(market: UnifiedMarket): Promise<QuickTake> {
  // Fast base rate lookup (no LLM)
  const baseRate = await estimateBaseRate(market.question, market.category);

  // Simple adjustment based on market consensus
  const marketPrice = market.consensusPrice;
  const baseAdjusted = baseRate.baseRate * 0.6 + marketPrice * 0.4;

  const probability = Math.max(0.01, Math.min(0.99, baseAdjusted));
  const edge = probability - marketPrice;
  const confidence = getConfidenceLevel(probability);

  // Direction
  const direction: 'YES' | 'NO' | 'NEUTRAL' =
    edge > 0.03 ? 'YES' : edge < -0.03 ? 'NO' : 'NEUTRAL';

  // One-liner
  let oneLiner: string;
  if (Math.abs(edge) < 0.02) {
    oneLiner = 'Market pricing appears fair';
  } else if (edge > 0) {
    oneLiner = `Market may underprice YES by ~${(edge * 100).toFixed(0)}%`;
  } else {
    oneLiner = `Market may overprice YES by ~${(Math.abs(edge) * 100).toFixed(0)}%`;
  }

  // Action
  let action: QuickTake['action'] = 'HOLD';
  if (edge > 0.05 && confidence !== 'very_low') action = 'BUY_YES';
  else if (edge < -0.05 && confidence !== 'very_low') action = 'BUY_NO';
  else if (Math.abs(edge) < 0.02) action = 'SKIP';

  return {
    market: {
      id: market.id,
      question: market.question,
    },
    probability,
    marketPrice,
    edge,
    direction,
    confidence,
    oneLiner,
    keyReason: baseRate.reasoning,
    action,
  };
}

// =============================================================================
// BATCH ANALYSIS
// =============================================================================

/**
 * Analyze multiple markets efficiently
 */
export async function batchAnalyze(
  markets: UnifiedMarket[],
  options?: {
    depth?: 'quick' | 'standard';
    maxConcurrent?: number;
  }
): Promise<(AnalystOutput | QuickTake)[]> {
  const depth = options?.depth ?? 'quick';
  const maxConcurrent = options?.maxConcurrent ?? 3;

  const results: (AnalystOutput | QuickTake)[] = [];

  // Process in batches to avoid overwhelming APIs
  for (let i = 0; i < markets.length; i += maxConcurrent) {
    const batch = markets.slice(i, i + maxConcurrent);

    const batchResults = await Promise.all(
      batch.map(market =>
        depth === 'quick' ? quickTake(market) : analyze(market)
      )
    );

    results.push(...batchResults);
  }

  return results;
}

export default {
  analyze,
  quickTake,
  batchAnalyze,
};
