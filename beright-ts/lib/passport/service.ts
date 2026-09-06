import {
  buildEvidenceMerkleTree, calculatePassportRootV1, hashCanonicalJson, hashUnderwritingPolicyV1,
  TOPIC_SCORING_CONFIG_V1, replayEvidenceBundleV1, type EvidenceBundleV1, type TopicScoreSnapshotV1,
} from '@beright/forecaster-scoring-engine';
import { SupabasePassportRepository, type PassportPersistenceV1 } from './repository';

export class PassportError extends Error {
  constructor(public readonly code: 'PASSPORT_NOT_FOUND' | 'EVIDENCE_UNAVAILABLE' | 'PASSPORT_UNAVAILABLE', message: string) { super(message); }
}

function latestTopicSnapshots(data: PassportPersistenceV1) {
  const seen = new Set<string>();
  return data.snapshots.filter((snapshot) => {
    const key = `${snapshot.topic}/${snapshot.subtopic}/${snapshot.horizon}`;
    if (seen.has(key)) return false; seen.add(key); return true;
  }).sort((a, b) => `${a.topic}/${a.subtopic}/${a.horizon}`.localeCompare(`${b.topic}/${b.subtopic}/${b.horizon}`));
}

function reportNumber(data: PassportPersistenceV1, key: string): number {
  const value = data.report[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function reportTimestamp(data: PassportPersistenceV1): string | null {
  return typeof data.report.fetchedAt === 'string' ? data.report.fetchedAt : null;
}

export class PassportService {
  constructor(private readonly repository = new SupabasePassportRepository()) {}

  async requirePassport(
    lookup: string,
    options: { includeCanonicalEvidence?: boolean; includeReceipts?: boolean } = {},
  ): Promise<PassportPersistenceV1> {
    try { const data = await this.repository.getPassport(lookup, options); if (!data) throw new PassportError('PASSPORT_NOT_FOUND', 'Forecaster Passport not found'); return data; }
    catch (error) { if (error instanceof PassportError) throw error; throw new PassportError('PASSPORT_UNAVAILABLE', 'Forecaster Passport is temporarily unavailable'); }
  }

  async summary(lookup: string) {
    const data = await this.requirePassport(lookup, { includeCanonicalEvidence: false, includeReceipts: false }); const snapshots = latestTopicSnapshots(data);
    const sourceFreshness = reportTimestamp(data);
    const venues = reportNumber(data, 'receiptsCreated') > 0 ? ['polymarket'] : [];
    const statusOrder = { Restricted: 0, Unproven: 1, Provisional: 2, Verified: 3, Advanced: 4 } as const;
    const status = snapshots.reduce<TopicScoreSnapshotV1['status']>(
      (current, snapshot) => statusOrder[snapshot.status] < statusOrder[current] ? snapshot.status : current,
      'Advanced',
    );
    return { schemaVersion: 'reputation-protocol/v1', subject: data.subject,
      claims: data.claims.map(({ challengeHash: _challengeHash, metadataHash: _metadataHash, ...claim }) => claim),
      summary: { status: snapshots.length ? status : 'Unproven',
        topicCount: snapshots.length, resolvedCount: snapshots.reduce((sum, snapshot) => sum + snapshot.resolvedCount, 0),
        effectiveSampleSize: snapshots.reduce((sum, snapshot) => sum + snapshot.effectiveSampleSize, 0),
        confidence: snapshots.length ? Math.min(...snapshots.map((snapshot) => snapshot.confidence)) : 0,
        evidenceQuality: snapshots.length ? Math.min(...snapshots.map((snapshot) => snapshot.evidenceQuality)) : 0,
        sourceFreshness,
        stale: sourceFreshness !== null && Date.now() - new Date(sourceFreshness).getTime() > 30 * 24 * 60 * 60 * 1000,
        venues },
      scoreVersion: 'topic-scoring/v1', calculatedAt: snapshots[0]?.calculatedAt ?? null,
      dataWindow: snapshots.length ? { start: snapshots.map((snapshot) => snapshot.dataWindowStart).sort()[0], end: snapshots.map((snapshot) => snapshot.dataWindowEnd).sort().at(-1) } : null,
      attestation: data.attestation ? { scoreEpoch: data.attestation.score_epoch, passportRoot: data.attestation.passport_root, evidenceRoot: data.attestation.evidence_root,
        publishedAt: data.attestation.published_at, revokedAt: data.attestation.revoked_at, cluster: data.attestation.cluster, programId: data.attestation.program_id } : null };
  }

  async topics(lookup: string) { const data = await this.requirePassport(lookup, { includeCanonicalEvidence: false, includeReceipts: false }); return { schemaVersion: 'reputation-protocol/v1', topics: latestTopicSnapshots(data) }; }
  async evidenceSummary(lookup: string) {
    const data = await this.requirePassport(lookup, { includeCanonicalEvidence: false, includeReceipts: false });
    const total = reportNumber(data, 'receiptsCreated');
    const resolved = reportNumber(data, 'resolvedReceipts');
    return { schemaVersion: 'reputation-protocol/v1', resolvedCount: resolved, openCount: Math.max(0, total - resolved),
      disputedCount: null, freshness: reportTimestamp(data) };
  }
  async evidence(lookup: string) { const data = await this.requirePassport(lookup); return { schemaVersion: 'reputation-protocol/v1', receipts: data.receipts,
    resolutions: data.resolutions, canonicalMarkets: data.markets, freshness: data.receipts.map((receipt) => receipt.observedAt).sort().at(-1) ?? null }; }
  async underwriting(lookup: string) { const data = await this.requirePassport(lookup, { includeCanonicalEvidence: false, includeReceipts: false }); return { schemaVersion: 'reputation-protocol/v1', recommendation: data.underwriting,
    disclaimer: 'Read-only recommendation. It grants no custody, allocation, transaction, or withdrawal authority.' }; }

  async evidenceBundle(lookup: string): Promise<EvidenceBundleV1> {
    const data = await this.requirePassport(lookup); const snapshots = latestTopicSnapshots(data);
    if (!data.underwriting || !data.underwritingInputs) throw new PassportError('EVIDENCE_UNAVAILABLE', 'A reproducible underwriting snapshot is not available');
    if (data.receipts.some((receipt) => !(receipt.receiptId in data.rawEvidence))) throw new PassportError('EVIDENCE_UNAVAILABLE', 'Source evidence is unavailable for one or more receipts');
    const evidenceRoot = buildEvidenceMerkleTree(data.receipts).root;
    const passportRoot = calculatePassportRootV1({ subject: data.subject, evidenceRoot, snapshots, underwriting: data.underwriting });
    return { schemaVersion: 'reputation-protocol/v1', bundleVersion: 'evidence-bundle/v1', subject: data.subject, receipts: data.receipts,
      rawEvidence: data.rawEvidence, canonicalMarkets: data.markets, resolutions: data.resolutions,
      contemporaneousMarketProbabilities: Object.fromEntries(data.receipts.map((receipt) => [receipt.receiptId,
        typeof data.scoringMetadata[receipt.receiptId]?.contemporaneousMarketProbability === 'number' ? data.scoringMetadata[receipt.receiptId].contemporaneousMarketProbability as number : null])),
      evidenceMetadata: Object.fromEntries(data.receipts.map((receipt) => [receipt.receiptId, {
        correlationGroup: typeof data.scoringMetadata[receipt.receiptId]?.correlationGroup === 'string' ? data.scoringMetadata[receipt.receiptId].correlationGroup as string : undefined,
        lateEntry: data.scoringMetadata[receipt.receiptId]?.lateEntry === true, easyMarket: data.scoringMetadata[receipt.receiptId]?.easyMarket === true,
        selectiveImportRisk: data.scoringMetadata[receipt.receiptId]?.selectiveImportRisk === true, marketMakerActivity: data.scoringMetadata[receipt.receiptId]?.marketMakerActivity === true,
      }])), evidenceRoot, topicSnapshots: snapshots, underwriting: data.underwriting, underwritingInputs: data.underwritingInputs,
      scoringConfigHash: hashCanonicalJson(TOPIC_SCORING_CONFIG_V1), policyConfigHash: hashUnderwritingPolicyV1(), generatedAt: new Date().toISOString(), passportRoot };
  }

  async verify(lookup: string) { return replayEvidenceBundleV1(await this.evidenceBundle(lookup)); }
  async equivalents(canonicalEventId: string) { return { schemaVersion: 'reputation-protocol/v1', canonicalEventId, equivalents: await this.repository.getEquivalents(canonicalEventId) }; }
  async leaderboard(wallets: string[]) { return { schemaVersion: 'reputation-protocol/v1', entries: await this.repository.getLeaderboard(wallets) }; }
  async metrics() { return { schemaVersion: 'reputation-protocol/v1', launchGoalsAchieved: false, metrics: await this.repository.getMetrics() }; }
}
