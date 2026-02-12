/**
 * Learning Insights Skill
 *
 * Analyzes resolved predictions to extract learning insights:
 * - What went right/wrong
 * - Pattern recognition in mistakes
 * - Actionable improvements
 * - Personal forecasting rules
 *
 * Goal: Turn past predictions into future accuracy improvements
 */

import { SkillResponse } from '../types/index';
import { supabase, db } from '../lib/supabase/client';
import { interpretBrierScore } from '../lib/onchain/memo';

// Types
interface ResolvedPrediction {
  id: string;
  question: string;
  direction: 'YES' | 'NO';
  probability: number;
  outcome: boolean;
  brierScore: number;
  reasoning?: string;
  platform?: string;
  createdAt: string;
  resolvedAt: string;
}

interface PredictionLesson {
  predictionId: string;
  question: string;
  wasCorrect: boolean;
  brierScore: number;
  quality: 'excellent' | 'good' | 'fair' | 'poor' | 'bad';
  lesson: string;
  category: 'overconfidence' | 'underconfidence' | 'wrong_direction' | 'calibration' | 'timing' | 'unknown';
}

interface LearningPattern {
  pattern: string;
  frequency: number; // How many predictions showed this pattern
  impact: number; // Average Brier score impact
  recommendation: string;
}

interface LearningReport {
  userId: string;
  analyzedPredictions: number;

  // Best/worst
  bestPredictions: ResolvedPrediction[];
  worstPredictions: ResolvedPrediction[];

  // Lessons
  lessons: PredictionLesson[];

  // Patterns
  patterns: LearningPattern[];

  // Personal rules (derived from patterns)
  personalRules: string[];

  // Summary stats
  summary: {
    avgBrier: number;
    correctRate: number;
    overconfidenceFrequency: number;
    underconfidenceFrequency: number;
    biggestImprovement: string;
  };
}

/**
 * Analyze a single prediction to extract lessons
 */
function analyzePrediction(pred: ResolvedPrediction): PredictionLesson {
  const wasCorrect = (pred.direction === 'YES') === pred.outcome;
  const quality = interpretBrierScore(pred.brierScore).quality as PredictionLesson['quality'];

  let category: PredictionLesson['category'] = 'unknown';
  let lesson = '';

  // Analyze what went wrong (or right)
  if (wasCorrect && pred.brierScore < 0.1) {
    // Excellent calibration
    category = 'calibration';
    lesson = 'Well-calibrated confidence with correct direction.';
  } else if (wasCorrect && pred.brierScore > 0.2) {
    // Correct but underconfident
    category = 'underconfidence';
    lesson = `Predicted ${(pred.probability * 100).toFixed(0)}% but outcome happened. You could have been more confident.`;
  } else if (!wasCorrect && pred.probability > 0.7) {
    // Wrong direction with high confidence
    category = 'overconfidence';
    lesson = `Predicted ${pred.direction} at ${(pred.probability * 100).toFixed(0)}% but outcome was ${pred.outcome ? 'YES' : 'NO'}. High confidence was not warranted.`;
  } else if (!wasCorrect && pred.probability >= 0.4 && pred.probability <= 0.6) {
    // Wrong but appropriately uncertain
    category = 'calibration';
    lesson = 'Low confidence prediction that turned out wrong. This is expected for near-50% predictions.';
  } else if (!wasCorrect) {
    category = 'wrong_direction';
    lesson = `Predicted ${pred.direction} at ${(pred.probability * 100).toFixed(0)}% but outcome was ${pred.outcome ? 'YES' : 'NO'}.`;
  } else {
    category = 'calibration';
    lesson = wasCorrect ? 'Correct prediction.' : 'Incorrect prediction.';
  }

  return {
    predictionId: pred.id,
    question: pred.question,
    wasCorrect,
    brierScore: pred.brierScore,
    quality,
    lesson,
    category,
  };
}

/**
 * Identify patterns across multiple predictions
 */
