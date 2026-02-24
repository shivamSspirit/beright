/**
 * Signal Channel Types
 *
 * Forecaster-led signal channels (Supabase-backed, off-chain subscriptions).
 * Channels are NOT the same as the on-chain BeRight Vault — see lib/onchain-vault/.
 *
 * Tiers:
 *   free  — open access, no payment
 *   pro   — $29/mo (payment bridge via on-chain vault balance, see lib/channels/client.ts)
 *   whale — $99/mo (same bridge)
 */

export type ChannelTier = 'free' | 'pro' | 'whale';

export const TIER_PRICE: Record<ChannelTier, number> = {
  free: 0,
  pro: 29,
  whale: 99,
};

export const TIER_LABEL: Record<ChannelTier, string> = {
  free: 'Free',
  pro: 'Pro ($29/mo)',
  whale: 'Whale ($99/mo)',
};

export interface SignalChannel {
  id: string;
  forecaster_telegram_id: number;
  forecaster_display_name: string;
  name: string;
  description: string;
  slug: string;
  tier: ChannelTier;
  monthly_price_usd: number;
  signal_count: number;
  subscriber_count: number;
  win_rate: number | null;
  avg_roi: number | null;
  best_signal_text: string | null;
  is_active: boolean;
  is_verified: boolean;
  signals_7d: number;
  signals_30d: number;
  created_at: string;
  updated_at: string;
}

export interface ChannelSubscription {
  id: string;
  channel_id: string;
  subscriber_telegram_id: number;
  tier: ChannelTier;
  is_active: boolean;
  notify_telegram: boolean;
  subscribed_at: string;
  expires_at: string | null;
  last_notified_at: string | null;
}

export interface ChannelSignal {
  id: string;
  channel_id: string;
  forecaster_telegram_id: number;
  market_title: string;
  platform: string;
  direction: 'YES' | 'NO';
  probability: number;
  confidence: 'low' | 'medium' | 'high';
  reasoning: string;
  time_horizon: string;
  on_chain_tx: string | null;
  commit_hash: string | null;
  resolved_at: string | null;
  outcome: boolean | null;
  brier_score: number | null;
  notified_count: number;
  notified_at: string | null;
  created_at: string;
}

export interface CreateChannelParams {
  forecasterTelegramId: number;
  forecasterDisplayName: string;
  name: string;
  description: string;
  tier: ChannelTier;
}

export interface BroadcastSignalParams {
  channelId: string;
  forecasterTelegramId: number;
  marketTitle: string;
  platform: string;
  direction: 'YES' | 'NO';
  probability: number;
  confidence: 'low' | 'medium' | 'high';
  reasoning: string;
  timeHorizon: string;
}
