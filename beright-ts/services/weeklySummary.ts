/**
 * Weekly Summary Service
 *
 * Generates and sends weekly performance summaries to users:
 * - Predictions made and resolved
 * - Calibration metrics
 * - Rank changes
 * - Insights and tips
 *
 * Should be run as a weekly cron job (e.g., Sunday 9am)
 */

import { supabase, db } from '../lib/supabase/client';
import { queueNotification } from './notificationDelivery';
import { generateFeedback } from '../skills/feedback';
import { interpretBrierScore } from '../lib/onchain/memo';

// Types
interface WeeklySummaryData {
  userId: string;
  username?: string;
  telegramId?: number;

  // Prediction stats
  predictionsThisWeek: number;
  resolvedThisWeek: number;
  pendingTotal: number;

  // Performance
  avgBrierThisWeek: number;
  avgBrierAllTime: number;
  brierTrend: 'improving' | 'stable' | 'declining';

  // Accuracy
  correctThisWeek: number;
  accuracyThisWeek: number;

  // Rank
  currentRank?: number;
  previousRank?: number;
  rankChange: number;
  tier: string;

  // Streaks
  currentStreak: number;
  streakType: 'win' | 'loss';

  // Highlights
  bestPrediction?: {
    question: string;
    brierScore: number;
    outcome: boolean;
  };
  worstPrediction?: {
    question: string;
    brierScore: number;
    outcome: boolean;
  };

  // Personalized insight
  insight: string;
}

/**
 * Get predictions from the last N days
 */
async function getPredictionsInRange(
  userId: string,
  days: number
): Promise<Array<{
  id: string;
  question: string;
  direction: string;
  predicted_probability: number;
  outcome: boolean | null;
  brier_score: number | null;
  created_at: string;
  resolved_at: string | null;
}>> {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('predictions')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', startDate)
    .order('created_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return data;
}

/**
 * Calculate user's rank from leaderboard
 */
async function getUserRank(userId: string): Promise<{ rank?: number; tier: string }> {
  try {
    const { data, error } = await supabase
      .from('leaderboard_v2')
      .select('rank, tier')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return { tier: 'bronze' };
    }

    return { rank: data.rank, tier: data.tier || 'bronze' };
  } catch {
    return { tier: 'bronze' };
  }
}

/**
 * Generate personalized insight based on performance
 */
function generateInsight(data: Partial<WeeklySummaryData>): string {
  const insights: string[] = [];

  // Brier score trend
  if (data.brierTrend === 'improving') {
    insights.push('Your calibration is improving - keep up the great work!');
  } else if (data.brierTrend === 'declining') {
    insights.push('Your recent predictions are less accurate. Consider checking base rates before predicting.');
  }

  // High activity
  if ((data.predictionsThisWeek || 0) >= 10) {
    insights.push('High activity week! Volume helps build a better track record.');
  } else if ((data.predictionsThisWeek || 0) === 0) {
    insights.push('No predictions this week. Stay engaged to maintain your edge!');
  }

  // Accuracy
  if ((data.accuracyThisWeek || 0) > 0.7) {
    insights.push('Strong accuracy this week. Consider taking on more challenging predictions.');
  } else if ((data.accuracyThisWeek || 0) < 0.4 && (data.resolvedThisWeek || 0) >= 5) {
    insights.push('Accuracy is below 50%. Try predicting closer to base rates.');
  }

  // Rank movement
  if ((data.rankChange || 0) > 5) {
    insights.push(`You climbed ${data.rankChange} spots on the leaderboard!`);
  } else if ((data.rankChange || 0) < -5) {
    insights.push('You dropped in the rankings. Focus on quality over quantity.');
  }

  // Streak
  if (data.streakType === 'win' && (data.currentStreak || 0) >= 5) {
    insights.push(`${data.currentStreak} correct predictions in a row! 🔥`);
  }

  // Default
  if (insights.length === 0) {
    insights.push('Keep making predictions to improve your calibration!');
  }

  return insights[0];
}

/**
 * Generate weekly summary for a user
 */
