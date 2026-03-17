/**
 * Smart Routing Module
 *
 * Multi-objective order routing for prediction markets:
 * - NSGA-II: Pareto-optimal routing across objectives
 * - LinUCB: Adaptive solver selection
 *
 * @author BeRight Protocol
 */

export * from './nsga2';

import { NSGA2Router, getNSGA2Router, type VenueQuote, type RouteCandidate } from './nsga2';
import { selectBestSolver, recordExecution, type SolverContext } from '../execution/solverSelection';
import { Platform } from '../dataFabric/types';

// =============================================================================
// SMART ROUTING INTERFACE
// =============================================================================

export interface SmartRouteRequest {
  orderSize: number;
  venues: VenueQuote[];
  strategy: 'nsga2' | 'linucb' | 'best_price';
  preference?: 'balanced' | 'low_cost' | 'low_risk' | 'max_surplus';
  urgency?: number;
}

export interface SmartRouteResult {
  venues: { platform: Platform; allocation: number }[];
  objectives: {
    userSurplus: number;
    gas: number;
    slippage: number;
    risk: number;
  };
  confidence: number;
  strategy: string;
  latencyMs: number;
}

/**
 * Route order using smart algorithms
 */
export async function smartRoute(request: SmartRouteRequest): Promise<SmartRouteResult> {
  const start = Date.now();

  switch (request.strategy) {
    case 'nsga2': {
      const router = getNSGA2Router();
      const front = await router.optimize(request.orderSize, request.venues);

      if (front.length === 0) {
        return emptyResult('nsga2', start);
      }

      const best = router.selectBest(front, request.preference) || front[0];

      return {
        venues: best.venues,
        objectives: {
          userSurplus: best.objectives.userSurplus,
          gas: -best.objectives.negGas,
          slippage: -best.objectives.negSlippage,
          risk: -best.objectives.negRisk,
        },
        confidence: 1 - best.rank / front.length,
        strategy: 'nsga2',
        latencyMs: Date.now() - start,
      };
    }

    case 'linucb': {
      const selection = await selectBestSolver(request.orderSize, request.urgency);

      const selectedVenue = request.venues.find(v => v.platform === selection.solver);
      if (!selectedVenue) {
        return emptyResult('linucb', start);
      }

      return {
        venues: [{ platform: selectedVenue.platform, allocation: 1 }],
        objectives: {
          userSurplus: 0,
          gas: selectedVenue.gasEstimate,
          slippage: selectedVenue.estimatedSlippage,
          risk: selectedVenue.executionRisk,
        },
        confidence: selection.confidence,
        strategy: 'linucb',
        latencyMs: Date.now() - start,
      };
    }

    case 'best_price':
    default: {
      // Simple best price routing
      const sorted = [...request.venues].sort((a, b) => a.price - b.price);
      const best = sorted[0];

      if (!best) {
        return emptyResult('best_price', start);
      }

      return {
        venues: [{ platform: best.platform, allocation: 1 }],
        objectives: {
          userSurplus: 0,
          gas: best.gasEstimate,
          slippage: best.estimatedSlippage,
          risk: best.executionRisk,
        },
        confidence: 0.8,
        strategy: 'best_price',
        latencyMs: Date.now() - start,
      };
    }
  }
}

function emptyResult(strategy: string, start: number): SmartRouteResult {
  return {
    venues: [],
    objectives: { userSurplus: 0, gas: 0, slippage: 0, risk: 0 },
    confidence: 0,
    strategy,
    latencyMs: Date.now() - start,
  };
}

/**
 * Record execution feedback for learning
 */
export function recordRoutingFeedback(
  solver: string,
  context: SolverContext,
  success: boolean,
  slippage: number,
  latencyMs: number
): void {
  recordExecution(solver, context, success, slippage, latencyMs);
}
