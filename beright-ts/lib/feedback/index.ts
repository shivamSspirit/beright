/**
 * Signal Quality Feedback Loop
 *
 * Tracks signal accuracy and self-calibrates the system:
 *   - Records signal outcomes (correct/incorrect)
 *   - Calculates per-type quality scores
 *   - Adjusts signal weights based on historical accuracy
 *   - Provides calibration metrics for monitoring
 *
 * Pipeline:
 *   1. Signal generated → stored with prediction
 *   2. Market resolves → compare to prediction
 *   3. Update quality scores
 *   4. Adjust weights for future signals
 *
 * Usage:
 *   await recordFeedback(signalId, 'correct');
 *   const quality = await getSignalQuality('volume_surge');
 *   const calibration = await runCalibrationCheck();
 */

import { supabaseAdmin, isSupabaseConfigured } from '../supabase/client';
import { SignalType, EvaluatedSignal } from '../signals/types';
import {
  SignalFeedback,
  SignalQualityScore,
  CalibrationSnapshot,
  FeedbackConfig,
  DEFAULT_FEEDBACK_CONFIG,
} from './types';

export * from './types';

/**
 * Record feedback for a signal
 */
export async function recordFeedback(
  signalId: string,
  outcome: 'correct' | 'incorrect' | 'partial',
  options?: {
    notes?: string;
    resolutionPrice?: number;
    source?: 'auto' | 'manual' | 'resolution';
  }
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  try {
    // Get original signal
    const { data: signal } = await supabaseAdmin
      .from('signals')
      .select('*')
      .eq('id', signalId)
      .single();

    if (!signal) {
      console.warn('[Feedback] Signal not found:', signalId);
      return false;
    }

    // Get price at signal time (if available)
    const { data: snapshot } = await supabaseAdmin
      .from('price_snapshots')
      .select('yes_price')
      .eq('market_id', signal.market_id)
      .lte('snapshot_at', signal.created_at)
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .single();

    const priceAtSignal = snapshot?.yes_price;
    const priceChange = options?.resolutionPrice !== undefined && priceAtSignal !== undefined
      ? options.resolutionPrice - priceAtSignal
      : undefined;

    // Insert feedback
    const { error } = await supabaseAdmin
      .from('signal_feedback')
      .insert({
        signal_id: signalId,
        signal_type: signal.type,
        market_id: signal.market_id,
        market_title: signal.market_title,
        platform: signal.platform,
        original_action: signal.action,
        original_confidence: signal.confidence,
        original_strength: signal.strength,
        outcome,
        outcome_notes: options?.notes,
        resolution_price: options?.resolutionPrice,
        price_at_signal: priceAtSignal,
        price_change: priceChange,
        feedback_source: options?.source || 'manual',
        signal_at: signal.created_at,
        resolved_at: new Date().toISOString(),
      });

    if (error) {
      console.warn('[Feedback] Failed to record:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.warn('[Feedback] Error:', err);
    return false;
  }
}

/**
 * Auto-resolve signals based on market resolution
 */
export async function autoResolveSignals(
  config: Partial<FeedbackConfig> = {}
): Promise<number> {
  if (!isSupabaseConfigured) return 0;

  const finalConfig = { ...DEFAULT_FEEDBACK_CONFIG, ...config };
  let resolved = 0;

  try {
    // Get signals without feedback that are old enough
    const cutoffDate = new Date(
      Date.now() - finalConfig.autoResolveDays * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: unresolvedSignals } = await supabaseAdmin
      .from('signals')
      .select('id, market_id, platform, created_at, action, strength')
      .lte('created_at', cutoffDate)
      .in('action', ['ALERT', 'WATCH'])
      .not('id', 'in', `(SELECT signal_id FROM signal_feedback WHERE signal_id IS NOT NULL)`)
      .limit(50);

    if (!unresolvedSignals || unresolvedSignals.length === 0) return 0;

    for (const signal of unresolvedSignals) {
      // Get current price for market
      const { data: currentPrice } = await supabaseAdmin
        .from('price_snapshots')
        .select('yes_price')
        .eq('market_id', signal.market_id)
        .order('snapshot_at', { ascending: false })
        .limit(1)
        .single();

      // Get price at signal time
      const { data: signalPrice } = await supabaseAdmin
        .from('price_snapshots')
        .select('yes_price')
        .eq('market_id', signal.market_id)
        .lte('snapshot_at', signal.created_at)
        .order('snapshot_at', { ascending: false })
        .limit(1)
        .single();

      if (!currentPrice || !signalPrice) continue;

      const priceChange = Math.abs(currentPrice.yes_price - signalPrice.yes_price);

      // Determine outcome based on signal type and price movement
      let outcome: 'correct' | 'incorrect' | 'partial';

      // For ALERT signals: expect significant price movement
      if (signal.action === 'ALERT') {
        if (priceChange >= finalConfig.correctOutcomeThreshold) {
          outcome = 'correct';
        } else if (priceChange >= finalConfig.correctOutcomeThreshold / 2) {
          outcome = 'partial';
        } else {
          outcome = 'incorrect';
        }
      } else {
        // For WATCH signals: any movement is partial success
        if (priceChange >= finalConfig.correctOutcomeThreshold) {
          outcome = 'correct';
        } else if (priceChange > 0.01) {
          outcome = 'partial';
        } else {
          outcome = 'incorrect';
        }
      }

      const success = await recordFeedback(signal.id, outcome, {
        resolutionPrice: currentPrice.yes_price,
        source: 'auto',
        notes: `Auto-resolved after ${finalConfig.autoResolveDays} days. Price change: ${(priceChange * 100).toFixed(1)}%`,
      });

      if (success) resolved++;
    }

    return resolved;
  } catch (err) {
    console.warn('[Feedback] Auto-resolve error:', err);
    return 0;
  }
}

/**
 * Get quality score for a signal type
 */
export async function getSignalQuality(
  signalType: SignalType
): Promise<SignalQualityScore | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabaseAdmin
      .from('signal_quality_scores')
      .select('*')
      .eq('signal_type', signalType)
      .single();

    if (error || !data) return null;

    return {
      signalType: data.signal_type as SignalType,
      totalSignals: data.total_signals,
      correctSignals: data.correct_signals,
      incorrectSignals: data.incorrect_signals,
      pendingSignals: data.pending_signals,
      accuracyScore: data.accuracy_score,
      precisionScore: data.precision_score,
      recallScore: data.recall_score,
      brierScore: data.brier_score,
      calibrationError: data.calibration_error,
      avgConfidence: data.avg_confidence,
      confidenceStd: data.confidence_std,
      weightModifier: data.weight_modifier,
      recommendedThreshold: data.recommended_threshold,
      lastUpdated: new Date(data.last_updated),
      lastCalibration: new Date(data.last_calibration),
    };
  } catch {
    return null;
  }
}

