import { z } from 'zod';
import { buildForecastReceiptV1 } from './receipt';
import type { EvidenceAdapter } from './types';

const common = {
  subjectId: z.string().min(1), venueAccount: z.string().min(1), venueMarketId: z.string().min(1),
  canonicalEventId: z.string().min(1).nullable().default(null), predictedProbability: z.number().min(0).max(1),
  direction: z.enum(['YES', 'NO']), predictedAt: z.string().datetime({ offset: true }),
  observedAt: z.string().datetime({ offset: true }),
};

export const polymarketSourceRecordSchema = z.object({
  ...common, tradeId: z.string().min(1), entryPrice: z.number().min(0).max(1), positionSize: z.number().nonnegative(),
  finality: z.enum(['venue_final', 'api_resolved', 'provisional', 'disputed', 'unresolved']).default('unresolved'),
}).strict();
export type PolymarketSourceRecord = z.infer<typeof polymarketSourceRecordSchema>;

export const solanaSourceRecordSchema = z.object({
  ...common, venue: z.enum(['dflow', 'jupiter']), transactionSignature: z.string().min(1),
  entryPrice: z.number().min(0).max(1), positionSize: z.number().nonnegative(),
  finality: z.enum(['oracle_final', 'redeemable', 'api_resolved', 'provisional', 'disputed', 'unresolved']).default('unresolved'),
}).strict();
export type SolanaSourceRecord = z.infer<typeof solanaSourceRecordSchema>;

export const beRightSourceRecordSchema = z.object({
  ...common, predictionId: z.string().min(1), evidenceFinality: z.enum(['oracle_final', 'api_resolved', 'provisional', 'disputed', 'unresolved']),
}).strict();
export type BeRightSourceRecord = z.infer<typeof beRightSourceRecordSchema>;

export const polymarketEvidenceAdapter: EvidenceAdapter<PolymarketSourceRecord> = {
  adapterId: 'polymarket/v1', venue: 'polymarket', getAvailability: () => ({ enabled: true }),
  normalize(raw) {
    const record = polymarketSourceRecordSchema.parse(raw);
    return buildForecastReceiptV1({
      subjectId: record.subjectId, sourceType: 'trade', venue: 'polymarket', venueAccount: record.venueAccount.toLowerCase(),
      venueMarketId: record.venueMarketId, canonicalEventId: record.canonicalEventId, predictedProbability: record.predictedProbability,
      direction: record.direction, predictedAt: record.predictedAt, entryPrice: record.entryPrice, positionSize: record.positionSize,
      venueTransactionReference: `polymarket:${record.tradeId}`, observedAt: record.observedAt, evidenceFinality: record.finality,
      sourceReference: record,
    });
  },
};

export const solanaEvidenceAdapter: EvidenceAdapter<SolanaSourceRecord> = {
  adapterId: 'solana-public-activity/v1', venue: 'solana',
  getAvailability: () => process.env.DFLOW_API_KEY || process.env.HELIUS_API_KEY || process.env.SOLANA_RPC_URL
    ? { enabled: true } : { enabled: false, reason: 'Configure DFLOW_API_KEY, HELIUS_API_KEY, or SOLANA_RPC_URL for live public activity ingestion' },
  normalize(raw) {
    const record = solanaSourceRecordSchema.parse(raw);
    return buildForecastReceiptV1({
      subjectId: record.subjectId, sourceType: 'trade', venue: record.venue, venueAccount: record.venueAccount,
      venueMarketId: record.venueMarketId, canonicalEventId: record.canonicalEventId, predictedProbability: record.predictedProbability,
      direction: record.direction, predictedAt: record.predictedAt, entryPrice: record.entryPrice, positionSize: record.positionSize,
      venueTransactionReference: `solana:${record.transactionSignature}`, observedAt: record.observedAt, evidenceFinality: record.finality,
      sourceReference: record,
    });
  },
};

export const beRightEvidenceAdapter: EvidenceAdapter<BeRightSourceRecord> = {
  adapterId: 'beright-native/v1', venue: 'beright', getAvailability: () => ({ enabled: true }),
  normalize(raw) {
    const record = beRightSourceRecordSchema.parse(raw);
    return buildForecastReceiptV1({
      subjectId: record.subjectId, sourceType: 'explicit_forecast', venue: 'beright', venueAccount: record.venueAccount,
      venueMarketId: record.venueMarketId, canonicalEventId: record.canonicalEventId, predictedProbability: record.predictedProbability,
      direction: record.direction, predictedAt: record.predictedAt, entryPrice: null, positionSize: null,
      venueTransactionReference: `beright:${record.predictionId}`, observedAt: record.observedAt,
      evidenceFinality: record.evidenceFinality, sourceReference: record,
    });
  },
};
