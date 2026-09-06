import {
  REPUTATION_PROTOCOL_V1,
  topicScoreSnapshotV1Schema,
  type CanonicalMarketV1,
  type ForecastReceiptV1,
  type ResolutionReceiptV1,
  type TopicScoreSnapshotV1,
} from '../protocol/v1/schemas';
import { hashCanonicalJson } from '../protocol/v1/canonical';
import { buildEvidenceMerkleTree } from './merkle';
import { TOPIC_SCORING_CONFIG_V1, type TopicScoringConfigV1 } from './config';

export interface TopicScoringEvidenceV1 {
  receipt: ForecastReceiptV1;
  market: CanonicalMarketV1;
  resolution: ResolutionReceiptV1 | null;
  contemporaneousMarketProbability: number | null;
  origin: 'imported' | 'native';
  correlationGroup?: string;
  lateEntry?: boolean;
  easyMarket?: boolean;
  selectiveImportRisk?: boolean;
  marketMakerActivity?: boolean;
}

interface WeightedEvidence { evidence: TopicScoringEvidenceV1; outcome: number; probability: number; weight: number; evidenceQuality: number }
const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function finalityQuality(resolution: ResolutionReceiptV1 | null): number {
  if (!resolution) return 0;
  if (resolution.disputeStatus === 'disputed' || resolution.finality === 'disputed') return 0.2;
  switch (resolution.finality) {
    case 'venue_final': case 'oracle_final': return 1;
    case 'redeemable': return 0.98;
    case 'api_resolved': return 0.9;
    case 'provisional': return 0.55;
    default: return 0;
  }
}

function effectiveSampleSize(items: WeightedEvidence[]): number {
  const sum = items.reduce((value, item) => value + item.weight, 0);
  const squares = items.reduce((value, item) => value + item.weight ** 2, 0);
  return squares === 0 ? 0 : sum ** 2 / squares;
}

function weightedMean(items: WeightedEvidence[], selector: (item: WeightedEvidence) => number): number {
  const total = items.reduce((value, item) => value + item.weight, 0);
  return total === 0 ? 0 : items.reduce((value, item) => value + item.weight * selector(item), 0) / total;
}

function calibrationQuality(items: WeightedEvidence[]): number {
  const buckets = Array.from({ length: 10 }, () => ({ weight: 0, outcomes: 0, probabilities: 0 }));
  for (const item of items) {
    const bucket = buckets[Math.min(9, Math.floor(item.probability * 10))];
    bucket.weight += item.weight; bucket.outcomes += item.weight * item.outcome; bucket.probabilities += item.weight * item.probability;
  }
  const total = buckets.reduce((sum, bucket) => sum + bucket.weight, 0);
  if (total === 0) return 0;
  const error = buckets.reduce((sum, bucket) => bucket.weight === 0 ? sum : sum + (bucket.weight / total) * Math.abs(bucket.outcomes / bucket.weight - bucket.probabilities / bucket.weight), 0);
  return clamp(1 - error / 0.35);
}

function consistencyQuality(items: WeightedEvidence[]): number {
  if (items.length === 0) return 0;
  const weeks = new Set(items.map(({ evidence }) => {
    const date = new Date(evidence.receipt.predictedAt); const start = Date.UTC(date.getUTCFullYear(), 0, 1);
    return `${date.getUTCFullYear()}-${Math.floor((date.getTime() - start) / 604_800_000)}`;
  }));
  return clamp(weeks.size / Math.max(4, Math.sqrt(items.length) * 2));
}

