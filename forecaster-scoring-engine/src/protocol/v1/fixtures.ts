import { hashCanonicalJson } from './canonical';
import {
  CanonicalMarketV1,
  ForecastReceiptV1,
  REPUTATION_PROTOCOL_V1,
  ResolutionReceiptV1,
} from './schemas';

const observedAt = '2026-08-01T12:00:00.000Z';
const evidenceHash = (label: string): string => hashCanonicalJson({ fixture: true, label });

export const polymarketReceiptFixture: ForecastReceiptV1 = {
  schemaVersion: REPUTATION_PROTOCOL_V1,
  receiptId: 'receipt-polymarket-btc-001',
  subjectId: 'subject-fixture-001',
  sourceType: 'trade',
  venue: 'polymarket',
  venueAccount: '0x1111111111111111111111111111111111111111',
  venueMarketId: 'poly-btc-100k-august',
  canonicalEventId: 'event-btc-100k-august',
  predictedProbability: 0.62,
  direction: 'YES',
  predictedAt: '2026-07-20T10:00:00.000Z',
  entryPrice: 0.62,
  positionSize: 250,
  venueTransactionReference: 'polymarket-api:fixture-trade-001',
  rawEvidenceHash: evidenceHash('polymarket-trade-001'),
  ingestionVersion: 'v1',
  observedAt,
  evidenceFinality: 'venue_final',
};

export const solanaNativeReceiptFixture: ForecastReceiptV1 = {
  schemaVersion: REPUTATION_PROTOCOL_V1,
  receiptId: 'receipt-solana-sol-001',
  subjectId: 'subject-fixture-001',
  sourceType: 'trade',
  venue: 'dflow',
  venueAccount: '11111111111111111111111111111111',
  venueMarketId: 'dflow-sol-250-august',
  canonicalEventId: 'event-sol-250-august',
  predictedProbability: 0.41,
  direction: 'YES',
  predictedAt: '2026-07-22T10:00:00.000Z',
  entryPrice: 0.41,
  positionSize: 125,
  venueTransactionReference: 'solana:fixture-signature-001',
  rawEvidenceHash: evidenceHash('solana-trade-001'),
  ingestionVersion: 'v1',
  observedAt,
  evidenceFinality: 'api_resolved',
};

export const beRightNativeReceiptFixture: ForecastReceiptV1 = {
  schemaVersion: REPUTATION_PROTOCOL_V1,
  receiptId: 'receipt-beright-fed-001',
  subjectId: 'subject-fixture-001',
  sourceType: 'explicit_forecast',
  venue: 'beright',
  venueAccount: '11111111111111111111111111111111',
  venueMarketId: 'beright-fed-cut-september',
  canonicalEventId: 'event-fed-cut-september',
  predictedProbability: 0.58,
  direction: 'YES',
  predictedAt: '2026-07-25T10:00:00.000Z',
  entryPrice: null,
  positionSize: null,
  venueTransactionReference: 'beright:fixture-prediction-001',
  rawEvidenceHash: evidenceHash('beright-forecast-001'),
  ingestionVersion: 'v1',
  observedAt,
  evidenceFinality: 'provisional',
};

export const resolvedCanonicalEventFixture: CanonicalMarketV1 = {
  schemaVersion: REPUTATION_PROTOCOL_V1,
  canonicalEventId: 'event-btc-100k-august',
  title: 'Will Bitcoin trade at or above $100,000 by August 31, 2026?',
  topic: 'crypto',
  subtopic: 'bitcoin',
  horizon: 'thirty_one_to_ninety_days',
  outcomeType: 'binary',
  venueMarketId: 'poly-btc-100k-august',
  venue: 'polymarket',
  outcomeMapping: { NO: 'NO', YES: 'YES' },
  openTime: '2026-06-01T00:00:00.000Z',
  closeTime: '2026-08-31T23:59:59.000Z',
  resolutionTime: '2026-08-31T23:59:59.000Z',
  resolutionSource: 'Coinbase BTC-USD published price',
  normalizedRules: 'resolves yes if coinbase btc-usd trades at or above 100000 usd before deadline',
  marketRulesHash: evidenceHash('btc-rules-v1'),
  equivalenceConfidence: 1,
  reviewStatus: 'exact_equivalent',
  warnings: [],
  disqualifiers: [],
};

export const unresolvedCanonicalEventFixture: CanonicalMarketV1 = {
  ...resolvedCanonicalEventFixture,
  canonicalEventId: 'event-sol-250-august',
  title: 'Will SOL trade at or above $250 by August 31, 2026?',
  subtopic: 'solana',
  venueMarketId: 'dflow-sol-250-august',
  venue: 'dflow',
  resolutionTime: null,
  resolutionSource: 'DFlow market resolution API',
  normalizedRules: 'resolves yes if sol-usd trades at or above 250 usd before deadline',
  marketRulesHash: evidenceHash('sol-rules-v1'),
  equivalenceConfidence: 0.93,
};

export const disputedResolutionFixture: ResolutionReceiptV1 = {
  schemaVersion: REPUTATION_PROTOCOL_V1,
  canonicalEventId: 'event-fed-cut-september',
  venueMarketId: 'beright-fed-cut-september',
  outcome: 'YES',
  finality: 'disputed',
  resolutionSource: 'Federal Reserve published target range',
  resolvedAt: '2026-08-20T18:00:00.000Z',
  evidenceHash: evidenceHash('fed-dispute-evidence'),
  disputeStatus: 'disputed',
  observedAt,
};
