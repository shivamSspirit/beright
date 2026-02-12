/**
 * Database Client for BeRight Protocol
 * Uses Supabase for PostgreSQL backend
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Types for database models
export interface User {
  id: string;
  wallet_address: string | null;
  telegram_id: string | null;
  telegram_username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  settings: UserSettings;
}

export interface UserSettings {
  notifications_enabled: boolean;
  daily_brief_enabled: boolean;
  alert_threshold_arb: number;  // Min arb % to alert
  alert_threshold_whale: number;  // Min USD to alert
  timezone: string;
}

export interface Prediction {
  id: string;
  user_id: string;
  question: string;
  platform: string;
  market_id: string | null;
  market_url: string | null;
  predicted_probability: number;  // 0-1
  direction: 'YES' | 'NO';
  confidence: 'low' | 'medium' | 'high';
  reasoning: string | null;
  created_at: string;
  resolves_at: string | null;
  resolved_at: string | null;
  outcome: boolean | null;  // true = YES, false = NO, null = pending
  brier_score: number | null;
  tags: string[];
}

export interface Alert {
  id: string;
  user_id: string;
  type: 'arbitrage' | 'whale' | 'price' | 'resolution';
  market_id: string | null;
  condition: AlertCondition;
  triggered: boolean;
  triggered_at: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface AlertCondition {
  threshold?: number;
  direction?: 'above' | 'below';
  platform?: string;
}

export interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  wallet_address: string | null;
  brier_score: number;
  accuracy: number;
  total_predictions: number;
  resolved_predictions: number;
  current_streak: number;
  streak_type: 'win' | 'loss' | 'none';
  best_streak: number;
  rank: number;
  updated_at: string;
}

export interface Achievement {
  id: string;
  user_id: string;
  achievement_type: string;
  earned_at: string;
  metadata: Record<string, unknown>;
}

// Database client singleton
let supabase: SupabaseClient | null = null;

/**
 * Get Supabase client
 */
export function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error('Supabase credentials not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env');
    }

    supabase = createClient(url, key);
  }

  return supabase;
}

// ========== User Operations ==========

/**
 * Get or create user by wallet address
 */
export async function getOrCreateUserByWallet(walletAddress: string): Promise<User> {
  const db = getSupabase();

  // Try to find existing user
  const { data: existing } = await db
    .from('users')
    .select('*')
    .eq('wallet_address', walletAddress)
    .single();

  if (existing) return existing as User;

  // Create new user
  const defaultSettings: UserSettings = {
    notifications_enabled: true,
    daily_brief_enabled: true,
    alert_threshold_arb: 5,
    alert_threshold_whale: 50000,
    timezone: 'UTC',
  };

  const { data, error } = await db
    .from('users')
    .insert({
      wallet_address: walletAddress,
      settings: defaultSettings,
    })
    .select()
    .single();

  if (error) throw error;
  return data as User;
}

/**
 * Get or create user by Telegram ID
 */
export async function getOrCreateUserByTelegram(
  telegramId: string,
  username?: string
): Promise<User> {
  const db = getSupabase();

  // Try to find existing user
  const { data: existing } = await db
    .from('users')
    .select('*')
    .eq('telegram_id', telegramId)
    .single();

  if (existing) return existing as User;

  // Create new user
  const defaultSettings: UserSettings = {
    notifications_enabled: true,
    daily_brief_enabled: true,
    alert_threshold_arb: 5,
    alert_threshold_whale: 50000,
    timezone: 'UTC',
  };

  const { data, error } = await db
    .from('users')
    .insert({
      telegram_id: telegramId,
      telegram_username: username,
      display_name: username,
      settings: defaultSettings,
    })
    .select()
    .single();

  if (error) throw error;
  return data as User;
}

/**
 * Link wallet to existing user
 */
