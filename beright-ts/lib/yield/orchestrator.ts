/**
 * Yield Orchestrator
 *
 * Manages capital allocation between:
 * - Active predictions (30%)
 * - Yield layer via Meteora (50%)
 * - Liquid reserve (20%)
 *
 * This is the "Capital Router" from the P2+P8 architecture.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import type {
  VaultToken,
  AllocationStrategy,
  AllocationResult,
  RebalanceRecommendation,
  RebalanceAction,
  YieldPosition,
  IYieldClient,
} from './types';
import { DEFAULT_ALLOCATION_STRATEGY } from './types';
import { MeteoraVaultClient } from './meteora';

// ============================================================================
// Types
// ============================================================================

/**
 * Pool state for capital routing
 */
interface PoolCapitalState {
  poolId: PublicKey;
  token: VaultToken;

  // Capital breakdown
  totalCapital: bigint;           // Total pool TVL
  activeCapital: bigint;          // In active predictions
  yieldCapital: bigint;           // In yield layer
  reserveCapital: bigint;         // Liquid reserve

  // Yield metrics
  yieldPosition?: YieldPosition;
  accumulatedYield: bigint;
}

/**
 * Orchestrator configuration
 */
interface OrchestratorConfig {
  connection: Connection;
  network: 'mainnet-beta' | 'devnet';
  strategy?: AllocationStrategy;
}

// ============================================================================
// Yield Orchestrator
// ============================================================================

/**
 * Yield Orchestrator
 *
 * Responsible for:
 * 1. Routing deposits to appropriate buckets
 * 2. Managing yield layer interactions
 * 3. Rebalancing when allocations drift
 * 4. Harvesting and distributing yield
 */
export class YieldOrchestrator {
  private connection: Connection;
  private network: 'mainnet-beta' | 'devnet';
  private strategy: AllocationStrategy;

  // Yield clients by token
  private yieldClients: Map<VaultToken, IYieldClient>;

  // Pool state cache
  private poolStates: Map<string, PoolCapitalState>;

