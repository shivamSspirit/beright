/**
 * XGBoost Fusion Classifier
 *
 * Combines multiple matching signals into a final confidence score:
 * - SBERT embedding similarity
 * - Cross-encoder score
 * - Entity overlap
 * - Date proximity
 * - Category match
 * - Volume ratio
 *
 * Uses an ONNX-exported XGBoost model for TypeScript inference.
 * Falls back to weighted ensemble if model not available.
 *
 * @author BeRight Protocol
 */

import { DataPlatform } from '../../data/types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Features for market matching
 */
export interface MatchFeatures {
  // Semantic similarity (0-1)
  embeddingSimilarity: number;

  // Cross-encoder reranking score (0-1)
  crossEncoderScore: number;

  // Entity overlap (Jaccard coefficient)
  entityOverlap: number;

  // Date proximity (0-1, 1 = same day)
  dateProximity: number;

  // Category match (0 or 1)
  categoryMatch: number;

  // Volume ratio (normalized log)
  volumeRatio: number;

  // Same platform (0 or 1)
  platformSame: number;

  // Outcome count match (0 or 1)
  outcomeCountMatch: number;
}

/**
 * Classification result
 */
export interface ClassificationResult {
  isMatch: boolean;
  confidence: number;
  matchType: 'exact' | 'fuzzy' | 'related' | 'no_match';
  featureImportance: Record<keyof MatchFeatures, number>;
}

/**
 * Training data point
 */
export interface TrainingExample {
  features: MatchFeatures;
  label: boolean;
}

// =============================================================================
// FEATURE WEIGHTS (Learned from historical data)
// =============================================================================

/**
 * Default feature weights for weighted ensemble
 * These are derived from the arXiv:2601.01706 methodology
 */
export const DEFAULT_WEIGHTS: Record<keyof MatchFeatures, number> = {
  embeddingSimilarity: 0.35,
  crossEncoderScore: 0.25,
  entityOverlap: 0.15,
  dateProximity: 0.10,
  categoryMatch: 0.05,
  volumeRatio: 0.03,
  platformSame: 0.02,
  outcomeCountMatch: 0.05,
};

/**
 * Thresholds for classification
 */
export const CLASSIFICATION_THRESHOLDS = {
  exact: 0.95,
  fuzzy: 0.85,
  related: 0.70,
  minMatch: 0.60,
};

// =============================================================================
// ONNX MODEL LOADER
// =============================================================================

let onnxSession: any = null;
let onnxAvailable = false;

/**
 * Check if ONNX runtime is available
 */
export function isONNXAvailable(): boolean {
  try {
    require.resolve('onnxruntime-node');
    return true;
  } catch {
    return false;
  }
}

/**
 * Load the ONNX model
 */
export async function loadModel(modelPath?: string): Promise<boolean> {
  if (!isONNXAvailable()) {
    console.warn('[FusionClassifier] ONNX runtime not available, using weighted ensemble');
    return false;
  }

  try {
    const ort = await import('onnxruntime-node');
    const path = modelPath || 'models/market_matcher.onnx';

    onnxSession = await ort.InferenceSession.create(path);
    onnxAvailable = true;

    console.log('[FusionClassifier] ONNX model loaded successfully');
    return true;
  } catch (error) {
    console.warn('[FusionClassifier] Failed to load ONNX model:', error);
    onnxAvailable = false;
    return false;
  }
}

// =============================================================================
// CLASSIFICATION
// =============================================================================

/**
 * Classify market pair using fusion model
 */
export async function classifyMatch(features: MatchFeatures): Promise<ClassificationResult> {
  // Try ONNX model first
  if (onnxAvailable && onnxSession) {
    try {
      const result = await classifyWithONNX(features);
      return result;
    } catch (error) {
      console.warn('[FusionClassifier] ONNX inference failed, falling back to ensemble');
    }
  }

  // Fallback to weighted ensemble
  return classifyWithEnsemble(features);
}

/**
 * Classify using ONNX model
 */
async function classifyWithONNX(features: MatchFeatures): Promise<ClassificationResult> {
  const ort = await import('onnxruntime-node');

  // Convert features to array in correct order
  const featureArray = [
    features.embeddingSimilarity,
    features.crossEncoderScore,
    features.entityOverlap,
    features.dateProximity,
    features.categoryMatch,
    features.volumeRatio,
    features.platformSame,
    features.outcomeCountMatch,
  ];

  const input = new Float32Array(featureArray);
  const tensor = new ort.Tensor('float32', input, [1, 8]);

  const results = await onnxSession.run({ input: tensor });
  const confidence = results.output.data[0] as number;

  return {
    isMatch: confidence >= CLASSIFICATION_THRESHOLDS.minMatch,
    confidence,
    matchType: getMatchType(confidence),
    featureImportance: DEFAULT_WEIGHTS, // Would need SHAP values for real importance
  };
}

/**
 * Classify using weighted ensemble (fallback)
 */
function classifyWithEnsemble(features: MatchFeatures): ClassificationResult {
  // Calculate weighted score
  let score = 0;
  let totalWeight = 0;

  const weights = DEFAULT_WEIGHTS;

  for (const [feature, weight] of Object.entries(weights)) {
    const value = features[feature as keyof MatchFeatures];
    score += value * weight;
    totalWeight += weight;
  }

  const confidence = score / totalWeight;

  // Apply penalty for conflicting signals
  const penalty = calculateConflictPenalty(features);
  const adjustedConfidence = confidence * (1 - penalty);

  return {
    isMatch: adjustedConfidence >= CLASSIFICATION_THRESHOLDS.minMatch,
    confidence: adjustedConfidence,
    matchType: getMatchType(adjustedConfidence),
    featureImportance: weights,
  };
}

