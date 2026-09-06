import { hashCanonicalJson } from '../protocol/v1/canonical';
import { REPUTATION_PROTOCOL_V1, type CanonicalMarketV1, type ForecastReceiptV1, type ResolutionReceiptV1, type SubjectV1, type TopicScoreSnapshotV1, type UnderwritingRecommendationV1 } from '../protocol/v1/schemas';
import type { UnderwritingInputsV1 } from './underwriting';
import type { TopicScoringEvidenceV1 } from './topicScoring';
import { buildEvidenceMerkleTree } from './merkle';

export interface EvidenceBundleV1 {
  schemaVersion: typeof REPUTATION_PROTOCOL_V1;
  bundleVersion: 'evidence-bundle/v1';
  subject: SubjectV1;
  receipts: ForecastReceiptV1[];
  rawEvidence: Record<string, unknown>;
  canonicalMarkets: CanonicalMarketV1[];
  resolutions: ResolutionReceiptV1[];
  contemporaneousMarketProbabilities: Record<string, number | null>;
  evidenceMetadata: Record<string, Omit<TopicScoringEvidenceV1, 'receipt' | 'market' | 'resolution' | 'contemporaneousMarketProbability' | 'origin'>>;
  evidenceRoot: string;
  topicSnapshots: TopicScoreSnapshotV1[];
  underwriting: UnderwritingRecommendationV1;
  underwritingInputs: UnderwritingInputsV1;
  scoringConfigHash: string;
  policyConfigHash: string;
  generatedAt: string;
  passportRoot: string;
}

export function calculatePassportRootV1(input: { subject: SubjectV1; evidenceRoot: string; snapshots: TopicScoreSnapshotV1[]; underwriting: UnderwritingRecommendationV1 | null }): string {
  return hashCanonicalJson({ passportVersion: 'passport-root/v1', subject: input.subject, evidenceRoot: input.evidenceRoot,
    snapshots: [...input.snapshots].sort((a, b) => `${a.topic}/${a.subtopic}/${a.horizon}`.localeCompare(`${b.topic}/${b.subtopic}/${b.horizon}`)), underwriting: input.underwriting });
}

export function evidenceBundleToScoringEvidence(bundle: EvidenceBundleV1): TopicScoringEvidenceV1[] {
  const markets = new Map(bundle.canonicalMarkets.map((market) => [market.canonicalEventId, market]));
  const resolutions = new Map(bundle.resolutions.map((resolution) => [`${resolution.canonicalEventId}/${resolution.venueMarketId}`, resolution]));
  return bundle.receipts.map((receipt) => {
    if (!receipt.canonicalEventId) throw new Error(`Receipt ${receipt.receiptId} has no canonical event`);
    const market = markets.get(receipt.canonicalEventId); if (!market) throw new Error(`Missing canonical market for ${receipt.receiptId}`);
    return { receipt, market, resolution: resolutions.get(`${receipt.canonicalEventId}/${receipt.venueMarketId}`) ?? null,
      contemporaneousMarketProbability: bundle.contemporaneousMarketProbabilities[receipt.receiptId] ?? null,
      origin: receipt.venue === 'beright' ? 'native' : 'imported', ...(bundle.evidenceMetadata[receipt.receiptId] ?? {}) };
  });
}

export function assertEvidenceRoot(bundle: EvidenceBundleV1): void {
  const root = buildEvidenceMerkleTree(bundle.receipts).root;
  if (root !== bundle.evidenceRoot) throw new Error(`EVIDENCE_ROOT_MISMATCH: expected ${bundle.evidenceRoot}, received ${root}`);
}