function identifyPatterns(lessons: PredictionLesson[]): LearningPattern[] {
  const patterns: LearningPattern[] = [];

  // Count category frequencies
  const categoryCount: Record<string, number> = {};
  const categoryBriers: Record<string, number[]> = {};

  for (const lesson of lessons) {
    categoryCount[lesson.category] = (categoryCount[lesson.category] || 0) + 1;
    if (!categoryBriers[lesson.category]) categoryBriers[lesson.category] = [];
    categoryBriers[lesson.category].push(lesson.brierScore);
  }

  // Overconfidence pattern
  if (categoryCount['overconfidence'] >= 3) {
    const avgBrier = categoryBriers['overconfidence'].reduce((a, b) => a + b, 0) / categoryBriers['overconfidence'].length;
    patterns.push({
      pattern: 'Overconfidence on high-probability predictions',
      frequency: categoryCount['overconfidence'],
      impact: avgBrier,
      recommendation: 'When you feel 80%+ confident, consider if 70% might be more accurate.',
    });
  }

  // Underconfidence pattern
  if (categoryCount['underconfidence'] >= 3) {
    const avgBrier = categoryBriers['underconfidence'].reduce((a, b) => a + b, 0) / categoryBriers['underconfidence'].length;
    patterns.push({
      pattern: 'Underconfidence - predictions more accurate than stated',
      frequency: categoryCount['underconfidence'],
      impact: avgBrier,
      recommendation: 'Trust your analysis more. When evidence is strong, commit to higher confidence.',
    });
  }

  // Wrong direction with high confidence
  const wrongHighConfidence = lessons.filter(l =>
    l.category === 'wrong_direction' && !l.wasCorrect
  );
  if (wrongHighConfidence.length >= 2) {
    patterns.push({
      pattern: 'Directionally wrong predictions',
      frequency: wrongHighConfidence.length,
      impact: wrongHighConfidence.reduce((sum, l) => sum + l.brierScore, 0) / wrongHighConfidence.length,
      recommendation: 'Before predicting, explicitly consider the opposite scenario. What would make you wrong?',
    });
  }

  // Check for question-type patterns (keywords)
  const questionKeywords: Record<string, { correct: number; total: number }> = {};
  const keywordCategories = ['politics', 'crypto', 'sports', 'tech', 'economics'];

  for (const lesson of lessons) {
    const q = lesson.question.toLowerCase();
    for (const keyword of keywordCategories) {
      if (q.includes(keyword) || q.includes(keyword.slice(0, 4))) {
        if (!questionKeywords[keyword]) questionKeywords[keyword] = { correct: 0, total: 0 };
        questionKeywords[keyword].total++;
        if (lesson.wasCorrect) questionKeywords[keyword].correct++;
      }
    }
  }

  // Add category-specific patterns
  for (const [keyword, stats] of Object.entries(questionKeywords)) {
    if (stats.total >= 3) {
      const accuracy = stats.correct / stats.total;
      if (accuracy < 0.4) {
        patterns.push({
          pattern: `Struggling with ${keyword} predictions`,
          frequency: stats.total,
          impact: 0.3, // Estimated
          recommendation: `Consider avoiding ${keyword} predictions or doing more research before predicting.`,
        });
      } else if (accuracy > 0.7) {
        patterns.push({
          pattern: `Strong performance in ${keyword} predictions`,
          frequency: stats.total,
          impact: 0.1, // Positive impact
          recommendation: `You have an edge in ${keyword}. Consider focusing more predictions here.`,
        });
      }
    }
  }

  return patterns;
}

/**
 * Generate personal forecasting rules from patterns
 */
function generatePersonalRules(patterns: LearningPattern[], lessons: PredictionLesson[]): string[] {
  const rules: string[] = [];

  // Add rules based on patterns
  for (const pattern of patterns) {
    if (pattern.impact > 0.2) { // Significant impact
      rules.push(`RULE: ${pattern.recommendation}`);
    }
  }

  // Add general rules based on overall performance
  const avgBrier = lessons.reduce((sum, l) => sum + l.brierScore, 0) / lessons.length;
  const correctRate = lessons.filter(l => l.wasCorrect).length / lessons.length;

  if (correctRate < 0.5) {
    rules.push('RULE: Always write down why you might be wrong before predicting.');
  }

  if (avgBrier > 0.25) {
    rules.push('RULE: Check base rates for similar questions before assigning probabilities.');
  }

  // Limit to 5 most important rules
  return rules.slice(0, 5);
}

/**
 * Generate learning report for a user
 */
