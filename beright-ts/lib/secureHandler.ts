/**
 * Secure Telegram Channel Handler
 *
 * Security layer for the Telegram channel of the OpenClaw gateway.
 * Applied BEFORE messages reach the BeRight orchestrator.
 *
 * Security checks:
 * 1. Rate limiting (per user tier)
 * 2. Input sanitization (prompt injection protection)
 * 3. Command allowlisting (tier-based access)
 * 4. Output filtering (secret scrubbing)
 * 5. Audit logging
 */

import { SkillResponse, TelegramMessage } from '../types/index';
import { telegramHandler } from '../skills/telegramHandler';
import {
  applyChannelSecurity,
  filterChannelOutput,
  autoVerifyUser,
  getChannelUserTier,
  ChannelContext,
} from './channelSecurity';
import { getUserTierWithDynamic, UserTier } from './security';

/**
 * Secure Telegram Channel Handler
 *
 * Wraps telegramHandler with channel-level security.
 * Use this as the entry point for all Telegram messages.
 */
export async function secureTelegramHandler(message: TelegramMessage): Promise<SkillResponse> {
  const text = message.text?.trim() || '';
  const telegramId = message.from?.id?.toString();

  // Build channel context
  const context: ChannelContext = {
    channel: 'telegram',
    userId: telegramId,
    username: message.from?.username,
  };

  // Must have a telegram ID
  if (!telegramId) {
    return {
      text: 'Unable to process request.',
      mood: 'ERROR',
    };
  }

  // Apply channel security (rate limit, sanitize, allowlist)
  const security = applyChannelSecurity(text, context);

  if (!security.allowed) {
    return {
      text: security.reason || 'Request not allowed.',
      mood: 'NEUTRAL',
    };
  }

  // Create sanitized message
  const sanitizedMessage: TelegramMessage = {
    ...message,
    text: security.sanitizedInput,
  };

  try {
    // Pass to orchestrator (telegramHandler routes to agents)
    const response = await telegramHandler(sanitizedMessage);

    // Auto-verify users who make predictions, connect wallets, or trade
    const lowerText = text.toLowerCase();
    if (lowerText.startsWith('/predict') && response.mood !== 'ERROR') {
      autoVerifyUser(context, 'predict');
    } else if (lowerText.startsWith('/connect') && response.mood !== 'ERROR') {
      autoVerifyUser(context, 'connect');
    } else if (lowerText.startsWith('/trade') && response.mood !== 'ERROR') {
      autoVerifyUser(context, 'trade');
    }

    // Filter output before sending back through channel
    const filteredResponse: SkillResponse = {
      ...response,
      text: filterChannelOutput(response.text, context),
    };

    return filteredResponse;

  } catch (error) {
    // Don't leak error details through channel
    console.error(`[Telegram Channel] Error for user ${telegramId}:`, error);

    return {
      text: 'Something went wrong. Please try again later.',
      mood: 'ERROR',
    };
  }
}

/**
 * Optional: Add user tier badge to response
 */
function addTierBadge(text: string, tier: UserTier): string {
  const badges: Record<UserTier, string> = {
    public: '',
    verified: '✓',
    super_admin: '⚡',
  };

  const badge = badges[tier];
  if (!badge) return text;

  // Add badge to first line if it has a header
  const lines = text.split('\n');
  if (lines[0].includes('*')) {
    lines[0] = lines[0].replace('*', `* ${badge}`);
    return lines.join('\n');
  }

  return text;
}

/**
 * Get help text appropriate for user tier
 */
export function getTierAppropriateHelp(telegramId: string): string {
  const tier = getUserTierWithDynamic(telegramId);

  const publicHelp = `
🎯 *BeRight - Prediction Intelligence*

AVAILABLE COMMANDS:
/brief - Morning market briefing
/hot - Trending markets
/odds <topic> - Compare odds across platforms
/arb - Find arbitrage opportunities
/research <topic> - Deep market analysis
/news <topic> - Latest news
/leaderboard - Top forecasters

GET FULL ACCESS:
/predict <question> <prob> YES|NO - Make a prediction to unlock trading!

Just ask me anything about prediction markets!
`;

  const verifiedHelp = `
🎯 *BeRight - Prediction Intelligence* ✓

PREDICTIONS:
/predict - Make predictions
/me - Your stats
/calibration - Calibration report
/feedback - Improvement tips

ANALYSIS:
/intelligence <question> - AI-powered analysis
/research <topic> - Deep research
/odds <topic> - Cross-platform odds
/arb - Arbitrage scanner

TRADING:
/wallet - Your trading wallet
/trade <ticker> YES|NO <$> - Place trades
/positions - View positions
/dflow <query> - Search markets

TRACKING:
/portfolio - All positions
/alerts - Price alerts
/subscribe - Daily alerts

Type /help for full command list
`;

  const superAdminHelp = `
⚡ *BeRight Super Admin Mode*

All commands unlocked including:
- Builder (/build, /improve, /refactor)
- Memory (/memory, /recall)
- Plus all trading and analysis commands

Type /help for full command list
`;

  switch (tier) {
    case 'super_admin':
      return superAdminHelp;
    case 'verified':
      return verifiedHelp;
    default:
      return publicHelp;
  }
}

// Export the secure handler as default
export default secureTelegramHandler;
