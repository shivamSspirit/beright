/**
 * Recommendation Engine
 *
 * Recommends prediction opportunities based on:
 * - User's historical strengths (categories, platforms)
 * - Market liquidity and activity
 * - Base rate analysis
 * - Calibration patterns
 *
 * Goal: Help users focus on markets where they have an edge
 */

import { SkillResponse } from '../types/index';
import { supabase, db } from '../lib/supabase/client';
import { searchEvents, getHotMarkets, DFlowMarket, DFlowEvent } from '../lib/dflow/api';
import { getIntelligence } from './intelligence';
import { generateFeedback } from './feedback';

// Types
interface UserProfile {
  userId: string;
  avgBrier: number;
  totalPredictions: number;
  strongCategories: string[];
  weakCategories: string[];
  preferredProbabilityRange: { low: number; high: number };
  overconfidenceTendency: number;
  recentAccuracy: number;
}

interface MarketRecommendation {
  ticker: string;
  title: string;
  category: string;
  currentPrice: number;
  volume: number;
  closeTime?: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  suggestedAction?: {
    direction: 'YES' | 'NO';
    probability: number;
    rationale: string;
  };
  matchScore: number;
}

interface RecommendationResult {
  forYou: MarketRecommendation[]; // Based on strengths
  trending: MarketRecommendation[]; // High activity
  undervalued: MarketRecommendation[]; // Base rate divergence
  educational: MarketRecommendation[]; // Good for learning
}

/**
 * Analyze user's prediction history to build profile
 */
async function buildUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const predictions = await db.predictions.getByUser(userId);
    const resolved = predictions.filter(p => p.brier_score !== null);

    if (resolved.length < 5) {
      return null; // Not enough data
    }

    // Calculate average Brier
    const avgBrier = resolved.reduce((sum, p) => sum + (p.brier_score || 0), 0) / resolved.length;

    // Analyze by platform/category
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

    // Find strong and weak areas
    const platformAvgs = [...platformStats.entries()]
      .filter(([, stats]) => stats.count >= 3)
      .map(([platform, stats]) => ({
        platform,
        avgBrier: stats.briers.reduce((a, b) => a + b, 0) / stats.count,
      }))
      .sort((a, b) => a.avgBrier - b.avgBrier);

    const strongCategories = platformAvgs.slice(0, 2).map(p => p.platform);
    const weakCategories = platformAvgs.slice(-2).map(p => p.platform);

    // Analyze probability patterns
    const probs = resolved.map(p => p.predicted_probability);
    const avgProb = probs.reduce((a, b) => a + b, 0) / probs.length;
    const stdDev = Math.sqrt(probs.reduce((sum, p) => sum + Math.pow(p - avgProb, 2), 0) / probs.length);

    // Calculate overconfidence
    const extremePreds = resolved.filter(p =>
      p.predicted_probability > 0.8 || p.predicted_probability < 0.2
    );
    const extremeCorrect = extremePreds.filter(p =>
      (p.direction === 'YES') === p.outcome
    ).length;
    const expectedExtreme = extremePreds.length > 0
      ? extremePreds.reduce((sum, p) =>
          sum + Math.max(p.predicted_probability, 1 - p.predicted_probability), 0) / extremePreds.length
      : 0.5;
    const actualExtreme = extremePreds.length > 0 ? extremeCorrect / extremePreds.length : 0.5;
    const overconfidenceTendency = expectedExtreme - actualExtreme;

    // Recent accuracy (last 10)
    const recentResolved = [...resolved]
      .sort((a, b) => new Date(b.resolved_at!).getTime() - new Date(a.resolved_at!).getTime())
      .slice(0, 10);
    const recentCorrect = recentResolved.filter(p => (p.direction === 'YES') === p.outcome).length;
    const recentAccuracy = recentResolved.length > 0 ? recentCorrect / recentResolved.length : 0.5;

    return {
      userId,
      avgBrier,
      totalPredictions: predictions.length,
      strongCategories,
      weakCategories,
      preferredProbabilityRange: {
        low: Math.max(0.1, avgProb - stdDev),
        high: Math.min(0.9, avgProb + stdDev),
      },
      overconfidenceTendency,
      recentAccuracy,
    };
  } catch (err) {
    console.error('[Recommendations] Error building user profile:', err);
    return null;
  }
}

/**
 * Categorize a market based on its title
 */
