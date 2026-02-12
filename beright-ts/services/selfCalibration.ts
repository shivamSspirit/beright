/**
 * Self-Calibration System
 *
 * Continuously monitors and adjusts prediction parameters:
 * - Tracks Brier scores over time
 * - Identifies systematic biases
 * - Adjusts confidence thresholds
 * - Learns from category performance
 * - Generates calibration reports
 *
 * Goal: Continuously improve prediction accuracy through data-driven adjustment
 */

import { EventEmitter } from 'events';
import { db } from '../lib/supabase/client';
import { generateLearnings, LearningPattern } from '../skills/learnings';
import { interpretBrierScore } from '../lib/onchain/memo';

// Types
interface CalibrationBucket {
  rangeMin: number;
  rangeMax: number;
  predictions: number;
  correctPredictions: number;
  actualRate: number;
  expectedRate: number; // midpoint of range
  calibrationError: number; // |actual - expected|
}

interface CategoryCalibration {
  category: string;
  predictions: number;
  avgBrier: number;
  accuracy: number;
  overconfidenceRate: number;
  underconfidenceRate: number;
  recommendation: 'increase_confidence' | 'decrease_confidence' | 'maintain' | 'avoid';
  adjustmentFactor: number; // Multiply confidence by this
}

interface CalibrationReport {
  timestamp: string;
  userId: string;
  analyzedPredictions: number;

  // Overall metrics
  overallBrier: number;
  overallAccuracy: number;
  qualityRating: string;

  // Calibration curve
  calibrationBuckets: CalibrationBucket[];
  calibrationScore: number; // 0-100, lower is better calibrated

  // Category analysis
  categoryCalibration: CategoryCalibration[];

  // Detected biases
  biases: {
    overconfidenceBias: number; // Positive = overconfident
    directionBias: number; // Positive = biased toward YES
    recentTrendBias: number; // Are we getting better or worse?
  };

  // Recommendations
  recommendations: string[];

  // Adjustments to apply
  suggestedAdjustments: {
    confidenceMultiplier: number;
    categoryAdjustments: Record<string, number>;
    avoidCategories: string[];
    focusCategories: string[];
  };
}

interface AdjustmentHistory {
  timestamp: string;
  type: 'confidence' | 'category' | 'threshold';
  before: number;
  after: number;
  reason: string;
}

// Configuration
const CALIBRATION_CONFIG = {
  // Minimum predictions needed for reliable calibration
  minPredictions: 20,

  // How often to run calibration (ms)
  calibrationIntervalMs: 6 * 60 * 60 * 1000, // 6 hours

  // Calibration bucket ranges
  bucketRanges: [
    { min: 0, max: 0.2 },
    { min: 0.2, max: 0.4 },
    { min: 0.4, max: 0.6 },
    { min: 0.6, max: 0.8 },
    { min: 0.8, max: 1.0 },
  ],

  // Threshold for considering a bias significant
  significantBiasThreshold: 0.10,

  // Maximum adjustment factor per calibration cycle
  maxAdjustmentFactor: 0.15,

  // Categories minimum predictions for analysis
  minCategoryPredictions: 5,
};

/**
 * Self-Calibration System
 */
export class SelfCalibrationSystem extends EventEmitter {
  private isRunning = false;
  private calibrationInterval: NodeJS.Timeout | null = null;
  private lastReport: CalibrationReport | null = null;
  private adjustmentHistory: AdjustmentHistory[] = [];
  private userId: string;

  // Current adjustments
  private currentAdjustments = {
    confidenceMultiplier: 1.0,
    categoryAdjustments: {} as Record<string, number>,
    avoidCategories: [] as string[],
    focusCategories: [] as string[],
  };

  constructor(userId: string) {
    super();
    this.userId = userId;
  }

  /**
   * Start the calibration system
   */
  start(): void {
    if (this.isRunning) {
      console.log('[Calibration] Already running');
      return;
    }

    console.log('[Calibration] Starting self-calibration system...');
    this.isRunning = true;

    // Initial calibration
    this.runCalibration();

    // Schedule periodic calibration
    this.calibrationInterval = setInterval(() => {
      this.runCalibration();
    }, CALIBRATION_CONFIG.calibrationIntervalMs);

    this.emit('started');
  }

