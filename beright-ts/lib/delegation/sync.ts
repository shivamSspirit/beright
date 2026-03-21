/**
 * BeRight Delegation State Sync
 *
 * Synchronizes on-chain state to the database.
 * Can be run as a cron job or triggered by events.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { Keypair } from '@solana/web3.js';

import { STAKING_POOL_PROGRAM_ID, STAKING_POOL_CONFIG } from '../staking';
import * as db from './db';
import type { OnChainPoolState, ForecasterTier, OnChainPoolType, OnChainPoolStatus } from './types';

// Import IDL
import stakingPoolIdl from '../staking/idl/staking_pool.json';

// ============================================================================
// Sync Configuration
// ============================================================================

export interface SyncConfig {
  connection: Connection;
  network: 'devnet' | 'mainnet';
  batchSize?: number;
}

// ============================================================================
// Pool Sync
// ============================================================================

/**
 * Sync all pools from on-chain to database
 */
export async function syncAllPools(config: SyncConfig): Promise<{
  synced: number;
  errors: string[];
}> {
  const { connection, batchSize = 50 } = config;

  // Create read-only provider
  const dummyWallet = {
    publicKey: Keypair.generate().publicKey,
    signTransaction: async (tx: any) => tx,
    signAllTransactions: async (txs: any[]) => txs,
  };

  const provider = new AnchorProvider(
    connection,
    dummyWallet as Wallet,
    AnchorProvider.defaultOptions()
  );

  const program = new Program(stakingPoolIdl as any, provider);

  const errors: string[] = [];
  let synced = 0;

  try {
    // Fetch all pool accounts
    const accounts = await (program.account as any).stakingPoolState.all();

    console.log(`[Sync] Found ${accounts.length} pools on-chain`);

    for (const account of accounts) {
      try {
        const poolState = parsePoolState(account.publicKey, account.account);
        await syncPoolToDb(poolState);
        synced++;
      } catch (error) {
        const msg = `Failed to sync pool ${account.publicKey.toBase58()}: ${error}`;
        errors.push(msg);
        console.error(`[Sync] ${msg}`);
      }
    }
  } catch (error) {
    errors.push(`Failed to fetch pools: ${error}`);
    console.error('[Sync] Failed to fetch pools:', error);
  }

  console.log(`[Sync] Synced ${synced} pools, ${errors.length} errors`);

  return { synced, errors };
}

/**
 * Sync a single pool to database
 */
export async function syncPoolToDb(poolState: OnChainPoolState): Promise<void> {
  const poolData = {
    pool_pda: poolState.poolPda.toBase58(),
    pool_mint: poolState.poolMint.toBase58(),
    forecaster_wallet: poolState.forecaster.toBase58(),
    pool_type: poolState.poolType,
    base_token: poolState.baseTokenMint.toBase58(),
    min_deposit: poolState.config.minDeposit.toString(),
    max_capacity: poolState.config.maxCapacity.toString(),
    performance_fee_bps: poolState.config.performanceFeeBps,
    management_fee_bps: poolState.config.managementFeeBps,
    entry_fee_bps: poolState.config.entryFeeBps,
    exit_fee_bps: poolState.config.exitFeeBps,
    status: poolState.status,
    nav_per_share: poolState.navPerShare.toString(),
    high_water_mark: poolState.highWaterMark.toString(),
    total_deposits: poolState.totalDeposits.toString(),
    total_shares: poolState.totalShares.toString(),
    depositor_count: poolState.depositorCount,
    forecaster_tier: poolState.forecasterTier,
    created_at: poolState.createdAt.toISOString(),
    updated_at: new Date().toISOString(),
    activated_at: poolState.activatedAt?.toISOString() || null,
  };

  await db.upsertPool(poolData);

  // Record NAV snapshot
  await db.recordNavSnapshot(
    poolData.pool_pda,
    poolState.navPerShare,
    poolState.totalDeposits
  );
}

/**
 * Sync depositors for a specific pool
 */
