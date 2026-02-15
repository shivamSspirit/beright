/**
 * Autonomous Opportunity Scanner
 *
 * Continuously scans markets to find prediction opportunities:
 * - Markets with base rate divergence (mispriced)
 * - High-volume markets closing soon
 * - Markets matching agent's strengths
 * - Markets with unusual price movements
 *
 * Goal: Find opportunities where the autonomous agent can make profitable predictions
 */

import { EventEmitter } from 'events';
import { getHotMarkets, calculateBaseRate } from '../lib/dflow/api';
import { getIntelligence } from '../skills/intelligence';

// Types
interface HotMarket {
  ticker: string;
  title: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  closeTime?: string;
}

interface OpportunityScore {
  ticker: string;
  title: string;
  category: string;
  currentPrice: number;
  volume: number;
  closeTime?: string;

  // Opportunity metrics
  baseRateDivergence: number; // How much price differs from base rate
  confidence: 'high' | 'medium' | 'low';
  opportunityType: 'mispriced' | 'high_volume' | 'closing_soon' | 'trending';

  // Suggested action
  suggestedDirection: 'YES' | 'NO';
  suggestedProbability: number;
  expectedEdge: number; // Expected profit margin

  // Analysis
  reasoning: string;
  biasWarnings: string[];

  // Scoring
  overallScore: number; // 0-100
}

interface ScanResult {
  timestamp: string;
  marketsScanned: number;
  opportunitiesFound: number;
  topOpportunities: OpportunityScore[];
}

// Configuration
const SCAN_CONFIG = {
  // Minimum score to consider an opportunity
  minOpportunityScore: 60,

  // Minimum base rate divergence to flag as mispriced
  minDivergence: 0.15,

  // Minimum volume for consideration
  minVolume: 1000,

  // How many markets to scan per run
  marketsPerScan: 50,

  // Categories to focus on (empty = all)
  focusCategories: [] as string[],
};

/**
 * Categorize a market based on title keywords
 */