function penaltyForGroup(group: TopicScoringEvidenceV1[], subjectTotal: number, config: TopicScoringConfigV1): { multiplier: number; flags: string[] } {
  const ratios = {
    late: group.filter((item) => item.lateEntry).length / group.length,
    easy: group.filter((item) => item.easyMarket).length / group.length,
    extreme: group.filter((item) => item.receipt.entryPrice !== null && (item.receipt.entryPrice < 0.05 || item.receipt.entryPrice > 0.95)).length / group.length,
    selective: group.filter((item) => item.selectiveImportRisk).length / group.length,
    marketMaker: group.filter((item) => item.marketMakerActivity).length / group.length,
    concentration: group.length / Math.max(1, subjectTotal),
  };
  const duplicateCount = group.length - new Set(group.map((item) => item.receipt.receiptId)).size;
  const correlationCount = group.length - new Set(group.map((item) => item.correlationGroup ?? item.receipt.canonicalEventId ?? item.receipt.receiptId)).size;
  const missingEvidence = group.filter((item) => !item.resolution || finalityQuality(item.resolution) < 0.8).length / group.length;
  const flags: string[] = [];
  if (ratios.late > 0.3) flags.push('late-entry');
  if (ratios.easy > 0.5) flags.push('easy-market-farming');
  if (ratios.extreme > 0.5) flags.push('extreme-price-farming');
  if (ratios.concentration > 0.8 && subjectTotal >= 10) flags.push('topic-concentration');
  if (ratios.selective > 0) flags.push('selective-history-import');
  if (duplicateCount > 0) flags.push('duplicate-receipts');
  if (correlationCount > 0) flags.push('correlated-market-inflation');
  if (missingEvidence > 0) flags.push('missing-or-provisional-resolution');
  if (ratios.marketMaker > 0) flags.push('market-maker-activity');
  const reduction = ratios.late * 0.2 + ratios.easy * 0.15 + ratios.extreme * 0.15 + ratios.selective * 0.2
    + ratios.marketMaker * 0.3 + Math.min(0.2, duplicateCount * 0.05 + correlationCount * 0.03) + missingEvidence * 0.25;
  return { multiplier: clamp(1 - reduction, config.penaltyFloor, 1), flags };
}

