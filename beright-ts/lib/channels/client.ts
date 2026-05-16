/**
 * Signal Channel Client
 *
 * CRUD for signal channels, subscriptions, and signal broadcasting.
 * All persistence is Supabase. On-chain commitment is optional (non-fatal).
 */

import { supabaseAdmin, isSupabaseConfigured } from '../supabase/client';
import { commitPrediction } from '../onchain/commit';
import {
  SignalChannel,
  ChannelSubscription,
  ChannelSignal,
  CreateChannelParams,
  BroadcastSignalParams,
  ChannelTier,
  TIER_LABEL,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// CHANNEL MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

export async function createChannel(params: CreateChannelParams): Promise<SignalChannel | null> {
  if (!isSupabaseConfigured) {
    console.warn('[channels] Supabase not configured');
    return null;
  }

  const slug =
    params.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 40) + `-${params.forecasterTelegramId}`;

  const { data, error } = await supabaseAdmin
    .from('signal_channels')
    .insert({
      forecaster_telegram_id: params.forecasterTelegramId,
      forecaster_display_name: params.forecasterDisplayName,
      name: params.name,
      description: params.description,
      slug,
      tier: params.tier,
      monthly_price_usd: params.tier === 'free' ? 0 : params.tier === 'pro' ? 29 : 99,
    })
    .select()
    .single();

  if (error) {
    console.error('[channels] createChannel error:', error.message);
    return null;
  }
  return data as SignalChannel;
}

export async function getChannelByForecaster(telegramId: number): Promise<SignalChannel | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabaseAdmin
    .from('signal_channels')
    .select('*')
    .eq('forecaster_telegram_id', telegramId)
    .eq('is_active', true)
    .single();
  return data as SignalChannel | null;
}

export async function getChannelBySlug(slug: string): Promise<SignalChannel | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabaseAdmin
    .from('signal_channels')
    .select('*')
    .eq('slug', slug)
    .single();
  return data as SignalChannel | null;
}

export async function getTopChannels(limit = 10): Promise<SignalChannel[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabaseAdmin
    .from('signal_channels')
    .select('*')
    .eq('is_active', true)
    .order('subscriber_count', { ascending: false })
    .limit(limit);
  return (data || []) as SignalChannel[];
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBSCRIPTION MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

export async function subscribeToChannel(
  channelId: string,
  subscriberTelegramId: number,
  tier: ChannelTier = 'free',
  ownerWallet?: string,
): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured) return { success: false, message: 'Service unavailable' };

  const { data: existing } = await supabaseAdmin
    .from('channel_subscriptions')
    .select('id, is_active')
    .eq('channel_id', channelId)
    .eq('subscriber_telegram_id', subscriberTelegramId)
    .single();

  if (existing) {
    if ((existing as ChannelSubscription).is_active) {
      return { success: false, message: 'Already subscribed to this channel' };
    }
    await supabaseAdmin
      .from('channel_subscriptions')
      .update({ is_active: true, tier })
      .eq('id', (existing as ChannelSubscription).id);
  } else {
    await supabaseAdmin.from('channel_subscriptions').insert({
      channel_id: channelId,
      subscriber_telegram_id: subscriberTelegramId,
      tier,
      notify_telegram: true,
    });
  }

  // Increment subscriber count
  try {
    const { error: rpcError } = await supabaseAdmin.rpc('increment_channel_subscribers', { channel_id: channelId });
    if (rpcError) throw rpcError;
  } catch {
    // Fallback: manual increment if RPC doesn't exist
    const { data } = await supabaseAdmin
      .from('signal_channels')
      .select('subscriber_count')
      .eq('id', channelId)
      .single();
    if (data) {
      await supabaseAdmin
        .from('signal_channels')
        .update({ subscriber_count: (data as SignalChannel).subscriber_count + 1 })
        .eq('id', channelId);
    }
  }

  return { success: true, message: 'Subscribed successfully' };
}

export async function unsubscribeFromChannel(
  channelId: string,
  subscriberTelegramId: number,
): Promise<{ success: boolean }> {
  if (!isSupabaseConfigured) return { success: false };
  await supabaseAdmin
    .from('channel_subscriptions')
    .update({ is_active: false })
    .eq('channel_id', channelId)
    .eq('subscriber_telegram_id', subscriberTelegramId);
  return { success: true };
}

export async function getSubscriberChannels(
  telegramId: number,
): Promise<(ChannelSubscription & { channel: SignalChannel })[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabaseAdmin
    .from('channel_subscriptions')
    .select('*, channel:signal_channels(*)')
    .eq('subscriber_telegram_id', telegramId)
    .eq('is_active', true);
  return (data || []) as (ChannelSubscription & { channel: SignalChannel })[];
}

