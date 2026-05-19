export type ScoreSource = 'imported' | 'native' | 'vault';

export type ForecasterStatus =
  | 'ImportedCandidate'
  | 'BootstrapEligible'
  | 'NativeCalibrating'
  | 'NativeVerified'
  | 'VaultEligible'
  | 'VaultScaled'
  | 'Restricted';

export type ForecasterTier =
  | 'restricted'
  | 'bootstrap'
  | 'standard'
  | 'advanced'
  | 'elite';

export type ResolutionFinality =
  | 'venue_final'
  | 'oracle_final'
  | 'redeemable'
  | 'api_resolved'
  | 'provisional'
  | 'disputed'
  | 'unknown';

export interface ResolutionEvidence {
  source: string;
  finality: ResolutionFinality;
  confidence: number;
  observedAt?: Date;
  referenceUrl?: string;
  evidenceHash?: string;
}

export interface V3Prediction {
  id: string;
  forecasterId: string;
  source: 'imported' | 'native';
  platform: string;
  marketId: string;
  marketTitle: string;
  predictedProbability: number;
  direction: 'YES' | 'NO';
  predictedAt: Date;
  resolvedAt?: Date;
  outcome?: boolean;
  entryPrice?: number;
  positionSize?: number;
  communityMedian?: number;
  communitySpread?: number;
  difficulty?: number;
  marketOpenTime?: Date;
  marketCloseTime?: Date;
  category?: string;
  resolutionEvidence?: ResolutionEvidence;
}

export interface V3Identity {
  forecasterId: string;
  solanaPubkey?: string;
  linkedAccounts?: Record<string, string>;
}

export interface ScoreBreakdown {
  source: ScoreSource;
  brierQuality: number;
  logQuality: number;
  calibrationQuality: number;
  difficultyQuality: number;
  edgeQuality: number;
  consistencyQuality: number;
  evidenceQuality: number;
  confidence: number;
  confidenceAdjustment: number;
  penalty: number;
  weightedSkill: number;
}

export interface PenaltyBreakdown {
  lateEntryRatio: number;
  easyMarketRatio: number;
  extremePriceRatio: number;
  concentrationRatio: number;
  penaltyMultiplier: number;
  flags: string[];
}

export interface SourceScoreSnapshot {
  source: 'imported' | 'native';
  score: number;
  resolvedCount: number;
  effectiveSampleSize: number;
  breakdown: ScoreBreakdown;
  penalties: PenaltyBreakdown;
}

export interface RiskCaps {
  maxActiveSleeveBps: number;
  maxMarketExposureBps: number;
  maxThemeExposureBps: number;
  probationary: boolean;
}

export interface UnifiedScoreSnapshot {
  scoreVersion: 'v3';
  scoreEpoch: string;
  forecasterId: string;
  identity?: V3Identity;
  importedScore: SourceScoreSnapshot | null;
  nativeScore: SourceScoreSnapshot | null;
  vaultScore: number;
  confidence: number;
  nativeResolvedCount: number;
  importedResolvedCount: number;
  status: ForecasterStatus;
  tier: ForecasterTier;
  riskCaps: RiskCaps;
  calculatedAt: Date;
}

export interface CalibrationScoreSummary {
  forecasterId: string;
  scoreVersion: 'v3';
  scoreEpoch: string;
  scoreEpochHash: string;
  snapshotHash: string;
  vaultScore: number;
  importedScore: number | null;
  nativeScore: number | null;
  confidence: number;
  confidenceBps: number;
  nativeResolvedCount: number;
  importedResolvedCount: number;
  status: ForecasterStatus;
  tier: ForecasterTier;
  penaltyFlags: number;
  riskCaps: RiskCaps;
  calculatedAt: string;
  calculatedAtUnixSeconds: number;
}

export interface ScoringSnapshotEnvelope {
  snapshotHash: string;
  snapshot: UnifiedScoreSnapshot;
  calibrationSummary: CalibrationScoreSummary;
}

export interface SourceScoreConfig {
  source: 'imported' | 'native';
  halfLifeDays: number;
  confidenceAnchor: number;
  weights: {
    brierQuality: number;
    logQuality: number;
    calibrationQuality: number;
    difficultyQuality: number;
    edgeQuality: number;
    consistencyQuality: number;
  };
}