export async function generateWeeklySummary(userId: string): Promise<WeeklySummaryData | null> {
  try {
    // Get user info
    const user = await db.users.getById(userId);
    if (!user) return null;

    // Get this week's predictions
    const weekPredictions = await getPredictionsInRange(userId, 7);
    const resolvedThisWeek = weekPredictions.filter(p => p.resolved_at !== null);

    // Get all-time stats
    const allPredictions = await db.predictions.getByUser(userId);
    const allResolved = allPredictions.filter(p => p.resolved_at !== null);

    // Calculate weekly Brier
    const weekBriers = resolvedThisWeek
      .map(p => p.brier_score)
      .filter((b): b is number => b !== null);
    const avgBrierThisWeek = weekBriers.length > 0
      ? weekBriers.reduce((a, b) => a + b, 0) / weekBriers.length
      : 0;

    // Calculate all-time Brier
    const allBriers = allResolved
      .map(p => p.brier_score)
      .filter((b): b is number => b !== null && b !== undefined);
    const avgBrierAllTime = allBriers.length > 0
      ? allBriers.reduce((a, b) => a + b, 0) / allBriers.length
      : 0;

    // Calculate accuracy this week
    const correctThisWeek = resolvedThisWeek.filter(p =>
      (p.direction === 'YES') === p.outcome
    ).length;
    const accuracyThisWeek = resolvedThisWeek.length > 0
      ? correctThisWeek / resolvedThisWeek.length
      : 0;

    // Determine trend
    let brierTrend: 'improving' | 'stable' | 'declining' = 'stable';
    if (avgBrierThisWeek < avgBrierAllTime - 0.03) brierTrend = 'improving';
    if (avgBrierThisWeek > avgBrierAllTime + 0.03) brierTrend = 'declining';

    // Get rank info
    const rankInfo = await getUserRank(userId);

    // Find best/worst predictions this week
    const sortedByBrier = [...resolvedThisWeek]
      .filter(p => p.brier_score !== null)
      .sort((a, b) => (a.brier_score || 0) - (b.brier_score || 0));

    const bestPrediction = sortedByBrier[0] ? {
      question: sortedByBrier[0].question,
      brierScore: sortedByBrier[0].brier_score || 0,
      outcome: sortedByBrier[0].outcome || false,
    } : undefined;

    const worstPrediction = sortedByBrier[sortedByBrier.length - 1] ? {
      question: sortedByBrier[sortedByBrier.length - 1].question,
      brierScore: sortedByBrier[sortedByBrier.length - 1].brier_score || 0,
      outcome: sortedByBrier[sortedByBrier.length - 1].outcome || false,
    } : undefined;

    // Calculate streak
    let streak = 0;
    let streakType: 'win' | 'loss' = 'win';
    const sortedByTime = [...allResolved].sort(
      (a, b) => new Date(b.resolved_at!).getTime() - new Date(a.resolved_at!).getTime()
    );

    for (const p of sortedByTime) {
      const isCorrect = (p.direction === 'YES') === p.outcome;
      if (streak === 0) {
        streakType = isCorrect ? 'win' : 'loss';
        streak = 1;
      } else if ((streakType === 'win' && isCorrect) || (streakType === 'loss' && !isCorrect)) {
        streak++;
      } else {
        break;
      }
    }

    // Pending count
    const pendingTotal = allPredictions.filter(p => p.resolved_at === null).length;

    const summaryData: WeeklySummaryData = {
      userId,
      username: user.telegram_username || undefined,
      telegramId: user.telegram_id || undefined,

      predictionsThisWeek: weekPredictions.length,
      resolvedThisWeek: resolvedThisWeek.length,
      pendingTotal,

      avgBrierThisWeek,
      avgBrierAllTime,
      brierTrend,

      correctThisWeek,
      accuracyThisWeek,

      currentRank: rankInfo.rank,
      rankChange: 0, // Would need historical data to calculate
      tier: rankInfo.tier,

      currentStreak: streak,
      streakType,

      bestPrediction,
      worstPrediction,

      insight: '',
    };

    summaryData.insight = generateInsight(summaryData);

    return summaryData;
  } catch (err) {
    console.error('[WeeklySummary] Error generating summary:', err);
    return null;
  }
}

/**
 * Format weekly summary as text
 */
