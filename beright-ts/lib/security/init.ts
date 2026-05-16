/**
 * Security Initialization Module
 *
 * Call this at application startup to initialize all security components.
 *
 * Usage (in app startup):
 *   import { initializeSecurity } from '@/lib/security/init';
 *
 *   await initializeSecurity();
 */

import { validateSecrets, initializeSecretsForProduction, secrets } from '../secrets';
import { logKillSwitchStatus, getKillSwitches } from '../killSwitch';
import { isProduction, getEnvironment } from '../config/env';
import { startProtocolWalletMonitoring } from '../solana/monitor';
import { logSecurityEvent } from '../middleware/securityLogger';
import { sendInfoAlert } from '../monitoring/alerts';

// ============================================
// TYPES
// ============================================

export interface SecurityInitResult {
  success: boolean;
  environment: string;
  isProduction: boolean;
  secretsValid: boolean;
  secretsMissing: string[];
  killSwitchesActive: string[];
  walletsMonitored: number;
  warnings: string[];
  errors: string[];
}

// ============================================
// INITIALIZATION
// ============================================

let initialized = false;
let initResult: SecurityInitResult | null = null;

/**
 * Initialize all security components
 * Safe to call multiple times - only runs once
 */
export async function initializeSecurity(): Promise<SecurityInitResult> {
  if (initialized && initResult) {
    return initResult;
  }

  const result: SecurityInitResult = {
    success: true,
    environment: getEnvironment(),
    isProduction: isProduction(),
    secretsValid: true,
    secretsMissing: [],
    killSwitchesActive: [],
    walletsMonitored: 0,
    warnings: [],
    errors: [],
  };

  console.log('\n========================================');
  console.log('   BeRight Security Initialization');
  console.log('========================================\n');

  try {
    // 1. Validate secrets
    console.log('[Security] Validating secrets...');
    const secretsResult = validateSecrets();

    if (!secretsResult.valid) {
      result.warnings.push(...secretsResult.errors);
    }

    // Log which secrets are configured
    const configuredSecrets = Object.entries(secretsResult.summary)
      .filter(([_, configured]) => configured)
      .map(([name]) => name);

    const missingSecrets = Object.entries(secretsResult.summary)
      .filter(([_, configured]) => !configured)
      .map(([name]) => name);

    console.log(`[Security] Configured: ${configuredSecrets.join(', ') || 'none'}`);

    if (missingSecrets.length > 0) {
      console.log(`[Security] Missing: ${missingSecrets.join(', ')}`);
      result.secretsMissing = missingSecrets;
    }

    // 2. Production validation (strict)
    if (isProduction()) {
      console.log('[Security] Running production validation...');
      try {
        initializeSecretsForProduction();
        console.log('[Security] Production validation PASSED');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(errorMessage);
        result.success = false;
        console.error('[Security] Production validation FAILED:', errorMessage);
      }
    }

    result.secretsValid = secretsResult.valid && result.errors.length === 0;

    // 3. Log kill switch status
    console.log('\n[Security] Kill switch status:');
    logKillSwitchStatus();

    const switches = getKillSwitches();
    const disabledSwitches = Object.entries(switches)
      .filter(([_, enabled]) => !enabled)
      .map(([name]) => name);

    if (disabledSwitches.length > 0) {
      result.killSwitchesActive = disabledSwitches;
      console.log(`[Security] DISABLED features: ${disabledSwitches.join(', ')}`);
    }

    // 4. Start wallet monitoring (production only)
    if (isProduction()) {
      console.log('\n[Security] Starting wallet monitoring...');
      try {
        startProtocolWalletMonitoring();
        // Count monitored wallets
        const walletAddresses = [
          process.env.PROTOCOL_WALLET_ADDRESS,
          process.env.FEE_WALLET_ADDRESS,
          process.env.TREASURY_WALLET_ADDRESS,
        ].filter(Boolean);
        result.walletsMonitored = walletAddresses.length;
        console.log(`[Security] Monitoring ${result.walletsMonitored} protocol wallets`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.warnings.push(`Wallet monitoring failed: ${errorMessage}`);
        console.warn('[Security] Wallet monitoring failed:', errorMessage);
      }
    } else {
      console.log('\n[Security] Skipping wallet monitoring (non-production)');
    }

    // 5. Log security initialization event
    await logSecurityEvent({
      eventType: 'config_change',
      action: 'security_initialized',
      severity: 'info',
      details: {
        environment: result.environment,
        isProduction: result.isProduction,
        secretsValid: result.secretsValid,
        killSwitchesActive: result.killSwitchesActive,
        walletsMonitored: result.walletsMonitored,
      },
      success: result.success,
    });

    // 6. Send startup alert in production
    if (isProduction()) {
      await sendInfoAlert(
        'Service Started',
        `BeRight Protocol initialized in ${result.environment}`,
        {
          secretsValid: result.secretsValid,
          killSwitchesActive: result.killSwitchesActive.length,
          walletsMonitored: result.walletsMonitored,
        }
      );
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(errorMessage);
    result.success = false;
    console.error('[Security] Initialization error:', errorMessage);
  }

  // Summary
  console.log('\n========================================');
  if (result.success) {
    console.log('   Security Initialization: SUCCESS');
  } else {
    console.log('   Security Initialization: FAILED');
    console.log('   Errors:', result.errors.join(', '));
  }
  if (result.warnings.length > 0) {
    console.log('   Warnings:', result.warnings.length);
  }
  console.log('========================================\n');

  initialized = true;
  initResult = result;

  return result;
}

/**
 * Get the last initialization result
 */
export function getSecurityInitResult(): SecurityInitResult | null {
  return initResult;
}

/**
 * Check if security has been initialized
 */
export function isSecurityInitialized(): boolean {
  return initialized;
}

/**
 * Reset initialization state (for testing)
 */
export function resetSecurityInit(): void {
  initialized = false;
  initResult = null;
}

/**
 * Quick security check (doesn't reinitialize)
 */
export function quickSecurityCheck(): {
  initialized: boolean;
  environment: string;
  isProduction: boolean;
  hasErrors: boolean;
  errorCount: number;
  warningCount: number;
} {
  return {
    initialized,
    environment: getEnvironment(),
    isProduction: isProduction(),
    hasErrors: initResult ? initResult.errors.length > 0 : false,
    errorCount: initResult?.errors.length || 0,
    warningCount: initResult?.warnings.length || 0,
  };
}
