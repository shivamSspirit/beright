/**
 * Calibration Tracking Skill for BeRight Protocol
 * Track predictions, calculate Brier scores, measure accuracy
 *
 * Brier Score: Mean squared error of probability estimates
 * - 0.0 = Perfect calibration
 * - 0.25 = Random guessing (50% predictions)
 * - 1.0 = Always wrong
 *
 * Good forecasters: < 0.2
 * Superforecasters: < 0.15
 */

import { SkillResponse } from '../types/index';
import * as fs from 'fs';
import * as path from 'path';

export interface Prediction {
  id: string;
  question: string;
  platform: string;
  marketUrl?: string;
  predictedProbability: number;  // 0-1
  direction: 'YES' | 'NO';
  confidence: 'low' | 'medium' | 'high';
  reasoning: string;
  createdAt: string;
  resolvesAt?: string;
  resolvedAt?: string;
  outcome?: boolean;  // true = YES, false = NO
  brierScore?: number;
  tags: string[];
}

interface CalibrationStats {
  totalPredictions: number;
  resolvedPredictions: number;
  pendingPredictions: number;
  overallBrierScore: number;
  accuracy: number;  // % of correct directional calls
  calibrationByBucket: CalibrationBucket[];
  performanceByPlatform: Record<string, PlatformStats>;
  performanceByTag: Record<string, number>;
  streak: {
    current: number;
    type: 'win' | 'loss' | 'none';
    best: number;
  };
}

interface CalibrationBucket {
  range: string;  // e.g., "60-70%"
  predictions: number;
  actualRate: number;  // Actual % that resolved YES
  expectedRate: number;  // Average predicted %
  calibrationError: number;  // |actual - expected|
}

interface PlatformStats {
  predictions: number;
  brierScore: number;
  accuracy: number;
}

const PREDICTIONS_FILE = 'memory/predictions.json';

/**
 * Load predictions from file
 */
function loadPredictions(): Prediction[] {
  try {
    const filePath = path.join(process.cwd(), PREDICTIONS_FILE);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (error) {
    console.error('Failed to load predictions:', error);
  }
  return [];
}

/**
 * Save predictions to file
 */
function savePredictions(predictions: Prediction[]): void {
  try {
    const filePath = path.join(process.cwd(), PREDICTIONS_FILE);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(predictions, null, 2));
  } catch (error) {
    console.error('Failed to save predictions:', error);
  }
}

/**
 * Calculate Brier score for a single prediction
 */
function calculateBrierScore(predictedProb: number, outcome: boolean): number {
  const actualOutcome = outcome ? 1 : 0;
  return Math.pow(predictedProb - actualOutcome, 2);
}

/**
 * Add a new prediction
 */
