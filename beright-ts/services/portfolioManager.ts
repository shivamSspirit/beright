/**
 * Portfolio Manager
 *
 * Tracks and manages all autonomous predictions:
 * - Portfolio view of all active predictions
 * - Risk exposure analysis
 * - Category diversification tracking
 * - Position sizing recommendations
 * - Performance attribution
 * - Exit strategy management
 *
 * Goal: Professional-grade portfolio management for prediction positions
 */

import { EventEmitter } from 'events';
import { db } from '../lib/supabase/client';
import { getMarket, DFlowMarket } from '../lib/dflow/api';
import { interpretBrierScore } from '../lib/onchain/memo';

// Types
interface Position {
  id: string;
  marketTicker: string;
  marketTitle: string;
  category: string;
  direction: 'YES' | 'NO';
  probability: number;
  entryPrice: number;
  currentPrice: number;
  createdAt: Date;
  expiresAt?: Date;

  // P&L
  unrealizedPnL: number; // Positive if position is profitable
  pnlPercent: number;

  // Market data
  marketVolume: number;
  marketStatus: 'active' | 'closed' | 'resolved';

  // Risk metrics
  daysToExpiry?: number;
  volatility?: number;
  riskScore: number; // 0-100
}

interface CategoryExposure {
  category: string;
  positionCount: number;
  totalExposure: number;
  avgProbability: number;
  avgPnL: number;
  riskLevel: 'low' | 'medium' | 'high';
}

interface PortfolioSummary {
  timestamp: string;
  userId: string;

  // Position counts
  totalPositions: number;
  activePositions: number;
  pendingResolution: number;
  resolvedToday: number;

  // Performance
  totalUnrealizedPnL: number;
  avgBrierScore: number;
  winRate: number;
  bestPosition?: Position;
  worstPosition?: Position;

  // Risk analysis
  categoryExposure: CategoryExposure[];
  concentrationRisk: number; // 0-100, higher = more concentrated
  expiryRisk: number; // Count of positions expiring soon

  // Diversification
  categoryCoverage: number; // 0-1, how diversified across categories
  avgPositionSize: number;

  // Recommendations
  recommendations: string[];
  alertPositions: Position[]; // Positions needing attention
}

interface ExitRecommendation {
  positionId: string;
  marketTicker: string;
  reason: 'take_profit' | 'stop_loss' | 'expiry_near' | 'rebalance' | 'poor_calibration';
  urgency: 'immediate' | 'soon' | 'optional';
  message: string;
}

// Configuration
const PORTFOLIO_CONFIG = {
  // Risk thresholds
  maxCategoryExposure: 0.40, // No more than 40% in one category
  maxSinglePositionSize: 0.15, // No single position > 15% of portfolio
  expiryWarningDays: 3,

  // P&L thresholds
  takeProfitThreshold: 0.30, // 30% gain
  stopLossThreshold: -0.20, // 20% loss

  // Rebalancing
  rebalanceThreshold: 0.50, // Rebalance if any category > 50%

  // Categories
  knownCategories: ['crypto', 'politics', 'economics', 'sports', 'tech', 'climate', 'geopolitics', 'general'],
};

/**
 * Portfolio Manager
 */
export class PortfolioManager extends EventEmitter {
  private userId: string;
  private positions: Map<string, Position> = new Map();
  private lastUpdate: Date | null = null;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(userId: string) {
    super();
    this.userId = userId;
  }

