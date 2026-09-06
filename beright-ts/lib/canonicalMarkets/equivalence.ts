import { hashCanonicalJson } from '@beright/forecaster-scoring-engine';

export type EquivalenceDecision = 'exact_equivalent' | 'related_not_equivalent' | 'ambiguous_requires_review' | 'rejected';

export interface CanonicalMarketDescriptor {
  title: string;
  topic: string;
  subtopic: string | null;
  entities: string[];
  eventDate: string | null;
  marketCloseDate: string | null;
  resolutionDate: string | null;
  outcomeStructure: 'binary' | 'multi' | 'scalar';
  outcomes: string[];
  numericalThreshold: number | null;
  unit: string | null;
  timezone: string | null;
  resolutionSource: string | null;
  cancellationRules: string | null;
  normalizedRules: string;
}

export interface CanonicalEquivalenceResult {
  decision: EquivalenceDecision;
  score: number;
  componentScores: { title: number; entities: number; dates: number; outcomes: number; rules: number };
  warnings: string[];
  disqualifiers: string[];
  outcomeMapping: { YES: 'YES' | 'NO'; NO: 'YES' | 'NO'; inverted: boolean };
  normalizedRuleHashes: { left: string; right: string };
}

const normalizeText = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const tokens = (value: string) => new Set(normalizeText(value).split(' ').filter((token) => token.length > 1));
const jaccard = (left: Set<string>, right: Set<string>) => {
  const union = new Set([...left, ...right]); if (union.size === 0) return 1;
  return [...left].filter((value) => right.has(value)).length / union.size;
};
const daysApart = (left: string | null, right: string | null): number | null => left && right
  ? Math.abs(new Date(left).getTime() - new Date(right).getTime()) / 86_400_000 : null;
const normalizedSource = (value: string | null) => value ? normalizeText(value).replace(/\b(the|official|published|data)\b/g, '').replace(/\s+/g, ' ').trim() : null;

function isNegated(title: string): boolean { return /\b(not|won't|will not|fail to|below)\b/i.test(title); }

export function evaluateCanonicalEquivalence(left: CanonicalMarketDescriptor, right: CanonicalMarketDescriptor): CanonicalEquivalenceResult {
  const warnings: string[] = []; const disqualifiers: string[] = [];
  const title = jaccard(tokens(left.title), tokens(right.title));
  const entities = left.entities.length === 0 && right.entities.length === 0 ? 0.5
    : jaccard(new Set(left.entities.map(normalizeText)), new Set(right.entities.map(normalizeText)));
  const eventDays = daysApart(left.eventDate, right.eventDate); const closeDays = daysApart(left.marketCloseDate, right.marketCloseDate);
  const resolutionDays = daysApart(left.resolutionDate, right.resolutionDate);
  const maximumDateGap = Math.max(...[eventDays, closeDays, resolutionDays].filter((value): value is number => value !== null), 0);
  const dates = maximumDateGap === 0 ? 1 : Math.max(0, 1 - maximumDateGap / 7);
  if (maximumDateGap > 1) disqualifiers.push(`deadline-conflict:${maximumDateGap.toFixed(2)}d`);
  const inverted = isNegated(left.title) !== isNegated(right.title);
  const outcomes = left.outcomeStructure === right.outcomeStructure && left.outcomes.length === right.outcomes.length ? 1 : 0;
  if (outcomes === 0) disqualifiers.push('outcome-structure-conflict');
  if (left.topic !== right.topic) disqualifiers.push('topic-conflict');
  if (left.subtopic && right.subtopic && left.subtopic !== right.subtopic) disqualifiers.push('subtopic-conflict');
  if (left.numericalThreshold !== null && right.numericalThreshold !== null && left.numericalThreshold !== right.numericalThreshold) disqualifiers.push('numerical-threshold-conflict');
  if (left.unit && right.unit && normalizeText(left.unit) !== normalizeText(right.unit)) disqualifiers.push('unit-conflict');
  if (left.timezone && right.timezone && normalizeText(left.timezone) !== normalizeText(right.timezone)) disqualifiers.push('timezone-conflict');
  const sourceLeft = normalizedSource(left.resolutionSource); const sourceRight = normalizedSource(right.resolutionSource);
  if (sourceLeft && sourceRight && sourceLeft !== sourceRight) disqualifiers.push('resolution-source-conflict');
  if (left.cancellationRules && right.cancellationRules && normalizeText(left.cancellationRules) !== normalizeText(right.cancellationRules)) disqualifiers.push('cancellation-rule-conflict');
  if (entities < 0.5 && (left.entities.length > 0 || right.entities.length > 0)) disqualifiers.push('entity-conflict');
  if (!left.resolutionSource || !right.resolutionSource) warnings.push('resolution-source-incomplete');
  if (!left.timezone || !right.timezone) warnings.push('timezone-incomplete');
  const hashes = { left: hashCanonicalJson(normalizeText(left.normalizedRules)), right: hashCanonicalJson(normalizeText(right.normalizedRules)) };
  const rules = disqualifiers.length === 0 ? (hashes.left === hashes.right ? 1 : 0.85) : 0;
  const score = Math.max(0, 0.25 * title + 0.25 * entities + 0.2 * dates + 0.1 * outcomes + 0.2 * rules);
  let decision: EquivalenceDecision;
  if (disqualifiers.length > 0) decision = title >= 0.5 ? 'related_not_equivalent' : 'rejected';
  else if (score >= 0.82 && warnings.length <= 1) decision = 'exact_equivalent';
  else if (score >= 0.65) decision = 'ambiguous_requires_review';
  else if (score >= 0.4) decision = 'related_not_equivalent';
  else decision = 'rejected';
  return { decision, score, componentScores: { title, entities, dates, outcomes, rules }, warnings, disqualifiers,
    outcomeMapping: inverted ? { YES: 'NO', NO: 'YES', inverted: true } : { YES: 'YES', NO: 'NO', inverted: false }, normalizedRuleHashes: hashes };
}
