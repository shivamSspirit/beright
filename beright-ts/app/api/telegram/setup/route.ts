/**
 * Telegram Webhook Setup
 *
 * Helper endpoint to configure Telegram webhook.
 * Only accessible by super admin.
 */

import { NextRequest, NextResponse } from 'next/server';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SUPER_ADMIN_ID = process.env.SUPER_ADMIN_TELEGRAM_ID || '5504043269';

/**
 * GET /api/telegram/setup
 * Get current webhook info
 */
export async function GET() {
  if (!TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({
      error: 'TELEGRAM_BOT_TOKEN not configured',
      setup: 'Add TELEGRAM_BOT_TOKEN to your .env file',
    }, { status: 400 });
  }

  try {
    // Get current webhook info
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`);
    const data = await response.json();

    // Get bot info
    const meResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`);
    const meData = await meResponse.json();

    return NextResponse.json({
      bot: meData.result,
      webhook: data.result,
      instructions: {
        production: 'POST to /api/telegram/setup with { "url": "https://your-domain.com/api/telegram/webhook" }',
        local: 'Use ngrok: ngrok http 3001, then POST with ngrok URL',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get webhook info' }, { status: 500 });
  }
}

/**
 * POST /api/telegram/setup
 * Set webhook URL
 *
 * Body: { "url": "https://your-domain.com/api/telegram/webhook" }
 */
export async function POST(request: NextRequest) {
  if (!TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({
      error: 'TELEGRAM_BOT_TOKEN not configured',
    }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({
        error: 'Missing url in request body',
        example: { url: 'https://your-domain.com/api/telegram/webhook' },
      }, { status: 400 });
    }

    // Set webhook
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        allowed_updates: ['message', 'edited_message'],
        drop_pending_updates: true,
      }),
    });

    const data = await response.json();

    if (data.ok) {
      return NextResponse.json({
        success: true,
        message: 'Webhook set successfully',
        url,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: data.description,
      }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to set webhook',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * DELETE /api/telegram/setup
 * Remove webhook (switch back to polling mode)
 */
export async function DELETE() {
  if (!TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({
      error: 'TELEGRAM_BOT_TOKEN not configured',
    }, { status: 400 });
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook`, {
      method: 'POST',
    });

    const data = await response.json();

    return NextResponse.json({
      success: data.ok,
      message: data.ok ? 'Webhook removed - you can now use polling mode' : data.description,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete webhook' }, { status: 500 });
  }
}
