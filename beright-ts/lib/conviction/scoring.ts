/**
 * BeRight Conviction - Scoring System
 *
 * Calculates conviction scores for projects based on their
 * stake history, success rate, and community engagement.
 */

import { supabaseAdmin, isSupabaseConfigured } from '../supabase/client';
import {
  ConvictionScore,
  ConvictionScoreComponents,
  ConvictionProject,
  ConvictionMarket,
} from './types';
import { getProjectById } from './projects';

// ============================================================================
// SCORING WEIGHTS
// ============================================================================

/**
 * Maximum points for each scoring component
 */
const SCORE_WEIGHTS = {
  stakeAmount: 25,     // How much total SOL staked
  successRate: 25,     // % of milestones hit
  marketCount: 15,     // Number of markets created
  stakeRatio: 15,      // Stake relative to typical project size
  communityTrust: 10,  // Trading volume and participation
  aiVisibility: 10,    // GEO score
};

/**
 * Thresholds for stake amount scoring
 */
const STAKE_THRESHOLDS = {
  low: 10,      // 10 SOL = 5 points
  medium: 50,   // 50 SOL = 15 points
  high: 200,    // 200 SOL = 20 points
  veryHigh: 500, // 500+ SOL = 25 points
};

/**
 * Thresholds for market count scoring
 */
const MARKET_COUNT_THRESHOLDS = {
  few: 2,       // 2 markets = 5 points
  some: 5,      // 5 markets = 10 points
  many: 10,     // 10+ markets = 15 points
};

// ============================================================================
// COMPONENT CALCULATIONS
// ============================================================================

/**
 * Calculate stake amount score (0-25 points)
 */
function calculateStakeScore(totalStaked: number): number {
  if (totalStaked >= STAKE_THRESHOLDS.veryHigh) return SCORE_WEIGHTS.stakeAmount;
  if (totalStaked >= STAKE_THRESHOLDS.high) return 20;
  if (totalStaked >= STAKE_THRESHOLDS.medium) return 15;
  if (totalStaked >= STAKE_THRESHOLDS.low) return 5;

  // Linear interpolation for small amounts
  return Math.floor((totalStaked / STAKE_THRESHOLDS.low) * 5);
}

/**
 * Calculate success rate score (0-25 points)
 */
function calculateSuccessRateScore(successRate: number): number {
  // successRate is 0-100
  return Math.floor((successRate / 100) * SCORE_WEIGHTS.successRate);
}

/**
 * Calculate market count score (0-15 points)
 */
function calculateMarketCountScore(marketsCreated: number): number {
  if (marketsCreated >= MARKET_COUNT_THRESHOLDS.many) return SCORE_WEIGHTS.marketCount;
  if (marketsCreated >= MARKET_COUNT_THRESHOLDS.some) return 10;
  if (marketsCreated >= MARKET_COUNT_THRESHOLDS.few) return 5;

  // 1 market = 2 points
  return Math.min(marketsCreated * 2, 5);
}

/**
 * Calculate stake ratio score (0-15 points)
 * Compares stake to average stake in the ecosystem
 */
function calculateStakeRatioScore(
  totalStaked: number,
  averageStake: number
): number {
  if (averageStake === 0) return 0;

  const ratio = totalStaked / averageStake;

  if (ratio >= 3) return SCORE_WEIGHTS.stakeRatio;
  if (ratio >= 2) return 12;
  if (ratio >= 1) return 8;
  if (ratio >= 0.5) return 4;

  return Math.floor(ratio * 8);
}

/**
 * Calculate community trust score (0-10 points)
 * Based on trading volume and number of traders
 */
function calculateCommunityTrustScore(
  totalVolume: number,
  tradeCount: number
): number {
  // Volume component (0-5 points)
  let volumeScore = 0;
  if (totalVolume >= 100000) volumeScore = 5;
  else if (totalVolume >= 50000) volumeScore = 4;
  else if (totalVolume >= 10000) volumeScore = 3;
  else if (totalVolume >= 1000) volumeScore = 2;
  else if (totalVolume > 0) volumeScore = 1;

  // Trade count component (0-5 points)
  let tradeScore = 0;
  if (tradeCount >= 100) tradeScore = 5;
  else if (tradeCount >= 50) tradeScore = 4;
  else if (tradeCount >= 20) tradeScore = 3;
  else if (tradeCount >= 10) tradeScore = 2;
  else if (tradeCount > 0) tradeScore = 1;

  return volumeScore + tradeScore;
}

/**
 * Calculate AI visibility score (0-10 points)
 */
function calculateAIVisibilityScore(geoScore: number | undefined): number {
  if (!geoScore) return 0;

  // GEO score is 0-100, convert to 0-10
  return Math.floor(geoScore / 10);
}

// ============================================================================
// MAIN SCORING FUNCTION
// ============================================================================

/**
 * Calculate full conviction score for a project
 */