export function calculateTopicScoreSnapshotsV1(input: {
  subjectId: string; evidence: TopicScoringEvidenceV1[]; now?: Date; config?: TopicScoringConfigV1; scoringCodeHash?: string;
}): TopicScoreSnapshotV1[] {
  const now = input.now ?? new Date(); const config = input.config ?? TOPIC_SCORING_CONFIG_V1;
  const validEvidence = input.evidence
    .filter((item) => item.receipt.subjectId === input.subjectId)
    .sort((left, right) => left.receipt.receiptId.localeCompare(right.receipt.receiptId));
  const unique = [...new Map(validEvidence.map((item) => [item.receipt.receiptId, item])).values()];
  const groups = new Map<string, TopicScoringEvidenceV1[]>();
  for (const item of validEvidence) {
    const key = `${item.market.topic}/${item.market.subtopic}/${item.market.horizon}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const scoringCodeHash = input.scoringCodeHash ?? hashCanonicalJson(config);
  return [...groups.values()].map((group) => {
    const resolved = [...new Map(group.filter((item): item is TopicScoringEvidenceV1 & { resolution: ResolutionReceiptV1 } => Boolean(item.resolution))
      .filter((item) => item.resolution.outcome === 'YES' || item.resolution.outcome === 'NO')
      .map((item) => [item.receipt.receiptId, item])).values()];
    const correlationSizes = new Map<string, number>();
    for (const item of resolved) { const key = item.correlationGroup ?? item.receipt.canonicalEventId ?? item.receipt.receiptId; correlationSizes.set(key, (correlationSizes.get(key) ?? 0) + 1); }
    const weighted: WeightedEvidence[] = resolved.map((evidence) => {
      const outcome = evidence.resolution.outcome === 'YES' ? 1 : 0;
      const ageDays = Math.max(0, (now.getTime() - new Date(evidence.resolution.resolvedAt).getTime()) / 86_400_000);
      const correlationKey = evidence.correlationGroup ?? evidence.receipt.canonicalEventId ?? evidence.receipt.receiptId;
      const weight = Math.exp(-Math.log(2) * ageDays / config.halfLifeDays) / Math.max(1, correlationSizes.get(correlationKey) ?? 1);
      return { evidence, outcome, probability: evidence.receipt.predictedProbability, weight, evidenceQuality: finalityQuality(evidence.resolution) };
    });
    const resolvedCount = resolved.length; const ess = effectiveSampleSize(weighted);
    const brier = weightedMean(weighted, (item) => (item.probability - item.outcome) ** 2);
    const brierQuality = clamp(1 - brier / 0.25);
    const logLoss = weightedMean(weighted, (item) => -(item.outcome ? Math.log(clamp(item.probability, 0.01, 0.99)) : Math.log(1 - clamp(item.probability, 0.01, 0.99))));
    const logQuality = clamp(1 - logLoss / Math.log(2));
    const calibration = calibrationQuality(weighted);
    const alphaItems = weighted.filter((item) => item.evidence.contemporaneousMarketProbability !== null);
    const marketAlpha = alphaItems.length === 0 ? 0 : weightedMean(alphaItems, (item) => {
      const market = item.evidence.contemporaneousMarketProbability ?? 0.5;
      return Math.abs(market - item.outcome) - Math.abs(item.probability - item.outcome);
    });
    const consistency = consistencyQuality(weighted); const evidenceQuality = weightedMean(weighted, (item) => item.evidenceQuality);
    const penalty = penaltyForGroup(group, unique.length, config);
    const skill = 0.35 * brierQuality + 0.2 * logQuality + 0.2 * calibration + 0.15 * clamp(0.5 + marketAlpha) + 0.1 * consistency;
    const rawScore = 1000 * skill * evidenceQuality * penalty.multiplier;
    const shrinkage = ess / (ess + config.shrinkageAnchor); const score = Math.round(500 * (1 - shrinkage) + rawScore * shrinkage);
    const confidence = ess / (ess + config.confidenceAnchor);
    const integrityFailed = penalty.flags.includes('selective-history-import') || penalty.flags.includes('market-maker-activity') && resolvedCount >= 10;
    let status: TopicScoreSnapshotV1['status'] = 'Unproven';
    if (integrityFailed) status = 'Restricted';
    else if (resolvedCount >= config.statusThresholds.advanced && score >= config.advancedMinimumScore && confidence >= config.advancedMinimumConfidence && evidenceQuality >= config.advancedMinimumEvidenceQuality) status = 'Advanced';
    else if (resolvedCount >= config.statusThresholds.verified && evidenceQuality >= config.verifiedMinimumEvidenceQuality) status = 'Verified';
    else if (resolvedCount >= config.statusThresholds.provisional) status = 'Provisional';
    const uniqueGroup = [...new Map(group.map((item) => [item.receipt.receiptId, item])).values()];
    const tree = buildEvidenceMerkleTree(uniqueGroup.map((item) => item.receipt));
    const dates = uniqueGroup.map((item) => item.receipt.predictedAt).sort(); const market = group[0].market;
    return topicScoreSnapshotV1Schema.parse({
      schemaVersion: REPUTATION_PROTOCOL_V1, subjectId: input.subjectId, topic: market.topic, subtopic: market.subtopic, horizon: market.horizon,
      score, brierQuality, logQuality, calibrationQuality: calibration, marketAlpha, consistencyQuality: consistency, resolvedCount,
      effectiveSampleSize: ess, confidence, evidenceQuality, penaltyMultiplier: penalty.multiplier, penaltyFlags: penalty.flags,
      dataWindowStart: dates[0] ?? now.toISOString(), dataWindowEnd: dates[dates.length - 1] ?? now.toISOString(), scoringVersion: config.version,
      scoringCodeHash, evidenceRoot: tree.root, calculatedAt: now.toISOString(), status,
    });
  }).sort((a, b) => `${a.topic}/${a.subtopic}/${a.horizon}`.localeCompare(`${b.topic}/${b.subtopic}/${b.horizon}`));
}
