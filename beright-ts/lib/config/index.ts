/**
 * BeRight Protocol - Configuration Module
 *
 * Centralized exports for all configuration.
 */

// Environment detection and configuration
export {
  type Environment,
  type BeRightMode,
  type EnvironmentConfig,
  getEnvironmentConfig,
  resetEnvironmentConfig,
  getEnvironment,
  isProduction,
  isDevelopment,
  isDemoMode,
  requireStrictSecrets,
  allowRealTransactions,
  assertProduction,
  assertNotProduction,
  assertRealTransactionsAllowed,
  logEnvironmentInfo,
} from './env';
