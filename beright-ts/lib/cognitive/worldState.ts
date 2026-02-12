/**
 * World State Manager - Agent's model of the world
 *
 * Maintains beliefs, market states, positions, and signals.
 * This is the agent's internal representation of reality.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  WorldState,
  Belief,
  MarketState,
  PositionState,
  PredictionState,
  Signal,
  SignalType,
} from './types';

const STATE_FILE = path.join(process.cwd(), 'memory', 'world-state.json');
const MAX_SIGNALS = 100;
const MAX_BELIEFS = 50;
const BELIEF_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// ============================================
// STATE PERSISTENCE
// ============================================

function loadState(): WorldState {
  const defaults: WorldState = {
    beliefs: [],
    markets: new Map(),
    positions: [],
    predictions: [],
    signals: [],
    lastUpdated: new Date(),
  };

  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
      return {
        ...defaults,
        beliefs: data.beliefs || [],
        markets: new Map(Object.entries(data.markets || {})),
        positions: data.positions || [],
        predictions: data.predictions || [],
        signals: data.signals || [],
        lastUpdated: new Date(data.lastUpdated || Date.now()),
      };
    }
  } catch (error) {
    console.warn('[WorldState] Failed to load state:', error);
  }

  return defaults;
}

function saveState(state: WorldState): void {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const serializable = {
      beliefs: state.beliefs,
      markets: Object.fromEntries(state.markets),
      positions: state.positions,
      predictions: state.predictions,
      signals: state.signals.slice(-MAX_SIGNALS),
      lastUpdated: state.lastUpdated.toISOString(),
    };

    fs.writeFileSync(STATE_FILE, JSON.stringify(serializable, null, 2));
  } catch (error) {
    console.error('[WorldState] Failed to save state:', error);
  }
}

// Singleton state
let worldState: WorldState = loadState();

// ============================================
// BELIEF MANAGEMENT
// ============================================

/**
 * Add a new belief to the world model
 */
