import type { ForecastReceiptV1 } from '@beright/forecaster-scoring-engine';

export type AdapterAvailability =
  | { enabled: true }
  | { enabled: false; reason: string };

export class TemporaryProviderError extends Error {
  readonly retryable = true;
}

export class InvalidSourceRecordError extends Error {
  readonly retryable = false;
}

export interface EvidenceAdapter<SourceRecord> {
  readonly adapterId: string;
  readonly venue: string;
  getAvailability(): AdapterAvailability;
  normalize(record: SourceRecord): ForecastReceiptV1;
}

export interface ForecastReceiptStore {
  upsert(receipts: ForecastReceiptV1[], checkpoint: string | null, rawEvidence: Record<string, unknown>): Promise<{ inserted: number; existing: number }>;
}

export interface IngestionResult {
  adapterId: string;
  normalized: number;
  inserted: number;
  existing: number;
  checkpoint: string | null;
}
