import {
  canonicalMarketV1Schema, forecastReceiptV1Schema, REPUTATION_PROTOCOL_V1, resolutionReceiptV1Schema,
  subjectV1Schema, topicScoreSnapshotV1Schema, underwritingRecommendationV1Schema,
  type CanonicalMarketV1, type ForecastReceiptV1, type ResolutionReceiptV1, type SubjectV1,
  type TopicScoreSnapshotV1, type UnderwritingRecommendationV1, type VenueClaimV1,
} from '@beright/forecaster-scoring-engine';
import { supabaseAdmin } from '../supabase/client';

interface ReceiptRow { receipt_id: string; subject_id: string; source_type: 'trade' | 'explicit_forecast'; venue: string; venue_account: string; venue_market_id: string;
  canonical_event_id: string | null; predicted_probability: number; direction: 'YES' | 'NO'; predicted_at: string; entry_price: number | null; position_size: number | null;
  venue_transaction_reference: string | null; raw_evidence_hash: string; ingestion_version: 'v1'; observed_at: string; evidence_finality: ForecastReceiptV1['evidenceFinality'];
  source_evidence: unknown; scoring_metadata: Record<string, unknown> }
interface EventRow { canonical_event_id: string; title: string; topic: CanonicalMarketV1['topic']; subtopic: CanonicalMarketV1['subtopic']; horizon: CanonicalMarketV1['horizon'];
  outcome_type: CanonicalMarketV1['outcomeType']; open_time: string; close_time: string; resolution_time: string | null; resolution_source: string; normalized_rules: string;
  market_rules_hash: string; review_status: CanonicalMarketV1['reviewStatus']; warnings: string[]; disqualifiers: string[] }
interface MemberRow { canonical_event_id: string; venue: string; venue_market_id: string; outcome_mapping: Record<string, string>; equivalence_score: number }
interface ResolutionRow { canonical_event_id: string; venue_market_id: string; outcome: string; finality: ResolutionReceiptV1['finality']; resolution_source: string;
  resolved_at: string; evidence_hash: string; dispute_status: ResolutionReceiptV1['disputeStatus']; observed_at: string }
interface LeaderboardSubjectRow { subject_id: string; primary_wallet: string; display_name: string; identity_status: string }
interface LeaderboardBundleRow { subject_id: string; passport_root: string; evidence_root: string; report: unknown; published_at: string }
interface LeaderboardSnapshotRow { subject_id: string; calculated_at: string; snapshot: unknown }
interface CurrentBundleRow { passport_root: string; evidence_root: string; report: unknown; published_at: string }

const EVENT_QUERY_BATCH_SIZE = 90;

export interface PassportLeaderboardEntry {
  rank: number;
  subjectId: string;
  address: string;
  displayName: string;
  identityStatus: string;
  status: TopicScoreSnapshotV1['status'] | 'Unproven';
  featuredScore: number | null;
  featuredTopic: string | null;
  featuredHorizon: string | null;
  confidence: number;
  resolvedCount: number;
  tradesFetched: number;
  marketsCovered: number;
  receiptsCreated: number;
  completeHistory: boolean;
  passportRoot: string;
  publishedAt: string;
}

function normalizeDatabaseTimestamp(value: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) throw new Error('INVALID_DATABASE_TIMESTAMP');
  return timestamp.toISOString();
}

