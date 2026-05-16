/**
 * Link Telegram API Route
 * POST /api/users/link-telegram - Link a Telegram account to a web user
 */

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

const userStorePath = path.join(process.cwd(), 'memory', 'users.json');
const telegramLinksPath = path.join(process.cwd(), 'memory', 'telegram-links.json');

function getLocalStore(filePath: string): Record<string, any> {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch { /* ignore */ }
  return {};
}

function saveLocalStore(filePath: string, store: Record<string, any>) {
  const memoryDir = path.dirname(filePath);
  if (!fs.existsSync(memoryDir)) {
    fs.mkdirSync(memoryDir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, walletAddress, telegramId } = body;

    if (!telegramId) {
      return NextResponse.json(
        { error: 'Must provide telegramId' },
        { status: 400 }
      );
    }

    if (!userId && !walletAddress) {
      return NextResponse.json(
        { error: 'Must provide userId or walletAddress' },
        { status: 400 }
      );
    }

    // Check if we have database configured
    const hasDb = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY;

    if (hasDb) {
      // Link in database
      const { linkWalletToUser, getOrCreateUserByTelegram } = await import('../../../../lib/db');

      // Get or create telegram user
      const telegramUser = await getOrCreateUserByTelegram(telegramId);

      // If wallet provided, link it
      if (walletAddress) {
        await linkWalletToUser(telegramUser.id, walletAddress);
      }

      return NextResponse.json({
        success: true,
        message: 'Telegram account linked',
        user: {
          id: telegramUser.id,
          telegramId: telegramUser.telegram_id,
          walletAddress: walletAddress || telegramUser.wallet_address,
        },
      });
    } else {
      // Use local file-based storage
      const userStore = getLocalStore(userStorePath);
      const telegramLinks = getLocalStore(telegramLinksPath);

      const key = walletAddress || userId;

      // Update user record
      if (userStore[key]) {
        userStore[key].telegramId = telegramId;
        saveLocalStore(userStorePath, userStore);
      }

      // Create bidirectional link
      telegramLinks[telegramId] = {
        walletAddress,
        userId,
        linkedAt: new Date().toISOString(),
      };

      if (walletAddress) {
        telegramLinks[walletAddress] = {
          telegramId,
          linkedAt: new Date().toISOString(),
        };
      }

      saveLocalStore(telegramLinksPath, telegramLinks);

      return NextResponse.json({
        success: true,
        message: 'Telegram account linked (local mode)',
        telegramId,
        walletAddress,
      });
    }
  } catch (error) {
    console.error('Link Telegram error:', error);
    return NextResponse.json(
      { error: 'Failed to link Telegram', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET - Check if telegram is linked
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const telegramId = searchParams.get('telegram');
    const walletAddress = searchParams.get('wallet');

    if (!telegramId && !walletAddress) {
      return NextResponse.json(
        { error: 'Must provide telegram or wallet parameter' },
        { status: 400 }
      );
    }

    const hasDb = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY;

    if (hasDb) {
      const { getOrCreateUserByTelegram, getOrCreateUserByWallet } = await import('../../../../lib/db');

      let user;
      if (telegramId) {
        user = await getOrCreateUserByTelegram(telegramId);
      } else if (walletAddress) {
        user = await getOrCreateUserByWallet(walletAddress);
      }

      return NextResponse.json({
        linked: !!(user?.telegram_id && user?.wallet_address),
        telegramId: user?.telegram_id,
        walletAddress: user?.wallet_address,
      });
    } else {
      const telegramLinks = getLocalStore(telegramLinksPath);
      const key = telegramId || walletAddress;
      const link = telegramLinks[key!];

      return NextResponse.json({
        linked: !!link,
        telegramId: telegramId || link?.telegramId,
        walletAddress: walletAddress || link?.walletAddress,
      });
    }
  } catch (error) {
    console.error('Check link error:', error);
    return NextResponse.json(
      { error: 'Failed to check link', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
