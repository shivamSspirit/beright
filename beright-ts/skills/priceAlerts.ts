/**
 * Price Alert System for BeRight Protocol
 * Watch markets and alert when prices hit thresholds
 *
 * Commands:
 * /alert BTC>100K below 80 - Alert when YES drops below 80%
 * /alert fed rate above 60 - Alert when YES rises above 60%
 * /alerts - View all active alerts
 * /alert delete <id> - Remove an alert
 */

import * as fs from 'fs';
import * as path from 'path';
import { SkillResponse, Market, Platform } from '../types/index';
import { searchMarkets } from './markets';
import { formatPct, timestamp } from './utils';

const MEMORY_DIR = path.join(process.cwd(), 'memory');
const ALERTS_FILE = path.join(MEMORY_DIR, 'price-alerts.json');
const TRIGGERED_FILE = path.join(MEMORY_DIR, 'triggered-alerts.json');

// ============================================
// TYPES
// ============================================

export interface PriceAlert {
  id: string;
  telegramId: string;
  marketQuery: string;        // Search query to find market
  marketId?: string;          // Cached market ID once found
  marketTitle?: string;       // Cached title
  platform?: Platform;
  direction: 'YES' | 'NO';    // Which price to watch
  condition: 'above' | 'below';
  threshold: number;          // Price threshold (0-100)
  currentPrice?: number;      // Last known price
  status: 'active' | 'triggered' | 'expired' | 'deleted';
  createdAt: string;
  triggeredAt?: string;
  expiresAt?: string;         // Optional expiry
  repeatAfter?: number;       // Minutes before alert can re-trigger
  lastTriggered?: string;
  triggerCount: number;
}

export interface TriggeredAlert {
  alertId: string;
  telegramId: string;
  marketTitle: string;
  direction: 'YES' | 'NO';
  condition: 'above' | 'below';
  threshold: number;
  priceAtTrigger: number;
  timestamp: string;
  delivered: boolean;
}

// ============================================
// STORAGE
// ============================================