export function addPrediction(
  question: string,
  probability: number,
  direction: 'YES' | 'NO',
  reasoning: string,
  options: {
    platform?: string;
    marketUrl?: string;
    confidence?: 'low' | 'medium' | 'high';
    resolvesAt?: string;
    tags?: string[];
  } = {}
): Prediction {
  const predictions = loadPredictions();

  const prediction: Prediction = {
    id: `pred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    question,
    platform: options.platform || 'unknown',
    marketUrl: options.marketUrl,
    predictedProbability: Math.min(1, Math.max(0, probability)),
    direction,
    confidence: options.confidence || 'medium',
    reasoning,
    createdAt: new Date().toISOString(),
    resolvesAt: options.resolvesAt,
    tags: options.tags || [],
  };

  predictions.push(prediction);
  savePredictions(predictions);

  return prediction;
}

/**
 * Resolve a prediction with outcome
 */
export function resolvePrediction(
  predictionId: string,
  outcome: boolean
): Prediction | null {
  const predictions = loadPredictions();
  const index = predictions.findIndex(p => p.id === predictionId);

  if (index === -1) {
    console.error(`Prediction not found: ${predictionId}`);
    return null;
  }

  const prediction = predictions[index];
  prediction.outcome = outcome;
  prediction.resolvedAt = new Date().toISOString();

  // Calculate Brier score
  // If we predicted YES with 70%, and outcome is YES (true), Brier = (0.7 - 1)^2 = 0.09
  // If we predicted YES with 70%, and outcome is NO (false), Brier = (0.7 - 0)^2 = 0.49
  const probForYes = prediction.direction === 'YES'
    ? prediction.predictedProbability
    : 1 - prediction.predictedProbability;

  prediction.brierScore = calculateBrierScore(probForYes, outcome);

  predictions[index] = prediction;
  savePredictions(predictions);

  return prediction;
}

/**
 * Calculate calibration statistics
 */
export function getCalibrationStats(): CalibrationStats {
  const predictions = loadPredictions();
  const resolved = predictions.filter(p => p.outcome !== undefined);
  const pending = predictions.filter(p => p.outcome === undefined);

  // Overall Brier score
  const brierScores = resolved.map(p => p.brierScore || 0);
  const overallBrier = brierScores.length > 0
    ? brierScores.reduce((a, b) => a + b, 0) / brierScores.length
    : 0;

  // Directional accuracy
  const correctCalls = resolved.filter(p => {
    const predictedYes = p.direction === 'YES';
    return predictedYes === p.outcome;
  });
  const accuracy = resolved.length > 0
    ? correctCalls.length / resolved.length
    : 0;

  // Calibration by probability bucket
  const buckets: CalibrationBucket[] = [
    { range: '0-10%', predictions: 0, actualRate: 0, expectedRate: 0, calibrationError: 0 },
    { range: '10-20%', predictions: 0, actualRate: 0, expectedRate: 0, calibrationError: 0 },
    { range: '20-30%', predictions: 0, actualRate: 0, expectedRate: 0, calibrationError: 0 },
    { range: '30-40%', predictions: 0, actualRate: 0, expectedRate: 0, calibrationError: 0 },
    { range: '40-50%', predictions: 0, actualRate: 0, expectedRate: 0, calibrationError: 0 },
    { range: '50-60%', predictions: 0, actualRate: 0, expectedRate: 0, calibrationError: 0 },
    { range: '60-70%', predictions: 0, actualRate: 0, expectedRate: 0, calibrationError: 0 },
    { range: '70-80%', predictions: 0, actualRate: 0, expectedRate: 0, calibrationError: 0 },
    { range: '80-90%', predictions: 0, actualRate: 0, expectedRate: 0, calibrationError: 0 },
    { range: '90-100%', predictions: 0, actualRate: 0, expectedRate: 0, calibrationError: 0 },
  ];

  for (const p of resolved) {
    const prob = p.direction === 'YES' ? p.predictedProbability : 1 - p.predictedProbability;
    const bucketIndex = Math.min(9, Math.floor(prob * 10));
    buckets[bucketIndex].predictions++;
    buckets[bucketIndex].expectedRate += prob;
    if (p.outcome) buckets[bucketIndex].actualRate++;
  }

  // Calculate averages and calibration error
  for (const bucket of buckets) {
    if (bucket.predictions > 0) {
      bucket.expectedRate /= bucket.predictions;
      bucket.actualRate /= bucket.predictions;
      bucket.calibrationError = Math.abs(bucket.actualRate - bucket.expectedRate);
    }
  }

  // Performance by platform
  const platformStats: Record<string, PlatformStats> = {};
  for (const p of resolved) {
    if (!platformStats[p.platform]) {
      platformStats[p.platform] = { predictions: 0, brierScore: 0, accuracy: 0 };
    }
    platformStats[p.platform].predictions++;
    platformStats[p.platform].brierScore += p.brierScore || 0;
    if ((p.direction === 'YES') === p.outcome) {
      platformStats[p.platform].accuracy++;
    }
  }
  for (const platform in platformStats) {
    const stats = platformStats[platform];
    stats.brierScore /= stats.predictions;
    stats.accuracy /= stats.predictions;
  }

  // Performance by tag
  const tagStats: Record<string, number> = {};
  for (const p of resolved) {
    for (const tag of p.tags) {
      if (!tagStats[tag]) tagStats[tag] = 0;
      tagStats[tag] += p.brierScore || 0;
    }
  }

  // Calculate streak
  let currentStreak = 0;
  let streakType: 'win' | 'loss' | 'none' = 'none';
  let bestStreak = 0;

  const sortedResolved = [...resolved].sort(
    (a, b) => new Date(b.resolvedAt || 0).getTime() - new Date(a.resolvedAt || 0).getTime()
  );

  for (const p of sortedResolved) {
    const isWin = (p.direction === 'YES') === p.outcome;
    if (currentStreak === 0) {
      streakType = isWin ? 'win' : 'loss';
      currentStreak = 1;
    } else if ((streakType === 'win' && isWin) || (streakType === 'loss' && !isWin)) {
      currentStreak++;
    } else {
      break;
    }
    if (streakType === 'win' && currentStreak > bestStreak) {
      bestStreak = currentStreak;
    }
  }

  return {
    totalPredictions: predictions.length,
    resolvedPredictions: resolved.length,
    pendingPredictions: pending.length,
    overallBrierScore: overallBrier,
    accuracy,
    calibrationByBucket: buckets.filter(b => b.predictions > 0),
    performanceByPlatform: platformStats,
    performanceByTag: tagStats,
    streak: {
      current: currentStreak,
      type: streakType,
      best: bestStreak,
    },
  };
}

/**
 * Get calibration grade based on Brier score
 */
function getGrade(brierScore: number): { grade: string; emoji: string; description: string } {
  if (brierScore < 0.1) return { grade: 'S', emoji: '🏆', description: 'Superforecaster Elite' };
  if (brierScore < 0.15) return { grade: 'A', emoji: '⭐', description: 'Superforecaster' };
  if (brierScore < 0.2) return { grade: 'B', emoji: '✨', description: 'Very Good' };
  if (brierScore < 0.25) return { grade: 'C', emoji: '👍', description: 'Above Average' };
  if (brierScore < 0.3) return { grade: 'D', emoji: '📊', description: 'Average' };
  return { grade: 'F', emoji: '📉', description: 'Needs Improvement' };
}

/**
 * Format calibration report
 */
function formatCalibrationReport(stats: CalibrationStats): string {
  const grade = getGrade(stats.overallBrierScore);

  let report = `
🎯 BERIGHT CALIBRATION REPORT
${'='.repeat(50)}

${grade.emoji} GRADE: ${grade.grade} - ${grade.description}

📊 OVERALL STATS
• Predictions: ${stats.totalPredictions} (${stats.resolvedPredictions} resolved, ${stats.pendingPredictions} pending)
• Brier Score: ${stats.overallBrierScore.toFixed(4)} ${stats.overallBrierScore < 0.2 ? '✅' : '⚠️'}
• Accuracy: ${(stats.accuracy * 100).toFixed(1)}%
• Streak: ${stats.streak.current} ${stats.streak.type === 'win' ? '🔥 wins' : stats.streak.type === 'loss' ? '❄️ losses' : ''}

📈 BRIER SCORE BENCHMARKS
• < 0.10 = Superforecaster Elite 🏆
• < 0.15 = Superforecaster ⭐
• < 0.20 = Very Good ✨
• < 0.25 = Above Average 👍
• 0.25 = Random Guessing 🎲
• > 0.30 = Poor 📉

`;

  if (stats.calibrationByBucket.length > 0) {
    report += `
📉 CALIBRATION BY CONFIDENCE
${'─'.repeat(50)}
Range      Predictions  Expected  Actual   Error
`;
    for (const bucket of stats.calibrationByBucket) {
      report += `${bucket.range.padEnd(10)} ${String(bucket.predictions).padEnd(12)} ${(bucket.expectedRate * 100).toFixed(0).padEnd(9)}% ${(bucket.actualRate * 100).toFixed(0).padEnd(8)}% ${(bucket.calibrationError * 100).toFixed(1)}%\n`;
    }
  }

  if (Object.keys(stats.performanceByPlatform).length > 0) {
    report += `
🏛️ PERFORMANCE BY PLATFORM
${'─'.repeat(50)}
`;
    for (const [platform, pstats] of Object.entries(stats.performanceByPlatform)) {
      report += `${platform.padEnd(15)} Brier: ${pstats.brierScore.toFixed(3)} | Acc: ${(pstats.accuracy * 100).toFixed(0)}% | n=${pstats.predictions}\n`;
    }
  }

  report += `
💡 CALIBRATION TIP
${stats.overallBrierScore < 0.2
    ? 'Great calibration! Keep tracking to maintain accuracy.'
    : stats.overallBrierScore < 0.25
    ? 'Good start! Try to be more confident when evidence is strong.'
    : 'Focus on base rates and update beliefs incrementally.'}

🧠 Remember: Good forecasters are right about 70-80% of the time on 70-80% confidence predictions.
`;

  return report;
}

/**
 * Main calibration skill function
 */
export async function calibration(): Promise<SkillResponse> {
  const stats = getCalibrationStats();
  const text = formatCalibrationReport(stats);

  return {
    text,
    mood: stats.overallBrierScore < 0.2 ? 'BULLISH' : 'NEUTRAL',
    data: stats,
  };
}

/**
 * Add prediction skill function
 */
export async function predict(
  question: string,
  probability: number,
  direction: 'YES' | 'NO',
  reasoning: string,
  platform = 'unknown',
  tags: string[] = []
): Promise<SkillResponse> {
  const prediction = addPrediction(question, probability, direction, reasoning, {
    platform,
    confidence: probability > 0.8 || probability < 0.2 ? 'high' : probability > 0.6 || probability < 0.4 ? 'medium' : 'low',
    tags,
  });

  return {
    text: `
✅ PREDICTION RECORDED
${'='.repeat(40)}

ID: ${prediction.id}
Question: ${prediction.question}
Platform: ${prediction.platform}

📊 MY FORECAST
Direction: ${prediction.direction}
Probability: ${(prediction.predictedProbability * 100).toFixed(1)}%
Confidence: ${prediction.confidence.toUpperCase()}

📝 REASONING
${prediction.reasoning}

Tags: ${prediction.tags.join(', ') || 'none'}

⏳ Awaiting resolution...
Use \`resolve ${prediction.id} YES|NO\` when market resolves.
`,
    mood: 'NEUTRAL',
    data: prediction,
  };
}

