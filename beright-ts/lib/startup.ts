/**
 * BeRight Protocol - Startup Validation
 *
 * Run this at application startup to validate configuration.
 * Fails fast with clear error messages if required secrets are missing.
 *
 * Usage:
 *   import { validateStartup } from './lib/startup';
 *   validateStartup(); // Throws if critical config is missing
 */

import { validateSecrets, secrets } from './secrets';

export interface StartupValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  features: {
    onchain: boolean;
    kalshi: boolean;
    telegram: boolean;
    supabase: boolean;
    agents: boolean;
    rateLimit: boolean;
  };
}

/**
 * Validate all startup requirements
 * @param strict - If true, throw on any error. If false, return validation result.
 */
export function validateStartup(strict = false): StartupValidation {
  const result: StartupValidation = {
    valid: true,
    errors: [],
    warnings: [],
    features: {
      onchain: false,
      kalshi: false,
      telegram: false,
      supabase: false,
      agents: false,
      rateLimit: false,
    },
  };

  // Validate secrets
  const { valid, errors, summary } = validateSecrets();

  if (!valid) {
    result.errors.push(...errors);
    result.valid = false;
  }

  // Check each feature
  const onchainCheck = secrets.validateForFeature('onchain');
  result.features.onchain = onchainCheck.valid;
  if (!onchainCheck.valid) {
    result.warnings.push(`On-chain features disabled: missing ${onchainCheck.missing.join(', ')}`);
  }

  const kalshiCheck = secrets.validateForFeature('kalshi');
  result.features.kalshi = kalshiCheck.valid;
  if (!kalshiCheck.valid) {
    result.warnings.push(`Kalshi trading disabled: missing ${kalshiCheck.missing.join(', ')}`);
  }

  const telegramCheck = secrets.validateForFeature('telegram');
  result.features.telegram = telegramCheck.valid;
  if (!telegramCheck.valid) {
    result.errors.push(`Telegram bot disabled: missing ${telegramCheck.missing.join(', ')}`);
    result.valid = false; // Telegram is required
  }

  const supabaseCheck = secrets.validateForFeature('supabase');
  result.features.supabase = supabaseCheck.valid;
  if (!supabaseCheck.valid) {
    result.errors.push(`Database disabled: missing ${supabaseCheck.missing.join(', ')}`);
    result.valid = false; // Supabase is required
  }

  const agentsCheck = secrets.validateForFeature('agents');
  result.features.agents = agentsCheck.valid;
  if (!agentsCheck.valid) {
    result.warnings.push(`AI agents disabled: missing ${agentsCheck.missing.join(', ')}`);
  }

  // Check rate limiting (Upstash)
  const upstash = secrets.getUpstashCredentials();
  result.features.rateLimit = !!upstash;
  if (!upstash) {
    result.warnings.push('Rate limiting disabled: missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN');
  }

  // Check for common misconfigurations
  if (process.env.NODE_ENV === 'production') {
    if (!result.features.rateLimit) {
      result.errors.push('CRITICAL: Rate limiting is required in production');
      result.valid = false;
    }
    if (!result.features.supabase) {
      result.errors.push('CRITICAL: Database is required in production');
      result.valid = false;
    }
  }

  // Strict mode: throw on errors
  if (strict && !result.valid) {
    const errorMessage = [
      'BeRight Protocol startup validation failed:',
      '',
      'ERRORS:',
      ...result.errors.map(e => `  - ${e}`),
      '',
      'Check your .env file and ensure all required secrets are configured.',
      'See .env.example for required variables.',
    ].join('\n');

    throw new Error(errorMessage);
  }

  return result;
}

/**
 * Print startup validation status
 */
export function printStartupStatus(): void {
  const result = validateStartup(false);

  console.log('\n=== BeRight Protocol Startup ===\n');

  // Features status
  console.log('Features:');
  Object.entries(result.features).forEach(([feature, enabled]) => {
    const status = enabled ? '\x1b[32m[OK]\x1b[0m' : '\x1b[33m[OFF]\x1b[0m';
    console.log(`  ${status} ${feature}`);
  });

  // Warnings
  if (result.warnings.length > 0) {
    console.log('\nWarnings:');
    result.warnings.forEach(w => console.log(`  \x1b[33m!\x1b[0m ${w}`));
  }

  // Errors
  if (result.errors.length > 0) {
    console.log('\nErrors:');
    result.errors.forEach(e => console.log(`  \x1b[31m!\x1b[0m ${e}`));
  }

  // Overall status
  console.log('');
  if (result.valid) {
    console.log('\x1b[32mStartup validation passed.\x1b[0m\n');
  } else {
    console.log('\x1b[31mStartup validation FAILED.\x1b[0m\n');
  }
}

/**
 * Middleware for Next.js API routes that validates startup
 */
export function requireValidConfig() {
  const validation = validateStartup(false);
  if (!validation.valid) {
    return {
      valid: false,
      error: 'Server configuration error. Please contact support.',
    };
  }
  return { valid: true };
}

// CLI: Run validation directly
if (process.argv[1]?.endsWith('startup.ts')) {
  require('dotenv').config();
  printStartupStatus();
  const result = validateStartup(false);
  process.exit(result.valid ? 0 : 1);
}
