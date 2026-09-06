import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ForecastReceiptV1 } from '@beright/forecaster-scoring-engine';
import { beRightEvidenceAdapter, polymarketEvidenceAdapter, solanaEvidenceAdapter } from './adapters';
import { ingestEvidenceRecords } from './ingestion';
import type { ForecastReceiptStore } from './types';

const common = {
  subjectId: 'subject-fixture', venueAccount: '0x1111111111111111111111111111111111111111', venueMarketId: 'market-1', canonicalEventId: null,
  predictedProbability: 0.62, direction: 'YES' as const, predictedAt: '2026-08-01T10:00:00.000Z', observedAt: '2026-08-01T10:05:00.000Z',
};

class MemoryReceiptStore implements ForecastReceiptStore {
  readonly receipts = new Map<string, ForecastReceiptV1>();
  async upsert(receipts: ForecastReceiptV1[]): Promise<{ inserted: number; existing: number }> {
    let inserted = 0;
    for (const receipt of receipts) { if (!this.receipts.has(receipt.receiptId)) inserted += 1; this.receipts.set(receipt.receiptId, receipt); }
    return { inserted, existing: receipts.length - inserted };
  }
}

test('normalizes all required evidence sources without conflating trades and forecasts', () => {
  const polymarket = polymarketEvidenceAdapter.normalize({ ...common, tradeId: 'trade-1', entryPrice: 0.62, positionSize: 100, finality: 'venue_final' });
  const solana = solanaEvidenceAdapter.normalize({ ...common, venueAccount: '11111111111111111111111111111111', venue: 'dflow', transactionSignature: 'sig-1', entryPrice: 0.41, positionSize: 50, finality: 'api_resolved' });
  const native = beRightEvidenceAdapter.normalize({ ...common, venueAccount: '11111111111111111111111111111111', predictionId: 'prediction-1', evidenceFinality: 'provisional' });
  assert.equal(polymarket.sourceType, 'trade'); assert.equal(solana.sourceType, 'trade'); assert.equal(native.sourceType, 'explicit_forecast');
  assert.equal(native.entryPrice, null); assert.equal(native.positionSize, null);
  assert.match(polymarket.venueTransactionReference ?? '', /^polymarket:/); assert.match(solana.venueTransactionReference ?? '', /^solana:/);
});

test('repeated imports are deterministic and idempotent', async () => {
  const record = { ...common, tradeId: 'trade-1', entryPrice: 0.62, positionSize: 100, finality: 'venue_final' as const };
  const store = new MemoryReceiptStore();
  const first = await ingestEvidenceRecords({ adapter: polymarketEvidenceAdapter, records: [record], store, checkpoint: 'cursor-1' });
  const second = await ingestEvidenceRecords({ adapter: polymarketEvidenceAdapter, records: [record], store, checkpoint: 'cursor-1' });
  assert.deepEqual([first.inserted, first.existing], [1, 0]); assert.deepEqual([second.inserted, second.existing], [0, 1]);
  assert.equal(store.receipts.size, 1);
});

test('invalid or unavailable source values are rejected instead of converted to zero', () => {
  assert.throws(() => polymarketEvidenceAdapter.normalize({ ...common, tradeId: 'trade-1', predictedProbability: undefined, entryPrice: 0.5, positionSize: 1 }));
  assert.throws(() => polymarketEvidenceAdapter.normalize({ ...common, tradeId: 'trade-1', predictedProbability: Number.NaN, entryPrice: 0.5, positionSize: 1 }));
});

test('Solana live adapter reports explicit configuration status', () => {
  const status = solanaEvidenceAdapter.getAvailability();
  assert.equal(typeof status.enabled, 'boolean');
  if (!status.enabled) assert.match(status.reason, /Configure/);
});
