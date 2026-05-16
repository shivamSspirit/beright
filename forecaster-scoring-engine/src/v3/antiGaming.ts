import { clamp, WeightedPrediction } from './metrics';
import { PenaltyBreakdown } from './types';

export function calculatePenaltyBreakdown(weighted: WeightedPrediction[]): PenaltyBreakdown {
  if (weighted.length === 0) {
    return {
      lateEntryRatio: 0,
      easyMarketRatio: 0,
      extremePriceRatio: 0,
      concentrationRatio: 0,
      penaltyMultiplier: 1,
      flags: [],
    };
  }

  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  const lateEntryRatio = weighted.reduce((sum, item) => {
    const { marketOpenTime, marketCloseTime, predictedAt } = item.prediction;
    if (!marketOpenTime || !marketCloseTime) return sum;
    const totalWindow = marketCloseTime.getTime() - marketOpenTime.getTime();
    if (totalWindow <= 0) return sum;
    const timeUntilClose = marketCloseTime.getTime() - predictedAt.getTime();
    return sum + (timeUntilClose < totalWindow * 0.1 ? item.weight : 0);
  }, 0) / totalWeight;

  const easyMarketRatio = weighted.reduce((sum, item) => {
    const difficulty = item.prediction.difficulty
      ?? item.prediction.communitySpread
      ?? (1 - Math.abs(item.probability - 0.5) * 2);
    return sum + (difficulty < 0.2 ? item.weight : 0);
  }, 0) / totalWeight;

  const extremePriceRatio = weighted.reduce((sum, item) => {
    const price = item.prediction.entryPrice;
    return sum + (price !== undefined && (price < 0.2 || price > 0.8) ? item.weight : 0);
  }, 0) / totalWeight;

  const categoryWeights = new Map<string, number>();
  for (const item of weighted) {
    const category = item.prediction.category ?? 'uncategorized';
    categoryWeights.set(category, (categoryWeights.get(category) ?? 0) + item.weight);
  }
  const maxCategoryWeight = Math.max(...categoryWeights.values());
  const concentrationRatio = totalWeight > 0 ? maxCategoryWeight / totalWeight : 0;

  const flags: string[] = [];
  if (lateEntryRatio > 0.4) flags.push('late-entry');
  if (easyMarketRatio > 0.5) flags.push('easy-market');
  if (extremePriceRatio > 0.6) flags.push('extreme-price');
  if (concentrationRatio > 0.75) flags.push('concentrated');

  const rawPenalty =
    1
    - Math.max(0, lateEntryRatio - 0.20) * 0.30
    - Math.max(0, easyMarketRatio - 0.25) * 0.20
    - Math.max(0, extremePriceRatio - 0.30) * 0.20
    - Math.max(0, concentrationRatio - 0.50) * 0.30;

  return {
    lateEntryRatio,
    easyMarketRatio,
    extremePriceRatio,
    concentrationRatio,
    penaltyMultiplier: clamp(rawPenalty, 0.70, 1.0),
    flags,
  };
}
