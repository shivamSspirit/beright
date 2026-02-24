/**
 * Decision Engine for BeRight Protocol
 * Agentic signal evaluation: gathers raw signals and asks Claude Scout
 * to reason about them and produce EXECUTE / WATCH / SKIP decisions.
 *
 * Detection (fast, deterministic) → LLM Reasoning → Action
 */

import { ArbitrageOpportunity } from '../types/index';
import { ConsensusResult, getConsensus } from './consensus';
import { getCalibrationStats } from './calibration';
import { logArbitrage } from './onchain';
import { llmChat } from '../lib/llm';

export interface DecisionInput {
  topic: string;
  consensus?: ConsensusResult | null;
  arbitrage?: ArbitrageOpportunity | null;
  newsSentiment?: 'bullish' | 'bearish' | 'neutral';
  socialSentiment?: 'active' | 'quiet' | 'neutral';
  whaleSignal?: 'accumulating' | 'distributing' | 'neutral';
}

export interface DecisionOutput {
  action: 'EXECUTE' | 'WATCH' | 'SKIP';
  confidence: number;        // 0-100
  reasoning: string;
  signals: SignalScore[];
  adjustedConfidence: number; // after Brier self-tuning
  timestamp: string;
}

interface SignalScore {
  name: string;
  weight: number;
  score: number;   // 0-1 how strong the signal is
  detail: string;
}

// Signal weights (must sum to 1.0)
const WEIGHTS = {
  marketConsensus: 0.35,
  arbitrageSpread: 0.25,
  newsSentiment: 0.15,
  whaleMovement: 0.15,
  socialSentiment: 0.10,
};

// Thresholds
const EXECUTE_THRESHOLD = 70;
const WATCH_THRESHOLD = 45;

/**
 * Score the market consensus signal
 */
function scoreConsensus(consensus: ConsensusResult | null | undefined): SignalScore {
  if (!consensus) {
    return { name: 'Market Consensus', weight: WEIGHTS.marketConsensus, score: 0, detail: 'No data' };
  }

  // Higher agreement = stronger signal
  let score = consensus.agreementScore;

  // Bonus for multiple sources
  if (consensus.sourceCount >= 4) score = Math.min(1, score + 0.1);
  if (consensus.sourceCount >= 3) score = Math.min(1, score + 0.05);

  // Penalty for wide spread
  if (consensus.spread > 0.15) score *= 0.7;

  const detail = `${consensus.sourceCount} platforms, ${(consensus.agreementScore * 100).toFixed(0)}% agreement, ${(consensus.spread * 100).toFixed(1)}pp spread`;

  return { name: 'Market Consensus', weight: WEIGHTS.marketConsensus, score, detail };
}

/**
 * Score the arbitrage spread signal
 */
function scoreArbitrage(arb: ArbitrageOpportunity | null | undefined): SignalScore {
  if (!arb) {
    return { name: 'Arbitrage Spread', weight: WEIGHTS.arbitrageSpread, score: 0, detail: 'No opportunity' };
  }

  // Spread scoring: 3% = 0.3, 5% = 0.5, 10%+ = 1.0
  const spreadPct = arb.spread * 100;
  let score = Math.min(1, spreadPct / 10);

  // Volume bonus (both sides need liquidity)
  const minVolume = Math.min(arb.volumeA, arb.volumeB);
  if (minVolume > 10000) score = Math.min(1, score + 0.1);
  if (minVolume < 1000) score *= 0.5;

  // Match confidence penalty
  if (arb.matchConfidence < 0.5) score *= 0.7;

  const detail = `${spreadPct.toFixed(1)}% spread, match: ${(arb.matchConfidence * 100).toFixed(0)}%, vol: $${minVolume.toFixed(0)}`;

  return { name: 'Arbitrage Spread', weight: WEIGHTS.arbitrageSpread, score, detail };
}

/**
 * Score the news sentiment signal
 */
function scoreNews(sentiment: 'bullish' | 'bearish' | 'neutral' | undefined): SignalScore {
  if (!sentiment) {
    return { name: 'News Sentiment', weight: WEIGHTS.newsSentiment, score: 0.5, detail: 'No data' };
  }

  const scores: Record<string, number> = {
    bullish: 0.8,
    neutral: 0.5,
    bearish: 0.3,
  };

  return {
    name: 'News Sentiment',
    weight: WEIGHTS.newsSentiment,
    score: scores[sentiment],
    detail: sentiment.toUpperCase(),
  };
}

/**
 * Score the whale movement signal
 */
function scoreWhale(signal: 'accumulating' | 'distributing' | 'neutral' | undefined): SignalScore {
  if (!signal) {
    return { name: 'Whale Movement', weight: WEIGHTS.whaleMovement, score: 0.5, detail: 'No data' };
  }

  const scores: Record<string, number> = {
    accumulating: 0.85,
    neutral: 0.5,
    distributing: 0.2,
  };

  return {
    name: 'Whale Movement',
    weight: WEIGHTS.whaleMovement,
    score: scores[signal],
    detail: signal.toUpperCase(),
  };
}

