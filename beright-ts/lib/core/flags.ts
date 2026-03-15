/**
 * Feature Flags for BeRight Protocol
 * Runtime feature toggles for incremental rollout
 */

/**
 * Feature flag configuration
 */
export interface FeatureFlag {
  name: string;
  description: string;
  defaultValue: boolean;
  envVar: string;
}

/**
 * Defined feature flags
 */
const FLAG_DEFINITIONS: Record<string, FeatureFlag> = {
  USE_NEW_KALSHI_CLIENT: {
    name: 'USE_NEW_KALSHI_CLIENT',
    description: 'Use the refactored Kalshi client from lib/clients/kalshi',
    defaultValue: false,
    envVar: 'FF_NEW_KALSHI',
  },
  USE_CIRCUIT_BREAKER: {
    name: 'USE_CIRCUIT_BREAKER',
    description: 'Enable circuit breaker for external API calls',
    defaultValue: false,
    envVar: 'FF_CIRCUIT_BREAKER',
  },
  USE_REDIS_CACHE: {
    name: 'USE_REDIS_CACHE',
    description: 'Use Redis for DataFabric caching instead of in-memory',
    defaultValue: false,
    envVar: 'FF_REDIS_CACHE',
  },
  USE_NEW_TELEGRAM_HANDLERS: {
    name: 'USE_NEW_TELEGRAM_HANDLERS',
    description: 'Use the refactored modular Telegram handlers',
    defaultValue: false,
    envVar: 'FF_NEW_TELEGRAM_HANDLERS',
  },
  USE_NEW_FORMATTERS: {
    name: 'USE_NEW_FORMATTERS',
    description: 'Use the consolidated formatting utilities from lib/core/format',
    defaultValue: false,
    envVar: 'FF_NEW_FORMATTERS',
  },
  ENABLE_REQUEST_DEDUP: {
    name: 'ENABLE_REQUEST_DEDUP',
    description: 'Enable request deduplication for external API calls',
    defaultValue: true,
    envVar: 'FF_REQUEST_DEDUP',
  },
  ENABLE_RETRY: {
    name: 'ENABLE_RETRY',
    description: 'Enable automatic retry with backoff for failed requests',
    defaultValue: true,
    envVar: 'FF_RETRY',
  },
};

/**
 * Runtime flag values cache
 */
let flagCache: Map<string, boolean> | null = null;

/**
 * Parse boolean from environment variable
 */
function parseEnvBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') {
    return defaultValue;
  }
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Load all flags from environment
 */
function loadFlags(): Map<string, boolean> {
  const flags = new Map<string, boolean>();

  for (const [key, definition] of Object.entries(FLAG_DEFINITIONS)) {
    const envValue = process.env[definition.envVar];
    flags.set(key, parseEnvBool(envValue, definition.defaultValue));
  }

  return flags;
}

/**
 * Get flag value with caching
 */
function getFlagValue(flagName: string): boolean {
  if (!flagCache) {
    flagCache = loadFlags();
  }

  const value = flagCache.get(flagName);
  if (value === undefined) {
    console.warn(`Unknown feature flag: ${flagName}`);
    return false;
  }

  return value;
}

/**
 * Feature flags object for runtime checks
 *
 * @example
 * if (FLAGS.USE_NEW_KALSHI_CLIENT) {
 *   // Use new client
 * } else {
 *   // Use legacy client
 * }
 */
export const FLAGS = {
  get USE_NEW_KALSHI_CLIENT(): boolean {
    return getFlagValue('USE_NEW_KALSHI_CLIENT');
  },
  get USE_CIRCUIT_BREAKER(): boolean {
    return getFlagValue('USE_CIRCUIT_BREAKER');
  },
  get USE_REDIS_CACHE(): boolean {
    return getFlagValue('USE_REDIS_CACHE');
  },
  get USE_NEW_TELEGRAM_HANDLERS(): boolean {
    return getFlagValue('USE_NEW_TELEGRAM_HANDLERS');
  },
  get USE_NEW_FORMATTERS(): boolean {
    return getFlagValue('USE_NEW_FORMATTERS');
  },
  get ENABLE_REQUEST_DEDUP(): boolean {
    return getFlagValue('ENABLE_REQUEST_DEDUP');
  },
  get ENABLE_RETRY(): boolean {
    return getFlagValue('ENABLE_RETRY');
  },
};

/**
 * Override a flag at runtime (for testing)
 */
export function overrideFlag(flagName: keyof typeof FLAGS, value: boolean): void {
  if (!flagCache) {
    flagCache = loadFlags();
  }
  flagCache.set(flagName, value);
}

/**
 * Reset all flag overrides
 */
export function resetFlags(): void {
  flagCache = null;
}

/**
 * Get all flag values and definitions
 */
export function getAllFlags(): Array<{
  name: string;
  description: string;
  value: boolean;
  envVar: string;
}> {
  if (!flagCache) {
    flagCache = loadFlags();
  }

  return Object.entries(FLAG_DEFINITIONS).map(([key, def]) => ({
    name: def.name,
    description: def.description,
    value: flagCache!.get(key) ?? def.defaultValue,
    envVar: def.envVar,
  }));
}

/**
 * Conditional execution based on flag
 */
export function withFlag<T>(
  flagName: keyof typeof FLAGS,
  ifEnabled: () => T,
  ifDisabled: () => T
): T {
  return FLAGS[flagName] ? ifEnabled() : ifDisabled();
}

/**
 * Async conditional execution based on flag
 */
export async function withFlagAsync<T>(
  flagName: keyof typeof FLAGS,
  ifEnabled: () => Promise<T>,
  ifDisabled: () => Promise<T>
): Promise<T> {
  return FLAGS[flagName] ? ifEnabled() : ifDisabled();
}
