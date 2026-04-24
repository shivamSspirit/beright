import { SourceScoreConfig } from './types';

export const IMPORTED_SCORE_CONFIG: SourceScoreConfig = {
  source: 'imported',
  halfLifeDays: 120,
  confidenceAnchor: 100,
  weights: {
    brierQuality: 0.40,
    logQuality: 0.20,
    calibrationQuality: 0.15,
    difficultyQuality: 0.10,
    edgeQuality: 0.05,
    consistencyQuality: 0.10,
  },
};

export const NATIVE_SCORE_CONFIG: SourceScoreConfig = {
  source: 'native',
  halfLifeDays: 90,
  confidenceAnchor: 75,
  weights: {
    brierQuality: 0.35,
    logQuality: 0.20,
    calibrationQuality: 0.20,
    difficultyQuality: 0.10,
    edgeQuality: 0.10,
    consistencyQuality: 0.05,
  },
};
