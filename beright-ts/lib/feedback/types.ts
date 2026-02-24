/**
 * Signal Quality Feedback Types
 *
 * Type definitions for the feedback loop system.
 */

import { SignalType } from '../signals/types';

export interface SignalFeedback {
  id: string;
  signalId: string;
  signalType: SignalType;
  marketId: string;
  marketTitle: string;
  platform: string;
  originalAction: 'ALERT' | 'WATCH' | 'SKIP';
  originalConfidence: number;
  originalStrength: number;
  outcome: 'correct' | 'incorrect' | 'partial' | 'pending';
  outcomeNotes?: string;
  resolutionPrice?: number;
  priceAtSignal?: number;
  priceChange?: number;
  feedbackSource: 'auto' | 'manual' | 'resolution';
  feedbackConfidence: number;
  signalAt: Date;
  resolvedAt?: Date;
  createdAt: Date;
}

export interface SignalQualityScore {
  signalType: SignalType;
  totalSignals: number;
  correctSignals: number;
  incorrectSignals: number;
  pendingSignals: number;
  accuracyScore: number;
  precisionScore: number;
  recallScore: number;
  brierScore: number;
  calibrationError: number;
  avgConfidence: number;
  confidenceStd: number;
  weightModifier: number;
  recommendedThreshold: number;
  lastUpdated: Date;
  lastCalibration: Date;
}

export interface CalibrationSnapshot {
  id: string;
  recordedAt: Date;
  overallAccuracy: number;
  overallBrier: number;
  typeScores: Record<string, {
    accuracy: number;
    brier: number;
    weight: number;
    count: number;
  }>;
  periodStart: Date;
  periodEnd: Date;
  signalsEvaluated: number;
}

export interface FeedbackConfig {
  autoResolveDays: number;
  minSignalsForCalibration: number;
  weightAdjustmentFactor: number;
  correctOutcomeThreshold: number;  // Price change threshold for "correct"
}

export const DEFAULT_FEEDBACK_CONFIG: FeedbackConfig = {
  autoResolveDays: 7,
  minSignalsForCalibration: 10,
  weightAdjustmentFactor: 0.1,
  correctOutcomeThreshold: 0.05,  // 5% price change
};