function recordValue(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function numericValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export interface PassportPersistenceV1 {
  subject: SubjectV1;
  report: Record<string, unknown>;
  claims: VenueClaimV1[];
  receipts: ForecastReceiptV1[];
  rawEvidence: Record<string, unknown>;
  scoringMetadata: Record<string, Record<string, unknown>>;
  markets: CanonicalMarketV1[];
  resolutions: ResolutionReceiptV1[];
  snapshots: TopicScoreSnapshotV1[];
  underwriting: UnderwritingRecommendationV1 | null;
  underwritingInputs: { importedOnly: boolean; drawdownFactor: number; liquidityFactor: number; allowedVenues: string[] } | null;
  attestation: Record<string, unknown> | null;
}

async function requiredQuery<T>(promise: PromiseLike<{ data: unknown; error: { message?: string } | null }>, code: string): Promise<T[]> {
  const { data, error } = await promise;
  if (error) throw new Error(code);
  return (data ?? []) as T[];
}

async function requiredPagedQuery<T>(
  page: (start: number, end: number) => PromiseLike<{ data: unknown; error: { message?: string } | null }>,
  code: string,
  pageSize = 1_000,
): Promise<T[]> {
  const rows: T[] = [];
  for (let start = 0; ; start += pageSize) {
    const batch = await requiredQuery<T>(page(start, start + pageSize - 1), code);
    rows.push(...batch);
    if (batch.length < pageSize) return rows;
  }
}

export class SupabasePassportRepository {
  async findSubject(lookup: string): Promise<SubjectV1 | null> {
    const bySubject = await supabaseAdmin.from('subjects').select('*').eq('subject_id', lookup).maybeSingle();
    if (bySubject.error) throw new Error('PASSPORT_DATABASE_UNAVAILABLE');
    let data = bySubject.data;
    if (!data && /^0x[a-fA-F0-9]{40}$/.test(lookup)) {
      const byWallet = await supabaseAdmin.from('subjects').select('*').eq('primary_wallet', lookup.toLowerCase()).maybeSingle();
      if (byWallet.error) throw new Error('PASSPORT_DATABASE_UNAVAILABLE');
      data = byWallet.data;
    }
    if (!data) return null;
    return subjectV1Schema.parse({ schemaVersion: REPUTATION_PROTOCOL_V1, subjectId: data.subject_id, subjectType: data.subject_type,
      primaryWallet: data.primary_wallet ?? data.primary_solana_wallet,
      walletChain: data.primary_wallet_chain ?? (data.primary_solana_wallet ? 'solana' : 'ethereum'),
      displayName: data.display_name, identityStatus: data.identity_status,
      createdAt: normalizeDatabaseTimestamp(data.created_at), updatedAt: normalizeDatabaseTimestamp(data.updated_at) });
  }

  async getPassport(
    lookup: string,
    options: { includeCanonicalEvidence?: boolean; includeReceipts?: boolean } = {},
  ): Promise<PassportPersistenceV1 | null> {
    const subject = await this.findSubject(lookup); if (!subject) return null;
    const subjectId = subject.subjectId;
    const currentBundleResult = await supabaseAdmin.from('passport_bundles')
      .select('passport_root,evidence_root,report,published_at').eq('subject_id', subjectId).maybeSingle();
    if (currentBundleResult.error) throw new Error('PASSPORT_DATABASE_UNAVAILABLE');
    if (!currentBundleResult.data) return null;
    const currentBundle = currentBundleResult.data as CurrentBundleRow;
    const currentReport = recordValue(currentBundle.report);
    const sourceCheckpoint = typeof currentReport.fetchedAt === 'string' ? currentReport.fetchedAt : null;
    const [claimRows, receiptRows, snapshotRows, underwritingRows, attestationRows] = await Promise.all([
      requiredQuery<Record<string, unknown>>(supabaseAdmin.from('venue_claims').select('*').eq('subject_id', subjectId).order('verified_at', { ascending: false }), 'CLAIMS_UNAVAILABLE'),
      options.includeReceipts === false ? Promise.resolve([] as ReceiptRow[]) : requiredPagedQuery<ReceiptRow>((start, end) => {
        let query = supabaseAdmin.from('forecast_receipts').select('*')
          .eq('subject_id', subjectId)
          .order('predicted_at', { ascending: false })
          .order('receipt_id', { ascending: true })
          .range(start, end);
        if (sourceCheckpoint) query = query.eq('source_checkpoint', sourceCheckpoint);
        return query;
      }, 'RECEIPTS_UNAVAILABLE'),
      requiredQuery<{ snapshot: unknown }>(supabaseAdmin.from('topic_score_snapshots').select('snapshot')
        .eq('subject_id', subjectId).eq('calculated_at', currentBundle.published_at)
        .order('calculated_at', { ascending: false }), 'SCORES_UNAVAILABLE'),
      requiredQuery<{ recommendation: unknown; policy_inputs: PassportPersistenceV1['underwritingInputs'] }>(
        supabaseAdmin.from('underwriting_recommendations').select('recommendation,policy_inputs')
          .eq('subject_id', subjectId).eq('calculated_at', currentBundle.published_at)
          .order('calculated_at', { ascending: false }).limit(1),
        'UNDERWRITING_UNAVAILABLE',
      ),
      requiredQuery<Record<string, unknown>>(supabaseAdmin.from('passport_epochs').select('*')
        .eq('subject_id', subjectId).eq('passport_root', currentBundle.passport_root).limit(1), 'ATTESTATION_UNAVAILABLE'),
    ]);
    const eventIds = [...new Set(receiptRows.map((row) => row.canonical_event_id).filter((value): value is string => Boolean(value)))];
    const eventRows: EventRow[] = [];
    const memberRows: MemberRow[] = [];
    const resolutionRows: ResolutionRow[] = [];
    // PostgREST serializes `.in(...)` values into the query string. Large
    // Passports can exceed proxy URL limits, so read related evidence in
    // bounded batches instead of issuing one oversized request.
    const includeCanonicalEvidence = options.includeCanonicalEvidence ?? true;
    for (let index = 0; includeCanonicalEvidence && index < eventIds.length; index += EVENT_QUERY_BATCH_SIZE) {
      const batch = eventIds.slice(index, index + EVENT_QUERY_BATCH_SIZE);
      const [events, members, resolutions] = await Promise.all([
        requiredQuery<EventRow>(supabaseAdmin.from('canonical_events').select('*').in('canonical_event_id', batch), 'EVENTS_UNAVAILABLE'),
        requiredQuery<MemberRow>(supabaseAdmin.from('canonical_market_members').select('*').in('canonical_event_id', batch), 'MARKET_MEMBERS_UNAVAILABLE'),
        requiredQuery<ResolutionRow>(supabaseAdmin.from('resolution_receipts').select('*').in('canonical_event_id', batch), 'RESOLUTIONS_UNAVAILABLE'),
      ]);
      eventRows.push(...events);
      memberRows.push(...members);
      resolutionRows.push(...resolutions);
    }
    const events = new Map(eventRows.map((row) => [row.canonical_event_id, row]));
    const members = new Map(memberRows.map((row) => [`${row.canonical_event_id}/${row.venue}/${row.venue_market_id}`, row]));
    const receipts = receiptRows.map((row) => forecastReceiptV1Schema.parse({ schemaVersion: REPUTATION_PROTOCOL_V1, receiptId: row.receipt_id, subjectId: row.subject_id,
      sourceType: row.source_type, venue: row.venue, venueAccount: row.venue_account, venueMarketId: row.venue_market_id, canonicalEventId: row.canonical_event_id,
      predictedProbability: Number(row.predicted_probability), direction: row.direction,
      predictedAt: normalizeDatabaseTimestamp(row.predicted_at), entryPrice: row.entry_price === null ? null : Number(row.entry_price),
      positionSize: row.position_size === null ? null : Number(row.position_size), venueTransactionReference: row.venue_transaction_reference,
      rawEvidenceHash: row.raw_evidence_hash, ingestionVersion: row.ingestion_version,
      observedAt: normalizeDatabaseTimestamp(row.observed_at), evidenceFinality: row.evidence_finality }));
    const markets = receipts.flatMap((receipt) => {
      if (!receipt.canonicalEventId) return [];
      const event = events.get(receipt.canonicalEventId); const member = members.get(`${receipt.canonicalEventId}/${receipt.venue}/${receipt.venueMarketId}`);
      if (!event || !member) return [];
      return [canonicalMarketV1Schema.parse({ schemaVersion: REPUTATION_PROTOCOL_V1, canonicalEventId: event.canonical_event_id, title: event.title, topic: event.topic,
        subtopic: event.subtopic, horizon: event.horizon, outcomeType: event.outcome_type, venueMarketId: member.venue_market_id, venue: member.venue,
        outcomeMapping: member.outcome_mapping, openTime: normalizeDatabaseTimestamp(event.open_time),
        closeTime: normalizeDatabaseTimestamp(event.close_time),
        resolutionTime: event.resolution_time ? normalizeDatabaseTimestamp(event.resolution_time) : null,
        resolutionSource: event.resolution_source, normalizedRules: event.normalized_rules, marketRulesHash: event.market_rules_hash,
        equivalenceConfidence: Number(member.equivalence_score), reviewStatus: event.review_status, warnings: event.warnings, disqualifiers: event.disqualifiers })];
    });
    const claims = claimRows.map((row) => ({ schemaVersion: REPUTATION_PROTOCOL_V1, claimId: String(row.claim_id), subjectId: String(row.subject_id), venue: String(row.venue),
      venueAccount: String(row.venue_account), proofType: row.proof_type as VenueClaimV1['proofType'], challengeHash: String(row.challenge_hash),
      verifiedAt: normalizeDatabaseTimestamp(String(row.verified_at)),
      expiresAt: row.expires_at ? normalizeDatabaseTimestamp(String(row.expires_at)) : null,
      revokedAt: row.revoked_at ? normalizeDatabaseTimestamp(String(row.revoked_at)) : null, verificationVersion: 'v1' as const,
      metadataHash: String(row.metadata_hash) }));
    return { subject, report: currentReport, claims, receipts, rawEvidence: Object.fromEntries(receiptRows.map((row) => [row.receipt_id, row.source_evidence])),
      scoringMetadata: Object.fromEntries(receiptRows.map((row) => [row.receipt_id, row.scoring_metadata ?? {}])), markets,
      resolutions: resolutionRows.map((row) => resolutionReceiptV1Schema.parse({ schemaVersion: REPUTATION_PROTOCOL_V1, canonicalEventId: row.canonical_event_id,
        venueMarketId: row.venue_market_id, outcome: row.outcome, finality: row.finality, resolutionSource: row.resolution_source,
        resolvedAt: normalizeDatabaseTimestamp(row.resolved_at), evidenceHash: row.evidence_hash,
        disputeStatus: row.dispute_status, observedAt: normalizeDatabaseTimestamp(row.observed_at) })),
      snapshots: snapshotRows.map((row) => topicScoreSnapshotV1Schema.parse(row.snapshot)),
      underwriting: underwritingRows[0] ? underwritingRecommendationV1Schema.parse(underwritingRows[0].recommendation) : null,
      underwritingInputs: underwritingRows[0]?.policy_inputs ?? null, attestation: attestationRows[0] ?? null };
  }

  async getEquivalents(canonicalEventId: string): Promise<Record<string, unknown>[]> {
    return requiredQuery<Record<string, unknown>>(supabaseAdmin.from('canonical_market_members').select('*').eq('canonical_event_id', canonicalEventId).order('equivalence_score', { ascending: false }), 'MARKET_MEMBERS_UNAVAILABLE');
  }

  async getLeaderboard(wallets: string[]): Promise<PassportLeaderboardEntry[]> {
    const normalizedWallets = [...new Set(wallets.map((wallet) => wallet.toLowerCase()))];
    if (!normalizedWallets.length) return [];
    const subjectRows = await requiredQuery<LeaderboardSubjectRow>(
      supabaseAdmin.from('subjects').select('subject_id,primary_wallet,display_name,identity_status')
        .in('primary_wallet', normalizedWallets),
      'LEADERBOARD_SUBJECTS_UNAVAILABLE',
    );
    if (!subjectRows.length) return [];
    const subjectIds = subjectRows.map((row) => row.subject_id);
    const [bundleRows, snapshotRows] = await Promise.all([
      requiredQuery<LeaderboardBundleRow>(
        supabaseAdmin.from('passport_bundles').select('subject_id,passport_root,evidence_root,report,published_at')
          .in('subject_id', subjectIds),
        'LEADERBOARD_BUNDLES_UNAVAILABLE',
      ),
      requiredQuery<LeaderboardSnapshotRow>(
        supabaseAdmin.from('topic_score_snapshots').select('subject_id,calculated_at,snapshot')
          .in('subject_id', subjectIds),
        'LEADERBOARD_SCORES_UNAVAILABLE',
      ),
    ]);
    const subjects = new Map(subjectRows.map((row) => [row.subject_id, row]));
    const statusOrder = { Restricted: 0, Unproven: 1, Provisional: 2, Verified: 3, Advanced: 4 } as const;
    const entries = bundleRows.flatMap((bundle): Omit<PassportLeaderboardEntry, 'rank'>[] => {
      const subject = subjects.get(bundle.subject_id);
      if (!subject) return [];
      const snapshots = snapshotRows
        .filter((row) => row.subject_id === subject.subject_id
          && new Date(row.calculated_at).getTime() === new Date(bundle.published_at).getTime())
        .map((row) => topicScoreSnapshotV1Schema.parse(row.snapshot));
      const featured = [...snapshots].sort((left, right) =>
        right.confidence - left.confidence || right.score - left.score)[0];
      const status = snapshots.reduce<TopicScoreSnapshotV1['status']>(
        (current, snapshot) => statusOrder[snapshot.status] < statusOrder[current] ? snapshot.status : current,
        'Advanced',
      );
      const report = recordValue(bundle.report);
      return [{
        subjectId: subject.subject_id,
        address: subject.primary_wallet,
        displayName: subject.display_name,
        identityStatus: subject.identity_status,
        status: snapshots.length ? status : 'Unproven',
        featuredScore: featured?.score ?? null,
        featuredTopic: featured ? `${featured.topic} / ${featured.subtopic}` : null,
        featuredHorizon: featured?.horizon ?? null,
        confidence: featured?.confidence ?? 0,
        resolvedCount: snapshots.reduce((sum, snapshot) => sum + snapshot.resolvedCount, 0),
        tradesFetched: numericValue(report.tradesFetched),
        marketsCovered: numericValue(report.marketsCovered),
        receiptsCreated: numericValue(report.receiptsCreated),
        completeHistory: report.completeHistory === true,
        passportRoot: bundle.passport_root,
        publishedAt: normalizeDatabaseTimestamp(bundle.published_at),
      }];
    }).sort((left, right) =>
      (right.featuredScore ?? -1) - (left.featuredScore ?? -1)
      || right.confidence - left.confidence
      || right.resolvedCount - left.resolvedCount
      || left.address.localeCompare(right.address));
    return entries.map((entry, index) => ({ ...entry, rank: index + 1 }));
  }

  async getMetrics(): Promise<Record<string, unknown> | null> {
    const { data, error } = await supabaseAdmin.from('passport_product_metrics').select('*').maybeSingle();
    if (error) throw new Error('METRICS_UNAVAILABLE');
    return data as Record<string, unknown> | null;
  }
}
