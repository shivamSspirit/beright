import {
  hashCanonicalJson, REPUTATION_PROTOCOL_V1, type CanonicalMarketV1, type ForecastReceiptV1,
  type ResolutionReceiptV1, type SubjectV1,
} from '../protocol';
import { buildEvidenceMerkleTree, verifyReceiptInclusion } from './merkle';
import { calculateTopicScoreSnapshotsV1, type TopicScoringEvidenceV1 } from './topicScoring';
import { calculateUnderwritingRecommendationV1 } from './underwriting';
import { TOPIC_SCORING_CONFIG_V1, UNDERWRITING_POLICY_V1 } from './config';
import { calculatePassportRootV1, type EvidenceBundleV1 } from './bundle';
import { replayEvidenceBundleV1 } from './replay';

const now = new Date('2026-08-30T12:00:00.000Z');
const subject: SubjectV1 = { schemaVersion: REPUTATION_PROTOCOL_V1, subjectId: 'subject-score', subjectType: 'human',
  primaryWallet: '0x1111111111111111111111111111111111111111', walletChain: 'ethereum', displayName: 'Fixture Forecaster', identityStatus: 'verified',
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: now.toISOString() };

function makeMarket(index: number, overrides: Partial<CanonicalMarketV1> = {}): CanonicalMarketV1 {
  return { schemaVersion: REPUTATION_PROTOCOL_V1, canonicalEventId: `event-${index}`, title: `Will Bitcoin event ${index} resolve yes?`, topic: 'crypto', subtopic: 'bitcoin',
    horizon: 'one_to_seven_days', outcomeType: 'binary', venueMarketId: `market-${index}`, venue: 'polymarket', outcomeMapping: { YES: 'YES', NO: 'NO' },
    openTime: '2026-01-01T00:00:00.000Z', closeTime: '2026-08-20T00:00:00.000Z', resolutionTime: '2026-08-21T00:00:00.000Z',
    resolutionSource: 'venue fixture', normalizedRules: `fixture rule ${index}`, marketRulesHash: hashCanonicalJson({ rule: index }), equivalenceConfidence: 1,
    reviewStatus: 'exact_equivalent', warnings: [], disqualifiers: [], ...overrides };
}

function makeEvidence(index: number, options: { probability?: number; outcome?: 'YES' | 'NO'; ageDays?: number; finality?: ResolutionReceiptV1['finality'];
  topic?: CanonicalMarketV1['topic']; subtopic?: CanonicalMarketV1['subtopic']; horizon?: CanonicalMarketV1['horizon']; origin?: 'imported' | 'native';
  marketProbability?: number | null; correlationGroup?: string; lateEntry?: boolean; selectiveImportRisk?: boolean; marketMakerActivity?: boolean } = {}): TopicScoringEvidenceV1 {
  const market = makeMarket(index, { topic: options.topic ?? 'crypto', subtopic: options.subtopic ?? 'bitcoin', horizon: options.horizon ?? 'one_to_seven_days' });
  const raw = { fixture: true, index, probability: options.probability ?? 0.8 };
  const receipt: ForecastReceiptV1 = { schemaVersion: REPUTATION_PROTOCOL_V1, receiptId: `receipt-${index}`, subjectId: subject.subjectId,
    sourceType: options.origin === 'native' ? 'explicit_forecast' : 'trade', venue: options.origin === 'native' ? 'beright' : 'polymarket', venueAccount: subject.primaryWallet,
    venueMarketId: market.venueMarketId, canonicalEventId: market.canonicalEventId, predictedProbability: options.probability ?? 0.8, direction: 'YES',
    predictedAt: new Date(now.getTime() - (options.ageDays ?? index + 1) * 86_400_000).toISOString(), entryPrice: options.origin === 'native' ? null : options.probability ?? 0.8,
    positionSize: options.origin === 'native' ? null : 100, venueTransactionReference: `fixture:${index}`, rawEvidenceHash: hashCanonicalJson(raw), ingestionVersion: 'v1',
    observedAt: now.toISOString(), evidenceFinality: options.finality ?? 'venue_final' };
  const resolution: ResolutionReceiptV1 = { schemaVersion: REPUTATION_PROTOCOL_V1, canonicalEventId: market.canonicalEventId, venueMarketId: market.venueMarketId,
    outcome: options.outcome ?? 'YES', finality: options.finality ?? 'venue_final', resolutionSource: 'fixture resolver', resolvedAt: new Date(now.getTime() - (options.ageDays ?? index + 1) * 86_400_000).toISOString(),
    evidenceHash: hashCanonicalJson({ resolution: index }), disputeStatus: options.finality === 'disputed' ? 'disputed' : 'none', observedAt: now.toISOString() };
  return { receipt, market, resolution, contemporaneousMarketProbability: options.marketProbability ?? 0.55, origin: options.origin ?? 'imported',
    correlationGroup: options.correlationGroup, lateEntry: options.lateEntry, selectiveImportRisk: options.selectiveImportRisk, marketMakerActivity: options.marketMakerActivity };
}

