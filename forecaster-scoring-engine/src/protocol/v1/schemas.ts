import { z } from 'zod';

export const REPUTATION_PROTOCOL_V1 = 'reputation-protocol/v1' as const;

const isoTimestamp = z.string().datetime({ offset: true });
const hash256 = z.string().regex(/^[a-f0-9]{64}$/);
const identifier = z.string().min(1).max(256);
const nullableTimestamp = isoTimestamp.nullable();

const versioned = {
  schemaVersion: z.literal(REPUTATION_PROTOCOL_V1),
};

export const subjectV1Schema = z.object({
  ...versioned,
  subjectId: identifier,
  subjectType: z.enum(['human', 'agent']),
  primaryWallet: z.string().min(32).max(64),
  walletChain: z.enum(['ethereum', 'solana']),
  displayName: z.string().min(1).max(120),
  identityStatus: z.enum(['unverified', 'verified', 'restricted', 'revoked']),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
}).strict();

export const venueClaimV1Schema = z.object({
  ...versioned,
  claimId: identifier,
  subjectId: identifier,
  venue: identifier,
  venueAccount: identifier,
  proofType: z.enum(['dual_wallet_signature', 'profile_code']),
  challengeHash: hash256,
  verifiedAt: isoTimestamp,
  expiresAt: nullableTimestamp,
  revokedAt: nullableTimestamp,
  verificationVersion: z.literal('v1'),
  metadataHash: hash256,
}).strict();

export const forecastReceiptV1Schema = z.object({
  ...versioned,
  receiptId: identifier,
  subjectId: identifier,
  sourceType: z.enum(['trade', 'explicit_forecast']),
  venue: identifier,
  venueAccount: identifier,
  venueMarketId: identifier,
  canonicalEventId: identifier.nullable(),
  predictedProbability: z.number().finite().min(0).max(1),
  direction: z.enum(['YES', 'NO']),
  predictedAt: isoTimestamp,
  entryPrice: z.number().finite().min(0).max(1).nullable(),
  positionSize: z.number().finite().nonnegative().nullable(),
  venueTransactionReference: z.string().min(1).max(512).nullable(),
  rawEvidenceHash: hash256,
  ingestionVersion: z.literal('v1'),
  observedAt: isoTimestamp,
  evidenceFinality: z.enum([
    'venue_final',
    'oracle_final',
    'redeemable',
    'api_resolved',
    'provisional',
    'disputed',
    'unresolved',
    'unknown',
  ]),
}).strict().superRefine((receipt, context) => {
  if (receipt.sourceType === 'trade' && receipt.entryPrice === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['entryPrice'], message: 'Trade receipts require entryPrice' });
  }
  if (receipt.sourceType === 'explicit_forecast' && (receipt.entryPrice !== null || receipt.positionSize !== null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['sourceType'], message: 'Explicit forecasts cannot carry trade economics' });
  }
});

export const canonicalMarketV1Schema = z.object({
  ...versioned,
  canonicalEventId: identifier,
  title: z.string().min(1).max(1000),
  topic: z.enum(['crypto', 'macro', 'other']),
  subtopic: z.enum([
    'bitcoin', 'ethereum', 'solana', 'other_crypto',
    'rates', 'inflation', 'employment', 'growth', 'markets',
    'uncategorized',
  ]),
  horizon: z.enum([
    'intraday',
    'one_to_seven_days',
    'eight_to_thirty_days',
    'thirty_one_to_ninety_days',
    'over_ninety_days',
  ]),
  outcomeType: z.enum(['binary', 'multiple_choice', 'scalar']),
  venueMarketId: identifier,
  venue: identifier,
  outcomeMapping: z.record(z.string(), z.string()),
  openTime: isoTimestamp,
  closeTime: isoTimestamp,
  resolutionTime: nullableTimestamp,
  resolutionSource: z.string().min(1).max(512),
  normalizedRules: z.string().min(1).max(10_000),
  marketRulesHash: hash256,
  equivalenceConfidence: z.number().finite().min(0).max(1),
  reviewStatus: z.enum(['exact_equivalent', 'related_not_equivalent', 'ambiguous_requires_review', 'rejected']),
  warnings: z.array(z.string().max(500)).max(50),
  disqualifiers: z.array(z.string().max(500)).max(50),
}).strict();