/**
 * Resolve prediction skill function
 */
export async function resolve(
  predictionId: string,
  outcome: 'YES' | 'NO'
): Promise<SkillResponse> {
  const prediction = resolvePrediction(predictionId, outcome === 'YES');

  if (!prediction) {
    return {
      text: `❌ Prediction not found: ${predictionId}`,
      mood: 'ERROR',
    };
  }

  const wasCorrect = (prediction.direction === 'YES') === prediction.outcome;
  const grade = getGrade(prediction.brierScore || 0);

  return {
    text: `
${wasCorrect ? '✅ CORRECT!' : '❌ INCORRECT'}
${'='.repeat(40)}

Question: ${prediction.question}

MY PREDICTION: ${prediction.direction} @ ${(prediction.predictedProbability * 100).toFixed(1)}%
ACTUAL OUTCOME: ${outcome}

📊 SCORE
Brier Score: ${prediction.brierScore?.toFixed(4)} ${grade.emoji}
${wasCorrect ? '🎯 Nice call!' : '📚 Learning opportunity'}

${!wasCorrect ? `
💡 REFLECTION
What could I have considered?
• Were there signals I missed?
• Was my confidence too high?
• Did I update on new information?
` : ''}
`,
    mood: wasCorrect ? 'BULLISH' : 'EDUCATIONAL',
    data: prediction,
  };
}

