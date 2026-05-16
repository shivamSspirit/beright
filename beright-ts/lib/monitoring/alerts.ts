/**
 * Security Alerts Module
 *
 * Sends critical alerts via:
 * - Telegram (to SUPER_ADMIN)
 * - Console logging
 * - Future: PagerDuty, Opsgenie, Slack
 *
 * Usage:
 *   import { sendAlert, sendCriticalAlert, AlertChannel } from '@/lib/monitoring/alerts';
 *
 *   await sendAlert({
 *     channel: 'telegram',
 *     severity: 'critical',
 *     title: 'High Value Transaction',
 *     message: '10 SOL transferred out',
 *     details: { signature: 'abc...' },
 *   });
 */

import { secrets } from '../secrets';
import { isProduction } from '../config/env';

// ============================================
// TYPES
// ============================================

export type AlertChannel = 'telegram' | 'console' | 'all';
export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
  channel?: AlertChannel;
  severity: AlertSeverity;
  title: string;
  message: string;
  details?: Record<string, unknown>;
  walletAddress?: string;
  timestamp?: Date;
}

export interface AlertResult {
  success: boolean;
  channel: AlertChannel;
  error?: string;
}

// ============================================
// CONFIGURATION
// ============================================

const SUPER_ADMIN_TELEGRAM_ID = process.env.SUPER_ADMIN_TELEGRAM_ID || '5504043269';

// Emoji indicators by severity
const SEVERITY_EMOJI: Record<AlertSeverity, string> = {
  info: 'ℹ️',
  warning: '⚠️',
  critical: '🚨',
};

// Rate limiting for alerts (prevent spam)
const alertRateLimits = new Map<string, number>();
const RATE_LIMIT_MS = 60000; // 1 minute between identical alerts

// ============================================
// TELEGRAM SENDER
// ============================================

async function sendTelegramAlert(alert: Alert): Promise<AlertResult> {
  const botToken = secrets.getTelegramBotToken();

  if (!botToken) {
    console.warn('[Alerts] No Telegram bot token configured');
    return { success: false, channel: 'telegram', error: 'No bot token' };
  }

  const emoji = SEVERITY_EMOJI[alert.severity];
  const timestamp = (alert.timestamp || new Date()).toISOString();

  // Format message for Telegram
  const lines = [
    `${emoji} <b>${escapeHtml(alert.title)}</b>`,
    '',
    escapeHtml(alert.message),
  ];

  if (alert.walletAddress) {
    lines.push('', `<b>Wallet:</b> <code>${alert.walletAddress}</code>`);
  }

  if (alert.details) {
    lines.push('', '<b>Details:</b>');
    for (const [key, value] of Object.entries(alert.details)) {
      const displayValue = typeof value === 'string' ? value :
                          typeof value === 'number' ? value.toString() :
                          JSON.stringify(value);
      lines.push(`• ${key}: <code>${escapeHtml(displayValue)}</code>`);
    }
  }

  lines.push('', `<i>${timestamp}</i>`);

  const text = lines.join('\n');

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: SUPER_ADMIN_TELEGRAM_ID,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[Alerts] Telegram API error:', error);
      return { success: false, channel: 'telegram', error };
    }

    return { success: true, channel: 'telegram' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Alerts] Failed to send Telegram alert:', errorMessage);
    return { success: false, channel: 'telegram', error: errorMessage };
  }
}

/**
 * Escape HTML special characters for Telegram
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ============================================
// CONSOLE SENDER
// ============================================

function sendConsoleAlert(alert: Alert): AlertResult {
  const emoji = SEVERITY_EMOJI[alert.severity];
  const timestamp = (alert.timestamp || new Date()).toISOString();

  const logFn = alert.severity === 'critical' ? console.error :
                alert.severity === 'warning' ? console.warn : console.log;

  logFn(`\n${emoji} [ALERT] ${alert.title}`);
  logFn(`   ${alert.message}`);

  if (alert.walletAddress) {
    logFn(`   Wallet: ${alert.walletAddress}`);
  }

  if (alert.details) {
    logFn('   Details:', alert.details);
  }

  logFn(`   Time: ${timestamp}\n`);

  return { success: true, channel: 'console' };
}

// ============================================
// RATE LIMITING
// ============================================

function isRateLimited(alert: Alert): boolean {
  // Create a key from the alert content
  const key = `${alert.severity}:${alert.title}:${alert.walletAddress || ''}`;
  const lastSent = alertRateLimits.get(key);

  if (lastSent && Date.now() - lastSent < RATE_LIMIT_MS) {
    return true;
  }

  alertRateLimits.set(key, Date.now());
  return false;
}

/**
 * Clean up old rate limit entries
 */
function cleanupRateLimits(): void {
  const now = Date.now();
  for (const [key, time] of alertRateLimits.entries()) {
    if (now - time > RATE_LIMIT_MS * 2) {
      alertRateLimits.delete(key);
    }
  }
}

// Cleanup every 5 minutes
setInterval(cleanupRateLimits, 5 * 60 * 1000);

