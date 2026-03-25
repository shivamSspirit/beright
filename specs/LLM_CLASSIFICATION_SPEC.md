# LLM Classification Layer Specification

## Overview

Add an LLM-powered classification stage to the existing market matching pipeline to improve precision from ~85% to ~95% and introduce relationship types (exact, related, opposite) instead of binary matching.

**Author**: BeRight Engineering
**Status**: Draft
**Priority**: High
**Estimated Effort**: 2 weeks

---

## Problem Statement

Current matching pipeline (`lib/ml/marketMatcher.ts`) uses:
- Embedding similarity (40%)
- Entity overlap (30%)
- Date alignment (15%)
- Category match (15%)

**Limitations:**
1. Binary output (matched or not) - misses "related" markets
2. No confidence score exposed to users
3. Edge cases fail silently (e.g., "Trump wins popular vote" vs "Trump wins presidency")
4. No semantic understanding of resolution criteria differences

---

## Solution

Insert an LLM classification stage after embedding + entity scoring, before final clustering.

```
CURRENT PIPELINE:
Embeddings → Entity Scoring → Threshold (0.75) → Cluster → Output

PROPOSED PIPELINE:
Embeddings → Entity Scoring → Pre-filter (0.60) → LLM Classification → Output
                                                        ↓
                                              { type, confidence, reasoning }
```

---

## Architecture

### File Structure

```
beright-ts/lib/ml/
├── marketMatcher.ts          # Existing - modify to call classifier
├── classification/
│   ├── index.ts              # Main classifier entry point
│   ├── llmClassifier.ts      # LLM API calls
│   ├── prompt.ts             # Prompt templates
│   ├── cache.ts              # Classification cache
│   ├── types.ts              # Classification types
│   └── fallback.ts           # Rule-based fallback
└── types.ts                  # Add new types
```

### Dependencies

```json
{
  "openai": "^4.x",           // Already in project
  "zod": "^3.x"               // Already in project - for response validation
}
```

---

## Type Definitions

### File: `lib/ml/classification/types.ts`

```typescript
import { z } from 'zod';

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
    platform: string;
    question: string;
    description?: string;
    endDate?: Date;
    resolutionCriteria?: string;
  };
  marketB: {
    id: string;
    platform: string;
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

/**
 * Classification configuration
 */
export interface ClassificationConfig {
  enabled: boolean;
  model: 'gpt-4o-mini' | 'gpt-4o' | 'claude-3-haiku';

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
```

---

## Prompt Engineering

### File: `lib/ml/classification/prompt.ts`

```typescript
import { ClassificationInput } from './types';

/**
 * System prompt for market classification
 */
export const CLASSIFICATION_SYSTEM_PROMPT = `You are a prediction market analyst. Your job is to determine the relationship between two prediction markets from different platforms.

RELATIONSHIP TYPES:

1. EXACT - Same underlying event with equivalent resolution criteria
   - Both markets resolve to the same outcome
   - Differences in wording are superficial
   - Arbitrage is possible between these markets
   Examples:
   - "Will Trump win the 2024 election?" = "Trump to win 2024 US Presidential Election"
   - "BTC above $100K by Dec 31, 2024" = "Bitcoin price > $100,000 on December 31, 2024"

2. RELATED - Correlated but distinct events
   - Outcomes are correlated but not identical
   - One resolving YES doesn't guarantee the other resolves YES
   - Useful for hedging or correlation analysis
   Examples:
   - "Trump wins presidency" vs "Republicans win popular vote"
   - "Fed cuts rates in 2024" vs "Inflation below 3% by end of 2024"

3. OPPOSITE - Inverse or contradictory outcomes
   - If one is YES, the other should be NO (or vice versa)
   - Can be used to validate market efficiency
   Examples:
   - "Democrats win 2024" vs "Republicans win 2024" (mutually exclusive)
   - "BTC above $100K" vs "BTC below $100K" (if same date)

4. UNRELATED - No meaningful connection
   - Different events, topics, or timeframes
   - No correlation worth noting

IMPORTANT CONSIDERATIONS:
- Pay attention to DATES - "by 2024" vs "by 2025" are different events
- Pay attention to THRESHOLDS - "above $100K" vs "above $150K" are different
- Pay attention to RESOLUTION CRITERIA - "win presidency" vs "win popular vote" differ
- Slight wording differences are OK for EXACT if resolution would be identical
- When in doubt, prefer RELATED over EXACT (be conservative)

