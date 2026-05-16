import { differenceInDays, differenceInWeeks, getWeek, getYear } from 'date-fns';

import { SourceScoreConfig, V3Prediction } from './types';

export interface WeightedPrediction {
  prediction: V3Prediction;
  probability: number;
  outcome: number;
  weight: number;
  ageDays: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getPredictionProbability(prediction: V3Prediction): number {
  return prediction.predictedProbability;
}

export function buildWeightedResolvedPredictions(
  predictions: V3Prediction[],
  config: SourceScoreConfig,
  now: Date,
): WeightedPrediction[] {
  return predictions
    .filter((prediction) => prediction.outcome !== undefined)
    .map((prediction) => {
      const probability = getPredictionProbability(prediction);
      const resolvedAt = prediction.resolvedAt ?? now;
      const ageDays = Math.max(0, differenceInDays(now, resolvedAt));
      const weight = Math.exp((-Math.log(2) * ageDays) / config.halfLifeDays);

      return {
        prediction,
        probability,
        outcome: prediction.outcome ? 1 : 0,
        weight,
        ageDays,
      };
    });
}

export function calculateEffectiveSampleSize(weighted: WeightedPrediction[]): number {
  const weightSum = weighted.reduce((sum, item) => sum + item.weight, 0);
  const weightSqSum = weighted.reduce((sum, item) => sum + item.weight * item.weight, 0);

  if (weightSum === 0 || weightSqSum === 0) {
    return 0;
  }

  return (weightSum * weightSum) / weightSqSum;
}

export function calculateBrierQuality(weighted: WeightedPrediction[]): number {
  const weightSum = weighted.reduce((sum, item) => sum + item.weight, 0);
  if (weightSum === 0) return 0;

  const decayedBrier = weighted.reduce(
    (sum, item) => sum + item.weight * Math.pow(item.probability - item.outcome, 2),
    0,
  ) / weightSum;

  return clamp(1 - decayedBrier / 0.25, 0, 1);
}

export function calculateLogQuality(weighted: WeightedPrediction[]): number {
  const weightSum = weighted.reduce((sum, item) => sum + item.weight, 0);
  if (weightSum === 0) return 0;

  const decayedLogLoss = weighted.reduce((sum, item) => {
    const p = clamp(item.probability, 0.01, 0.99);
    const loss = -(item.outcome === 1 ? Math.log(p) : Math.log(1 - p));
    return sum + item.weight * loss;
  }, 0) / weightSum;

  return clamp(1 - decayedLogLoss / Math.log(2), 0, 1);
}

export function calculateCalibrationQuality(weighted: WeightedPrediction[]): number {
  const buckets = Array.from({ length: 10 }, () => ({ weightedCount: 0, weightedCorrect: 0 }));

  for (const item of weighted) {
    const bucketIndex = Math.min(9, Math.floor(item.probability * 10));
    buckets[bucketIndex].weightedCount += item.weight;
    buckets[bucketIndex].weightedCorrect += item.weight * item.outcome;
  }

  const totalWeight = buckets.reduce((sum, bucket) => sum + bucket.weightedCount, 0);
  if (totalWeight === 0) return 0;

  const calibrationError = buckets.reduce((sum, bucket, index) => {
    if (bucket.weightedCount === 0) return sum;

    const midpoint = (index + 0.5) / 10;
    const accuracy = bucket.weightedCorrect / bucket.weightedCount;
    const bucketWeight = bucket.weightedCount / totalWeight;

    return sum + bucketWeight * Math.abs(accuracy - midpoint);
  }, 0);

  return clamp(1 - calibrationError / 0.35, 0, 1);
}

export function calculateDifficultyQuality(weighted: WeightedPrediction[]): number {
  const weightSum = weighted.reduce((sum, item) => sum + item.weight, 0);
  if (weightSum === 0) return 0;

  const weightedQuality = weighted.reduce((sum, item) => {
    const difficulty = item.prediction.difficulty
      ?? item.prediction.communitySpread
      ?? (1 - Math.abs(item.probability - 0.5) * 2);
    const normalizedDifficulty = clamp(difficulty, 0, 1);
    const quality = 1 - Math.pow(item.probability - item.outcome, 2);
    return sum + item.weight * normalizedDifficulty * quality;
  }, 0) / weightSum;

  return clamp(weightedQuality, 0, 1);
}

export function calculateEdgeQuality(weighted: WeightedPrediction[]): number {
  const eligible = weighted.filter((item) => item.prediction.communityMedian !== undefined);
  if (eligible.length === 0) return 0.5;

  const edgeRate = eligible.reduce((sum, item) => {
    const communityError = Math.abs((item.prediction.communityMedian ?? 0.5) - item.outcome);
    const userError = Math.abs(item.probability - item.outcome);
    return sum + (userError < communityError ? item.weight : 0);
  }, 0) / eligible.reduce((sum, item) => sum + item.weight, 0);

  return clamp(edgeRate, 0, 1);
}

export function calculateConsistencyQuality(predictions: V3Prediction[]): number {
  if (predictions.length === 0) return 0;

  const ordered = [...predictions].sort(
    (left, right) => left.predictedAt.getTime() - right.predictedAt.getTime(),
  );
  const first = ordered[0].predictedAt;
  const last = ordered[ordered.length - 1].predictedAt;
  const totalWeeks = Math.max(1, differenceInWeeks(last, first));

  const activeWeeks = new Set(
    ordered.map((prediction) => `${getYear(prediction.predictedAt)}-W${getWeek(prediction.predictedAt)}`),
  ).size;

  return clamp(activeWeeks / totalWeeks, 0, 1);
}