  constructor(config: OrchestratorConfig) {
    this.connection = config.connection;
    this.network = config.network;
    this.strategy = config.strategy || DEFAULT_ALLOCATION_STRATEGY;
    this.yieldClients = new Map();
    this.poolStates = new Map();
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * Initialize yield clients for supported tokens
   */
  async initialize(tokens: VaultToken[] = ['USDC']): Promise<void> {
    for (const token of tokens) {
      const client = MeteoraVaultClient.create(
        this.connection,
        token,
        this.network
      );

      try {
        await client.connect();
        this.yieldClients.set(token, client);
      } catch (error) {
        console.warn(`Failed to connect yield client for ${token}:`, error);
      }
    }
  }

  /**
   * Check if orchestrator is ready
   */
  isReady(): boolean {
    return this.yieldClients.size > 0;
  }

  // ============================================================================
  // Deposit Routing
  // ============================================================================

  /**
   * Route a new deposit according to allocation strategy
   *
   * When capital enters a pool, split it:
   * - 30% → Active (ready for predictions)
   * - 50% → Yield layer (earning while idle)
   * - 20% → Reserve (for immediate withdrawals)
   */
  async routeDeposit(
    poolId: PublicKey,
    token: VaultToken,
    amount: bigint,
    depositor: PublicKey
  ): Promise<AllocationResult> {
    // Calculate allocations based on strategy
    const total = Number(amount);
    const yieldAmount = BigInt(
      Math.floor((total * this.strategy.yieldAllocationBps) / 10000)
    );
    const reserveAmount = BigInt(
      Math.floor((total * this.strategy.reserveAllocationBps) / 10000)
    );
    const activeAmount = amount - yieldAmount - reserveAmount;

    // Deposit yield portion to Meteora
    let yieldTxSignature: string | undefined;
    const yieldClient = this.yieldClients.get(token);

    if (yieldClient && yieldAmount > 0n) {
      const depositResult = await yieldClient.deposit(depositor, yieldAmount);
      if (depositResult.success) {
        yieldTxSignature = depositResult.txSignature;
      } else {
        // If yield deposit fails, keep all in reserve
        console.warn('Yield deposit failed:', depositResult.error);
        // Fall through - return with no yield allocation
      }
    }

    // Update pool state cache
    this.updatePoolState(poolId, token, {
      activeCapital: activeAmount,
      yieldCapital: yieldClient ? yieldAmount : 0n,
      reserveCapital: reserveAmount + (yieldClient ? 0n : yieldAmount),
    });

    return {
      yieldAmount: yieldClient ? yieldAmount : 0n,
      reserveAmount: reserveAmount + (yieldClient ? 0n : yieldAmount),
      activeAmount,
      yieldTxSignature,
      poolId,
      timestamp: new Date(),
    };
  }

  // ============================================================================
  // Withdrawal Processing
  // ============================================================================

  /**
   * Process withdrawal request
   *
   * Priority:
   * 1. Use reserve first (instant)
   * 2. If insufficient, pull from yield layer (may take time)
   * 3. Active capital is NOT touched (locked in predictions)
   */
  async processWithdrawal(
    poolId: PublicKey,
    token: VaultToken,
    amount: bigint,
    withdrawer: PublicKey
  ): Promise<{
    fromReserve: bigint;
    fromYield: bigint;
    yieldTxSignature?: string;
    shortfall: bigint;
  }> {
    const state = this.getPoolState(poolId);

    if (!state) {
      return { fromReserve: 0n, fromYield: 0n, shortfall: amount };
    }

    let remaining = amount;
    let fromReserve = 0n;
    let fromYield = 0n;
    let yieldTxSignature: string | undefined;

    // 1. Draw from reserve first
    if (state.reserveCapital > 0n) {
      fromReserve = remaining > state.reserveCapital
        ? state.reserveCapital
        : remaining;
      remaining -= fromReserve;
    }

    // 2. If still need more, withdraw from yield layer
    if (remaining > 0n) {
      const yieldClient = this.yieldClients.get(token);
      if (yieldClient) {
        const withdrawResult = await yieldClient.withdraw(withdrawer, remaining);
        if (withdrawResult.success && withdrawResult.amountReceived) {
          fromYield = withdrawResult.amountReceived;
          yieldTxSignature = withdrawResult.txSignature;
          remaining -= fromYield;
        }
      }
    }

    // Update pool state
    this.updatePoolState(poolId, token, {
      reserveCapital: state.reserveCapital - fromReserve,
      yieldCapital: state.yieldCapital - fromYield,
    });

    return {
      fromReserve,
      fromYield,
      yieldTxSignature,
      shortfall: remaining,
    };
  }

  // ============================================================================
  // Rebalancing
  // ============================================================================

  /**
   * Check if a pool needs rebalancing
   */
  async getRebalanceRecommendation(
    poolId: PublicKey
  ): Promise<RebalanceRecommendation> {
    const state = this.getPoolState(poolId);

    if (!state || state.totalCapital === 0n) {
      return {
        needsRebalance: false,
        currentAllocations: { yieldBps: 0, reserveBps: 0, activeBps: 0 },
        targetAllocations: {
          yieldBps: this.strategy.yieldAllocationBps,
          reserveBps: this.strategy.reserveAllocationBps,
          activeBps: this.strategy.activeAllocationBps,
        },
        actions: [],
      };
    }

    // Calculate current allocations
    const total = Number(state.totalCapital);
    const currentYieldBps = Math.floor((Number(state.yieldCapital) / total) * 10000);
    const currentReserveBps = Math.floor((Number(state.reserveCapital) / total) * 10000);
    const currentActiveBps = Math.floor((Number(state.activeCapital) / total) * 10000);

    // Check if rebalance needed
    const yieldDrift = Math.abs(currentYieldBps - this.strategy.yieldAllocationBps);
    const reserveDrift = Math.abs(currentReserveBps - this.strategy.reserveAllocationBps);
    const maxDrift = Math.max(yieldDrift, reserveDrift);

    const needsRebalance = maxDrift > this.strategy.rebalanceThresholdBps;

    // Determine rebalance actions
    const actions: RebalanceAction[] = [];

    if (needsRebalance) {
      // If yield allocation too low, deposit more
      if (currentYieldBps < this.strategy.yieldAllocationBps - this.strategy.rebalanceThresholdBps) {
        const targetYield = BigInt(
          Math.floor((total * this.strategy.yieldAllocationBps) / 10000)
        );
        const toDeposit = targetYield - state.yieldCapital;
        if (toDeposit > 0n && state.reserveCapital >= toDeposit) {
          actions.push({
            type: 'deposit_yield',
            amount: toDeposit,
            reason: `Yield allocation ${currentYieldBps}bps below target ${this.strategy.yieldAllocationBps}bps`,
          });
        }
      }

      // If yield allocation too high, withdraw some
      if (currentYieldBps > this.strategy.yieldAllocationBps + this.strategy.rebalanceThresholdBps) {
        const targetYield = BigInt(
          Math.floor((total * this.strategy.yieldAllocationBps) / 10000)
        );
        const toWithdraw = state.yieldCapital - targetYield;
        if (toWithdraw > 0n) {
          actions.push({
            type: 'withdraw_yield',
            amount: toWithdraw,
            reason: `Yield allocation ${currentYieldBps}bps above target ${this.strategy.yieldAllocationBps}bps`,
          });
        }
      }

      // If reserve too low, pull from yield
      if (currentReserveBps < this.strategy.reserveAllocationBps - this.strategy.rebalanceThresholdBps) {
        const targetReserve = BigInt(
          Math.floor((total * this.strategy.reserveAllocationBps) / 10000)
        );
        const needed = targetReserve - state.reserveCapital;
        if (needed > 0n) {
          actions.push({
            type: 'move_to_reserve',
            amount: needed,
            reason: `Reserve ${currentReserveBps}bps below minimum ${this.strategy.reserveAllocationBps}bps`,
          });
        }
      }
    }

    return {
      needsRebalance,
      currentAllocations: {
        yieldBps: currentYieldBps,
        reserveBps: currentReserveBps,
        activeBps: currentActiveBps,
      },
      targetAllocations: {
        yieldBps: this.strategy.yieldAllocationBps,
        reserveBps: this.strategy.reserveAllocationBps,
        activeBps: this.strategy.activeAllocationBps,
      },
      actions,
    };
  }

  /**
   * Execute rebalance actions
   */
  async executeRebalance(
    poolId: PublicKey,
    token: VaultToken,
    actor: PublicKey
  ): Promise<{ success: boolean; actionsExecuted: number; error?: string }> {
    const recommendation = await this.getRebalanceRecommendation(poolId);

    if (!recommendation.needsRebalance) {
      return { success: true, actionsExecuted: 0 };
    }

    const yieldClient = this.yieldClients.get(token);
    if (!yieldClient) {
      return { success: false, actionsExecuted: 0, error: 'No yield client for token' };
    }

    let actionsExecuted = 0;

    for (const action of recommendation.actions) {
      try {
        if (action.type === 'deposit_yield') {
          await yieldClient.deposit(actor, action.amount);
          actionsExecuted++;
        } else if (action.type === 'withdraw_yield') {
          await yieldClient.withdraw(actor, action.amount);
          actionsExecuted++;
        }
        // move_to_reserve is handled by withdraw_yield
      } catch (error) {
        console.error('Rebalance action failed:', action.type, error);
        return {
          success: false,
          actionsExecuted,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    return { success: true, actionsExecuted };
  }

  // ============================================================================
  // Yield Harvesting
  // ============================================================================

  /**
   * Get yield earned by a pool
   */
  async getPoolYield(poolId: PublicKey, token: VaultToken): Promise<bigint> {
    const yieldClient = this.yieldClients.get(token);
    if (!yieldClient) return 0n;

    // In production, this would be the pool's vault account
    // For now, use pool state tracking
    const state = this.getPoolState(poolId);
    return state?.accumulatedYield || 0n;
  }

  /**
   * Get current APY for a token
   */
  async getCurrentAPY(token: VaultToken): Promise<number> {
    const yieldClient = this.yieldClients.get(token);
    if (!yieldClient) return 0;

    return yieldClient.getAPY();
  }

  // ============================================================================
  // Pool State Management
  // ============================================================================

  private getPoolState(poolId: PublicKey): PoolCapitalState | undefined {
    return this.poolStates.get(poolId.toBase58());
  }

  private updatePoolState(
    poolId: PublicKey,
    token: VaultToken,
    updates: Partial<PoolCapitalState>
  ): void {
    const key = poolId.toBase58();
    const existing = this.poolStates.get(key);

    if (existing) {
      const updated = { ...existing, ...updates };
      updated.totalCapital =
        updated.activeCapital + updated.yieldCapital + updated.reserveCapital;
      this.poolStates.set(key, updated);
    } else {
      const newState: PoolCapitalState = {
        poolId,
        token,
        totalCapital: 0n,
        activeCapital: updates.activeCapital || 0n,
        yieldCapital: updates.yieldCapital || 0n,
        reserveCapital: updates.reserveCapital || 0n,
        accumulatedYield: 0n,
      };
      newState.totalCapital =
        newState.activeCapital + newState.yieldCapital + newState.reserveCapital;
      this.poolStates.set(key, newState);
    }
  }

  /**
   * Load pool state from storage (Supabase or on-chain)
   */
  async loadPoolState(poolId: PublicKey): Promise<PoolCapitalState | undefined> {
    // In production, fetch from Supabase or on-chain account
    // For now, return cached state
    return this.getPoolState(poolId);
  }

  /**
   * Save pool state to storage
   */
  async savePoolState(state: PoolCapitalState): Promise<void> {
    // In production, persist to Supabase
    this.poolStates.set(state.poolId.toBase58(), state);
  }

  // ============================================================================
  // Strategy Management
  // ============================================================================

  /**
   * Update allocation strategy
   */
  setStrategy(strategy: AllocationStrategy): void {
    // Validate strategy sums to 100%
    const total =
      strategy.yieldAllocationBps +
      strategy.reserveAllocationBps +
      strategy.activeAllocationBps;

    if (total !== 10000) {
      throw new Error(
        `Strategy allocations must sum to 10000bps (100%), got ${total}bps`
      );
    }

    this.strategy = strategy;
  }

  /**
   * Get current strategy
   */
  getStrategy(): AllocationStrategy {
    return { ...this.strategy };
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create yield orchestrator
 */
export function createYieldOrchestrator(
  connection: Connection,
  network: 'mainnet-beta' | 'devnet' = 'mainnet-beta',
  strategy?: AllocationStrategy
): YieldOrchestrator {
  return new YieldOrchestrator({ connection, network, strategy });
}