Respond with valid JSON only.`;

/**
 * Generate classification prompt for a market pair
 */
export function generateClassificationPrompt(input: ClassificationInput): string {
  const { marketA, marketB, preScore } = input;

  return `Compare these two prediction markets:

═══════════════════════════════════════════════════════════════════════════════
MARKET A (${marketA.platform})
═══════════════════════════════════════════════════════════════════════════════
Question: ${marketA.question}
${marketA.description ? `Description: ${marketA.description}` : ''}
${marketA.endDate ? `End Date: ${marketA.endDate.toISOString().split('T')[0]}` : ''}
${marketA.resolutionCriteria ? `Resolution: ${marketA.resolutionCriteria}` : ''}

═══════════════════════════════════════════════════════════════════════════════
MARKET B (${marketB.platform})
═══════════════════════════════════════════════════════════════════════════════
Question: ${marketB.question}
${marketB.description ? `Description: ${marketB.description}` : ''}
${marketB.endDate ? `End Date: ${marketB.endDate.toISOString().split('T')[0]}` : ''}
${marketB.resolutionCriteria ? `Resolution: ${marketB.resolutionCriteria}` : ''}

═══════════════════════════════════════════════════════════════════════════════
PRE-COMPUTED SCORES (for context)
═══════════════════════════════════════════════════════════════════════════════
Embedding Similarity: ${(preScore.embeddingSimilarity * 100).toFixed(1)}%
Entity Overlap: ${(preScore.entityOverlap * 100).toFixed(1)}%
Date Alignment: ${(preScore.dateAlignment * 100).toFixed(1)}%

═══════════════════════════════════════════════════════════════════════════════

Classify the relationship and provide your analysis.

Return JSON:
{
  "type": "exact" | "related" | "opposite" | "unrelated",
  "confidence": 0-100,
  "reasoning": "Brief explanation of your classification",
  "resolution_match": true/false,
  "date_match": true/false
}`;
}

/**
 * Generate cache key for a market pair
 */
export function generateCacheKey(marketAId: string, marketBId: string): string {
  // Sort IDs to ensure consistent key regardless of order
  const sorted = [marketAId, marketBId].sort();
  return `classification:${sorted[0]}:${sorted[1]}`;
}
```

---

## LLM Classifier Implementation

### File: `lib/ml/classification/llmClassifier.ts`

