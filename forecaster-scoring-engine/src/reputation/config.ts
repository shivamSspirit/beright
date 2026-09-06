export interface TopicScoringConfigV1 {
  version: 'topic-scoring/v1';
  halfLifeDays: number;
  shrinkageAnchor: number;
  confidenceAnchor: number;
  statusThresholds: { provisional: number; verified: number; advanced: number };
  verifiedMinimumEvidenceQuality: number;
  advancedMinimumScore: number;
  advancedMinimumConfidence: number;
  advancedMinimumEvidenceQuality: number;
  penaltyFloor: number;
}

export const TOPIC_SCORING_CONFIG_V1: TopicScoringConfigV1 = {
  version: 'topic-scoring/v1', halfLifeDays: 120, shrinkageAnchor: 20, confidenceAnchor: 40,
  statusThresholds: { provisional: 10, verified: 30, advanced: 100 }, verifiedMinimumEvidenceQuality: 0.8,
  advancedMinimumScore: 800, advancedMinimumConfidence: 0.65, advancedMinimumEvidenceQuality: 0.9, penaltyFloor: 0.4,
};

export interface UnderwritingPolicyV1 {
  version: 'underwriting-policy/v1';
  maximumCapitalUsd: number;
  maximumMarketExposureBps: number;
  maximumTopicExposureBps: number;
  recommendationTtlSeconds: number;
  minimumEligibleScore: number;
  minimumEligibleConfidence: number;
  minimumEvidenceQuality: number;
}

export const UNDERWRITING_POLICY_V1: UnderwritingPolicyV1 = {
  version: 'underwriting-policy/v1', maximumCapitalUsd: 100_000, maximumMarketExposureBps: 1000,
  maximumTopicExposureBps: 2500, recommendationTtlSeconds: 86_400, minimumEligibleScore: 700,
  minimumEligibleConfidence: 0.35, minimumEvidenceQuality: 0.8,
};
