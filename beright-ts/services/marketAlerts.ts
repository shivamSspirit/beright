/**
 * Market Alerts Service
 *
 * Monitors markets and sends alerts when:
 * - Markets with user predictions are closing soon (24h, 6h, 1h)
 * - Significant price movements occur on watched markets
 * - New markets matching user interests appear
 *
 * Should be run periodically (e.g., every hour)
 */

import { supabase, db } from '../lib/supabase/client';
import { searchEvents, getMarket, checkMarketResolutions } from '../lib/dflow/api';
import { queueNotification } from './notificationDelivery';

// Types
interface PendingPredictionWithMarket {
  predictionId: string;
  userId: string;
  question: string;
  direction: string;
  probability: number;
  marketId: string;
  marketTicker?: string;
  marketCloseTime?: string;
}

interface MarketAlert {
  type: 'closing_soon' | 'price_movement' | 'resolved';
  userId: string;
  marketTicker: string;
  marketTitle: string;
  predictionId: string;
  data: Record<string, unknown>;
}

// Alert thresholds
const ALERT_WINDOWS = [
  { hours: 24, label: '24 hours', priority: 'low' },
  { hours: 6, label: '6 hours', priority: 'medium' },
  { hours: 1, label: '1 hour', priority: 'high' },
];

/**
 * Get all pending predictions with market info
 */
async function getPendingPredictionsWithMarkets(): Promise<PendingPredictionWithMarket[]> {
  const { data, error } = await supabase
    .from('predictions')
    .select('*')
    .is('resolved_at', null)
    .not('market_id', 'is', null);

  if (error || !data) {
    console.error('[MarketAlerts] Failed to get pending predictions:', error);
    return [];
  }

  return data.map(p => ({
    predictionId: p.id,
    userId: p.user_id,
    question: p.question,
    direction: p.direction || 'YES',
    probability: p.predicted_probability,
    marketId: p.market_id,
    marketTicker: p.market_id, // Using market_id as ticker for now
    marketCloseTime: undefined, // Will be populated from DFlow
  }));
}

/**
 * Get market close times from DFlow
 */
async function enrichWithMarketData(
  predictions: PendingPredictionWithMarket[]
): Promise<PendingPredictionWithMarket[]> {
  // Group by market to avoid duplicate API calls
  const marketTickers = [...new Set(predictions.map(p => p.marketTicker).filter(Boolean))];

  const marketData: Map<string, { closeTime?: string; title?: string; yesPrice?: number }> = new Map();

  for (const ticker of marketTickers) {
    if (!ticker) continue;

    try {
      const result = await getMarket(ticker);
      if (result.success && result.data) {
        marketData.set(ticker, {
          closeTime: result.data.closeTime,
          title: result.data.title,
          yesPrice: result.data.yesBid ? parseFloat(result.data.yesBid) : undefined,
        });
      }
    } catch (err) {
      console.warn(`[MarketAlerts] Failed to get market ${ticker}:`, err);
    }
  }

  // Enrich predictions
  return predictions.map(p => {
    const data = marketData.get(p.marketTicker || '');
    return {
      ...p,
      marketCloseTime: data?.closeTime,
    };
  });
}

/**
 * Check which predictions need closing alerts
 */
function findClosingAlerts(
  predictions: PendingPredictionWithMarket[],
  alreadyAlerted: Set<string> // Set of "predictionId:hoursWindow"
): MarketAlert[] {
  const alerts: MarketAlert[] = [];
  const now = Date.now();

  for (const pred of predictions) {
    if (!pred.marketCloseTime) continue;

    const closeTime = new Date(pred.marketCloseTime).getTime();
    const hoursUntilClose = (closeTime - now) / (1000 * 60 * 60);

    if (hoursUntilClose <= 0) continue; // Already closed

    // Check each alert window
    for (const window of ALERT_WINDOWS) {
      const alertKey = `${pred.predictionId}:${window.hours}`;

      // Skip if already alerted for this window
      if (alreadyAlerted.has(alertKey)) continue;

      // Check if we're within this window but not the next smaller one
      const nextWindow = ALERT_WINDOWS.find(w => w.hours < window.hours);
      const withinWindow = hoursUntilClose <= window.hours;
      const notInNextWindow = !nextWindow || hoursUntilClose > nextWindow.hours;

      if (withinWindow && notInNextWindow) {
        alerts.push({
          type: 'closing_soon',
          userId: pred.userId,
          marketTicker: pred.marketTicker || pred.marketId,
          marketTitle: pred.question,
          predictionId: pred.predictionId,
          data: {
            hoursRemaining: Math.round(hoursUntilClose),
            closeTime: pred.marketCloseTime,
            direction: pred.direction,
            probability: pred.probability,
            priority: window.priority,
            windowLabel: window.label,
          },
        });
      }
    }
  }

  return alerts;
}

/**
 * Get set of alerts already sent (from notification_queue)
 */