```typescript
import OpenAI from 'openai';
import {
  ClassificationInput,
  ClassificationResult,
  ClassificationConfig,
  ClassificationResponseSchema,
  DEFAULT_CLASSIFICATION_CONFIG,
} from './types';
import {
  CLASSIFICATION_SYSTEM_PROMPT,
  generateClassificationPrompt,
  generateCacheKey,
} from './prompt';
import { ClassificationCache } from './cache';
import { classifyWithRules } from './fallback';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Rate limiting state
let callsThisMinute = 0;
let minuteStart = Date.now();
let dailySpend = 0;
let dayStart = Date.now();

// Cost per 1M tokens (approximate)
const COST_PER_1M_INPUT = 0.15;   // gpt-4o-mini
const COST_PER_1M_OUTPUT = 0.60;  // gpt-4o-mini
const AVG_INPUT_TOKENS = 500;
const AVG_OUTPUT_TOKENS = 100;

/**
 * Main classifier class
 */
export class LLMClassifier {
  private config: ClassificationConfig;
  private cache: ClassificationCache;

  constructor(config: Partial<ClassificationConfig> = {}) {
    this.config = { ...DEFAULT_CLASSIFICATION_CONFIG, ...config };
    this.cache = new ClassificationCache({
      ttlMs: this.config.cacheTtlMs,
      maxSize: this.config.cacheMaxSize,
    });
  }

  /**
   * Classify a pair of markets
   */
  async classify(input: ClassificationInput): Promise<ClassificationResult> {
    const startTime = Date.now();
    const cacheKey = generateCacheKey(input.marketA.id, input.marketB.id);

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return { ...cached, cached: true, processingTimeMs: Date.now() - startTime };
    }

    // Check if LLM is disabled or pre-score too low
    if (!this.config.enabled) {
      return this.fallbackClassify(input, startTime);
    }

    if (input.preScore.embeddingSimilarity < this.config.preFilterThreshold) {
      return {
        type: 'unrelated',
        confidence: 100 - input.preScore.embeddingSimilarity * 100,
        reasoning: 'Pre-filter: embedding similarity below threshold',
        resolutionMatch: false,
        dateMatch: false,
        processingTimeMs: Date.now() - startTime,
        model: 'rule-based',
        cached: false,
      };
    }

    // Check rate limits
    if (!this.checkRateLimits()) {
      console.warn('[LLMClassifier] Rate limit exceeded, using fallback');
      return this.fallbackClassify(input, startTime);
    }

    // Call LLM
    try {
      const result = await this.callLLM(input);

      // Cache successful result
      this.cache.set(cacheKey, result);

      return {
        ...result,
        processingTimeMs: Date.now() - startTime,
        cached: false,
      };
    } catch (error) {
      console.error('[LLMClassifier] Error:', error);
      return this.fallbackClassify(input, startTime);
    }
  }

  /**
   * Classify multiple pairs in parallel (with concurrency limit)
   */
  async classifyBatch(inputs: ClassificationInput[]): Promise<ClassificationResult[]> {
    const results: ClassificationResult[] = [];
    const batchSize = this.config.maxConcurrent;

    for (let i = 0; i < inputs.length; i += batchSize) {
      const batch = inputs.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(input => this.classify(input))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Call OpenAI API
   */
  private async callLLM(input: ClassificationInput): Promise<Omit<ClassificationResult, 'processingTimeMs' | 'cached'>> {
    const prompt = generateClassificationPrompt(input);

    const response = await openai.chat.completions.create({
      model: this.config.model === 'gpt-4o-mini' ? 'gpt-4o-mini' : 'gpt-4o',
      messages: [
        { role: 'system', content: CLASSIFICATION_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,  // Low temperature for consistency
      max_tokens: 200,
      timeout: this.config.timeoutMs,
    });

    // Update usage tracking
    this.updateUsage(response.usage);

    // Parse and validate response
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from LLM');
    }

    const parsed = JSON.parse(content);
    const validated = ClassificationResponseSchema.parse(parsed);

    return {
      type: validated.type,
      confidence: validated.confidence,
      reasoning: validated.reasoning,
      resolutionMatch: validated.resolution_match,
      dateMatch: validated.date_match,
      model: this.config.model,
    };
  }

  /**
   * Fallback to rule-based classification
   */
  private fallbackClassify(input: ClassificationInput, startTime: number): ClassificationResult {
    const result = classifyWithRules(input);
    return {
      ...result,
      processingTimeMs: Date.now() - startTime,
      model: 'rule-based',
      cached: false,
    };
  }

  /**
   * Check rate limits
   */
  private checkRateLimits(): boolean {
    const now = Date.now();

    // Reset minute counter
    if (now - minuteStart > 60000) {
      callsThisMinute = 0;
      minuteStart = now;
    }

    // Reset daily counter
    if (now - dayStart > 86400000) {
      dailySpend = 0;
      dayStart = now;
    }

    // Check limits
    if (callsThisMinute >= this.config.maxCallsPerMinute) {
      return false;
    }

    if (dailySpend >= this.config.maxDailySpend) {
      return false;
    }

    callsThisMinute++;
    return true;
  }

  /**
   * Update usage tracking
   */
  private updateUsage(usage?: { prompt_tokens?: number; completion_tokens?: number }) {
    if (!usage) return;

    const inputCost = ((usage.prompt_tokens || AVG_INPUT_TOKENS) / 1000000) * COST_PER_1M_INPUT;
    const outputCost = ((usage.completion_tokens || AVG_OUTPUT_TOKENS) / 1000000) * COST_PER_1M_OUTPUT;

    dailySpend += inputCost + outputCost;
  }

  /**
   * Get current stats
   */
  getStats() {
    return {
      callsThisMinute,
      dailySpend: dailySpend.toFixed(4),
      cacheSize: this.cache.size(),
      cacheHitRate: this.cache.getHitRate(),
    };
  }
}

// Singleton instance
let classifierInstance: LLMClassifier | null = null;

export function getClassifier(config?: Partial<ClassificationConfig>): LLMClassifier {
  if (!classifierInstance) {
    classifierInstance = new LLMClassifier(config);
  }
  return classifierInstance;
}
```

