/**
 * Prediction Intelligence Skill
 *
 * Helps users make better predictions by providing:
 * - Base rate analysis from similar historical markets
 * - Current market consensus
 * - Key factors to consider
 * - Calibration insights
 * - Cognitive bias warnings
 *
 * Goal: Help users "be right mostly" through better-informed predictions
 */

import { SkillResponse } from '../types/index';
import { searchEvents, getMarket, calculateBaseRate, findSimilarMarkets, DFlowMarket, DFlowEvent } from '../lib/dflow/api';
import { db, supabase } from '../lib/supabase/client';

// Types
interface IntelligenceReport {
  question: string;
  marketPrice?: number;
  baseRate: {
    rate: number;
    sampleSize: number;
    confidence: 'low' | 'medium' | 'high';
    similarMarkets: Array<{ title: string; result: 'yes' | 'no'; price: number }>;
  };
  consensus: {
    aggregatedProbability: number;
    sources: Array<{ platform: string; probability: number; volume?: number }>;
    divergence: number;
  };
  keyFactors: string[];
  biasWarnings: string[];
  recommendedRange: { low: number; high: number };
  calibrationTip?: string;
}

interface UserCalibrationProfile {
  avgBrier: number;
  totalPredictions: number;
  overconfidenceTendency: number; // +positive = overconfident
  weakCategories: string[];
  strongCategories: string[];
}

/**
 * Get prediction intelligence for a market question
 */
export async function getIntelligence(
  question: string,
  marketTicker?: string
): Promise<IntelligenceReport> {
  const report: IntelligenceReport = {
    question,
    baseRate: {
      rate: 0.5,
      sampleSize: 0,
      confidence: 'low',
      similarMarkets: [],
    },
    consensus: {
      aggregatedProbability: 0.5,
      sources: [],
      divergence: 0,
    },
    keyFactors: [],
    biasWarnings: [],
    recommendedRange: { low: 0.3, high: 0.7 },
  };

  // 1. Get current market price if ticker provided
  if (marketTicker) {
    const market = await getMarket(marketTicker);
    if (market.success && market.data) {
      const yesBid = parseFloat(market.data.yesBid || '0.5');
      report.marketPrice = yesBid;
      report.consensus.sources.push({
        platform: 'dflow',
        probability: yesBid,
        volume: market.data.volume,
      });
    }
  }

  // 2. Calculate base rate from similar historical markets
  const baseRateData = await calculateBaseRate(question);
  report.baseRate = {
    rate: baseRateData.baseRate,
    sampleSize: baseRateData.sampleSize,
    confidence: baseRateData.sampleSize >= 10 ? 'high' : baseRateData.sampleSize >= 5 ? 'medium' : 'low',
    similarMarkets: baseRateData.similarMarkets.slice(0, 5).map(m => ({
      title: m.title,
      result: m.result,
      price: m.yesPrice,
    })),
  };

  // 3. Search for related markets to build consensus
  const searchResults = await searchEvents(question, { limit: 10, withNestedMarkets: true });
  if (searchResults.success && searchResults.data) {
    for (const event of searchResults.data) {
      if (event.markets) {
        for (const market of event.markets) {
          if (market.yesBid && market.status === 'active') {
            const prob = parseFloat(market.yesBid);
            // Avoid duplicates
            if (!report.consensus.sources.find(s => s.platform === 'dflow' && Math.abs(s.probability - prob) < 0.01)) {
              report.consensus.sources.push({
                platform: 'dflow',
                probability: prob,
                volume: market.volume,
              });
            }
          }
        }
      }
    }
  }

  // 4. Calculate consensus
  if (report.consensus.sources.length > 0) {
    const probs = report.consensus.sources.map(s => s.probability);
    report.consensus.aggregatedProbability = probs.reduce((a, b) => a + b, 0) / probs.length;
    report.consensus.divergence = Math.max(...probs) - Math.min(...probs);
  }

  // 5. Extract key factors based on question content
  report.keyFactors = extractKeyFactors(question);

  // 6. Generate bias warnings
  report.biasWarnings = generateBiasWarnings(question, report);

  // 7. Calculate recommended range
  report.recommendedRange = calculateRecommendedRange(report);

  return report;
}

/**
 * Extract key factors to consider based on question
 */
function extractKeyFactors(question: string): string[] {
  const factors: string[] = [];
  const q = question.toLowerCase();

  // Time-based factors
  if (q.includes('by') || q.includes('before') || q.includes('end of')) {
    factors.push('Consider historical timing patterns for similar events');
  }

  // Price/value targets
  if (q.match(/\$[\d,]+|[\d,]+k|\d+%/)) {
    factors.push('Price targets often have anchoring bias - check historical volatility');
  }

  // Political events
  if (q.includes('election') || q.includes('vote') || q.includes('congress') || q.includes('president')) {
    factors.push('Political markets often show partisan bias - check diverse sources');
    factors.push('Polling vs actual results historically differ by 2-4%');
  }

  // Crypto/financial
  if (q.includes('bitcoin') || q.includes('btc') || q.includes('crypto') || q.includes('ethereum')) {
    factors.push('Crypto is highly volatile - base rates from 1+ year ago may not apply');
    factors.push('Consider macro environment (rates, risk appetite)');
  }

  // Sports
  if (q.includes('win') || q.includes('championship') || q.includes('playoff') || q.includes('game')) {
    factors.push('Recent form vs season averages');
    factors.push('Injuries and roster changes');
  }

  // Binary certainty language
  if (q.includes('ever') || q.includes('never') || q.includes('definitely')) {
    factors.push('Extreme outcomes are historically rare - consider base rates');
  }

  // Default factors if none extracted
  if (factors.length === 0) {
    factors.push('Consider outside view (base rates) before inside view (specific details)');
    factors.push('Look for similar historical situations');
  }

  return factors;
}