  /**
   * Start portfolio monitoring
   */
  start(updateIntervalMs: number = 5 * 60 * 1000): void {
    console.log('[Portfolio] Starting portfolio manager...');

    // Initial load
    this.refresh();

    // Periodic updates
    this.updateInterval = setInterval(() => {
      this.refresh();
    }, updateIntervalMs);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Refresh portfolio data
   */
  async refresh(): Promise<void> {
    try {
      // Get all predictions
      const predictions = await db.predictions.getByUser(this.userId);

      // Separate pending and resolved
      const pending = predictions.filter(p => !p.resolved_at);

      // Convert to positions
      this.positions.clear();

      for (const pred of pending) {
        const position = await this.predictionToPosition(pred);
        if (position) {
          this.positions.set(position.id, position);
        }
      }

      this.lastUpdate = new Date();
      this.emit('updated', this.getPortfolio());

      // Check for alerts
      this.checkAlerts();

    } catch (err) {
      console.error('[Portfolio] Refresh error:', err);
      this.emit('error', err);
    }
  }

  /**
   * Convert prediction to position with current market data
   */
  private async predictionToPosition(pred: any): Promise<Position | null> {
    try {
      // Try to get current market data
      let currentPrice = pred.predicted_probability;
      let marketVolume = 0;
      let marketStatus: Position['marketStatus'] = 'active';
      let expiresAt: Date | undefined;

      if (pred.market_id) {
        try {
          const result = await getMarket(pred.market_id);
          if (result.success && result.data) {
            const market = result.data;
            currentPrice = parseFloat(market.yesBid || String(pred.predicted_probability));
            marketVolume = market.volume || 0;
            marketStatus = (market.status === 'determined' || market.status === 'finalized') ? 'resolved' : 'active';
            if (market.closeTime) {
              expiresAt = new Date(market.closeTime);
            }
          }
        } catch {
          // Use prediction data if market fetch fails
        }
      }

      // Adjust for direction
      const entryPrice = pred.direction === 'YES' ? pred.predicted_probability : 1 - pred.predicted_probability;
      const currentPositionPrice = pred.direction === 'YES' ? currentPrice : 1 - currentPrice;

      // Calculate P&L
      const unrealizedPnL = currentPositionPrice - entryPrice;
      const pnlPercent = entryPrice > 0 ? unrealizedPnL / entryPrice : 0;

      // Calculate risk score
      let riskScore = 50;
      if (Math.abs(pnlPercent) > 0.20) riskScore += 20; // Volatile position
      if (expiresAt) {
        const daysToExpiry = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
        if (daysToExpiry < 1) riskScore += 30;
        else if (daysToExpiry < 3) riskScore += 15;
      }
      if (marketVolume < 1000) riskScore += 10; // Low liquidity

      const category = this.inferCategory(pred.question || '');
      const daysToExpiry = expiresAt
        ? (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        : undefined;

      return {
        id: pred.id,
        marketTicker: pred.market_id || 'unknown',
        marketTitle: pred.question || 'Unknown market',
        category,
        direction: pred.direction as 'YES' | 'NO',
        probability: pred.predicted_probability,
        entryPrice,
        currentPrice: currentPositionPrice,
        createdAt: new Date(pred.created_at),
        expiresAt,
        unrealizedPnL,
        pnlPercent,
        marketVolume,
        marketStatus,
        daysToExpiry,
        riskScore: Math.min(100, riskScore),
      };
    } catch (err) {
      console.error('[Portfolio] Error converting prediction:', err);
      return null;
    }
  }

  /**
   * Get current portfolio
   */
  getPortfolio(): Position[] {
    return Array.from(this.positions.values());
  }

  /**
   * Get portfolio summary
   */
  async getSummary(): Promise<PortfolioSummary> {
    await this.refresh();

    const positions = this.getPortfolio();
    const activePositions = positions.filter(p => p.marketStatus === 'active');

    // Get resolved predictions for performance metrics
    const allPredictions = await db.predictions.getByUser(this.userId);
    const resolved = allPredictions.filter(p => p.resolved_at && p.brier_score !== null);

    // Calculate performance metrics
    const avgBrier = resolved.length > 0
      ? resolved.reduce((sum, p) => sum + (p.brier_score || 0), 0) / resolved.length
      : 0;

    const winCount = resolved.filter(p => (p.direction === 'YES') === p.outcome).length;
    const winRate = resolved.length > 0 ? winCount / resolved.length : 0;

    // Find best/worst positions
    const sortedByPnL = [...activePositions].sort((a, b) => b.pnlPercent - a.pnlPercent);
    const bestPosition = sortedByPnL[0];
    const worstPosition = sortedByPnL[sortedByPnL.length - 1];

    // Calculate category exposure
    const categoryExposure = this.calculateCategoryExposure(activePositions);

    // Calculate concentration risk (Herfindahl index)
    const concentrationRisk = this.calculateConcentration(categoryExposure);

    // Count positions expiring soon
    const expiryRisk = activePositions.filter(
      p => p.daysToExpiry !== undefined && p.daysToExpiry < PORTFOLIO_CONFIG.expiryWarningDays
    ).length;

    // Calculate diversification
    const uniqueCategories = new Set(activePositions.map(p => p.category));
    const categoryCoverage = uniqueCategories.size / PORTFOLIO_CONFIG.knownCategories.length;

    // Total unrealized P&L
    const totalUnrealizedPnL = activePositions.reduce((sum, p) => sum + p.unrealizedPnL, 0);

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      activePositions,
      categoryExposure,
      concentrationRisk
    );

    // Identify alert positions
    const alertPositions = activePositions.filter(p =>
      p.riskScore > 70 ||
      p.pnlPercent > PORTFOLIO_CONFIG.takeProfitThreshold ||
      p.pnlPercent < PORTFOLIO_CONFIG.stopLossThreshold ||
      (p.daysToExpiry !== undefined && p.daysToExpiry < 1)
    );

    // Count resolved today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const resolvedToday = resolved.filter(
      p => p.resolved_at && new Date(p.resolved_at) >= today
    ).length;

    return {
      timestamp: new Date().toISOString(),
      userId: this.userId,
      totalPositions: positions.length,
      activePositions: activePositions.length,
      pendingResolution: positions.filter(p => p.marketStatus === 'closed').length,
      resolvedToday,
      totalUnrealizedPnL,
      avgBrierScore: avgBrier,
      winRate,
      bestPosition,
      worstPosition,
      categoryExposure,
      concentrationRisk,
      expiryRisk,
      categoryCoverage,
      avgPositionSize: activePositions.length > 0 ? 1 / activePositions.length : 0,
      recommendations,
      alertPositions,
    };
  }

