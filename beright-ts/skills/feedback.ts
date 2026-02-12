/**
 * Calibration Feedback System
 *
 * Provides personalized performance analysis and improvement suggestions:
 * - Pattern detection (overconfidence, category weaknesses)
 * - Trend analysis (improving/declining)
 * - Actionable feedback
 * - Weekly summaries
 *
 * Goal: Help forecasters continuously improve their calibration
 */

import { SkillResponse } from '../types/index';
import { supabase, db } from '../lib/supabase/client';
import { interpretBrierScore } from '../lib/onchain/memo';

// Types
interface PredictionRecord {
  id: string;
  question: string;
  platform: string;
  predicted_probability: number;
  direction: 'YES' | 'NO';
  outcome: boolean | null;
  brier_score: number | null;
  created_at: string;
  resolved_at: string | null;
}

interface CalibrationBucket {
  range: string;
  count: number;
  expectedRate: number;
  actualRate: number;
  calibrationError: number;
}

interface PerformanceTrend {
  period: string;
  avgBrier: number;
  count: number;
  direction: 'improving' | 'stable' | 'declining';
}

interface FeedbackReport {
  // Overview
  totalPredictions: number;
  resolvedPredictions: number;
  avgBrierScore: number;
  tier: string;
  rank?: number;

  // Calibration
  calibrationBuckets: CalibrationBucket[];
  overconfidenceScore: number; // -1 (underconfident) to +1 (overconfident)
  calibrationGrade: 'A' | 'B' | 'C' | 'D' | 'F';

  // Trends
  trends: PerformanceTrend[];
  isImproving: boolean;

  // Patterns
  strongAreas: string[];
  weakAreas: string[];
  biasPatterns: string[];

  // Recommendations
  recommendations: string[];
  nextSteps: string[];

  // Achievements
  achievements: string[];
  streakInfo?: { type: 'win' | 'loss'; count: number };
}

/**
 * Calculate calibration buckets from predictions
 */
function calculateCalibrationBuckets(predictions: PredictionRecord[]): CalibrationBucket[] {
  const buckets: Map<string, { expected: number[]; actual: number[] }> = new Map();

  const ranges = [
    '0-10%', '10-20%', '20-30%', '30-40%', '40-50%',
    '50-60%', '60-70%', '70-80%', '80-90%', '90-100%'
  ];

  // Initialize buckets
  ranges.forEach(r => buckets.set(r, { expected: [], actual: [] }));

  for (const pred of predictions) {
    if (pred.outcome === null) continue;

    // Convert to YES probability
    const yesProb = pred.direction === 'YES'
      ? pred.predicted_probability
      : 1 - pred.predicted_probability;

    // Determine bucket
    const bucketIndex = Math.min(9, Math.floor(yesProb * 10));
    const range = ranges[bucketIndex];

    const bucket = buckets.get(range)!;
    bucket.expected.push(yesProb);
    bucket.actual.push(pred.outcome ? 1 : 0);
  }

  // Calculate stats for each bucket
  const result: CalibrationBucket[] = [];
  for (const [range, data] of buckets) {
    if (data.expected.length === 0) continue;

    const expectedRate = data.expected.reduce((a, b) => a + b, 0) / data.expected.length;
    const actualRate = data.actual.reduce((a, b) => a + b, 0) / data.actual.length;

    result.push({
      range,
      count: data.expected.length,
      expectedRate,
      actualRate,
      calibrationError: Math.abs(expectedRate - actualRate),
    });
  }

  return result;
}

/**
 * Calculate overconfidence score
 * Positive = overconfident, Negative = underconfident
 */
function calculateOverconfidenceScore(buckets: CalibrationBucket[]): number {
  let totalWeight = 0;
  let weightedError = 0;

  for (const bucket of buckets) {
    // Weight by count
    const weight = bucket.count;
    // Error direction: positive if actual < expected (overconfident)
    const directedError = bucket.expectedRate - bucket.actualRate;

    totalWeight += weight;
    weightedError += directedError * weight;
  }

  if (totalWeight === 0) return 0;
  return weightedError / totalWeight;
}

/**
 * Calculate performance trends over time
 */
