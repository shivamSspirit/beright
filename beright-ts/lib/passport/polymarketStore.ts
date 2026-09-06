import { hasSupabaseAdminKey, supabaseAdmin } from '../supabase/client';
import type { PolymarketPassportBuild } from './polymarketWorker';

type DatabaseRow = Record<string, unknown>;

interface PolymarketDatabasePayload {
  subject: DatabaseRow;
  markets: DatabaseRow[];
  receipts: DatabaseRow[];
  resolutions: DatabaseRow[];
  snapshots: DatabaseRow[];
  underwriting: DatabaseRow;
  passport: {
    passport_root: string;
    evidence_root: string;
    bundle: unknown;
    report: PolymarketPassportBuild['report'];
    published_at: string;
  };
}

const CHUNKED_PUBLISH_THRESHOLD = 1_000;
const DATABASE_BATCH_SIZE = 100;

export interface PolymarketPassportStore {
  persist(build: PolymarketPassportBuild): Promise<{ scoreEpoch: number }>;
}

export class PassportStoreError extends Error {
  constructor(
    message: string,
    readonly code: 'PASSPORT_DATABASE_NOT_CONFIGURED' | 'PASSPORT_PUBLISH_FAILED',
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'PassportStoreError';
  }
}

export class SupabasePolymarketPassportStore implements PolymarketPassportStore {
  async persist(build: PolymarketPassportBuild): Promise<{ scoreEpoch: number }> {
    if (!hasSupabaseAdminKey) {
      throw new PassportStoreError(
        'The Passport database is not configured for server-side publishing',
        'PASSPORT_DATABASE_NOT_CONFIGURED',
      );
    }
    const payload: PolymarketDatabasePayload = {
      subject: {
        subject_id: build.subject.subjectId,
        subject_type: build.subject.subjectType,
        primary_wallet: build.subject.primaryWallet,
        primary_wallet_chain: build.subject.walletChain,
        display_name: build.subject.displayName,
        identity_status: build.subject.identityStatus,
        created_at: build.subject.createdAt,
        updated_at: build.subject.updatedAt,
      },
      markets: build.markets.map((market) => ({
        canonical_event_id: market.canonicalEventId, schema_version: market.schemaVersion, title: market.title,
        topic: market.topic, subtopic: market.subtopic, horizon: market.horizon, outcome_type: market.outcomeType,
        open_time: market.openTime, close_time: market.closeTime, resolution_time: market.resolutionTime,
        resolution_source: market.resolutionSource, normalized_rules: market.normalizedRules,
        market_rules_hash: market.marketRulesHash, review_status: market.reviewStatus, warnings: market.warnings,
        disqualifiers: market.disqualifiers, venue: market.venue, venue_market_id: market.venueMarketId,
        outcome_mapping: market.outcomeMapping, equivalence_score: market.equivalenceConfidence,
      })),
      receipts: build.receipts.map((receipt) => ({
        receipt_id: receipt.receiptId, subject_id: receipt.subjectId, source_type: receipt.sourceType, venue: receipt.venue,
        venue_account: receipt.venueAccount, venue_market_id: receipt.venueMarketId, canonical_event_id: receipt.canonicalEventId,
        predicted_probability: receipt.predictedProbability, direction: receipt.direction, predicted_at: receipt.predictedAt,
        entry_price: receipt.entryPrice, position_size: receipt.positionSize, venue_transaction_reference: receipt.venueTransactionReference,
        raw_evidence_hash: receipt.rawEvidenceHash, ingestion_version: receipt.ingestionVersion, observed_at: receipt.observedAt,
        evidence_finality: receipt.evidenceFinality, source_checkpoint: build.report.fetchedAt,
        source_evidence: build.rawEvidence[receipt.receiptId],
        scoring_metadata: {
          ...(build.bundle.evidenceMetadata[receipt.receiptId] ?? {}),
          contemporaneousMarketProbability: build.bundle.contemporaneousMarketProbabilities[receipt.receiptId] ?? null,
        },
      })),
      resolutions: build.resolutions.map((resolution) => ({
        canonical_event_id: resolution.canonicalEventId, venue_market_id: resolution.venueMarketId, outcome: resolution.outcome,
        finality: resolution.finality, resolution_source: resolution.resolutionSource, resolved_at: resolution.resolvedAt,
        evidence_hash: resolution.evidenceHash, dispute_status: resolution.disputeStatus, observed_at: resolution.observedAt,
      })),
      snapshots: build.snapshots.map((snapshot) => ({
        subject_id: snapshot.subjectId, topic: snapshot.topic, subtopic: snapshot.subtopic, horizon: snapshot.horizon,
        score: snapshot.score, snapshot, scoring_version: snapshot.scoringVersion, evidence_root: snapshot.evidenceRoot,
        calculated_at: snapshot.calculatedAt, data_window_start: snapshot.dataWindowStart, data_window_end: snapshot.dataWindowEnd,
      })),
      underwriting: {
        subject_id: build.underwriting.subjectId, recommendation: build.underwriting,
        policy_version: build.underwriting.policyVersion, passport_root: build.underwriting.passportRoot,
        calculated_at: build.underwriting.calculatedAt, expires_at: build.underwriting.expiresAt,
        policy_inputs: build.bundle.underwritingInputs,
      },
      passport: {
        passport_root: build.bundle.passportRoot, evidence_root: build.bundle.evidenceRoot,
        bundle: build.bundle, report: build.report, published_at: build.bundle.generatedAt,
      },
    };
    if (build.receipts.length > CHUNKED_PUBLISH_THRESHOLD) {
      return this.persistInChunks(build, payload);
    }
    const { data, error } = await supabaseAdmin.rpc('replace_polymarket_passport_v1', { p_payload: payload });
    if (error) {
      throw new PassportStoreError(
        'The Passport database could not publish this build',
        'PASSPORT_PUBLISH_FAILED',
        { cause: error },
      );
    }
    const result = data as { score_epoch?: number } | null;
    return { scoreEpoch: Number(result?.score_epoch ?? 0) };
  }