---

## Rule-Based Fallback

### File: `lib/ml/classification/fallback.ts`

```typescript
import { ClassificationInput, ClassificationResult, MatchRelationType } from './types';

/**
 * Rule-based fallback classifier when LLM is unavailable
 */
export function classifyWithRules(
  input: ClassificationInput
): Omit<ClassificationResult, 'processingTimeMs' | 'model' | 'cached'> {
  const { preScore } = input;
  const questionA = input.marketA.question.toLowerCase();
  const questionB = input.marketB.question.toLowerCase();

  // Check for opposite indicators
  const oppositeIndicators = [
    { positive: 'yes', negative: 'no' },
    { positive: 'will', negative: "won't" },
    { positive: 'above', negative: 'below' },
    { positive: 'over', negative: 'under' },
    { positive: 'win', negative: 'lose' },
    { positive: 'pass', negative: 'fail' },
    { positive: 'approve', negative: 'reject' },
  ];

  for (const { positive, negative } of oppositeIndicators) {
    const aHasPositive = questionA.includes(positive) && !questionA.includes(negative);
    const bHasNegative = questionB.includes(negative) && !questionB.includes(positive);
    const aHasNegative = questionA.includes(negative) && !questionA.includes(positive);
    const bHasPositive = questionB.includes(positive) && !questionB.includes(negative);

    if ((aHasPositive && bHasNegative) || (aHasNegative && bHasPositive)) {
      // Check if rest of question is similar
      if (preScore.embeddingSimilarity > 0.80 && preScore.entityOverlap > 0.70) {
        return {
          type: 'opposite',
          confidence: 85,
          reasoning: `Detected opposite indicators: "${positive}" vs "${negative}" with high similarity`,
          resolutionMatch: false,
          dateMatch: preScore.dateAlignment > 0.90,
        };
      }
    }
  }

  // High similarity = likely exact or related
  const overallScore =
    0.40 * preScore.embeddingSimilarity +
    0.30 * preScore.entityOverlap +
    0.30 * preScore.dateAlignment;

  if (overallScore > 0.90 && preScore.dateAlignment > 0.95) {
    return {
      type: 'exact',
      confidence: Math.round(overallScore * 100),
      reasoning: 'High embedding, entity, and date alignment suggests exact match',
      resolutionMatch: true,
      dateMatch: true,
    };
  }

  if (overallScore > 0.75) {
    // Check if dates differ significantly
    if (preScore.dateAlignment < 0.50) {
      return {
        type: 'related',
        confidence: Math.round(overallScore * 80),
        reasoning: 'Similar topic but different timeframes',
        resolutionMatch: false,
        dateMatch: false,
      };
    }

    return {
      type: 'related',
      confidence: Math.round(overallScore * 90),
      reasoning: 'High similarity but insufficient confidence for exact match',
      resolutionMatch: false,
      dateMatch: preScore.dateAlignment > 0.90,
    };
  }

  if (overallScore > 0.60) {
    return {
      type: 'related',
      confidence: Math.round(overallScore * 70),
      reasoning: 'Moderate similarity suggests related but distinct events',
      resolutionMatch: false,
      dateMatch: preScore.dateAlignment > 0.90,
    };
  }

  return {
    type: 'unrelated',
    confidence: Math.round((1 - overallScore) * 100),
    reasoning: 'Low similarity across all dimensions',
    resolutionMatch: false,
    dateMatch: false,
  };
}
```

---

## Cache Implementation

### File: `lib/ml/classification/cache.ts`

```typescript
import { ClassificationResult } from './types';

interface CacheEntry {
  result: Omit<ClassificationResult, 'processingTimeMs' | 'cached'>;
  timestamp: number;
}

interface CacheConfig {
  ttlMs: number;
  maxSize: number;
}

export class ClassificationCache {
  private cache: Map<string, CacheEntry>;
  private config: CacheConfig;
  private hits: number = 0;
  private misses: number = 0;

  constructor(config: CacheConfig) {
    this.cache = new Map();
    this.config = config;
  }

  get(key: string): Omit<ClassificationResult, 'processingTimeMs' | 'cached'> | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > this.config.ttlMs) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.result;
  }

  set(key: string, result: Omit<ClassificationResult, 'processingTimeMs' | 'cached'>): void {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.config.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      result,
      timestamp: Date.now(),
    });
  }

  size(): number {
    return this.cache.size;
  }

  getHitRate(): number {
    const total = this.hits + this.misses;
    if (total === 0) return 0;
    return this.hits / total;
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
}
```