/**
 * Generate cognitive bias warnings
 */
function generateBiasWarnings(question: string, report: IntelligenceReport): string[] {
  const warnings: string[] = [];
  const q = question.toLowerCase();

  // Recency bias
  if (q.includes('again') || q.includes('continue') || q.includes('keep')) {
    warnings.push('Recency bias: Recent trends may not continue');
  }

  // Availability bias (prominent recent events)
  const recentEvents = ['covid', 'ai', 'chatgpt', 'recession', 'inflation'];
  if (recentEvents.some(e => q.includes(e))) {
    warnings.push('Availability bias: High-profile topics may feel more likely than they are');
  }

  // Anchoring on round numbers
  if (q.match(/\$\d00|\d00k|50%|100%|1 million/)) {
    warnings.push('Anchoring bias: Round numbers may not reflect actual probabilities');
  }

  // Overconfidence check
  if (report.baseRate.rate !== 0.5 && report.baseRate.confidence !== 'low') {
    const deviation = Math.abs(report.consensus.aggregatedProbability - report.baseRate.rate);
    if (deviation > 0.2) {
      warnings.push(`Current market (${(report.consensus.aggregatedProbability * 100).toFixed(0)}%) differs significantly from base rate (${(report.baseRate.rate * 100).toFixed(0)}%)`);
    }
  }

  // Confirmation bias
  if (q.includes('will') && !q.includes('will not') && !q.includes("won't")) {
    warnings.push('Frame the question both ways - "Will X happen?" vs "What would prevent X?"');
  }

  // High divergence = uncertainty
  if (report.consensus.divergence > 0.15) {
    warnings.push('High disagreement between sources - uncertainty is high');
  }

  return warnings;
}

/**
 * Calculate recommended probability range
 */
function calculateRecommendedRange(report: IntelligenceReport): { low: number; high: number } {
  const sources: number[] = [];

  // Add base rate if meaningful
  if (report.baseRate.sampleSize >= 3) {
    sources.push(report.baseRate.rate);
  }

  // Add market prices
  for (const source of report.consensus.sources) {
    sources.push(source.probability);
  }

  if (sources.length === 0) {
    return { low: 0.3, high: 0.7 };
  }

  const mean = sources.reduce((a, b) => a + b, 0) / sources.length;
  const stdDev = Math.sqrt(sources.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / sources.length);

  // Range = mean +/- 1 standard deviation, bounded
  const low = Math.max(0.05, mean - stdDev - 0.05);
  const high = Math.min(0.95, mean + stdDev + 0.05);

  return { low, high };
}

/**
 * Get user's calibration profile for personalized advice
 */
export async function getUserCalibrationProfile(userId: string): Promise<UserCalibrationProfile | null> {
  try {
    // Get user's resolved predictions
    const { data: predictions, error } = await supabase
      .from('predictions')
      .select('*')
      .eq('user_id', userId)
      .not('brier_score', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error || !predictions || predictions.length < 5) {
      return null;
    }

    const avgBrier = predictions.reduce((sum, p) => sum + (p.brier_score || 0), 0) / predictions.length;

    // Calculate overconfidence (predictions > 80% or < 20% that were wrong)
    const extremePreds = predictions.filter(p =>
      (p.predicted_probability > 0.8 || p.predicted_probability < 0.2)
    );
    const extremeCorrect = extremePreds.filter(p =>
      (p.direction === 'YES' && p.outcome) || (p.direction === 'NO' && !p.outcome)
    ).length;
    const expectedExtreme = extremePreds.reduce((sum, p) =>
      sum + Math.max(p.predicted_probability, 1 - p.predicted_probability), 0
    ) / extremePreds.length;
    const actualExtreme = extremePreds.length > 0 ? extremeCorrect / extremePreds.length : 0.5;
    const overconfidenceTendency = expectedExtreme - actualExtreme;

    // Categorize by platform performance
    const platformBriers: Record<string, number[]> = {};
    for (const p of predictions) {
      const platform = p.platform || 'unknown';
      if (!platformBriers[platform]) platformBriers[platform] = [];
      platformBriers[platform].push(p.brier_score || 0);
    }

    const platformAvgs = Object.entries(platformBriers).map(([platform, scores]) => ({
      platform,
      avgBrier: scores.reduce((a, b) => a + b, 0) / scores.length,
    })).sort((a, b) => a.avgBrier - b.avgBrier);

    const strongCategories = platformAvgs.slice(0, 2).map(p => p.platform);
    const weakCategories = platformAvgs.slice(-2).map(p => p.platform);

    return {
      avgBrier,
      totalPredictions: predictions.length,
      overconfidenceTendency,
      weakCategories,
      strongCategories,
    };
  } catch (err) {
    console.error('Error getting calibration profile:', err);
    return null;
  }
}