  /**
   * Stop the calibration system
   */
  stop(): void {
    console.log('[Calibration] Stopping...');
    this.isRunning = false;

    if (this.calibrationInterval) {
      clearInterval(this.calibrationInterval);
      this.calibrationInterval = null;
    }

    this.emit('stopped');
  }

  /**
   * Run a calibration cycle
   */
  async runCalibration(): Promise<CalibrationReport | null> {
    console.log('[Calibration] Running calibration cycle...');

    try {
      // Get resolved predictions
      const predictions = await db.predictions.getByUser(this.userId);
      const resolved = predictions.filter(
        p => p.resolved_at !== null && p.brier_score !== null
      );

      if (resolved.length < CALIBRATION_CONFIG.minPredictions) {
        console.log(`[Calibration] Not enough data (${resolved.length}/${CALIBRATION_CONFIG.minPredictions})`);
        return null;
      }

      // Build calibration buckets
      const buckets = this.buildCalibrationBuckets(resolved);

      // Analyze by category
      const categoryCalibration = this.analyzeCategoryCalibration(resolved);

      // Detect biases
      const biases = this.detectBiases(resolved, buckets);

      // Calculate overall metrics
      const overallBrier = resolved.reduce((sum, p) => sum + (p.brier_score || 0), 0) / resolved.length;
      const correctPredictions = resolved.filter(p => {
        const predictedYes = p.direction === 'YES';
        return predictedYes === p.outcome;
      }).length;
      const overallAccuracy = correctPredictions / resolved.length;

      // Calculate calibration score (lower is better)
      const calibrationScore = this.calculateCalibrationScore(buckets);

      // Generate recommendations
      const recommendations = this.generateRecommendations(biases, categoryCalibration, calibrationScore);

      // Calculate suggested adjustments
      const suggestedAdjustments = this.calculateAdjustments(biases, categoryCalibration);

      const report: CalibrationReport = {
        timestamp: new Date().toISOString(),
        userId: this.userId,
        analyzedPredictions: resolved.length,
        overallBrier,
        overallAccuracy,
        qualityRating: interpretBrierScore(overallBrier).quality,
        calibrationBuckets: buckets,
        calibrationScore,
        categoryCalibration,
        biases,
        recommendations,
        suggestedAdjustments,
      };

      this.lastReport = report;

      // Apply adjustments
      this.applyAdjustments(suggestedAdjustments);

      console.log(`[Calibration] Complete. Brier: ${overallBrier.toFixed(4)}, Calibration: ${calibrationScore.toFixed(1)}/100`);
      this.emit('calibrationComplete', report);

      return report;
    } catch (err) {
      console.error('[Calibration] Error:', err);
      this.emit('error', err);
      return null;
    }
  }

  /**
   * Build calibration buckets from predictions
   */
  private buildCalibrationBuckets(predictions: any[]): CalibrationBucket[] {
    const buckets: CalibrationBucket[] = CALIBRATION_CONFIG.bucketRanges.map(range => ({
      rangeMin: range.min,
      rangeMax: range.max,
      predictions: 0,
      correctPredictions: 0,
      actualRate: 0,
      expectedRate: (range.min + range.max) / 2,
      calibrationError: 0,
    }));

    for (const pred of predictions) {
      // Normalize probability to YES probability
      let yesProb = pred.predicted_probability;
      if (pred.direction === 'NO') {
        yesProb = 1 - yesProb;
      }

      // Find bucket
      const bucket = buckets.find(
        b => yesProb >= b.rangeMin && yesProb < b.rangeMax
      );
      if (!bucket) continue;

      bucket.predictions++;
      if (pred.outcome === true) {
        bucket.correctPredictions++;
      }
    }

    // Calculate actual rates and errors
    for (const bucket of buckets) {
      if (bucket.predictions > 0) {
        bucket.actualRate = bucket.correctPredictions / bucket.predictions;
        bucket.calibrationError = Math.abs(bucket.actualRate - bucket.expectedRate);
      }
    }

    return buckets;
  }