export function formatWeeklySummary(data: WeeklySummaryData): string {
  const trendEmoji = data.brierTrend === 'improving' ? '📈' : data.brierTrend === 'declining' ? '📉' : '➡️';
  const tierEmoji =
    data.tier === 'diamond' ? '💎' :
    data.tier === 'platinum' ? '🏆' :
    data.tier === 'gold' ? '🥇' :
    data.tier === 'silver' ? '🥈' : '🥉';

  let text = `
📊 *WEEKLY SUMMARY*
${'═'.repeat(50)}
${data.username ? `@${data.username}` : 'Forecaster'}

📈 *THIS WEEK*
${'─'.repeat(40)}
Predictions made: ${data.predictionsThisWeek}
Predictions resolved: ${data.resolvedThisWeek}
Correct: ${data.correctThisWeek} (${(data.accuracyThisWeek * 100).toFixed(0)}%)
Avg Brier: ${data.avgBrierThisWeek.toFixed(4)} ${trendEmoji}

📊 *ALL-TIME*
${'─'.repeat(40)}
Avg Brier: ${data.avgBrierAllTime.toFixed(4)}
Pending: ${data.pendingTotal} predictions
Streak: ${data.currentStreak} ${data.streakType === 'win' ? 'wins 🔥' : 'losses'}

🏆 *RANKING*
${'─'.repeat(40)}
Tier: ${tierEmoji} ${data.tier.toUpperCase()}
${data.currentRank ? `Rank: #${data.currentRank}` : 'Unranked (need 5+ resolved)'}
`;

  if (data.bestPrediction) {
    text += `
⭐ *BEST PREDICTION*
"${data.bestPrediction.question.slice(0, 40)}..."
Brier: ${data.bestPrediction.brierScore.toFixed(4)}
`;
  }

  text += `
💡 *INSIGHT*
${data.insight}

/feedback for detailed calibration analysis
/leaderboard to see full rankings
`;

  return text;
}

/**
 * Generate and queue summaries for all active users
 */
export async function generateAllWeeklySummaries(options?: {
  dryRun?: boolean;
  onlySubscribed?: boolean;
}): Promise<{
  total: number;
  generated: number;
  queued: number;
  errors: number;
}> {
  const stats = { total: 0, generated: 0, queued: 0, errors: 0 };

  // Get all users with predictions in the last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: activeUsers, error } = await supabase
    .from('predictions')
    .select('user_id')
    .gte('created_at', thirtyDaysAgo)
    .not('user_id', 'is', null);

  if (error || !activeUsers) {
    console.error('[WeeklySummary] Failed to get active users:', error);
    return stats;
  }

  // Dedupe user IDs
  const userIds = [...new Set(activeUsers.map(p => p.user_id))].filter(Boolean) as string[];
  stats.total = userIds.length;

  console.log(`[WeeklySummary] Generating summaries for ${userIds.length} active users`);

  for (const userId of userIds) {
    try {
      const summary = await generateWeeklySummary(userId);

      if (!summary) {
        stats.errors++;
        continue;
      }

      stats.generated++;

      if (options?.dryRun) {
        console.log(`[DRY RUN] Would queue summary for ${summary.username || userId}`);
        continue;
      }

      // Queue notification
      const result = await queueNotification({
        userId,
        type: 'weekly_summary',
        title: 'Your Weekly Summary',
        body: formatWeeklySummary(summary),
        data: {
          totalPredictions: summary.predictionsThisWeek + summary.pendingTotal,
          resolvedThisWeek: summary.resolvedThisWeek,
          avgBrier: summary.avgBrierThisWeek,
          rankChange: summary.rankChange,
          streak: summary.currentStreak,
        },
      });

      if (result.success) {
        stats.queued++;
      } else {
        stats.errors++;
      }
    } catch (err) {
      console.error(`[WeeklySummary] Error for user ${userId}:`, err);
      stats.errors++;
    }
  }

  return stats;
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2] || 'generate-all';
  const dryRun = process.argv.includes('--dry-run');

  switch (command) {
    case 'user':
      const userId = process.argv[3];
      if (!userId) {
        console.log('Usage: npx ts-node weeklySummary.ts user <userId>');
        process.exit(1);
      }

      generateWeeklySummary(userId).then(summary => {
        if (!summary) {
          console.log('No summary generated (user not found or no data)');
          return;
        }
        console.log(formatWeeklySummary(summary));
      }).catch(console.error);
      break;

    case 'generate-all':
      generateAllWeeklySummaries({ dryRun }).then(stats => {
        console.log('\nWeekly Summary Generation Complete');
        console.log('═'.repeat(40));
        console.log(`Total users: ${stats.total}`);
        console.log(`Generated: ${stats.generated}`);
        console.log(`Queued: ${stats.queued}`);
        console.log(`Errors: ${stats.errors}`);
      }).catch(console.error);
      break;

    default:
      console.log('Commands:');
      console.log('  user <userId>           - Generate summary for one user');
      console.log('  generate-all [--dry-run] - Generate all summaries');
  }
}
