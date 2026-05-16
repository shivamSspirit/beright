/**
 * Alert Router — Proactive Telegram Push
 *
 * Reads evaluated signals and routes them to subscribed users.
 * Each user controls which signal types they want and minimum strength.
 *
 * Flow:
 *   EvaluatedSignal → subscriber lookup → send Telegram message
 */

import { supabaseAdmin, isSupabaseConfigured } from './supabase/client';
import { EvaluatedSignal, SignalType, SIGNAL_META } from './signals/types';

// In-memory fallback subscriber list (when Supabase is unavailable)
// Populated by /subscribe commands
const IN_MEMORY_SUBSCRIBERS: Map<number, {
  telegramId: number;
  signalTypes: SignalType[];
  minStrength: number;
}> = new Map();

// Telegram sender — injected by heartbeat to avoid circular deps
let telegramSender: ((chatId: string, text: string) => Promise<void>) | null = null;

export function setAlertRouterSender(
  sender: (chatId: string, text: string) => Promise<void>
): void {
  telegramSender = sender;
}

// ─────────────────────────────────────────────
// SUBSCRIPTION MANAGEMENT
// ─────────────────────────────────────────────

export interface Subscriber {
  telegramId: number;
  signalTypes: SignalType[];
  minStrength: number;
}

/**
 * Subscribe a user to signals
 */
export async function subscribe(
  telegramId: number,
  signalTypes: SignalType[] = ['arb_opportunity', 'whale_entry', 'volume_surge', 'odds_shift'],
  minStrength = 0.5
): Promise<void> {
  // In-memory
  IN_MEMORY_SUBSCRIBERS.set(telegramId, { telegramId, signalTypes, minStrength });

  // Persist to Supabase
  if (isSupabaseConfigured) {
    try {
      await supabaseAdmin
        .from('signal_subscriptions')
        .upsert({
          telegram_id: telegramId,
          signal_types: signalTypes,
          min_strength: minStrength,
          is_active: true,
        }, { onConflict: 'telegram_id' });
    } catch (err) {
      console.warn('[AlertRouter] Failed to save subscription:', err instanceof Error ? err.message : err);
    }
  }
}

/**
 * Unsubscribe a user from signals
 */
export async function unsubscribe(telegramId: number): Promise<void> {
  IN_MEMORY_SUBSCRIBERS.delete(telegramId);

  if (isSupabaseConfigured) {
    try {
      await supabaseAdmin
        .from('signal_subscriptions')
        .update({ is_active: false })
        .eq('telegram_id', telegramId);
    } catch (err) {
      console.warn('[AlertRouter] Failed to remove subscription:', err instanceof Error ? err.message : err);
    }
  }
}

/**
 * Get all active subscribers
 */
async function getSubscribers(): Promise<Subscriber[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabaseAdmin
        .from('signal_subscriptions')
        .select('telegram_id, signal_types, min_strength')
        .eq('is_active', true);

      if (!error && data && data.length > 0) {
        return (data as any[]).map(row => ({
          telegramId: row.telegram_id,
          signalTypes: row.signal_types || [],
          minStrength: row.min_strength ?? 0.5,
        }));
      }
    } catch {
      // Fall through to in-memory
    }
  }

  return Array.from(IN_MEMORY_SUBSCRIBERS.values());
}

/**
 * Check if a subscriber wants this signal
 */
function subscriberWantsSignal(subscriber: Subscriber, signal: EvaluatedSignal): boolean {
  if (signal.strength < subscriber.minStrength) return false;
  if (subscriber.signalTypes.length === 0) return true;  // subscribed to all
  return subscriber.signalTypes.includes(signal.type);
}

// ─────────────────────────────────────────────
// ALERT FORMATTING
// ─────────────────────────────────────────────

