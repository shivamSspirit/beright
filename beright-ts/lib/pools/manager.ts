/**
 * Conviction Pool Manager
 *
 * Manages pool lifecycle, delegations, and yield distribution.
 * Integrates with the yield orchestrator for capital routing.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { v4 as uuidv4 } from 'uuid';
import type {
  ConvictionPool,
  PoolConfig,
  PoolStatus,
  Delegation,
  DelegationStatus,
  CreatePoolRequest,
  CreatePoolResult,
  DelegateRequest,
  DelegateResult,
  UndelegateRequest,
  UndelegateResult,
  PoolFilter,
  PoolListOptions,
  PoolPerformance,
  DelegatorSummary,
} from './types';
import { DEFAULT_POOL_CONFIG } from './types';
import type { VaultToken } from '../yield/types';
import { YieldOrchestrator, createYieldOrchestrator } from '../yield';
import { getCreditProfile } from '../credit';

// ============================================================================
// Types
// ============================================================================

interface PoolManagerConfig {
  connection: Connection;
  network: 'mainnet-beta' | 'devnet';
}

// ============================================================================
// Pool Manager
// ============================================================================

/**
 * Conviction Pool Manager
 *
 * Handles:
 * - Pool creation and lifecycle
 * - Delegation and undelegation
 * - Share price calculation
 * - Yield distribution
 * - Performance tracking
 */
export class PoolManager {
  private connection: Connection;
  private network: 'mainnet-beta' | 'devnet';
  private yieldOrchestrator: YieldOrchestrator;

  // In-memory storage (production: Supabase + on-chain)
  private pools: Map<string, ConvictionPool> = new Map();
  private delegations: Map<string, Delegation[]> = new Map();