export function addBelief(
  content: string,
  confidence: number,
  source: Belief['source'],
  evidence: string[] = [],
  expiresIn?: number
): Belief {
  const belief: Belief = {
    id: `belief-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    content,
    confidence: Math.max(0, Math.min(1, confidence)),
    source,
    evidence,
    createdAt: new Date(),
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn) : undefined,
  };

  // Check for contradicting beliefs
  const contradicting = worldState.beliefs.find(
    b => b.content.toLowerCase().includes('not ' + content.toLowerCase()) ||
         content.toLowerCase().includes('not ' + b.content.toLowerCase())
  );

  if (contradicting) {
    // Resolve contradiction by confidence
    if (belief.confidence > contradicting.confidence) {
      worldState.beliefs = worldState.beliefs.filter(b => b.id !== contradicting.id);
      worldState.beliefs.push(belief);
    }
    // Otherwise keep existing belief
  } else {
    worldState.beliefs.push(belief);
  }

  // Limit beliefs
  if (worldState.beliefs.length > MAX_BELIEFS) {
    // Remove oldest, lowest confidence beliefs
    worldState.beliefs.sort((a, b) => {
      const scoreA = a.confidence * (1 - (Date.now() - a.createdAt.getTime()) / BELIEF_EXPIRY_MS);
      const scoreB = b.confidence * (1 - (Date.now() - b.createdAt.getTime()) / BELIEF_EXPIRY_MS);
      return scoreB - scoreA;
    });
    worldState.beliefs = worldState.beliefs.slice(0, MAX_BELIEFS);
  }

  worldState.lastUpdated = new Date();
  saveState(worldState);

  return belief;
}

/**
 * Update belief confidence based on new evidence
 */
export function updateBeliefConfidence(beliefId: string, adjustment: number, newEvidence?: string): void {
  const belief = worldState.beliefs.find(b => b.id === beliefId);
  if (belief) {
    belief.confidence = Math.max(0, Math.min(1, belief.confidence + adjustment));
    if (newEvidence) {
      belief.evidence.push(newEvidence);
    }
    worldState.lastUpdated = new Date();
    saveState(worldState);
  }
}

/**
 * Get beliefs matching a query
 */
export function getBeliefs(query?: string): Belief[] {
  // Remove expired beliefs
  const now = new Date();
  worldState.beliefs = worldState.beliefs.filter(
    b => !b.expiresAt || b.expiresAt > now
  );

  if (!query) return worldState.beliefs;

  const queryLower = query.toLowerCase();
  return worldState.beliefs.filter(b =>
    b.content.toLowerCase().includes(queryLower)
  );
}

/**
 * Check if agent believes something with minimum confidence
 */
export function believes(content: string, minConfidence = 0.5): boolean {
  const queryLower = content.toLowerCase();
  return worldState.beliefs.some(
    b => b.content.toLowerCase().includes(queryLower) && b.confidence >= minConfidence
  );
}

// ============================================
// MARKET STATE MANAGEMENT
// ============================================

/**
 * Update market state
 */
export function updateMarket(market: Partial<MarketState> & { id: string }): void {
  const existing = worldState.markets.get(market.id);

  if (existing) {
    // Track price change
    if (market.yesPrice !== undefined && existing.yesPrice !== market.yesPrice) {
      market.lastPrice = existing.yesPrice;
      market.priceChangePercent = (market.yesPrice - existing.yesPrice) / existing.yesPrice;
    }
  }

  worldState.markets.set(market.id, {
    ...existing,
    ...market,
    lastUpdated: new Date(),
  } as MarketState);

  worldState.lastUpdated = new Date();
  saveState(worldState);
}

/**
 * Get market by ID
 */
export function getMarket(id: string): MarketState | undefined {
  return worldState.markets.get(id);
}

/**
 * Get all markets
 */
export function getAllMarkets(): MarketState[] {
  return Array.from(worldState.markets.values());
}

/**
 * Get markets with significant price changes
 */
export function getMovingMarkets(threshold = 0.05): MarketState[] {
  return Array.from(worldState.markets.values()).filter(
    m => m.priceChangePercent && Math.abs(m.priceChangePercent) >= threshold
  );
}

// ============================================
// POSITION MANAGEMENT
// ============================================

/**
 * Update or add position
 */
export function updatePosition(position: PositionState): void {
  const index = worldState.positions.findIndex(p => p.id === position.id);
  if (index >= 0) {
    worldState.positions[index] = position;
  } else {
    worldState.positions.push(position);
  }
  worldState.lastUpdated = new Date();
  saveState(worldState);
}

/**
 * Get all positions
 */
export function getPositions(): PositionState[] {
  return worldState.positions;
}

/**
 * Get positions at risk (large unrealized loss)
 */
export function getPositionsAtRisk(lossThreshold = -0.1): PositionState[] {
  return worldState.positions.filter(
    p => p.unrealizedPnL / (p.size * p.entryPrice) <= lossThreshold
  );
}

// ============================================
// PREDICTION MANAGEMENT
// ============================================

/**
 * Add prediction
 */
export function addPrediction(prediction: Omit<PredictionState, 'id' | 'status' | 'createdAt'>): PredictionState {
  const full: PredictionState = {
    id: `pred-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    status: 'pending',
    createdAt: new Date(),
    ...prediction,
  };

  worldState.predictions.push(full);
  worldState.lastUpdated = new Date();
  saveState(worldState);

  return full;
}

/**
 * Resolve prediction
 */
export function resolvePrediction(id: string, outcome: boolean): void {
  const prediction = worldState.predictions.find(p => p.id === id);
  if (prediction) {
    prediction.outcome = outcome;
    prediction.status = 'resolved';
    prediction.resolvedAt = new Date();

    // Calculate Brier score
    const predictedOutcome = prediction.direction === 'YES' ? prediction.predictedProbability : 1 - prediction.predictedProbability;
    const actualOutcome = outcome ? 1 : 0;
    prediction.brierScore = Math.pow(predictedOutcome - actualOutcome, 2);

    worldState.lastUpdated = new Date();
    saveState(worldState);
  }
}

/**
 * Get pending predictions
 */
export function getPendingPredictions(): PredictionState[] {
  return worldState.predictions.filter(p => p.status === 'pending');
}

/**
 * Get calibration metrics
 */
export function getCalibrationMetrics(): { brierScore: number; accuracy: number; count: number } {
  const resolved = worldState.predictions.filter(p => p.status === 'resolved' && p.brierScore !== undefined);

  if (resolved.length === 0) {
    return { brierScore: 0, accuracy: 0, count: 0 };
  }

  const brierScore = resolved.reduce((sum, p) => sum + (p.brierScore || 0), 0) / resolved.length;
  const correct = resolved.filter(p =>
    (p.direction === 'YES') === p.outcome
  ).length;
  const accuracy = correct / resolved.length;

  return { brierScore, accuracy, count: resolved.length };
}

// ============================================
// SIGNAL MANAGEMENT
// ============================================

/**
 * Add a new signal to be processed
 */
