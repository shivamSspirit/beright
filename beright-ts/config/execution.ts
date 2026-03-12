/**
 * Microsecond/Millisecond Execution Configuration
 *
 * Centralized configuration for high-speed trade execution on Solana.
 * Supports JITO bundles, Jupiter Ultra, and connection pooling.
 *
 * @author BeRight Protocol
 */

// ============================================================================
// JITO TIP ACCOUNTS (Official Solana MEV protection)
// ============================================================================

export const JITO_TIP_ACCOUNTS = [
  '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
  'HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe',
  'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
  'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49',
  'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
  'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt',
  'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
  '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT',
] as const;

// ============================================================================
// JITO BLOCK ENGINE ENDPOINTS (Regional)
// ============================================================================

export const JITO_BLOCK_ENGINES = {
  mainnet: 'https://mainnet.block-engine.jito.wtf/api/v1',
  amsterdam: 'https://amsterdam.mainnet.block-engine.jito.wtf/api/v1',
  frankfurt: 'https://frankfurt.mainnet.block-engine.jito.wtf/api/v1',
  ny: 'https://ny.mainnet.block-engine.jito.wtf/api/v1',
  tokyo: 'https://tokyo.mainnet.block-engine.jito.wtf/api/v1',
} as const;

// ============================================================================
// EXECUTION CONFIGURATION
// ============================================================================

export const EXECUTION_CONFIG = {
  // -------------------------------------------------------------------------
  // Connection Pool Settings
  // -------------------------------------------------------------------------
  connections: {
    /** Maximum HTTP connections per host */
    maxPoolSize: 10,
    /** Keep-alive timeout in milliseconds */
    keepAliveMs: 60_000,
    /** Request timeout in milliseconds */
    requestTimeoutMs: 5_000,
    /** Blockhash refresh interval (Solana slots are ~400ms) */
    blockhashRefreshMs: 400,
    /** Skip preflight for maximum speed */
    skipPreflight: true,
    /** Commitment level for confirmations */
    commitment: 'confirmed' as const,
    /** Max retries for failed requests */
    maxRetries: 3,
  },

  // -------------------------------------------------------------------------
  // RPC Endpoints
  // -------------------------------------------------------------------------
  rpc: {
    /** Primary Helius RPC (from env) */
    helius: process.env.HELIUS_RPC_MAINNET || process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    /** WebSocket endpoint */
    heliusWs: process.env.HELIUS_WEBSOCKET_URL || 'wss://atlas-mainnet.helius-rpc.com',
    /** Fallback RPC */
    fallback: 'https://api.mainnet-beta.solana.com',
  },

  // -------------------------------------------------------------------------
  // Priority Fee Settings
  // -------------------------------------------------------------------------
  priorityFee: {
    /** Default priority fee in microlamports */
    defaultMicroLamports: 10_000,
    /** Maximum priority fee in microlamports (prevent overpaying) */
    maxMicroLamports: 1_000_000,
    /** Minimum priority fee in microlamports */
    minMicroLamports: 1_000,
    /** Auto-adjust based on network conditions */
    autoAdjust: true,
    /** Percentile to use when auto-adjusting (75th = aggressive) */
    autoAdjustPercentile: 0.75,
    /** Buffer multiplier on top of percentile */
    autoAdjustBuffer: 1.1,
  },

  // -------------------------------------------------------------------------
  // Compute Unit Settings
  // -------------------------------------------------------------------------
  computeUnits: {
    /** Default compute unit limit */
    defaultLimit: 200_000,
    /** Max compute unit limit */
    maxLimit: 1_400_000,
    /** Min compute unit limit */
    minLimit: 50_000,
  },

  // -------------------------------------------------------------------------
  // JITO Bundle Settings
  // -------------------------------------------------------------------------
  jito: {
    /** Enable JITO bundles */
    enabled: true,
    /** Block engine URL (from env or default) */
    blockEngineUrl: process.env.JITO_BLOCK_ENGINE_URL || JITO_BLOCK_ENGINES.mainnet,
    /** Default tip in lamports */
    defaultTipLamports: parseInt(process.env.JITO_DEFAULT_TIP_LAMPORTS || '10000', 10),
    /** Maximum tip in lamports */
    maxTipLamports: parseInt(process.env.JITO_MAX_TIP_LAMPORTS || '100000', 10),
    /** Minimum tip in lamports */
    minTipLamports: 1_000,
    /** Bundle confirmation timeout in ms */
    confirmationTimeoutMs: 30_000,
    /** Status poll interval in ms */
    statusPollIntervalMs: 500,
  },

  // -------------------------------------------------------------------------
  // Jupiter Settings
  // -------------------------------------------------------------------------
  jupiter: {
    /** Standard Jupiter V6 API */
    v6ApiUrl: process.env.JUPITER_API_URL || 'https://quote-api.jup.ag/v6',
    /** Jupiter Ultra API (faster) */
    ultraApiUrl: process.env.JUPITER_ULTRA_API_URL || 'https://ultra-api.jup.ag',
    /** Use Ultra API when available */
    preferUltra: true,
    /** Referral account for fee sharing */
    referralAccount: process.env.JUPITER_REFERRAL_ACCOUNT,
    /** Platform fee in basis points */
    feeBps: parseInt(process.env.JUPITER_FEE_BPS || '50', 10),
    /** Default slippage in basis points */
    defaultSlippageBps: 100,
    /** Max slippage in basis points */
    maxSlippageBps: 300,
    /** Quote timeout in ms */
    quoteTimeoutMs: 2_000,
  },

  // -------------------------------------------------------------------------
  // Auto-Arbitrage Settings
  // -------------------------------------------------------------------------
  autoArbitrage: {
    /** Enable auto-arbitrage (KILL SWITCH - off by default) */
    enabled: process.env.EXECUTION_AUTO_ARB_ENABLED === 'true',
    /** Minimum spread to execute (0.03 = 3%) */
    minSpreadPct: parseFloat(process.env.EXECUTION_MIN_SPREAD_PCT || '0.03'),
    /** Maximum position size in USD */
    maxPositionUsd: parseFloat(process.env.EXECUTION_MAX_POSITION_USD || '100'),
    /** Maximum daily loss in USD (stop trading if exceeded) */
    maxDailyLossUsd: parseFloat(process.env.EXECUTION_MAX_DAILY_LOSS_USD || '50'),
    /** Cooldown between auto-trades in ms */
    cooldownMs: parseInt(process.env.EXECUTION_COOLDOWN_MS || '10000', 10),
    /** Maximum concurrent auto-trades */
    maxConcurrentTrades: 1,
    /** Minimum confidence grade for execution */
    minConfidenceGrade: 'B' as const,
    /** Platforms to monitor for arbitrage */
    monitoredPlatforms: ['dflow', 'polymarket', 'kalshi'] as const,
  },

  // -------------------------------------------------------------------------
  // Latency Targets
  // -------------------------------------------------------------------------
  latency: {
    /** Target quote latency in ms */
    targetQuoteMs: 100,
    /** Target transaction build latency in ms */
    targetBuildMs: 50,
    /** Target submission latency in ms */
    targetSubmitMs: 200,
    /** Target confirmation latency in ms */
    targetConfirmMs: 5_000,
    /** Maximum acceptable quote latency (abort if exceeded) */
    maxQuoteMs: 500,
    /** Maximum acceptable total latency */
    maxTotalMs: 10_000,
  },

  // -------------------------------------------------------------------------
  // Risk Controls
  // -------------------------------------------------------------------------
  risk: {
    /** Maximum slippage in basis points */
    maxSlippageBps: 300,
    /** Maximum price impact percentage */
    maxPriceImpactPct: 0.02,
    /** Maximum single trade size in USD */
    maxTradeSizeUsd: 1_000,
    /** Minimum trade size in USD */
    minTradeSizeUsd: 1,
    /** Require confirmation for trades above this USD amount */
    confirmationThresholdUsd: 100,
  },

  // -------------------------------------------------------------------------
  // Token Mints (Common)
  // -------------------------------------------------------------------------
  tokens: {
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    SOL: 'So11111111111111111111111111111111111111112',
    USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  },
} as const;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type JitoBlockEngine = keyof typeof JITO_BLOCK_ENGINES;
export type ExecutionCommitment = 'processed' | 'confirmed' | 'finalized';
export type ConfidenceGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface LatencyMetrics {
  /** Quote fetch time in microseconds */
  quoteUs: number;
  /** Transaction build time in microseconds */
  buildUs: number;
  /** Signing time in microseconds */
  signUs: number;
  /** Submission time in microseconds */
  submitUs: number;
  /** Confirmation time in microseconds */
  confirmUs: number;
  /** Total end-to-end time in microseconds */
  totalUs: number;
  /** Solana slot at execution */
  slot?: number;
  /** Unix timestamp */
  timestamp: number;
}