export async function calculateConvictionScore(
  projectId: string
): Promise<ConvictionScore> {
  if (!isSupabaseConfigured) {
    return createEmptyScore(projectId);
  }

  // Get project data
  const project = await getProjectById(projectId);
  if (!project) {
    return createEmptyScore(projectId);
  }

  // Get project's markets for volume/trade calculations
  const { data: markets } = await supabaseAdmin
    .from('conviction_markets')
    .select('volume, trade_count')
    .eq('project_id', projectId);

  const totalVolume = markets?.reduce((sum, m) => sum + (m.volume || 0), 0) || 0;
  const totalTrades = markets?.reduce((sum, m) => sum + (m.trade_count || 0), 0) || 0;

  // Get average stake across all projects for ratio calculation
  const { data: allProjects } = await supabaseAdmin
    .from('conviction_projects')
    .select('total_staked')
    .gt('total_staked', 0);

  const averageStake = allProjects && allProjects.length > 0
    ? allProjects.reduce((sum, p) => sum + p.total_staked, 0) / allProjects.length
    : 50; // Default to 50 SOL if no data

  // Calculate component scores
  const components: ConvictionScoreComponents = {
    stakeAmount: calculateStakeScore(project.totalStaked),
    successRate: calculateSuccessRateScore(project.successRate),
    marketCount: calculateMarketCountScore(project.marketsCreated),
    stakeRatio: calculateStakeRatioScore(project.totalStaked, averageStake),
    communityTrust: calculateCommunityTrustScore(totalVolume, totalTrades),
    aiVisibility: calculateAIVisibilityScore(project.geoScore),
  };

  // Calculate overall score (sum of components)
  const overall = Object.values(components).reduce((sum, val) => sum + val, 0);

  // Calculate percentile (how this project ranks)
  const percentile = await calculatePercentile(overall);

  // Determine trend (compare to previous score)
  const trend = await calculateTrend(projectId, overall);

  const score: ConvictionScore = {
    projectId,
    overall,
    components,
    trend,
    percentile,
    calculatedAt: new Date(),
  };

  // Store score history (optional)
  await storeScoreHistory(score);

  return score;
}

/**
 * Calculate percentile rank for a score
 */
async function calculatePercentile(score: number): Promise<number> {
  if (!isSupabaseConfigured) {
    return 50;
  }

  const { data: allScores } = await supabaseAdmin
    .from('conviction_projects')
    .select('conviction_score')
    .gt('conviction_score', 0);

  if (!allScores || allScores.length === 0) {
    return 50;
  }

  const sortedScores = allScores
    .map((p) => p.conviction_score)
    .sort((a, b) => a - b);

  const position = sortedScores.findIndex((s) => s >= score);

  if (position === -1) {
    return 100;
  }

  return Math.round((position / sortedScores.length) * 100);
}

/**
 * Calculate trend by comparing to previous score
 */
async function calculateTrend(
  projectId: string,
  currentScore: number
): Promise<'up' | 'down' | 'stable'> {
  if (!isSupabaseConfigured) {
    return 'stable';
  }

  // Get previous score from history
  const { data: history } = await supabaseAdmin
    .from('conviction_score_history')
    .select('score')
    .eq('project_id', projectId)
    .order('calculated_at', { ascending: false })
    .limit(1);

  if (!history || history.length === 0) {
    return 'stable';
  }

  const previousScore = history[0].score;
  const diff = currentScore - previousScore;

  if (diff > 2) return 'up';
  if (diff < -2) return 'down';
  return 'stable';
}

/**
 * Store score in history table
 */
async function storeScoreHistory(score: ConvictionScore): Promise<void> {
  if (!isSupabaseConfigured) {
    return;
  }

  try {
    await supabaseAdmin
      .from('conviction_score_history')
      .insert({
        project_id: score.projectId,
        score: score.overall,
        components: score.components,
        calculated_at: score.calculatedAt.toISOString(),
      });
  } catch (error) {
    // Non-critical, just log
    console.warn('Failed to store score history:', error);
  }
}

/**
 * Create empty score for projects without data
 */
function createEmptyScore(projectId: string): ConvictionScore {
  return {
    projectId,
    overall: 0,
    components: {
      stakeAmount: 0,
      successRate: 0,
      marketCount: 0,
      stakeRatio: 0,
      communityTrust: 0,
      aiVisibility: 0,
    },
    trend: 'stable',
    percentile: 0,
    calculatedAt: new Date(),
  };
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * Recalculate scores for all projects
 */
export async function recalculateAllScores(): Promise<number> {
  if (!isSupabaseConfigured) {
    return 0;
  }

  const { data: projects } = await supabaseAdmin
    .from('conviction_projects')
    .select('id');

  if (!projects) {
    return 0;
  }

  let updated = 0;
  for (const project of projects) {
    const score = await calculateConvictionScore(project.id);

    await supabaseAdmin
      .from('conviction_projects')
      .update({
        conviction_score: score.overall,
        updated_at: new Date().toISOString(),
      })
      .eq('id', project.id);

    updated++;
  }

  return updated;
}

/**
 * Get top projects by conviction score
 */
export async function getTopProjects(
  limit: number = 10
): Promise<Array<{ projectId: string; score: ConvictionScore }>> {
  if (!isSupabaseConfigured) {
    return [];
  }

  const { data: projects } = await supabaseAdmin
    .from('conviction_projects')
    .select('id')
    .order('conviction_score', { ascending: false })
    .limit(limit);

  if (!projects) {
    return [];
  }

  const results: Array<{ projectId: string; score: ConvictionScore }> = [];

  for (const project of projects) {
    const score = await calculateConvictionScore(project.id);
    results.push({ projectId: project.id, score });
  }

  return results;
}

/**
 * Get score history for a project
 */
export async function getScoreHistory(
  projectId: string,
  days: number = 30
): Promise<Array<{ date: Date; score: number }>> {
  if (!isSupabaseConfigured) {
    return [];
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const { data } = await supabaseAdmin
    .from('conviction_score_history')
    .select('score, calculated_at')
    .eq('project_id', projectId)
    .gte('calculated_at', cutoff.toISOString())
    .order('calculated_at', { ascending: true });

  return (data || []).map((row) => ({
    date: new Date(row.calculated_at),
    score: row.score,
  }));
}

// ============================================================================
// EXPORTS
// ============================================================================

export const scoring = {
  calculate: calculateConvictionScore,
  recalculateAll: recalculateAllScores,
  getTop: getTopProjects,
  getHistory: getScoreHistory,
};