function categorizeMarket(title: string): string {
  const lower = title.toLowerCase();

  if (lower.match(/bitcoin|btc|ethereum|eth|crypto|solana|sol/)) return 'crypto';
  if (lower.match(/president|election|congress|senate|vote|trump|biden/)) return 'politics';
  if (lower.match(/fed|inflation|gdp|unemployment|recession|economy/)) return 'economics';
  if (lower.match(/nfl|nba|mlb|nhl|championship|playoff|super bowl/)) return 'sports';
  if (lower.match(/ai|openai|chatgpt|google|apple|microsoft|tech/)) return 'tech';
  if (lower.match(/climate|weather|hurricane|earthquake/)) return 'climate';
  if (lower.match(/war|military|conflict|ukraine|russia|china/)) return 'geopolitics';

  return 'general';
}

/**
 * Score how well a market matches user profile
 */
function scoreMarketForUser(
  market: { ticker: string; title: string; yesPrice: number; volume: number },
  profile: UserProfile
): { score: number; reason: string } {
  let score = 50; // Base score
  const reasons: string[] = [];

  const category = categorizeMarket(market.title);

  // Bonus for strong categories
  if (profile.strongCategories.includes(category)) {
    score += 25;
    reasons.push(`Strong in ${category}`);
  }

  // Penalty for weak categories
  if (profile.weakCategories.includes(category)) {
    score -= 15;
    reasons.push(`Historically weak in ${category}`);
  }

  // Bonus for markets in preferred probability range
  const price = market.yesPrice;
  if (price >= profile.preferredProbabilityRange.low && price <= profile.preferredProbabilityRange.high) {
    score += 15;
    reasons.push('Probability in your comfort zone');
  }

  // Bonus for high volume (more reliable pricing)
  if (market.volume > 10000) {
    score += 10;
    reasons.push('High liquidity');
  }

  // Adjust for overconfidence
  if (profile.overconfidenceTendency > 0.1 && (price > 0.8 || price < 0.2)) {
    score -= 10;
    reasons.push('Caution: extreme probability (you tend to be overconfident)');
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    reason: reasons.join('; ') || 'General opportunity',
  };
}

/**
 * Get market recommendations for a user
 */
export async function getRecommendations(userId: string): Promise<RecommendationResult> {
  const result: RecommendationResult = {
    forYou: [],
    trending: [],
    undervalued: [],
    educational: [],
  };

  // Build user profile
  const profile = await buildUserProfile(userId);

  // Get hot markets from DFlow
  const hotMarkets = await getHotMarkets(30);

  // Process each market
  for (const market of hotMarkets) {
    const category = categorizeMarket(market.title);
    const baseRec: Omit<MarketRecommendation, 'reason' | 'matchScore'> = {
      ticker: market.ticker,
      title: market.title,
      category,
      currentPrice: market.yesPrice,
      volume: market.volume,
      closeTime: market.closeTime,
      confidence: market.volume > 5000 ? 'high' : market.volume > 1000 ? 'medium' : 'low',
    };

    // 1. Personalized recommendations (if we have profile)
    if (profile) {
      const { score, reason } = scoreMarketForUser(market, profile);
      if (score >= 60) {
        result.forYou.push({
          ...baseRec,
          reason,
          matchScore: score,
        });
      }
    }

    // 2. Trending (high volume)
    if (market.volume > 5000) {
      result.trending.push({
        ...baseRec,
        reason: `High activity: ${market.volume.toLocaleString()} volume`,
        matchScore: Math.min(100, 50 + market.volume / 1000),
      });
    }

    // 3. Potential undervalued (prices near extremes often revert)
    if (market.yesPrice > 0.85 || market.yesPrice < 0.15) {
      result.undervalued.push({
        ...baseRec,
        reason: 'Extreme pricing may offer value on the contrarian side',
        matchScore: 60,
        suggestedAction: {
          direction: market.yesPrice > 0.85 ? 'NO' : 'YES',
          probability: market.yesPrice > 0.85 ? 0.2 : 0.8,
          rationale: 'Extreme prices often overestimate certainty',
        },
      });
    }

    // 4. Educational (close to 50/50 - good for calibration practice)
    if (market.yesPrice >= 0.4 && market.yesPrice <= 0.6) {
      result.educational.push({
        ...baseRec,
        reason: 'Near 50/50 - good for calibration practice',
        matchScore: 55,
      });
    }
  }

  // Sort each category by match score
  result.forYou.sort((a, b) => b.matchScore - a.matchScore);
  result.trending.sort((a, b) => b.matchScore - a.matchScore);
  result.undervalued.sort((a, b) => b.matchScore - a.matchScore);
  result.educational.sort((a, b) => b.matchScore - a.matchScore);

  // Limit each category
  result.forYou = result.forYou.slice(0, 5);
  result.trending = result.trending.slice(0, 5);
  result.undervalued = result.undervalued.slice(0, 3);
  result.educational = result.educational.slice(0, 3);

  return result;
}

