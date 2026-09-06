import {
  REPUTATION_PROTOCOL_V1,
  TOPIC_SCORING_CONFIG_V1,
  UNDERWRITING_POLICY_V1,
  buildEvidenceMerkleTree,
  calculatePassportRootV1,
  calculateTopicScoreSnapshotsV1,
  calculateUnderwritingRecommendationV1,
  hashCanonicalJson,
  hashUnderwritingPolicyV1,
  replayEvidenceBundleV1,
  type CanonicalMarketV1,
  type EvidenceBundleV1,
  type ForecastReceiptV1,
  type ResolutionReceiptV1,
  type SubjectV1,
  type TopicScoringEvidenceV1,
  type TopicScoreSnapshotV1,
  type UnderwritingRecommendationV1,
} from '@beright/forecaster-scoring-engine';
import { buildForecastReceiptV1 } from '../evidence/receipt';
import {
  PolymarketClient,
  type PolymarketHistory,
  type PolymarketMarket,
  type PolymarketPosition,
  type PolymarketTrade,
} from './polymarketClient';
import { PassportStoreError, SupabasePolymarketPassportStore, type PolymarketPassportStore } from './polymarketStore';

type Topic = CanonicalMarketV1['topic'];
type Subtopic = CanonicalMarketV1['subtopic'];
type Horizon = CanonicalMarketV1['horizon'];

export interface PolymarketPassportBuild {
  subject: SubjectV1;
  receipts: ForecastReceiptV1[];
  rawEvidence: Record<string, unknown>;
  markets: CanonicalMarketV1[];
  resolutions: ResolutionReceiptV1[];
  snapshots: TopicScoreSnapshotV1[];
  underwriting: UnderwritingRecommendationV1;
  bundle: EvidenceBundleV1;
  report: {
    address: string;
    tradesFetched: number;
    positionsFetched: number;
    marketsReported: number | null;
    marketsCovered: number;
    receiptsCreated: number;
    resolvedReceipts: number;
    scoreVectors: number;
    completeHistory: boolean;
    importMode: 'complete' | 'bounded';
    fetchedAt: string;
  };
}

export interface PolymarketPassportWorkerOptions {
  client?: PolymarketClient;
  store?: PolymarketPassportStore;
  now?: () => Date;
}

