import { createHash } from 'crypto';

import {
  CalibrationScoreSummary,
  ScoringSnapshotEnvelope,
  SourceScoreSnapshot,
  UnifiedScoreSnapshot,
} from './types';

const PENALTY_FLAG_BITS: Record<string, number> = {
  late_entry: 1 << 0,
  easy_market_farming: 1 << 1,
  extreme_price_farming: 1 << 2,
  category_concentration: 1 << 3,
};

function stableObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableObject);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => [key, stableObject(entryValue)] as const);

    return Object.fromEntries(entries);
  }

  return value;
}

function serializeSourceSnapshot(snapshot: SourceScoreSnapshot | null): Record<string, unknown> | null {
  if (!snapshot) {
    return null;
  }

  return stableObject({
    source: snapshot.source,
    score: snapshot.score,
    resolvedCount: snapshot.resolvedCount,
    effectiveSampleSize: Number(snapshot.effectiveSampleSize.toFixed(6)),
    breakdown: {
      source: snapshot.breakdown.source,
      brierQuality: Number(snapshot.breakdown.brierQuality.toFixed(6)),
      logQuality: Number(snapshot.breakdown.logQuality.toFixed(6)),
      calibrationQuality: Number(snapshot.breakdown.calibrationQuality.toFixed(6)),
      difficultyQuality: Number(snapshot.breakdown.difficultyQuality.toFixed(6)),
      edgeQuality: Number(snapshot.breakdown.edgeQuality.toFixed(6)),
      consistencyQuality: Number(snapshot.breakdown.consistencyQuality.toFixed(6)),
      confidence: Number(snapshot.breakdown.confidence.toFixed(6)),
      confidenceAdjustment: Number(snapshot.breakdown.confidenceAdjustment.toFixed(6)),
      penalty: Number(snapshot.breakdown.penalty.toFixed(6)),
      weightedSkill: Number(snapshot.breakdown.weightedSkill.toFixed(6)),
    },
    penalties: {
      lateEntryRatio: Number(snapshot.penalties.lateEntryRatio.toFixed(6)),
      easyMarketRatio: Number(snapshot.penalties.easyMarketRatio.toFixed(6)),
      extremePriceRatio: Number(snapshot.penalties.extremePriceRatio.toFixed(6)),
      concentrationRatio: Number(snapshot.penalties.concentrationRatio.toFixed(6)),
      penaltyMultiplier: Number(snapshot.penalties.penaltyMultiplier.toFixed(6)),
      flags: [...snapshot.penalties.flags].sort(),
    },
  }) as Record<string, unknown>;
}

export function serializeUnifiedSnapshot(snapshot: UnifiedScoreSnapshot): Record<string, unknown> {
  return stableObject({
    scoreVersion: snapshot.scoreVersion,
    scoreEpoch: snapshot.scoreEpoch,
    forecasterId: snapshot.forecasterId,
    identity: snapshot.identity ?? null,
    importedScore: serializeSourceSnapshot(snapshot.importedScore),
    nativeScore: serializeSourceSnapshot(snapshot.nativeScore),
    vaultScore: snapshot.vaultScore,
    confidence: Number(snapshot.confidence.toFixed(6)),
    nativeResolvedCount: snapshot.nativeResolvedCount,
    importedResolvedCount: snapshot.importedResolvedCount,
    status: snapshot.status,
    tier: snapshot.tier,
    riskCaps: snapshot.riskCaps,
    calculatedAt: snapshot.calculatedAt.toISOString(),
  }) as Record<string, unknown>;
}

export function hashUnifiedSnapshot(snapshot: UnifiedScoreSnapshot): string {
  const payload = JSON.stringify(serializeUnifiedSnapshot(snapshot));
  return createHash('sha256').update(payload).digest('hex');
}

export function hashScoreEpoch(scoreEpoch: string): string {
  return createHash('sha256').update(scoreEpoch).digest('hex');
}

function derivePenaltyFlags(snapshot: UnifiedScoreSnapshot): number {
  const flags = [
    ...(snapshot.importedScore?.penalties.flags ?? []),
    ...(snapshot.nativeScore?.penalties.flags ?? []),
  ];

  return flags.reduce((bitmask, flag) => bitmask | (PENALTY_FLAG_BITS[flag] ?? 0), 0);
}

export function buildCalibrationSummary(snapshot: UnifiedScoreSnapshot): CalibrationScoreSummary {
  const snapshotHash = hashUnifiedSnapshot(snapshot);
  const scoreEpochHash = hashScoreEpoch(snapshot.scoreEpoch);
  const confidenceBps = Math.round(snapshot.confidence * 10_000);
  const penaltyFlags = derivePenaltyFlags(snapshot);
  const calculatedAtUnixSeconds = Math.floor(snapshot.calculatedAt.getTime() / 1000);

  return {
    forecasterId: snapshot.forecasterId,
    scoreVersion: snapshot.scoreVersion,
    scoreEpoch: snapshot.scoreEpoch,
    scoreEpochHash,
    snapshotHash,
    vaultScore: snapshot.vaultScore,
    importedScore: snapshot.importedScore?.score ?? null,
    nativeScore: snapshot.nativeScore?.score ?? null,
    confidence: Number(snapshot.confidence.toFixed(6)),
    confidenceBps,
    nativeResolvedCount: snapshot.nativeResolvedCount,
    importedResolvedCount: snapshot.importedResolvedCount,
    status: snapshot.status,
    tier: snapshot.tier,
    penaltyFlags,
    riskCaps: snapshot.riskCaps,
    calculatedAt: snapshot.calculatedAt.toISOString(),
    calculatedAtUnixSeconds,
  };
}

export function buildSnapshotEnvelope(snapshot: UnifiedScoreSnapshot): ScoringSnapshotEnvelope {
  const calibrationSummary = buildCalibrationSummary(snapshot);

  return {
    snapshotHash: calibrationSummary.snapshotHash,
    snapshot,
    calibrationSummary,
  };
}
