/**
 * Gas & Bridge Fee Estimator
 *
 * Estimates on-chain gas costs and cross-chain bridge fees.
 *
 * @author BeRight Protocol
 */

import { GasFeeCost, BridgeFeeCost, ChainType } from './types';

// =============================================================================
// CHAIN GAS CONFIGURATIONS
// =============================================================================

/**
 * Chain gas configurations
 * Note: Prices should be updated dynamically in production
 */
interface ChainGasConfig {
  avgGasUnits: number;
  avgGweiOrLamports: number;
  nativeTokenPrice: number;  // USD
}

const CHAIN_GAS: Record<string, ChainGasConfig> = {
  solana: {
    avgGasUnits: 5000,       // Compute units
    avgGweiOrLamports: 5000, // Lamports
    nativeTokenPrice: 150,   // SOL price
  },
  polygon: {
    avgGasUnits: 150000,     // Gas units
    avgGweiOrLamports: 50,   // Gwei
    nativeTokenPrice: 0.5,   // MATIC price
  },
  ethereum: {
    avgGasUnits: 150000,
    avgGweiOrLamports: 30,
    nativeTokenPrice: 3000,  // ETH price
  },
  base: {
    avgGasUnits: 150000,
    avgGweiOrLamports: 0.01, // Very cheap
    nativeTokenPrice: 3000,
  },
};

/**
 * Platform to chain mapping
 */
const PLATFORM_CHAINS: Record<string, ChainType> = {
  polymarket: 'polygon',
  kalshi: 'offchain',
  manifold: 'offchain',
  jupiter: 'solana',
  dflow: 'solana',
  limitless: 'base',
};

// =============================================================================
// GAS ESTIMATION
// =============================================================================

/**
 * Estimate gas fee for a trade
 */
export async function estimateGasFee(
  platform: string,
  originChain: string
): Promise<GasFeeCost> {
  const targetChain = PLATFORM_CHAINS[platform];

  // Offchain platforms have no gas
  if (targetChain === 'offchain') {
    return {
      chain: 'offchain',
      usdAmount: 0,
      confidence: 'high',
    };
  }

  const chainConfig = CHAIN_GAS[targetChain];
  if (!chainConfig) {
    return {
      chain: targetChain || 'unknown',
      usdAmount: 0.50, // Conservative default
      confidence: 'low',
    };
  }

  // Calculate gas cost
  let usdAmount: number;

  if (targetChain === 'solana') {
    // Solana: lamports * price / 1e9
    usdAmount = (chainConfig.avgGasUnits * chainConfig.avgGweiOrLamports * chainConfig.nativeTokenPrice) / 1e9;
  } else {
    // EVM: gasUnits * gwei * price / 1e9
    usdAmount = (chainConfig.avgGasUnits * chainConfig.avgGweiOrLamports * chainConfig.nativeTokenPrice) / 1e9;
  }

  return {
    chain: targetChain,
    estimatedGwei: chainConfig.avgGweiOrLamports,
    usdAmount: Math.max(usdAmount, 0.001), // Minimum $0.001
    confidence: 'medium',
  };
}

// =============================================================================
// BRIDGE ESTIMATION
// =============================================================================

/**
 * Bridge cost estimates
 */
interface BridgeConfig {
  usd: number;
  seconds: number;
  provider: string;
}

const BRIDGE_COSTS: Record<string, BridgeConfig> = {
  'solana-polygon': { usd: 2.0, seconds: 180, provider: 'Wormhole' },
  'solana-base': { usd: 1.5, seconds: 120, provider: 'Wormhole' },
  'solana-ethereum': { usd: 5.0, seconds: 300, provider: 'Wormhole' },
  'polygon-solana': { usd: 2.0, seconds: 180, provider: 'Wormhole' },
  'polygon-base': { usd: 0.5, seconds: 60, provider: 'Across' },
  'polygon-ethereum': { usd: 2.0, seconds: 120, provider: 'Across' },
  'ethereum-polygon': { usd: 3.0, seconds: 120, provider: 'Across' },
  'ethereum-base': { usd: 1.0, seconds: 60, provider: 'Across' },
  'ethereum-solana': { usd: 5.0, seconds: 300, provider: 'Wormhole' },
  'base-polygon': { usd: 0.5, seconds: 60, provider: 'Across' },
  'base-ethereum': { usd: 1.0, seconds: 60, provider: 'Across' },
  'base-solana': { usd: 1.5, seconds: 120, provider: 'Wormhole' },
};

/**
 * Estimate bridge fee if cross-chain
 */
export async function estimateBridgeFee(
  originChain: string,
  targetPlatform: string
): Promise<BridgeFeeCost> {
  const targetChain = PLATFORM_CHAINS[targetPlatform];

  // No bridge needed for offchain or same chain
  if (targetChain === 'offchain' || targetChain === originChain) {
    return {
      required: false,
      estimatedUsd: 0,
      estimatedTimeSeconds: 0,
    };
  }

  const key = `${originChain}-${targetChain}`;
  const bridgeInfo = BRIDGE_COSTS[key] || { usd: 3.0, seconds: 180, provider: 'Unknown' };

  return {
    required: true,
    fromChain: originChain,
    toChain: targetChain,
    estimatedUsd: bridgeInfo.usd,
    estimatedTimeSeconds: bridgeInfo.seconds,
    provider: bridgeInfo.provider,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get chain for a platform
 */
export function getPlatformChain(platform: string): ChainType {
  return PLATFORM_CHAINS[platform] || 'offchain';
}

/**
 * Check if bridge is needed
 */
export function needsBridge(originChain: string, targetPlatform: string): boolean {
  const targetChain = PLATFORM_CHAINS[targetPlatform];
  return targetChain !== 'offchain' && targetChain !== originChain;
}

/**
 * Get total gas + bridge cost
 */
export async function estimateTotalChainCosts(
  platform: string,
  originChain: string
): Promise<{ gasFee: GasFeeCost; bridgeFee: BridgeFeeCost; totalUsd: number }> {
  const [gasFee, bridgeFee] = await Promise.all([
    estimateGasFee(platform, originChain),
    estimateBridgeFee(originChain, platform),
  ]);

  return {
    gasFee,
    bridgeFee,
    totalUsd: gasFee.usdAmount + bridgeFee.estimatedUsd,
  };
}

/**
 * Update chain gas prices (for production use with live data)
 */
export function updateGasPrice(
  chain: string,
  gweiOrLamports: number,
  nativeTokenPrice?: number
): void {
  if (CHAIN_GAS[chain]) {
    CHAIN_GAS[chain].avgGweiOrLamports = gweiOrLamports;
    if (nativeTokenPrice !== undefined) {
      CHAIN_GAS[chain].nativeTokenPrice = nativeTokenPrice;
    }
  }
}
