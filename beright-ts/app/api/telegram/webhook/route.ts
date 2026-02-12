/**
 * Telegram Webhook Handler
 *
 * Receives updates from Telegram and processes them through the secure handler.
 * Set webhook URL at: https://api.telegram.org/bot<TOKEN>/setWebhook?url=<YOUR_URL>/api/telegram/webhook
 *
 * For local development, use ngrok or similar:
 * ngrok http 3001
 * Then set webhook to: https://xxxx.ngrok.io/api/telegram/webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { secureTelegramHandler } from '../../../../lib/secureHandler';
import { TelegramMessage } from '../../../../types/response';

// Verify the request is from Telegram (optional but recommended)
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

/**
 * POST /api/telegram/webhook
 * Receives Telegram updates via webhook
 */
export async function POST(request: NextRequest) {
  try {
    const update = await request.json();

    // Extract message from update
    const message = update.message || update.edited_message;
    if (!message?.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const from = message.from;

    console.log(`[Telegram] @${from?.username || from?.id}: ${message.text}`);

    // Build TelegramMessage for handler
    const telegramMessage: TelegramMessage = {
      message_id: message.message_id,
      date: message.date,
      text: message.text,
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

    // Process through secure handler
    const response = await secureTelegramHandler(telegramMessage);

    // Send response back to Telegram
    await sendTelegramMessage(chatId, response.text);

    console.log(`[Telegram] -> ${response.mood || 'NEUTRAL'} response sent`);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Telegram Webhook] Error:', error);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}

/**
 * GET /api/telegram/webhook
 * Health check / webhook info
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    webhook: 'Telegram webhook endpoint',
    security: 'enabled',
    setup: {
      step1: 'Get your bot token from @BotFather',
      step2: 'Set TELEGRAM_BOT_TOKEN in .env',
      step3: 'For production: Set webhook URL via Telegram API',
      step4: 'For local dev: Use ngrok and set webhook to ngrok URL',
    },
  });
}

/**
 * Send message to Telegram
 */
async function sendTelegramMessage(chatId: number | string, text: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('[Telegram] No bot token configured');
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    });

    const result = await response.json();

    if (!result.ok) {
      console.error('[Telegram] Send failed:', result.description);

      // Retry without markdown if parsing failed
      if (result.description?.includes('parse')) {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: text.replace(/[*_`\[\]]/g, ''),
            disable_web_page_preview: true,
          }),
        });
      }
    }
  } catch (error) {
    console.error('[Telegram] Send error:', error);
  }
}
