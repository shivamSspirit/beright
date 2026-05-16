/**
 * LLM Classifier
 *
 * GPT-4o-mini powered market classification with caching,
 * rate limiting, and fallback support.
 *
 * @author BeRight Protocol
 */

import OpenAI from 'openai';
import {
  ClassificationInput,
  ClassificationResult,
  ClassificationConfig,
  ClassificationResponseSchema,
  DEFAULT_CLASSIFICATION_CONFIG,
  ClassificationMetrics,
  createEmptyMetrics,
  MatchRelationType,
} from './types';
import {
  CLASSIFICATION_SYSTEM_PROMPT,
  generateClassificationPrompt,
  generateCacheKey,
  generateShortHash,
} from './prompt';
import { ClassificationCache, getClassificationCache } from './cache';
import { classifyWithRules, shouldClassify } from './fallback';

// =============================================================================
// RATE LIMITING STATE
// =============================================================================

interface RateLimitState {
  callsThisMinute: number;
  minuteStart: number;
  dailySpend: number;
  dayStart: number;
}

const rateLimitState: RateLimitState = {
  callsThisMinute: 0,
  minuteStart: Date.now(),
  dailySpend: 0,
  dayStart: Date.now(),
};

// Cost per 1M tokens for GPT-4o-mini
const COST_PER_1M_INPUT = 0.15;
const COST_PER_1M_OUTPUT = 0.60;
const AVG_INPUT_TOKENS = 600;  // Typical prompt size
const AVG_OUTPUT_TOKENS = 100; // Typical response size

// =============================================================================
// LLM CLASSIFIER CLASS
// =============================================================================

/**
 * LLM-powered market classifier
 */
export class LLMClassifier {
  private config: ClassificationConfig;
  private cache: ClassificationCache;
  private metrics: ClassificationMetrics;
  private openai: OpenAI | null = null;

  constructor(config: Partial<ClassificationConfig> = {}) {
    this.config = { ...DEFAULT_CLASSIFICATION_CONFIG, ...config };
    this.cache = getClassificationCache({
      ttlMs: this.config.cacheTtlMs,
      maxSize: this.config.cacheMaxSize,
    });
    this.metrics = createEmptyMetrics();

    // Initialize OpenAI client if API key is available
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }

  /**
   * Classify a pair of markets
   */
  async classify(input: ClassificationInput): Promise<ClassificationResult> {
    const startTime = Date.now();
    const cacheKey = generateCacheKey(input.marketA.id, input.marketB.id);
    const shortHash = generateShortHash(input.marketA.id, input.marketB.id);

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.metrics.cacheHits++;
      this.metrics.totalClassifications++;
      this.metrics.byType[cached.type]++;

      return {
        ...cached,
        cached: true,
        processingTimeMs: Date.now() - startTime,
      };
    }

    this.metrics.cacheMisses++;

    // Quick pre-filter
    if (!shouldClassify(input.preScore)) {
      const result: ClassificationResult = {
        type: 'unrelated',
        confidence: 95,
        reasoning: 'Pre-filter: insufficient similarity for classification',
        resolutionMatch: false,
        dateMatch: false,
        processingTimeMs: Date.now() - startTime,
        model: 'pre-filter',
        cached: false,
      };

      this.metrics.totalClassifications++;
      this.metrics.byType.unrelated++;
      return result;
    }

    // Check if LLM is disabled or unavailable
    if (!this.config.enabled || !this.openai) {
      return this.fallbackClassify(input, startTime, 'LLM disabled or unavailable');
    }

    // Check pre-filter threshold
    const overallPreScore =
      0.40 * input.preScore.embeddingSimilarity +
      0.30 * input.preScore.entityOverlap +
      0.30 * input.preScore.dateAlignment;

    if (overallPreScore < this.config.preFilterThreshold) {
      return this.fallbackClassify(input, startTime, 'Below pre-filter threshold');
    }