export function addSignal(
  type: SignalType,
  source: string,
  content: string,
  strength: number
): Signal {
  const signal: Signal = {
    id: `sig-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    source,
    content,
    strength: Math.max(0, Math.min(1, strength)),
    timestamp: new Date(),
    processed: false,
  };

  worldState.signals.push(signal);

  // Limit signals
  if (worldState.signals.length > MAX_SIGNALS) {
    worldState.signals = worldState.signals.slice(-MAX_SIGNALS);
  }

  worldState.lastUpdated = new Date();
  saveState(worldState);

  return signal;
}

/**
 * Get unprocessed signals
 */
export function getUnprocessedSignals(): Signal[] {
  return worldState.signals.filter(s => !s.processed);
}

/**
 * Mark signal as processed
 */
export function markSignalProcessed(signalId: string): void {
  const signal = worldState.signals.find(s => s.id === signalId);
  if (signal) {
    signal.processed = true;
    saveState(worldState);
  }
}

/**
 * Get recent signals by type
 */
export function getRecentSignals(type?: SignalType, limit = 10): Signal[] {
  let signals = worldState.signals;
  if (type) {
    signals = signals.filter(s => s.type === type);
  }
  return signals.slice(-limit);
}

// ============================================
// FULL STATE ACCESS
// ============================================

/**
 * Get the full world state
 */
export function getWorldState(): WorldState {
  return worldState;
}

/**
 * Get a summary of the world state for context injection
 */
export function getWorldStateSummary(): string {
  const markets = getAllMarkets();
  const positions = getPositions();
  const predictions = getPendingPredictions();
  const signals = getUnprocessedSignals();
  const beliefs = getBeliefs();
  const calibration = getCalibrationMetrics();

  let summary = `## World State Summary (${new Date().toISOString()})\n\n`;

  // Calibration
  summary += `### Calibration\n`;
  summary += `- Brier Score: ${calibration.brierScore.toFixed(4)}\n`;
  summary += `- Accuracy: ${(calibration.accuracy * 100).toFixed(1)}%\n`;
  summary += `- Predictions: ${calibration.count}\n\n`;

  // Active beliefs
  if (beliefs.length > 0) {
    summary += `### Active Beliefs\n`;
    for (const b of beliefs.slice(0, 5)) {
      summary += `- ${b.content} (${(b.confidence * 100).toFixed(0)}% confidence)\n`;
    }
    summary += '\n';
  }

  // Moving markets
  const moving = getMovingMarkets(0.03);
  if (moving.length > 0) {
    summary += `### Significant Market Moves\n`;
    for (const m of moving.slice(0, 5)) {
      const change = m.priceChangePercent ? (m.priceChangePercent * 100).toFixed(1) : '?';
      summary += `- ${m.title.slice(0, 40)}: ${change}%\n`;
    }
    summary += '\n';
  }

  // Positions at risk
  const atRisk = getPositionsAtRisk();
  if (atRisk.length > 0) {
    summary += `### Positions at Risk\n`;
    for (const p of atRisk) {
      summary += `- ${p.marketId}: ${p.unrealizedPnL.toFixed(2)} (${(p.unrealizedPnL / (p.size * p.entryPrice) * 100).toFixed(1)}%)\n`;
    }
    summary += '\n';
  }

  // Pending predictions
  if (predictions.length > 0) {
    summary += `### Pending Predictions (${predictions.length})\n`;
    for (const p of predictions.slice(0, 3)) {
      summary += `- ${p.question.slice(0, 40)}... ${p.direction} @ ${(p.predictedProbability * 100).toFixed(0)}%\n`;
    }
    summary += '\n';
  }

  // Unprocessed signals
  if (signals.length > 0) {
    summary += `### Pending Signals (${signals.length})\n`;
    for (const s of signals.slice(0, 5)) {
      summary += `- [${s.type}] ${s.content.slice(0, 50)}... (strength: ${(s.strength * 100).toFixed(0)}%)\n`;
    }
  }

  return summary;
}

/**
 * Reset world state (for testing)
 */
export function resetWorldState(): void {
  worldState = {
    beliefs: [],
    markets: new Map(),
    positions: [],
    predictions: [],
    signals: [],
    lastUpdated: new Date(),
  };
  saveState(worldState);
}

export default {
  addBelief,
  updateBeliefConfidence,
  getBeliefs,
  believes,
  updateMarket,
  getMarket,
  getAllMarkets,
  getMovingMarkets,
  updatePosition,
  getPositions,
  getPositionsAtRisk,
  addPrediction,
  resolvePrediction,
  getPendingPredictions,
  getCalibrationMetrics,
  addSignal,
  getUnprocessedSignals,
  markSignalProcessed,
  getRecentSignals,
  getWorldState,
  getWorldStateSummary,
  resetWorldState,
};
