import { IMPORTED_SCORE_CONFIG, NATIVE_SCORE_CONFIG } from './config';
import { calculatePenaltyBreakdown } from './antiGaming';
import {
  buildWeightedResolvedPredictions,
  calculateBrierQuality,
  calculateCalibrationQuality,
  calculateConsistencyQuality,
  calculateDifficultyQuality,
  calculateEdgeQuality,
  calculateEffectiveSampleSize,
  calculateLogQuality,
  clamp,
} from './metrics';
import {
  ForecasterStatus,
  ForecasterTier,
  RiskCaps,
  ScoreBreakdown,
  SourceScoreConfig,
  SourceScoreSnapshot,
  UnifiedScoreSnapshot,
  V3Identity,
  V3Prediction,
} from './types';

function computeSourceScore(
  source: 'imported' | 'native',
  predictions: V3Prediction[],
  config: SourceScoreConfig,
  now: Date,
): SourceScoreSnapshot | null {
  const resolved = buildWeightedResolvedPredictions(predictions, config, now);
  if (resolved.length === 0) {
    return null;
  }

  const brierQuality = calculateBrierQuality(resolved);
  const logQuality = calculateLogQuality(resolved);
  const calibrationQuality = calculateCalibrationQuality(resolved);
  const difficultyQuality = calculateDifficultyQuality(resolved);
  const edgeQuality = calculateEdgeQuality(resolved);
  const consistencyQuality = calculateConsistencyQuality(predictions);
  const effectiveSampleSize = calculateEffectiveSampleSize(resolved);
  const confidence = effectiveSampleSize / (effectiveSampleSize + config.confidenceAnchor);
  const confidenceAdjustment = 0.35 + 0.65 * confidence;
  const penalties = calculatePenaltyBreakdown(resolved);

  const weightedSkill =
    config.weights.brierQuality * brierQuality +
    config.weights.logQuality * logQuality +
    config.weights.calibrationQuality * calibrationQuality +
    config.weights.difficultyQuality * difficultyQuality +
    config.weights.edgeQuality * edgeQuality +
    config.weights.consistencyQuality * consistencyQuality;

  const breakdown: ScoreBreakdown = {
    source,
    brierQuality,
    logQuality,
    calibrationQuality,
    difficultyQuality,
    edgeQuality,
    consistencyQuality,
    confidence,
    confidenceAdjustment,
    penalty: penalties.penaltyMultiplier,
    weightedSkill,
  };

  return {
    source,
    score: Math.round(1000 * weightedSkill * confidenceAdjustment * penalties.penaltyMultiplier),
    resolvedCount: resolved.length,
    effectiveSampleSize,
    breakdown,
    penalties,
  };
}

function deriveVaultScore(
  importedScore: SourceScoreSnapshot | null,
  nativeScore: SourceScoreSnapshot | null,
): number {
  if (importedScore && nativeScore) {
    if (nativeScore.resolvedCount < 20) {
      return Math.round(importedScore.score * 0.70 + nativeScore.score * 0.30);
    }

    if (nativeScore.resolvedCount < 100) {
      return Math.round(importedScore.score * 0.40 + nativeScore.score * 0.60);
    }

    return Math.round(importedScore.score * 0.20 + nativeScore.score * 0.80);
  }

  if (nativeScore) return nativeScore.score;
  if (importedScore) return importedScore.score;
  return 0;
}

function deriveTier(score: number): ForecasterTier {
  if (score >= 850) return 'elite';
  if (score >= 800) return 'advanced';
  if (score >= 750) return 'standard';
  if (score >= 700) return 'bootstrap';
  return 'restricted';
}

function deriveRiskCaps(
  tier: ForecasterTier,
  nativeResolvedCount: number,
  importedOnly: boolean,
): RiskCaps {
  const probationary = importedOnly || nativeResolvedCount < 20;
  const base = (() => {
    switch (tier) {
      case 'elite':
        return 2500;
      case 'advanced':
        return 2000;
      case 'standard':
        return 1500;
      case 'bootstrap':
        return 1000;
      default:
        return 0;
    }
  })();

  const maxActiveSleeveBps = probationary ? Math.min(base, 1000) : base;
  const maxMarketExposureBps = probationary ? Math.min(300, Math.round(maxActiveSleeveBps * 0.30)) : Math.round(maxActiveSleeveBps * 0.35);
  const maxThemeExposureBps = probationary ? Math.min(700, Math.round(maxActiveSleeveBps * 0.70)) : Math.round(maxActiveSleeveBps * 0.80);

  return {
    maxActiveSleeveBps,
    maxMarketExposureBps,
    maxThemeExposureBps,
    probationary,
  };
}

function deriveStatus(
  tier: ForecasterTier,
  importedScore: SourceScoreSnapshot | null,
  nativeScore: SourceScoreSnapshot | null,
): ForecasterStatus {
  if (!importedScore && !nativeScore) return 'Restricted';
  if (importedScore && !nativeScore) {
    return importedScore.score >= 700 ? 'BootstrapEligible' : 'ImportedCandidate';
  }
  if (nativeScore && nativeScore.resolvedCount < 20) return 'NativeCalibrating';
  if (nativeScore && nativeScore.resolvedCount < 100) return 'NativeVerified';
  if (tier === 'elite') return 'VaultScaled';
  if (tier === 'standard' || tier === 'advanced' || tier === 'bootstrap') return 'VaultEligible';
  return 'Restricted';
}

export function calculateV3UnifiedScore(params: {
  forecasterId: string;
  identity?: V3Identity;
  importedPredictions?: V3Prediction[];
  nativePredictions?: V3Prediction[];
  scoreEpoch?: string;
  now?: Date;
}): UnifiedScoreSnapshot {
  const now = params.now ?? new Date();
  const importedPredictions = (params.importedPredictions ?? []).filter((prediction) => prediction.source === 'imported');
  const nativePredictions = (params.nativePredictions ?? []).filter((prediction) => prediction.source === 'native');

  const importedScore = computeSourceScore('imported', importedPredictions, IMPORTED_SCORE_CONFIG, now);
  const nativeScore = computeSourceScore('native', nativePredictions, NATIVE_SCORE_CONFIG, now);
  const vaultScore = deriveVaultScore(importedScore, nativeScore);
  const tier = deriveTier(vaultScore);
  const nativeResolvedCount = nativeScore?.resolvedCount ?? 0;
  const importedResolvedCount = importedScore?.resolvedCount ?? 0;
  const importedOnly = Boolean(importedScore) && !nativeScore;
  const riskCaps = deriveRiskCaps(tier, nativeResolvedCount, importedOnly);
  const status = deriveStatus(tier, importedScore, nativeScore);

  const rawConfidenceValues = [importedScore?.breakdown.confidence, nativeScore?.breakdown.confidence]
    .filter((value): value is number => value !== undefined);
  const confidence = rawConfidenceValues.length > 0
    ? clamp(rawConfidenceValues.reduce((sum, value) => sum + value, 0) / rawConfidenceValues.length, 0, 1)
    : 0;

  return {
    scoreVersion: 'v3',
    scoreEpoch: params.scoreEpoch ?? now.toISOString(),
    forecasterId: params.forecasterId,
    identity: params.identity,
    importedScore,
    nativeScore,
    vaultScore,
    confidence,
    nativeResolvedCount,
    importedResolvedCount,
    status,
    tier,
    riskCaps,
    calculatedAt: now,
  };
}