  /**
   * Calculate exposure by category
   */
  private calculateCategoryExposure(positions: Position[]): CategoryExposure[] {
    const categories: Record<string, Position[]> = {};

    for (const pos of positions) {
      if (!categories[pos.category]) {
        categories[pos.category] = [];
      }
      categories[pos.category].push(pos);
    }

    const total = positions.length;

    return Object.entries(categories).map(([category, catPositions]) => {
      const exposure = total > 0 ? catPositions.length / total : 0;
      const avgProb = catPositions.reduce((sum, p) => sum + p.probability, 0) / catPositions.length;
      const avgPnL = catPositions.reduce((sum, p) => sum + p.pnlPercent, 0) / catPositions.length;

      let riskLevel: CategoryExposure['riskLevel'] = 'low';
      if (exposure > PORTFOLIO_CONFIG.maxCategoryExposure) riskLevel = 'high';
      else if (exposure > PORTFOLIO_CONFIG.maxCategoryExposure * 0.7) riskLevel = 'medium';

      return {
        category,
        positionCount: catPositions.length,
        totalExposure: exposure,
        avgProbability: avgProb,
        avgPnL,
        riskLevel,
      };
    }).sort((a, b) => b.totalExposure - a.totalExposure);
  }

  /**
   * Calculate concentration risk (Herfindahl-Hirschman Index style)
   */
  private calculateConcentration(categoryExposure: CategoryExposure[]): number {
    if (categoryExposure.length === 0) return 0;

    const hhi = categoryExposure.reduce(
      (sum, cat) => sum + Math.pow(cat.totalExposure * 100, 2),
      0
    );

    // Normalize to 0-100 scale
    // Perfect diversification across 8 categories = 1250 HHI
    // Single category = 10000 HHI
    return Math.min(100, (hhi - 1250) / (10000 - 1250) * 100);
  }

  /**
   * Generate portfolio recommendations
   */
  private generateRecommendations(
    positions: Position[],
    categoryExposure: CategoryExposure[],
    concentrationRisk: number
  ): string[] {
    const recommendations: string[] = [];

    // Concentration warning
    if (concentrationRisk > 60) {
      recommendations.push('High concentration risk. Consider diversifying across more categories.');
    }

    // Category-specific warnings
    for (const cat of categoryExposure) {
      if (cat.riskLevel === 'high') {
        recommendations.push(`Over-exposed to ${cat.category} (${(cat.totalExposure * 100).toFixed(0)}%). Consider reducing positions.`);
      }
    }

    // Expiry warnings
    const expiringPositions = positions.filter(
      p => p.daysToExpiry !== undefined && p.daysToExpiry < PORTFOLIO_CONFIG.expiryWarningDays
    );
    if (expiringPositions.length > 0) {
      recommendations.push(`${expiringPositions.length} position(s) expiring within ${PORTFOLIO_CONFIG.expiryWarningDays} days.`);
    }

    // Take profit opportunities
    const profitablePositions = positions.filter(
      p => p.pnlPercent > PORTFOLIO_CONFIG.takeProfitThreshold
    );
    if (profitablePositions.length > 0) {
      recommendations.push(`${profitablePositions.length} position(s) up >30%. Consider taking profit.`);
    }

    // Stop loss warnings
    const losingPositions = positions.filter(
      p => p.pnlPercent < PORTFOLIO_CONFIG.stopLossThreshold
    );
    if (losingPositions.length > 0) {
      recommendations.push(`${losingPositions.length} position(s) down >20%. Review or cut losses.`);
    }

    // Diversification suggestion
    const categories = new Set(positions.map(p => p.category));
    if (categories.size < 3 && positions.length >= 5) {
      recommendations.push('Low category diversity. Look for opportunities in different sectors.');
    }

    return recommendations;
  }