function calculateTrends(predictions: PredictionRecord[]): PerformanceTrend[] {
  const resolved = predictions
    .filter(p => p.brier_score !== null)
    .sort((a, b) => new Date(a.resolved_at!).getTime() - new Date(b.resolved_at!).getTime());

  if (resolved.length < 5) return [];

  const trends: PerformanceTrend[] = [];

  // Split into thirds
  const chunkSize = Math.ceil(resolved.length / 3);
  const periods = ['Early', 'Middle', 'Recent'];

  let prevAvg: number | null = null;

  for (let i = 0; i < 3; i++) {
    const start = i * chunkSize;
    const end = Math.min((i + 1) * chunkSize, resolved.length);
    const chunk = resolved.slice(start, end);

    if (chunk.length === 0) continue;

    const avgBrier = chunk.reduce((sum, p) => sum + (p.brier_score || 0), 0) / chunk.length;

    let direction: 'improving' | 'stable' | 'declining' = 'stable';
    if (prevAvg !== null) {
      const diff = prevAvg - avgBrier; // Lower is better, so positive diff = improving
      if (diff > 0.03) direction = 'improving';
      else if (diff < -0.03) direction = 'declining';
    }

    trends.push({
      period: periods[i],
      avgBrier,
      count: chunk.length,
      direction,
    });

    prevAvg = avgBrier;
  }

  return trends;
}

/**
 * Detect bias patterns
 */
function detectBiasPatterns(predictions: PredictionRecord[]): string[] {
  const patterns: string[] = [];
  const resolved = predictions.filter(p => p.outcome !== null);

  if (resolved.length < 10) return patterns;

  // Check for "always YES" or "always NO" bias
  const yesPreds = resolved.filter(p => p.direction === 'YES').length;
  const yesRatio = yesPreds / resolved.length;
  if (yesRatio > 0.8) {
    patterns.push('Strong YES bias: You predict YES 80%+ of the time');
  } else if (yesRatio < 0.2) {
    patterns.push('Strong NO bias: You predict NO 80%+ of the time');
  }

  // Check for extreme probability usage
  const extremePreds = resolved.filter(p =>
    p.predicted_probability > 0.85 || p.predicted_probability < 0.15
  );
  const extremeRatio = extremePreds.length / resolved.length;
  const extremeCorrect = extremePreds.filter(p =>
    (p.direction === 'YES') === p.outcome
  ).length;
  const extremeAccuracy = extremePreds.length > 0 ? extremeCorrect / extremePreds.length : 0;

  if (extremeRatio > 0.3 && extremeAccuracy < 0.7) {
    patterns.push('Overuse of extreme probabilities: Using >85% or <15% too often without matching accuracy');
  }

  // Check for round number anchoring
  const roundProbs = resolved.filter(p =>
    [0.5, 0.6, 0.7, 0.8, 0.9, 0.25, 0.75].includes(p.predicted_probability)
  );
  if (roundProbs.length / resolved.length > 0.5) {
    patterns.push('Round number anchoring: Consider using more precise probabilities like 67% instead of 70%');
  }

  // Check recency of predictions
  const recentPreds = resolved.slice(-20);
  const recentBrier = recentPreds.reduce((sum, p) => sum + (p.brier_score || 0), 0) / recentPreds.length;
  const overallBrier = resolved.reduce((sum, p) => sum + (p.brier_score || 0), 0) / resolved.length;

  if (recentBrier > overallBrier + 0.05) {
    patterns.push('Recent decline: Your last 20 predictions are worse than average - consider taking a break or revisiting your process');
  }

  return patterns;
}

/**
 * Identify strong and weak areas by platform/category
 */