/**
 * Score the social sentiment signal
 */
function scoreSocial(sentiment: 'active' | 'quiet' | 'neutral' | undefined): SignalScore {
  if (!sentiment) {
    return { name: 'Social Sentiment', weight: WEIGHTS.socialSentiment, score: 0.5, detail: 'No data' };
  }

  const scores: Record<string, number> = {
    active: 0.7,
    neutral: 0.5,
    quiet: 0.3,
  };

  return {
    name: 'Social Sentiment',
    weight: WEIGHTS.socialSentiment,
    score: scores[sentiment],
    detail: sentiment.toUpperCase(),
  };
}

/**
 * Apply Brier score self-tuning
 * If agent is poorly calibrated, reduce confidence
 * If agent is well-calibrated, increase slightly
 */
function applyBrierAdjustment(confidence: number): { adjusted: number; brierScore: number } {
  const stats = getCalibrationStats();
  const brier = stats.overallBrierScore;

  let adjusted = confidence;

  if (brier > 0.25) {
    // Poorly calibrated — reduce confidence by 10%
    adjusted = confidence * 0.90;
  } else if (brier > 0.20) {
    // Below average — reduce by 5%
    adjusted = confidence * 0.95;
  } else if (brier < 0.15 && brier > 0) {
    // Superforecaster level — increase by 5%
    adjusted = Math.min(100, confidence * 1.05);
  }
  // If brier is 0 (no predictions), don't adjust

  return { adjusted: Math.round(adjusted), brierScore: brier };
}

/**
 * Fallback: score signals with static math when LLM is unavailable
 */
