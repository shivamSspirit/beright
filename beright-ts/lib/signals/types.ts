/**
 * Signal Types for BeRight Signal Intelligence Engine
 *
 * Every signal follows this pattern:
 *   Detector (fast, deterministic) → LLM Scout evaluation → Alert Router
 */

export type SignalType =
  | 'volume_surge'
  | 'odds_shift'
  | 'arb_opportunity'
  | 'resolution_imminent'
  | 'new_market'
  | 'smart_money'
  | 'narrative_emergence'
  | 'cross_market'
  | 'insider_pattern'
  | 'consensus_flip'
  | 'whale_entry'
  | 'social_mention'      // Phase 2: Social listener
  | 'momentum_breakout';  // Phase 1: Momentum engine

export interface RawSignal {
  type: SignalType;
  marketId: string;
  marketTitle: string;
  platform: string;
  strength: number;       // 0-1
  rawData: Record<string, unknown>;
  detectedAt: string;     // ISO timestamp
}

export interface EvaluatedSignal extends RawSignal {
  action: 'ALERT' | 'WATCH' | 'SKIP';
  confidence: number;     // 0-100
  reasoning: string;
  alertText: string;      // Formatted for Telegram
}

export interface SavedSignal extends EvaluatedSignal {
  id?: string;
  llmVerdict: {
    action: 'ALERT' | 'WATCH' | 'SKIP';
    confidence: number;
    reasoning: string;
  };
  alertedAt?: string;
  createdAt: string;
}

// Signal type display names and emojis
export const SIGNAL_META: Record<SignalType, { label: string; emoji: string }> = {
  volume_surge:         { label: 'Volume Surge',       emoji: '📈' },
  odds_shift:           { label: 'Odds Shift',          emoji: '⚡' },
  arb_opportunity:      { label: 'Arbitrage',           emoji: '💰' },
  resolution_imminent:  { label: 'Resolving Soon',      emoji: '⏰' },
  new_market:           { label: 'New Market',          emoji: '🆕' },
  smart_money:          { label: 'Smart Money',         emoji: '🧠' },
  narrative_emergence:  { label: 'Narrative Emerging',  emoji: '🔥' },
  cross_market:         { label: 'Cross-Market',        emoji: '🔗' },
  insider_pattern:      { label: 'Insider Pattern',     emoji: '👁' },
  consensus_flip:       { label: 'Consensus Flip',      emoji: '🔄' },
  whale_entry:          { label: 'Whale Entry',         emoji: '🐋' },
  social_mention:       { label: 'Social Buzz',         emoji: '📱' },
  momentum_breakout:    { label: 'Momentum Breakout',   emoji: '🚀' },
};
