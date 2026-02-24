/**
 * Signal Intelligence Orchestrator
 *
 * Runs all 9 detectors in parallel (fast, deterministic),
 * then sends each raw signal through Groq Scout for LLM evaluation.
 * Returns only ALERT/WATCH signals — SKIPs are discarded.
 *
 * Pipeline:
 *   11 Detectors (parallel) → Groq Scout evaluation → Supabase save → Alert queue
 */

import { llmChat } from '../llm';
import { supabaseAdmin, isSupabaseConfigured } from '../supabase/client';
import { RawSignal, EvaluatedSignal, SIGNAL_META } from './types';

import { detectVolumeSurge } from './volumeSurge';
import { detectOddsShift } from './oddsShift';
import { detectArbOpportunity } from './arbOpportunity';
import { detectResolutionImminent } from './resolutionImminent';
import { detectNewMarket } from './newMarket';
import { detectSmartMoney } from './smartMoney';
import { detectNarrativeEmergence } from './narrativeEmergence';
import { detectCrossMarket } from './crossMarket';
import { detectInsiderPattern } from './insiderPattern';
import { detectConsensusFlip } from './consensusFlip';
import { detectWhaleEntry } from './whaleEntry';
import { detectSocialMention } from './socialMention';

const SCOUT_SYSTEM_PROMPT = `You are Scout, a prediction market signal analyst for BeRight Protocol.

Given a detected market signal, evaluate whether it warrants immediate action.

Respond ONLY with valid JSON matching this exact schema:
{
  "action": "ALERT" | "WATCH" | "SKIP",
  "confidence": <0-100 integer>,
  "reasoning": "<1-2 sentence explanation citing specific numbers>",
  "alertText": "<concise Telegram-ready alert message, max 3 lines, no markdown headers>"
}

Rules:
- ALERT: Strong signal, actionable now, users should know immediately
- WATCH: Interesting signal, worth monitoring but not urgent
- SKIP: Weak signal, noise, not worth alerting
- Be conservative: only ALERT truly notable signals
- alertText must be concise and punchy, suitable for Telegram notification`;

/**
 * Evaluate a single raw signal with Groq Scout
 */