  private async writeBatches(
    table: string,
    rows: DatabaseRow[],
    onConflict: string,
  ): Promise<void> {
    for (let index = 0; index < rows.length; index += DATABASE_BATCH_SIZE) {
      const batch = rows.slice(index, index + DATABASE_BATCH_SIZE);
      const { error } = await supabaseAdmin.from(table).upsert(batch, { onConflict });
      if (error) {
        throw new PassportStoreError(
          `The Passport database could not publish ${table}`,
          'PASSPORT_PUBLISH_FAILED',
          { cause: error },
        );
      }
    }
  }

  private async cleanupSupersededRows(build: PolymarketPassportBuild): Promise<void> {
    const subjectId = build.subject.subjectId;
    const checkpoint = build.report.fetchedAt;
    const cleanupResults = await Promise.all([
      supabaseAdmin.from('forecast_receipts').delete()
        .eq('subject_id', subjectId).eq('venue', 'polymarket').neq('source_checkpoint', checkpoint),
      supabaseAdmin.from('forecast_receipts').delete()
        .eq('subject_id', subjectId).eq('venue', 'polymarket').is('source_checkpoint', null),
      supabaseAdmin.from('topic_score_snapshots').delete()
        .eq('subject_id', subjectId).eq('scoring_version', 'topic-scoring/v1')
        .neq('calculated_at', build.bundle.generatedAt),
      supabaseAdmin.from('underwriting_recommendations').delete()
        .eq('subject_id', subjectId).neq('calculated_at', build.bundle.generatedAt),
    ]);
    const cleanupError = cleanupResults.find((result) => result.error)?.error;
    if (cleanupError) {
      throw new PassportStoreError(
        'The Passport database could not remove superseded evidence',
        'PASSPORT_PUBLISH_FAILED',
        { cause: cleanupError },
      );
    }
  }

