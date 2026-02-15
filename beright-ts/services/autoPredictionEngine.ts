/**
 * Auto-Prediction Engine
 *
 * Automatically makes predictions based on scanner opportunities:
 * - Listens to AutonomousScanner events
 * - Applies risk management (position sizing, diversification)
 * - Uses intelligence system for final decision
 * - Commits predictions on-chain
 * - Self-adjusts based on past performance
 *
 * Goal: Fully autonomous prediction-making with profit optimization
 */

import { EventEmitter } from 'events';
import { AutonomousScanner, OpportunityScore, getScanner } from './autonomousScanner';
import { smartPredict } from '../skills/smartPredict';
import { getIntelligence } from '../skills/intelligence';
import { generateLearnings } from '../skills/learnings';
import { db } from '../lib/supabase/client';

// Configuration
const ENGINE_CONFIG = {
  // Minimum opportunity score to act on
  minScoreToAct: 70,

  // Minimum confidence level to auto-predict
  minConfidence: 'medium' as 'high' | 'medium' | 'low',

  // Maximum predictions per day
  maxPredictionsPerDay: 10,

  // Maximum predictions per category per day
  maxPerCategory: 3,

  // Minimum edge (expected profit margin) to act
  minEdge: 0.10,

  // Cool-down between predictions (ms)
  predictionCooldownMs: 5 * 60 * 1000, // 5 minutes

  // Risk management
  riskManagement: {
    // Maximum exposure to any single market
    maxSingleMarketExposure: 0.20,

    // Maximum exposure to any category
    maxCategoryExposure: 0.40,

    // Diversification: min number of different categories
    minCategories: 2,

    // Stop making predictions if Brier score exceeds this
    maxAvgBrier: 0.30,
  },

  // Self-adjustment based on performance
  selfAdjustment: {
    // Categories to avoid if performance is poor (< 40% accuracy)
    poorPerformanceThreshold: 0.40,

    // Categories to favor if performance is good (> 70% accuracy)
    goodPerformanceThreshold: 0.70,

    // Minimum predictions in category to evaluate
    minPredictionsToEvaluate: 5,
  },
};

// Types
interface PredictionRecord {
  ticker: string;
  category: string;
  timestamp: Date;
  opportunity: OpportunityScore;
  predictionId?: string;
  success: boolean;
  error?: string;
}

interface EngineState {
  isRunning: boolean;
  predictionsToday: number;
  predictionsByCategory: Record<string, number>;
  lastPredictionTime: Date | null;
  recentPredictions: PredictionRecord[];
  avoidCategories: string[];
  favorCategories: string[];
  currentAvgBrier: number;
}

interface EngineStats {
  totalPredictions: number;
  successfulPredictions: number;
  failedPredictions: number;
  predictionsByCategory: Record<string, number>;
  avgBrierScore: number;
  profitableCategories: string[];
  unprofitableCategories: string[];
}

/**
 * Auto-Prediction Engine
 */
export class AutoPredictionEngine extends EventEmitter {
  private scanner: AutonomousScanner;
  private state: EngineState;
  private agentUserId: string;
  private dailyResetInterval: NodeJS.Timeout | null = null;

  constructor(agentUserId: string) {
    super();
    this.agentUserId = agentUserId;
    this.scanner = getScanner();

    this.state = {
      isRunning: false,
      predictionsToday: 0,
      predictionsByCategory: {},
      lastPredictionTime: null,
      recentPredictions: [],
      avoidCategories: [],
      favorCategories: [],
      currentAvgBrier: 0,
    };
  }

  /**
   * Start the auto-prediction engine
   */
  async start(): Promise<void> {
    if (this.state.isRunning) {
      console.log('[AutoPredict] Already running');
      return;
    }

    console.log('[AutoPredict] Starting auto-prediction engine...');
    this.state.isRunning = true;

    // Load historical performance for self-adjustment
    await this.loadPerformanceData();

    // Listen to scanner events
    this.scanner.on('highConfidenceOpportunities', this.handleOpportunities.bind(this));
    this.scanner.on('opportunitiesFound', this.handleAllOpportunities.bind(this));

    // Start the scanner if not already running
    this.scanner.start();

    // Reset daily counters at midnight
    this.scheduleDailyReset();

    this.emit('started');
    console.log('[AutoPredict] Engine started. Listening for opportunities...');
  }