/**
 * Generate personalized calibration tip
 */
function getCalibrationTip(profile: UserCalibrationProfile | null): string {
  if (!profile) {
    return 'Make more predictions to get personalized calibration insights!';
  }

  const tips: string[] = [];

  if (profile.overconfidenceTendency > 0.1) {
    tips.push('You tend to be overconfident. Try predicting closer to 50% when uncertain.');
  } else if (profile.overconfidenceTendency < -0.1) {
    tips.push('You might be under-confident. Trust your analysis more on high-conviction calls.');
  }

  if (profile.avgBrier > 0.25) {
    tips.push('Focus on base rates and similar historical events before making predictions.');
  } else if (profile.avgBrier < 0.15) {
    tips.push('Excellent calibration! Consider higher-stakes predictions to challenge yourself.');
  }

  if (profile.weakCategories.length > 0) {
    tips.push(`You perform best in ${profile.strongCategories.join(', ')}. Consider specializing.`);
  }

  return tips.length > 0 ? tips[0] : 'Keep making predictions to improve your calibration!';
}

/**
 * Format intelligence report as markdown
 */
function formatIntelligenceReport(report: IntelligenceReport, profile?: UserCalibrationProfile | null): string {
  let output = `
🔮 PREDICTION INTELLIGENCE
${'═'.repeat(50)}

📋 Question: ${report.question}

`;

  // Market Price
  if (report.marketPrice !== undefined) {
    output += `📊 Current Market: ${(report.marketPrice * 100).toFixed(0)}% YES\n\n`;
  }

  // Base Rate
  output += `📈 BASE RATE ANALYSIS
${'─'.repeat(40)}
Historical rate: ${(report.baseRate.rate * 100).toFixed(0)}%
Sample size: ${report.baseRate.sampleSize} similar markets
Confidence: ${report.baseRate.confidence.toUpperCase()}
`;

  if (report.baseRate.similarMarkets.length > 0) {
    output += '\nSimilar resolved markets:\n';
    for (const m of report.baseRate.similarMarkets.slice(0, 3)) {
      output += `  • ${m.title.slice(0, 40)}... → ${m.result.toUpperCase()}\n`;
    }
  }

  // Consensus
  if (report.consensus.sources.length > 0) {
    output += `
📊 MARKET CONSENSUS
${'─'.repeat(40)}
Aggregated probability: ${(report.consensus.aggregatedProbability * 100).toFixed(0)}%
Sources: ${report.consensus.sources.length}
Divergence: ${(report.consensus.divergence * 100).toFixed(0)}%
`;
  }

  // Recommended Range
  output += `
🎯 RECOMMENDED RANGE
${'─'.repeat(40)}
${(report.recommendedRange.low * 100).toFixed(0)}% - ${(report.recommendedRange.high * 100).toFixed(0)}%
`;

  // Key Factors
  if (report.keyFactors.length > 0) {
    output += `
💡 KEY FACTORS TO CONSIDER
${'─'.repeat(40)}
`;
    for (const factor of report.keyFactors) {
      output += `• ${factor}\n`;
    }
  }

  // Bias Warnings
  if (report.biasWarnings.length > 0) {
    output += `
⚠️ BIAS WARNINGS
${'─'.repeat(40)}
`;
    for (const warning of report.biasWarnings) {
      output += `• ${warning}\n`;
    }
  }

  // Personalized tip
  const tip = getCalibrationTip(profile || null);
  output += `
🧠 CALIBRATION TIP
${'─'.repeat(40)}
${tip}
`;

  return output;
}

/**
 * Main skill function - analyze a prediction question
 */
export async function analyze(
  question: string,
  options?: { marketTicker?: string; userId?: string }
): Promise<SkillResponse> {
  try {
    const report = await getIntelligence(question, options?.marketTicker);

    let profile: UserCalibrationProfile | null = null;
    if (options?.userId) {
      profile = await getUserCalibrationProfile(options.userId);
    }

    const text = formatIntelligenceReport(report, profile);

    return {
      text,
      mood: 'EDUCATIONAL',
      data: report,
    };
  } catch (error) {
    console.error('Intelligence analysis error:', error);
    return {
      text: `❌ Failed to analyze: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Quick check - just get the key numbers
 */
export async function quickCheck(question: string): Promise<{
  baseRate: number;
  marketPrice?: number;
  recommendedRange: { low: number; high: number };
}> {
  const report = await getIntelligence(question);
  return {
    baseRate: report.baseRate.rate,
    marketPrice: report.marketPrice,
    recommendedRange: report.recommendedRange,
  };
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const question = args.join(' ') || 'Will Bitcoin reach $100,000 by end of 2026?';

  console.log(`Analyzing: "${question}"\n`);

  analyze(question).then(result => {
    console.log(result.text);
  }).catch(console.error);
}