    // Check rate limits
    if (!this.checkRateLimits()) {
      console.warn(`[LLMClassifier:${shortHash}] Rate limit exceeded, using fallback`);
      return this.fallbackClassify(input, startTime, 'Rate limit exceeded');
    }

    // Call LLM with retries
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await this.callLLM(input, shortHash);

        // Cache successful result
        this.cache.set(cacheKey, result);

        const finalResult: ClassificationResult = {
          ...result,
          processingTimeMs: Date.now() - startTime,
          cached: false,
        };

        // Update metrics
        this.metrics.totalClassifications++;
        this.metrics.llmCalls++;
        this.metrics.byType[result.type]++;
        this.updateAvgLatency(finalResult.processingTimeMs);

        console.log(
          `[LLMClassifier:${shortHash}] ${result.type} (${result.confidence}%) - ${result.reasoning.slice(0, 50)}...`
        );

        return finalResult;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(
          `[LLMClassifier:${shortHash}] Attempt ${attempt + 1} failed: ${lastError.message}`
        );

        // Wait before retry (exponential backoff)
        if (attempt < this.config.maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        }
      }
    }

    // All retries failed, use fallback
    this.metrics.errorCount++;
    console.error(`[LLMClassifier:${shortHash}] All retries failed, using fallback`);
    return this.fallbackClassify(input, startTime, `LLM error: ${lastError?.message}`);
  }

  /**
   * Classify multiple pairs in parallel (with concurrency limit)
   */
  async classifyBatch(
    inputs: ClassificationInput[],
    options: { skipCached?: boolean } = {}
  ): Promise<ClassificationResult[]> {
    const { skipCached = false } = options;
    const results: ClassificationResult[] = new Array(inputs.length);
    const toProcess: Array<{ index: number; input: ClassificationInput }> = [];

    // Check cache first
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const cacheKey = generateCacheKey(input.marketA.id, input.marketB.id);
      const cached = this.cache.get(cacheKey);

      if (cached && !skipCached) {
        results[i] = {
          ...cached,
          cached: true,
          processingTimeMs: 0,
        };
        this.metrics.cacheHits++;
      } else {
        toProcess.push({ index: i, input });
        this.metrics.cacheMisses++;
      }
    }

    // Process uncached in batches
    const batchSize = this.config.maxConcurrent;
    for (let i = 0; i < toProcess.length; i += batchSize) {
      const batch = toProcess.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(({ input }) => this.classify(input))
      );

      for (let j = 0; j < batch.length; j++) {
        results[batch[j].index] = batchResults[j];
      }
    }

    return results;
  }

  /**
   * Call OpenAI API
   */
  private async callLLM(
    input: ClassificationInput,
    shortHash: string
  ): Promise<Omit<ClassificationResult, 'processingTimeMs' | 'cached'>> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const prompt = generateClassificationPrompt(input);

    const response = await Promise.race([
      this.openai.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: 'system', content: CLASSIFICATION_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1, // Low temperature for consistency
        max_tokens: 200,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('LLM timeout')), this.config.timeoutMs)
      ),
    ]);

    // Update usage tracking
    this.updateUsage(response.usage);

    // Parse and validate response
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from LLM');
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error(`Invalid JSON response: ${content.slice(0, 100)}`);
    }

    const validated = ClassificationResponseSchema.safeParse(parsed);
    if (!validated.success) {
      throw new Error(`Invalid response schema: ${validated.error.message}`);
    }

    return {
      type: validated.data.type,
      confidence: validated.data.confidence,
      reasoning: validated.data.reasoning,
      resolutionMatch: validated.data.resolution_match,
      dateMatch: validated.data.date_match,
      model: this.config.model,
    };
  }

  /**
   * Fallback to rule-based classification
   */
  private fallbackClassify(
    input: ClassificationInput,
    startTime: number,
    reason: string
  ): ClassificationResult {
    const result = classifyWithRules(input);

    this.metrics.totalClassifications++;
    this.metrics.fallbackCalls++;
    this.metrics.byType[result.type]++;

    return {
      ...result,
      reasoning: `[Fallback: ${reason}] ${result.reasoning}`,
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
    if (now - rateLimitState.minuteStart > 60000) {
      rateLimitState.callsThisMinute = 0;
      rateLimitState.minuteStart = now;
    }

    // Reset daily counter
    if (now - rateLimitState.dayStart > 86400000) {
      rateLimitState.dailySpend = 0;
      rateLimitState.dayStart = now;
    }

    // Check limits
    if (rateLimitState.callsThisMinute >= this.config.maxCallsPerMinute) {
      return false;
    }

    if (rateLimitState.dailySpend >= this.config.maxDailySpend) {
      return false;
    }

    rateLimitState.callsThisMinute++;
    return true;
  }

  /**
   * Update usage tracking
   */
  private updateUsage(usage?: { prompt_tokens?: number; completion_tokens?: number }): void {
    const inputTokens = usage?.prompt_tokens || AVG_INPUT_TOKENS;
    const outputTokens = usage?.completion_tokens || AVG_OUTPUT_TOKENS;

    const inputCost = (inputTokens / 1000000) * COST_PER_1M_INPUT;
    const outputCost = (outputTokens / 1000000) * COST_PER_1M_OUTPUT;
    const totalCost = inputCost + outputCost;

    rateLimitState.dailySpend += totalCost;
    this.metrics.dailyCost += totalCost;
  }

  /**
   * Update average latency
   */
  private updateAvgLatency(latencyMs: number): void {
    const total = this.metrics.totalClassifications;
    if (total === 1) {
      this.metrics.avgLatencyMs = latencyMs;
    } else {
      // Rolling average
      this.metrics.avgLatencyMs =
        this.metrics.avgLatencyMs * ((total - 1) / total) + latencyMs / total;
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): ClassificationMetrics {
    return { ...this.metrics };
  }

  /**
   * Get current stats (for monitoring)
   */
  getStats(): {
    enabled: boolean;
    model: string;
    callsThisMinute: number;
    dailySpend: string;
    cacheSize: number;
    cacheHitRate: number;
    avgLatencyMs: number;
    errorRate: number;
  } {
    const total = this.metrics.totalClassifications;
    return {
      enabled: this.config.enabled && !!this.openai,
      model: this.config.model,
      callsThisMinute: rateLimitState.callsThisMinute,
      dailySpend: rateLimitState.dailySpend.toFixed(4),
      cacheSize: this.cache.size(),
      cacheHitRate: this.cache.getHitRate(),
      avgLatencyMs: Math.round(this.metrics.avgLatencyMs),
      errorRate: total > 0 ? this.metrics.errorCount / total : 0,
    };
  }

  /**
   * Reset metrics (for testing)
   */
  resetMetrics(): void {
    this.metrics = createEmptyMetrics();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ClassificationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Check if classifier is ready
   */
  isReady(): boolean {
    return this.config.enabled && !!this.openai;
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let classifierInstance: LLMClassifier | null = null;

/**
 * Get or create the LLM classifier singleton
 */
export function getClassifier(config?: Partial<ClassificationConfig>): LLMClassifier {
  if (!classifierInstance) {
    classifierInstance = new LLMClassifier(config);
  } else if (config) {
    classifierInstance.updateConfig(config);
  }
  return classifierInstance;
}

/**
 * Reset the classifier singleton (for testing)
 */
export function resetClassifier(): void {
  classifierInstance = null;
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Classify a single pair of markets
 */
export async function classifyMarketPair(
  input: ClassificationInput,
  config?: Partial<ClassificationConfig>
): Promise<ClassificationResult> {
  const classifier = getClassifier(config);
  return classifier.classify(input);
}

/**
 * Classify multiple pairs
 */
export async function classifyMarketPairs(
  inputs: ClassificationInput[],
  config?: Partial<ClassificationConfig>
): Promise<ClassificationResult[]> {
  const classifier = getClassifier(config);
  return classifier.classifyBatch(inputs);
}

/**
 * Check if classification is available
 */
export function isClassificationAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