export async function generateLearnings(userId: string, limit: number = 50): Promise<LearningReport | null> {
  try {
    // Get resolved predictions
    const predictions = await db.predictions.getByUser(userId);
    const resolved = predictions
      .filter(p => p.resolved_at !== null && p.brier_score !== null)
      .slice(0, limit)
      .map(p => ({
        id: p.id,
        question: p.question,
        direction: (p.direction as 'YES' | 'NO') || 'YES',
        probability: p.predicted_probability,
        outcome: p.outcome ?? false,
        brierScore: p.brier_score!,
        reasoning: p.reasoning || undefined,
        platform: p.platform || undefined,
        createdAt: p.created_at,
        resolvedAt: p.resolved_at!,
      }));

    if (resolved.length < 5) {
      return null; // Not enough data
    }

    // Analyze each prediction
    const lessons = resolved.map(analyzePrediction);

    // Identify patterns
    const patterns = identifyPatterns(lessons);

    // Generate personal rules
    const personalRules = generatePersonalRules(patterns, lessons);

    // Sort for best/worst
    const sortedByBrier = [...resolved].sort((a, b) => a.brierScore - b.brierScore);
    const bestPredictions = sortedByBrier.slice(0, 3);
    const worstPredictions = sortedByBrier.slice(-3).reverse();

    // Calculate summary stats
    const avgBrier = resolved.reduce((sum, p) => sum + p.brierScore, 0) / resolved.length;
    const correctRate = lessons.filter(l => l.wasCorrect).length / lessons.length;
    const overconfidenceFrequency = lessons.filter(l => l.category === 'overconfidence').length / lessons.length;
    const underconfidenceFrequency = lessons.filter(l => l.category === 'underconfidence').length / lessons.length;

    // Identify biggest improvement area
    let biggestImprovement = 'Keep making predictions to identify improvement areas.';
    if (patterns.length > 0) {
      const worstPattern = patterns.sort((a, b) => b.impact - a.impact)[0];
      biggestImprovement = worstPattern.recommendation;
    }

    return {
      userId,
      analyzedPredictions: resolved.length,
      bestPredictions,
      worstPredictions,
      lessons,
      patterns,
      personalRules,
      summary: {
        avgBrier,
        correctRate,
        overconfidenceFrequency,
        underconfidenceFrequency,
        biggestImprovement,
      },
    };
  } catch (err) {
    console.error('[Learnings] Error generating report:', err);
    return null;
  }
}

/**
 * Format learning report as markdown
 */
function formatLearningReport(report: LearningReport): string {
  let text = `
📚 *LEARNING INSIGHTS*
${'═'.repeat(50)}

📊 *Overview*
Analyzed: ${report.analyzedPredictions} predictions
Correct rate: ${(report.summary.correctRate * 100).toFixed(0)}%
Avg Brier: ${report.summary.avgBrier.toFixed(4)}

`;

  // Best predictions
  if (report.bestPredictions.length > 0) {
    text += `⭐ *YOUR BEST PREDICTIONS*
${'─'.repeat(40)}
`;
    for (const pred of report.bestPredictions) {
      text += `• ${pred.question.slice(0, 40)}...
  ${pred.direction} @ ${(pred.probability * 100).toFixed(0)}% → Brier: ${pred.brierScore.toFixed(4)} ✅
`;
    }
    text += '\n';
  }

  // Worst predictions
  if (report.worstPredictions.length > 0) {
    text += `📉 *LEARN FROM THESE*
${'─'.repeat(40)}
`;
    for (const pred of report.worstPredictions) {
      const wasCorrect = (pred.direction === 'YES') === pred.outcome;
      const lesson = report.lessons.find(l => l.predictionId === pred.id);
      text += `• ${pred.question.slice(0, 40)}...
  ${pred.direction} @ ${(pred.probability * 100).toFixed(0)}% → Brier: ${pred.brierScore.toFixed(4)} ${wasCorrect ? '' : '❌'}
  ${lesson?.lesson || ''}
`;
    }
    text += '\n';
  }

  // Patterns
  if (report.patterns.length > 0) {
    text += `🔍 *PATTERNS DETECTED*
${'─'.repeat(40)}
`;
    for (const pattern of report.patterns.slice(0, 3)) {
      text += `• ${pattern.pattern}
  Found in ${pattern.frequency} predictions
  💡 ${pattern.recommendation}
`;
    }
    text += '\n';
  }

  // Personal rules
  if (report.personalRules.length > 0) {
    text += `📋 *YOUR PERSONAL FORECASTING RULES*
${'─'.repeat(40)}
`;
    for (const rule of report.personalRules) {
      text += `${rule}
`;
    }
    text += '\n';
  }

  // Biggest improvement
  text += `
🎯 *BIGGEST IMPROVEMENT OPPORTUNITY*
${report.summary.biggestImprovement}
`;

  return text;
}

/**
 * Main skill function
 */
export async function learnings(userId: string): Promise<SkillResponse> {
  const report = await generateLearnings(userId);

  if (!report) {
    return {
      text: `
📚 *LEARNING INSIGHTS*

Not enough data yet! You need at least 5 resolved predictions to generate learning insights.

/predict to make a prediction
/feedback for calibration feedback
`,
      mood: 'EDUCATIONAL',
    };
  }

  const text = formatLearningReport(report);

  return {
    text,
    mood: report.patterns.length > 0 ? 'EDUCATIONAL' : 'NEUTRAL',
    data: report,
  };
}

// CLI interface
if (require.main === module) {
  const userId = process.argv[2];

  if (!userId) {
    console.log('Usage: npx ts-node learnings.ts <userId>');
    process.exit(1);
  }

  learnings(userId).then(result => {
    console.log(result.text);
  }).catch(console.error);
}

export { analyzePrediction, identifyPatterns };