function identifyStrengthsWeaknesses(predictions: PredictionRecord[]): {
  strongAreas: string[];
  weakAreas: string[];
} {
  const resolved = predictions.filter(p => p.brier_score !== null);

  // Group by platform
  const platformStats: Map<string, { briers: number[]; count: number }> = new Map();

  for (const pred of resolved) {
    const platform = pred.platform || 'unknown';
    if (!platformStats.has(platform)) {
      platformStats.set(platform, { briers: [], count: 0 });
    }
    const stats = platformStats.get(platform)!;
    stats.briers.push(pred.brier_score!);
    stats.count++;
  }

  const ranked: Array<{ platform: string; avgBrier: number; count: number }> = [];
  for (const [platform, stats] of platformStats) {
    if (stats.count >= 5) { // Minimum sample size
      const avgBrier = stats.briers.reduce((a, b) => a + b, 0) / stats.count;
      ranked.push({ platform, avgBrier, count: stats.count });
    }
  }

  ranked.sort((a, b) => a.avgBrier - b.avgBrier);

  const strongAreas = ranked.slice(0, 2).map(r => `${r.platform} (${(r.avgBrier * 100).toFixed(1)} avg Brier)`);
  const weakAreas = ranked.slice(-2).reverse().map(r => `${r.platform} (${(r.avgBrier * 100).toFixed(1)} avg Brier)`);

  return { strongAreas, weakAreas };
}

/**
 * Generate personalized recommendations
 */
function generateRecommendations(report: Partial<FeedbackReport>): string[] {
  const recs: string[] = [];

  // Calibration recommendations
  if (report.overconfidenceScore && report.overconfidenceScore > 0.1) {
    recs.push('Reduce confidence on extreme predictions. When you think 85%, try 75%.');
  } else if (report.overconfidenceScore && report.overconfidenceScore < -0.1) {
    recs.push('Trust yourself more. When you think 60%, consider 65% if evidence is strong.');
  }

  // Trend recommendations
  if (report.trends && report.trends.length > 0) {
    const lastTrend = report.trends[report.trends.length - 1];
    if (lastTrend.direction === 'declining') {
      recs.push('Your accuracy has been declining. Review your recent misses for patterns.');
    } else if (lastTrend.direction === 'improving') {
      recs.push("Great improvement trajectory! Keep doing what you're doing.");
    }
  }

  // Weakness recommendations
  if (report.weakAreas && report.weakAreas.length > 0) {
    recs.push(`Focus on improving or avoiding ${report.weakAreas[0]} predictions.`);
  }

  // Calibration grade recommendations
  if (report.calibrationGrade) {
    switch (report.calibrationGrade) {
      case 'A':
        recs.push('Superforecaster level! Consider mentoring others or publishing your analysis.');
        break;
      case 'B':
        recs.push('Strong calibration. Focus on edge cases where you might be systematically wrong.');
        break;
      case 'C':
        recs.push('Good foundation. Study base rates more carefully before making predictions.');
        break;
      case 'D':
      case 'F':
        recs.push('Focus on the basics: check base rates, avoid extreme probabilities, update on new info.');
        break;
    }
  }

  // General recommendations
  if (recs.length < 3) {
    recs.push('Make predictions in areas where you have genuine knowledge or insight.');
    recs.push('Review each prediction 24h later to see if you should update.');
  }

  return recs.slice(0, 5);
}

/**
 * Detect achievements
 */
function detectAchievements(predictions: PredictionRecord[], avgBrier: number): string[] {
  const achievements: string[] = [];
  const resolved = predictions.filter(p => p.outcome !== null);

  // Perfect predictions
  const perfectPreds = resolved.filter(p => p.brier_score !== null && p.brier_score < 0.05);
  if (perfectPreds.length >= 5) {
    achievements.push('🎯 Sharpshooter: 5+ near-perfect predictions');
  }

  // Volume milestones
  if (resolved.length >= 100) {
    achievements.push('📊 Centurion: 100+ resolved predictions');
  } else if (resolved.length >= 50) {
    achievements.push('📈 Rising Star: 50+ resolved predictions');
  }

  // Calibration milestones
  if (avgBrier < 0.10) {
    achievements.push('🏆 Superforecaster Elite: Brier < 0.10');
  } else if (avgBrier < 0.15) {
    achievements.push('⭐ Superforecaster: Brier < 0.15');
  } else if (avgBrier < 0.20) {
    achievements.push('✨ Well-Calibrated: Brier < 0.20');
  }

  return achievements;
}

/**
 * Calculate streak
 */