  /**
   * Stop the engine
   */
  stop(): void {
    console.log('[AutoPredict] Stopping...');
    this.state.isRunning = false;

    this.scanner.removeAllListeners('highConfidenceOpportunities');
    this.scanner.removeAllListeners('opportunitiesFound');

    if (this.dailyResetInterval) {
      clearInterval(this.dailyResetInterval);
      this.dailyResetInterval = null;
    }

    this.emit('stopped');
  }

  /**
   * Handle high-confidence opportunities (priority)
   */
  private async handleOpportunities(opportunities: OpportunityScore[]): Promise<void> {
    console.log(`[AutoPredict] Received ${opportunities.length} high-confidence opportunities`);

    for (const opp of opportunities) {
      if (await this.shouldPredict(opp)) {
        await this.makePrediction(opp);
      }
    }
  }

  /**
   * Handle all opportunities (lower priority, filters for best)
   */
  private async handleAllOpportunities(opportunities: OpportunityScore[]): Promise<void> {
    // Only process if we haven't hit daily limits
    if (this.state.predictionsToday >= ENGINE_CONFIG.maxPredictionsPerDay) {
      return;
    }

    // Filter for opportunities that meet our criteria
    const actionable = opportunities.filter(
      o => o.overallScore >= ENGINE_CONFIG.minScoreToAct &&
        o.expectedEdge >= ENGINE_CONFIG.minEdge &&
        !this.state.avoidCategories.includes(o.category)
    );

    // Process top opportunities (favor preferred categories)
    const sorted = actionable.sort((a, b) => {
      // Boost score for favored categories
      const aBoost = this.state.favorCategories.includes(a.category) ? 10 : 0;
      const bBoost = this.state.favorCategories.includes(b.category) ? 10 : 0;
      return (b.overallScore + bBoost) - (a.overallScore + aBoost);
    });

    for (const opp of sorted.slice(0, 3)) {
      if (await this.shouldPredict(opp)) {
        await this.makePrediction(opp);
      }
    }
  }

  /**
   * Check if we should make a prediction
   */
  private async shouldPredict(opportunity: OpportunityScore): Promise<boolean> {
    // Check if engine is running
    if (!this.state.isRunning) return false;

    // Check daily limit
    if (this.state.predictionsToday >= ENGINE_CONFIG.maxPredictionsPerDay) {
      console.log('[AutoPredict] Daily limit reached');
      return false;
    }

    // Check category limit
    const categoryCount = this.state.predictionsByCategory[opportunity.category] || 0;
    if (categoryCount >= ENGINE_CONFIG.maxPerCategory) {
      console.log(`[AutoPredict] Category limit reached for ${opportunity.category}`);
      return false;
    }

    // Check cooldown
    if (this.state.lastPredictionTime) {
      const timeSince = Date.now() - this.state.lastPredictionTime.getTime();
      if (timeSince < ENGINE_CONFIG.predictionCooldownMs) {
        console.log('[AutoPredict] Cooldown active');
        return false;
      }
    }

    // Check if we're avoiding this category
    if (this.state.avoidCategories.includes(opportunity.category)) {
      console.log(`[AutoPredict] Avoiding category: ${opportunity.category}`);
      return false;
    }

    // Check minimum score
    if (opportunity.overallScore < ENGINE_CONFIG.minScoreToAct) {
      return false;
    }

    // Check minimum confidence
    const confidenceOrder = { high: 3, medium: 2, low: 1 };
    const minConfidenceValue = confidenceOrder[ENGINE_CONFIG.minConfidence];
    const oppConfidenceValue = confidenceOrder[opportunity.confidence];
    if (oppConfidenceValue < minConfidenceValue) {
      return false;
    }

    // Check minimum edge
    if (opportunity.expectedEdge < ENGINE_CONFIG.minEdge) {
      return false;
    }

    // Check if we already predicted on this market recently
    const recentOnSameMarket = this.state.recentPredictions.find(
      p => p.ticker === opportunity.ticker &&
        Date.now() - p.timestamp.getTime() < 24 * 60 * 60 * 1000
    );
    if (recentOnSameMarket) {
      console.log(`[AutoPredict] Already predicted on ${opportunity.ticker} recently`);
      return false;
    }

    // Check overall Brier score isn't too high
    if (this.state.currentAvgBrier > ENGINE_CONFIG.riskManagement.maxAvgBrier) {
      console.log('[AutoPredict] Avg Brier too high, pausing predictions');
      return false;
    }

    return true;
  }

