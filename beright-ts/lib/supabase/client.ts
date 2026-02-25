/**
 * Supabase Client for BeRight Protocol
 *
 * Usage:
 *   import { supabase, db } from '../lib/supabase/client';
 *
 *   // Direct queries
 *   const { data } = await supabase.from('predictions').select('*');
 *
 *   // Helper functions
 *   const user = await db.users.getByTelegramId(123456);
 *   await db.predictions.create({ ... });
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database, User, Prediction, Alert, WatchlistItem, LeaderboardEntry } from './types';

// Environment variables
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Flag to check if Supabase is available
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn('Supabase credentials not found. Database features disabled.');
  console.warn('Set SUPABASE_URL and SUPABASE_ANON_KEY in .env to enable database.');
}

// Create untyped client (types cause issues with current Supabase version)
// We'll use explicit types in the helper functions instead
const createSupabaseClient = (key: string) => {
  // Only create client if credentials are available
  if (!supabaseUrl || !key) {
    return null;
  }
  return createClient(
    supabaseUrl,
    key,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
};

// Public client (for client-side, respects RLS)
// Returns null if not configured
const _supabase = createSupabaseClient(supabaseAnonKey || '');

// Create a proxy that throws helpful errors when Supabase is not configured
export const supabase = _supabase || new Proxy({} as SupabaseClient, {
  get(target, prop) {
    if (prop === 'from') {
      return () => ({
        select: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
        insert: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
        update: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
        delete: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
        upsert: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
      });
    }
    return () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } });
  },
});

// Admin client (for server-side, bypasses RLS)
export const supabaseAdmin: SupabaseClient = (supabaseServiceKey
  ? createSupabaseClient(supabaseServiceKey)
  : _supabase) || supabase;

// ============================================
// DATABASE HELPERS
// ============================================

export const db = {
  // ----------------------------------------
  // USERS
  // ----------------------------------------
  users: {
    async getById(userId: string): Promise<User | null> {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as User | null;
    },

    async getByTelegramId(telegramId: number): Promise<User | null> {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('telegram_id', telegramId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as User | null;
    },

    async getByWallet(walletAddress: string): Promise<User | null> {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('wallet_address', walletAddress)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as User | null;
    },

    async upsertFromTelegram(telegramId: number, username?: string): Promise<User | null> {
      const { data, error } = await supabaseAdmin
        .from('users')
        .upsert(
          {
            telegram_id: telegramId,
            telegram_username: username,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'telegram_id' }
        )
        .select()
        .single();

      if (error) throw error;
      return data as User | null;
    },

    async linkWallet(userId: string, walletAddress: string): Promise<User | null> {
      const { data, error } = await supabaseAdmin
        .from('users')
        .update({ wallet_address: walletAddress })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return data as User | null;
    },
  },

  // ----------------------------------------
  // PREDICTIONS
  // ----------------------------------------
  predictions: {
    async create(prediction: {
      user_id: string;
      question: string;
      predicted_probability: number;
      direction: 'YES' | 'NO';
      platform?: string;
      market_id?: string;
      market_url?: string;
      confidence?: 'low' | 'medium' | 'high';
      reasoning?: string;
      resolves_at?: string;
      stake_amount?: number;
    }): Promise<Prediction> {
      const { data, error } = await supabaseAdmin
        .from('predictions')
        .insert(prediction)
        .select()
        .single();

      if (error) throw error;
      return data as Prediction;
    },

    async getByUser(userId: string, options?: { limit?: number; resolved?: boolean }): Promise<Prediction[]> {
      let query = supabaseAdmin
        .from('predictions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.resolved !== undefined) {
        if (options.resolved) {
          query = query.not('resolved_at', 'is', null);
        } else {
          query = query.is('resolved_at', null);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Prediction[];
    },

    async resolve(predictionId: string, outcome: boolean): Promise<Prediction> {
      // First get the prediction to calculate Brier score
      const { data: prediction } = await supabaseAdmin
        .from('predictions')
        .select('predicted_probability, direction')
        .eq('id', predictionId)
        .single();

      if (!prediction) throw new Error('Prediction not found');

      // Calculate Brier score
      const pred = prediction as { predicted_probability: number; direction: string };
      const forecast =
        pred.direction === 'YES'
          ? pred.predicted_probability
          : 1 - pred.predicted_probability;
      const actual = outcome ? 1 : 0;
      const brierScore = Math.pow(forecast - actual, 2);

      // Update prediction
      const { data, error } = await supabaseAdmin
        .from('predictions')
        .update({
          outcome,
          resolved_at: new Date().toISOString(),
          brier_score: brierScore,
        })
        .eq('id', predictionId)
        .select()
        .single();

      if (error) throw error;
      return data as Prediction;
    },

    async addOnChainTx(predictionId: string, txSignature: string): Promise<Prediction> {
      const { data, error } = await supabaseAdmin
        .from('predictions')
        .update({
          on_chain_tx: txSignature,
          on_chain_confirmed: true,
        })
        .eq('id', predictionId)
        .select()
        .single();

      if (error) throw error;
      return data as Prediction;
    },
  },

  // ----------------------------------------
  // ALERTS
  // ----------------------------------------
  alerts: {
    async create(alert: {
      user_id: string;
      market_id: string;
      market_title: string;
      platform?: string;
      condition_type: 'price_above' | 'price_below' | 'arb_spread' | 'volume_spike';
      threshold: number;
    }): Promise<Alert> {
      const { data, error } = await supabaseAdmin
        .from('alerts')
        .insert(alert)
        .select()
        .single();

      if (error) throw error;
      return data as Alert;
    },

    async getActiveByUser(userId: string): Promise<Alert[]> {
      const { data, error } = await supabaseAdmin
        .from('alerts')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as Alert[];
    },

    async trigger(alertId: string): Promise<Alert> {
      // First increment trigger count, then update
      const { data, error } = await supabaseAdmin
        .from('alerts')
        .update({
          triggered_at: new Date().toISOString(),
        })
        .eq('id', alertId)
        .select()
        .single();

      if (error) throw error;
      return data as Alert;
    },

    async deactivate(alertId: string): Promise<void> {
      const { error } = await supabaseAdmin
        .from('alerts')
        .update({ is_active: false })
        .eq('id', alertId);

      if (error) throw error;
    },
  },

  // ----------------------------------------
  // WATCHLIST
  // ----------------------------------------
  watchlist: {
    async add(item: {
      user_id: string;
      market_id: string;
      market_title: string;
      platform?: string;
      price_when_added?: number;
      notes?: string;
    }): Promise<WatchlistItem> {
      const { data, error } = await supabaseAdmin
        .from('watchlist')
        .upsert(item, { onConflict: 'user_id,market_id,platform' })
        .select()
        .single();

      if (error) throw error;
      return data as WatchlistItem;
    },

    async getByUser(userId: string): Promise<WatchlistItem[]> {
      const { data, error } = await supabaseAdmin
        .from('watchlist')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as WatchlistItem[];
    },

    async remove(userId: string, marketId: string, platform?: string): Promise<void> {
      let query = supabaseAdmin
        .from('watchlist')
        .delete()
        .eq('user_id', userId)
        .eq('market_id', marketId);

      if (platform) {
        query = query.eq('platform', platform);
      }

      const { error } = await query;
      if (error) throw error;
    },
  },

  // ----------------------------------------
  // LEADERBOARD
  // ----------------------------------------
  leaderboard: {
    async get(options?: { limit?: number }): Promise<LeaderboardEntry[]> {
      const { data, error } = await supabaseAdmin
        .from('leaderboard')
        .select('*')
        .order('avg_brier_score', { ascending: true, nullsFirst: false })
        .limit(options?.limit || 100);

      if (error) throw error;
      return (data || []) as LeaderboardEntry[];
    },

    async getUserRank(userId: string): Promise<number | null> {
      const all = await this.get({ limit: 1000 });
      const index = all.findIndex((u: LeaderboardEntry) => u.id === userId);
      return index === -1 ? null : index + 1;
    },
  },

  // ----------------------------------------
  // WHALE TRACKING
  // ----------------------------------------
  whales: {
    async getTracked(): Promise<any[]> {
      const { data, error } = await supabaseAdmin
        .from('whale_wallets')
        .select('*')
        .eq('is_tracked', true)
        .order('total_volume', { ascending: false });

      if (error) throw error;
      return data || [];
    },

    async addWallet(wallet: {
      wallet_address: string;
      label?: string;
      platform?: string;
    }): Promise<any> {
      const { data, error } = await supabaseAdmin
        .from('whale_wallets')
        .upsert(wallet, { onConflict: 'wallet_address' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async recordTrade(trade: {
      wallet_address: string;
      market_id?: string;
      market_title?: string;
      platform?: string;
      direction: 'YES' | 'NO' | 'BUY' | 'SELL';
      amount: number;
      price?: number;
      tx_signature?: string;
      block_time?: string;
    }): Promise<any> {
      // Get wallet_id if exists
      const { data: wallet } = await supabaseAdmin
        .from('whale_wallets')
        .select('id')
        .eq('wallet_address', trade.wallet_address)
        .single();

      const walletData = wallet as { id: string } | null;
      const { data, error } = await supabaseAdmin
        .from('whale_trades')
        .insert({
          ...trade,
          wallet_id: walletData?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async getRecentTrades(options?: { limit?: number; walletAddress?: string }): Promise<any[]> {
      let query = supabaseAdmin
        .from('whale_trades')
        .select('*, whale_wallets(label)')
        .order('block_time', { ascending: false, nullsFirst: false })
        .limit(options?.limit || 50);

      if (options?.walletAddress) {
        query = query.eq('wallet_address', options.walletAddress);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  },

  // ----------------------------------------
  // ARBITRAGE HISTORY
  // ----------------------------------------
  arbitrage: {
    async record(arb: {
      market_title: string;
      platform1: string;
      platform2: string;
      price_platform1: number;
      price_platform2: number;
      spread_percent: number;
      market_id_platform1?: string;
      market_id_platform2?: string;
    }): Promise<any> {
      const { data, error } = await supabaseAdmin
        .from('arbitrage_history')
        .insert(arb)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async getRecent(limit = 20): Promise<any[]> {
      const { data, error } = await supabaseAdmin
        .from('arbitrage_history')
        .select('*')
        .order('detected_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    },
  },

  // ----------------------------------------
  // REALTIME EVENTS (for TG <-> Web sync)
  // ----------------------------------------
  events: {
    async publish(event: {
      event_type: 'telegram_message' | 'agent_response' | 'arb_alert' | 'whale_alert' | 'prediction' | 'heartbeat' | 'error';
      session_id?: string;
      telegram_id?: number;
      telegram_username?: string;
      agent?: 'scout' | 'analyst' | 'trader' | 'commander';
      command?: string;
      response?: string;
      mood?: string;
      data?: Record<string, unknown>;
    }): Promise<{ id: string } | null> {
      try {
        const { data, error } = await supabaseAdmin
          .from('beright_events')
          .insert({
            ...event,
            created_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (error) {
          console.error('Failed to publish event:', error);
          return null;
        }
        return data as { id: string };
      } catch (err) {
        console.error('Event publish error:', err);
        return null;
      }
    },

    async getRecent(options?: { limit?: number; event_type?: string; session_id?: string }): Promise<any[]> {
      let query = supabaseAdmin
        .from('beright_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(options?.limit || 50);

      if (options?.event_type) {
        query = query.eq('event_type', options.event_type);
      }
      if (options?.session_id) {
        query = query.eq('session_id', options.session_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  },

  // ----------------------------------------
  // TRADING SYSTEM
  // ----------------------------------------
  trading: {
    async createTrade(trade: {
      user_id: string;
      mode: 'paper' | 'live';
      platform: string;
      market_id: string;
      market_ticker: string;
      market_title: string;
      category?: string;
      direction: 'YES' | 'NO';
      order_type?: string;
      entry_price: number;
      quantity: number;
      entry_value_usd?: number;
      strategy?: string;
      signal_id?: string;
      signal_confidence?: number;
      stop_loss_price?: number;
      take_profit_price?: number;
      max_loss_usd?: number;
      expires_at?: string;
    }): Promise<any> {
      const { data, error } = await supabaseAdmin
        .from('trades')
        .insert({
          ...trade,
          category: trade.category || 'general',
          order_type: trade.order_type || 'market',
          entry_value_usd: trade.entry_value_usd || trade.entry_price * trade.quantity,
          strategy: trade.strategy || 'manual',
          status: 'open',
          quantity_filled: trade.quantity,
          unrealized_pnl: 0,
          fees: 0,
          filled_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async getTrades(userId: string, options?: {
      mode?: 'paper' | 'live';
      status?: string;
      strategy?: string;
      limit?: number;
    }): Promise<any[]> {
      let query = supabaseAdmin
        .from('trades')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (options?.mode) query = query.eq('mode', options.mode);
      if (options?.status) query = query.eq('status', options.status);
      if (options?.strategy) query = query.eq('strategy', options.strategy);
      if (options?.limit) query = query.limit(options.limit);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async getOpenTrades(userId: string, mode: 'paper' | 'live' = 'paper'): Promise<any[]> {
      const { data, error } = await supabaseAdmin
        .from('trades')
        .select('*')
        .eq('user_id', userId)
        .eq('mode', mode)
        .eq('status', 'open')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },

    async closeTrade(tradeId: string, exitPrice: number, closeReason: string): Promise<any> {
      // Get current trade
      const { data: trade } = await supabaseAdmin
        .from('trades')
        .select('*')
        .eq('id', tradeId)
        .single();

      if (!trade) throw new Error('Trade not found');

      const t = trade as { entry_price: number; quantity: number; direction: string };
      const pnl = t.direction === 'YES'
        ? (exitPrice - t.entry_price) * t.quantity
        : (t.entry_price - exitPrice) * t.quantity;

      const pnlPercent = t.entry_price > 0 ? pnl / (t.entry_price * t.quantity) : 0;

      const { data, error } = await supabaseAdmin
        .from('trades')
        .update({
          exit_price: exitPrice,
          exit_value_usd: exitPrice * t.quantity,
          realized_pnl: pnl,
          pnl_percent: pnlPercent,
          status: 'closed',
          close_reason: closeReason,
          closed_at: new Date().toISOString(),
        })
        .eq('id', tradeId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async updateTradePrice(tradeId: string, currentPrice: number): Promise<any> {
      const { data: trade } = await supabaseAdmin
        .from('trades')
        .select('entry_price, quantity, direction')
        .eq('id', tradeId)
        .single();

      if (!trade) throw new Error('Trade not found');

      const t = trade as { entry_price: number; quantity: number; direction: string };
      const unrealizedPnl = t.direction === 'YES'
        ? (currentPrice - t.entry_price) * t.quantity
        : (t.entry_price - currentPrice) * t.quantity;

      const { data, error } = await supabaseAdmin
        .from('trades')
        .update({ unrealized_pnl: unrealizedPnl })
        .eq('id', tradeId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async getSettings(userId: string): Promise<any | null> {
      const { data, error } = await supabaseAdmin
        .from('trading_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },

    async upsertSettings(settings: {
      user_id: string;
      mode?: 'paper' | 'live';
      auto_execute?: boolean;
      enabled_strategies?: string[];
      strategy_configs?: Record<string, unknown>;
      risk_config?: Record<string, unknown>;
      initial_balance?: number;
      notify_on_trade?: boolean;
      notify_on_alert?: boolean;
      telegram_chat_id?: number;
    }): Promise<any> {
      const { data, error } = await supabaseAdmin
        .from('trading_settings')
        .upsert({
          ...settings,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async savePerformance(perf: {
      user_id: string;
      strategy: string;
      mode: 'paper' | 'live';
      period: string;
      total_trades: number;
      winning_trades: number;
      losing_trades: number;
      win_rate: number;
      total_pnl: number;
      avg_pnl: number;
      avg_win: number;
      avg_loss: number;
      profit_factor: number;
      sharpe_ratio?: number;
      max_drawdown: number;
      start_date: string;
      end_date: string;
    }): Promise<any> {
      const { data, error } = await supabaseAdmin
        .from('strategy_performance')
        .insert(perf)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async getPerformance(userId: string, options?: {
      strategy?: string;
      mode?: 'paper' | 'live';
      period?: string;
    }): Promise<any[]> {
      let query = supabaseAdmin
        .from('strategy_performance')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (options?.strategy) query = query.eq('strategy', options.strategy);
      if (options?.mode) query = query.eq('mode', options.mode);
      if (options?.period) query = query.eq('period', options.period);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async savePortfolioSnapshot(snapshot: {
      user_id: string;
      mode: 'paper' | 'live';
      cash_balance: number;
      portfolio_value: number;
      total_value: number;
      total_pnl: number;
      total_pnl_percent: number;
      realized_pnl: number;
      unrealized_pnl: number;
      total_trades: number;
      winning_trades: number;
      losing_trades: number;
      win_rate: number;
      sharpe_ratio?: number;
      max_drawdown: number;
      max_drawdown_percent: number;
      position_count: number;
    }): Promise<any> {
      const { data, error } = await supabaseAdmin
        .from('portfolio_snapshots')
        .insert(snapshot)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async getPortfolioHistory(userId: string, mode: 'paper' | 'live' = 'paper', days: number = 30): Promise<any[]> {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabaseAdmin
        .from('portfolio_snapshots')
        .select('*')
        .eq('user_id', userId)
        .eq('mode', mode)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  },
};

export default supabase;
