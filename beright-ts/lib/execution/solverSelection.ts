/**
 * LinUCB Solver Selection
 *
 * Adaptive solver selection using contextual multi-armed bandit.
 * Learns which solver (execution venue) performs best for different
 * order contexts (size, network congestion, time of day).
 *
 * Algorithm: Linear Upper Confidence Bound (LinUCB)
 * - Balances exploration (trying new solvers) vs exploitation (using best known)
 * - Adapts to changing network conditions
 * - Learns from execution results
 *
 * Based on arXiv research on cross-chain intent analysis.
 *
 * @author BeRight Protocol
 */

import { Platform } from '../dataFabric/types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Context features for solver selection
 */
export interface SolverContext {
  orderSize: number;           // Order size in USD
  networkCongestion: number;   // 0-1 (from gas prices)
  hourOfDay: number;           // 0-23 UTC
  dayOfWeek: number;           // 0-6 (Sunday = 0)
  volatility: number;          // Recent price volatility
  urgency: number;             // 0-1 how urgent is execution
}

/**
 * Execution result for learning
 */
export interface ExecutionFeedback {
  solver: string;
  context: SolverContext;
  reward: number;              // Normalized reward (0-1)
  latencyMs: number;
  slippage: number;
  success: boolean;
}

/**
 * Solver arm state (LinUCB)
 */
interface SolverArm {
  solver: string;
  A: number[][];              // Design matrix (d x d)
  b: number[];                // Reward accumulator (d)
  pulls: number;              // Number of times selected
  totalReward: number;        // Cumulative reward
}

/**
 * Selection result
 */
export interface SolverSelectionResult {
  solver: string;
  ucbScore: number;
  exploitation: number;
  exploration: number;
  confidence: number;
}

// =============================================================================
// LINUCB SELECTOR
// =============================================================================

/**
 * LinUCB Solver Selector
 *
 * Uses contextual bandit to select optimal execution venue
 */
export class LinUCBSolverSelector {
  private arms: Map<string, SolverArm> = new Map();
  private alpha: number;       // Exploration parameter
  private d: number;           // Context dimension

  /**
   * Create a LinUCB solver selector
   *
   * @param solvers - Available solver/venue names
   * @param alpha - Exploration parameter (higher = more exploration)
   */
  constructor(
    solvers: string[],
    alpha: number = 0.5
  ) {
    this.alpha = alpha;
    this.d = 6; // Number of context features

    for (const solver of solvers) {
      this.arms.set(solver, {
        solver,
        A: this.identity(this.d),
        b: new Array(this.d).fill(0),
        pulls: 0,
        totalReward: 0,
      });
    }
  }

  /**
   * Select best solver for given context
   */
  select(context: SolverContext): SolverSelectionResult {
    const x = this.contextToVector(context);
    let bestSolver = '';
    let bestUCB = -Infinity;
    let bestExploit = 0;
    let bestExplore = 0;

    for (const [solver, arm] of this.arms) {
      const AInv = this.invert(arm.A);
      const theta = this.matVecMul(AInv, arm.b);

      // UCB = theta^T x + alpha * sqrt(x^T A^-1 x)
      const exploitation = this.dot(theta, x);
      const exploration = this.alpha * Math.sqrt(this.quadForm(x, AInv));
      const ucb = exploitation + exploration;

      if (ucb > bestUCB) {
        bestUCB = ucb;
        bestSolver = solver;
        bestExploit = exploitation;
        bestExplore = exploration;
      }
    }

    // Calculate confidence (inverse of exploration bonus)
    const confidence = 1 / (1 + bestExplore);

    return {
      solver: bestSolver,
      ucbScore: bestUCB,
      exploitation: bestExploit,
      exploration: bestExplore,
      confidence,
    };
  }

  /**
   * Select with epsilon-greedy fallback for cold start
   */
  selectWithFallback(
    context: SolverContext,
    epsilon: number = 0.1
  ): SolverSelectionResult {
    // Check if we have enough data
    const minPulls = 10;
    const underexplored = Array.from(this.arms.values()).filter(a => a.pulls < minPulls);

    if (underexplored.length > 0 && Math.random() < epsilon) {
      // Explore underexplored arm
      const arm = underexplored[Math.floor(Math.random() * underexplored.length)];
      return {
        solver: arm.solver,
        ucbScore: 0,
        exploitation: 0,
        exploration: 1,
        confidence: 0,
      };
    }

    return this.select(context);
  }

  /**
   * Update arm with execution feedback
   */
  update(feedback: ExecutionFeedback): void {
    const arm = this.arms.get(feedback.solver);
    if (!arm) return;

    const x = this.contextToVector(feedback.context);

    // A = A + x x^T
    for (let i = 0; i < this.d; i++) {
      for (let j = 0; j < this.d; j++) {
        arm.A[i][j] += x[i] * x[j];
      }
    }

    // b = b + r * x
    for (let i = 0; i < this.d; i++) {
      arm.b[i] += feedback.reward * x[i];
    }

    arm.pulls++;
    arm.totalReward += feedback.reward;
  }

  /**
   * Get arm statistics
   */
  getStats(): Record<string, {
    pulls: number;
    avgReward: number;
    estimatedValue: number;
  }> {
    const stats: Record<string, any> = {};

    for (const [solver, arm] of this.arms) {
      const AInv = this.invert(arm.A);
      const theta = this.matVecMul(AInv, arm.b);

      stats[solver] = {
        pulls: arm.pulls,
        avgReward: arm.pulls > 0 ? arm.totalReward / arm.pulls : 0,
        estimatedValue: theta.reduce((sum, v) => sum + v, 0) / theta.length,
      };
    }

    return stats;
  }