  /**
   * Make a prediction
   */
  private async makePrediction(opportunity: OpportunityScore): Promise<void> {
    console.log(`[AutoPredict] Making prediction on ${opportunity.ticker}...`);
    console.log(`  Title: ${opportunity.title.slice(0, 50)}...`);
    console.log(`  Direction: ${opportunity.suggestedDirection} @ ${(opportunity.suggestedProbability * 100).toFixed(0)}%`);
    console.log(`  Reasoning: ${opportunity.reasoning}`);

    const record: PredictionRecord = {
      ticker: opportunity.ticker,
      category: opportunity.category,
      timestamp: new Date(),
      opportunity,
      success: false,
    };

    try {
      // Double-check with intelligence system
      const intel = await getIntelligence(opportunity.title, opportunity.ticker);

      // Verify our analysis aligns with intelligence
      const intelMidpoint = (intel.recommendedRange.low + intel.recommendedRange.high) / 2;
      const divergenceFromIntel = Math.abs(opportunity.suggestedProbability - intelMidpoint);

      if (divergenceFromIntel > 0.20) {
        console.log(`[AutoPredict] Intelligence diverges too much (${(divergenceFromIntel * 100).toFixed(0)}%), skipping`);
        record.error = 'Intelligence divergence too high';
        this.state.recentPredictions.push(record);
        return;
      }

      // Use intelligence-adjusted probability
      const adjustedProbability = (opportunity.suggestedProbability + intelMidpoint) / 2;

      // Build reasoning
      const reasoning = [
        opportunity.reasoning,
        `Base rate: ${(intel.baseRate.rate * 100).toFixed(0)}%`,
        `Market divergence: ${(opportunity.baseRateDivergence * 100).toFixed(0)}%`,
        ...intel.biasWarnings.map(w => `Bias warning: ${w}`),
        `Auto-prediction confidence: ${opportunity.confidence}`,
      ].join(' | ');

      // Make the prediction
      const result = await smartPredict(
        opportunity.title,
        adjustedProbability,
        opportunity.suggestedDirection,
        this.agentUserId,
        {
          reasoning,
          forceMarketTicker: opportunity.ticker,
          skipIntelligence: true, // Already checked
        }
      );

      if (result.prediction) {
        record.success = true;
        record.predictionId = result.prediction.id;

        // Update state
        this.state.predictionsToday++;
        this.state.predictionsByCategory[opportunity.category] =
          (this.state.predictionsByCategory[opportunity.category] || 0) + 1;
        this.state.lastPredictionTime = new Date();

        console.log(`[AutoPredict] Successfully predicted on ${opportunity.ticker}`);
        console.log(`  Prediction ID: ${result.prediction.id}`);

        this.emit('predictionMade', {
          opportunity,
          prediction: result.prediction,
          adjustedProbability,
        });
      } else {
        record.error = 'Prediction creation failed';
        console.log(`[AutoPredict] Failed to predict: ${record.error}`);
      }
    } catch (err) {
      record.error = err instanceof Error ? err.message : String(err);
      console.error(`[AutoPredict] Error making prediction:`, err);
    }

    this.state.recentPredictions.push(record);

    // Keep only last 100 records
    if (this.state.recentPredictions.length > 100) {
      this.state.recentPredictions = this.state.recentPredictions.slice(-100);
    }
  }