export async function getChannelSubscribers(channelId: string): Promise<ChannelSubscription[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabaseAdmin
    .from('channel_subscriptions')
    .select('*')
    .eq('channel_id', channelId)
    .eq('is_active', true);
  return (data || []) as ChannelSubscription[];
}

// ─────────────────────────────────────────────────────────────────────────────
// SIGNAL BROADCASTING
// ─────────────────────────────────────────────────────────────────────────────

export async function broadcastSignal(
  params: BroadcastSignalParams,
): Promise<{ signal: ChannelSignal | null; commitTx: string | null }> {
  if (!isSupabaseConfigured) return { signal: null, commitTx: null };

  // Commit to Solana chain first for timestamp proof (non-fatal)
  let commitTx: string | null = null;
  let commitHash: string | null = null;
  try {
    const commitResult = await commitPrediction(
      String(params.forecasterTelegramId),  // userPubkey - using telegramId as identifier
      params.marketTitle,                    // marketId
      params.probability,
      params.direction as 'YES' | 'NO',
    );
    if (commitResult.success) {
      commitTx = commitResult.signature || null;
      // MemoTxResult doesn't have commitHash; use a hash of the tx signature
      commitHash = commitTx ? commitTx.slice(0, 16) : null;
    }
  } catch (e) {
    console.warn('[channels] On-chain commit failed (non-fatal):', e);
  }

  const { data, error } = await supabaseAdmin
    .from('channel_signals')
    .insert({
      channel_id: params.channelId,
      forecaster_telegram_id: params.forecasterTelegramId,
      market_title: params.marketTitle,
      platform: params.platform,
      direction: params.direction,
      probability: params.probability,
      confidence: params.confidence,
      reasoning: params.reasoning,
      time_horizon: params.timeHorizon,
      on_chain_tx: commitTx,
      commit_hash: commitHash,
    })
    .select()
    .single();

  if (error) {
    console.error('[channels] broadcastSignal error:', error.message);
    return { signal: null, commitTx };
  }

  // Increment channel signal counters
  await supabaseAdmin
    .from('signal_channels')
    .select('signal_count, signals_7d, signals_30d')
    .eq('id', params.channelId)
    .single()
    .then(({ data: ch }) => {
      if (ch) {
        const c = ch as SignalChannel;
        supabaseAdmin.from('signal_channels').update({
          signal_count: c.signal_count + 1,
          signals_7d: c.signals_7d + 1,
          signals_30d: c.signals_30d + 1,
        }).eq('id', params.channelId);
      }
    });

  return { signal: data as ChannelSignal, commitTx };
}

export async function getChannelSignals(channelId: string, limit = 10): Promise<ChannelSignal[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabaseAdmin
    .from('channel_signals')
    .select('*')
    .eq('channel_id', channelId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data || []) as ChannelSignal[];
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMATTING FOR TELEGRAM
// ─────────────────────────────────────────────────────────────────────────────

export function formatChannelCard(channel: SignalChannel): string {
  const winStr =
    channel.win_rate != null ? `${Math.round(channel.win_rate * 100)}% win rate` : 'New channel';
  const verBadge = channel.is_verified ? ' ✓' : '';
  const tierTag = channel.tier === 'free' ? '' : ` · ${TIER_LABEL[channel.tier]}`;

  return [
    `📡 *${channel.name}*${verBadge}${tierTag}`,
    channel.description,
    ``,
    `👤 ${channel.forecaster_display_name}`,
    `📊 ${channel.signal_count} signals · ${channel.subscriber_count} subscribers`,
    `🎯 ${winStr}`,
    channel.best_signal_text ? `💬 "${channel.best_signal_text}"` : '',
    ``,
    `Subscribe: /subscribe-channel ${channel.slug}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function formatSignalBroadcast(signal: ChannelSignal, channelName: string): string {
  const dirEmoji = signal.direction === 'YES' ? '🟢' : '🔴';
  const confStr =
    { low: '⚡ Low', medium: '⚡⚡ Medium', high: '⚡⚡⚡ HIGH' }[signal.confidence] || '';
  const pctStr = `${Math.round(signal.probability * 100)}%`;

  return [
    `📡 *Signal: ${channelName}*`,
    ``,
    `${dirEmoji} *${signal.direction}* — ${signal.market_title}`,
    ``,
    `📊 Forecast: ${pctStr} confidence · ${confStr}`,
    `⏱ Horizon: ${signal.time_horizon}`,
    `🏛 Platform: ${signal.platform?.toUpperCase() || 'N/A'}`,
    ``,
    `💭 _${signal.reasoning}_`,
    signal.on_chain_tx
      ? `\n🔗 [On-chain proof](https://solscan.io/tx/${signal.on_chain_tx})`
      : '',
    ``,
    `_Forecasted at ${new Date(signal.created_at).toUTCString()}_`,
  ]
    .filter((line) => line !== undefined)
    .join('\n');
}