function loadAlerts(): PriceAlert[] {
  try {
    if (fs.existsSync(ALERTS_FILE)) {
      return JSON.parse(fs.readFileSync(ALERTS_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('Error loading price alerts:', error);
  }
  return [];
}

function saveAlerts(alerts: PriceAlert[]): void {
  try {
    if (!fs.existsSync(MEMORY_DIR)) {
      fs.mkdirSync(MEMORY_DIR, { recursive: true });
    }
    fs.writeFileSync(ALERTS_FILE, JSON.stringify(alerts, null, 2));
  } catch (error) {
    console.error('Error saving price alerts:', error);
  }
}

function loadTriggered(): TriggeredAlert[] {
  try {
    if (fs.existsSync(TRIGGERED_FILE)) {
      return JSON.parse(fs.readFileSync(TRIGGERED_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('Error loading triggered alerts:', error);
  }
  return [];
}

function saveTriggered(triggered: TriggeredAlert[]): void {
  try {
    fs.writeFileSync(TRIGGERED_FILE, JSON.stringify(triggered, null, 2));
  } catch (error) {
    console.error('Error saving triggered alerts:', error);
  }
}

// ============================================
// ALERT MANAGEMENT
// ============================================

/**
 * Create a new price alert
 */
export async function createAlert(
  telegramId: string,
  marketQuery: string,
  condition: 'above' | 'below',
  threshold: number,
  direction: 'YES' | 'NO' = 'YES',
  expiresInDays?: number
): Promise<PriceAlert> {
  const alerts = loadAlerts();

  // Try to find the market
  const markets = await searchMarkets(marketQuery, ['polymarket', 'kalshi', 'manifold']);
  const market = markets[0]; // Best match

  const alert: PriceAlert = {
    id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    telegramId,
    marketQuery,
    marketId: market?.marketId ?? undefined,
    marketTitle: market?.title,
    platform: market?.platform,
    direction,
    condition,
    threshold,
    currentPrice: market ? (direction === 'YES' ? market.yesPrice : market.noPrice) * 100 : undefined,
    status: 'active',
    createdAt: timestamp(),
    expiresAt: expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : undefined,
    triggerCount: 0,
  };

  alerts.push(alert);
  saveAlerts(alerts);

  return alert;
}

/**
 * Delete an alert
 */
export function deleteAlert(telegramId: string, alertId: string): boolean {
  const alerts = loadAlerts();
  const index = alerts.findIndex(a => a.id === alertId && a.telegramId === telegramId);

  if (index === -1) return false;

  alerts[index].status = 'deleted';
  saveAlerts(alerts);
  return true;
}

/**
 * Get user's active alerts
 */
export function getUserAlerts(telegramId: string): PriceAlert[] {
  const alerts = loadAlerts();
  return alerts.filter(a => a.telegramId === telegramId && a.status === 'active');
}

/**
 * Check all alerts against current prices
 * Returns alerts that should be triggered
 */
export async function checkAlerts(): Promise<TriggeredAlert[]> {
  const alerts = loadAlerts();
  const triggered = loadTriggered();
  const newTriggers: TriggeredAlert[] = [];

  const activeAlerts = alerts.filter(a => a.status === 'active');

  // Group by market query to minimize API calls
  const alertsByQuery = new Map<string, PriceAlert[]>();
  for (const alert of activeAlerts) {
    const key = alert.marketQuery.toLowerCase();
    if (!alertsByQuery.has(key)) {
      alertsByQuery.set(key, []);
    }
    alertsByQuery.get(key)!.push(alert);
  }

  // Check each unique query
  for (const [query, queryAlerts] of alertsByQuery) {
    try {
      const markets = await searchMarkets(query, ['polymarket', 'kalshi', 'manifold']);

      for (const alert of queryAlerts) {
        // Check expiry
        if (alert.expiresAt && new Date(alert.expiresAt) < new Date()) {
          alert.status = 'expired';
          continue;
        }

        // Check cooldown (don't re-trigger too soon)
        if (alert.lastTriggered && alert.repeatAfter) {
          const cooldownMs = alert.repeatAfter * 60 * 1000;
          if (Date.now() - new Date(alert.lastTriggered).getTime() < cooldownMs) {
            continue;
          }
        }

        // Find matching market
        const market = alert.marketId
          ? markets.find(m => m.marketId === alert.marketId)
          : markets[0];

        if (!market) continue;

        // Update cached info
        alert.marketId = market.marketId ?? undefined;
        alert.marketTitle = market.title;
        alert.platform = market.platform;

        const price = alert.direction === 'YES'
          ? market.yesPrice * 100
          : market.noPrice * 100;

        alert.currentPrice = price;

        // Check condition
        const shouldTrigger =
          (alert.condition === 'above' && price >= alert.threshold) ||
          (alert.condition === 'below' && price <= alert.threshold);

        if (shouldTrigger) {
          const triggerRecord: TriggeredAlert = {
            alertId: alert.id,
            telegramId: alert.telegramId,
            marketTitle: alert.marketTitle || alert.marketQuery,
            direction: alert.direction,
            condition: alert.condition,
            threshold: alert.threshold,
            priceAtTrigger: price,
            timestamp: timestamp(),
            delivered: false,
          };

          newTriggers.push(triggerRecord);
          triggered.push(triggerRecord);

          alert.triggeredAt = timestamp();
          alert.lastTriggered = timestamp();
          alert.triggerCount++;

          // One-time alerts get marked as triggered
          if (!alert.repeatAfter) {
            alert.status = 'triggered';
          }
        }
      }
    } catch (error) {
      console.error(`Error checking alerts for "${query}":`, error);
    }
  }

  saveAlerts(alerts);
  saveTriggered(triggered);

  return newTriggers;
}

/**
 * Get pending triggered alerts (not yet delivered)
 */
export function getPendingTriggers(telegramId?: string): TriggeredAlert[] {
  const triggered = loadTriggered();
  return triggered.filter(t =>
    !t.delivered && (!telegramId || t.telegramId === telegramId)
  );
}

/**
 * Mark triggered alerts as delivered
 */
export function markDelivered(alertIds: string[]): void {
  const triggered = loadTriggered();
  for (const t of triggered) {
    if (alertIds.includes(t.alertId)) {
      t.delivered = true;
    }
  }
  saveTriggered(triggered);
}

// ============================================
// TELEGRAM HANDLERS
// ============================================

/**
 * Handle /alert command - create new alert or list
 */
export async function handleAlert(text: string, telegramId: string): Promise<SkillResponse> {
  const args = text.replace(/^\/alert\s*/i, '').trim();

  // List alerts if no args
  if (!args) {
    return handleListAlerts(telegramId);
  }

  // Delete alert: /alert delete <id>
  const deleteMatch = args.match(/^delete\s+(\S+)/i);
  if (deleteMatch) {
    const success = deleteAlert(telegramId, deleteMatch[1]);
    return {
      text: success
        ? `Deleted alert ${deleteMatch[1]}`
        : `Alert not found or already deleted`,
      mood: 'NEUTRAL',
    };
  }

  // Parse: /alert <market> above/below <threshold> [YES/NO]
  // Examples:
  // /alert bitcoin 100k below 80
  // /alert fed rate above 60 NO
  // /alert trump 2028 below 30
  const createMatch = args.match(/^(.+?)\s+(above|below)\s+(\d+(?:\.\d+)?)\s*(YES|NO)?$/i);

  if (!createMatch) {
    return {
      text: `
*PRICE ALERT USAGE*
${'─'.repeat(35)}

Create alert:
/alert <market> above/below <price> [YES/NO]

Examples:
/alert bitcoin 100k below 80
/alert fed rate above 60
/alert trump 2028 below 30 NO

Manage:
/alert - List all alerts
/alert delete <id> - Remove alert
`,
      mood: 'EDUCATIONAL',
    };
  }

  const [, marketQuery, condition, thresholdStr, directionStr] = createMatch;
  const threshold = parseFloat(thresholdStr);
  const direction = (directionStr?.toUpperCase() as 'YES' | 'NO') || 'YES';
  const conditionType = condition.toLowerCase() as 'above' | 'below';

  if (threshold < 0 || threshold > 100) {
    return {
      text: `Threshold must be between 0 and 100 (percentage)`,
      mood: 'ERROR',
    };
  }

  try {
    const alert = await createAlert(telegramId, marketQuery, conditionType, threshold, direction);

    const currentPriceText = alert.currentPrice !== undefined
      ? `Current: ${alert.currentPrice.toFixed(1)}%`
      : 'Price not available yet';

    return {
      text: `
*ALERT CREATED*
${'─'.repeat(35)}

Market: ${alert.marketTitle || alert.marketQuery}
${alert.platform ? `Platform: ${alert.platform.toUpperCase()}` : ''}

Condition: ${direction} price ${conditionType} ${threshold}%
${currentPriceText}

ID: \`${alert.id}\`

You'll be notified when this triggers.
/alert - View all alerts
`,
      mood: 'BULLISH',
      data: alert,
    };
  } catch (error) {
    return {
      text: `Failed to create alert: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Handle listing alerts
 */
function handleListAlerts(telegramId: string): SkillResponse {
  const alerts = getUserAlerts(telegramId);

  if (alerts.length === 0) {
    return {
      text: `
*PRICE ALERTS*
${'─'.repeat(35)}

No active alerts.

Create one:
/alert bitcoin 100k below 80
/alert fed rate above 60
`,
      mood: 'NEUTRAL',
    };
  }

  let list = '';
  for (const a of alerts) {
    const priceText = a.currentPrice !== undefined
      ? `Now: ${a.currentPrice.toFixed(1)}%`
      : '';
    list += `
\`${a.id.slice(-8)}\` ${a.marketTitle?.slice(0, 30) || a.marketQuery}
  ${a.direction} ${a.condition} ${a.threshold}% | ${priceText}
`;
  }

  return {
    text: `
*PRICE ALERTS* (${alerts.length})
${'─'.repeat(35)}
${list}

/alert delete <id> - Remove alert
/alert <market> above/below <price> - New alert
`,
    mood: 'NEUTRAL',
    data: alerts,
  };
}

/**
 * Format triggered alert for Telegram notification
 */
export function formatTriggeredAlert(trigger: TriggeredAlert): string {
  const emoji = trigger.condition === 'above' ? '' : '';
  const arrow = trigger.condition === 'above' ? '' : '';

  return `
*PRICE ALERT TRIGGERED*
${'─'.repeat(35)}

${trigger.marketTitle}

${trigger.direction} price ${arrow} ${trigger.condition} ${trigger.threshold}%
*Current: ${trigger.priceAtTrigger.toFixed(1)}%*

/research ${trigger.marketTitle.split(' ').slice(0, 3).join(' ')}
/buy ${trigger.marketTitle.split(' ').slice(0, 2).join(' ')} ${trigger.direction}
`;
}

// ============================================
// CLI
// ============================================

if (process.argv[1]?.endsWith('priceAlerts.ts')) {
  const args = process.argv.slice(2);
  const command = args[0];

  (async () => {
    if (command === 'check') {
      console.log('Checking all alerts...');
      const triggered = await checkAlerts();
      console.log(`Triggered: ${triggered.length}`);
      for (const t of triggered) {
        console.log(`  - ${t.marketTitle}: ${t.direction} ${t.condition} ${t.threshold}% (now: ${t.priceAtTrigger.toFixed(1)}%)`);
      }
    } else if (command === 'list') {
      const telegramId = args[1] || 'test_user';
      const alerts = getUserAlerts(telegramId);
      console.log(`Alerts for ${telegramId}:`);
      for (const a of alerts) {
        console.log(`  ${a.id}: ${a.marketQuery} ${a.condition} ${a.threshold}%`);
      }
    } else if (command === 'create') {
      const [, query, condition, threshold] = args;
      if (!query || !condition || !threshold) {
        console.log('Usage: ts-node priceAlerts.ts create <query> <above|below> <threshold>');
        return;
      }
      const alert = await createAlert('test_user', query, condition as any, parseFloat(threshold));
      console.log('Created:', alert);
    } else {
      console.log(`
Usage:
  ts-node priceAlerts.ts check                     - Check all alerts
  ts-node priceAlerts.ts list [telegramId]         - List alerts
  ts-node priceAlerts.ts create <query> <above|below> <threshold>
`);
    }
  })();
}

export default { createAlert, checkAlerts, getUserAlerts, handleAlert };
