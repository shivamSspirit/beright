/**
 * Channel Security Middleware for OpenClaw Gateway
 *
 * Applied at the channel level BEFORE messages reach the orchestrator.
 * Each channel (Telegram, Web, API) passes through this security layer.
 */

import {
  securityCheck,
  filterOutput,
  verifyUser,
  getUserTier,
  UserTier,
} from './security';

export interface ChannelContext {
  channel: 'telegram' | 'web' | 'api' | 'cron';
  userId?: string;
  username?: string;
  metadata?: Record<string, unknown>;
}

export interface SecurityResult {
  allowed: boolean;
  sanitizedInput: string;
  tier: UserTier;
  reason?: string;
}

/**
 * Apply security checks for any channel
 */
export function applyChannelSecurity(
  input: string,
  context: ChannelContext
): SecurityResult {
  // Cron jobs bypass security (internal system)
  if (context.channel === 'cron') {
    return {
      allowed: true,
      sanitizedInput: input,
      tier: 'super_admin',
    };
  }

  // Must have user ID for telegram/web channels
  if (!context.userId) {
    return {
      allowed: false,
      sanitizedInput: '',
      tier: 'public',
      reason: 'Unable to identify user',
    };
  }

  // Run security checks and map result
  const result = securityCheck(context.userId, input);
  return {
    allowed: result.allowed,
    sanitizedInput: result.sanitizedText,
    tier: result.tier,
    reason: result.reason,
  };
}

/**
 * Filter output before sending back through channel
 */
export function filterChannelOutput(
  output: string,
  context: ChannelContext
): string {
  return filterOutput(output, context.userId);
}

/**
 * Auto-verify user after successful action
 */
export function autoVerifyUser(
  context: ChannelContext,
  action: 'predict' | 'connect' | 'trade'
): void {
  if (context.userId) {
    verifyUser(context.userId);
    console.log(`[Security] User ${context.userId} verified via ${action} on ${context.channel}`);
  }
}

/**
 * Get user tier for any channel
 */
export function getChannelUserTier(context: ChannelContext): UserTier {
  if (context.channel === 'cron') return 'super_admin';
  if (!context.userId) return 'public';
  return getUserTier(context.userId);
}

export default applyChannelSecurity;
