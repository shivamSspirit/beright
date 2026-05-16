/**
 * Rule-Based Fallback Classifier
 *
 * Used when LLM classification is unavailable or rate-limited.
 * Provides reasonable classification using pre-computed scores
 * and keyword-based heuristics.
 *
 * @author BeRight Protocol
 */

import { ClassificationInput, ClassificationResult, MatchRelationType } from './types';

// =============================================================================
// OPPOSITE DETECTION PATTERNS
// =============================================================================

/**
 * Patterns that indicate opposite outcomes
 */
const OPPOSITE_PATTERNS: Array<{ positive: string | RegExp; negative: string | RegExp }> = [
  { positive: /\byes\b/i, negative: /\bno\b/i },
  { positive: /\bwill\b/i, negative: /\bwon't\b|will not\b/i },
  { positive: /\babove\b/i, negative: /\bbelow\b/i },
  { positive: /\bover\b/i, negative: /\bunder\b/i },
  { positive: /\bwin\b/i, negative: /\blose\b/i },
  { positive: /\bpass\b/i, negative: /\bfail\b/i },
  { positive: /\bapprove\b/i, negative: /\breject\b/i },
  { positive: /\bincrease\b/i, negative: /\bdecrease\b/i },
  { positive: /\brise\b/i, negative: /\bfall\b/i },
  { positive: /\bdemocrat/i, negative: /\brepublican/i },
  { positive: /\bbullish\b/i, negative: /\bbearish\b/i },
];

/**
 * Check if two questions have opposite indicators
 */
function detectOppositeIndicators(questionA: string, questionB: string): {
  isOpposite: boolean;
  indicator?: string;
} {
  const lowerA = questionA.toLowerCase();
  const lowerB = questionB.toLowerCase();

  for (const { positive, negative } of OPPOSITE_PATTERNS) {
    const aHasPositive = typeof positive === 'string'
      ? lowerA.includes(positive)
      : positive.test(lowerA);
    const aHasNegative = typeof negative === 'string'
      ? lowerA.includes(negative)
      : negative.test(lowerA);
    const bHasPositive = typeof positive === 'string'
      ? lowerB.includes(positive)
      : positive.test(lowerB);
    const bHasNegative = typeof negative === 'string'
      ? lowerB.includes(negative)
      : negative.test(lowerB);

    // A has positive, B has negative (and not vice versa)
    if (aHasPositive && !aHasNegative && bHasNegative && !bHasPositive) {
      const posStr = typeof positive === 'string' ? positive : positive.source;
      const negStr = typeof negative === 'string' ? negative : negative.source;
      return { isOpposite: true, indicator: `${posStr}/${negStr}` };
    }

    // A has negative, B has positive
    if (aHasNegative && !aHasPositive && bHasPositive && !bHasNegative) {
      const posStr = typeof positive === 'string' ? positive : positive.source;
      const negStr = typeof negative === 'string' ? negative : negative.source;
      return { isOpposite: true, indicator: `${negStr}/${posStr}` };
    }
  }

  return { isOpposite: false };
}

// =============================================================================
// THRESHOLD DETECTION
// =============================================================================

/**
 * Extract numeric thresholds from text
 */
function extractThresholds(text: string): number[] {
  const thresholds: number[] = [];

  // Match patterns like "$100K", "100,000", "50%", "3.5%"
  const patterns = [
    /\$(\d+(?:,\d{3})*(?:\.\d+)?)\s*([KMB])?/gi,     // Currency
    /(\d+(?:,\d{3})*(?:\.\d+)?)\s*%/gi,              // Percentages
    /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:bps|basis)/gi,  // Basis points
    /(?:above|below|over|under|>\s*|<\s*)(\d+(?:,\d{3})*(?:\.\d+)?)/gi, // Comparisons
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      let value = parseFloat(match[1].replace(/,/g, ''));
      const multiplier = match[2]?.toUpperCase();

      if (multiplier === 'K') value *= 1000;
      else if (multiplier === 'M') value *= 1000000;
      else if (multiplier === 'B') value *= 1000000000;

      thresholds.push(value);
    }
  }

  return thresholds;
}

/**
 * Check if thresholds are similar
 */
function areThresholdsSimilar(thresholdsA: number[], thresholdsB: number[]): boolean {
  if (thresholdsA.length === 0 || thresholdsB.length === 0) {
    return true; // Can't determine, assume similar
  }

  // Check if any thresholds are within 5% of each other
  for (const a of thresholdsA) {
    for (const b of thresholdsB) {
      const diff = Math.abs(a - b) / Math.max(a, b);
      if (diff < 0.05) {
        return true;
      }
    }
  }

  return false;
}

