/**
 * Telegram Bot Runner for BeRight Protocol
 * Connects to Telegram API and routes messages to telegramHandler
 *
 * IMPORTANT: Only ONE instance of this bot should run at a time!
 * The Telegram API only allows one getUpdates connection per bot.
 * This uses a lock file to prevent multiple instances.
 *
 * Other agents (heartbeat, etc.) should use sendTelegramMessage()
 * from notificationDelivery.ts - they DON'T poll, they just send.
 */

import 'dotenv/config';
// Use secure handler instead of raw telegramHandler
import { secureTelegramHandler, getTierAppropriateHelp } from '../lib/secureHandler';
import { TelegramMessage } from '../types/response';
import {
  acquireLock,
  releaseLock,
  startLockHeartbeat,
  getLockStatus,
  forceReleaseLock,
} from '../lib/telegramLock';

// Startup validation
import { validateLLMConfig } from '../lib/llm';
import { validateTavilyConfig } from '../lib/tavily';


const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

/**
 * Make HTTP request using native fetch
 *
 * SECURITY: Using native fetch instead of exec(curl) to prevent shell injection.
 * Shell commands with user input are a critical security vulnerability.
 * Native fetch has NO shell interaction = NO shell injection possible.
 */
async function httpRequest(url: string, options: { method?: string; body?: string } = {}): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35000); // 35 second timeout

  try {
    const fetchOptions: RequestInit = {
      method: options.method || 'GET',
      signal: controller.signal,
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body,
    };

    const response = await fetch(url, fetchOptions);
    const data = await response.json();
    return data;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('Request timeout');
      return { ok: false, error: 'Request timeout' };
    }
    console.error('Request error:', error instanceof Error ? error.message : error);
    return { ok: false, error: 'Request failed' };
  } finally {
    clearTimeout(timeout);
  }
}

// Polling state
let lastUpdateId = 0;
let isRunning = true;
let lockHeartbeatTimer: NodeJS.Timeout | null = null;

/**
 * Sanitize markdown to ensure balanced entities
 * Telegram requires ALL markdown entities to be properly closed
 */
function sanitizeMarkdown(text: string): string {
  // Balance paired markdown characters
  const pairs = [
    { char: '*', regex: /\*/g },   // Bold
    { char: '_', regex: /_/g },    // Italic
    { char: '`', regex: /`/g },    // Code
    { char: '~', regex: /~/g },    // Strikethrough
  ];

  let result = text;

  for (const { char, regex } of pairs) {
    const matches = result.match(regex);
    if (matches && matches.length % 2 !== 0) {
      // Odd number of chars = unbalanced, remove the last one
      const lastIndex = result.lastIndexOf(char);
      result = result.slice(0, lastIndex) + result.slice(lastIndex + 1);
    }
  }

  // Fix unbalanced link brackets [text](url)
  // Count [ and ] - if unequal, escape them
  const openBrackets = (result.match(/\[/g) || []).length;
  const closeBrackets = (result.match(/\]/g) || []).length;
  if (openBrackets !== closeBrackets) {
    // Escape all brackets if unbalanced
    result = result.replace(/\[/g, '\\[').replace(/\]/g, '\\]');
  }

  // Fix unbalanced parentheses in markdown links
  // This is tricky - look for ]( patterns and ensure ) follows
  const linkPattern = /\]\([^)]*$/;
  if (linkPattern.test(result)) {
    // Unclosed link URL - add closing paren
    result = result + ')';
  }

  return result;
}

/**
 * Send a message to a Telegram chat
 */
async function sendMessage(chatId: number | string, text: string): Promise<void> {
  try {
    // Pre-sanitize markdown to prevent parse errors
    const sanitizedText = sanitizeMarkdown(text);

    const result = await httpRequest(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      body: JSON.stringify({
        chat_id: chatId,
        text: sanitizedText,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    });

    if (!result.ok) {
      console.error('Failed to send message:', result.description || result.error);

      // Retry without markdown if parsing failed
      if (result.description?.includes('parse') || result.description?.includes('entity')) {
        console.log('Retrying without markdown formatting...');
        const plainResult = await httpRequest(`${TELEGRAM_API}/sendMessage`, {
          method: 'POST',
          body: JSON.stringify({
            chat_id: chatId,
            text: text.replace(/[*_`~\[\]()\\]/g, ''),  // Strip all markdown chars
            disable_web_page_preview: true,
          }),
        });

        if (!plainResult.ok) {
          console.error('Plain text send also failed:', plainResult.description);
        }
      }
    }
  } catch (error) {
    console.error('Send message error:', error);
  }
}

/**
 * Get updates from Telegram (long polling)
 */
async function getUpdates(): Promise<any[]> {
  try {
    const data = await httpRequest(
      `${TELEGRAM_API}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`
    );

    if (!data.ok) {
      console.error('Failed to get updates:', data.description || data.error);
      return [];
    }

    return data.result || [];
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Request timeout') {
        // Normal timeout, just retry
        return [];
      }
      console.error('Get updates error:', error.message);
    }
    return [];
  }
}

/**
 * Process a single Telegram update
 */