async function evaluateSignal(signal: RawSignal): Promise<EvaluatedSignal> {
  const meta = SIGNAL_META[signal.type];

  const context = [
    `Signal Type: ${meta.label} ${meta.emoji}`,
    `Market: ${signal.marketTitle}`,
    `Platform: ${signal.platform}`,
    `Strength: ${(signal.strength * 100).toFixed(0)}%`,
    ``,
    `Raw Data:`,
    ...Object.entries(signal.rawData)
      .filter(([k]) => k !== 'url' && k !== 'topMarkets')
      .map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`),
  ].join('\n');

  try {
    const response = await llmChat({
      system: SCOUT_SYSTEM_PROMPT,
      user: `Evaluate this signal:\n\n${context}`,
      maxTokens: 300,
      temperature: 0.1,
      quality: 'fast',  // llama-3.1-8b-instant for speed
    });

    if (response.provider === 'none') throw new Error('No LLM provider');

    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as {
        action: 'ALERT' | 'WATCH' | 'SKIP';
        confidence: number;
        reasoning: string;
        alertText: string;
      };

      if (parsed.action && parsed.confidence !== undefined) {
        return {
          ...signal,
          action: parsed.action,
          confidence: parsed.confidence,
          reasoning: parsed.reasoning || '',
          alertText: parsed.alertText || formatFallbackAlert(signal),
        };
      }
    }
  } catch (err) {
    console.warn(`[Signals] LLM eval failed for ${signal.type}:`, err instanceof Error ? err.message : err);
  }

  // Static fallback evaluation
  return staticEvaluate(signal);
}

/**
 * Static fallback when LLM is unavailable
 */
function staticEvaluate(signal: RawSignal): EvaluatedSignal {
  let action: 'ALERT' | 'WATCH' | 'SKIP';
  if (signal.strength >= 0.7) action = 'ALERT';
  else if (signal.strength >= 0.4) action = 'WATCH';
  else action = 'SKIP';

  return {
    ...signal,
    action,
    confidence: Math.round(signal.strength * 100),
    reasoning: `Static evaluation: strength ${(signal.strength * 100).toFixed(0)}%`,
    alertText: formatFallbackAlert(signal),
  };
}

function formatFallbackAlert(signal: RawSignal): string {
  const meta = SIGNAL_META[signal.type];
  return `${meta.emoji} ${meta.label}: ${signal.marketTitle.slice(0, 60)} (${(signal.strength * 100).toFixed(0)}% strength)`;
}

/**
 * Save evaluated signal to Supabase
 */
async function saveSignal(signal: EvaluatedSignal): Promise<string | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabaseAdmin
      .from('signals')
      .insert({
        type: signal.type,
        market_id: signal.marketId,
        market_title: signal.marketTitle,
        platform: signal.platform,
        strength: signal.strength,
        raw_data: signal.rawData,
        llm_verdict: {
          action: signal.action,
          confidence: signal.confidence,
          reasoning: signal.reasoning,
        },
        action: signal.action,
        confidence: signal.confidence,
        alert_text: signal.alertText,
        alerted_at: signal.action === 'ALERT' ? new Date().toISOString() : null,
        created_at: signal.detectedAt,
      })
      .select('id')
      .single();

    if (error) {
      console.warn('[Signals] Failed to save signal:', error.message);
      return null;
    }
    return (data as { id: string })?.id || null;
  } catch (err) {
    console.warn('[Signals] Save error:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Get recent signals from Supabase (for /signals command)
 */
export async function getRecentSignals(options?: {
  limit?: number;
  action?: 'ALERT' | 'WATCH';
  type?: string;
}): Promise<EvaluatedSignal[]> {
  if (!isSupabaseConfigured) return [];

  try {
    let query = supabaseAdmin
      .from('signals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(options?.limit || 20);

    if (options?.action) query = query.eq('action', options.action);
    if (options?.type) query = query.eq('type', options.type);

    const { data, error } = await query;
    if (error || !data) return [];

    return (data as any[]).map(row => ({
      type: row.type,
      marketId: row.market_id,
      marketTitle: row.market_title,
      platform: row.platform,
      strength: row.strength,
      rawData: row.raw_data || {},
      detectedAt: row.created_at,
      action: row.action,
      confidence: row.confidence,
      reasoning: row.llm_verdict?.reasoning || '',
      alertText: row.alert_text || '',
    }));
  } catch {
    return [];
  }
}

/**
 * Run all signal detectors in parallel, evaluate with Groq Scout,
 * save to Supabase, return actionable signals.
 */
export async function runAllDetectors(): Promise<EvaluatedSignal[]> {
  console.log('[Signals] Running all detectors in parallel...');
  const startTime = Date.now();

  // Run all detectors simultaneously (12 detectors)
  const [
    volumeSurges,
    oddsShifts,
    arbOpportunities,
    resolutionImminent,
    newMarkets,
    smartMoney,
    narratives,
    crossMarket,
    insiderPatterns,
    consensusFlips,
    whaleEntries,
    socialMentions,
  ] = await Promise.allSettled([
    detectVolumeSurge(),
    detectOddsShift(),
    detectArbOpportunity(),
    detectResolutionImminent(),
    detectNewMarket(),
    detectSmartMoney(),
    detectNarrativeEmergence(),
    detectCrossMarket(),
    detectInsiderPattern(),
    detectConsensusFlip(),
    detectWhaleEntry(),
    detectSocialMention(),
  ]);

  // Collect successful raw signals
  const allRawSignals: RawSignal[] = [
    ...(volumeSurges.status === 'fulfilled' ? volumeSurges.value : []),
    ...(oddsShifts.status === 'fulfilled' ? oddsShifts.value : []),
    ...(arbOpportunities.status === 'fulfilled' ? arbOpportunities.value : []),
    ...(resolutionImminent.status === 'fulfilled' ? resolutionImminent.value : []),
    ...(newMarkets.status === 'fulfilled' ? newMarkets.value : []),
    ...(smartMoney.status === 'fulfilled' ? smartMoney.value : []),
    ...(narratives.status === 'fulfilled' ? narratives.value : []),
    ...(crossMarket.status === 'fulfilled' ? crossMarket.value : []),
    ...(insiderPatterns.status === 'fulfilled' ? insiderPatterns.value : []),
    ...(consensusFlips.status === 'fulfilled' ? consensusFlips.value : []),
    ...(whaleEntries.status === 'fulfilled' ? whaleEntries.value : []),
    ...(socialMentions.status === 'fulfilled' ? socialMentions.value : []),
  ];

  console.log(`[Signals] Detected ${allRawSignals.length} raw signals in ${Date.now() - startTime}ms`);

  if (allRawSignals.length === 0) return [];

  // Sort by strength, take top 15 for LLM evaluation (rate limit protection)
  const topSignals = allRawSignals
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 15);

  // Evaluate with Groq Scout in parallel (fast model, 300 tokens each)
  console.log(`[Signals] Evaluating top ${topSignals.length} signals with Groq Scout...`);
  const evaluated = await Promise.all(topSignals.map(s => evaluateSignal(s)));

  // Save all evaluated signals to Supabase
  const actionable = evaluated.filter(s => s.action !== 'SKIP');
  await Promise.allSettled(evaluated.map(s => saveSignal(s)));

  console.log(`[Signals] ${actionable.length} actionable signals (${evaluated.filter(s => s.action === 'ALERT').length} ALERT, ${evaluated.filter(s => s.action === 'WATCH').length} WATCH)`);

  return actionable;
}

/**
 * Format signals for Telegram /signals command
 */
export function formatSignalsReport(signals: EvaluatedSignal[]): string {
  if (signals.length === 0) {
    return `*No active signals*\n\nMarkets are quiet. Check back in a few minutes.`;
  }

  const alerts = signals.filter(s => s.action === 'ALERT');
  const watches = signals.filter(s => s.action === 'WATCH');

  let text = `*SIGNAL INTELLIGENCE*\n${'─'.repeat(32)}\n\n`;

  if (alerts.length > 0) {
    text += `*🔴 ALERTS (${alerts.length})*\n`;
    for (const s of alerts.slice(0, 5)) {
      const meta = SIGNAL_META[s.type];
      text += `\n${meta.emoji} *${meta.label}* — ${s.confidence}% confidence\n`;
      text += `${s.marketTitle.slice(0, 55)}\n`;
      text += `_${s.reasoning.slice(0, 100)}_\n`;
    }
  }

  if (watches.length > 0) {
    text += `\n*🟡 WATCHING (${watches.length})*\n`;
    for (const s of watches.slice(0, 3)) {
      const meta = SIGNAL_META[s.type];
      text += `${meta.emoji} ${s.marketTitle.slice(0, 50)} — ${meta.label}\n`;
    }
  }

  text += `\n_Updated: ${new Date().toLocaleTimeString()}_`;
  return text;
}