/**
 * Calculate current streak from predictions
 */
export function calculateStreak(predictions: Array<{ outcome: boolean | null | undefined; direction: string }>): number {
  // Filter to resolved predictions and sort by most recent
  const resolved = predictions.filter(p => p.outcome !== null && p.outcome !== undefined);
  if (resolved.length === 0) return 0;

  let streak = 0;
  for (const pred of resolved) {
    const isCorrect = (pred.direction === 'YES') === pred.outcome;
    if (streak === 0) {
      streak = isCorrect ? 1 : -1;
    } else if ((streak > 0 && isCorrect) || (streak < 0 && !isCorrect)) {
      streak += streak > 0 ? 1 : -1;
    } else {
      break;
    }
  }

  return Math.abs(streak);
}

/**
 * List pending predictions
 */
export function listPending(): Prediction[] {
  return loadPredictions().filter(p => p.outcome === undefined);
}

// CLI interface
if (process.argv[1]?.endsWith('calibration.ts')) {
  const args = process.argv.slice(2);
  const command = args[0];

  (async () => {
    if (command === 'stats' || !command) {
      const result = await calibration();
      console.log(result.text);
    } else if (command === 'add') {
      const [, question, prob, direction, ...reasoningParts] = args;
      if (!question || !prob || !direction) {
        console.log('Usage: npx ts-node calibration.ts add "<question>" <probability> YES|NO <reasoning>');
        return;
      }
      const result = await predict(
        question,
        parseFloat(prob),
        direction as 'YES' | 'NO',
        reasoningParts.join(' ') || 'No reasoning provided'
      );
      console.log(result.text);
    } else if (command === 'resolve') {
      const [, predId, outcome] = args;
      if (!predId || !outcome) {
        console.log('Usage: npx ts-node calibration.ts resolve <prediction_id> YES|NO');
        return;
      }
      const result = await resolve(predId, outcome as 'YES' | 'NO');
      console.log(result.text);
    } else if (command === 'pending') {
      const pending = listPending();
      console.log(`\n📋 PENDING PREDICTIONS (${pending.length})\n`);
      for (const p of pending) {
        console.log(`${p.id.slice(0, 20)}...`);
        console.log(`  Q: ${p.question.slice(0, 50)}...`);
        console.log(`  ${p.direction} @ ${(p.predictedProbability * 100).toFixed(0)}%`);
        console.log(`  Created: ${p.createdAt.slice(0, 10)}`);
        console.log('');
      }
    } else {
      console.log('Usage:');
      console.log('  npx ts-node calibration.ts stats');
      console.log('  npx ts-node calibration.ts add "<question>" <probability> YES|NO <reasoning>');
      console.log('  npx ts-node calibration.ts resolve <prediction_id> YES|NO');
      console.log('  npx ts-node calibration.ts pending');
    }
  })();
}