/**
 * Calculate penalty for conflicting signals
 */
function calculateConflictPenalty(features: MatchFeatures): number {
  let penalty = 0;

  // High embedding similarity but low entity overlap = suspicious
  if (features.embeddingSimilarity > 0.8 && features.entityOverlap < 0.3) {
    penalty += 0.1;
  }

  // High cross-encoder but different categories = suspicious
  if (features.crossEncoderScore > 0.7 && features.categoryMatch === 0) {
    penalty += 0.05;
  }

  // Very different volumes might indicate different markets
  if (Math.abs(features.volumeRatio) > 2) {
    penalty += 0.05;
  }

  return Math.min(penalty, 0.3); // Cap penalty at 30%
}

/**
 * Get match type from confidence score
 */
function getMatchType(confidence: number): ClassificationResult['matchType'] {
  if (confidence >= CLASSIFICATION_THRESHOLDS.exact) return 'exact';
  if (confidence >= CLASSIFICATION_THRESHOLDS.fuzzy) return 'fuzzy';
  if (confidence >= CLASSIFICATION_THRESHOLDS.related) return 'related';
  return 'no_match';
}

// =============================================================================
// BATCH CLASSIFICATION
// =============================================================================

/**
 * Classify multiple market pairs
 */
export async function classifyBatch(
  featuresList: MatchFeatures[]
): Promise<ClassificationResult[]> {
  const results: ClassificationResult[] = [];

  for (const features of featuresList) {
    const result = await classifyMatch(features);
    results.push(result);
  }

  return results;
}

// =============================================================================
// FEATURE EXTRACTION
// =============================================================================

/**
 * Extract match features from two markets
 */
export function extractFeatures(
  marketA: {
    question: string;
    platform: DataPlatform;
    volume: number;
    endDate?: Date;
    category?: string;
    outcomeCount?: number;
    embedding?: number[];
  },
  marketB: {
    question: string;
    platform: DataPlatform;
    volume: number;
    endDate?: Date;
    category?: string;
    outcomeCount?: number;
    embedding?: number[];
  },
  embeddingSimilarity?: number,
  crossEncoderScore?: number
): MatchFeatures {
  // Entity extraction (simple keyword extraction)
  const entitiesA = extractEntities(marketA.question);
  const entitiesB = extractEntities(marketB.question);

  // Entity overlap (Jaccard)
  const entityOverlap = jaccardSimilarity(entitiesA, entitiesB);

  // Date proximity
  let dateProximity = 0.5; // Default if no dates
  if (marketA.endDate && marketB.endDate) {
    const daysDiff = Math.abs(marketA.endDate.getTime() - marketB.endDate.getTime())
      / (1000 * 60 * 60 * 24);

    if (daysDiff === 0) dateProximity = 1;
    else if (daysDiff < 1) dateProximity = 0.95;
    else if (daysDiff < 7) dateProximity = 0.8;
    else if (daysDiff < 30) dateProximity = 0.5;
    else dateProximity = 0.2;
  }

  // Volume ratio (log-normalized)
  const volumeRatio = Math.log((marketA.volume + 1) / (marketB.volume + 1)) / 10;

  return {
    embeddingSimilarity: embeddingSimilarity ?? 0,
    crossEncoderScore: crossEncoderScore ?? 0,
    entityOverlap,
    dateProximity,
    categoryMatch: marketA.category === marketB.category ? 1 : 0,
    volumeRatio: Math.abs(volumeRatio),
    platformSame: marketA.platform === marketB.platform ? 1 : 0,
    outcomeCountMatch: marketA.outcomeCount === marketB.outcomeCount ? 1 : 0,
  };
}

/**
 * Simple entity extraction
 */
function extractEntities(text: string): Set<string> {
  const lower = text.toLowerCase();

  // Key patterns to extract
  const patterns = [
    /trump|biden|harris|desantis|musk|powell/gi,
    /bitcoin|btc|ethereum|eth|solana|sol/gi,
    /fed|fomc|sec|fda|nasa/gi,
    /election|super\s?bowl|world\s?cup|olympics/gi,
    /\b20\d{2}\b/g,
    /\d+%/g,
  ];

  const entities = new Set<string>();

  for (const pattern of patterns) {
    const matches = lower.matchAll(pattern);
    for (const match of matches) {
      entities.add(match[0].trim().toLowerCase());
    }
  }

  return entities;
}

/**
 * Jaccard similarity between sets
 */
function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;

  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  return intersection.size / union.size;
}

// =============================================================================
// MODEL TRAINING (Offline)
// =============================================================================

/**
 * Generate training features from labeled examples
 * (Used offline to train the XGBoost model in Python)
 */
export function exportTrainingData(examples: TrainingExample[]): string {
  const headers = [
    'embedding_similarity',
    'cross_encoder_score',
    'entity_overlap',
    'date_proximity',
    'category_match',
    'volume_ratio',
    'platform_same',
    'outcome_count_match',
    'label',
  ];

  const rows = examples.map(ex => [
    ex.features.embeddingSimilarity,
    ex.features.crossEncoderScore,
    ex.features.entityOverlap,
    ex.features.dateProximity,
    ex.features.categoryMatch,
    ex.features.volumeRatio,
    ex.features.platformSame,
    ex.features.outcomeCountMatch,
    ex.label ? 1 : 0,
  ].join(','));

  return [headers.join(','), ...rows].join('\n');
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  classifyMatch,
  classifyBatch,
  extractFeatures,
  loadModel,
  isONNXAvailable,
  exportTrainingData,
  DEFAULT_WEIGHTS,
  CLASSIFICATION_THRESHOLDS,
};
