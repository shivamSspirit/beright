/**
 * Environment Configuration for BeRight Protocol
 *
 * Provides runtime environment detection and validation.
 * Different environments have different security requirements:
 *
 * - development: Relaxed validation, mock data allowed
 * - staging: Stricter validation, test credentials
 * - production: Strict validation, all secrets required
 */

// ============================================
// ENVIRONMENT TYPES
// ============================================

export type Environment = 'development' | 'staging' | 'production';

export type BeRightMode = 'demo' | 'production';

export interface EnvironmentConfig {
  environment: Environment;
  mode: BeRightMode;
  isProduction: boolean;
  isDevelopment: boolean;
  isDemoMode: boolean;
  requireStrictSecrets: boolean;
  allowRealTransactions: boolean;
  urls: {
    api: string;
    app: string;
    rpc: string;
  };
}

// ============================================
// ENVIRONMENT DETECTION
// ============================================

function detectEnvironment(): Environment {
  const nodeEnv = process.env.NODE_ENV?.toLowerCase();
  const vercelEnv = process.env.VERCEL_ENV?.toLowerCase();
  const railwayEnv = process.env.RAILWAY_ENVIRONMENT?.toLowerCase();

  if (vercelEnv === 'production' || railwayEnv === 'production') {
    return 'production';
  }

  if (vercelEnv === 'preview' || railwayEnv === 'staging') {
    return 'staging';
  }

  if (nodeEnv === 'production') {
    return 'production';
  }

  if (nodeEnv === 'staging' || nodeEnv === 'test') {
    return 'staging';
  }

  return 'development';
}

function detectMode(): BeRightMode {
  const mode = process.env.BERIGHT_MODE?.toLowerCase();
  if (mode === 'production') {
    return 'production';
  }
  return 'demo';
}

function getUrls(env: Environment): EnvironmentConfig['urls'] {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL
    || process.env.API_URL
    || (env === 'production' ? 'https://api.beright.ai' : 'http://localhost:3001');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
    || process.env.APP_URL
    || (env === 'production' ? 'https://beright.ai' : 'http://localhost:3000');

  const rpcUrl = process.env.HELIUS_RPC_MAINNET
    || process.env.SOLANA_RPC_URL
    || 'https://api.mainnet-beta.solana.com';

  return { api: apiUrl, app: appUrl, rpc: rpcUrl };
}

let cachedConfig: EnvironmentConfig | null = null;

export function getEnvironmentConfig(): EnvironmentConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const environment = detectEnvironment();
  const mode = detectMode();
  const isProduction = environment === 'production';
  const isDevelopment = environment === 'development';
  const isDemoMode = mode === 'demo';

  cachedConfig = {
    environment,
    mode,
    isProduction,
    isDevelopment,
    isDemoMode,
    requireStrictSecrets: isProduction,
    allowRealTransactions: isProduction && !isDemoMode,
    urls: getUrls(environment),
  };

  return cachedConfig;
}

export function resetEnvironmentConfig(): void {
  cachedConfig = null;
}

export function getEnvironment(): Environment {
  return getEnvironmentConfig().environment;
}

export function isProduction(): boolean {
  return getEnvironmentConfig().isProduction;
}

export function isDevelopment(): boolean {
  return getEnvironmentConfig().isDevelopment;
}

export function isDemoMode(): boolean {
  return getEnvironmentConfig().isDemoMode;
}

export function requireStrictSecrets(): boolean {
  return getEnvironmentConfig().requireStrictSecrets;
}

export function allowRealTransactions(): boolean {
  return getEnvironmentConfig().allowRealTransactions;
}

export function assertProduction(operation: string): void {
  if (!isProduction()) {
    throw new Error(
      `Operation "${operation}" is only allowed in production. Current environment: ` + getEnvironment()
    );
  }
}

export function assertNotProduction(operation: string): void {
  if (isProduction()) {
    throw new Error(
      `Operation "${operation}" is not allowed in production.`
    );
  }
}

export function assertRealTransactionsAllowed(): void {
  if (!allowRealTransactions()) {
    throw new Error(
      'Real transactions are not allowed in this environment.'
    );
  }
}

export function logEnvironmentInfo(): void {
  const config = getEnvironmentConfig();
  console.log('[Environment] Configuration:');
  console.log(`  Environment: ` + config.environment);
  console.log(`  Mode: ` + config.mode);
  console.log(`  Strict Secrets: ` + config.requireStrictSecrets);
  console.log(`  Real Transactions: ` + config.allowRealTransactions);
  console.log(`  API URL: ` + config.urls.api);
}
