/**
 * Risk Management Module
 *
 * Correlation analysis, drawdown control, and advanced risk metrics.
 *
 * @author BeRight Protocol
 * @version 3.0.0 - Bloomberg Terminal Architecture
 */

// =============================================================================
// RE-EXPORTS
// =============================================================================

// Types
export * from './types';

// Correlation analysis
export {
  CorrelationAnalyzer,
  getCorrelationAnalyzer,
} from './correlation';

// Drawdown control
export {
  DrawdownController,
  getDrawdownController,
} from './drawdown';

// =============================================================================
// UNIFIED RISK ANALYZER
// =============================================================================

import { PortfolioRiskSummary, VaRResult } from './types';
import { getCorrelationAnalyzer } from './correlation';
import { getDrawdownController } from './drawdown';
import { getRiskManager } from '../portfolio/riskManager';
import { getExecutionEngine } from '../execution';
import { calculateConcentration } from '../portfolio/types';

/**
 * Get comprehensive portfolio risk summary
 */
export async function getPortfolioRiskSummary(): Promise<PortfolioRiskSummary> {
  const engine = getExecutionEngine();
  const correlationAnalyzer = getCorrelationAnalyzer();
  const drawdownController = getDrawdownController();
  const riskManager = getRiskManager();

  // Get current state
  const [balance, positions, exposure] = await Promise.all([
    engine.getTotalBalance(),
    engine.getOpenPositions(),
    engine.getExposure(),
  ]);

  // Exposure calculations
  const totalExposure = exposure.totalAtRisk;
  const exposurePct = balance.total > 0 ? totalExposure / balance.total : 0;

  // Concentration (Herfindahl index)
  // Calculate current value for each position based on side and price
  const positionSizes = positions.map(p => {
    return p.side === 'YES'
      ? p.size * p.currentPrice
      : p.size * (1 - p.currentPrice);
  });
  const herfindahlIndex = calculateConcentration(positionSizes);

  // Largest position
  const largestPosition = Math.max(0, ...positionSizes);
  const largestPositionPct = balance.total > 0 ? largestPosition / balance.total : 0;

  // Correlation analysis
  const correlationMatrix = correlationAnalyzer.buildCorrelationMatrix(positions);
  const effectiveDiversification = correlationAnalyzer.calculateDiversification(correlationMatrix);

  // Drawdown analysis
  drawdownController.updateValue(balance.total);
  const drawdownAnalysis = drawdownController.analyze();

  // Simple VaR calculation (parametric)
  const var95 = balance.total * 0.05 * 1.65;  // 1.65 sigma for 95%
  const var99 = balance.total * 0.05 * 2.33;  // 2.33 sigma for 99%

  const varResult: VaRResult = {
    var95,
    var99,
    cvar95: var95 * 1.2,  // Approximate CVaR
    method: 'parametric',
    confidenceLevel: 0.95,
    timeHorizon: '1d',
    calculatedAt: new Date(),
  };

  // Overall risk score (0-100)
  const exposureScore = Math.min(30, exposurePct * 60);
  const concentrationScore = Math.min(25, herfindahlIndex * 50);
  const correlationScore = Math.min(20, correlationMatrix.averageCorrelation * 40);
  const drawdownScore = Math.min(25, drawdownAnalysis.currentDrawdownPct * 250);

  const overallRiskScore = exposureScore + concentrationScore + correlationScore + drawdownScore;

  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high' | 'critical';
  if (overallRiskScore < 25) riskLevel = 'low';
  else if (overallRiskScore < 50) riskLevel = 'medium';
  else if (overallRiskScore < 75) riskLevel = 'high';
  else riskLevel = 'critical';

  // Generate recommendations
  const recommendations: string[] = [];

  if (exposurePct > 0.4) {
    recommendations.push('Consider reducing total exposure');
  }
  if (herfindahlIndex > 0.25) {
    recommendations.push('Portfolio is concentrated - diversify positions');
  }
  if (correlationMatrix.averageCorrelation > 0.4) {
    recommendations.push('High correlation between positions - reduce overlap');
  }
  if (drawdownAnalysis.currentDrawdownPct > 0.05) {
    recommendations.push('In drawdown - reduce position sizes');
  }
  if (largestPositionPct > 0.15) {
    recommendations.push('Largest position exceeds 15% - consider trimming');
  }

  if (recommendations.length === 0) {
    recommendations.push('Risk metrics within acceptable ranges');
  }

  return {
    totalExposure,
    exposurePct,
    herfindahlIndex,
    largestPosition,
    largestPositionPct,
    averageCorrelation: correlationMatrix.averageCorrelation,
    effectiveDiversification,
    var: varResult,
    drawdown: drawdownAnalysis,
    overallRiskScore,
    riskLevel,
    recommendations,
  };
}