  /**
   * Get exit recommendations
   */
  getExitRecommendations(): ExitRecommendation[] {
    const recommendations: ExitRecommendation[] = [];
    const positions = this.getPortfolio();

    for (const pos of positions) {
      // Take profit
      if (pos.pnlPercent > PORTFOLIO_CONFIG.takeProfitThreshold) {
        recommendations.push({
          positionId: pos.id,
          marketTicker: pos.marketTicker,
          reason: 'take_profit',
          urgency: 'optional',
          message: `Position up ${(pos.pnlPercent * 100).toFixed(1)}%. Consider taking profit.`,
        });
      }

      // Stop loss
      if (pos.pnlPercent < PORTFOLIO_CONFIG.stopLossThreshold) {
        recommendations.push({
          positionId: pos.id,
          marketTicker: pos.marketTicker,
          reason: 'stop_loss',
          urgency: 'soon',
          message: `Position down ${(Math.abs(pos.pnlPercent) * 100).toFixed(1)}%. Consider cutting losses.`,
        });
      }

      // Expiry near
      if (pos.daysToExpiry !== undefined && pos.daysToExpiry < 1) {
        recommendations.push({
          positionId: pos.id,
          marketTicker: pos.marketTicker,
          reason: 'expiry_near',
          urgency: 'immediate',
          message: `Position expires in ${(pos.daysToExpiry * 24).toFixed(1)} hours!`,
        });
      } else if (pos.daysToExpiry !== undefined && pos.daysToExpiry < 3) {
        recommendations.push({
          positionId: pos.id,
          marketTicker: pos.marketTicker,
          reason: 'expiry_near',
          urgency: 'soon',
          message: `Position expires in ${pos.daysToExpiry.toFixed(1)} days.`,
        });
      }
    }

    // Sort by urgency
    const urgencyOrder = { immediate: 0, soon: 1, optional: 2 };
    return recommendations.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);
  }

  /**
   * Check for alerts and emit events
   */
  private checkAlerts(): void {
    const exitRecs = this.getExitRecommendations();
    const immediate = exitRecs.filter(r => r.urgency === 'immediate');

    if (immediate.length > 0) {
      this.emit('urgentAlert', immediate);
    }

    const soon = exitRecs.filter(r => r.urgency === 'soon');
    if (soon.length > 0) {
      this.emit('alert', soon);
    }
  }

  /**
   * Get position by ID
   */
  getPosition(positionId: string): Position | undefined {
    return this.positions.get(positionId);
  }

  /**
   * Get positions by category
   */
  getPositionsByCategory(category: string): Position[] {
    return this.getPortfolio().filter(p => p.category === category);
  }

  /**
   * Calculate position size recommendation for new prediction
   */
  recommendPositionSize(category: string): {
    canPredict: boolean;
    reason?: string;
    maxSize: number;
  } {
    const portfolio = this.getPortfolio();
    const categoryPositions = portfolio.filter(p => p.category === category);

    // Check category exposure
    const currentExposure = portfolio.length > 0 ? categoryPositions.length / portfolio.length : 0;

    if (currentExposure >= PORTFOLIO_CONFIG.maxCategoryExposure) {
      return {
        canPredict: false,
        reason: `Category ${category} at max exposure (${(currentExposure * 100).toFixed(0)}%)`,
        maxSize: 0,
      };
    }

    // Calculate max allowed
    const remainingCapacity = PORTFOLIO_CONFIG.maxCategoryExposure - currentExposure;

    return {
      canPredict: true,
      maxSize: Math.min(PORTFOLIO_CONFIG.maxSinglePositionSize, remainingCapacity),
    };
  }

  /**
   * Infer category from market title
   */
  private inferCategory(title: string): string {
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
}

// Singleton
let portfolioInstance: PortfolioManager | null = null;

export function getPortfolioManager(userId?: string): PortfolioManager {
  if (!portfolioInstance) {
    if (!userId) throw new Error('User ID required for first initialization');
    portfolioInstance = new PortfolioManager(userId);
  }
  return portfolioInstance;
}