export interface FastExecutionResult {
  success: boolean;
  signature?: string;
  explorerUrl?: string;
  inputAmount: number;
  outputAmount: number;
  priceImpact: number;
  slippage: number;
  fees: {
    priorityFeeLamports: number;
    jitoTipLamports: number;
    platformFeeBps: number;
  };
  latency: LatencyMetrics;
  error?: string;
  simulated?: boolean;
}

export interface AutoArbExecutionResult {
  opportunityId: string;
  executed: boolean;
  reason: string;
  signature?: string;
  profitUsd?: number;
  latencyMs: number;
  timestamp: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get a random JITO tip account
 */
export function getRandomJitoTipAccount(): string {
  return JITO_TIP_ACCOUNTS[Math.floor(Math.random() * JITO_TIP_ACCOUNTS.length)];
}

/**
 * Get the closest JITO block engine by region
 */
export function getJitoBlockEngine(region?: JitoBlockEngine): string {
  if (region && JITO_BLOCK_ENGINES[region]) {
    return JITO_BLOCK_ENGINES[region];
  }
  return EXECUTION_CONFIG.jito.blockEngineUrl;
}

/**
 * Check if auto-arbitrage is enabled and safe to execute
 */
export function canAutoExecute(): boolean {
  return EXECUTION_CONFIG.autoArbitrage.enabled;
}

/**
 * Get priority fee based on config
 */
export function getDefaultPriorityFee(): number {
  return EXECUTION_CONFIG.priorityFee.defaultMicroLamports;
}

/**
 * Get JITO tip based on config
 */
export function getDefaultJitoTip(): number {
  return EXECUTION_CONFIG.jito.defaultTipLamports;
}

export default EXECUTION_CONFIG;