  private async persistInChunks(
    build: PolymarketPassportBuild,
    payload: PolymarketDatabasePayload,
  ): Promise<{ scoreEpoch: number }> {
    const subjectId = build.subject.subjectId;
    const wallet = build.subject.primaryWallet;

    const existingBundle = await supabaseAdmin.from('passport_bundles').select('passport_root')
      .eq('subject_id', subjectId).eq('passport_root', build.bundle.passportRoot).maybeSingle();
    if (existingBundle.error) {
      throw new PassportStoreError('The Passport database could not check the current build', 'PASSPORT_PUBLISH_FAILED', { cause: existingBundle.error });
    }
    if (existingBundle.data) {
      const epoch = await supabaseAdmin.from('passport_epochs').select('score_epoch')
        .eq('subject_id', subjectId).eq('passport_root', build.bundle.passportRoot).maybeSingle();
      if (epoch.error) throw new PassportStoreError('The Passport database could not read its score epoch', 'PASSPORT_PUBLISH_FAILED', { cause: epoch.error });
      await this.cleanupSupersededRows(build);
      return { scoreEpoch: Number(epoch.data?.score_epoch ?? 0) };
    }

    const subjectInsert = await supabaseAdmin.from('subjects').upsert(payload.subject, {
      onConflict: 'subject_id',
      ignoreDuplicates: true,
    });
    if (subjectInsert.error) throw new PassportStoreError('The Passport database could not create the subject', 'PASSPORT_PUBLISH_FAILED', { cause: subjectInsert.error });
    const subjectUpdate = await supabaseAdmin.from('subjects').update({
      primary_wallet: wallet,
      primary_wallet_chain: 'ethereum',
      display_name: build.subject.displayName,
      updated_at: build.subject.updatedAt,
    }).eq('subject_id', subjectId);
    if (subjectUpdate.error) throw new PassportStoreError('The Passport database could not update the subject', 'PASSPORT_PUBLISH_FAILED', { cause: subjectUpdate.error });

    const eventRows = payload.markets.map((market) => ({
      canonical_event_id: market.canonical_event_id,
      schema_version: market.schema_version,
      title: market.title,
      topic: market.topic,
      subtopic: market.subtopic,
      horizon: market.horizon,
      outcome_type: market.outcome_type,
      open_time: market.open_time,
      close_time: market.close_time,
      resolution_time: market.resolution_time,
      resolution_source: market.resolution_source,
      normalized_rules: market.normalized_rules,
      market_rules_hash: market.market_rules_hash,
      review_status: market.review_status,
      warnings: market.warnings,
      disqualifiers: market.disqualifiers,
      updated_at: new Date().toISOString(),
    }));
    const memberRows = payload.markets.map((market) => ({
      canonical_event_id: market.canonical_event_id,
      venue: 'polymarket',
      venue_market_id: market.venue_market_id,
      outcome_mapping: market.outcome_mapping,
      equivalence_score: market.equivalence_score,
      component_scores: {},
      warnings: market.warnings,
      disqualifiers: market.disqualifiers,
      review_state: market.review_status,
      reviewer_metadata: { publisher: 'polymarket-passport-worker/v1' },
      normalized_rule_hash: market.market_rules_hash,
      updated_at: new Date().toISOString(),
    }));
    await this.writeBatches('canonical_events', eventRows, 'canonical_event_id');
    await this.writeBatches('canonical_market_members', memberRows, 'venue,venue_market_id');
    await this.writeBatches('forecast_receipts', payload.receipts, 'receipt_id');
    await this.writeBatches('resolution_receipts', payload.resolutions, 'canonical_event_id,venue_market_id,evidence_hash');
    await this.writeBatches('topic_score_snapshots', payload.snapshots, 'subject_id,topic,subtopic,horizon,scoring_version,calculated_at');
    await this.writeBatches('underwriting_recommendations', [payload.underwriting], 'subject_id,policy_version,passport_root');

    const existingEpoch = await supabaseAdmin.from('passport_epochs').select('score_epoch')
      .eq('subject_id', subjectId).eq('passport_root', build.bundle.passportRoot).maybeSingle();
    if (existingEpoch.error) throw new PassportStoreError('The Passport database could not check its score epoch', 'PASSPORT_PUBLISH_FAILED', { cause: existingEpoch.error });
    let scoreEpoch = Number(existingEpoch.data?.score_epoch ?? 0);
    if (!scoreEpoch) {
      const latestEpoch = await supabaseAdmin.from('passport_epochs').select('score_epoch')
        .eq('subject_id', subjectId).order('score_epoch', { ascending: false }).limit(1).maybeSingle();
      if (latestEpoch.error) throw new PassportStoreError('The Passport database could not allocate a score epoch', 'PASSPORT_PUBLISH_FAILED', { cause: latestEpoch.error });
      scoreEpoch = Number(latestEpoch.data?.score_epoch ?? 0) + 1;
      const epochInsert = await supabaseAdmin.from('passport_epochs').insert({
        subject_id: subjectId,
        score_epoch: scoreEpoch,
        passport_root: build.bundle.passportRoot,
        evidence_root: build.bundle.evidenceRoot,
        cluster: 'offchain',
        program_id: null,
        published_at: build.bundle.generatedAt,
      });
      if (epochInsert.error) throw new PassportStoreError('The Passport database could not publish its score epoch', 'PASSPORT_PUBLISH_FAILED', { cause: epochInsert.error });
    }

    const compactBundle = {
      schemaVersion: build.bundle.schemaVersion,
      bundleVersion: build.bundle.bundleVersion,
      subjectId,
      evidenceRoot: build.bundle.evidenceRoot,
      passportRoot: build.bundle.passportRoot,
      scoringConfigHash: build.bundle.scoringConfigHash,
      policyConfigHash: build.bundle.policyConfigHash,
      generatedAt: build.bundle.generatedAt,
      storage: 'normalized-tables/v1',
    };
    const bundlePublish = await supabaseAdmin.from('passport_bundles').upsert({
      subject_id: subjectId,
      passport_root: build.bundle.passportRoot,
      evidence_root: build.bundle.evidenceRoot,
      bundle: compactBundle,
      report: build.report,
      published_at: build.bundle.generatedAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'subject_id' });
    if (bundlePublish.error) throw new PassportStoreError('The Passport database could not publish its manifest', 'PASSPORT_PUBLISH_FAILED', { cause: bundlePublish.error });

    const checkpoint = await supabaseAdmin.from('ingestion_checkpoints').upsert({
      adapter: 'polymarket-passport/v1',
      subject_id: subjectId,
      venue_account: wallet,
      checkpoint: build.bundle.generatedAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'adapter,subject_id,venue_account' });
    if (checkpoint.error) throw new PassportStoreError('The Passport database could not update its checkpoint', 'PASSPORT_PUBLISH_FAILED', { cause: checkpoint.error });
    const workerRun = await supabaseAdmin.from('passport_worker_runs').insert({
      subject_id: subjectId,
      venue: 'polymarket',
      venue_account: wallet,
      status: 'complete',
      report: build.report,
      started_at: build.bundle.generatedAt,
      finished_at: new Date().toISOString(),
    });
    if (workerRun.error) throw new PassportStoreError('The Passport database could not record the worker run', 'PASSPORT_PUBLISH_FAILED', { cause: workerRun.error });

    await this.cleanupSupersededRows(build);
    return { scoreEpoch };
  }
}
