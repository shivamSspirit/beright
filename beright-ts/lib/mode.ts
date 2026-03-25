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
// REQUEST-BASED MODE (Header-First, Cookie Fallback)
// ============================================

// Header constants (must match middleware.ts)
const MODE_HEADER = 'x-beright-mode';
const NETWORK_HEADER = 'x-beright-network';

/**
 * Get mode from request headers (injected by middleware)
 * This is the FAST path - middleware already parsed the cookie/query
 *
 * Priority:
 * 1. x-beright-mode header (set by middleware)
 * 2. Cookie parsing (fallback for non-middleware paths)
 * 3. Environment variable
 * 4. Default to 'demo'
 */
export function getModeFromHeaders(headers: Headers): BeRightMode {
  // Fast path: read from middleware-injected header
  const headerMode = headers.get(MODE_HEADER);
  if (headerMode === 'production' || headerMode === 'demo') {
    return headerMode;
  }

  // Fallback: parse cookie (for requests that bypass middleware)
  const cookieHeader = headers.get('cookie');
  if (cookieHeader) {
    const match = cookieHeader.match(/beright_mode=(demo|production)/);
    if (match?.[1]) {
      return match[1] as BeRightMode;
    }
  }

  // Final fallback: environment or default
  return getMode();
}

/**
 * Get network from request headers (injected by middleware)
 */
export function getNetworkFromHeaders(headers: Headers): 'devnet' | 'mainnet-beta' {
  const network = headers.get(NETWORK_HEADER);
  if (network === 'mainnet-beta' || network === 'devnet') {
    return network;
  }
  return getModeFromHeaders(headers) === 'production' ? 'mainnet-beta' : 'devnet';
}

/**
 * Check if demo mode from request headers
 * Use this in API routes for instant mode detection
 */
export function isDemoFromHeaders(headers: Headers): boolean {
  return getModeFromHeaders(headers) === 'demo';
}

/**
 * Check if production mode from request headers
 */
export function isProductionFromHeaders(headers: Headers): boolean {
  return getModeFromHeaders(headers) === 'production';
}

/**
 * Get full mode config from request headers
 * Useful when you need multiple config values
 */
export function getModeConfigFromHeaders(headers: Headers): ModeConfig {
  const mode = getModeFromHeaders(headers);

  if (mode === 'production') {
    return {
      solanaRpc: process.env.HELIUS_RPC_MAINNET || process.env.SOLANA_RPC_URL || '',
      solanaNetwork: 'mainnet-beta',
      tradingEnabled: true,
      tradingMode: 'live',
      useRealMarketData: true,
      useRealLeaderboard: true,
      confirmationsAreFake: false,
      showWaitlist: false,
      requirePayment: true,
      networkLabel: 'Mainnet',
      modeLabel: 'Production',
    };
  }

  return {
    solanaRpc: process.env.HELIUS_RPC_DEVNET || 'https://api.devnet.solana.com',
    solanaNetwork: 'devnet',
    tradingEnabled: true,
    tradingMode: 'paper',
    useRealMarketData: false,
    useRealLeaderboard: false,
    confirmationsAreFake: true,
    showWaitlist: true,
    requirePayment: false,
    networkLabel: 'Devnet',
    modeLabel: 'Demo',
  };
}

// ============================================
// LEGACY: Cookie-Based Mode (Deprecated)
// Use header-based functions above instead
// ============================================

/**
 * @deprecated Use getModeFromHeaders(request.headers) instead
 * Get mode from cookie header (for UI-driven mode switching)
 * Falls back to environment-based mode
 */
export function getModeFromCookie(cookieHeader: string | null): BeRightMode {
  if (!cookieHeader) return getMode();
  const match = cookieHeader.match(/beright_mode=(demo|production)/);
  return (match?.[1] as BeRightMode) || getMode();
}

/**
 * @deprecated Use isDemoFromHeaders(request.headers) instead
 * Check if demo mode based on cookie (for request context)
 */
export function isDemoFromRequest(cookieHeader: string | null): boolean {
  return getModeFromCookie(cookieHeader) === 'demo';
}

/**
 * @deprecated Use isProductionFromHeaders(request.headers) instead
 * Check if production mode based on cookie (for request context)
 */
export function isProductionFromRequest(cookieHeader: string | null): boolean {
  return getModeFromCookie(cookieHeader) === 'production';
}

// ============================================
// NEXTREQUEST HELPERS (For Next.js API Routes)
// ============================================

/**
 * Get mode directly from NextRequest
 * Convenience wrapper for API routes
 */
export function getModeFromRequest(request: { headers: Headers }): BeRightMode {
  return getModeFromHeaders(request.headers);
}

/**
 * Check if demo mode from NextRequest
 */
export function isDemoRequest(request: { headers: Headers }): boolean {
  return isDemoFromHeaders(request.headers);
}

/**
 * Check if production mode from NextRequest
 */
export function isProductionRequest(request: { headers: Headers }): boolean {
  return isProductionFromHeaders(request.headers);
}

// ============================================
// OWNER ACCESS CONTROL
// ============================================

/**
 * Owner email that has access to production mode
 * All other users are restricted to demo mode
 */
const OWNER_EMAIL = process.env.OWNER_EMAIL?.toLowerCase().trim();

/**
 * Validate mode access based on user email
 * Used for defense in depth - prevents API bypass attempts
 *
 * @param requestedMode - The mode requested by the client
 * @param userEmail - The authenticated user's email (from x-user-email header)
 * @returns The validated mode (forces demo for non-owners requesting production)
 */
export function validateModeAccess(
  requestedMode: BeRightMode,
  userEmail: string | null | undefined
): BeRightMode {
  // If requesting demo mode, allow for everyone
  if (requestedMode === 'demo') {
    return 'demo';
  }

  // If requesting production mode, validate owner email
  if (requestedMode === 'production') {
    const normalizedUserEmail = userEmail?.toLowerCase().trim();

    // Only allow production if user email matches owner email
    if (normalizedUserEmail && OWNER_EMAIL && normalizedUserEmail === OWNER_EMAIL) {
      return 'production';
    }

    // Force demo mode for non-owners
    return 'demo';
  }

  // Default to demo for any other case
  return 'demo';
}

/**
 * Check if a user email is the owner email
 */
export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email || !OWNER_EMAIL) return false;
  return email.toLowerCase().trim() === OWNER_EMAIL;
}

/**
 * Get validated mode from request headers
 * Combines mode detection with access control
 *
 * @param headers - Request headers (must include x-user-email for production access)
 * @returns Validated mode (demo for non-owners even if production was requested)
 */
export function getValidatedModeFromHeaders(headers: Headers): BeRightMode {
  const requestedMode = getModeFromHeaders(headers);
  const userEmail = headers.get('x-user-email');

  return validateModeAccess(requestedMode, userEmail);
}
