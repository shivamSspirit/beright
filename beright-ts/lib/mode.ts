/**
 * BeRight Mode Configuration
 *
 * Controls whether the app runs in demo or production mode.
 * The UI is identical in both modes - only the data sources change.
 *
 * Demo Mode (beright.fun):
 *   - Solana Devnet
 *   - Mock market data
 *   - Fake transaction confirmations
 *   - Paper trading only
 *   - Demo leaderboard
 *
 * Production Mode (future domain):
 *   - Solana Mainnet
 *   - Live DFlow/Jupiter APIs
 *   - Real blockchain transactions
 *   - Live trading enabled
 *   - Real leaderboard
 */

export type BeRightMode = 'demo' | 'production';

// ============================================
// MODE DETECTION
// ============================================

/**
 * Get current operating mode
 * Defaults to 'demo' for safety
 */
export function getMode(): BeRightMode {
  const mode = process.env.BERIGHT_MODE as BeRightMode;

  // Valid modes
  if (mode === 'production' || mode === 'demo') {
    return mode;
  }

  // Default to demo for safety (no real money at risk)
  return 'demo';
}

/**
 * Check if running in demo mode
 */
export function isDemo(): boolean {
  return getMode() === 'demo';
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return getMode() === 'production';
}

// ============================================
// MODE-SPECIFIC CONFIGURATION
// ============================================

export interface ModeConfig {
  // Solana
  solanaRpc: string;
  solanaNetwork: 'devnet' | 'mainnet-beta';

  // Trading
  tradingEnabled: boolean;
  tradingMode: 'paper' | 'live';

  // Data sources
  useRealMarketData: boolean;
  useRealLeaderboard: boolean;

  // Transactions
  confirmationsAreFake: boolean;

  // Features
  showWaitlist: boolean;
  requirePayment: boolean;

  // Labels
  networkLabel: string;
  modeLabel: string;
}

/**
 * Get configuration for current mode
 */
export function getModeConfig(): ModeConfig {
  const mode = getMode();

  if (mode === 'production') {
    return {
      // Solana
      solanaRpc: process.env.HELIUS_RPC_MAINNET || process.env.SOLANA_RPC_URL || '',
      solanaNetwork: 'mainnet-beta',

      // Trading
      tradingEnabled: true,
      tradingMode: 'live',

      // Data sources
      useRealMarketData: true,
      useRealLeaderboard: true,

      // Transactions
      confirmationsAreFake: false,

      // Features
      showWaitlist: false,
      requirePayment: true,

      // Labels
      networkLabel: 'Mainnet',
      modeLabel: 'Production',
    };
  }

  // Demo mode (default)
  return {
    // Solana
    solanaRpc: process.env.HELIUS_RPC_DEVNET || 'https://api.devnet.solana.com',
    solanaNetwork: 'devnet',

    // Trading
    tradingEnabled: true, // Paper trading enabled
    tradingMode: 'paper',

    // Data sources
    useRealMarketData: false,
    useRealLeaderboard: false,

    // Transactions
    confirmationsAreFake: true,

    // Features
    showWaitlist: true,
    requirePayment: false,

    // Labels
    networkLabel: 'Devnet',
    modeLabel: 'Demo',
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get Solana RPC URL for current mode
 */
export function getSolanaRpc(): string {
  return getModeConfig().solanaRpc;
}

/**
 * Get Solana network for current mode
 */
export function getSolanaNetwork(): 'devnet' | 'mainnet-beta' {
  return getModeConfig().solanaNetwork;
}

/**
 * Check if trading is in paper mode
 */
export function isPaperTrading(): boolean {
  return getModeConfig().tradingMode === 'paper';
}

/**
 * Check if real market data should be used
 */
export function useRealData(): boolean {
  return getModeConfig().useRealMarketData;
}

/**
 * Log current mode on startup
 */
export function logModeInfo(): void {
  const config = getModeConfig();
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  BeRight Protocol - ${config.modeLabel} Mode`);
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Network:     ${config.networkLabel}`);
  console.log(`  Trading:     ${config.tradingMode}`);
  console.log(`  Market Data: ${config.useRealMarketData ? 'Live APIs' : 'Demo Data'}`);
  console.log(`  Waitlist:    ${config.showWaitlist ? 'Enabled' : 'Disabled'}`);
  console.log('═══════════════════════════════════════════════════');
  console.log('');
}

// ============================================
// REQUEST-BASED MODE (Cookie Override)
// ============================================

/**
 * Get mode from cookie header (for UI-driven mode switching)
 * Falls back to environment-based mode
 */
export function getModeFromCookie(cookieHeader: string | null): BeRightMode {
  if (!cookieHeader) return getMode();
  const match = cookieHeader.match(/beright_mode=(demo|production)/);
  return (match?.[1] as BeRightMode) || getMode();
}

/**
 * Check if demo mode based on cookie (for request context)
 */
export function isDemoFromRequest(cookieHeader: string | null): boolean {
  return getModeFromCookie(cookieHeader) === 'demo';
}

/**
 * Check if production mode based on cookie (for request context)
 */
export function isProductionFromRequest(cookieHeader: string | null): boolean {
  return getModeFromCookie(cookieHeader) === 'production';
}
