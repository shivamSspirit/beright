/**
 * Portfolio Correlation Analysis
 *
 * Analyze correlations between positions to manage concentration risk.
 *
 * @author BeRight Protocol
 */

import {
  CorrelationPair,
  CorrelationMatrix,
  CorrelationCategory,
} from './types';
import { Position } from '../execution/types';
import { MarketCategory } from '../dataFabric/types';

// =============================================================================
// CORRELATION ANALYZER
// =============================================================================

/**
 * Analyze correlations between positions
 */
export class CorrelationAnalyzer {
  // Cache correlations
  private correlationCache: Map<string, CorrelationPair> = new Map();
  private readonly cacheExpiryMs = 3600000; // 1 hour

  // ==========================================================================
  // CORRELATION CALCULATION
  // ==========================================================================

  /**
   * Calculate correlation between two price series
   */
  calculateCorrelation(seriesA: number[], seriesB: number[]): number {
    const n = Math.min(seriesA.length, seriesB.length);
    if (n < 5) return 0; // Not enough data

    const meanA = seriesA.slice(0, n).reduce((a, b) => a + b, 0) / n;
    const meanB = seriesB.slice(0, n).reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denomA = 0;
    let denomB = 0;

    for (let i = 0; i < n; i++) {
      const devA = seriesA[i] - meanA;
      const devB = seriesB[i] - meanB;
      numerator += devA * devB;
      denomA += devA * devA;
      denomB += devB * devB;
    }

    const denominator = Math.sqrt(denomA * denomB);
    if (denominator === 0) return 0;

    return numerator / denominator;
  }

  /**
   * Estimate correlation based on market characteristics
   */
  estimateCorrelation(
    positionA: Position,
    positionB: Position
  ): CorrelationPair {
    const cacheKey = this.getCacheKey(positionA.marketId, positionB.marketId);
    const cached = this.correlationCache.get(cacheKey);

    if (cached && Date.now() - cached.lastUpdated.getTime() < this.cacheExpiryMs) {
      return cached;
    }

    const category = this.determineCategory(positionA, positionB);
    let correlation = 0;
    let confidence = 0.3; // Base confidence for estimation

    switch (category) {
      case 'same_event':
        // Same market on different platforms = highly correlated
        correlation = 0.95;
        confidence = 0.9;
        break;

      case 'related_event':
        // Related events = moderately correlated
        correlation = 0.5;
        confidence = 0.5;
        break;

      case 'same_category':
        // Same category = somewhat correlated
        correlation = 0.3;
        confidence = 0.4;
        break;

      case 'temporal':
        // Similar timeframes = slightly correlated
        correlation = 0.15;
        confidence = 0.3;
        break;

      default:
        // Unknown = assume slight positive correlation
        correlation = 0.1;
        confidence = 0.2;
    }

    const pair: CorrelationPair = {
      marketA: positionA.marketId,
      marketB: positionB.marketId,
      correlation,
      confidence,
      sampleSize: 0,
      lastUpdated: new Date(),
    };

    this.correlationCache.set(cacheKey, pair);
    return pair;
  }

  /**
   * Determine correlation category between two positions
   */
  private determineCategory(
    positionA: Position,
    positionB: Position
  ): CorrelationCategory {
    // Check if same event (different platforms)
    const questionA = positionA.marketQuestion.toLowerCase();
    const questionB = positionB.marketQuestion.toLowerCase();

    // Extract key terms
    const termsA = this.extractKeyTerms(questionA);
    const termsB = this.extractKeyTerms(questionB);

    const overlap = termsA.filter(t => termsB.includes(t)).length;
    const similarity = overlap / Math.max(termsA.length, termsB.length, 1);

    if (similarity > 0.7) {
      return 'same_event';
    }

    if (similarity > 0.3) {
      return 'related_event';
    }

    // Check temporal proximity
    if (positionA.marketCloseDate && positionB.marketCloseDate) {
      const daysDiff = Math.abs(
        positionA.marketCloseDate.getTime() - positionB.marketCloseDate.getTime()
      ) / (1000 * 60 * 60 * 24);

      if (daysDiff < 7) {
        return 'temporal';
      }
    }

    return 'unknown';
  }

