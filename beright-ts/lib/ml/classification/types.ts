/**
 * LLM Classification Types
 *
 * Type definitions for the LLM-powered market classification system.
 * Adds relationship types (exact, related, opposite) and confidence scores
 * to improve market matching precision.
 *
 * @author BeRight Protocol
 */

import { z } from 'zod';
import { DataPlatform } from '../../data/types';

// =============================================================================
// CLASSIFICATION TYPES
// =============================================================================

/**
 * Classification relationship types
 */
export type MatchRelationType = 'exact' | 'related' | 'opposite' | 'unrelated';

/**
 * LLM classification result
 */
export interface ClassificationResult {
  type: MatchRelationType;
  confidence: number;           // 0-100
  reasoning: string;            // LLM explanation
  resolutionMatch: boolean;     // Do resolution criteria match?
  dateMatch: boolean;           // Do end dates align?
  processingTimeMs: number;
  model: string;                // Model used
  cached: boolean;              // Was this from cache?
}

/**
 * Classification input pair
 */
export interface ClassificationInput {
  marketA: {
    id: string;
    platform: DataPlatform;
    question: string;
    description?: string;
    endDate?: Date;
    resolutionCriteria?: string;
  };
  marketB: {
    id: string;
    platform: DataPlatform;
    question: string;
    description?: string;
    endDate?: Date;
    resolutionCriteria?: string;
  };
  preScore: {
    embeddingSimilarity: number;
    entityOverlap: number;
    dateAlignment: number;
  };
}

/**
 * Zod schema for LLM response validation
 */
export const ClassificationResponseSchema = z.object({
  type: z.enum(['exact', 'related', 'opposite', 'unrelated']),
  confidence: z.number().min(0).max(100),
  reasoning: z.string(),
  resolution_match: z.boolean(),
  date_match: z.boolean(),
});

export type ClassificationResponse = z.infer<typeof ClassificationResponseSchema>;

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Classification configuration
 */
export interface ClassificationConfig {
  // Enable/disable LLM classification
  enabled: boolean;

  // LLM model to use
  model: 'gpt-4o-mini' | 'gpt-4o' | 'gpt-3.5-turbo';

  // Thresholds
  preFilterThreshold: number;     // Min pre-score to send to LLM (default: 0.60)
  autoApproveThreshold: number;   // Auto-approve if confidence > this (default: 95)
  rejectThreshold: number;        // Auto-reject if confidence < this (default: 50)

  // Performance
  maxConcurrent: number;          // Max parallel LLM calls (default: 10)
  timeoutMs: number;              // Per-call timeout (default: 5000)
  maxRetries: number;             // Retry on failure (default: 2)

  // Caching
  cacheTtlMs: number;             // Cache TTL (default: 24 hours)
  cacheMaxSize: number;           // Max cached pairs (default: 10000)

  // Cost control
  maxCallsPerMinute: number;      // Rate limit (default: 100)
  maxDailySpend: number;          // Daily budget in USD (default: 10)
}

/**
 * Default configuration
 */
export const DEFAULT_CLASSIFICATION_CONFIG: ClassificationConfig = {
  enabled: true,
  model: 'gpt-4o-mini',

  preFilterThreshold: 0.60,
  autoApproveThreshold: 95,
  rejectThreshold: 50,

  maxConcurrent: 10,
  timeoutMs: 5000,
  maxRetries: 2,

  cacheTtlMs: 24 * 60 * 60 * 1000,  // 24 hours
  cacheMaxSize: 10000,

  maxCallsPerMinute: 100,
  maxDailySpend: 10,
};

// =============================================================================
// METRICS
// =============================================================================

/**
 * Classification metrics for monitoring
 */
export interface ClassificationMetrics {
  totalClassifications: number;
  byType: Record<MatchRelationType, number>;
  llmCalls: number;
  fallbackCalls: number;
  cacheHits: number;
  cacheMisses: number;
  avgLatencyMs: number;
  dailyCost: number;
  errorCount: number;
}

/**
 * Initialize empty metrics
 */
export function createEmptyMetrics(): ClassificationMetrics {
  return {
    totalClassifications: 0,
    byType: {
      exact: 0,
      related: 0,
      opposite: 0,
      unrelated: 0,
    },
    llmCalls: 0,
    fallbackCalls: 0,
    cacheHits: 0,
    cacheMisses: 0,
    avgLatencyMs: 0,
    dailyCost: 0,
    errorCount: 0,
  };
}