  /**
   * Analyze calibration by category
   */
  private analyzeCategoryCalibration(predictions: any[]): CategoryCalibration[] {
    const categoryData: Record<string, {
      predictions: any[];
      briers: number[];
    }> = {};

    for (const pred of predictions) {
      const category = this.inferCategory(pred.question || '');
      if (!categoryData[category]) {
        categoryData[category] = { predictions: [], briers: [] };
      }
      categoryData[category].predictions.push(pred);
      if (pred.brier_score !== null) {
        categoryData[category].briers.push(pred.brier_score);
      }
    }

    const results: CategoryCalibration[] = [];

    for (const [category, data] of Object.entries(categoryData)) {
      if (data.predictions.length < CALIBRATION_CONFIG.minCategoryPredictions) {
        continue;
      }

      const avgBrier = data.briers.reduce((a, b) => a + b, 0) / data.briers.length;

      const correct = data.predictions.filter(p => {
        const predictedYes = p.direction === 'YES';
        return predictedYes === p.outcome;
      }).length;
      const accuracy = correct / data.predictions.length;

      // Analyze confidence patterns
      const highConfidenceWrong = data.predictions.filter(
        p => p.predicted_probability > 0.7 &&
          (p.direction === 'YES') !== p.outcome
      ).length;
      const lowConfidenceRight = data.predictions.filter(
        p => p.predicted_probability < 0.6 &&
          (p.direction === 'YES') === p.outcome
      ).length;

      const overconfidenceRate = highConfidenceWrong / data.predictions.length;
      const underconfidenceRate = lowConfidenceRight / data.predictions.length;

      // Determine recommendation
      let recommendation: CategoryCalibration['recommendation'] = 'maintain';
      let adjustmentFactor = 1.0;

      if (avgBrier > 0.30) {
        recommendation = 'avoid';
        adjustmentFactor = 0;
      } else if (overconfidenceRate > 0.20) {
        recommendation = 'decrease_confidence';
        adjustmentFactor = 0.85;
      } else if (underconfidenceRate > 0.30 && accuracy > 0.6) {
        recommendation = 'increase_confidence';
        adjustmentFactor = 1.15;
      }

      results.push({
        category,
        predictions: data.predictions.length,
        avgBrier,
        accuracy,
        overconfidenceRate,
        underconfidenceRate,
        recommendation,
        adjustmentFactor,
      });
    }

    return results.sort((a, b) => a.avgBrier - b.avgBrier);
  }

  /**
   * Detect systematic biases
   */
  private detectBiases(predictions: any[], buckets: CalibrationBucket[]): CalibrationReport['biases'] {
    // Overconfidence bias: Are high-confidence predictions less accurate than stated?
    let overconfidenceBias = 0;
    const highConfBucket = buckets.find(b => b.rangeMin >= 0.8);
    if (highConfBucket && highConfBucket.predictions > 5) {
      overconfidenceBias = highConfBucket.expectedRate - highConfBucket.actualRate;
    }

    // Direction bias: Do we predict YES more than NO?
    const yesPredictions = predictions.filter(p => p.direction === 'YES').length;
    const yesRate = yesPredictions / predictions.length;
    const actualYesRate = predictions.filter(p => p.outcome === true).length / predictions.length;
    const directionBias = yesRate - actualYesRate;

    // Recent trend: Compare recent vs older predictions
    const sorted = [...predictions].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const recentHalf = sorted.slice(0, Math.floor(sorted.length / 2));
    const olderHalf = sorted.slice(Math.floor(sorted.length / 2));

    const recentBrier = recentHalf.reduce((sum, p) => sum + (p.brier_score || 0), 0) / recentHalf.length;
    const olderBrier = olderHalf.reduce((sum, p) => sum + (p.brier_score || 0), 0) / olderHalf.length;
    const recentTrendBias = olderBrier - recentBrier; // Positive = improving

    return {
      overconfidenceBias,
      directionBias,
      recentTrendBias,
    };
  }