// ============================================
// PUBLIC API
// ============================================

/**
 * Send an alert through specified channel(s)
 */
export async function sendAlert(alert: Alert): Promise<AlertResult[]> {
  // Apply defaults
  alert.timestamp = alert.timestamp || new Date();
  alert.channel = alert.channel || 'all';

  // Check rate limiting
  if (isRateLimited(alert)) {
    console.log(`[Alerts] Rate limited: ${alert.title}`);
    return [{ success: false, channel: alert.channel, error: 'Rate limited' }];
  }

  const results: AlertResult[] = [];

  // Always log to console
  results.push(sendConsoleAlert(alert));

  // Send to Telegram for production or if explicitly requested
  if (
    alert.channel === 'telegram' ||
    alert.channel === 'all' ||
    (isProduction() && alert.severity === 'critical')
  ) {
    const telegramResult = await sendTelegramAlert(alert);
    results.push(telegramResult);
  }

  return results;
}

/**
 * Send a critical alert (always goes to all channels)
 */
export async function sendCriticalAlert(
  title: string,
  message: string,
  details?: Record<string, unknown>,
  walletAddress?: string
): Promise<AlertResult[]> {
  return sendAlert({
    channel: 'all',
    severity: 'critical',
    title,
    message,
    details,
    walletAddress,
  });
}

/**
 * Send a warning alert
 */
export async function sendWarningAlert(
  title: string,
  message: string,
  details?: Record<string, unknown>
): Promise<AlertResult[]> {
  return sendAlert({
    channel: isProduction() ? 'all' : 'console',
    severity: 'warning',
    title,
    message,
    details,
  });
}

/**
 * Send an info alert (console only in dev, telegram in prod)
 */
export async function sendInfoAlert(
  title: string,
  message: string,
  details?: Record<string, unknown>
): Promise<AlertResult[]> {
  return sendAlert({
    channel: 'console',
    severity: 'info',
    title,
    message,
    details,
  });
}

// ============================================
// PREDEFINED ALERTS
// ============================================

/**
 * Alert for high-value transaction
 */
export async function alertHighValueTransaction(
  walletAddress: string,
  amountSol: number,
  signature: string,
  direction: 'inflow' | 'outflow'
): Promise<AlertResult[]> {
  return sendCriticalAlert(
    `High Value ${direction === 'inflow' ? 'Inflow' : 'Outflow'}`,
    `${amountSol.toFixed(4)} SOL ${direction === 'inflow' ? 'received' : 'sent'}`,
    {
      signature,
      explorer: `https://solscan.io/tx/${signature}`,
    },
    walletAddress
  );
}

/**
 * Alert for low wallet balance
 */
export async function alertLowBalance(
  walletAddress: string,
  balanceSol: number,
  thresholdSol: number
): Promise<AlertResult[]> {
  return sendWarningAlert(
    'Low Wallet Balance',
    `Balance ${balanceSol.toFixed(4)} SOL is below threshold ${thresholdSol} SOL`,
    {
      walletAddress,
      threshold: thresholdSol,
    }
  );
}

/**
 * Alert for failed transaction
 */
export async function alertTransactionFailed(
  walletAddress: string,
  txType: string,
  error: string,
  amountSol?: number
): Promise<AlertResult[]> {
  return sendWarningAlert(
    `Transaction Failed: ${txType}`,
    error,
    {
      txType,
      amountSol,
    }
  );
}

/**
 * Alert for security event
 */
export async function alertSecurityEvent(
  eventType: string,
  description: string,
  details?: Record<string, unknown>
): Promise<AlertResult[]> {
  const severity = eventType.includes('injection') || eventType.includes('breach')
    ? 'critical' : 'warning';

  return sendAlert({
    channel: 'all',
    severity,
    title: `Security Event: ${eventType}`,
    message: description,
    details,
  });
}

/**
 * Alert for kill switch activation
 */
export async function alertKillSwitch(
  switchName: string,
  newState: boolean,
  triggeredBy?: string
): Promise<AlertResult[]> {
  return sendCriticalAlert(
    'Kill Switch Activated',
    `${switchName} has been ${newState ? 'ENABLED' : 'DISABLED'}`,
    {
      switch: switchName,
      state: newState ? 'enabled' : 'disabled',
      triggeredBy: triggeredBy || 'system',
    }
  );
}

/**
 * Alert for rate limit exceeded
 */
export async function alertRateLimitExceeded(
  identifier: string,
  endpoint: string,
  requestCount: number
): Promise<AlertResult[]> {
  return sendWarningAlert(
    'Rate Limit Exceeded',
    `${identifier} exceeded rate limit on ${endpoint}`,
    {
      identifier,
      endpoint,
      requestCount,
    }
  );
}

/**
 * Test alert (for verifying configuration)
 */
export async function sendTestAlert(): Promise<AlertResult[]> {
  return sendAlert({
    channel: 'all',
    severity: 'info',
    title: 'Test Alert',
    message: 'This is a test alert from BeRight Protocol.',
    details: {
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    },
  });
}