  /**
   * Load historical performance data for self-adjustment
   */
  private async loadPerformanceData(): Promise<void> {
    try {
      const learnings = await generateLearnings(this.agentUserId, 100);

      if (!learnings) {
        console.log('[AutoPredict] No historical data for self-adjustment');
        return;
      }

      this.state.currentAvgBrier = learnings.summary.avgBrier;

      // Analyze category performance
      const categoryPerformance: Record<string, { correct: number; total: number }> = {};

      for (const lesson of learnings.lessons) {
        // Extract category from question (simplified)
        const category = this.inferCategory(lesson.question);
        if (!categoryPerformance[category]) {
          categoryPerformance[category] = { correct: 0, total: 0 };
        }
        categoryPerformance[category].total++;
        if (lesson.wasCorrect) categoryPerformance[category].correct++;
      }

      // Determine categories to avoid/favor
      this.state.avoidCategories = [];
      this.state.favorCategories = [];

      for (const [category, perf] of Object.entries(categoryPerformance)) {
        if (perf.total < ENGINE_CONFIG.selfAdjustment.minPredictionsToEvaluate) continue;

        const accuracy = perf.correct / perf.total;
        if (accuracy < ENGINE_CONFIG.selfAdjustment.poorPerformanceThreshold) {
          this.state.avoidCategories.push(category);
          console.log(`[AutoPredict] Avoiding category: ${category} (${(accuracy * 100).toFixed(0)}% accuracy)`);
        } else if (accuracy > ENGINE_CONFIG.selfAdjustment.goodPerformanceThreshold) {
          this.state.favorCategories.push(category);
          console.log(`[AutoPredict] Favoring category: ${category} (${(accuracy * 100).toFixed(0)}% accuracy)`);
        }
      }

      console.log(`[AutoPredict] Loaded performance data. Avg Brier: ${this.state.currentAvgBrier.toFixed(4)}`);
    } catch (err) {
      console.error('[AutoPredict] Error loading performance data:', err);
    }
  }

  /**
   * Infer category from question text
   */
  private inferCategory(question: string): string {
    const lower = question.toLowerCase();

    if (lower.match(/bitcoin|btc|ethereum|eth|crypto|solana|sol|defi/)) return 'crypto';
    if (lower.match(/president|election|congress|senate|vote|trump|biden|democrat|republican/)) return 'politics';
    if (lower.match(/fed|inflation|gdp|unemployment|recession|economy|rates|cpi/)) return 'economics';
    if (lower.match(/nfl|nba|mlb|nhl|championship|playoff|super bowl|world cup/)) return 'sports';
    if (lower.match(/ai|openai|chatgpt|google|apple|microsoft|nvidia|tech|ipo/)) return 'tech';
    if (lower.match(/climate|weather|hurricane|earthquake|temperature/)) return 'climate';
    if (lower.match(/war|military|conflict|ukraine|russia|china|taiwan/)) return 'geopolitics';

    return 'general';
  }