async function processUpdate(update: any): Promise<void> {
  lastUpdateId = update.update_id;

  const message = update.message || update.edited_message;
  if (!message?.text) return;

  const chatId = message.chat.id;
  const text = message.text;
  const from = message.from;

  console.log(`[${new Date().toISOString()}] @${from?.username || from?.id}: ${text}`);

  // Build TelegramMessage for handler
  const telegramMessage: TelegramMessage = {
    message_id: message.message_id,
    date: message.date,
    text,
    from: {
      id: from?.id,
      username: from?.username,
      first_name: from?.first_name,
    },
    chat: {
      id: chatId,
      type: message.chat.type,
    },
  };

  try {
    // Process with SECURE handler (includes rate limiting, input sanitization, etc.)
    const response = await secureTelegramHandler(telegramMessage);

    // Send response
    await sendMessage(chatId, response.text);

    console.log(`  -> ${response.mood || 'NEUTRAL'} response sent`);
  } catch (error) {
    // Don't leak error details in production
    console.error('Handler error:', error);
    await sendMessage(chatId, 'Sorry, something went wrong. Please try again.');
  }
}

/**
 * Main polling loop
 */
async function pollLoop(): Promise<void> {
  console.log('Starting Telegram bot polling...');

  while (isRunning) {
    try {
      const updates = await getUpdates();

      for (const update of updates) {
        await processUpdate(update);
      }
    } catch (error) {
      console.error('Poll loop error:', error);
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

/**
 * Graceful shutdown
 */
function shutdown(): void {
  console.log('\nShutting down bot...');
  isRunning = false;

  // Clear lock heartbeat timer
  if (lockHeartbeatTimer) {
    clearInterval(lockHeartbeatTimer);
    lockHeartbeatTimer = null;
  }

  // Release the lock so another instance can start
  releaseLock();

  process.exit(0);
}

// Handle shutdown signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Handle --force-unlock CLI argument to clear stale locks
if (process.argv.includes('--force-unlock')) {
  console.log('Force unlocking Telegram bot...');
  forceReleaseLock();
  console.log('Lock cleared. You can now start the bot.');
  process.exit(0);
}

// Handle --status CLI argument to check lock status
if (process.argv.includes('--status')) {
  const status = getLockStatus();
  console.log('\nTelegram Bot Lock Status:');
  console.log('─'.repeat(40));
  if (!status.locked) {
    console.log('Status: NOT LOCKED (no bot running)');
  } else {
    console.log(`Status: LOCKED`);
    console.log(`Owner PID: ${status.owner?.pid}`);
    console.log(`Started: ${status.owner?.startedAt}`);
    console.log(`Hostname: ${status.owner?.hostname}`);
    console.log(`Is ours: ${status.isOurs}`);
    console.log(`Is stale: ${status.isStale}`);
  }
  console.log('─'.repeat(40));
  process.exit(0);
}

// Start the bot
if (!TELEGRAM_BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN not set in .env');
  console.log('\nTo run the Telegram bot:');
  console.log('1. Create a bot with @BotFather on Telegram');
  console.log('2. Add TELEGRAM_BOT_TOKEN=your_token to .env');
  console.log('3. Run: npm run telegram');
  process.exit(1);
}

// CRITICAL: Acquire lock before starting
// This prevents multiple bot instances from polling simultaneously
const lockResult = acquireLock();
if (!lockResult.acquired) {
  console.error('\n╔════════════════════════════════════════════════════════════╗');
  console.error('║  TELEGRAM BOT ALREADY RUNNING                              ║');
  console.error('╚════════════════════════════════════════════════════════════╝');
  console.error(`\nError: ${lockResult.error}`);
  console.error('\nOnly ONE Telegram bot instance can poll at a time.');
  console.error('The Telegram API does not allow multiple getUpdates connections.');
  console.error('\nOptions:');
  console.error('  1. Stop the existing bot first');
  console.error('  2. Use: npx ts-node skills/telegram.ts --status to check');
  console.error('  3. Use: npx ts-node skills/telegram.ts --force-unlock if stuck');
  process.exit(1);
}

// Start lock heartbeat to keep the lock fresh
lockHeartbeatTimer = startLockHeartbeat();

console.log('============================================');
console.log('BeRight Protocol - Telegram Bot');
console.log('============================================');
console.log('LOCK: Acquired (single instance guaranteed)');
console.log('Security Layer: ENABLED');
console.log('   - Rate limiting');
console.log('   - Input sanitization');
console.log('   - Command allowlisting');
console.log('   - Output filtering');
console.log('============================================');

// ============================================
// STARTUP VALIDATION - Check all providers
// ============================================
console.log('\nValidating providers...');

const llmStatus = validateLLMConfig();
const tavilyStatus = validateTavilyConfig();

console.log('');
if (!llmStatus.valid) {
  console.warn('⚠️  No LLM providers available - bot will use fallback responses');
}
if (!tavilyStatus.valid) {
  console.warn('⚠️  Tavily not configured - will use DuckDuckGo fallback for search');
}

console.log('============================================\n');

// Test connection before starting
async function testConnection(): Promise<boolean> {
  try {
    console.log('Testing Telegram connection...');
    const data = await httpRequest(`${TELEGRAM_API}/getMe`);
    if (!data.ok) {
      console.error('Connection test failed:', data.description || data.error);
      return false;
    }
    console.log(`Connected as @${data.result.username} (${data.result.first_name})`);
    return true;
  } catch (error) {
    console.error('Connection test error:', error instanceof Error ? error.message : error);
    return false;
  }
}

testConnection().then(ok => {
  if (!ok) {
    console.error('Failed to connect to Telegram. Check your network and token.');
    releaseLock(); // Release lock on failure
    process.exit(1);
  }
  console.log('Starting polling...\n');
  pollLoop().catch(error => {
    console.error('Fatal error:', error);
    releaseLock(); // Release lock on error
    process.exit(1);
  });
});
