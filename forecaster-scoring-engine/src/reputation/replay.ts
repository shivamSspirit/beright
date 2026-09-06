import { canonicalJson, hashCanonicalJson } from '../protocol/v1/canonical';
import { forecastReceiptV1Schema, canonicalMarketV1Schema, resolutionReceiptV1Schema, subjectV1Schema, topicScoreSnapshotV1Schema, underwritingRecommendationV1Schema } from '../protocol/v1/schemas';
import { TOPIC_SCORING_CONFIG_V1, UNDERWRITING_POLICY_V1 } from './config';
import { assertEvidenceRoot, calculatePassportRootV1, evidenceBundleToScoringEvidence, type EvidenceBundleV1 } from './bundle';
import { calculateTopicScoreSnapshotsV1 } from './topicScoring';
import { calculateUnderwritingRecommendationV1, hashUnderwritingPolicyV1 } from './underwriting';

export interface ReplayResultV1 { valid: boolean; errors: string[]; evidenceRoot: string; passportRoot: string; snapshotsMatch: boolean; underwritingMatch: boolean }

export function replayEvidenceBundleV1(bundle: EvidenceBundleV1): ReplayResultV1 {
  const errors: string[] = [];
  try {
    subjectV1Schema.parse(bundle.subject); bundle.receipts.forEach((value) => forecastReceiptV1Schema.parse(value));
    bundle.canonicalMarkets.forEach((value) => canonicalMarketV1Schema.parse(value)); bundle.resolutions.forEach((value) => resolutionReceiptV1Schema.parse(value));
    for (const receipt of bundle.receipts) {
      if (!(receipt.receiptId in bundle.rawEvidence)) throw new Error(`RAW_EVIDENCE_MISSING:${receipt.receiptId}`);
      if (hashCanonicalJson(bundle.rawEvidence[receipt.receiptId]) !== receipt.rawEvidenceHash) throw new Error(`RAW_EVIDENCE_HASH_MISMATCH:${receipt.receiptId}`);
    }
    bundle.topicSnapshots.forEach((value) => topicScoreSnapshotV1Schema.parse(value)); underwritingRecommendationV1Schema.parse(bundle.underwriting);
    assertEvidenceRoot(bundle);
  } catch (error) { errors.push(error instanceof Error ? error.message : 'SCHEMA_VALIDATION_FAILED'); }
  const evidenceRoot = (() => { try { assertEvidenceRoot(bundle); return bundle.evidenceRoot; } catch { return ''; } })();
  const scoringCodeHash = hashCanonicalJson(TOPIC_SCORING_CONFIG_V1);
  if (bundle.scoringConfigHash !== scoringCodeHash) errors.push('SCORING_CONFIG_HASH_MISMATCH');
  if (bundle.policyConfigHash !== hashUnderwritingPolicyV1()) errors.push('POLICY_CONFIG_HASH_MISMATCH');
  let snapshotsMatch = false; let underwritingMatch = false; let passportRoot = '';
  try {
    const snapshots = calculateTopicScoreSnapshotsV1({ subjectId: bundle.subject.subjectId, evidence: evidenceBundleToScoringEvidence(bundle),
      now: new Date(bundle.topicSnapshots[0]?.calculatedAt ?? bundle.generatedAt), config: TOPIC_SCORING_CONFIG_V1, scoringCodeHash });
    snapshotsMatch = canonicalJson(snapshots) === canonicalJson(bundle.topicSnapshots); if (!snapshotsMatch) errors.push('TOPIC_SNAPSHOT_MISMATCH');
    const preUnderwritingRoot = calculatePassportRootV1({ subject: bundle.subject, evidenceRoot: bundle.evidenceRoot, snapshots, underwriting: null });
    const recommendation = calculateUnderwritingRecommendationV1({ subjectId: bundle.subject.subjectId, snapshots, passportRoot: preUnderwritingRoot,
      inputs: bundle.underwritingInputs, now: new Date(bundle.underwriting.calculatedAt), policy: UNDERWRITING_POLICY_V1 });
    underwritingMatch = canonicalJson(recommendation) === canonicalJson(bundle.underwriting); if (!underwritingMatch) errors.push('UNDERWRITING_MISMATCH');
    passportRoot = calculatePassportRootV1({ subject: bundle.subject, evidenceRoot: bundle.evidenceRoot, snapshots, underwriting: recommendation });
    if (passportRoot !== bundle.passportRoot) errors.push('PASSPORT_ROOT_MISMATCH');
  } catch (error) { errors.push(error instanceof Error ? error.message : 'REPLAY_FAILED'); }
  return { valid: errors.length === 0, errors, evidenceRoot, passportRoot, snapshotsMatch, underwritingMatch };
}