  constructor(config: PoolManagerConfig) {
    this.connection = config.connection;
    this.network = config.network;
    this.yieldOrchestrator = createYieldOrchestrator(
      config.connection,
      config.network
    );
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  async initialize(): Promise<void> {
    await this.yieldOrchestrator.initialize(['USDC', 'SOL']);
  }

  // ============================================================================
  // Pool Lifecycle
  // ============================================================================

  /**
   * Create a new conviction pool
   */
  async createPool(request: CreatePoolRequest): Promise<CreatePoolResult> {
    try {
      // Validate forecaster has credit profile
      const credit = await getCreditProfile(request.forecaster);

      if (!credit) {
        return {
          success: false,
          error: 'Forecaster has no credit profile. Make predictions to build track record.',
        };
      }

      // Check pool access tier
      const requiredTier = request.config.requiredTier;
      if (requiredTier) {
        const tierOrder = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
        const requiredIndex = tierOrder.indexOf(requiredTier);
        const actualIndex = tierOrder.indexOf(credit.poolAccessTier);

        if (actualIndex < requiredIndex) {
          return {
            success: false,
            error: `Forecaster tier ${credit.poolAccessTier} below required ${requiredTier}`,
          };
        }
      }

      // Check delegation cap
      if (request.config.constraints.maxTVL) {
        if (request.config.constraints.maxTVL > BigInt(credit.delegationCap * 1_000000)) {
          return {
            success: false,
            error: `Pool TVL cap ${request.config.constraints.maxTVL} exceeds delegation cap ${credit.delegationCap}`,
          };
        }
      }

      // Generate pool ID and slug
      const poolId = uuidv4();
      const slug = this.generateSlug(request.config.name);

      // Create pool
      const pool: ConvictionPool = {
        id: poolId,
        slug,
        forecaster: request.forecaster,
        config: request.config,
        status: 'pending',

        // Capital (starts at 0)
        tvl: 0n,
        delegatorCount: 0,
        activeCapital: 0n,
        yieldCapital: 0n,
        reserveCapital: 0n,

        // Performance (starts fresh)
        sharePrice: 1.0,
        totalShares: 0n,
        allTimeReturn: 0,
        mtdReturn: 0,

        // Yield
        yieldEarned: 0n,
        yieldAPY: 0,

        // Track record (inherits from forecaster)
        predictionCount: 0,
        winRate: credit.accuracy,
        avgBrierScore: credit.brierScore,

        // Timestamps
        createdAt: new Date(),
        lastActivityAt: new Date(),

        // Metadata
        isVerified: credit.onChainVerified,
        tags: [],
      };

      // Store pool
      this.pools.set(poolId, pool);
      this.delegations.set(poolId, []);

      return {
        success: true,
        pool,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Pool creation failed',
      };
    }
  }

  /**
   * Activate a pool (start accepting delegations)
   */
  async activatePool(poolId: string, forecaster: PublicKey): Promise<boolean> {
    const pool = this.pools.get(poolId);
    if (!pool) return false;

    // Verify ownership
    if (!pool.forecaster.equals(forecaster)) return false;

    // Can only activate pending pools
    if (pool.status !== 'pending') return false;

    pool.status = 'active';
    pool.activatedAt = new Date();
    pool.lastActivityAt = new Date();

    this.pools.set(poolId, pool);
    return true;
  }

  /**
   * Pause a pool
   */
  async pausePool(poolId: string, forecaster: PublicKey): Promise<boolean> {
    const pool = this.pools.get(poolId);
    if (!pool) return false;

    if (!pool.forecaster.equals(forecaster)) return false;
    if (pool.status !== 'active') return false;

    pool.status = 'paused';
    pool.lastActivityAt = new Date();

    this.pools.set(poolId, pool);
    return true;
  }

  // ============================================================================
  // Delegation
  // ============================================================================

  /**
   * Delegate capital to a pool
   */
  async delegate(request: DelegateRequest): Promise<DelegateResult> {
    const pool = this.pools.get(request.poolId);
    if (!pool) {
      return { success: false, error: 'Pool not found' };
    }

    // Validate pool status
    if (pool.status !== 'active') {
      return { success: false, error: `Pool is ${pool.status}, not accepting deposits` };
    }

    // Validate amount
    if (request.amount < pool.config.constraints.minDeposit) {
      return {
        success: false,
        error: `Minimum deposit is ${pool.config.constraints.minDeposit}`,
      };
    }

    if (pool.config.constraints.maxDeposit && request.amount > pool.config.constraints.maxDeposit) {
      return {
        success: false,
        error: `Maximum deposit is ${pool.config.constraints.maxDeposit}`,
      };
    }

    // Check pool capacity
    if (pool.config.constraints.maxTVL) {
      if (pool.tvl + request.amount > pool.config.constraints.maxTVL) {
        return {
          success: false,
          error: `Would exceed pool capacity of ${pool.config.constraints.maxTVL}`,
        };
      }
    }

    try {
      // Route deposit through yield orchestrator
      const allocation = await this.yieldOrchestrator.routeDeposit(
        pool.address || new PublicKey(pool.id.replace(/-/g, '').slice(0, 32).padEnd(32, '0')),
        pool.config.token,
        request.amount,
        request.delegator
      );

      // Calculate shares to issue
      const sharesToIssue = this.calculateSharesForDeposit(pool, request.amount);

      // Create or update delegation
      let delegation = this.findDelegation(request.poolId, request.delegator);

      if (delegation) {
        // Add to existing delegation
        delegation.shares += sharesToIssue;
        delegation.depositedAmount += request.amount;
        delegation.currentValue += request.amount;
        delegation.lastUpdateAt = new Date();
      } else {
        // Create new delegation
        delegation = {
          id: uuidv4(),
          poolId: request.poolId,
          delegator: request.delegator,
          shares: sharesToIssue,
          depositedAmount: request.amount,
          currentValue: request.amount,
          pnl: 0n,
          status: 'active',
          entrySharePrice: pool.sharePrice,
          entryDate: new Date(),
          yieldEarned: 0n,
          feesAccrued: 0n,
          lastUpdateAt: new Date(),
        };

        const poolDelegations = this.delegations.get(request.poolId) || [];
        poolDelegations.push(delegation);
        this.delegations.set(request.poolId, poolDelegations);
      }

      // Update pool state
      pool.tvl += request.amount;
      pool.totalShares += sharesToIssue;
      pool.activeCapital += allocation.activeAmount;
      pool.yieldCapital += allocation.yieldAmount;
      pool.reserveCapital += allocation.reserveAmount;
      pool.delegatorCount = this.getDelegatorCount(request.poolId);
      pool.lastActivityAt = new Date();

      this.pools.set(request.poolId, pool);

      return {
        success: true,
        delegation,
        sharesReceived: sharesToIssue,
        allocationBreakdown: {
          toActive: allocation.activeAmount,
          toYield: allocation.yieldAmount,
          toReserve: allocation.reserveAmount,
        },
        txSignature: allocation.yieldTxSignature,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Delegation failed',
      };
    }
  }

  /**
   * Request undelegation (withdrawal)
   */
  async undelegate(request: UndelegateRequest): Promise<UndelegateResult> {
    const pool = this.pools.get(request.poolId);
    if (!pool) {
      return { success: false, error: 'Pool not found' };
    }

    const delegation = this.findDelegation(request.poolId, request.delegator);
    if (!delegation) {
      return { success: false, error: 'No delegation found' };
    }

    // Determine shares to redeem
    const sharesToRedeem = request.shares || delegation.shares;
    if (sharesToRedeem > delegation.shares) {
      return { success: false, error: 'Insufficient shares' };
    }

    // Calculate withdrawal value
    const withdrawalValue = this.calculateWithdrawalValue(pool, sharesToRedeem);

    // Calculate fees
    const exitFee = BigInt(
      Math.floor((Number(withdrawalValue) * pool.config.fees.exitFeeBps) / 10000)
    );
    const amountAfterFees = withdrawalValue - exitFee;

    // Check if immediate or queued
    const noticeDays = pool.config.constraints.withdrawalNoticeDays;
    const lockupDays = pool.config.constraints.lockupPeriodDays;

    const daysSinceEntry = Math.floor(
      (Date.now() - delegation.entryDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // If still in lockup, queue withdrawal
    if (daysSinceEntry < lockupDays) {
      const effectiveDate = new Date(
        delegation.entryDate.getTime() + lockupDays * 24 * 60 * 60 * 1000
      );

      delegation.status = 'pending_exit';
      delegation.withdrawalRequest = {
        requestedAt: new Date(),
        shares: sharesToRedeem,
        effectiveDate,
      };

      return {
        success: true,
        effectiveDate,
        amountReceived: amountAfterFees,
        sharesBurned: sharesToRedeem,
        fees: exitFee,
      };
    }

    // If notice period required, queue withdrawal
    if (noticeDays > 0) {
      const effectiveDate = new Date(Date.now() + noticeDays * 24 * 60 * 60 * 1000);

      delegation.status = 'pending_exit';
      delegation.withdrawalRequest = {
        requestedAt: new Date(),
        shares: sharesToRedeem,
        effectiveDate,
      };

      return {
        success: true,
        effectiveDate,
        amountReceived: amountAfterFees,
        sharesBurned: sharesToRedeem,
        fees: exitFee,
      };
    }

    // Process immediate withdrawal
    try {
      const withdrawalResult = await this.yieldOrchestrator.processWithdrawal(
        pool.address || new PublicKey(pool.id.replace(/-/g, '').slice(0, 32).padEnd(32, '0')),
        pool.config.token,
        amountAfterFees,
        request.delegator
      );

      if (withdrawalResult.shortfall > 0n) {
        return {
          success: false,
          error: `Insufficient liquidity. Shortfall: ${withdrawalResult.shortfall}`,
        };
      }

      // Update delegation
      delegation.shares -= sharesToRedeem;
      delegation.currentValue -= withdrawalValue;
      delegation.feesAccrued += exitFee;
      delegation.lastUpdateAt = new Date();

      if (delegation.shares === 0n) {
        delegation.status = 'exited';
      }

      // Update pool state
      pool.tvl -= withdrawalValue;
      pool.totalShares -= sharesToRedeem;
      pool.reserveCapital -= withdrawalResult.fromReserve;
      pool.yieldCapital -= withdrawalResult.fromYield;
      pool.delegatorCount = this.getDelegatorCount(request.poolId);
      pool.lastActivityAt = new Date();

      this.pools.set(request.poolId, pool);

      return {
        success: true,
        amountReceived: amountAfterFees,
        sharesBurned: sharesToRedeem,
        fees: exitFee,
        yieldRealized: withdrawalResult.fromYield,
        txSignature: withdrawalResult.yieldTxSignature,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Withdrawal failed',
      };
    }
  }

  // ============================================================================
  // Queries
  // ============================================================================

  /**
   * Get pool by ID
   */
  async getPool(poolId: string): Promise<ConvictionPool | undefined> {
    return this.pools.get(poolId);
  }

  /**
   * Get pool by slug
   */
  async getPoolBySlug(slug: string): Promise<ConvictionPool | undefined> {
    for (const pool of this.pools.values()) {
      if (pool.slug === slug) return pool;
    }
    return undefined;
  }

  /**
   * List pools with filtering
   */
  async listPools(options: PoolListOptions = {}): Promise<ConvictionPool[]> {
    let pools = Array.from(this.pools.values());

    // Apply filters
    if (options.filter) {
      pools = this.applyFilter(pools, options.filter);
    }

    // Sort
    pools = this.sortPools(pools, options.sortBy, options.sortOrder);

    // Paginate
    const offset = options.offset || 0;
    const limit = options.limit || 50;
    return pools.slice(offset, offset + limit);
  }

  /**
   * Get delegations for a pool
   */
  async getPoolDelegations(poolId: string): Promise<Delegation[]> {
    return this.delegations.get(poolId) || [];
  }

  /**
   * Get delegation for a specific delegator
   */
  async getDelegation(poolId: string, delegator: PublicKey): Promise<Delegation | undefined> {
    return this.findDelegation(poolId, delegator);
  }

  /**
   * Get delegator summary across all pools
   */
  async getDelegatorSummary(delegator: PublicKey): Promise<DelegatorSummary> {
    const allDelegations: Delegation[] = [];
    let totalDelegated = 0n;
    let totalPnl = 0n;
    let totalYieldEarned = 0n;

    for (const [_, delegationList] of this.delegations) {
      for (const d of delegationList) {
        if (d.delegator.equals(delegator) && d.status !== 'exited') {
          allDelegations.push(d);
          totalDelegated += d.currentValue;
          totalPnl += d.pnl;
          totalYieldEarned += d.yieldEarned;
        }
      }
    }

    return {
      delegator,
      totalDelegated,
      totalPnl,
      totalYieldEarned,
      activePoolsCount: allDelegations.length,
      delegations: allDelegations,
    };
  }

  /**
   * Get pool performance
   */
  async getPoolPerformance(poolId: string): Promise<PoolPerformance | undefined> {
    const pool = this.pools.get(poolId);
    if (!pool) return undefined;

    return {
      poolId,
      timestamp: new Date(),
      sharePrice: pool.sharePrice,
      tvl: pool.tvl,
      dailyReturn: 0, // TODO: Calculate from history
      weeklyReturn: 0,
      monthlyReturn: pool.mtdReturn,
      allTimeReturn: pool.allTimeReturn,
      yieldContribution: pool.yieldEarned > 0n
        ? Number(pool.yieldEarned) / (Number(pool.tvl) || 1)
        : 0,
      predictionContribution: pool.allTimeReturn - (pool.yieldEarned > 0n
        ? Number(pool.yieldEarned) / (Number(pool.tvl) || 1)
        : 0),
    };
  }

  // ============================================================================
  // Yield Distribution
  // ============================================================================

  /**
   * Update pool with yield earned
   */
  async distributeYield(poolId: string): Promise<bigint> {
    const pool = this.pools.get(poolId);
    if (!pool) return 0n;

    // Get yield from orchestrator
    const yieldAmount = await this.yieldOrchestrator.getPoolYield(
      pool.address || new PublicKey(pool.id.replace(/-/g, '').slice(0, 32).padEnd(32, '0')),
      pool.config.token
    );

    if (yieldAmount === 0n) return 0n;

    // Deduct management fee
    const managementFee = BigInt(
      Math.floor((Number(yieldAmount) * pool.config.fees.managementFeeBps) / 10000)
    );
    const netYield = yieldAmount - managementFee;

    // Update pool
    pool.yieldEarned += netYield;
    pool.tvl += netYield;
    pool.yieldCapital += netYield;

    // Update share price
    if (pool.totalShares > 0n) {
      pool.sharePrice = Number(pool.tvl) / Number(pool.totalShares);
    }

    // Update returns
    const yieldReturn = Number(netYield) / (Number(pool.tvl) - Number(netYield));
    pool.allTimeReturn += yieldReturn * 100;

    // Update yield APY
    const currentAPY = await this.yieldOrchestrator.getCurrentAPY(pool.config.token);
    pool.yieldAPY = currentAPY * 100;

    pool.lastActivityAt = new Date();
    this.pools.set(poolId, pool);

    return netYield;
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private findDelegation(poolId: string, delegator: PublicKey): Delegation | undefined {
    const delegations = this.delegations.get(poolId) || [];
    return delegations.find((d) => d.delegator.equals(delegator));
  }

  private getDelegatorCount(poolId: string): number {
    const delegations = this.delegations.get(poolId) || [];
    return delegations.filter((d) => d.status === 'active').length;
  }

  private calculateSharesForDeposit(pool: ConvictionPool, amount: bigint): bigint {
    if (pool.sharePrice === 0 || pool.totalShares === 0n) {
      // First deposit: 1 share = 1 token
      return amount;
    }
    return BigInt(Math.floor(Number(amount) / pool.sharePrice));
  }

  private calculateWithdrawalValue(pool: ConvictionPool, shares: bigint): bigint {
    return BigInt(Math.floor(Number(shares) * pool.sharePrice));
  }

  private applyFilter(pools: ConvictionPool[], filter: PoolFilter): ConvictionPool[] {
    return pools.filter((pool) => {
      if (filter.status) {
        const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
        if (!statuses.includes(pool.status)) return false;
      }

      if (filter.type) {
        const types = Array.isArray(filter.type) ? filter.type : [filter.type];
        if (!types.includes(pool.config.type)) return false;
      }

      if (filter.token && pool.config.token !== filter.token) return false;

      if (filter.forecaster && !pool.forecaster.equals(filter.forecaster)) return false;

      if (filter.minTVL && pool.tvl < filter.minTVL) return false;

      if (filter.maxTVL && pool.tvl > filter.maxTVL) return false;

      if (filter.minReturn !== undefined && pool.allTimeReturn < filter.minReturn) return false;

      if (filter.tags && filter.tags.length > 0) {
        if (!filter.tags.some((tag) => pool.tags.includes(tag))) return false;
      }

      return true;
    });
  }

  private sortPools(
    pools: ConvictionPool[],
    sortBy?: string,
    sortOrder: 'asc' | 'desc' = 'desc'
  ): ConvictionPool[] {
    const multiplier = sortOrder === 'asc' ? 1 : -1;

    return pools.sort((a, b) => {
      switch (sortBy) {
        case 'tvl':
          return Number(a.tvl - b.tvl) * multiplier;
        case 'return':
          return (a.allTimeReturn - b.allTimeReturn) * multiplier;
        case 'delegators':
          return (a.delegatorCount - b.delegatorCount) * multiplier;
        case 'created':
          return (a.createdAt.getTime() - b.createdAt.getTime()) * multiplier;
        case 'activity':
          return (a.lastActivityAt.getTime() - b.lastActivityAt.getTime()) * multiplier;
        default:
          return Number(a.tvl - b.tvl) * multiplier;
      }
    });
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create pool manager
 */
export function createPoolManager(
  connection: Connection,
  network: 'mainnet-beta' | 'devnet' = 'mainnet-beta'
): PoolManager {
  return new PoolManager({ connection, network });
}
