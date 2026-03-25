/**
 * Delegation Pools API
 *
 * GET /api/v2/delegation/pools - List pools from BLOCKCHAIN (not Supabase)
 *
 * Fetches all staking pools directly from Solana, no database needed.
 *
 * @author BeRight Protocol
 */

import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { isDemo } from '@/lib/mode';

// Tier mapping for display
const TIER_LABELS: Record<string, string> = {
  rookie: 'Rookie',
  verified: 'Verified',
  elite: 'Elite',
  super: 'Super Forecaster',
  unranked: 'Unranked',
};

// Parse pool type from Anchor enum
function parsePoolType(poolType: any): string {
  if (poolType?.tournament) return 'tournament';
  if (poolType?.alphaVault) return 'alpha_vault';
  if (poolType?.indexPool) return 'index_pool';
  return 'alpha_vault';
}

// Parse pool status from Anchor enum
function parsePoolStatus(status: any): string {
  if (status?.pending) return 'pending';
  if (status?.open) return 'open';
  if (status?.active) return 'active';
  if (status?.paused) return 'paused';
  if (status?.settling) return 'settling';
  if (status?.closed) return 'closed';
  return 'open';
}

// Determine tier from Brier score
function determineTier(brierScore: number | null): string {
  if (brierScore === null) return 'unranked';
  if (brierScore <= 0.15) return 'super';
  if (brierScore <= 0.20) return 'elite';
  if (brierScore <= 0.25) return 'verified';
  return 'rookie';
}

/**
 * GET /api/v2/delegation/pools
 *
 * List all pools from blockchain
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const tierFilter = searchParams.get('tier');
    const sortBy = searchParams.get('sortBy') || 'tvl';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const limit = parseInt(searchParams.get('limit') || '50');

    // Get RPC URL
    const rpcUrl = isDemo()
      ? process.env.HELIUS_RPC_DEVNET || 'https://api.devnet.solana.com'
      : process.env.SOLANA_RPC_URL || process.env.HELIUS_RPC_MAINNET || 'https://api.mainnet-beta.solana.com';

    const network = isDemo() ? 'devnet' : 'mainnet';
    const connection = new Connection(rpcUrl, 'confirmed');

    console.log(`[API delegation/pools] Fetching pools from blockchain (${network})...`);

    // Import Anchor client
    const { getStakingPoolClient } = await import('@/lib/staking/forecast-pool');
    const client = getStakingPoolClient(connection, { network });

    // Fetch all pools from blockchain
    const onChainPools = await client.getAllPools();

    console.log(`[API delegation/pools] Found ${onChainPools.length} pools on-chain`);

    // Token decimals: SOL = 9, USDC = 6
    const demoMode = isDemo();
    const tokenDecimals = demoMode ? 1e9 : 1e6;

    // Transform to API format
    let pools = onChainPools.map((pool) => {
      const state = pool.state as any;

      // Extract values from on-chain state
      const totalDeposits = state.totalDeposits ? Number(state.totalDeposits.toString()) : 0;
      const navPerShare = state.navPerShare ? Number(state.navPerShare.toString()) / 1e9 : 1;
      const depositorCount = state.depositorCount || 0;
      const performanceFeeBps = state.config?.performanceFeeBps || 2000;
      const forecaster = state.forecaster?.toBase58() || '';

      // Determine tier based on pool config or default
      const brierScore = state.avgBrierScore || null;
      const tier = determineTier(brierScore);

      return {
        id: pool.address.toBase58(),
        poolPda: pool.address.toBase58(),
        slug: null,
        name: `Pool ${pool.address.toBase58().slice(0, 8)}...`,
        forecasterWallet: forecaster,
        forecasterTier: tier,
        forecasterBrier: brierScore,
        status: parsePoolStatus(state.status),
        tvl: totalDeposits / tokenDecimals, // Convert to token units (SOL or USDC)
        navPerShare: navPerShare,
        delegatorCount: depositorCount,
        performanceFeeBps: performanceFeeBps,
        createdAt: state.createdAt
          ? new Date(Number(state.createdAt.toString()) * 1000).toISOString()
          : new Date().toISOString(),
      };
    });

    // Apply filters
    if (statusFilter && statusFilter !== 'all') {
      const statuses = statusFilter.split(',');
      pools = pools.filter((p) => statuses.includes(p.status));
    }

    if (tierFilter && tierFilter !== 'all') {
      const tiers = tierFilter.split(',');
      pools = pools.filter((p) => tiers.includes(p.forecasterTier));
    }

    // Apply sorting
    pools.sort((a, b) => {
      let aVal: number, bVal: number;

      switch (sortBy) {
        case 'tvl':
          aVal = a.tvl;
          bVal = b.tvl;
          break;
        case 'nav':
          aVal = a.navPerShare;
          bVal = b.navPerShare;
          break;
        case 'delegators':
          aVal = a.delegatorCount;
          bVal = b.delegatorCount;
          break;
        case 'brier':
          aVal = a.forecasterBrier || 1;
          bVal = b.forecasterBrier || 1;
          break;
        case 'created':
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
          break;
        default:
          aVal = a.tvl;
          bVal = b.tvl;
      }

      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    // Apply limit
    pools = pools.slice(0, limit);

    return NextResponse.json({
      success: true,
      data: pools,
      meta: {
        count: pools.length,
        source: 'blockchain',
        network,
        latencyMs: Date.now() - startTime,
      },
    });
  } catch (error) {
    console.error('[API delegation/pools] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list pools',
      },
      { status: 500 }
    );
  }
}