describe('topic reputation v1', () => {
  it('scores perfect forecasts above terrible forecasts', () => {
    const perfect = Array.from({ length: 40 }, (_, index) => makeEvidence(index, { probability: 0.9, outcome: 'YES' }));
    const terrible = Array.from({ length: 40 }, (_, index) => makeEvidence(index, { probability: 0.9, outcome: 'NO' }));
    expect(calculateTopicScoreSnapshotsV1({ subjectId: subject.subjectId, evidence: perfect, now })[0].score)
      .toBeGreaterThan(calculateTopicScoreSnapshotsV1({ subjectId: subject.subjectId, evidence: terrible, now })[0].score);
  });

  it('shrinks small samples and enforces maturity counts', () => {
    const small = calculateTopicScoreSnapshotsV1({ subjectId: subject.subjectId, evidence: Array.from({ length: 9 }, (_, index) => makeEvidence(index)), now })[0];
    const provisional = calculateTopicScoreSnapshotsV1({ subjectId: subject.subjectId, evidence: Array.from({ length: 10 }, (_, index) => makeEvidence(index)), now })[0];
    expect(small.status).toBe('Unproven'); expect(provisional.status).toBe('Provisional'); expect(small.confidence).toBeLessThan(0.2);
  });

  it('uses time decay and effective sample size', () => {
    const recent = calculateTopicScoreSnapshotsV1({ subjectId: subject.subjectId, evidence: Array.from({ length: 30 }, (_, index) => makeEvidence(index, { ageDays: index })), now })[0];
    const spread = calculateTopicScoreSnapshotsV1({ subjectId: subject.subjectId, evidence: Array.from({ length: 30 }, (_, index) => makeEvidence(index, { ageDays: index * 30 })), now })[0];
    expect(spread.effectiveSampleSize).toBeLessThan(recent.effectiveSampleSize);
  });

  it('isolates topic and horizon vectors', () => {
    const evidence = [makeEvidence(1), makeEvidence(2, { topic: 'macro', subtopic: 'rates' }), makeEvidence(3, { horizon: 'intraday' })];
    const snapshots = calculateTopicScoreSnapshotsV1({ subjectId: subject.subjectId, evidence, now });
    expect(snapshots).toHaveLength(3);
  });

  it('penalizes missing/disputed evidence, duplicates, correlation, late entry, selective imports, and market making', () => {
    const clean = Array.from({ length: 30 }, (_, index) => makeEvidence(index));
    const disputed = clean.map((_, index) => makeEvidence(index + 100, { finality: 'disputed' }));
    expect(calculateTopicScoreSnapshotsV1({ subjectId: subject.subjectId, evidence: disputed, now })[0].evidenceQuality).toBeLessThan(0.3);
    const duplicate = makeEvidence(999);
    const gamed = [...clean, duplicate, duplicate, makeEvidence(1000, { correlationGroup: 'same', lateEntry: true, selectiveImportRisk: true, marketMakerActivity: true }), makeEvidence(1001, { correlationGroup: 'same' })];
    const result = calculateTopicScoreSnapshotsV1({ subjectId: subject.subjectId, evidence: gamed, now })[0];
    expect(result.penaltyFlags).toEqual(expect.arrayContaining(['duplicate-receipts', 'correlated-market-inflation', 'selective-history-import', 'market-maker-activity']));
    expect(result.status).toBe('Restricted');
  });

  it('uses deterministic Merkle roots and inclusion proofs', () => {
    const receipts = [makeEvidence(2).receipt, makeEvidence(1).receipt, makeEvidence(3).receipt];
    const tree = buildEvidenceMerkleTree(receipts); const reordered = buildEvidenceMerkleTree([...receipts].reverse());
    expect(tree.root).toBe(reordered.root); expect(verifyReceiptInclusion(receipts[0], tree.proofs[receipts[0].receiptId], tree.root)).toBe(true);
    expect(tree.root).toBe('9cef08ede2f1ba50b8b188b1159f3311c0047a8746c3d0acf4132cb288ee8858');
  });

  it('calculates identical topic snapshots regardless of evidence order', () => {
    const evidence = Array.from({ length: 35 }, (_, index) => makeEvidence(index, {
      probability: 0.51 + (index % 10) / 100,
      outcome: index % 3 === 0 ? 'NO' : 'YES',
      ageDays: index * 2,
    }));
    const forward = calculateTopicScoreSnapshotsV1({ subjectId: subject.subjectId, evidence, now });
    const reversed = calculateTopicScoreSnapshotsV1({ subjectId: subject.subjectId, evidence: [...evidence].reverse(), now });
    expect(reversed).toEqual(forward);
  });

  it('keeps imported-only recommendations probationary and gives unproven/restricted subjects zero caps', () => {
    const unproven = calculateTopicScoreSnapshotsV1({ subjectId: subject.subjectId, evidence: Array.from({ length: 9 }, (_, index) => makeEvidence(index)), now });
    const recommendation = calculateUnderwritingRecommendationV1({ subjectId: subject.subjectId, snapshots: unproven, passportRoot: 'a'.repeat(64),
      inputs: { importedOnly: true, drawdownFactor: 1, liquidityFactor: 1, allowedVenues: ['polymarket'] }, now });
    expect(recommendation.probationary).toBe(true); expect(recommendation.maximumActiveCapitalUsd).toBe(0); expect(recommendation.eligibility).toBe('ineligible');
    expect(new Date(recommendation.expiresAt).getTime() - now.getTime()).toBe(UNDERWRITING_POLICY_V1.recommendationTtlSeconds * 1000);
  });

  it('replays a complete bundle and fails after one receipt is tampered', () => {
    const evidence = Array.from({ length: 35 }, (_, index) => makeEvidence(index, { origin: index % 2 ? 'native' : 'imported' }));
    const receipts = evidence.map((item) => item.receipt); const evidenceRoot = buildEvidenceMerkleTree(receipts).root;
    const scoringConfigHash = hashCanonicalJson(TOPIC_SCORING_CONFIG_V1);
    const snapshots = calculateTopicScoreSnapshotsV1({ subjectId: subject.subjectId, evidence, now, scoringCodeHash: scoringConfigHash });
    const underwritingInputs = { importedOnly: false, drawdownFactor: 0.8, liquidityFactor: 0.9, allowedVenues: ['beright', 'polymarket'] };
    const preRoot = calculatePassportRootV1({ subject, evidenceRoot, snapshots, underwriting: null });
    const underwriting = calculateUnderwritingRecommendationV1({ subjectId: subject.subjectId, snapshots, passportRoot: preRoot, inputs: underwritingInputs, now });
    const rawEvidence = Object.fromEntries(evidence.map((item, index) => [item.receipt.receiptId, { fixture: true, index, probability: item.receipt.predictedProbability }]));
    const bundle: EvidenceBundleV1 = { schemaVersion: REPUTATION_PROTOCOL_V1, bundleVersion: 'evidence-bundle/v1', subject, receipts,
      rawEvidence, canonicalMarkets: evidence.map((item) => item.market), resolutions: evidence.map((item) => item.resolution!).filter(Boolean),
      contemporaneousMarketProbabilities: Object.fromEntries(evidence.map((item) => [item.receipt.receiptId, item.contemporaneousMarketProbability])),
      evidenceMetadata: Object.fromEntries(evidence.map((item) => [item.receipt.receiptId, {}])), evidenceRoot, topicSnapshots: snapshots, underwriting,
      underwritingInputs, scoringConfigHash, policyConfigHash: hashCanonicalJson(UNDERWRITING_POLICY_V1), generatedAt: now.toISOString(),
      passportRoot: calculatePassportRootV1({ subject, evidenceRoot, snapshots, underwriting }) };
    expect(replayEvidenceBundleV1(bundle).valid).toBe(true);
    const tampered = structuredClone(bundle); tampered.receipts[0].predictedProbability = 0.01;
    expect(replayEvidenceBundleV1(tampered).valid).toBe(false);
  });
});