export async function syncPoolDepositors(
  config: SyncConfig,
  poolPda: PublicKey
): Promise<{
  synced: number;
  errors: string[];
}> {
  const { connection } = config;

  const dummyWallet = {
    publicKey: Keypair.generate().publicKey,
    signTransaction: async (tx: any) => tx,
    signAllTransactions: async (txs: any[]) => txs,
  };

  const provider = new AnchorProvider(
    connection,
    dummyWallet as Wallet,
    AnchorProvider.defaultOptions()
  );

  const program = new Program(stakingPoolIdl as any, provider);

  const errors: string[] = [];
  let synced = 0;

  try {
    // Get pool record first
    const poolRecord = await db.getPoolByPda(poolPda.toBase58());
    if (!poolRecord) {
      errors.push('Pool not found in database');
      return { synced, errors };
    }

    // Fetch all depositor accounts for this pool
    const accounts = await (program.account as any).depositorState.all([
      {
        memcmp: {
          offset: 8, // After discriminator
          bytes: poolPda.toBase58(),
        },
      },
    ]);

    console.log(`[Sync] Found ${accounts.length} depositors for pool ${poolPda.toBase58()}`);

    for (const account of accounts) {
      try {
        const depositorState = parseDepositorState(account.publicKey, account.account);

        // Calculate current value based on NAV
        const navPerShare = Number(poolRecord.nav_per_share) / 1e9;
        const currentValue = BigInt(
          Math.floor(Number(depositorState.shares) * navPerShare)
        );
        const unrealizedPnl = currentValue - depositorState.depositedAmount;

        await db.upsertDelegation({
          pool_id: poolRecord.id,
          delegator_wallet: depositorState.owner.toBase58(),
          depositor_pda: depositorState.depositorPda.toBase58(),
          shares: depositorState.shares.toString() as any,
          deposited_amount: depositorState.depositedAmount.toString() as any,
          entry_nav: depositorState.entryNav.toString() as any,
          current_value: currentValue.toString() as any,
          unrealized_pnl: unrealizedPnl.toString() as any,
          withdrawal_requested: depositorState.withdrawalRequested.toString() as any,
          withdrawal_request_ts: depositorState.withdrawalRequestTs?.toISOString() || null,
          withdrawable_after: depositorState.withdrawableAfter?.toISOString() || null,
          first_deposit_at: depositorState.firstDepositAt.toISOString(),
          last_deposit_at: depositorState.lastDepositAt.toISOString(),
        });

        synced++;
      } catch (error) {
        const msg = `Failed to sync depositor ${account.publicKey.toBase58()}: ${error}`;
        errors.push(msg);
        console.error(`[Sync] ${msg}`);
      }
    }
  } catch (error) {
    errors.push(`Failed to fetch depositors: ${error}`);
    console.error('[Sync] Failed to fetch depositors:', error);
  }

  return { synced, errors };
}

/**
 * Run full sync (pools + all depositors)
 */
export async function runFullSync(config: SyncConfig): Promise<{
  poolsSynced: number;
  depositorsSynced: number;
  errors: string[];
}> {
  console.log('[Sync] Starting full sync...');

  const allErrors: string[] = [];
  let totalDepositors = 0;

  // Sync pools first
  const poolResult = await syncAllPools(config);
  allErrors.push(...poolResult.errors);

  // Get all pools from DB and sync their depositors
  const pools = await db.listPools({ limit: 1000 });

  for (const pool of pools) {
    const depositorResult = await syncPoolDepositors(
      config,
      new PublicKey(pool.poolPda)
    );
    totalDepositors += depositorResult.synced;
    allErrors.push(...depositorResult.errors);
  }

  console.log(
    `[Sync] Full sync complete: ${poolResult.synced} pools, ${totalDepositors} depositors, ${allErrors.length} errors`
  );

  return {
    poolsSynced: poolResult.synced,
    depositorsSynced: totalDepositors,
    errors: allErrors,
  };
}

// ============================================================================
// Helpers
// ============================================================================