  /**
   * Calculate overall calibration score (0-100, lower is better)
   */
  private calculateCalibrationScore(buckets: CalibrationBucket[]): number {
    const bucketsWithData = buckets.filter(b => b.predictions >= 3);
    if (bucketsWithData.length === 0) return 50;

    const avgError = bucketsWithData.reduce(
      (sum, b) => sum + b.calibrationError * b.predictions,
      0
    ) / bucketsWithData.reduce((sum, b) => sum + b.predictions, 0);

    // Convert to 0-100 scale (0.5 max error = 100)
    return Math.min(100, avgError * 200);
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(
    biases: CalibrationReport['biases'],
    categoryCalibration: CategoryCalibration[],
    calibrationScore: number
  ): string[] {
    const recommendations: string[] = [];

    // Overconfidence recommendation
    if (biases.overconfidenceBias > CALIBRATION_CONFIG.significantBiasThreshold) {
      recommendations.push(
        `Reduce confidence on high-probability predictions by ${(biases.overconfidenceBias * 100).toFixed(0)}%`
      );
    }

    // Direction bias recommendation
    if (Math.abs(biases.directionBias) > CALIBRATION_CONFIG.significantBiasThreshold) {
      const direction = biases.directionBias > 0 ? 'YES' : 'NO';
      recommendations.push(
        `You predict ${direction} more often than outcomes warrant. Consider the opposite more.`
      );
    }

    // Trend recommendation
    if (biases.recentTrendBias > 0.05) {
      recommendations.push('Your recent predictions are improving! Keep up the current approach.');
    } else if (biases.recentTrendBias < -0.05) {
      recommendations.push('Recent predictions are worse than older ones. Review what changed.');
    }

    // Category recommendations
    const avoidCategories = categoryCalibration.filter(c => c.recommendation === 'avoid');
    if (avoidCategories.length > 0) {
      recommendations.push(
        `Consider avoiding: ${avoidCategories.map(c => c.category).join(', ')}`
      );
    }

    const focusCategories = categoryCalibration
      .filter(c => c.avgBrier < 0.15 && c.predictions >= 5)
      .slice(0, 3);
    if (focusCategories.length > 0) {
      recommendations.push(
        `Your strengths: ${focusCategories.map(c => c.category).join(', ')}`
      );
    }

    // Calibration score recommendation
    if (calibrationScore > 30) {
      recommendations.push('Work on calibration: your stated probabilities don\'t match outcomes.');
    } else if (calibrationScore < 15) {
      recommendations.push('Excellent calibration! Your probabilities are well-matched to outcomes.');
    }

    return recommendations;
  }

  /**
   * Calculate adjustment factors
   */
  private calculateAdjustments(
    biases: CalibrationReport['biases'],
    categoryCalibration: CategoryCalibration[]
  ): CalibrationReport['suggestedAdjustments'] {
    // Global confidence multiplier
    let confidenceMultiplier = 1.0;
    if (biases.overconfidenceBias > CALIBRATION_CONFIG.significantBiasThreshold) {
      confidenceMultiplier = Math.max(
        1 - CALIBRATION_CONFIG.maxAdjustmentFactor,
        1 - biases.overconfidenceBias
      );
    }

    // Category adjustments
    const categoryAdjustments: Record<string, number> = {};
    for (const cat of categoryCalibration) {
      if (cat.adjustmentFactor !== 1.0) {
        categoryAdjustments[cat.category] = cat.adjustmentFactor;
      }
    }

    // Categories to avoid/focus
    const avoidCategories = categoryCalibration
      .filter(c => c.recommendation === 'avoid')
      .map(c => c.category);

    const focusCategories = categoryCalibration
      .filter(c => c.avgBrier < 0.15 && c.accuracy > 0.6)
      .map(c => c.category);

    return {
      confidenceMultiplier,
      categoryAdjustments,
      avoidCategories,
      focusCategories,
    };
  }

  /**
   * Apply adjustments (gradually)
   */
  private applyAdjustments(adjustments: CalibrationReport['suggestedAdjustments']): void {
    // Gradually move toward suggested adjustments
    const blendFactor = 0.3; // 30% of the way toward new value

    // Confidence multiplier
    const oldConfidence = this.currentAdjustments.confidenceMultiplier;
    this.currentAdjustments.confidenceMultiplier =
      oldConfidence * (1 - blendFactor) + adjustments.confidenceMultiplier * blendFactor;

    if (Math.abs(oldConfidence - this.currentAdjustments.confidenceMultiplier) > 0.01) {
      this.adjustmentHistory.push({
        timestamp: new Date().toISOString(),
        type: 'confidence',
        before: oldConfidence,
        after: this.currentAdjustments.confidenceMultiplier,
        reason: 'Calibration adjustment',
      });
    }

    // Category adjustments
    for (const [category, factor] of Object.entries(adjustments.categoryAdjustments)) {
      const oldFactor = this.currentAdjustments.categoryAdjustments[category] || 1.0;
      this.currentAdjustments.categoryAdjustments[category] =
        oldFactor * (1 - blendFactor) + factor * blendFactor;
    }

    // Avoid/focus categories (update directly)
    this.currentAdjustments.avoidCategories = adjustments.avoidCategories;
    this.currentAdjustments.focusCategories = adjustments.focusCategories;

    console.log(`[Calibration] Applied adjustments. Confidence multiplier: ${this.currentAdjustments.confidenceMultiplier.toFixed(3)}`);
  }

  /**
   * Get current adjustments
   */
  getAdjustments(): typeof this.currentAdjustments {
    return { ...this.currentAdjustments };
  }

  /**
   * Apply adjustments to a probability
   */
  adjustProbability(probability: number, category?: string): number {
    let adjusted = probability;

    // Apply global confidence multiplier
    // Move probability toward 0.5 based on multiplier
    const distance = probability - 0.5;
    adjusted = 0.5 + distance * this.currentAdjustments.confidenceMultiplier;

    // Apply category adjustment
    if (category && this.currentAdjustments.categoryAdjustments[category]) {
      const catFactor = this.currentAdjustments.categoryAdjustments[category];
      const catDistance = adjusted - 0.5;
      adjusted = 0.5 + catDistance * catFactor;
    }

    // Clamp to valid range
    return Math.max(0.01, Math.min(0.99, adjusted));
  }

  /**
   * Check if a category should be avoided
   */
  shouldAvoidCategory(category: string): boolean {
    return this.currentAdjustments.avoidCategories.includes(category);
  }

  /**
   * Check if a category is a strength
   */
  isFocusCategory(category: string): boolean {
    return this.currentAdjustments.focusCategories.includes(category);
  }

  /**
   * Infer category from question
   */
  private inferCategory(question: string): string {
    const lower = question.toLowerCase();

    if (lower.match(/bitcoin|btc|ethereum|eth|crypto|solana|sol|defi/)) return 'crypto';
    if (lower.match(/president|election|congress|senate|vote|trump|biden|democrat|republican/)) return 'politics';
    if (lower.match(/fed|inflation|gdp|unemployment|recession|economy|rates|cpi/)) return 'economics';
    if (lower.match(/nfl|nba|mlb|nhl|championship|playoff|super bowl|world cup/)) return 'sports';
    if (lower.match(/ai|openai|chatgpt|google|apple|microsoft|nvidia|tech|ipo/)) return 'tech';
    if (lower.match(/climate|weather|hurricane|earthquake|temperature/)) return 'climate';
    if (lower.match(/war|military|conflict|ukraine|russia|china|taiwan/)) return 'geopolitics';

    return 'general';
  }

  /**
   * Get last calibration report
   */
  getLastReport(): CalibrationReport | null {
    return this.lastReport;
  }

  /**
   * Get adjustment history
   */
  getHistory(): AdjustmentHistory[] {
    return [...this.adjustmentHistory];
  }

  /**
   * Get status
   */
  getStatus(): {
    isRunning: boolean;
    lastCalibration?: string;
    currentMultiplier: number;
    avoidCategories: string[];
    focusCategories: string[];
  } {
    return {
      isRunning: this.isRunning,
      lastCalibration: this.lastReport?.timestamp,
      currentMultiplier: this.currentAdjustments.confidenceMultiplier,
      avoidCategories: this.currentAdjustments.avoidCategories,
      focusCategories: this.currentAdjustments.focusCategories,
    };
  }
}

// Singleton
let calibrationInstance: SelfCalibrationSystem | null = null;

export function getCalibrationSystem(userId?: string): SelfCalibrationSystem {
  if (!calibrationInstance) {
    if (!userId) throw new Error('User ID required for first initialization');
    calibrationInstance = new SelfCalibrationSystem(userId);
  }
  return calibrationInstance;
}

// CLI
if (require.main === module) {
  const command = process.argv[2] || 'run';
  const userId = process.env.AUTONOMOUS_AGENT_USER_ID || 'autonomous-agent';

  const system = new SelfCalibrationSystem(userId);

  switch (command) {
    case 'daemon':
    case 'start':
      system.start();

      system.on('calibrationComplete', (report: CalibrationReport) => {
        console.log('\n📊 Calibration Report');
        console.log('═'.repeat(50));
        console.log(`Analyzed: ${report.analyzedPredictions} predictions`);
        console.log(`Brier Score: ${report.overallBrier.toFixed(4)} (${report.qualityRating})`);
        console.log(`Calibration Score: ${report.calibrationScore.toFixed(1)}/100`);
        console.log(`\nRecommendations:`);
        for (const rec of report.recommendations) {
          console.log(`  • ${rec}`);
        }
      });

      process.on('SIGINT', () => {
        system.stop();
        process.exit(0);
      });
      break;

    case 'run':
    case 'once':
    default:
      system.runCalibration().then(report => {
        if (!report) {
          console.log('Not enough data for calibration');
          process.exit(1);
        }

        console.log('\n📊 Calibration Report');
        console.log('═'.repeat(50));
        console.log(`Analyzed: ${report.analyzedPredictions} predictions`);
        console.log(`Overall Brier: ${report.overallBrier.toFixed(4)} (${report.qualityRating})`);
        console.log(`Overall Accuracy: ${(report.overallAccuracy * 100).toFixed(1)}%`);
        console.log(`Calibration Score: ${report.calibrationScore.toFixed(1)}/100`);

        console.log(`\n📈 Calibration Buckets:`);
        for (const bucket of report.calibrationBuckets) {
          if (bucket.predictions > 0) {
            console.log(`  ${(bucket.rangeMin * 100).toFixed(0)}-${(bucket.rangeMax * 100).toFixed(0)}%: ${bucket.predictions} predictions, ${(bucket.actualRate * 100).toFixed(1)}% actual (error: ${(bucket.calibrationError * 100).toFixed(1)}%)`);
          }
        }

        console.log(`\n🎯 Category Performance:`);
        for (const cat of report.categoryCalibration.slice(0, 5)) {
          console.log(`  ${cat.category}: Brier ${cat.avgBrier.toFixed(4)}, ${(cat.accuracy * 100).toFixed(0)}% accuracy → ${cat.recommendation}`);
        }

        console.log(`\n⚠️ Biases:`);
        console.log(`  Overconfidence: ${(report.biases.overconfidenceBias * 100).toFixed(1)}%`);
        console.log(`  Direction (YES bias): ${(report.biases.directionBias * 100).toFixed(1)}%`);
        console.log(`  Recent trend: ${report.biases.recentTrendBias > 0 ? 'Improving' : 'Declining'}`);

        console.log(`\n💡 Recommendations:`);
        for (const rec of report.recommendations) {
          console.log(`  • ${rec}`);
        }

        console.log(`\n🔧 Suggested Adjustments:`);
        console.log(`  Confidence multiplier: ${report.suggestedAdjustments.confidenceMultiplier.toFixed(3)}`);
        if (report.suggestedAdjustments.avoidCategories.length > 0) {
          console.log(`  Avoid: ${report.suggestedAdjustments.avoidCategories.join(', ')}`);
        }
        if (report.suggestedAdjustments.focusCategories.length > 0) {
          console.log(`  Focus: ${report.suggestedAdjustments.focusCategories.join(', ')}`);
        }

        process.exit(0);
      }).catch(err => {
        console.error('Error:', err);
        process.exit(1);
      });
  }
}

export { CalibrationReport, CategoryCalibration, CalibrationBucket, CALIBRATION_CONFIG };
