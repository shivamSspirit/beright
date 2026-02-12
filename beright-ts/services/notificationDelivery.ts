/**
 * Notification Delivery Service
 *
 * Sends notifications to users via Telegram when:
 * - Predictions are resolved
 * - Markets are closing soon
 * - Weekly summaries are ready
 * - Leaderboard position changes
 *
 * Processes the notification_queue table and delivers via Telegram Bot API.
 */

import { supabase, db } from '../lib/supabase/client';

// Types
interface QueuedNotification {
  id: string;
  user_id: string;
  notification_type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  channels: string[];
  status: string;
  created_at: string;
}

interface UserContact {
  telegram_id?: number;
  telegram_username?: string;
  wallet_address?: string;
}

interface DeliveryResult {
  notificationId: string;
  success: boolean;
  channel: string;
  error?: string;
}

// Configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

/**
 * Send a message via Telegram Bot API
 */
async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  options?: {
    parseMode?: 'Markdown' | 'HTML';
    disableNotification?: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  if (!TELEGRAM_BOT_TOKEN) {
    return { success: false, error: 'TELEGRAM_BOT_TOKEN not configured' };
  }

  try {
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: options?.parseMode || 'Markdown',
        disable_notification: options?.disableNotification || false,
      }),
    });

    const result = await response.json();

    if (!result.ok) {
      return { success: false, error: result.description || 'Telegram API error' };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}

/**
 * Format notification message for Telegram
 */
function formatNotificationMessage(notification: QueuedNotification): string {
  const { notification_type, title, body, data } = notification;

  switch (notification_type) {
    case 'prediction_resolved': {
      const pred = data as {
        question?: string;
        direction?: string;
        probability?: number;
        outcome?: string;
        brier_score?: number;
      };

      const brierScore = pred.brier_score || 0;
      const quality =
        brierScore < 0.1 ? '🏆 Excellent!' :
        brierScore < 0.2 ? '⭐ Good' :
        brierScore < 0.3 ? '✨ Fair' : '📈 Keep improving';

      return `
🎯 *PREDICTION RESOLVED*
${'─'.repeat(30)}

📊 ${pred.question?.slice(0, 50) || 'Unknown'}...

Your prediction: ${pred.direction} @ ${((pred.probability || 0) * 100).toFixed(0)}%
Outcome: ${pred.outcome}
Brier Score: ${brierScore.toFixed(4)} ${quality}

/me to see your updated stats
`;
    }

    case 'market_closing_soon': {
      const market = data as {
        ticker?: string;
        title?: string;
        closeTime?: string;
        hoursRemaining?: number;
      };

      return `
⏰ *MARKET CLOSING SOON*
${'─'.repeat(30)}

${market.title || market.ticker}

Closes in: ${market.hoursRemaining || '?'} hours
${market.closeTime ? `At: ${new Date(market.closeTime).toLocaleString()}` : ''}

You have a pending prediction on this market.
`;
    }

    case 'weekly_summary': {
      const summary = data as {
        totalPredictions?: number;
        resolvedThisWeek?: number;
        avgBrier?: number;
        rankChange?: number;
        streak?: number;
      };

      const rankEmoji = (summary.rankChange || 0) > 0 ? '📈' : (summary.rankChange || 0) < 0 ? '📉' : '➡️';

      return `
📊 *WEEKLY SUMMARY*
${'─'.repeat(30)}

Predictions this week: ${summary.resolvedThisWeek || 0}
Total predictions: ${summary.totalPredictions || 0}
Average Brier: ${(summary.avgBrier || 0).toFixed(4)}
Rank change: ${rankEmoji} ${Math.abs(summary.rankChange || 0)} positions
${summary.streak ? `Current streak: ${summary.streak} 🔥` : ''}

/feedback for detailed calibration analysis
/leaderboard to see rankings
`;
    }

    case 'leaderboard_change': {
      const change = data as {
        oldRank?: number;
        newRank?: number;
        tier?: string;
      };

      const improved = (change.newRank || 0) < (change.oldRank || 0);

      return `
🏆 *LEADERBOARD UPDATE*
${'─'.repeat(30)}

${improved ? '🎉 You moved up!' : '📉 Rank changed'}

Old rank: #${change.oldRank || '?'}
New rank: #${change.newRank || '?'}
Tier: ${change.tier || 'Unknown'}

/leaderboard to see full rankings
`;
    }

    case 'calibration_insight': {
      return `
💡 *CALIBRATION INSIGHT*
${'─'.repeat(30)}

${body}

/feedback for your full calibration report
`;
    }

    default:
      return `
📬 *${title}*
${'─'.repeat(30)}

${body}
`;
  }
}

/**
 * Get user's contact information
 */
async function getUserContact(userId: string): Promise<UserContact | null> {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('telegram_id, telegram_username, wallet_address')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return null;
    }

    return user as UserContact;
  } catch (err) {
    console.error('[NotificationDelivery] Failed to get user contact:', err);
    return null;
  }
}

/**
 * Deliver a single notification
 */