export async function linkWalletToUser(userId: string, walletAddress: string): Promise<User> {
  const db = getSupabase();

  const { data, error } = await db
    .from('users')
    .update({ wallet_address: walletAddress, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data as User;
}

// ========== Prediction Operations ==========

/**
 * Create a new prediction
 */
export async function createPrediction(
  userId: string,
  prediction: Omit<Prediction, 'id' | 'user_id' | 'created_at' | 'resolved_at' | 'outcome' | 'brier_score'>
): Promise<Prediction> {
  const db = getSupabase();

  const { data, error } = await db
    .from('predictions')
    .insert({
      user_id: userId,
      ...prediction,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Prediction;
}

/**
 * Get user's predictions
 */
export async function getUserPredictions(
  userId: string,
  options: { limit?: number; status?: 'pending' | 'resolved' | 'all' } = {}
): Promise<Prediction[]> {
  const db = getSupabase();
  const { limit = 50, status = 'all' } = options;

  let query = db
    .from('predictions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status === 'pending') {
    query = query.is('outcome', null);
  } else if (status === 'resolved') {
    query = query.not('outcome', 'is', null);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Prediction[];
}

/**
 * Resolve a prediction
 */
export async function resolvePrediction(
  predictionId: string,
  outcome: boolean
): Promise<Prediction> {
  const db = getSupabase();

  // Get the prediction first
  const { data: prediction } = await db
    .from('predictions')
    .select('*')
    .eq('id', predictionId)
    .single();

  if (!prediction) throw new Error('Prediction not found');

  // Calculate Brier score
  const probForYes = prediction.direction === 'YES'
    ? prediction.predicted_probability
    : 1 - prediction.predicted_probability;
  const brierScore = Math.pow(probForYes - (outcome ? 1 : 0), 2);

  // Update prediction
  const { data, error } = await db
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
}

/**
 * Update prediction with on-chain transaction signature
 */
export async function updatePredictionOnChain(
  predictionId: string,
  onChainTx: string,
  confirmed: boolean = true
): Promise<Prediction> {
  const db = getSupabase();

  const { data, error } = await db
    .from('predictions')
    .update({
      on_chain_tx: onChainTx,
      on_chain_confirmed: confirmed,
    })
    .eq('id', predictionId)
    .select()
    .single();

  if (error) throw error;
  return data as Prediction;
}

/**
 * Update prediction with on-chain resolution transaction
 */
export async function updatePredictionResolutionTx(
  predictionId: string,
  resolutionTx: string
): Promise<Prediction> {
  const db = getSupabase();

  const { data, error } = await db
    .from('predictions')
    .update({
      on_chain_resolution_tx: resolutionTx,
    })
    .eq('id', predictionId)
    .select()
    .single();

  if (error) throw error;
  return data as Prediction;
}

// ========== Leaderboard Operations ==========

/**
 * Get leaderboard
 */
export async function getLeaderboard(limit = 100): Promise<LeaderboardEntry[]> {
  const db = getSupabase();

  const { data, error } = await db
    .from('leaderboard_stats')
    .select('*')
    .order('brier_score', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data as LeaderboardEntry[];
}

/**
 * Get user's rank
 */
export async function getUserRank(userId: string): Promise<number | null> {
  const db = getSupabase();

  const { data, error } = await db
    .from('leaderboard_stats')
    .select('rank')
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;
  return data.rank;
}

/**
 * Update leaderboard stats for a user
 */
export async function updateLeaderboardStats(userId: string): Promise<void> {
  const db = getSupabase();

  // Get user's resolved predictions
  const { data: predictions } = await db
    .from('predictions')
    .select('*')
    .eq('user_id', userId)
    .not('outcome', 'is', null);

  if (!predictions || predictions.length === 0) return;

  // Calculate stats
  const brierScores = predictions.map(p => p.brier_score || 0);
  const avgBrier = brierScores.reduce((a, b) => a + b, 0) / brierScores.length;

  const correctCalls = predictions.filter(p =>
    (p.direction === 'YES') === p.outcome
  );
  const accuracy = correctCalls.length / predictions.length;

  // Calculate streak
  const sorted = predictions.sort(
    (a, b) => new Date(b.resolved_at).getTime() - new Date(a.resolved_at).getTime()
  );

  let streak = 0;
  let streakType: 'win' | 'loss' | 'none' = 'none';
  for (const p of sorted) {
    const isWin = (p.direction === 'YES') === p.outcome;
    if (streak === 0) {
      streakType = isWin ? 'win' : 'loss';
      streak = 1;
    } else if ((streakType === 'win' && isWin) || (streakType === 'loss' && !isWin)) {
      streak++;
    } else {
      break;
    }
  }

  // Get user info
  const { data: user } = await db
    .from('users')
    .select('display_name, wallet_address')
    .eq('id', userId)
    .single();

  // Upsert leaderboard entry
  await db
    .from('leaderboard_stats')
    .upsert({
      user_id: userId,
      display_name: user?.display_name || 'Anonymous',
      wallet_address: user?.wallet_address,
      brier_score: avgBrier,
      accuracy,
      total_predictions: predictions.length,
      resolved_predictions: predictions.length,
      current_streak: streak,
      streak_type: streakType,
      updated_at: new Date().toISOString(),
    });
}

// ========== Alert Operations ==========

/**
 * Create an alert
 */
export async function createAlert(
  userId: string,
  alert: Omit<Alert, 'id' | 'user_id' | 'created_at' | 'triggered' | 'triggered_at'>
): Promise<Alert> {
  const db = getSupabase();

  const { data, error } = await db
    .from('alerts')
    .insert({
      user_id: userId,
      triggered: false,
      ...alert,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Alert;
}

/**
 * Get user's active alerts
 */
export async function getUserAlerts(userId: string): Promise<Alert[]> {
  const db = getSupabase();

  const { data, error } = await db
    .from('alerts')
    .select('*')
    .eq('user_id', userId)
    .eq('triggered', false)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Alert[];
}

/**
 * Trigger an alert
 */
export async function triggerAlert(alertId: string): Promise<Alert> {
  const db = getSupabase();

  const { data, error } = await db
    .from('alerts')
    .update({
      triggered: true,
      triggered_at: new Date().toISOString(),
    })
    .eq('id', alertId)
    .select()
    .single();

  if (error) throw error;
  return data as Alert;
}

// ========== Achievement Operations ==========

/**
 * Award achievement to user
 */
export async function awardAchievement(
  userId: string,
  achievementType: string,
  metadata: Record<string, unknown> = {}
): Promise<Achievement> {
  const db = getSupabase();

  // Check if already has achievement
  const { data: existing } = await db
    .from('achievements')
    .select('*')
    .eq('user_id', userId)
    .eq('achievement_type', achievementType)
    .single();

  if (existing) return existing as Achievement;

  const { data, error } = await db
    .from('achievements')
    .insert({
      user_id: userId,
      achievement_type: achievementType,
      metadata,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Achievement;
}

/**
 * Get user's achievements
 */
export async function getUserAchievements(userId: string): Promise<Achievement[]> {
  const db = getSupabase();

  const { data, error } = await db
    .from('achievements')
    .select('*')
    .eq('user_id', userId)
    .order('earned_at', { ascending: false });

  if (error) throw error;
  return data as Achievement[];
}

// Achievement types
export const ACHIEVEMENTS = {
  FIRST_PREDICTION: { type: 'first_prediction', name: 'Baby Forecaster', description: 'Made your first prediction' },
  STREAK_7: { type: 'streak_7', name: 'Week Warrior', description: '7-day prediction streak' },
  STREAK_30: { type: 'streak_30', name: 'Consistent', description: '30-day prediction streak' },
  ACCURACY_70: { type: 'accuracy_70', name: 'Sharp Shooter', description: '70% directional accuracy' },
  BRIER_UNDER_20: { type: 'brier_under_20', name: 'Calibrated', description: 'Brier score under 0.20' },
  BRIER_UNDER_15: { type: 'brier_under_15', name: 'Superforecaster', description: 'Brier score under 0.15' },
  TOP_10_PERCENT: { type: 'top_10_percent', name: 'Elite', description: 'Top 10% on leaderboard' },
  PREDICTIONS_50: { type: 'predictions_50', name: 'Prolific', description: '50 predictions made' },
  PREDICTIONS_100: { type: 'predictions_100', name: 'Veteran', description: '100 predictions made' },
};
