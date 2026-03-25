/**
 * Pool Detail API
 *
 * GET /api/v2/delegation/pools/[poolId] - Get pool details from blockchain
 *
 * @author BeRight Protocol
 */

import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { isDemo } from '@/lib/mode';

interface RouteParams {
  params: Promise<{ poolId: string }>;
}

// Known token mints
const NATIVE_SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDC_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

// Determine token symbol from mint address
function getTokenSymbol(mintAddress: string | null): 'SOL' | 'USDC' {
  if (!mintAddress) return 'USDC'; // fallback
  if (mintAddress === NATIVE_SOL_MINT) return 'SOL';
  if (mintAddress === USDC_MAINNET || mintAddress === USDC_DEVNET) return 'USDC';
  // Default to USDC for unknown mints (safer assumption)
  return 'USDC';
}

// Extract baseToken from pool state (handles snake_case to camelCase conversion)
function extractBaseTokenMint(state: Record<string, unknown>): string | null {
  // Try various field names (Anchor may convert snake_case to camelCase)
  const possibleFields = ['baseToken', 'base_token', 'baseTokenMint', 'base_token_mint'];

  for (const field of possibleFields) {
    const value = state[field];
    if (value instanceof PublicKey) {
      return value.toBase58();
    }
    if (typeof value === 'string' && value.length >= 32 && value.length <= 44) {
      return value;
    }
    // Handle object with toBase58 method
    if (value && typeof value === 'object' && 'toBase58' in value) {
      return (value as { toBase58: () => string }).toBase58();
    }
  }

  return null;
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
 * GET /api/v2/delegation/pools/[poolId]
 *
 * Get pool details by address from blockchain
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const startTime = Date.now();

  try {
    const { poolId } = await params;

    // Validate pool address
    let poolPk: PublicKey;
    try {
      poolPk = new PublicKey(poolId);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid pool address' },
        { status: 400 }
      );
    }

    // Get RPC URL
    const rpcUrl = isDemo()
      ? process.env.HELIUS_RPC_DEVNET || 'https://api.devnet.solana.com'
      : process.env.SOLANA_RPC_URL || process.env.HELIUS_RPC_MAINNET || 'https://api.mainnet-beta.solana.com';

    const network = isDemo() ? 'devnet' : 'mainnet';
    const connection = new Connection(rpcUrl, 'confirmed');

    console.log(`[API delegation/pools/${poolId.slice(0, 8)}] Fetching from blockchain (${network})...`);

    // Import Anchor client
    const { getStakingPoolClient } = await import('@/lib/staking/forecast-pool');
    const client = getStakingPoolClient(connection, { network });

    // Fetch pool state from blockchain
    const poolState = await client.getPoolState(poolPk);

    if (!poolState) {
      return NextResponse.json(
        { success: false, error: 'Pool not found' },
        { status: 404 }
      );
    }

    const state = poolState as Record<string, unknown>;

    // Extract ACTUAL baseToken from on-chain state
    const baseTokenMint = extractBaseTokenMint(state);
    const baseToken = getTokenSymbol(baseTokenMint);

    // Token decimals based on ACTUAL token (not demo mode)
    const tokenDecimals = baseToken === 'SOL' ? 1e9 : 1e6;
    const defaultMinDeposit = baseToken === 'SOL' ? 0.1 : 5; // 0.1 SOL or 5 USDC
    const defaultMaxCapacity = baseToken === 'SOL' ? 100 : 100000; // 100 SOL or 100k USDC

    // Extract values from on-chain state
    const totalDeposits = state.totalDeposits ? Number(String(state.totalDeposits)) : 0;
    const navPerShare = state.navPerShare ? Number(String(state.navPerShare)) / 1e9 : 1;
    const depositorCount = (state.depositorCount as number) || 0;
    const config = state.config as Record<string, unknown> | undefined;
    const performanceFeeBps = (config?.performanceFeeBps as number) || 2000;
    const managementFeeBps = (config?.managementFeeBps as number) || 200;
    const minDeposit = config?.minDeposit ? Number(String(config.minDeposit)) / tokenDecimals : defaultMinDeposit;
    const maxCapacity = config?.maxCapacity ? Number(String(config.maxCapacity)) / tokenDecimals : defaultMaxCapacity;
    const forecasterPk = state.forecaster as { toBase58: () => string } | undefined;
    const forecaster = forecasterPk?.toBase58() || '';
    const brierScore = (state.avgBrierScore as number) || null;
    const tier = determineTier(brierScore);

    const pool = {
      id: poolId,
      poolPda: poolId,
      slug: null,
      name: `Pool ${poolId.slice(0, 8)}...`,
      description: null,
      forecasterWallet: forecaster,
      forecasterTier: tier,
      forecasterBrier: brierScore,
      status: parsePoolStatus(state.status),
      tvl: totalDeposits / tokenDecimals,
      navPerShare: navPerShare,
      delegatorCount: depositorCount,
      performanceFeeBps: performanceFeeBps,
      managementFeeBps: managementFeeBps,
      minDeposit: minDeposit,
      maxCapacity: maxCapacity,
      entryFeeBps: (config?.entryFeeBps as number) || 0,
      exitFeeBps: (config?.exitFeeBps as number) || 50,
      baseToken: baseToken, // Use ACTUAL token from on-chain state
      baseTokenMint: baseTokenMint, // Include mint address for reference
      createdAt: state.createdAt
        ? new Date(Number(String(state.createdAt)) * 1000).toISOString()
        : new Date().toISOString(),
      activatedAt: state.activatedAt
        ? new Date(Number(String(state.activatedAt)) * 1000).toISOString()
        : null,
    };

    console.log(`[API delegation/pools/${poolId.slice(0, 8)}] Found pool, forecaster: ${forecaster.slice(0, 8)}..., baseToken: ${baseToken}`);

    return NextResponse.json({
      success: true,
      data: pool,
      meta: {
        source: 'blockchain',
        network,
        latencyMs: Date.now() - startTime,
      },
    });
  } catch (error) {
    console.error('[API delegation/pools/[poolId]] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to get pool' },
      { status: 500 }
    );
  }
}
