import {
  REPUTATION_PROTOCOL_V1,
  underwritingRecommendationV1Schema,
  type TopicScoreSnapshotV1,
  type UnderwritingRecommendationV1,
} from '../protocol/v1/schemas';
import { hashCanonicalJson } from '../protocol/v1/canonical';
import { UNDERWRITING_POLICY_V1, type UnderwritingPolicyV1 } from './config';

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export interface UnderwritingInputsV1 {
  importedOnly: boolean;
  drawdownFactor: number;
  liquidityFactor: number;
  allowedVenues: string[];
}

export function calculateUnderwritingRecommendationV1(input: {
  subjectId: string; snapshots: TopicScoreSnapshotV1[]; passportRoot: string; inputs: UnderwritingInputsV1;
  now?: Date; policy?: UnderwritingPolicyV1;
}): UnderwritingRecommendationV1 {
  const now = input.now ?? new Date(); const policy = input.policy ?? UNDERWRITING_POLICY_V1;
  const reasons: string[] = [];
  const eligibleSnapshots = input.snapshots.filter((snapshot) => snapshot.status === 'Verified' || snapshot.status === 'Advanced');
  if (input.snapshots.some((snapshot) => snapshot.status === 'Restricted')) reasons.push('INTEGRITY_RESTRICTED');
  if (eligibleSnapshots.length === 0) reasons.push('INSUFFICIENT_VERIFIED_HISTORY');
  if (input.inputs.importedOnly) reasons.push('IMPORTED_ONLY_PROBATION');
  const best = [...eligibleSnapshots].sort((a, b) => b.score - a.score)[0];
  if (best && best.score < policy.minimumEligibleScore) reasons.push('SCORE_BELOW_POLICY');
  if (best && best.confidence < policy.minimumEligibleConfidence) reasons.push('CONFIDENCE_BELOW_POLICY');
  if (best && best.evidenceQuality < policy.minimumEvidenceQuality) reasons.push('EVIDENCE_BELOW_POLICY');
  const restricted = reasons.includes('INTEGRITY_RESTRICTED');
  const eligible = Boolean(best) && !restricted && !input.inputs.importedOnly && best.score >= policy.minimumEligibleScore
    && best.confidence >= policy.minimumEligibleConfidence && best.evidenceQuality >= policy.minimumEvidenceQuality;
  const scoreFactor = best ? clamp((best.score - policy.minimumEligibleScore) / (1000 - policy.minimumEligibleScore)) : 0;
  const sampleFactor = best ? clamp(best.effectiveSampleSize / 100) : 0;
  const capitalFactor = Math.min(scoreFactor, best?.confidence ?? 0, best?.evidenceQuality ?? 0, sampleFactor,
    clamp(input.inputs.drawdownFactor), clamp(input.inputs.liquidityFactor), input.inputs.importedOnly ? 0.1 : 1);
  const maximumActiveCapitalUsd = eligible ? Math.floor(policy.maximumCapitalUsd * capitalFactor) : 0;
  if (eligible && maximumActiveCapitalUsd === 0) reasons.push('CONSERVATIVE_FACTORS_ZERO_CAP');
  return underwritingRecommendationV1Schema.parse({
    schemaVersion: REPUTATION_PROTOCOL_V1, subjectId: input.subjectId,
    eligibility: eligible && maximumActiveCapitalUsd > 0 ? 'eligible' : 'ineligible', maximumActiveCapitalUsd,
    maximumMarketExposureBps: eligible ? Math.floor(policy.maximumMarketExposureBps * capitalFactor) : 0,
    maximumTopicExposureBps: eligible ? Math.floor(policy.maximumTopicExposureBps * capitalFactor) : 0,
    allowedTopics: eligible ? [...new Set(eligibleSnapshots.map((snapshot) => snapshot.topic))].sort() : [],
    allowedVenues: eligible ? [...new Set(input.inputs.allowedVenues)].sort() : [], probationary: input.inputs.importedOnly,
    expiresAt: new Date(now.getTime() + policy.recommendationTtlSeconds * 1000).toISOString(),
    reasonCodes: reasons.length > 0 ? reasons : ['ELIGIBLE_CONSERVATIVE_LIMITS'], passportRoot: input.passportRoot,
    policyVersion: policy.version, calculatedAt: now.toISOString(),
  });
}

export function hashUnderwritingPolicyV1(policy: UnderwritingPolicyV1 = UNDERWRITING_POLICY_V1): string { return hashCanonicalJson(policy); }