  /**
   * Schedule daily reset of counters
   */
  private scheduleDailyReset(): void {
    // Calculate ms until midnight
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const msUntilMidnight = midnight.getTime() - now.getTime();

    // Reset at midnight, then every 24 hours
    setTimeout(() => {
      this.resetDailyCounters();
      this.dailyResetInterval = setInterval(() => {
        this.resetDailyCounters();
      }, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
  }

  /**
   * Reset daily prediction counters
   */
  private resetDailyCounters(): void {
    console.log('[AutoPredict] Resetting daily counters');
    this.state.predictionsToday = 0;
    this.state.predictionsByCategory = {};

    // Reload performance data for self-adjustment
    this.loadPerformanceData();
  }

  /**
   * Get engine status
   */
  getStatus(): EngineState & { config: typeof ENGINE_CONFIG } {
    return {
      ...this.state,
      config: ENGINE_CONFIG,
    };
  }

  /**
   * Get engine statistics
   */
  async getStats(): Promise<EngineStats> {
    const successful = this.state.recentPredictions.filter(p => p.success);
    const failed = this.state.recentPredictions.filter(p => !p.success);

    const categoryCount: Record<string, number> = {};
    for (const pred of successful) {
      categoryCount[pred.category] = (categoryCount[pred.category] || 0) + 1;
    }

    return {
      totalPredictions: this.state.recentPredictions.length,
      successfulPredictions: successful.length,
      failedPredictions: failed.length,
      predictionsByCategory: categoryCount,
      avgBrierScore: this.state.currentAvgBrier,
      profitableCategories: this.state.favorCategories,
      unprofitableCategories: this.state.avoidCategories,
    };
  }

  /**
   * Force a scan and prediction cycle
   */
  async forceCycle(): Promise<{ scanned: number; predicted: number }> {
    console.log('[AutoPredict] Forcing scan and prediction cycle...');

    const scanResult = await this.scanner.scan();
    let predicted = 0;

    for (const opp of scanResult.topOpportunities) {
      if (await this.shouldPredict(opp)) {
        await this.makePrediction(opp);
        predicted++;
      }
    }

    return {
      scanned: scanResult.marketsScanned,
      predicted,
    };
  }
}

// Singleton instance
let engineInstance: AutoPredictionEngine | null = null;

export function getAutoPredictionEngine(agentUserId?: string): AutoPredictionEngine {
  if (!engineInstance) {
    if (!agentUserId) {
      throw new Error('Agent user ID required for first initialization');
    }
    engineInstance = new AutoPredictionEngine(agentUserId);
  }
  return engineInstance;
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2] || 'status';
  const agentUserId = process.env.AUTONOMOUS_AGENT_USER_ID || 'autonomous-agent';

  const engine = new AutoPredictionEngine(agentUserId);

  switch (command) {
    case 'start':
    case 'daemon':
      engine.on('predictionMade', ({ opportunity, prediction }) => {
        console.log(`\n✅ PREDICTION MADE`);
        console.log(`  Market: ${opportunity.ticker}`);
        console.log(`  Title: ${opportunity.title.slice(0, 50)}...`);
        console.log(`  Direction: ${opportunity.suggestedDirection}`);
        console.log(`  Prediction ID: ${prediction.id}`);
      });

      engine.start().then(() => {
        console.log('\n🤖 Auto-prediction engine running...');
        console.log('Press Ctrl+C to stop\n');
      });

      process.on('SIGINT', () => {
        engine.stop();
        process.exit(0);
      });
      break;

    case 'once':
      engine.start().then(async () => {
        const result = await engine.forceCycle();
        console.log(`\n📊 Cycle Complete`);
        console.log(`  Markets scanned: ${result.scanned}`);
        console.log(`  Predictions made: ${result.predicted}`);
        engine.stop();
        process.exit(0);
      });
      break;

    case 'status':
    default:
      console.log('\n🤖 Auto-Prediction Engine');
      console.log('═'.repeat(40));
      console.log(`Status: ${engine.getStatus().isRunning ? 'Running' : 'Stopped'}`);
      console.log(`Predictions today: ${engine.getStatus().predictionsToday}`);
      console.log(`\nConfiguration:`);
      console.log(`  Max predictions/day: ${ENGINE_CONFIG.maxPredictionsPerDay}`);
      console.log(`  Min score to act: ${ENGINE_CONFIG.minScoreToAct}`);
      console.log(`  Min edge required: ${(ENGINE_CONFIG.minEdge * 100).toFixed(0)}%`);
      console.log(`\nUsage:`);
      console.log(`  ts-node autoPredictionEngine.ts start   # Run continuously`);
      console.log(`  ts-node autoPredictionEngine.ts once    # Run one cycle`);
      console.log(`  ts-node autoPredictionEngine.ts status  # Show status`);
      process.exit(0);
  }
}

export type { PredictionRecord, EngineState, EngineStats };
export { ENGINE_CONFIG };
