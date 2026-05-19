import { calculateV3UnifiedScore } from './calculator';
import { ResolutionFinality, V3Prediction } from './types';

const now = new Date('2026-05-19T00:00:00.000Z');

function makePrediction(index: number, finality: ResolutionFinality, confidence: number): V3Prediction {
  const predictedAt = new Date(now.getTime() - (10 + index) * 24 * 60 * 60 * 1000);
  const resolvedAt = new Date(now.getTime() - index * 24 * 60 * 60 * 1000);

  return {
    id: `p-${index}-${finality}`,
    forecasterId: 'forecaster-1',
    source: 'imported',
    platform: 'polymarket',
    marketId: `market-${index}`,
    marketTitle: `Market ${index}`,
    predictedProbability: 0.75,
    direction: 'YES',
    predictedAt,
    resolvedAt,
    outcome: true,
    entryPrice: 0.75,
    positionSize: 100,
    communityMedian: 0.55,
    difficulty: 0.5,
    marketOpenTime: new Date(predictedAt.getTime() - 10 * 24 * 60 * 60 * 1000),
    marketCloseTime: resolvedAt,
    category: 'imported:test',
    resolutionEvidence: {
      source: 'test-source',
      finality,
      confidence,
      observedAt: resolvedAt,
    },
  };
}

describe('calculateV3UnifiedScore', () => {
  it('reduces imported score when resolution evidence is weak', () => {
    const strongEvidence = Array.from({ length: 20 }, (_, index) => makePrediction(index, 'venue_final', 0.95));
    const weakEvidence = Array.from({ length: 20 }, (_, index) => makePrediction(index, 'disputed', 0.95));

    const strong = calculateV3UnifiedScore({
      forecasterId: 'forecaster-1',
      importedPredictions: strongEvidence,
      now,
    });
    const weak = calculateV3UnifiedScore({
      forecasterId: 'forecaster-1',
      importedPredictions: weakEvidence,
      now,
    });

    expect(strong.importedScore?.breakdown.evidenceQuality).toBeCloseTo(0.95, 5);
    expect(weak.importedScore?.breakdown.evidenceQuality).toBeCloseTo(0.25, 5);
    expect(strong.vaultScore).toBeGreaterThan(weak.vaultScore);
  });
});