// =============================================================================
// MAIN FALLBACK CLASSIFIER
// =============================================================================

/**
 * Rule-based fallback classifier
 */
export function classifyWithRules(
  input: ClassificationInput
): Omit<ClassificationResult, 'processingTimeMs' | 'model' | 'cached'> {
  const { marketA, marketB, preScore } = input;
  const questionA = marketA.question;
  const questionB = marketB.question;

  // Check for opposite indicators first
  const oppositeCheck = detectOppositeIndicators(questionA, questionB);
  if (oppositeCheck.isOpposite) {
    // Verify with similarity scores - opposites should still be about the same topic
    if (preScore.embeddingSimilarity > 0.75 && preScore.entityOverlap > 0.60) {
      return {
        type: 'opposite',
        confidence: 85,
        reasoning: `Detected opposite indicators: "${oppositeCheck.indicator}" with high topic similarity`,
        resolutionMatch: false,
        dateMatch: preScore.dateAlignment > 0.90,
      };
    }
  }

  // Calculate overall score
  const overallScore =
    0.40 * preScore.embeddingSimilarity +
    0.30 * preScore.entityOverlap +
    0.30 * preScore.dateAlignment;

  // Check thresholds for exact match validation
  const thresholdsA = extractThresholds(questionA);
  const thresholdsB = extractThresholds(questionB);
  const thresholdsSimilar = areThresholdsSimilar(thresholdsA, thresholdsB);

  // High similarity with matching dates and thresholds = exact
  if (overallScore > 0.90 && preScore.dateAlignment > 0.95 && thresholdsSimilar) {
    return {
      type: 'exact',
      confidence: Math.round(overallScore * 100),
      reasoning: 'High embedding, entity, and date alignment with similar thresholds',
      resolutionMatch: true,
      dateMatch: true,
    };
  }

  // High similarity but dates differ = related
  if (overallScore > 0.85 && preScore.dateAlignment < 0.50) {
    return {
      type: 'related',
      confidence: Math.round(overallScore * 80),
      reasoning: 'Similar topic but different timeframes',
      resolutionMatch: false,
      dateMatch: false,
    };
  }

  // High similarity but thresholds differ = related
  if (overallScore > 0.85 && !thresholdsSimilar) {
    return {
      type: 'related',
      confidence: Math.round(overallScore * 75),
      reasoning: 'Similar topic but different thresholds/targets',
      resolutionMatch: false,
      dateMatch: preScore.dateAlignment > 0.90,
    };
  }

  // Good similarity = likely exact or related
  if (overallScore > 0.80) {
    // Default to related if not confident about exact
    if (preScore.embeddingSimilarity > 0.90 && preScore.entityOverlap > 0.80) {
      return {
        type: 'exact',
        confidence: Math.round(overallScore * 95),
        reasoning: 'Very high similarity across all dimensions',
        resolutionMatch: true,
        dateMatch: preScore.dateAlignment > 0.90,
      };
    }

    return {
      type: 'related',
      confidence: Math.round(overallScore * 90),
      reasoning: 'High similarity but insufficient confidence for exact match',
      resolutionMatch: false,
      dateMatch: preScore.dateAlignment > 0.90,
    };
  }

  // Moderate similarity = related
  if (overallScore > 0.65) {
    return {
      type: 'related',
      confidence: Math.round(overallScore * 85),
      reasoning: 'Moderate similarity suggests related but distinct events',
      resolutionMatch: false,
      dateMatch: preScore.dateAlignment > 0.90,
    };
  }

  // Low similarity with some entity overlap = possibly related
  if (overallScore > 0.50 && preScore.entityOverlap > 0.40) {
    return {
      type: 'related',
      confidence: Math.round(overallScore * 70),
      reasoning: 'Some shared entities suggest weak relation',
      resolutionMatch: false,
      dateMatch: preScore.dateAlignment > 0.90,
    };
  }

  // Default to unrelated
  return {
    type: 'unrelated',
    confidence: Math.round((1 - overallScore) * 100),
    reasoning: 'Low similarity across dimensions',
    resolutionMatch: false,
    dateMatch: false,
  };
}

/**
 * Quick pre-filter to skip obvious non-matches
 * Returns true if the pair should be classified, false to skip
 */
export function shouldClassify(preScore: ClassificationInput['preScore']): boolean {
  // Skip if embedding similarity is very low
  if (preScore.embeddingSimilarity < 0.50) {
    return false;
  }

  // Skip if no entity overlap and low similarity
  if (preScore.entityOverlap < 0.20 && preScore.embeddingSimilarity < 0.70) {
    return false;
  }

  return true;
}
