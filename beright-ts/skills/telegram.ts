/**
 * Telegram Bot Runner for BeRight Protocol
 * Connects to Telegram API and routes messages to telegramHandler
 */

import 'dotenv/config';
import * as https from 'https';
import { exec } from 'child_process';
import { promisify } from 'util';
import { telegramHandler } from './telegramHandler';
import { TelegramMessage } from '../types/response';

const execAsync = promisify(exec);

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

/**
 * Make request using curl (most reliable cross-platform)
 */
async function curlRequest(url: string, options: { method?: string; body?: string } = {}): Promise<any> {
  try {
    let cmd = `curl -s --max-time 35 "${url}"`;
    if (options.method === 'POST' && options.body) {
      // Escape for shell: $ -> \$, " -> \", ` -> \`, \ -> \\
      const escapedBody = options.body
        .replace(/\\/g, '\\\\')  // Escape backslashes first
        .replace(/\$/g, '\\$')   // Escape $ (shell variable)
        .replace(/`/g, '\\`')    // Escape backticks (command substitution)
        .replace(/"/g, '\\"');   // Escape double quotes
      cmd = `curl -s --max-time 35 -X POST -H "Content-Type: application/json" -d "${escapedBody}" "${url}"`;
    }

    const { stdout } = await execAsync(cmd);
    return JSON.parse(stdout);
  } catch (error) {
    console.error('Curl request error:', error instanceof Error ? error.message : error);
    return { ok: false, error: 'Request failed' };
  }
}

// Polling state
let lastUpdateId = 0;
let isRunning = true;

/**
 * Send a message to a Telegram chat
 */
async function sendMessage(chatId: number | string, text: string): Promise<void> {
  try {
    const result = await curlRequest(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    });

    if (!result.ok) {
      console.error('Failed to send message:', result.description || result.error);

      // Retry without markdown if parsing failed
      if (result.description?.includes('parse')) {
        await curlRequest(`${TELEGRAM_API}/sendMessage`, {
          method: 'POST',
          body: JSON.stringify({
            chat_id: chatId,
            text: text.replace(/[*_`\[\]]/g, ''),
            disable_web_page_preview: true,
          }),
        });
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
    const data = await curlRequest(
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
    // Process with handler
    const response = await telegramHandler(telegramMessage);

    // Send response
    await sendMessage(chatId, response.text);

    console.log(`  -> ${response.mood || 'NEUTRAL'} response sent`);
  } catch (error) {
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
  process.exit(0);
}

// Handle shutdown signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start the bot
if (!TELEGRAM_BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN not set in .env');
  console.log('\nTo run the Telegram bot:');
  console.log('1. Create a bot with @BotFather on Telegram');
  console.log('2. Add TELEGRAM_BOT_TOKEN=your_token to .env');
  console.log('3. Run: npm run telegram');
  process.exit(1);
}

console.log('============================================');
console.log('BeRight Protocol - Telegram Bot');
console.log('============================================');

// Test connection before starting
async function testConnection(): Promise<boolean> {
  try {
    console.log('Testing Telegram connection...');
    const data = await curlRequest(`${TELEGRAM_API}/getMe`);
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
    process.exit(1);
  }
  console.log('Starting polling...\n');
  pollLoop().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
});
