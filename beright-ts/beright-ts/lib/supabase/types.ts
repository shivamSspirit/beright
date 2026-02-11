/**
 * Supabase Database Types for BeRight Protocol
 *
 * Generated manually based on schema.sql
 * For auto-generation, run: npx supabase gen types typescript --project-id zmpsqixstjmtftuqstnd
 */

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          wallet_address: string | null;
          telegram_id: number | null;
          telegram_username: string | null;
          username: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          wallet_address?: string | null;
          telegram_id?: number | null;
          telegram_username?: string | null;
          username?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          wallet_address?: string | null;
          telegram_id?: number | null;
          telegram_username?: string | null;
          username?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      predictions: {
        Row: {
          id: string;
          user_id: string | null;
          question: string;
          platform: string | null;
          market_id: string | null;
          market_url: string | null;
          predicted_probability: number;
          direction: 'YES' | 'NO' | null;
          confidence: 'low' | 'medium' | 'high' | null;
          reasoning: string | null;
          stake_amount: number | null;
          stake_currency: string | null;
          created_at: string;
          resolves_at: string | null;
          resolved_at: string | null;
          outcome: boolean | null;
          brier_score: number | null;
          on_chain_tx: string | null;
          on_chain_confirmed: boolean | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          question: string;
          platform?: string | null;
          market_id?: string | null;
          market_url?: string | null;
          predicted_probability: number;
          direction?: 'YES' | 'NO' | null;
          confidence?: 'low' | 'medium' | 'high' | null;
          reasoning?: string | null;
          stake_amount?: number | null;
          stake_currency?: string | null;
          created_at?: string;
          resolves_at?: string | null;
          resolved_at?: string | null;
          outcome?: boolean | null;
          brier_score?: number | null;
          on_chain_tx?: string | null;
          on_chain_confirmed?: boolean | null;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          question?: string;
          platform?: string | null;
          market_id?: string | null;
          market_url?: string | null;
          predicted_probability?: number;
          direction?: 'YES' | 'NO' | null;
          confidence?: 'low' | 'medium' | 'high' | null;
          reasoning?: string | null;
          stake_amount?: number | null;
          stake_currency?: string | null;
          created_at?: string;
          resolves_at?: string | null;
          resolved_at?: string | null;
          outcome?: boolean | null;
          brier_score?: number | null;
          on_chain_tx?: string | null;
          on_chain_confirmed?: boolean | null;
        };
      };

      alerts: {
        Row: {
          id: string;
          user_id: string | null;
          market_id: string | null;
          market_title: string | null;
          platform: string | null;
          condition_type: 'price_above' | 'price_below' | 'arb_spread' | 'volume_spike' | null;
          threshold: number | null;
          is_active: boolean | null;
          triggered_at: string | null;
          trigger_count: number | null;
          notify_telegram: boolean | null;
          notify_email: boolean | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          market_id?: string | null;
          market_title?: string | null;
          platform?: string | null;
          condition_type?: 'price_above' | 'price_below' | 'arb_spread' | 'volume_spike' | null;
          threshold?: number | null;
          is_active?: boolean | null;
          triggered_at?: string | null;
          trigger_count?: number | null;
          notify_telegram?: boolean | null;
          notify_email?: boolean | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          market_id?: string | null;
          market_title?: string | null;
          platform?: string | null;
          condition_type?: 'price_above' | 'price_below' | 'arb_spread' | 'volume_spike' | null;
          threshold?: number | null;
          is_active?: boolean | null;
          triggered_at?: string | null;
          trigger_count?: number | null;
          notify_telegram?: boolean | null;
          notify_email?: boolean | null;
          created_at?: string;
        };
      };

      watchlist: {
        Row: {
          id: string;
          user_id: string | null;
          market_id: string;
          market_title: string | null;
          platform: string | null;
          price_when_added: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          market_id: string;
          market_title?: string | null;
          platform?: string | null;
          price_when_added?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          market_id?: string;
          market_title?: string | null;
          platform?: string | null;
          price_when_added?: number | null;
          notes?: string | null;
          created_at?: string;
        };
      };

      whale_wallets: {
        Row: {
          id: string;
          wallet_address: string;
          label: string | null;
          platform: string | null;
          total_volume: number | null;
          win_rate: number | null;
          avg_position_size: number | null;
          is_tracked: boolean | null;
          last_activity: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          wallet_address: string;
          label?: string | null;
          platform?: string | null;
          total_volume?: number | null;
          win_rate?: number | null;
          avg_position_size?: number | null;
          is_tracked?: boolean | null;
          last_activity?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          wallet_address?: string;
          label?: string | null;
          platform?: string | null;
          total_volume?: number | null;
          win_rate?: number | null;
          avg_position_size?: number | null;
          is_tracked?: boolean | null;
          last_activity?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      whale_trades: {
        Row: {
          id: string;
          wallet_id: string | null;
          wallet_address: string;
          market_id: string | null;
          market_title: string | null;
          platform: string | null;
          direction: 'YES' | 'NO' | 'BUY' | 'SELL' | null;
          amount: number | null;
          price: number | null;
          tx_signature: string | null;
          block_time: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          wallet_id?: string | null;
          wallet_address: string;
          market_id?: string | null;
          market_title?: string | null;
          platform?: string | null;
          direction?: 'YES' | 'NO' | 'BUY' | 'SELL' | null;
          amount?: number | null;
          price?: number | null;
          tx_signature?: string | null;
          block_time?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          wallet_id?: string | null;
          wallet_address?: string;
          market_id?: string | null;
          market_title?: string | null;
          platform?: string | null;
          direction?: 'YES' | 'NO' | 'BUY' | 'SELL' | null;
          amount?: number | null;
          price?: number | null;
          tx_signature?: string | null;
          block_time?: string | null;
          created_at?: string;
        };
      };

      arbitrage_history: {
        Row: {
          id: string;
          market_title: string | null;
          market_id_platform1: string | null;
          market_id_platform2: string | null;
          platform1: string | null;
          platform2: string | null;
          price_platform1: number | null;
          price_platform2: number | null;
          spread_percent: number | null;
          was_traded: boolean | null;
          profit_if_traded: number | null;
          detected_at: string;
        };
        Insert: {
          id?: string;
          market_title?: string | null;
          market_id_platform1?: string | null;
          market_id_platform2?: string | null;
          platform1?: string | null;
          platform2?: string | null;
          price_platform1?: number | null;
          price_platform2?: number | null;
          spread_percent?: number | null;
          was_traded?: boolean | null;
          profit_if_traded?: number | null;
          detected_at?: string;
        };
        Update: {
          id?: string;
          market_title?: string | null;
          market_id_platform1?: string | null;
          market_id_platform2?: string | null;
          platform1?: string | null;
          platform2?: string | null;
          price_platform1?: number | null;
          price_platform2?: number | null;
          spread_percent?: number | null;
          was_traded?: boolean | null;
          profit_if_traded?: number | null;
          detected_at?: string;
        };
      };

      sessions: {
        Row: {
          id: string;
          user_id: string | null;
          telegram_chat_id: number | null;
          context: Record<string, unknown> | null;
          last_command: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          telegram_chat_id?: number | null;
          context?: Record<string, unknown> | null;
          last_command?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          telegram_chat_id?: number | null;
          context?: Record<string, unknown> | null;
          last_command?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      beright_events: {
        Row: {
          id: string;
          event_type: 'telegram_message' | 'agent_response' | 'arb_alert' | 'whale_alert' | 'prediction' | 'heartbeat' | 'error';
          session_id: string | null;
          user_id: string | null;
          telegram_id: number | null;
          telegram_username: string | null;
          agent: 'scout' | 'analyst' | 'trader' | 'commander' | null;
          command: string | null;
          response: string | null;
          mood: string | null;
          data: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_type: 'telegram_message' | 'agent_response' | 'arb_alert' | 'whale_alert' | 'prediction' | 'heartbeat' | 'error';
          session_id?: string | null;
          user_id?: string | null;
          telegram_id?: number | null;
          telegram_username?: string | null;
          agent?: 'scout' | 'analyst' | 'trader' | 'commander' | null;
          command?: string | null;
          response?: string | null;
          mood?: string | null;
          data?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_type?: 'telegram_message' | 'agent_response' | 'arb_alert' | 'whale_alert' | 'prediction' | 'heartbeat' | 'error';
          session_id?: string | null;
          user_id?: string | null;
          telegram_id?: number | null;
          telegram_username?: string | null;
          agent?: 'scout' | 'analyst' | 'trader' | 'commander' | null;
          command?: string | null;
          response?: string | null;
          mood?: string | null;
          data?: Record<string, unknown> | null;
          created_at?: string;
        };
      };
    };

    Views: {
      leaderboard: {
        Row: {
          id: string | null;
          username: string | null;
          telegram_id: number | null;
          telegram_username: string | null;
          wallet_address: string | null;
          avatar_url: string | null;
          total_predictions: number | null;
          prediction_count: number | null; // Alias for total_predictions
          resolved_predictions: number | null;
          avg_brier_score: number | null;
          correct_predictions: number | null;
          accuracy: number | null;
          last_prediction_at: string | null;
        };
      };
    };

    Functions: {
      calculate_brier_score: {
        Args: {
          predicted_prob: number;
          direction: string;
          outcome: boolean;
        };
        Returns: number;
      };
    };
  };
}

// Convenience type exports
export type User = Database['public']['Tables']['users']['Row'];
export type Prediction = Database['public']['Tables']['predictions']['Row'];
export type Alert = Database['public']['Tables']['alerts']['Row'];
export type WatchlistItem = Database['public']['Tables']['watchlist']['Row'];
export type WhaleWallet = Database['public']['Tables']['whale_wallets']['Row'];
export type WhaleTrade = Database['public']['Tables']['whale_trades']['Row'];
export type ArbitrageRecord = Database['public']['Tables']['arbitrage_history']['Row'];
export type Session = Database['public']['Tables']['sessions']['Row'];
export type BerightEvent = Database['public']['Tables']['beright_events']['Row'];
export type LeaderboardEntry = Database['public']['Views']['leaderboard']['Row'];

// Insert types
export type NewPrediction = Database['public']['Tables']['predictions']['Insert'];
export type NewAlert = Database['public']['Tables']['alerts']['Insert'];
export type NewWatchlistItem = Database['public']['Tables']['watchlist']['Insert'];
export type NewBerightEvent = Database['public']['Tables']['beright_events']['Insert'];