  /**
   * Extract key terms from market question
   */
  private extractKeyTerms(question: string): string[] {
    const stopWords = new Set([
      'will', 'the', 'be', 'to', 'by', 'in', 'on', 'at', 'a', 'an',
      'of', 'for', 'with', 'this', 'that', 'before', 'after', 'above',
      'below', 'more', 'less', 'than', 'or', 'and', 'is', 'are', 'was',
      'were', 'has', 'have', 'had', 'do', 'does', 'did',
    ]);

    return question
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
  }

  /**
   * Get cache key for correlation pair
   */
  private getCacheKey(marketA: string, marketB: string): string {
    return [marketA, marketB].sort().join(':');
  }

  // ==========================================================================
  // PORTFOLIO ANALYSIS
  // ==========================================================================

  /**
   * Build correlation matrix for portfolio
   */
  buildCorrelationMatrix(positions: Position[]): CorrelationMatrix {
    const n = positions.length;
    const matrix: number[][] = [];
    const marketIds = positions.map(p => p.marketId);
    const pairs: CorrelationPair[] = [];

    // Initialize matrix
    for (let i = 0; i < n; i++) {
      matrix[i] = new Array(n).fill(0);
      matrix[i][i] = 1; // Self-correlation = 1
    }

    // Calculate pairwise correlations
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const pair = this.estimateCorrelation(positions[i], positions[j]);
        matrix[i][j] = pair.correlation;
        matrix[j][i] = pair.correlation;

        if (Math.abs(pair.correlation) > 0.5) {
          pairs.push(pair);
        }
      }
    }

    // Calculate average correlation
    let totalCorr = 0;
    let count = 0;
    let maxCorr = 0;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        totalCorr += Math.abs(matrix[i][j]);
        maxCorr = Math.max(maxCorr, Math.abs(matrix[i][j]));
        count++;
      }
    }

    const avgCorr = count > 0 ? totalCorr / count : 0;

    // Sort highly correlated pairs
    pairs.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

    return {
      marketIds,
      matrix,
      averageCorrelation: avgCorr,
      maxCorrelation: maxCorr,
      highlyCorrelatedPairs: pairs.slice(0, 10),
      generatedAt: new Date(),
    };
  }

  /**
   * Calculate effective diversification score
   */
  calculateDiversification(matrix: CorrelationMatrix): number {
    const n = matrix.marketIds.length;
    if (n <= 1) return 1;

    // Diversification = 1 - average correlation
    // Perfect diversification (uncorrelated) = 1
    // No diversification (fully correlated) = 0
    return Math.max(0, 1 - matrix.averageCorrelation);
  }

  /**
   * Get correlated exposure warnings
   */
  getCorrelatedExposureWarnings(
    positions: Position[],
    maxCorrelatedExposure: number
  ): Array<{
    positions: [Position, Position];
    correlation: number;
    combinedExposure: number;
    warning: string;
  }> {
    const warnings: Array<{
      positions: [Position, Position];
      correlation: number;
      combinedExposure: number;
      warning: string;
    }> = [];

    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const pair = this.estimateCorrelation(positions[i], positions[j]);

        if (pair.correlation > 0.5) {
          const combinedExposure = positions[i].costBasis + positions[j].costBasis;

          if (combinedExposure > maxCorrelatedExposure) {
            warnings.push({
              positions: [positions[i], positions[j]],
              correlation: pair.correlation,
              combinedExposure,
              warning: `Highly correlated positions (${(pair.correlation * 100).toFixed(0)}%) ` +
                       `with combined exposure $${combinedExposure.toFixed(0)} ` +
                       `exceeds limit $${maxCorrelatedExposure}`,
            });
          }
        }
      }
    }

    return warnings.sort((a, b) => b.combinedExposure - a.combinedExposure);
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let correlationAnalyzer: CorrelationAnalyzer | null = null;

export function getCorrelationAnalyzer(): CorrelationAnalyzer {
  if (!correlationAnalyzer) {
    correlationAnalyzer = new CorrelationAnalyzer();
  }
  return correlationAnalyzer;
}

export default CorrelationAnalyzer;