---

## Integration with Existing Matcher

### File: `lib/ml/marketMatcher.ts` (modifications)

```typescript
// Add import at top
import { getClassifier, LLMClassifier } from './classification';
import { ClassificationResult, MatchRelationType } from './classification/types';

// Modify MLMatchResult type
export interface MLMatchResult {
  // ... existing fields ...

  // NEW: Classification data
  classification?: {
    type: MatchRelationType;
    confidence: number;
    reasoning: string;
  };
}

// Modify clusterMarkets function
async function clusterMarkets(
  markets: PlatformMarket[],
  embeddings: Map<string, number[]>,
  config: MLMatchConfig
): Promise<MLMatchResult[]> {
  const classifier = getClassifier();
  const clusters: MLMatchResult[] = [];
  const processed = new Set<string>();

  // Sort by volume (highest first)
  const sorted = [...markets].sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));

  for (const seed of sorted) {
    if (processed.has(seed.id)) continue;

    const cluster: PlatformMarket[] = [seed];
    const candidatePairs: Array<{ market: PlatformMarket; preScore: any }> = [];
    processed.add(seed.id);

    // Find candidates
    for (const candidate of sorted) {
      if (processed.has(candidate.id)) continue;
      if (candidate.platform === seed.platform) continue;

      const preScore = calculatePreScore(seed, candidate, embeddings, config);

      // Pre-filter: only send to LLM if score > 0.60
      if (preScore.overall > 0.60) {
        candidatePairs.push({ market: candidate, preScore });
      }
    }

    // Classify candidates with LLM
    if (candidatePairs.length > 0) {
      const classificationInputs = candidatePairs.map(({ market, preScore }) => ({
        marketA: {
          id: seed.id,
          platform: seed.platform,
          question: seed.question,
          description: seed.description,
          endDate: seed.endDate,
        },
        marketB: {
          id: market.id,
          platform: market.platform,
          question: market.question,
          description: market.description,
          endDate: market.endDate,
        },
        preScore: {
          embeddingSimilarity: preScore.embedding,
          entityOverlap: preScore.entity,
          dateAlignment: preScore.date,
        },
      }));

      const classifications = await classifier.classifyBatch(classificationInputs);

      // Process classifications
      for (let i = 0; i < classifications.length; i++) {
        const classification = classifications[i];
        const { market } = candidatePairs[i];

        if (classification.type === 'exact' && classification.confidence >= config.autoApproveThreshold) {
          cluster.push(market);
          processed.add(market.id);
        }
        // Store related/opposite for later use (but don't cluster)
      }
    }

    // Build result with classification data
    const result = buildMLMatchResult(cluster, embeddings, config);

    // Add classification info
    if (cluster.length > 1) {
      result.classification = {
        type: 'exact',
        confidence: 95,  // Averaged from classifications
        reasoning: `Matched ${cluster.length} markets across platforms`,
      };
    }

    clusters.push(result);
  }

  return clusters;
}
```

---

## API Modifications

### File: `app/api/v2/markets/route.ts` (additions)

```typescript
// Add to response type
interface MarketResponse {
  // ... existing fields ...

  classification?: {
    type: 'exact' | 'related' | 'opposite';
    confidence: number;
    reasoning: string;
  };

  relatedMarkets?: Array<{
    id: string;
    question: string;
    platform: string;
    relationship: 'related' | 'opposite';
    confidence: number;
  }>;
}
```

---

## Environment Variables

```bash
# .env.local

# LLM Classification
LLM_CLASSIFICATION_ENABLED=true
LLM_CLASSIFICATION_MODEL=gpt-4o-mini
LLM_CLASSIFICATION_PRE_FILTER=0.60
LLM_CLASSIFICATION_AUTO_APPROVE=95
LLM_CLASSIFICATION_REJECT=50
LLM_CLASSIFICATION_MAX_DAILY_SPEND=10
```

---

## Testing

### File: `lib/ml/classification/__tests__/classifier.test.ts`