function formatAlertMessage(signal: EvaluatedSignal): string {
  const meta = SIGNAL_META[signal.type];
  const strengthBar = '█'.repeat(Math.round(signal.strength * 8)) + '░'.repeat(8 - Math.round(signal.strength * 8));

  let msg = `${meta.emoji} *${meta.label.toUpperCase()}*\n`;
  msg += `${'─'.repeat(30)}\n\n`;

  msg += `${signal.marketTitle.slice(0, 70)}\n\n`;

  // Signal-specific context
  if (signal.type === 'arb_opportunity') {
    const d = signal.rawData;
    msg += `💰 *${d.spreadPct}% spread* — ${d.platformA} vs ${d.platformB}\n`;
    msg += `Match: ${Math.round((d.matchConfidence as number) * 100)}% | `;
    msg += `Vol: $${Math.round((d.volumeA as number) + (d.volumeB as number)).toLocaleString()}\n\n`;
  } else if (signal.type === 'resolution_imminent') {
    const d = signal.rawData;
    msg += `⏰ *${d.hoursLeft}h until resolution*\n`;
    msg += `Yes: ${Math.round((d.yesPrice as number) * 100)}¢ | Vol: $${Math.round(d.volume as number).toLocaleString()}\n\n`;
  } else if (signal.type === 'volume_surge') {
    const d = signal.rawData;
    msg += `📈 Vol: $${Math.round(d.volume as number).toLocaleString()} | `;
    if (d.volume24h) msg += `24h: $${Math.round(d.volume24h as number).toLocaleString()}\n\n`;
    else msg += `\n\n`;
  } else if (signal.type === 'odds_shift') {
    const d = signal.rawData;
    const arrow = d.direction === 'up' ? '↑' : '↓';
    msg += `⚡ ${arrow} ${d.shiftPct}pp shift: ${Math.round((d.previousPrice as number) * 100)}¢ → ${Math.round((d.currentPrice as number) * 100)}¢\n\n`;
  } else if (signal.type === 'whale_entry') {
    const d = signal.rawData;
    msg += `🐋 $${Math.round(d.amount as number).toLocaleString()} ${d.direction} entry\n\n`;
  } else if (signal.type === 'consensus_flip') {
    const d = signal.rawData;
    if (d.flipped) msg += `🔄 Flipped to *${d.newMajority}* (${d.magnitude}pp swing)\n\n`;
    else msg += `🔄 Approaching flip: currently at ${Math.round((d.currentPrice as number) * 100)}¢\n\n`;
  } else if (signal.type === 'narrative_emergence') {
    const d = signal.rawData;
    msg += `🔥 "${d.keyword}" trending across ${d.marketCount} markets\n`;
    msg += `Combined vol: $${Math.round(d.totalVolume as number).toLocaleString()}\n\n`;
  }

  // Confidence + reasoning
  msg += `${strengthBar} ${Math.round(signal.strength * 100)}% strength\n`;
  msg += `Scout: _${signal.reasoning.slice(0, 120)}_\n\n`;

  msg += `_/signals for full feed_`;
  return msg;
}

// ─────────────────────────────────────────────
// ROUTING
// ─────────────────────────────────────────────

/**
 * Route evaluated signals to subscribed Telegram users.
 * Returns number of alerts sent.
 */
export async function routeAlerts(signals: EvaluatedSignal[]): Promise<number> {
  if (!telegramSender) {
    console.warn('[AlertRouter] No Telegram sender configured. Call setAlertRouterSender() first.');
    return 0;
  }

  // Only route ALERT-level signals proactively
  const alertSignals = signals.filter(s => s.action === 'ALERT');
  if (alertSignals.length === 0) return 0;

  const subscribers = await getSubscribers();
  if (subscribers.length === 0) {
    console.log('[AlertRouter] No subscribers configured');
    return 0;
  }

  let totalSent = 0;

  for (const signal of alertSignals) {
    const message = formatAlertMessage(signal);

    for (const subscriber of subscribers) {
      if (!subscriberWantsSignal(subscriber, signal)) continue;

      try {
        await telegramSender(subscriber.telegramId.toString(), message);
        totalSent++;
      } catch (err) {
        console.warn(`[AlertRouter] Failed to send to ${subscriber.telegramId}:`, err instanceof Error ? err.message : err);
      }
    }
  }

  if (totalSent > 0) {
    console.log(`[AlertRouter] Sent ${totalSent} alerts to ${subscribers.length} subscribers`);
  }

  return totalSent;
}

/**
 * Get subscription status for a user
 */
export async function getSubscriptionStatus(telegramId: number): Promise<{
  isSubscribed: boolean;
  signalTypes: string[];
  minStrength: number;
} | null> {
  const inMem = IN_MEMORY_SUBSCRIBERS.get(telegramId);
  if (inMem) {
    return {
      isSubscribed: true,
      signalTypes: inMem.signalTypes,
      minStrength: inMem.minStrength,
    };
  }

  if (!isSupabaseConfigured) return null;

  try {
    const { data } = await supabaseAdmin
      .from('signal_subscriptions')
      .select('signal_types, min_strength, is_active')
      .eq('telegram_id', telegramId)
      .single();

    if (!data) return null;
    const row = data as any;
    if (!row.is_active) return { isSubscribed: false, signalTypes: [], minStrength: 0 };

    return {
      isSubscribed: true,
      signalTypes: row.signal_types || [],
      minStrength: row.min_strength || 0.5,
    };
  } catch {
    return null;
  }
}

/**
 * Format subscription confirmation message
 */
export function formatSubscribeConfirmation(
  signalTypes: SignalType[],
  minStrength: number
): string {
  const typesList = signalTypes
    .map(t => `${SIGNAL_META[t].emoji} ${SIGNAL_META[t].label}`)
    .join('\n');

  return `*Signal Alerts Activated*\n\n` +
    `You'll receive proactive alerts for:\n${typesList}\n\n` +
    `Minimum strength: ${Math.round(minStrength * 100)}%\n\n` +
    `Use /unsubscribe to stop alerts.\n` +
    `Use /signals to see recent signals anytime.`;
}