function safeDate(value: string | number | null | undefined, fallback: Date): Date {
  const date = typeof value === 'number' ? new Date(value * 1000) : value ? new Date(value) : fallback;
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function parseJsonStrings(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function classifyTopic(text: string): { topic: Topic; subtopic: Subtopic } {
  const normalized = text.toLowerCase();
  if (/\b(bitcoin|btc)\b/.test(normalized)) return { topic: 'crypto', subtopic: 'bitcoin' };
  if (/\b(ethereum|ether|eth)\b/.test(normalized)) return { topic: 'crypto', subtopic: 'ethereum' };
  if (/\b(solana|sol)\b/.test(normalized)) return { topic: 'crypto', subtopic: 'solana' };
  if (/\b(crypto|cryptocurrency|token|blockchain|defi|stablecoin)\b/.test(normalized)) return { topic: 'crypto', subtopic: 'other_crypto' };
  if (/\b(fed|federal reserve|interest rate|rate cut|rate hike|treasury yield)\b/.test(normalized)) return { topic: 'macro', subtopic: 'rates' };
  if (/\b(inflation|cpi|pce|consumer prices)\b/.test(normalized)) return { topic: 'macro', subtopic: 'inflation' };
  if (/\b(employment|unemployment|jobs|payroll)\b/.test(normalized)) return { topic: 'macro', subtopic: 'employment' };
  if (/\b(gdp|recession|economic growth|economy)\b/.test(normalized)) return { topic: 'macro', subtopic: 'growth' };
  if (/\b(s&p|nasdaq|dow|stock market|equities|market cap)\b/.test(normalized)) return { topic: 'macro', subtopic: 'markets' };
  return { topic: 'other', subtopic: 'uncategorized' };
}

function classifyHorizon(predictedAt: Date, resolvesAt: Date): Horizon {
  const days = Math.max(0, (resolvesAt.getTime() - predictedAt.getTime()) / 86_400_000);
  if (days < 1) return 'intraday';
  if (days <= 7) return 'one_to_seven_days';
  if (days <= 30) return 'eight_to_thirty_days';
  if (days <= 90) return 'thirty_one_to_ninety_days';
  return 'over_ninety_days';
}

function marketResolution(market: PolymarketMarket | undefined, position: PolymarketPosition): 'YES' | 'NO' | null {
  const prices = parseJsonStrings(market?.outcomePrices).map(Number);
  if (prices.length >= 2 && prices.every((price) => price === 0 || price === 1)) return prices[0] === 1 ? 'YES' : 'NO';
  if (position.curPrice !== 0 && position.curPrice !== 1) return null;
  const selectedOutcomeWon = position.curPrice === 1;
  return position.outcomeIndex === 0 ? (selectedOutcomeWon ? 'YES' : 'NO') : (selectedOutcomeWon ? 'NO' : 'YES');
}

function earliestTradeByPosition(trades: PolymarketTrade[]): Map<string, PolymarketTrade> {
  const earliest = new Map<string, PolymarketTrade>();
  for (const trade of trades) {
    const key = `${trade.conditionId.toLowerCase()}/${trade.asset}`;
    const current = earliest.get(key);
    if (!current || trade.timestamp < current.timestamp) earliest.set(key, trade);
  }
  return earliest;
}

function uniquePositions(history: PolymarketHistory): PolymarketPosition[] {
  const positions = new Map<string, PolymarketPosition>();
  for (const position of history.currentPositions) positions.set(`${position.conditionId.toLowerCase()}/${position.asset}`, position);
  for (const position of history.closedPositions) positions.set(`${position.conditionId.toLowerCase()}/${position.asset}`, position);
  return [...positions.values()].filter((position) => position.outcomeIndex === 0 || position.outcomeIndex === 1);
}

export function buildPolymarketPassport(history: PolymarketHistory, now = new Date()): PolymarketPassportBuild {
  const address = history.address.toLowerCase();
  const subjectId = `polymarket:${address}`;
  const displayName = history.profile?.name?.trim() || history.profile?.pseudonym?.trim() || `${address.slice(0, 6)}…${address.slice(-4)}`;
  const createdAt = safeDate(history.profile?.createdAt, now).toISOString();
  const subject: SubjectV1 = {
    schemaVersion: REPUTATION_PROTOCOL_V1,
    subjectId,
    subjectType: 'human',
    primaryWallet: address,
    walletChain: 'ethereum',
    displayName,
    identityStatus: 'unverified',
    createdAt,
    updatedAt: now.toISOString(),
  };

  const marketMetadata = new Map(history.markets.map((market) => [market.conditionId.toLowerCase(), market]));
  const firstTrades = earliestTradeByPosition(history.trades);
  const positions = uniquePositions(history);
  const coveredConditions = new Set(positions.map((position) => position.conditionId.toLowerCase()));
  const importMode = history.importMode ?? 'complete';
  const completeHistory = importMode === 'complete'
    && (history.reportedMarketCount === null || coveredConditions.size >= history.reportedMarketCount);
  const rawEvidence: Record<string, unknown> = {};
  const receipts: ForecastReceiptV1[] = [];
  const marketByEvent = new Map<string, CanonicalMarketV1>();
  const resolutionByEvent = new Map<string, ResolutionReceiptV1>();
  const scoringMetadata: EvidenceBundleV1['evidenceMetadata'] = {};

  for (const position of positions) {
    const conditionId = position.conditionId.toLowerCase();
    const positionKey = `${conditionId}/${position.asset}`;
    const market = marketMetadata.get(conditionId);
    const firstTrade = firstTrades.get(positionKey);
    const closeTime = safeDate(market?.endDate ?? position.endDate, now);
    const predictedAt = safeDate(firstTrade?.timestamp ?? position.timestamp, safeDate(market?.startDate, closeTime));
    const startTime = safeDate(market?.startDate, predictedAt);
    const resolutionTime = safeDate(market?.closedTime ?? market?.umaEndDate ?? market?.endDate ?? position.endDate, closeTime);
    const title = market?.question?.trim() || position.title.trim() || position.slug;
    const rules = market?.description?.trim() || title;
    const taxonomy = classifyTopic(`${title} ${rules} ${market?.category ?? ''}`);
    const canonicalMarket: CanonicalMarketV1 = {
      schemaVersion: REPUTATION_PROTOCOL_V1,
      canonicalEventId: conditionId,
      title,
      topic: taxonomy.topic,
      subtopic: taxonomy.subtopic,
      horizon: classifyHorizon(predictedAt, closeTime),
      outcomeType: 'binary',
      venueMarketId: conditionId,
      venue: 'polymarket',
      outcomeMapping: { YES: parseJsonStrings(market?.outcomes)[0] ?? position.outcome, NO: parseJsonStrings(market?.outcomes)[1] ?? position.oppositeOutcome },
      openTime: startTime.toISOString(),
      closeTime: closeTime.toISOString(),
      resolutionTime: marketResolution(market, position) ? resolutionTime.toISOString() : null,
      resolutionSource: market?.resolutionSource?.trim() || 'Polymarket Data API',
      normalizedRules: rules,
      marketRulesHash: hashCanonicalJson({ conditionId, rules, outcomes: parseJsonStrings(market?.outcomes) }),
      equivalenceConfidence: 1,
      reviewStatus: 'exact_equivalent',
      warnings: market ? [] : ['gamma-market-metadata-unavailable'],
      disqualifiers: [],
    };
    marketByEvent.set(conditionId, canonicalMarket);

    const predictedProbability = position.outcomeIndex === 0 ? position.avgPrice : 1 - position.avgPrice;
    const sourceReference = { source: 'polymarket-public-position/v1', position, market: market ?? null, firstTrade: firstTrade ?? null };
    const outcome = marketResolution(market, position);
    const receipt = buildForecastReceiptV1({
      subjectId,
      sourceType: 'trade',
      venue: 'polymarket',
      venueAccount: address,
      venueMarketId: conditionId,
      canonicalEventId: conditionId,
      predictedProbability,
      direction: position.outcomeIndex === 0 ? 'YES' : 'NO',
      predictedAt: predictedAt.toISOString(),
      entryPrice: predictedProbability,
      positionSize: position.totalBought,
      venueTransactionReference: `polymarket-position:${position.asset}`,
      observedAt: history.fetchedAt,
      evidenceFinality: outcome ? 'venue_final' : position.redeemable ? 'redeemable' : 'unresolved',
      sourceReference,
    });
    receipts.push(receipt);
    rawEvidence[receipt.receiptId] = sourceReference;
    const marketDuration = Math.max(1, closeTime.getTime() - startTime.getTime());
    scoringMetadata[receipt.receiptId] = {
      correlationGroup: conditionId,
      lateEntry: closeTime.getTime() - predictedAt.getTime() <= Math.max(21_600_000, marketDuration * 0.05),
      easyMarket: predictedProbability < 0.05 || predictedProbability > 0.95,
      selectiveImportRisk: !completeHistory,
      marketMakerActivity: false,
    };

    if (outcome) {
      const resolutionEvidence = {
        source: 'polymarket-public-resolution/v1', conditionId, outcome,
        outcomePrices: parseJsonStrings(market?.outcomePrices), curPrice: position.curPrice,
        closedTime: market?.closedTime ?? null, umaResolutionStatus: market?.umaResolutionStatus ?? null,
      };
      resolutionByEvent.set(conditionId, {
        schemaVersion: REPUTATION_PROTOCOL_V1,
        canonicalEventId: conditionId,
        venueMarketId: conditionId,
        outcome,
        finality: 'venue_final',
        resolutionSource: market?.resolutionSource?.trim() || 'Polymarket Data API',
        resolvedAt: resolutionTime.toISOString(),
        evidenceHash: hashCanonicalJson(resolutionEvidence),
        disputeStatus: market?.umaResolutionStatus && market.umaResolutionStatus !== 'resolved' ? 'pending' : 'none',
        observedAt: history.fetchedAt,
      });
    }
  }

  const markets = [...marketByEvent.values()].sort((left, right) => left.canonicalEventId.localeCompare(right.canonicalEventId));
  const resolutions = [...resolutionByEvent.values()].sort((left, right) => left.canonicalEventId.localeCompare(right.canonicalEventId));
  const resolutionMap = new Map(resolutions.map((resolution) => [resolution.canonicalEventId, resolution]));
  const marketMap = new Map(markets.map((market) => [market.canonicalEventId, market]));
  const evidence: TopicScoringEvidenceV1[] = receipts.map((receipt) => ({
    receipt,
    market: marketMap.get(receipt.canonicalEventId as string) as CanonicalMarketV1,
    resolution: resolutionMap.get(receipt.canonicalEventId as string) ?? null,
    contemporaneousMarketProbability: receipt.entryPrice,
    origin: 'imported',
    ...scoringMetadata[receipt.receiptId],
  }));
  const snapshots = calculateTopicScoreSnapshotsV1({ subjectId, evidence, now });
  const evidenceRoot = buildEvidenceMerkleTree(receipts).root;
  const preUnderwritingRoot = calculatePassportRootV1({ subject, evidenceRoot, snapshots, underwriting: null });
  const underwritingInputs = { importedOnly: true, drawdownFactor: 0, liquidityFactor: 0, allowedVenues: ['polymarket'] };
  const underwriting = calculateUnderwritingRecommendationV1({ subjectId, snapshots, passportRoot: preUnderwritingRoot, inputs: underwritingInputs, now });
  const passportRoot = calculatePassportRootV1({ subject, evidenceRoot, snapshots, underwriting });
  const bundle: EvidenceBundleV1 = {
    schemaVersion: REPUTATION_PROTOCOL_V1,
    bundleVersion: 'evidence-bundle/v1',
    subject,
    receipts,
    rawEvidence,
    canonicalMarkets: markets,
    resolutions,
    contemporaneousMarketProbabilities: Object.fromEntries(receipts.map((receipt) => [receipt.receiptId, receipt.entryPrice])),
    evidenceMetadata: scoringMetadata,
    evidenceRoot,
    topicSnapshots: snapshots,
    underwriting,
    underwritingInputs,
    scoringConfigHash: hashCanonicalJson(TOPIC_SCORING_CONFIG_V1),
    policyConfigHash: hashUnderwritingPolicyV1(UNDERWRITING_POLICY_V1),
    generatedAt: now.toISOString(),
    passportRoot,
  };
  return {
    subject, receipts, rawEvidence, markets, resolutions, snapshots, underwriting, bundle,
    report: {
      address,
      tradesFetched: history.trades.length,
      positionsFetched: positions.length,
      marketsReported: history.reportedMarketCount,
      marketsCovered: coveredConditions.size,
      receiptsCreated: receipts.length,
      resolvedReceipts: receipts.filter((receipt) => receipt.evidenceFinality === 'venue_final').length,
      scoreVectors: snapshots.length,
      completeHistory,
      importMode,
      fetchedAt: history.fetchedAt,
    },
  };
}

export class PolymarketPassportWorker {
  private readonly client: PolymarketClient;
  private readonly store: PolymarketPassportStore;
  private readonly now: () => Date;

  constructor(options: PolymarketPassportWorkerOptions = {}) {
    this.client = options.client ?? new PolymarketClient();
    this.store = options.store ?? new SupabasePolymarketPassportStore();
    this.now = options.now ?? (() => new Date());
  }

  async run(address: string): Promise<PolymarketPassportBuild> {
    const history = await this.client.fetchHistory(address);
    const build = buildPolymarketPassport(history, this.now());
    const verification = replayEvidenceBundleV1(build.bundle);
    if (!verification.valid) {
      throw new Error(`Generated Passport failed replay verification: ${verification.errors.join('; ')}`);
    }
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await this.store.persist(build);
        return build;
      } catch (error) {
        if (!(error instanceof PassportStoreError) || attempt === 2) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1_000 * 2 ** attempt));
      }
    }
    return build;
  }
}