export const resolutionReceiptV1Schema = z.object({
  ...versioned,
  canonicalEventId: identifier,
  venueMarketId: identifier,
  outcome: z.string().min(1).max(256),
  finality: z.enum(['venue_final', 'oracle_final', 'redeemable', 'api_resolved', 'provisional', 'disputed']),
  resolutionSource: z.string().min(1).max(512),
  resolvedAt: isoTimestamp,
  evidenceHash: hash256,
  disputeStatus: z.enum(['none', 'pending', 'disputed', 'resolved']),
  observedAt: isoTimestamp,
}).strict();

export const topicScoreSnapshotV1Schema = z.object({
  ...versioned,
  subjectId: identifier,
  topic: canonicalMarketV1Schema.shape.topic,
  subtopic: canonicalMarketV1Schema.shape.subtopic,
  horizon: canonicalMarketV1Schema.shape.horizon,
  score: z.number().int().min(0).max(1000),
  brierQuality: z.number().finite().min(0).max(1),
  logQuality: z.number().finite().min(0).max(1),
  calibrationQuality: z.number().finite().min(0).max(1),
  marketAlpha: z.number().finite().min(-1).max(1),
  consistencyQuality: z.number().finite().min(0).max(1),
  resolvedCount: z.number().int().nonnegative(),
  effectiveSampleSize: z.number().finite().nonnegative(),
  confidence: z.number().finite().min(0).max(1),
  evidenceQuality: z.number().finite().min(0).max(1),
  penaltyMultiplier: z.number().finite().min(0).max(1),
  penaltyFlags: z.array(z.string().max(100)).max(50),
  dataWindowStart: isoTimestamp,
  dataWindowEnd: isoTimestamp,
  scoringVersion: z.literal('topic-scoring/v1'),
  scoringCodeHash: hash256,
  evidenceRoot: hash256,
  calculatedAt: isoTimestamp,
  status: z.enum(['Unproven', 'Provisional', 'Verified', 'Advanced', 'Restricted']),
}).strict();

export const underwritingRecommendationV1Schema = z.object({
  ...versioned,
  subjectId: identifier,
  eligibility: z.enum(['eligible', 'ineligible']),
  maximumActiveCapitalUsd: z.number().finite().nonnegative(),
  maximumMarketExposureBps: z.number().int().min(0).max(10_000),
  maximumTopicExposureBps: z.number().int().min(0).max(10_000),
  allowedTopics: z.array(canonicalMarketV1Schema.shape.topic),
  allowedVenues: z.array(identifier),
  probationary: z.boolean(),
  expiresAt: isoTimestamp,
  reasonCodes: z.array(z.string().min(1).max(100)),
  passportRoot: hash256,
  policyVersion: z.literal('underwriting-policy/v1'),
  calculatedAt: isoTimestamp,
}).strict().superRefine((recommendation, context) => {
  if (recommendation.eligibility === 'ineligible' && recommendation.maximumActiveCapitalUsd !== 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['maximumActiveCapitalUsd'], message: 'Ineligible recommendations must have zero capital' });
  }
});

export type SubjectV1 = z.infer<typeof subjectV1Schema>;
export type VenueClaimV1 = z.infer<typeof venueClaimV1Schema>;
export type ForecastReceiptV1 = z.infer<typeof forecastReceiptV1Schema>;
export type CanonicalMarketV1 = z.infer<typeof canonicalMarketV1Schema>;
export type ResolutionReceiptV1 = z.infer<typeof resolutionReceiptV1Schema>;
export type TopicScoreSnapshotV1 = z.infer<typeof topicScoreSnapshotV1Schema>;
export type UnderwritingRecommendationV1 = z.infer<typeof underwritingRecommendationV1Schema>;

export function assertReputationProtocolV1(value: unknown): asserts value is { schemaVersion: typeof REPUTATION_PROTOCOL_V1 } {
  const result = z.object({ schemaVersion: z.literal(REPUTATION_PROTOCOL_V1) }).passthrough().safeParse(value);
  if (!result.success) {
    throw new Error(`Unsupported reputation protocol schema: ${result.error.issues[0]?.message ?? 'missing schemaVersion'}`);
  }
}