/**
 * Format recommendations as markdown
 */
function formatRecommendations(recs: RecommendationResult, profile?: UserProfile | null): string {
  let text = `
🎯 *MARKET RECOMMENDATIONS*
${'═'.repeat(50)}
`;

  if (profile) {
    const tierLabel =
      profile.avgBrier < 0.1 ? 'Superforecaster' :
      profile.avgBrier < 0.2 ? 'Expert' :
      profile.avgBrier < 0.25 ? 'Skilled' : 'Developing';

    text += `
📊 *Your Profile*
Level: ${tierLabel} (Brier: ${profile.avgBrier.toFixed(3)})
Strong in: ${profile.strongCategories.join(', ') || 'Building track record'}
Recent accuracy: ${(profile.recentAccuracy * 100).toFixed(0)}%
`;
  }

  if (recs.forYou.length > 0) {
    text += `
✨ *RECOMMENDED FOR YOU*
${'─'.repeat(40)}
`;
    for (const rec of recs.forYou) {
      text += `• *${rec.title.slice(0, 40)}*${rec.title.length > 40 ? '...' : ''}
  YES: ${(rec.currentPrice * 100).toFixed(0)}¢ | ${rec.reason}
  \`${rec.ticker}\`

`;
    }
  }

  if (recs.trending.length > 0) {
    text += `
🔥 *TRENDING MARKETS*
${'─'.repeat(40)}
`;
    for (const rec of recs.trending.slice(0, 3)) {
      text += `• ${rec.title.slice(0, 40)}...
  YES: ${(rec.currentPrice * 100).toFixed(0)}¢ | Vol: ${rec.volume.toLocaleString()}
`;
    }
  }

  if (recs.undervalued.length > 0) {
    text += `
💎 *POTENTIAL VALUE*
${'─'.repeat(40)}
`;
    for (const rec of recs.undervalued.slice(0, 2)) {
      text += `• ${rec.title.slice(0, 40)}...
  Current: ${(rec.currentPrice * 100).toFixed(0)}¢ | ${rec.reason}
`;
      if (rec.suggestedAction) {
        text += `  💡 Consider: ${rec.suggestedAction.direction} @ ${(rec.suggestedAction.probability * 100).toFixed(0)}%
`;
      }
    }
  }

  if (recs.educational.length > 0) {
    text += `
📚 *GOOD FOR PRACTICE*
${'─'.repeat(40)}
`;
    for (const rec of recs.educational.slice(0, 2)) {
      text += `• ${rec.title.slice(0, 40)}...
  YES: ${(rec.currentPrice * 100).toFixed(0)}¢ | ${rec.reason}
`;
    }
  }

  text += `
📝 To predict: /smartpredict <ticker> <prob> YES|NO
`;

  return text;
}

/**
 * Main skill function
 */
export async function recommendations(userId: string): Promise<SkillResponse> {
  try {
    const profile = await buildUserProfile(userId);
    const recs = await getRecommendations(userId);

    const text = formatRecommendations(recs, profile);

    return {
      text,
      mood: recs.forYou.length > 0 ? 'BULLISH' : 'NEUTRAL',
      data: { profile, recommendations: recs },
    };
  } catch (error) {
    console.error('[Recommendations] Error:', error);
    return {
      text: `❌ Failed to get recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

// CLI interface
if (require.main === module) {
  const userId = process.argv[2];

  if (!userId) {
    console.log('Usage: npx ts-node recommendations.ts <userId>');
    console.log('');
    console.log('Example: npx ts-node recommendations.ts abc123');
    process.exit(1);
  }

  recommendations(userId).then(result => {
    console.log(result.text);
  }).catch(console.error);
}

export { buildUserProfile, categorizeMarket, scoreMarketForUser };