/**
 * Get all quality scores
 */
export async function getAllQualityScores(): Promise<SignalQualityScore[]> {
  if (!isSupabaseConfigured) return [];

  try {
    const { data, error } = await supabaseAdmin
      .from('signal_quality_scores')
      .select('*')
      .order('accuracy_score', { ascending: false });

    if (error || !data) return [];

    return data.map((row: any) => ({
      signalType: row.signal_type as SignalType,
      totalSignals: row.total_signals,
      correctSignals: row.correct_signals,
      incorrectSignals: row.incorrect_signals,
      pendingSignals: row.pending_signals,
      accuracyScore: row.accuracy_score,
      precisionScore: row.precision_score,
      recallScore: row.recall_score,
      brierScore: row.brier_score,
      calibrationError: row.calibration_error,
      avgConfidence: row.avg_confidence,
      confidenceStd: row.confidence_std,
      weightModifier: row.weight_modifier,
      recommendedThreshold: row.recommended_threshold,
      lastUpdated: new Date(row.last_updated),
      lastCalibration: new Date(row.last_calibration),
    }));
  } catch {
    return [];
  }
}

/**
 * Get weight modifier for a signal type
 * Used to adjust signal strength based on historical accuracy
 */
export async function getWeightModifier(signalType: SignalType): Promise<number> {
  const quality = await getSignalQuality(signalType);
  return quality?.weightModifier ?? 1.0;
}

