/**
 * Forecaster Reputation Layer
 *
 * Tracks and calculates Brier scores per domain for each forecaster.
 * Assigns badges based on performance.
 * Updates forecaster_profiles table in Supabase.
 */

import { supabaseAdmin, isSupabaseConfigured } from './supabase/client';
import * as crypto from 'crypto';

export type Domain = 'politics' | 'crypto' | 'sports' | 'macro' | 'science' | 'general';

export interface PredictionRecord {
  predictionId: string;
  telegramId: number;
  question: string;
  domain: Domain;
  predictedProbability: number;   // 0-1, probability of YES
  direction: 'YES' | 'NO';
  outcome?: boolean;              // true = YES resolved, false = NO resolved
  brierScore?: number;            // filled after resolution
  createdAt: string;
  resolvedAt?: string;
  onChainTx?: string;
}

export interface ForecasterProfile {
  telegramId: number;
  displayName: string;
  brierOverall: number | null;
  brierPolitics: number | null;
  brierCrypto: number | null;
  brierSports: number | null;
  brierMacro: number | null;
  predictionCount: number;
  resolvedCount: number;
  accuracy30d: number | null;
  globalRank: number | null;
  badges: string[];
  isPublic: boolean;
}

// Domain keyword classifiers
const DOMAIN_KEYWORDS: Record<Domain, string[]> = {
  politics:  ['president', 'election', 'trump', 'biden', 'congress', 'senate', 'vote', 'democrat', 'republican', 'parliament', 'prime minister', 'poll'],
  crypto:    ['bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'token', 'defi', 'solana', 'sol', 'coinbase', 'binance', 'price', 'market cap'],
  sports:    ['nfl', 'nba', 'mlb', 'nhl', 'soccer', 'football', 'basketball', 'baseball', 'championship', 'super bowl', 'world cup', 'match', 'game'],
  macro:     ['gdp', 'inflation', 'cpi', 'federal reserve', 'interest rate', 'recession', 'unemployment', 'fed', 'stock market', 's&p', 'nasdaq'],
  science:   ['ai', 'artificial intelligence', 'climate', 'vaccine', 'fda', 'drug', 'space', 'nasa', 'research', 'trial'],
  general:   [],
};

/**
 * Classify a prediction question into a domain
 */
export function classifyDomain(question: string): Domain {
  const lower = question.toLowerCase();

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS) as [Domain, string[]][]) {
    if (domain === 'general') continue;
    if (keywords.some(kw => lower.includes(kw))) {
      return domain;
    }
  }

  return 'general';
}

/**
 * Calculate Brier score for a single prediction
 * Brier score = (forecast - actual)^2
 * Lower is better. 0 = perfect, 0.25 = random, 1 = maximally wrong
 */
export function calculateBrier(predictedProbability: number, direction: 'YES' | 'NO', outcome: boolean): number {
  // Convert to probability of YES
  const forecastYes = direction === 'YES' ? predictedProbability : 1 - predictedProbability;
  const actual = outcome ? 1 : 0;
  return Math.pow(forecastYes - actual, 2);
}

/**
 * Calculate average Brier score for an array of scores
 */
export function averageBrier(scores: number[]): number | null {
  if (scores.length === 0) return null;
  return scores.reduce((sum, s) => sum + s, 0) / scores.length;
}

/**
 * Assign badges based on Brier scores and prediction count
 */
export function assignBadges(profile: Partial<ForecasterProfile>): string[] {
  const badges: string[] = [];

  const overall = profile.brierOverall;
  const count = profile.predictionCount || 0;

  if (overall !== null && overall !== undefined) {
    if (overall < 0.08 && count >= 20) badges.push('elite_forecaster');
    else if (overall < 0.12 && count >= 10) badges.push('superforecaster');
    else if (overall < 0.18 && count >= 5) badges.push('expert');
    else if (overall < 0.22) badges.push('good_calibration');
  }

  if (count >= 100) badges.push('veteran');
  else if (count >= 50) badges.push('active');
  else if (count >= 10) badges.push('contributor');

  // Domain expert badges
  if ((profile.brierPolitics ?? 1) < 0.14) badges.push('politics_expert');
  if ((profile.brierCrypto ?? 1) < 0.14) badges.push('crypto_expert');
  if ((profile.brierSports ?? 1) < 0.14) badges.push('sports_expert');
  if ((profile.brierMacro ?? 1) < 0.14) badges.push('macro_expert');

  return badges;
}