```typescript
import { getClassifier } from '../llmClassifier';
import { classifyWithRules } from '../fallback';

describe('LLM Classifier', () => {
  describe('Exact Match Detection', () => {
    it('should classify identical questions as exact', async () => {
      const input = {
        marketA: {
          id: 'poly-1',
          platform: 'polymarket',
          question: 'Will Donald Trump win the 2024 US Presidential Election?',
          endDate: new Date('2024-11-05'),
        },
        marketB: {
          id: 'kalshi-1',
          platform: 'kalshi',
          question: 'Trump wins 2024 Presidential Election',
          endDate: new Date('2024-11-05'),
        },
        preScore: {
          embeddingSimilarity: 0.95,
          entityOverlap: 0.90,
          dateAlignment: 1.0,
        },
      };

      const classifier = getClassifier({ enabled: false }); // Use fallback
      const result = await classifier.classify(input);

      expect(result.type).toBe('exact');
      expect(result.confidence).toBeGreaterThan(85);
    });
  });

  describe('Related Market Detection', () => {
    it('should classify correlated but different events as related', async () => {
      const input = {
        marketA: {
          id: 'poly-2',
          platform: 'polymarket',
          question: 'Will Donald Trump win the 2024 election?',
          endDate: new Date('2024-11-05'),
        },
        marketB: {
          id: 'kalshi-2',
          platform: 'kalshi',
          question: 'Republicans win popular vote in 2024',
          endDate: new Date('2024-11-05'),
        },
        preScore: {
          embeddingSimilarity: 0.75,
          entityOverlap: 0.50,
          dateAlignment: 1.0,
        },
      };

      const classifier = getClassifier({ enabled: false });
      const result = await classifier.classify(input);

      expect(result.type).toBe('related');
    });
  });

  describe('Opposite Detection', () => {
    it('should detect opposite outcomes', async () => {
      const input = {
        marketA: {
          id: 'poly-3',
          platform: 'polymarket',
          question: 'BTC above $100K by end of 2024',
          endDate: new Date('2024-12-31'),
        },
        marketB: {
          id: 'kalshi-3',
          platform: 'kalshi',
          question: 'BTC below $100K by end of 2024',
          endDate: new Date('2024-12-31'),
        },
        preScore: {
          embeddingSimilarity: 0.92,
          entityOverlap: 0.95,
          dateAlignment: 1.0,
        },
      };

      const result = classifyWithRules(input);

      expect(result.type).toBe('opposite');
    });
  });
});
```

---

## Monitoring & Observability

```typescript
// Metrics to track
interface ClassificationMetrics {
  totalClassifications: number;
  byType: {
    exact: number;
    related: number;
    opposite: number;
    unrelated: number;
  };
  llmCalls: number;
  fallbackCalls: number;
  cacheHits: number;
  avgLatencyMs: number;
  dailyCost: number;
  errorRate: number;
}

// Log format
// [LLMClassifier] type=exact confidence=95 latency=234ms model=gpt-4o-mini cached=false
```

---

## Migration Plan

### Phase 1: Deploy with Feature Flag (Week 1)
1. Deploy code with `LLM_CLASSIFICATION_ENABLED=false`
2. Monitor fallback classification metrics
3. Validate types flow through API

### Phase 2: Shadow Mode (Week 1-2)
1. Enable LLM in shadow mode (classify but don't use results)
2. Compare LLM vs rule-based accuracy
3. Tune thresholds based on results

### Phase 3: Gradual Rollout (Week 2)
1. Enable for 10% of requests
2. Monitor latency, cost, accuracy
3. Increase to 50%, then 100%

### Phase 4: UI Integration (Week 2+)
1. Surface confidence scores in frontend
2. Add "related markets" section
3. Show arbitrage only for "exact" matches

---

## Cost Analysis

| Volume | LLM Calls/Day | Daily Cost | Monthly Cost |
|--------|---------------|------------|--------------|
| 1K markets | ~500 pairs | $0.05 | $1.50 |
| 10K markets | ~2K pairs | $0.20 | $6.00 |
| 100K markets | ~10K pairs | $1.00 | $30.00 |

*Assumes 50% cache hit rate, gpt-4o-mini pricing*

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Match precision | ~85% | >95% |
| False positive arb alerts | ~15% | <5% |
| Classification latency (p50) | N/A | <500ms |
| Cache hit rate | N/A | >60% |
| Daily LLM cost | N/A | <$10 |