// CLI
if (require.main === module) {
  const command = process.argv[2] || 'summary';
  const userId = process.env.AUTONOMOUS_AGENT_USER_ID || 'autonomous-agent';

  const manager = new PortfolioManager(userId);

  switch (command) {
    case 'summary':
      manager.getSummary().then(summary => {
        console.log('\n📊 PORTFOLIO SUMMARY');
        console.log('═'.repeat(50));
        console.log(`Active positions: ${summary.activePositions}`);
        console.log(`Pending resolution: ${summary.pendingResolution}`);
        console.log(`Resolved today: ${summary.resolvedToday}`);

        console.log(`\n📈 Performance:`);
        console.log(`  Avg Brier Score: ${summary.avgBrierScore.toFixed(4)}`);
        console.log(`  Win Rate: ${(summary.winRate * 100).toFixed(1)}%`);
        console.log(`  Unrealized P&L: ${(summary.totalUnrealizedPnL * 100).toFixed(2)}%`);

        if (summary.bestPosition) {
          console.log(`\n⭐ Best Position: ${summary.bestPosition.marketTitle.slice(0, 40)}...`);
          console.log(`   P&L: +${(summary.bestPosition.pnlPercent * 100).toFixed(1)}%`);
        }

        if (summary.worstPosition && summary.worstPosition.pnlPercent < 0) {
          console.log(`\n📉 Worst Position: ${summary.worstPosition.marketTitle.slice(0, 40)}...`);
          console.log(`   P&L: ${(summary.worstPosition.pnlPercent * 100).toFixed(1)}%`);
        }

        console.log(`\n🎯 Category Exposure:`);
        for (const cat of summary.categoryExposure.slice(0, 5)) {
          const bar = '█'.repeat(Math.round(cat.totalExposure * 20));
          console.log(`  ${cat.category.padEnd(12)} ${bar} ${(cat.totalExposure * 100).toFixed(0)}%`);
        }

        console.log(`\n⚠️ Risk Metrics:`);
        console.log(`  Concentration: ${summary.concentrationRisk.toFixed(0)}/100`);
        console.log(`  Expiring soon: ${summary.expiryRisk}`);
        console.log(`  Category coverage: ${(summary.categoryCoverage * 100).toFixed(0)}%`);

        if (summary.recommendations.length > 0) {
          console.log(`\n💡 Recommendations:`);
          for (const rec of summary.recommendations) {
            console.log(`  • ${rec}`);
          }
        }

        if (summary.alertPositions.length > 0) {
          console.log(`\n🚨 Alert Positions: ${summary.alertPositions.length}`);
        }

        process.exit(0);
      }).catch(err => {
        console.error('Error:', err);
        process.exit(1);
      });
      break;

    case 'positions':
      manager.refresh().then(() => {
        const positions = manager.getPortfolio();
        console.log('\n📋 ACTIVE POSITIONS');
        console.log('═'.repeat(60));

        for (const pos of positions) {
          const pnlSign = pos.pnlPercent >= 0 ? '+' : '';
          const status = pos.marketStatus === 'active' ? '🟢' : '🟡';
          console.log(`\n${status} ${pos.marketTicker}`);
          console.log(`   ${pos.marketTitle.slice(0, 50)}...`);
          console.log(`   ${pos.direction} @ ${(pos.probability * 100).toFixed(0)}%`);
          console.log(`   P&L: ${pnlSign}${(pos.pnlPercent * 100).toFixed(1)}% | Risk: ${pos.riskScore}/100`);
          if (pos.daysToExpiry !== undefined) {
            console.log(`   Expires in: ${pos.daysToExpiry.toFixed(1)} days`);
          }
        }

        process.exit(0);
      }).catch(err => {
        console.error('Error:', err);
        process.exit(1);
      });
      break;

    case 'exits':
      manager.refresh().then(() => {
        const exits = manager.getExitRecommendations();
        console.log('\n🚪 EXIT RECOMMENDATIONS');
        console.log('═'.repeat(50));

        if (exits.length === 0) {
          console.log('No exit recommendations at this time.');
        } else {
          for (const exit of exits) {
            const urgencyIcon = {
              immediate: '🚨',
              soon: '⚠️',
              optional: '💡',
            }[exit.urgency];
            console.log(`\n${urgencyIcon} ${exit.marketTicker} [${exit.reason}]`);
            console.log(`   ${exit.message}`);
          }
        }

        process.exit(0);
      }).catch(err => {
        console.error('Error:', err);
        process.exit(1);
      });
      break;

    default:
      console.log('\n📊 Portfolio Manager');
      console.log('═'.repeat(40));
      console.log('\nUsage:');
      console.log('  ts-node portfolioManager.ts summary   # Portfolio overview');
      console.log('  ts-node portfolioManager.ts positions # List all positions');
      console.log('  ts-node portfolioManager.ts exits     # Exit recommendations');
      process.exit(0);
  }
}

export type { Position, CategoryExposure, PortfolioSummary, ExitRecommendation };
export { PORTFOLIO_CONFIG };
