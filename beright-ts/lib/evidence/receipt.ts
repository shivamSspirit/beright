import {
  forecastReceiptV1Schema,
  hashCanonicalJson,
  REPUTATION_PROTOCOL_V1,
  type ForecastReceiptV1,
} from '@beright/forecaster-scoring-engine';

export interface NormalizedReceiptInput extends Omit<ForecastReceiptV1, 'schemaVersion' | 'receiptId' | 'rawEvidenceHash' | 'ingestionVersion'> {
  sourceReference: unknown;
}

export function buildForecastReceiptV1(input: NormalizedReceiptInput): ForecastReceiptV1 {
  const rawEvidenceHash = hashCanonicalJson(input.sourceReference);
  const receiptId = `fr_${hashCanonicalJson({
    subjectId: input.subjectId,
    venue: input.venue,
    venueAccount: input.venueAccount,
    venueMarketId: input.venueMarketId,
    sourceType: input.sourceType,
    predictedAt: input.predictedAt,
    venueTransactionReference: input.venueTransactionReference,
    rawEvidenceHash,
    ingestionVersion: 'v1',
  })}`;
  const { sourceReference: _sourceReference, ...receiptFields } = input;
  return forecastReceiptV1Schema.parse({
    schemaVersion: REPUTATION_PROTOCOL_V1,
    receiptId,
    ...receiptFields,
    rawEvidenceHash,
    ingestionVersion: 'v1',
  });
}