export function evaluate(input: DecisionInput): DecisionOutput {
  const signals: SignalScore[] = [
    scoreConsensus(input.consensus),
    scoreArbitrage(input.arbitrage),
    scoreNews(input.newsSentiment),
    scoreWhale(input.whaleSignal),
    scoreSocial(input.socialSentiment),
  ];

  const rawConfidence = signals.reduce((sum, s) => sum + s.score * s.weight, 0) * 100;
  const { adjusted } = applyBrierAdjustment(rawConfidence);

  let action: 'EXECUTE' | 'WATCH' | 'SKIP';
  if (adjusted >= EXECUTE_THRESHOLD && input.arbitrage && input.arbitrage.spread > 0.03) {
    action = 'EXECUTE';
  } else if (adjusted >= WATCH_THRESHOLD) {
    action = 'WATCH';
  } else {
    action = 'SKIP';
  }

  const reasoning = signals
    .filter(s => s.score > 0.3)
    .sort((a, b) => (b.score * b.weight) - (a.score * a.weight))
    .slice(0, 3)
    .map(s => `${s.name}: ${s.detail}`)
    .join('; ');

  return {
    action,
    confidence: Math.round(rawConfidence),
    reasoning,
    signals,
    adjustedConfidence: adjusted,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build a structured context string for LLM reasoning from raw signals
 */
function buildSignalContext(input: DecisionInput): string {
  const lines: string[] = [`Topic: ${input.topic}`, ''];

  if (input.arbitrage) {
    lines.push(`ARBITRAGE SIGNAL:`);
    lines.push(`  Spread: ${(input.arbitrage.spread * 100).toFixed(2)}%`);
    lines.push(`  Platform A: ${input.arbitrage.platformA} @ ${(input.arbitrage.priceAYes * 100).toFixed(0)}¢`);
    lines.push(`  Platform B: ${input.arbitrage.platformB} @ ${(input.arbitrage.priceBYes * 100).toFixed(0)}¢`);
    lines.push(`  Volume A: $${input.arbitrage.volumeA.toFixed(0)} | Volume B: $${input.arbitrage.volumeB.toFixed(0)}`);
    lines.push(`  Match confidence: ${(input.arbitrage.matchConfidence * 100).toFixed(0)}%`);
    lines.push('');
  }

  if (input.consensus) {
    lines.push(`MARKET CONSENSUS:`);
    lines.push(`  Platforms: ${input.consensus.sourceCount}`);
    lines.push(`  Agreement: ${(input.consensus.agreementScore * 100).toFixed(0)}%`);
    lines.push(`  Spread: ${(input.consensus.spread * 100).toFixed(1)}pp`);
    lines.push('');
  }

  if (input.newsSentiment) lines.push(`NEWS SENTIMENT: ${input.newsSentiment.toUpperCase()}`);
  if (input.whaleSignal) lines.push(`WHALE SIGNAL: ${input.whaleSignal.toUpperCase()}`);
  if (input.socialSentiment) lines.push(`SOCIAL: ${input.socialSentiment.toUpperCase()}`);

  const stats = getCalibrationStats();
  if (stats.overallBrierScore > 0) {
    lines.push(`\nCALIBRATION: Brier score ${stats.overallBrierScore.toFixed(3)} (${stats.overallBrierScore < 0.15 ? 'superforecaster' : stats.overallBrierScore < 0.20 ? 'above average' : 'needs improvement'})`);
  }

  return lines.join('\n');
}

/**
 * Agentic decision: ask Claude Scout to reason about the signals.
 * Falls back to static evaluate() if Groq is not configured.
 */
export async function decide(input: DecisionInput): Promise<DecisionOutput> {
  // Fetch consensus if not provided
  if (!input.consensus && input.topic) {
    input.consensus = await getConsensus(input.topic);
  }

  // Agentic path: LLM reasons about the signals
  try {
    const signalContext = buildSignalContext(input);

    const response = await llmChat({
      system: `You are Scout, a prediction market signal analyst. Given raw signal data, you produce a decision.

Respond ONLY with valid JSON matching this exact schema:
{
  "action": "EXECUTE" | "WATCH" | "SKIP",
  "confidence": <0-100 integer>,
  "reasoning": "<1-2 sentence explanation referencing specific signal values>"
}

Rules:
- EXECUTE: Clear opportunity with sufficient spread AND liquidity AND low risk
- WATCH: Interesting but needs more confirmation or thin liquidity
- SKIP: Too risky, insufficient data, or spread not worth execution costs
- Be specific in reasoning — cite actual numbers from the signals`,
      user: `Evaluate these signals and decide:\n\n${signalContext}`,
      maxTokens: 512,
      temperature: 0.2,
      quality: 'smart',
    });

    const text = response.text;
    if (response.provider === 'none') throw new Error('No LLM provider');

      // Parse LLM JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as {
          action: 'EXECUTE' | 'WATCH' | 'SKIP';
          confidence: number;
          reasoning: string;
        };

        if (parsed.action && parsed.confidence !== undefined && parsed.reasoning) {
          // Still run static signals for the breakdown display
          const signals: SignalScore[] = [
            scoreConsensus(input.consensus),
            scoreArbitrage(input.arbitrage),
            scoreNews(input.newsSentiment),
            scoreWhale(input.whaleSignal),
            scoreSocial(input.socialSentiment),
          ];

          const decision: DecisionOutput = {
            action: parsed.action,
            confidence: parsed.confidence,
            reasoning: `[LLM] ${parsed.reasoning}`,
            signals,
            adjustedConfidence: parsed.confidence,
            timestamp: new Date().toISOString(),
          };

          // Log to chain
          if (input.arbitrage) {
            logArbitrage(
              input.topic,
              input.arbitrage.spread,
              decision.action,
              decision.adjustedConfidence,
              undefined,
            ).catch(err => console.warn('On-chain log failed:', err));
          }

          return decision;
        }
      }
  } catch (err) {
    console.warn('[DecisionEngine] LLM call failed, using static fallback:', err);
  }

  // Fallback: static math
  const decision = evaluate(input);

  if (input.arbitrage) {
    logArbitrage(
      input.topic,
      input.arbitrage.spread,
      decision.action,
      decision.adjustedConfidence,
      undefined,
    ).catch(err => console.warn('On-chain log failed:', err));
  }

  return decision;
}

/**
 * Format decision for display
 */
export function formatDecision(output: DecisionOutput, topic: string): string {
  const actionEmoji = output.action === 'EXECUTE' ? '🟢' : output.action === 'WATCH' ? '🟡' : '🔴';

  let text = `\n${'='.repeat(50)}\n   DECISION ENGINE\n${'='.repeat(50)}\n\n`;
  text += `Topic: ${topic.slice(0, 60)}\n\n`;
  text += `${actionEmoji} ACTION: ${output.action}\n`;
  text += `   Raw Confidence: ${output.confidence}%\n`;
  text += `   Adjusted (Brier): ${output.adjustedConfidence}%\n\n`;

  text += 'SIGNAL BREAKDOWN:\n';
  for (const signal of output.signals) {
    const bar = '█'.repeat(Math.round(signal.score * 10)) + '░'.repeat(10 - Math.round(signal.score * 10));
    text += `   ${signal.name.padEnd(20)} ${bar} ${(signal.score * 100).toFixed(0)}%  (w:${(signal.weight * 100).toFixed(0)}%)\n`;
    text += `   ${' '.repeat(20)} ${signal.detail}\n`;
  }

  text += `\nReasoning: ${output.reasoning}\n`;

  return text;
}

// CLI interface
if (process.argv[1]?.endsWith('decisionEngine.ts')) {
  const topic = process.argv.slice(2).join(' ');
  if (!topic) {
    console.log('Usage: ts-node decisionEngine.ts <topic>');
    process.exit(1);
  }
  (async () => {
    console.log(`Running decision engine for: "${topic}"...`);
    const result = await decide({ topic });
    console.log(formatDecision(result, topic));
  })();
}