function categorizeMarket(title: string): string {
  const lower = title.toLowerCase();

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
 * Calculate opportunity score for a market
 */
async function scoreOpportunity(market: HotMarket): Promise<OpportunityScore | null> {
  try {
    const currentPrice = market.yesPrice || 0.5;
    const category = categorizeMarket(market.title);

    // Skip if below minimum volume
    if ((market.volume || 0) < SCAN_CONFIG.minVolume) {
      return null;
    }

    // Skip if category not in focus (when focus is set)
    if (SCAN_CONFIG.focusCategories.length > 0 && !SCAN_CONFIG.focusCategories.includes(category)) {
      return null;
    }

    // Get intelligence for this market
    let baseRate = 0.5;
    let biasWarnings: string[] = [];
    let recommendedRange = { low: 0.3, high: 0.7 };

    try {
      const intel = await getIntelligence(market.title, market.ticker);
      baseRate = intel.baseRate.rate;
      biasWarnings = intel.biasWarnings;
      recommendedRange = intel.recommendedRange;
    } catch (err) {
      // Use default if intelligence fails
    }

    // Calculate divergence from base rate
    const divergence = Math.abs(currentPrice - baseRate);

    // Determine if opportunity exists
    let opportunityType: OpportunityScore['opportunityType'] = 'trending';
    let score = 50;
    let reasoning = '';
    let suggestedDirection: 'YES' | 'NO' = 'YES';
    let suggestedProbability = 0.5;

    // Check for mispricing (base rate divergence)
    if (divergence >= SCAN_CONFIG.minDivergence) {
      opportunityType = 'mispriced';
      score += divergence * 100; // More divergence = higher score

      if (currentPrice > baseRate) {
        // Market is overpriced YES, bet NO
        suggestedDirection = 'NO';
        suggestedProbability = 1 - baseRate;
        reasoning = `Market at ${(currentPrice * 100).toFixed(0)}% but base rate suggests ${(baseRate * 100).toFixed(0)}%. Potential YES overpricing.`;
      } else {
        // Market is underpriced YES, bet YES
        suggestedDirection = 'YES';
        suggestedProbability = baseRate;
        reasoning = `Market at ${(currentPrice * 100).toFixed(0)}% but base rate suggests ${(baseRate * 100).toFixed(0)}%. Potential YES underpricing.`;
      }
    }

    // Check for high volume (more reliable pricing but opportunities exist)
    if ((market.volume || 0) > 10000) {
      score += 10;
      if (opportunityType === 'trending') {
        opportunityType = 'high_volume';
        reasoning = 'High volume market with reliable pricing.';
      }
    }

    // Check for closing soon (time pressure creates opportunities)
    if (market.closeTime) {
      const hoursUntilClose = (new Date(market.closeTime).getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntilClose <= 48 && hoursUntilClose > 0) {
        score += 15;
        if (opportunityType === 'trending') {
          opportunityType = 'closing_soon';
          reasoning = `Market closing in ${Math.round(hoursUntilClose)} hours.`;
        }
      }
    }

    // Calculate expected edge
    const marketProb = suggestedDirection === 'YES' ? currentPrice : 1 - currentPrice;
    const expectedEdge = Math.abs(suggestedProbability - marketProb);

    // Adjust score based on confidence
    let confidence: 'high' | 'medium' | 'low' = 'medium';
    if (divergence > 0.25 && (market.volume || 0) > 5000) {
      confidence = 'high';
      score += 15;
    } else if (divergence < 0.1 || (market.volume || 0) < 2000) {
      confidence = 'low';
      score -= 10;
    }

    // Skip low-score opportunities
    if (score < SCAN_CONFIG.minOpportunityScore) {
      return null;
    }

    return {
      ticker: market.ticker,
      title: market.title,
      category,
      currentPrice,
      volume: market.volume || 0,
      closeTime: market.closeTime ? new Date(market.closeTime).toISOString() : undefined,

      baseRateDivergence: divergence,
      confidence,
      opportunityType,

      suggestedDirection,
      suggestedProbability,
      expectedEdge,

      reasoning: reasoning || 'Trending market worth monitoring.',
      biasWarnings,

      overallScore: Math.min(100, Math.max(0, score)),
    };
  } catch (err) {
    console.error(`[Scanner] Error scoring ${market.ticker}:`, err);
    return null;
  }
}

/**
 * Autonomous Scanner Service
 */
export class AutonomousScanner extends EventEmitter {
  private isRunning = false;
  private scanInterval: NodeJS.Timeout | null = null;
  private lastScan: ScanResult | null = null;

  // Scan frequency in ms (default: 30 minutes)
  private scanFrequencyMs = 30 * 60 * 1000;

  constructor(options?: { scanFrequencyMs?: number }) {
    super();
    if (options?.scanFrequencyMs) this.scanFrequencyMs = options.scanFrequencyMs;
  }

  /**
   * Start autonomous scanning
   */
  start(): void {
    if (this.isRunning) {
      console.log('[Scanner] Already running');
      return;
    }

    console.log('[Scanner] Starting autonomous opportunity scanner...');
    this.isRunning = true;

    // Initial scan
    this.scan();

    // Schedule periodic scans
    this.scanInterval = setInterval(() => {
      this.scan();
    }, this.scanFrequencyMs);

    this.emit('started');
  }

  /**
   * Stop scanning
   */
  stop(): void {
    console.log('[Scanner] Stopping...');
    this.isRunning = false;

    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }

    this.emit('stopped');
  }

  /**
   * Run a single scan
   */
  async scan(): Promise<ScanResult> {
    console.log('[Scanner] Running opportunity scan...');
    const startTime = Date.now();

    try {
      // Get hot markets
      const markets = await getHotMarkets(SCAN_CONFIG.marketsPerScan);
      console.log(`[Scanner] Scanning ${markets.length} markets...`);

      // Score each market
      const opportunities: OpportunityScore[] = [];

      for (const market of markets) {
        const score = await scoreOpportunity(market);
        if (score) {
          opportunities.push(score);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Sort by score
      opportunities.sort((a, b) => b.overallScore - a.overallScore);

      const result: ScanResult = {
        timestamp: new Date().toISOString(),
        marketsScanned: markets.length,
        opportunitiesFound: opportunities.length,
        topOpportunities: opportunities.slice(0, 10),
      };

      this.lastScan = result;

      const duration = (Date.now() - startTime) / 1000;
      console.log(`[Scanner] Scan complete in ${duration.toFixed(1)}s. Found ${opportunities.length} opportunities.`);

      // Emit events for top opportunities
      if (opportunities.length > 0) {
        this.emit('opportunitiesFound', opportunities);

        // Emit high-confidence opportunities separately
        const highConfidence = opportunities.filter(o => o.confidence === 'high');
        if (highConfidence.length > 0) {
          this.emit('highConfidenceOpportunities', highConfidence);
        }
      }

      return result;
    } catch (err) {
      console.error('[Scanner] Scan error:', err);
      this.emit('error', err);

      return {
        timestamp: new Date().toISOString(),
        marketsScanned: 0,
        opportunitiesFound: 0,
        topOpportunities: [],
      };
    }
  }

  /**
   * Get last scan result
   */
  getLastScan(): ScanResult | null {
    return this.lastScan;
  }

  /**
   * Get current status
   */
  getStatus(): {
    isRunning: boolean;
    lastScanTime?: string;
    opportunitiesFound: number;
  } {
    return {
      isRunning: this.isRunning,
      lastScanTime: this.lastScan?.timestamp,
      opportunitiesFound: this.lastScan?.opportunitiesFound || 0,
    };
  }
}

// Singleton instance
let scannerInstance: AutonomousScanner | null = null;

export function getScanner(): AutonomousScanner {
  if (!scannerInstance) {
    scannerInstance = new AutonomousScanner();
  }
  return scannerInstance;
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2] || 'once';

  const scanner = new AutonomousScanner({ scanFrequencyMs: 60000 });

  switch (command) {
    case 'daemon':
    case 'start':
      scanner.on('opportunitiesFound', (opps: OpportunityScore[]) => {
        console.log(`\n🎯 Found ${opps.length} opportunities:`);
        for (const opp of opps.slice(0, 5)) {
          console.log(`  ${opp.ticker}: ${opp.title.slice(0, 40)}...`);
          console.log(`    Score: ${opp.overallScore} | ${opp.opportunityType} | ${opp.suggestedDirection} @ ${(opp.suggestedProbability * 100).toFixed(0)}%`);
          console.log(`    Reasoning: ${opp.reasoning}`);
        }
      });

      scanner.start();

      process.on('SIGINT', () => {
        scanner.stop();
        process.exit(0);
      });
      break;

    case 'once':
    default:
      scanner.scan().then(result => {
        console.log('\n📊 Scan Results');
        console.log('═'.repeat(50));
        console.log(`Markets scanned: ${result.marketsScanned}`);
        console.log(`Opportunities found: ${result.opportunitiesFound}`);

        if (result.topOpportunities.length > 0) {
          console.log('\n🎯 Top Opportunities:');
          for (const opp of result.topOpportunities) {
            console.log(`\n${opp.ticker}`);
            console.log(`  ${opp.title}`);
            console.log(`  Score: ${opp.overallScore} | Type: ${opp.opportunityType}`);
            console.log(`  Current: ${(opp.currentPrice * 100).toFixed(0)}% | Suggested: ${opp.suggestedDirection} @ ${(opp.suggestedProbability * 100).toFixed(0)}%`);
            console.log(`  Edge: ${(opp.expectedEdge * 100).toFixed(1)}% | Confidence: ${opp.confidence}`);
            console.log(`  Reasoning: ${opp.reasoning}`);
          }
        }

        process.exit(0);
      }).catch(console.error);
  }
}

export type { OpportunityScore, ScanResult };
export { SCAN_CONFIG, categorizeMarket, scoreOpportunity };