async function getAlreadyAlerted(): Promise<Set<string>> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('notification_queue')
    .select('data')
    .eq('notification_type', 'market_closing_soon')
    .gte('created_at', oneDayAgo);

  if (error || !data) {
    return new Set();
  }

  const alertKeys = new Set<string>();
  for (const row of data) {
    const d = row.data as { predictionId?: string; windowLabel?: string };
    if (d.predictionId && d.windowLabel) {
      // Convert window label to hours
      const hours =
        d.windowLabel === '24 hours' ? 24 :
        d.windowLabel === '6 hours' ? 6 :
        d.windowLabel === '1 hour' ? 1 : 0;
      alertKeys.add(`${d.predictionId}:${hours}`);
    }
  }

  return alertKeys;
}

/**
 * Queue market closing alerts
 */
async function queueClosingAlerts(alerts: MarketAlert[]): Promise<number> {
  let queued = 0;

  for (const alert of alerts) {
    const data = alert.data as {
      hoursRemaining: number;
      closeTime: string;
      direction: string;
      probability: number;
      windowLabel: string;
    };

    const result = await queueNotification({
      userId: alert.userId,
      type: 'market_closing_soon',
      title: `Market Closing in ${data.windowLabel}`,
      body: `Your prediction on "${alert.marketTitle.slice(0, 50)}..." is closing soon.

You predicted: ${data.direction} @ ${(data.probability * 100).toFixed(0)}%
Closes: ${new Date(data.closeTime).toLocaleString()}

This is your last chance to review before resolution!`,
      data: {
        ...data,
        predictionId: alert.predictionId,
        marketTicker: alert.marketTicker,
      },
    });

    if (result.success) {
      queued++;
    }
  }

  return queued;
}

/**
 * Main function: Check all markets and queue alerts
 */
export async function checkAndQueueAlerts(options?: {
  dryRun?: boolean;
}): Promise<{
  predictionsChecked: number;
  alertsFound: number;
  alertsQueued: number;
}> {
  console.log('[MarketAlerts] Checking for market closing alerts...');

  // Get pending predictions
  const predictions = await getPendingPredictionsWithMarkets();
  console.log(`[MarketAlerts] Found ${predictions.length} pending predictions`);

  // Enrich with market data
  const enriched = await enrichWithMarketData(predictions);
  const withCloseTime = enriched.filter(p => p.marketCloseTime);
  console.log(`[MarketAlerts] ${withCloseTime.length} have close times from DFlow`);

  // Get already alerted
  const alreadyAlerted = await getAlreadyAlerted();
  console.log(`[MarketAlerts] ${alreadyAlerted.size} alerts already sent in last 24h`);

  // Find new alerts needed
  const alerts = findClosingAlerts(withCloseTime, alreadyAlerted);
  console.log(`[MarketAlerts] Found ${alerts.length} new alerts to send`);

  if (options?.dryRun) {
    for (const alert of alerts) {
      const data = alert.data as { windowLabel: string; hoursRemaining: number };
      console.log(`[DRY RUN] Would alert ${alert.userId}: ${alert.marketTitle.slice(0, 30)}... (${data.windowLabel})`);
    }
    return {
      predictionsChecked: predictions.length,
      alertsFound: alerts.length,
      alertsQueued: 0,
    };
  }

  // Queue alerts
  const queued = await queueClosingAlerts(alerts);

  return {
    predictionsChecked: predictions.length,
    alertsFound: alerts.length,
    alertsQueued: queued,
  };
}

/**
 * Check for significant price movements
 */
export async function checkPriceMovements(
  thresholdPercent: number = 10
): Promise<{
  marketsChecked: number;
  movementsDetected: number;
}> {
  // This would compare current prices to prices stored when prediction was made
  // For now, this is a placeholder for future implementation

  console.log('[MarketAlerts] Price movement checking not yet implemented');

  return {
    marketsChecked: 0,
    movementsDetected: 0,
  };
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2] || 'check';
  const dryRun = process.argv.includes('--dry-run');

  switch (command) {
    case 'check':
      checkAndQueueAlerts({ dryRun }).then(result => {
        console.log('\nMarket Alert Check Complete');
        console.log('═'.repeat(40));
        console.log(`Predictions checked: ${result.predictionsChecked}`);
        console.log(`Alerts found: ${result.alertsFound}`);
        console.log(`Alerts queued: ${result.alertsQueued}`);
      }).catch(console.error);
      break;

    case 'prices':
      checkPriceMovements().then(result => {
        console.log('\nPrice Movement Check Complete');
        console.log('═'.repeat(40));
        console.log(`Markets checked: ${result.marketsChecked}`);
        console.log(`Movements detected: ${result.movementsDetected}`);
      }).catch(console.error);
      break;

    default:
      console.log('Commands:');
      console.log('  check [--dry-run]  - Check for closing market alerts');
      console.log('  prices            - Check for price movements');
  }
}

export { getPendingPredictionsWithMarkets, findClosingAlerts };