/**
 * Recalculate and update a forecaster's profile based on all their predictions
 */
export async function updateForecasterProfile(telegramId: number): Promise<ForecasterProfile | null> {
  if (!isSupabaseConfigured) return null;

  try {
    // Get all resolved predictions for this user
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, telegram_username')
      .eq('telegram_id', telegramId)
      .single();

    if (!user) return null;
    const userRow = user as { id: string; telegram_username: string };

    const { data: predictions } = await supabaseAdmin
      .from('predictions')
      .select('predicted_probability, direction, outcome, brier_score, question, created_at, resolved_at')
      .eq('user_id', userRow.id)
      .not('outcome', 'is', null);

    const preds = (predictions || []) as any[];

    // Classify by domain
    const domainScores: Record<Domain, number[]> = {
      politics: [], crypto: [], sports: [], macro: [], science: [], general: [],
    };

    const allScores: number[] = [];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let correct30d = 0;
    let resolved30d = 0;

    for (const pred of preds) {
      const domain = classifyDomain(pred.question);
      const brier = pred.brier_score ?? calculateBrier(
        pred.predicted_probability,
        pred.direction,
        pred.outcome,
      );

      domainScores[domain].push(brier);
      allScores.push(brier);

      // 30-day accuracy
      if (pred.resolved_at && new Date(pred.resolved_at) > thirtyDaysAgo) {
        resolved30d++;
        const correct = (pred.direction === 'YES' && pred.outcome === true) ||
                        (pred.direction === 'NO' && pred.outcome === false);
        if (correct) correct30d++;
      }
    }

    const { data: countResult } = await supabaseAdmin
      .from('predictions')
      .select('id', { count: 'exact' })
      .eq('user_id', userRow.id);

    const totalCount = (countResult as any)?.length || preds.length;

    const profile: Partial<ForecasterProfile> = {
      telegramId,
      displayName: userRow.telegram_username || `User ${telegramId}`,
      brierOverall: averageBrier(allScores),
      brierPolitics: averageBrier(domainScores.politics),
      brierCrypto: averageBrier(domainScores.crypto),
      brierSports: averageBrier(domainScores.sports),
      brierMacro: averageBrier(domainScores.macro),
      predictionCount: totalCount,
      resolvedCount: preds.length,
      accuracy30d: resolved30d > 0 ? correct30d / resolved30d : null,
    };

    profile.badges = assignBadges(profile);

    // Upsert to forecaster_profiles
    const { data: saved, error } = await supabaseAdmin
      .from('forecaster_profiles')
      .upsert({
        telegram_id: telegramId,
        display_name: profile.displayName,
        brier_overall: profile.brierOverall,
        brier_politics: profile.brierPolitics,
        brier_crypto: profile.brierCrypto,
        brier_sports: profile.brierSports,
        brier_macro: profile.brierMacro,
        prediction_count: profile.predictionCount,
        resolved_count: profile.resolvedCount,
        accuracy_30d: profile.accuracy30d,
        badges: profile.badges,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'telegram_id' })
      .select()
      .single();

    if (error) {
      console.warn('[Reputation] Failed to save profile:', error.message);
      return null;
    }

    // Update global rank
    await updateGlobalRankings();

    return profile as ForecasterProfile;
  } catch (err) {
    console.warn('[Reputation] Profile update failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Recalculate global rankings for all forecasters
 * Ranked by overall Brier score (lower = better)
 */
export async function updateGlobalRankings(): Promise<void> {
  if (!isSupabaseConfigured) return;

  try {
    const { data } = await supabaseAdmin
      .from('forecaster_profiles')
      .select('id, brier_overall')
      .not('brier_overall', 'is', null)
      .gte('resolved_count', 3)  // need at least 3 resolved predictions to rank
      .order('brier_overall', { ascending: true });

    if (!data) return;

    // Batch update ranks
    const updates = (data as { id: string; brier_overall: number }[]).map((row, index) => ({
      id: row.id,
      global_rank: index + 1,
    }));

    for (const update of updates) {
      await supabaseAdmin
        .from('forecaster_profiles')
        .update({ global_rank: update.global_rank })
        .eq('id', update.id);
    }
  } catch (err) {
    console.warn('[Reputation] Rankings update failed:', err instanceof Error ? err.message : err);
  }
}

/**
 * Get top forecasters leaderboard
 */
export async function getTopForecasters(options?: {
  limit?: number;
  domain?: Domain;
  minPredictions?: number;
}): Promise<ForecasterProfile[]> {
  if (!isSupabaseConfigured) return [];

  try {
    const limit = options?.limit || 10;
    const minPreds = options?.minPredictions || 3;
    const sortField = options?.domain ? `brier_${options.domain}` : 'brier_overall';

    const { data } = await supabaseAdmin
      .from('forecaster_profiles')
      .select('*')
      .not(sortField, 'is', null)
      .gte('resolved_count', minPreds)
      .eq('is_public', true)
      .order(sortField, { ascending: true })
      .limit(limit);

    if (!data) return [];

    return (data as any[]).map(row => ({
      telegramId: row.telegram_id,
      displayName: row.display_name,
      brierOverall: row.brier_overall,
      brierPolitics: row.brier_politics,
      brierCrypto: row.brier_crypto,
      brierSports: row.brier_sports,
      brierMacro: row.brier_macro,
      predictionCount: row.prediction_count,
      resolvedCount: row.resolved_count,
      accuracy30d: row.accuracy_30d,
      globalRank: row.global_rank,
      badges: row.badges || [],
      isPublic: row.is_public,
    }));
  } catch {
    return [];
  }
}

/**
 * Get a forecaster's public profile
 */
export async function getForecasterProfile(telegramId: number): Promise<ForecasterProfile | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data } = await supabaseAdmin
      .from('forecaster_profiles')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    if (!data) return null;
    const row = data as any;

    return {
      telegramId: row.telegram_id,
      displayName: row.display_name,
      brierOverall: row.brier_overall,
      brierPolitics: row.brier_politics,
      brierCrypto: row.brier_crypto,
      brierSports: row.brier_sports,
      brierMacro: row.brier_macro,
      predictionCount: row.prediction_count,
      resolvedCount: row.resolved_count,
      accuracy30d: row.accuracy_30d,
      globalRank: row.global_rank,
      badges: row.badges || [],
      isPublic: row.is_public,
    };
  } catch {
    return null;
  }
}