function calculateStreak(predictions: PredictionRecord[]): { type: 'win' | 'loss'; count: number } | undefined {
  const resolved = predictions
    .filter(p => p.outcome !== null)
    .sort((a, b) => new Date(b.resolved_at!).getTime() - new Date(a.resolved_at!).getTime());

  if (resolved.length === 0) return undefined;

  let streak = 0;
  let streakType: 'win' | 'loss' | null = null;

  for (const pred of resolved) {
    const isWin = (pred.direction === 'YES') === pred.outcome;

    if (streakType === null) {
      streakType = isWin ? 'win' : 'loss';
      streak = 1;
    } else if ((streakType === 'win' && isWin) || (streakType === 'loss' && !isWin)) {
      streak++;
    } else {
      break;
    }
  }

  return streakType ? { type: streakType, count: streak } : undefined;
}

/**
 * Get calibration grade from average Brier
 */
function getCalibrationGrade(avgBrier: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (avgBrier < 0.10) return 'A';
  if (avgBrier < 0.18) return 'B';
  if (avgBrier < 0.25) return 'C';
  if (avgBrier < 0.35) return 'D';
  return 'F';
}

/**
 * Get tier from average Brier
 */
function getTier(avgBrier: number): string {
  if (avgBrier < 0.10) return 'Diamond';
  if (avgBrier < 0.15) return 'Platinum';
  if (avgBrier < 0.20) return 'Gold';
  if (avgBrier < 0.25) return 'Silver';
  return 'Bronze';
}

/**
 * Generate full feedback report for a user
 */
export async function generateFeedback(userId: string): Promise<FeedbackReport | null> {
  try {
    // Get user's predictions
    const { data: predictions, error } = await supabase
      .from('predictions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error || !predictions || predictions.length === 0) {
      return null;
    }

    const preds = predictions as PredictionRecord[];
    const resolved = preds.filter(p => p.brier_score !== null);

    if (resolved.length < 5) {
      return null;
    }

    const avgBrierScore = resolved.reduce((sum, p) => sum + (p.brier_score || 0), 0) / resolved.length;

    const calibrationBuckets = calculateCalibrationBuckets(preds);
    const overconfidenceScore = calculateOverconfidenceScore(calibrationBuckets);
    const trends = calculateTrends(preds);
    const biasPatterns = detectBiasPatterns(preds);
    const { strongAreas, weakAreas } = identifyStrengthsWeaknesses(preds);
    const achievements = detectAchievements(preds, avgBrierScore);
    const streakInfo = calculateStreak(preds);
    const calibrationGrade = getCalibrationGrade(avgBrierScore);
    const tier = getTier(avgBrierScore);

    const isImproving = trends.length > 0 && trends[trends.length - 1].direction === 'improving';

    const report: FeedbackReport = {
      totalPredictions: preds.length,
      resolvedPredictions: resolved.length,
      avgBrierScore,
      tier,
      calibrationBuckets,
      overconfidenceScore,
      calibrationGrade,
      trends,
      isImproving,
      strongAreas,
      weakAreas,
      biasPatterns,
      recommendations: [],
      nextSteps: [],
      achievements,
      streakInfo,
    };

    report.recommendations = generateRecommendations(report);
    report.nextSteps = [
      'Make 5 predictions this week',
      'Review your resolved predictions',
      'Check base rates before your next prediction',
    ];

    return report;
  } catch (err) {
    console.error('Error generating feedback:', err);
    return null;
  }
}

/**
 * Format feedback report as markdown
 */