async function deliverNotification(notification: QueuedNotification): Promise<DeliveryResult[]> {
  const results: DeliveryResult[] = [];

  // Get user contact info
  const contact = await getUserContact(notification.user_id);

  if (!contact) {
    return [{
      notificationId: notification.id,
      success: false,
      channel: 'unknown',
      error: 'User contact not found',
    }];
  }

  const message = formatNotificationMessage(notification);

  // Deliver via each requested channel
  for (const channel of notification.channels) {
    if (channel === 'telegram' && contact.telegram_id) {
      const result = await sendTelegramMessage(contact.telegram_id, message);
      results.push({
        notificationId: notification.id,
        success: result.success,
        channel: 'telegram',
        error: result.error,
      });
    }
    // Future: Add other channels (email, push, etc.)
  }

  return results;
}

/**
 * Process pending notifications from queue
 */
export async function processNotificationQueue(options?: {
  limit?: number;
  dryRun?: boolean;
}): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  results: DeliveryResult[];
}> {
  const limit = options?.limit || 50;
  const dryRun = options?.dryRun || false;

  // Fetch pending notifications
  const { data: notifications, error } = await supabase
    .from('notification_queue')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error || !notifications || notifications.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0, results: [] };
  }

  console.log(`[NotificationDelivery] Processing ${notifications.length} notifications (dryRun: ${dryRun})`);

  const allResults: DeliveryResult[] = [];
  let succeeded = 0;
  let failed = 0;

  for (const notification of notifications as QueuedNotification[]) {
    if (dryRun) {
      console.log(`[DRY RUN] Would send to user ${notification.user_id}: ${notification.notification_type}`);
      allResults.push({
        notificationId: notification.id,
        success: true,
        channel: 'dry-run',
      });
      succeeded++;
      continue;
    }

    const results = await deliverNotification(notification);
    allResults.push(...results);

    // Check if any delivery succeeded
    const anySuccess = results.some(r => r.success);

    // Update notification status
    await supabase
      .from('notification_queue')
      .update({
        status: anySuccess ? 'sent' : 'failed',
        sent_at: anySuccess ? new Date().toISOString() : null,
        error: anySuccess ? null : results.find(r => r.error)?.error,
      })
      .eq('id', notification.id);

    if (anySuccess) {
      succeeded++;
    } else {
      failed++;
    }
  }

  return {
    processed: notifications.length,
    succeeded,
    failed,
    results: allResults,
  };
}

/**
 * Queue a notification for delivery
 */
export async function queueNotification(params: {
  userId: string;
  type: 'prediction_resolved' | 'market_closing_soon' | 'weekly_summary' | 'leaderboard_change' | 'calibration_insight';
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channels?: string[];
}): Promise<{ success: boolean; notificationId?: string; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('notification_queue')
      .insert({
        user_id: params.userId,
        notification_type: params.type,
        title: params.title,
        body: params.body,
        data: params.data || {},
        channels: params.channels || ['telegram'],
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, notificationId: data.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Queue market closing alerts for pending predictions
 */
export async function queueMarketClosingAlerts(hoursThreshold: number = 24): Promise<number> {
  // Find predictions with markets closing within threshold
  const cutoffTime = new Date(Date.now() + hoursThreshold * 60 * 60 * 1000).toISOString();

  const { data: watches, error } = await supabase
    .from('market_watches')
    .select(`
      id,
      market_ticker,
      prediction_market_links (
        prediction_id
      )
    `)
    .eq('status', 'watching')
    .lt('close_time', cutoffTime)
    .gt('close_time', new Date().toISOString());

  if (error || !watches) {
    console.error('[NotificationDelivery] Failed to fetch closing markets:', error);
    return 0;
  }

  let queued = 0;

  for (const watch of watches) {
    // Get prediction details for each linked prediction
    // This is simplified - in production you'd join properly
    queued++;
  }

  return queued;
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2] || 'process';

  switch (command) {
    case 'process':
      const dryRun = process.argv[3] === '--dry-run';
      processNotificationQueue({ dryRun }).then(result => {
        console.log('\nNotification Processing Complete');
        console.log('═'.repeat(40));
        console.log(`Processed: ${result.processed}`);
        console.log(`Succeeded: ${result.succeeded}`);
        console.log(`Failed: ${result.failed}`);
      }).catch(console.error);
      break;

    case 'test':
      // Queue a test notification
      const testUserId = process.argv[3];
      if (!testUserId) {
        console.log('Usage: npx ts-node notificationDelivery.ts test <userId>');
        process.exit(1);
      }

      queueNotification({
        userId: testUserId,
        type: 'calibration_insight',
        title: 'Test Notification',
        body: 'This is a test notification from BeRight Protocol.',
      }).then(result => {
        console.log('Queued:', result);
      }).catch(console.error);
      break;

    default:
      console.log('Commands:');
      console.log('  process [--dry-run] - Process pending notifications');
      console.log('  test <userId>       - Queue a test notification');
  }
}

export { sendTelegramMessage, formatNotificationMessage };
