import { supabaseAdmin } from '../supabase/client';
import type { ForecastReceiptV1 } from '@beright/forecaster-scoring-engine';
import type { EvidenceAdapter, ForecastReceiptStore, IngestionResult } from './types';

export class SupabaseForecastReceiptStore implements ForecastReceiptStore {
  constructor(private readonly subjectId: string, private readonly adapterId: string, private readonly venueAccount: string) {}

  async upsert(receipts: ForecastReceiptV1[], checkpoint: string | null, rawEvidence: Record<string, unknown>): Promise<{ inserted: number; existing: number }> {
    if (receipts.length === 0) return { inserted: 0, existing: 0 };
    const rows = receipts.map((receipt) => ({
      receipt_id: receipt.receiptId, subject_id: receipt.subjectId, source_type: receipt.sourceType, venue: receipt.venue,
      venue_account: receipt.venueAccount, venue_market_id: receipt.venueMarketId, canonical_event_id: receipt.canonicalEventId,
      predicted_probability: receipt.predictedProbability, direction: receipt.direction, predicted_at: receipt.predictedAt,
      entry_price: receipt.entryPrice, position_size: receipt.positionSize, venue_transaction_reference: receipt.venueTransactionReference,
      raw_evidence_hash: receipt.rawEvidenceHash, ingestion_version: receipt.ingestionVersion, observed_at: receipt.observedAt,
      evidence_finality: receipt.evidenceFinality, source_checkpoint: checkpoint,
      source_evidence: rawEvidence[receipt.receiptId],
      scoring_metadata: { origin: receipt.venue === 'beright' ? 'native' : 'imported', contemporaneousMarketProbability: null },
    }));
    const { data, error } = await supabaseAdmin.from('forecast_receipts').upsert(rows, { onConflict: 'receipt_id', ignoreDuplicates: true }).select('receipt_id');
    if (error) throw new Error('Unable to persist forecast receipts');
    if (checkpoint !== null) {
      const { error: checkpointError } = await supabaseAdmin.from('ingestion_checkpoints').upsert({
        adapter: this.adapterId, subject_id: this.subjectId, venue_account: this.venueAccount, checkpoint, updated_at: new Date().toISOString(),
      }, { onConflict: 'adapter,subject_id,venue_account' });
      if (checkpointError) throw new Error('Unable to persist ingestion checkpoint');
    }
    const inserted = data?.length ?? 0;
    return { inserted, existing: receipts.length - inserted };
  }
}

export async function ingestEvidenceRecords<SourceRecord>(input: {
  adapter: EvidenceAdapter<SourceRecord>; records: SourceRecord[]; store: ForecastReceiptStore; checkpoint?: string | null;
}): Promise<IngestionResult> {
  const availability = input.adapter.getAvailability();
  if (!availability.enabled) throw new Error(`ADAPTER_DISABLED: ${availability.reason}`);
  const receipts = input.records.map((record) => input.adapter.normalize(record));
  const rawEvidence = Object.fromEntries(receipts.map((receipt, index) => [receipt.receiptId, input.records[index]]));
  const persisted = await input.store.upsert(receipts, input.checkpoint ?? null, rawEvidence);
  return { adapterId: input.adapter.adapterId, normalized: receipts.length, ...persisted, checkpoint: input.checkpoint ?? null };
}