function formatFeedbackReport(report: FeedbackReport): string {
  const brierInterpretation = interpretBrierScore(report.avgBrierScore);

  let output = `
📊 YOUR CALIBRATION REPORT
${'═'.repeat(50)}

🎖️ TIER: ${report.tier.toUpperCase()}
📈 Brier Score: ${report.avgBrierScore.toFixed(4)} (${brierInterpretation.description})
📊 Calibration Grade: ${report.calibrationGrade}
📋 Predictions: ${report.resolvedPredictions} resolved / ${report.totalPredictions} total

`;

  // Streak
  if (report.streakInfo) {
    const emoji = report.streakInfo.type === 'win' ? '🔥' : '❄️';
    output += `${emoji} Current Streak: ${report.streakInfo.count} ${report.streakInfo.type}s\n\n`;
  }

  // Achievements
  if (report.achievements.length > 0) {
    output += `🏆 ACHIEVEMENTS\n${'─'.repeat(40)}\n`;
    for (const achievement of report.achievements) {
      output += `${achievement}\n`;
    }
    output += '\n';
  }

  // Calibration Analysis
  output += `📉 CALIBRATION ANALYSIS\n${'─'.repeat(40)}\n`;
  if (report.overconfidenceScore > 0.1) {
    output += `⚠️ Tendency: OVERCONFIDENT (+${(report.overconfidenceScore * 100).toFixed(0)}%)\n`;
  } else if (report.overconfidenceScore < -0.1) {
    output += `⚠️ Tendency: UNDERCONFIDENT (${(report.overconfidenceScore * 100).toFixed(0)}%)\n`;
  } else {
    output += `✅ Well-calibrated (${(report.overconfidenceScore * 100).toFixed(1)}% deviation)\n`;
  }
  output += '\n';

  // Calibration buckets
  if (report.calibrationBuckets.length > 0) {
    output += `Calibration by Confidence:\n`;
    output += `Range      | Preds | Expected | Actual | Error\n`;
    output += `${'─'.repeat(50)}\n`;
    for (const bucket of report.calibrationBuckets) {
      output += `${bucket.range.padEnd(10)} | ${String(bucket.count).padEnd(5)} | ${(bucket.expectedRate * 100).toFixed(0).padEnd(8)}% | ${(bucket.actualRate * 100).toFixed(0).padEnd(6)}% | ${(bucket.calibrationError * 100).toFixed(1)}%\n`;
    }
    output += '\n';
  }

  // Trends
  if (report.trends.length > 0) {
    output += `📈 PERFORMANCE TREND\n${'─'.repeat(40)}\n`;
    for (const trend of report.trends) {
      const emoji = trend.direction === 'improving' ? '📈' : trend.direction === 'declining' ? '📉' : '➡️';
      output += `${trend.period}: ${trend.avgBrier.toFixed(3)} Brier (${trend.count} preds) ${emoji}\n`;
    }
    output += `Overall: ${report.isImproving ? '✅ Improving!' : 'Keep working at it!'}\n\n`;
  }

  // Strengths & Weaknesses
  if (report.strongAreas.length > 0 || report.weakAreas.length > 0) {
    output += `💪 STRENGTHS & WEAKNESSES\n${'─'.repeat(40)}\n`;
    if (report.strongAreas.length > 0) {
      output += `Strong: ${report.strongAreas.join(', ')}\n`;
    }
    if (report.weakAreas.length > 0) {
      output += `Weak: ${report.weakAreas.join(', ')}\n`;
    }
    output += '\n';
  }

  // Bias Patterns
  if (report.biasPatterns.length > 0) {
    output += `⚠️ BIAS PATTERNS DETECTED\n${'─'.repeat(40)}\n`;
    for (const pattern of report.biasPatterns) {
      output += `• ${pattern}\n`;
    }
    output += '\n';
  }

  // Recommendations
  if (report.recommendations.length > 0) {
    output += `💡 RECOMMENDATIONS\n${'─'.repeat(40)}\n`;
    for (const rec of report.recommendations) {
      output += `• ${rec}\n`;
    }
    output += '\n';
  }

  // Next Steps
  output += `📋 NEXT STEPS\n${'─'.repeat(40)}\n`;
  for (const step of report.nextSteps) {
    output += `□ ${step}\n`;
  }

  return output;
}

/**
 * Main skill function
 */
export async function feedback(userId: string): Promise<SkillResponse> {
  const report = await generateFeedback(userId);

  if (!report) {
    return {
      text: '❌ Not enough data yet. Make at least 5 predictions that have resolved to get feedback.',
      mood: 'NEUTRAL',
    };
  }

  const text = formatFeedbackReport(report);

  return {
    text,
    mood: report.isImproving ? 'BULLISH' : 'EDUCATIONAL',
    data: report,
  };
}

// CLI interface
if (require.main === module) {
  const userId = process.argv[2];

  if (!userId) {
    console.log('Usage: npx ts-node feedback.ts <user_id>');
    process.exit(1);
  }

  feedback(userId).then(result => {
    console.log(result.text);
  }).catch(console.error);
}