  /**
   * Calculate reward from execution result
   */
  static calculateReward(
    success: boolean,
    expectedSlippage: number,
    actualSlippage: number,
    latencyMs: number,
    maxLatencyMs: number = 10000
  ): number {
    if (!success) return 0;

    // Reward components
    const slippageReward = Math.max(0, 1 - actualSlippage / (expectedSlippage + 0.01));
    const latencyReward = Math.max(0, 1 - latencyMs / maxLatencyMs);

    // Weighted combination
    return 0.6 * slippageReward + 0.4 * latencyReward;
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  private contextToVector(ctx: SolverContext): number[] {
    return [
      Math.log(ctx.orderSize + 1) / 10,           // Log-normalized size
      ctx.networkCongestion,                       // 0-1
      Math.sin(ctx.hourOfDay * Math.PI / 12),     // Cyclic encoding
      Math.cos(ctx.hourOfDay * Math.PI / 12),     // Cyclic encoding
      ctx.volatility,                              // 0-1
      ctx.urgency,                                 // 0-1
    ];
  }

  private identity(n: number): number[][] {
    const I: number[][] = [];
    for (let i = 0; i < n; i++) {
      I.push(new Array(n).fill(0));
      I[i][i] = 1;
    }
    return I;
  }

  private invert(A: number[][]): number[][] {
    const n = A.length;
    const augmented: number[][] = A.map((row, i) => {
      const newRow = [...row];
      for (let j = 0; j < n; j++) {
        newRow.push(i === j ? 1 : 0);
      }
      return newRow;
    });

    // Gaussian elimination
    for (let i = 0; i < n; i++) {
      // Find pivot
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
          maxRow = k;
        }
      }
      [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];

      const pivot = augmented[i][i];
      if (Math.abs(pivot) < 1e-10) continue;

      // Scale row
      for (let j = 0; j < 2 * n; j++) {
        augmented[i][j] /= pivot;
      }

      // Eliminate column
      for (let k = 0; k < n; k++) {
        if (k === i) continue;
        const factor = augmented[k][i];
        for (let j = 0; j < 2 * n; j++) {
          augmented[k][j] -= factor * augmented[i][j];
        }
      }
    }

    // Extract inverse
    return augmented.map(row => row.slice(n));
  }

  private matVecMul(A: number[][], v: number[]): number[] {
    return A.map(row => this.dot(row, v));
  }

  private dot(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i] * b[i];
    }
    return sum;
  }

  private quadForm(x: number[], A: number[][]): number {
    // x^T A x
    const Ax = this.matVecMul(A, x);
    return this.dot(x, Ax);
  }

  // ===========================================================================
  // SERIALIZATION
  // ===========================================================================

  /**
   * Export state for persistence
   */
  export(): string {
    const state = {
      alpha: this.alpha,
      d: this.d,
      arms: Array.from(this.arms.entries()).map(([solver, arm]) => ({
        solver,
        A: arm.A,
        b: arm.b,
        pulls: arm.pulls,
        totalReward: arm.totalReward,
      })),
    };
    return JSON.stringify(state);
  }

  /**
   * Import state from persistence
   */
  static import(json: string): LinUCBSolverSelector {
    const state = JSON.parse(json);
    const selector = new LinUCBSolverSelector([], state.alpha);
    selector.d = state.d;

    for (const arm of state.arms) {
      selector.arms.set(arm.solver, {
        solver: arm.solver,
        A: arm.A,
        b: arm.b,
        pulls: arm.pulls,
        totalReward: arm.totalReward,
      });
    }

    return selector;
  }
}

// =============================================================================
// GLOBAL SELECTOR INSTANCE
// =============================================================================

let globalSelector: LinUCBSolverSelector | null = null;

/**
 * Get the global solver selector instance
 */
export function getSolverSelector(): LinUCBSolverSelector {
  if (!globalSelector) {
    globalSelector = new LinUCBSolverSelector([
      'polymarket',
      'kalshi',
      'jupiter',
      'limitless',
      'manifold',
    ]);
  }
  return globalSelector;
}

/**
 * Get current network context
 */
export async function getCurrentContext(): Promise<SolverContext> {
  const now = new Date();

  // TODO: Fetch actual network congestion from RPC
  const networkCongestion = 0.3; // Placeholder

  // TODO: Calculate actual volatility from price data
  const volatility = 0.2; // Placeholder

  return {
    orderSize: 100, // Will be overridden
    networkCongestion,
    hourOfDay: now.getUTCHours(),
    dayOfWeek: now.getUTCDay(),
    volatility,
    urgency: 0.5, // Default medium urgency
  };
}

/**
 * Select best solver with current context
 */
export async function selectBestSolver(
  orderSize: number,
  urgency: number = 0.5
): Promise<SolverSelectionResult> {
  const selector = getSolverSelector();
  const context = await getCurrentContext();

  context.orderSize = orderSize;
  context.urgency = urgency;

  return selector.selectWithFallback(context);
}

/**
 * Record execution feedback
 */
export function recordExecution(
  solver: string,
  context: SolverContext,
  success: boolean,
  slippage: number,
  latencyMs: number
): void {
  const selector = getSolverSelector();

  const reward = LinUCBSolverSelector.calculateReward(
    success,
    0.02, // Expected 2% slippage
    slippage,
    latencyMs
  );

  selector.update({
    solver,
    context,
    reward,
    latencyMs,
    slippage,
    success,
  });
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  LinUCBSolverSelector,
  getSolverSelector,
  getCurrentContext,
  selectBestSolver,
  recordExecution,
};