/**
 * Apply weight adjustments to a signal
 */
export async function applyCalibration(
  signal: EvaluatedSignal
): Promise<EvaluatedSignal> {
  const modifier = await getWeightModifier(signal.type);

  return {
    ...signal,
    strength: Math.min(1, signal.strength * modifier),
    confidence: Math.round(Math.min(100, signal.confidence * modifier)),
  };
}

/**
 * Run calibration check and save snapshot
 */
export async function runCalibrationCheck(): Promise<CalibrationSnapshot | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const scores = await getAllQualityScores();
    if (scores.length === 0) return null;

    // Calculate overall metrics
    const totalSignals = scores.reduce((sum, s) => sum + s.totalSignals, 0);
    const totalCorrect = scores.reduce((sum, s) => sum + s.correctSignals, 0);
    const totalIncorrect = scores.reduce((sum, s) => sum + s.incorrectSignals, 0);

    const overallAccuracy = (totalCorrect + totalIncorrect) > 0
      ? totalCorrect / (totalCorrect + totalIncorrect)
      : 0.5;

    const overallBrier = scores.length > 0
      ? scores.reduce((sum, s) => sum + s.brierScore * s.totalSignals, 0) / totalSignals
      : 0.25;

    // Build type scores
    const typeScores: Record<string, any> = {};
    for (const s of scores) {
      typeScores[s.signalType] = {
        accuracy: s.accuracyScore,
        brier: s.brierScore,
        weight: s.weightModifier,
        count: s.totalSignals,
      };
    }

    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Save snapshot
    const { data, error } = await supabaseAdmin
      .from('calibration_history')
      .insert({
        overall_accuracy: overallAccuracy,
        overall_brier: overallBrier,
        type_scores: typeScores,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        signals_evaluated: totalSignals,
      })
      .select()
      .single();

    if (error) {
      console.warn('[Feedback] Failed to save calibration:', error.message);
      return null;
    }

    return {
      id: data.id,
      recordedAt: new Date(data.recorded_at),
      overallAccuracy,
      overallBrier,
      typeScores,
      periodStart,
      periodEnd,
      signalsEvaluated: totalSignals,
    };
  } catch (err) {
    console.warn('[Feedback] Calibration check error:', err);
    return null;
  }
}

/**
 * Format calibration report for Telegram
 */
export function formatCalibrationReport(snapshot: CalibrationSnapshot): string {
  const accuracyEmoji = snapshot.overallAccuracy >= 0.7 ? '🟢' :
                        snapshot.overallAccuracy >= 0.5 ? '🟡' : '🔴';

  let text = `*SIGNAL CALIBRATION REPORT*\n${'─'.repeat(32)}\n\n`;

  text += `${accuracyEmoji} *Overall Accuracy:* ${(snapshot.overallAccuracy * 100).toFixed(1)}%\n`;
  text += `📊 *Brier Score:* ${snapshot.overallBrier.toFixed(3)} (lower is better)\n`;
  text += `📈 *Signals Evaluated:* ${snapshot.signalsEvaluated}\n\n`;

  text += `*PER-TYPE PERFORMANCE*\n`;

  const sortedTypes = Object.entries(snapshot.typeScores)
    .sort((a, b) => b[1].accuracy - a[1].accuracy)
    .slice(0, 6);

  for (const [type, scores] of sortedTypes) {
    const emoji = scores.accuracy >= 0.7 ? '🟢' : scores.accuracy >= 0.5 ? '🟡' : '🔴';
    const weightIcon = scores.weight > 1 ? '↑' : scores.weight < 1 ? '↓' : '→';
    text += `${emoji} ${type}: ${(scores.accuracy * 100).toFixed(0)}% ${weightIcon}\n`;
  }

  text += `\n_${snapshot.periodStart.toLocaleDateString()} - ${snapshot.periodEnd.toLocaleDateString()}_`;

  return text;
}