/**
 * Format a forecaster profile for Telegram display
 */
export function formatForecasterProfile(profile: ForecasterProfile): string {
  const brierLabel = (score: number | null) => {
    if (score === null) return 'N/A';
    if (score < 0.08) return `${score.toFixed(3)} 🏆`;
    if (score < 0.12) return `${score.toFixed(3)} ⭐`;
    if (score < 0.18) return `${score.toFixed(3)} ✅`;
    return score.toFixed(3);
  };

  const badgeEmojis: Record<string, string> = {
    elite_forecaster: '🏆',
    superforecaster: '⭐',
    expert: '🎯',
    good_calibration: '📊',
    veteran: '🎖',
    active: '⚡',
    contributor: '✅',
    politics_expert: '🏛',
    crypto_expert: '₿',
    sports_expert: '🏆',
    macro_expert: '📈',
  };

  const badgesStr = profile.badges
    .map(b => `${badgeEmojis[b] || '•'} ${b.replace(/_/g, ' ')}`)
    .join('\n');

  let text = `*${profile.displayName}*\n`;
  if (profile.globalRank) text += `Global Rank: #${profile.globalRank}\n`;
  text += `\n`;

  text += `*BRIER SCORES* (lower = better)\n`;
  text += `Overall: ${brierLabel(profile.brierOverall)}\n`;
  if (profile.brierPolitics !== null) text += `Politics: ${brierLabel(profile.brierPolitics)}\n`;
  if (profile.brierCrypto !== null) text += `Crypto: ${brierLabel(profile.brierCrypto)}\n`;
  if (profile.brierSports !== null) text += `Sports: ${brierLabel(profile.brierSports)}\n`;
  if (profile.brierMacro !== null) text += `Macro: ${brierLabel(profile.brierMacro)}\n`;

  text += `\n*STATS*\n`;
  text += `Predictions: ${profile.predictionCount} total, ${profile.resolvedCount} resolved\n`;
  if (profile.accuracy30d !== null) {
    text += `30d accuracy: ${(profile.accuracy30d * 100).toFixed(0)}%\n`;
  }

  if (profile.badges.length > 0) {
    text += `\n*BADGES*\n${badgesStr}\n`;
  }

  return text;
}
