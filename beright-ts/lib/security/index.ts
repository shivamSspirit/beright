/**
 * Security Module
 *
 * Centralized security functionality for BeRight Protocol.
 *
 * This module re-exports from the original security.ts (Telegram security)
 * and adds new initialization and management functions.
 */

// Original security functions (Telegram-focused)
export {
  type UserTier,
  type UserSecurityProfile,
  PUBLIC_COMMANDS,
  VERIFIED_COMMANDS,
  getUserTier,
  isCommandAllowed,
  sanitizeInput,
  filterOutput,
  checkRateLimit,
  securityCheck,
  getAuditLog,
  getSecurityStats,
  verifyUser,
  isDynamicallyVerified,
  getUserTierWithDynamic,
} from '../security';

// Security initialization
export {
  type SecurityInitResult,
  initializeSecurity,
  getSecurityInitResult,
  isSecurityInitialized,
  resetSecurityInit,
  quickSecurityCheck,
} from './init';

// Re-export kill switches
export {
  type KillSwitches,
  getKillSwitches,
  resetKillSwitches,
  isTradingEnabled,
  isWalletWithdrawalsEnabled,
  isApiPublicAccessEnabled,
  isTelegramBotEnabled,
  isAutoTradingEnabled,
  isNewSignupsEnabled,
  assertTradingEnabled,
  assertWithdrawalsEnabled,
  assertAutoTradingEnabled,
  KillSwitchError,
  logKillSwitchStatus,
  getKillSwitchStatus,
} from '../killSwitch';

// Re-export secrets validation
export {
  validateSecrets,
  initializeSecretsForProduction,
  maskSecret,
  looksLikeSecret,
  SecretNotConfiguredError,
} from '../secrets';