function parsePoolState(pda: PublicKey, account: any): OnChainPoolState {
  return {
    poolPda: pda,
    poolMint: account.poolMint,
    baseTokenMint: account.baseTokenMint,
    poolBaseTokenAccount: account.poolBaseTokenAccount,
    forecaster: account.forecaster,
    forecasterTier: parseTier(account.forecasterTier),
    poolType: parsePoolType(account.poolType),
    config: {
      performanceFeeBps: account.config.performanceFeeBps,
      managementFeeBps: account.config.managementFeeBps,
      entryFeeBps: account.config.entryFeeBps,
      exitFeeBps: account.config.exitFeeBps,
      withdrawalDelay: account.config.withdrawalDelay,
      maxCapacity: BigInt(account.config.maxCapacity.toString()),
      minDeposit: BigInt(account.config.minDeposit.toString()),
      idleAllocationBps: account.config.idleAllocationBps,
    },
    status: parseStatus(account.status),
    totalDeposits: BigInt(account.totalDeposits.toString()),
    totalShares: BigInt(account.totalShares.toString()),
    depositorCount: account.depositorCount,
    navPerShare: BigInt(account.navPerShare.toString()),
    highWaterMark: BigInt(account.highWaterMark.toString()),
    lastNavUpdate: new Date(account.lastNavUpdate.toNumber() * 1000),
    accruedPerformanceFee: BigInt(account.accruedPerformanceFee.toString()),
    accruedManagementFee: BigInt(account.accruedManagementFee.toString()),
    lastFeeCollection: new Date(account.lastFeeCollection.toNumber() * 1000),
    createdAt: new Date(account.createdAt.toNumber() * 1000),
    activatedAt: account.activatedAt
      ? new Date(account.activatedAt.toNumber() * 1000)
      : null,
  };
}

function parseDepositorState(pda: PublicKey, account: any) {
  return {
    depositorPda: pda,
    poolPda: account.poolState,
    owner: account.owner,
    shares: BigInt(account.shares.toString()),
    depositedAmount: BigInt(account.depositedAmount.toString()),
    entryNav: BigInt(account.entryNav.toString()),
    withdrawalRequested: BigInt(account.withdrawalRequested.toString()),
    withdrawalRequestTs: account.withdrawalRequestTs
      ? new Date(account.withdrawalRequestTs.toNumber() * 1000)
      : null,
    withdrawableAfter: account.withdrawableAfter
      ? new Date(account.withdrawableAfter.toNumber() * 1000)
      : null,
    firstDepositAt: new Date(account.firstDepositAt.toNumber() * 1000),
    lastDepositAt: new Date(account.lastDepositAt.toNumber() * 1000),
  };
}

function parseTier(tier: any): ForecasterTier {
  if (tier.unranked) return 'unranked';
  if (tier.rookie) return 'rookie';
  if (tier.verified) return 'verified';
  if (tier.elite) return 'elite';
  if (tier.super) return 'super';
  return 'unranked';
}

function parsePoolType(type: any): OnChainPoolType {
  if (type.tournament) return 'tournament';
  if (type.alphaVault) return 'alpha_vault';
  if (type.indexPool) return 'index_pool';
  return 'alpha_vault';
}

function parseStatus(status: any): OnChainPoolStatus {
  if (status.pending) return 'pending';
  if (status.open) return 'open';
  if (status.active) return 'active';
  if (status.paused) return 'paused';
  if (status.settling) return 'settling';
  if (status.closed) return 'closed';
  return 'pending';
}

// ============================================================================
// Cron Job Helper
// ============================================================================

/**
 * Create sync runner for cron jobs
 */
export function createSyncRunner(
  rpcUrl: string,
  network: 'devnet' | 'mainnet' = 'devnet'
) {
  const connection = new Connection(rpcUrl, 'confirmed');

  return {
    syncPools: () => syncAllPools({ connection, network }),
    syncPoolDepositors: (poolPda: PublicKey) =>
      syncPoolDepositors({ connection, network }, poolPda),
    fullSync: () => runFullSync({ connection, network }),
  };
}
