/**
 * Kill Switches for BeRight Protocol
 *
 * Emergency controls to disable features without redeployment.
 * Set environment variables to 'false' to disable features.
 *
 * Usage:
 *   TRADING_ENABLED=false railway up
 *
 * All switches default to ENABLED (true) for safety.
 */

import { isProduction, getEnvironment } from './config/env';

// ============================================
// KILL SWITCH DEFINITIONS
// ============================================

export interface KillSwitches {
  tradingEnabled: boolean;
  walletWithdrawals: boolean;
  apiPublicAccess: boolean;
  telegramBot: boolean;
  autoTrading: boolean;
  newSignups: boolean;
}

// ============================================
// ENVIRONMENT PARSING
// ============================================

function parseEnvBool(key: string, defaultValue = true): boolean {
  const value = process.env[key]?.toLowerCase();
  if (value === 'false' || value === '0' || value === 'no' || value === 'off') {
    return false;
  }
  return defaultValue;
}

// ============================================
// KILL SWITCH STATE
// ============================================

let cachedSwitches: KillSwitches | null = null;

export function getKillSwitches(): KillSwitches {
  if (cachedSwitches) {
    return cachedSwitches;
  }

  cachedSwitches = {
    tradingEnabled: parseEnvBool('TRADING_ENABLED', true),
    walletWithdrawals: parseEnvBool('WALLET_WITHDRAWALS', true),
    apiPublicAccess: parseEnvBool('API_PUBLIC_ACCESS', true),
    telegramBot: parseEnvBool('TELEGRAM_BOT_ENABLED', true),
    autoTrading: parseEnvBool('AUTO_TRADING_ENABLED', false),
    newSignups: parseEnvBool('NEW_SIGNUPS_ENABLED', true),
  };

  return cachedSwitches;
}

export function resetKillSwitches(): void {
  cachedSwitches = null;
}

// ============================================
// CONVENIENCE CHECKERS
// ============================================

export function isTradingEnabled(): boolean {
  return getKillSwitches().tradingEnabled;
}

export function isWalletWithdrawalsEnabled(): boolean {
  return getKillSwitches().walletWithdrawals;
}

export function isApiPublicAccessEnabled(): boolean {
  return getKillSwitches().apiPublicAccess;
}

export function isTelegramBotEnabled(): boolean {
  return getKillSwitches().telegramBot;
}

export function isAutoTradingEnabled(): boolean {
  return getKillSwitches().autoTrading;
}

export function isNewSignupsEnabled(): boolean {
  return getKillSwitches().newSignups;
}

// ============================================
// ASSERTIONS
// ============================================

export function assertTradingEnabled(): void {
  if (!isTradingEnabled()) {
    throw new KillSwitchError('Trading is currently disabled');
  }
}

export function assertWithdrawalsEnabled(): void {
  if (!isWalletWithdrawalsEnabled()) {
    throw new KillSwitchError('Wallet withdrawals are currently disabled');
  }
}

export function assertAutoTradingEnabled(): void {
  if (!isAutoTradingEnabled()) {
    throw new KillSwitchError('Auto-trading is currently disabled');
  }
}

// ============================================
// ERROR CLASS
// ============================================

export class KillSwitchError extends Error {
  constructor(message: string) {
    super('[KILL SWITCH] ' + message);
    this.name = 'KillSwitchError';
  }
}

// ============================================
// LOGGING
// ============================================

export function logKillSwitchStatus(): void {
  const switches = getKillSwitches();
  const env = getEnvironment();

  console.log('[KillSwitch] Environment: ' + env);
  console.log('[KillSwitch] Trading: ' + (switches.tradingEnabled ? 'ENABLED' : 'DISABLED'));
  console.log('[KillSwitch] Withdrawals: ' + (switches.walletWithdrawals ? 'ENABLED' : 'DISABLED'));
  console.log('[KillSwitch] Public API: ' + (switches.apiPublicAccess ? 'ENABLED' : 'DISABLED'));
  console.log('[KillSwitch] Telegram Bot: ' + (switches.telegramBot ? 'ENABLED' : 'DISABLED'));
  console.log('[KillSwitch] Auto-Trading: ' + (switches.autoTrading ? 'ENABLED' : 'DISABLED'));
  console.log('[KillSwitch] New Signups: ' + (switches.newSignups ? 'ENABLED' : 'DISABLED'));
}

export function getKillSwitchStatus(): {
  environment: string;
  isProduction: boolean;
  switches: KillSwitches;
} {
  return {
    environment: getEnvironment(),
    isProduction: isProduction(),
    switches: getKillSwitches(),
  };
}
