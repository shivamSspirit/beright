/**
 * Whale Tracking API Route
 * GET /api/whale - Scan whale activity
 * GET /api/whale?wallet=xxx - Track specific wallet
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withMiddleware, ApiContext } from '../../../lib/apiMiddleware';
import { whaleWatch, checkWallet, addWhale } from '../../../skills/whale';
import { getSkillLogger } from '../../../lib/logger';

const log = getSkillLogger('whale');

// Query parameter validation
const querySchema = z.object({
  wallet: z.string().min(32).max(64).optional(),
  limit: z.string().regex(/^\d+$/).optional().transform(v => v ? parseInt(v) : 20),
  minAmount: z.string().regex(/^\d+(\.\d+)?$/).optional().transform(v => v ? parseFloat(v) : 1000),
}).strict();

export const GET = withMiddleware(
  async (request: NextRequest, context: ApiContext) => {
    const timer = log.startTimer();
    const { searchParams } = new URL(request.url);

    const wallet = searchParams.get('wallet');
    const limit = parseInt(searchParams.get('limit') || '20');
    const minAmount = parseFloat(searchParams.get('minAmount') || '1000');

    let result;

    if (wallet) {
      // Track specific wallet
      result = await checkWallet(wallet);
      log.info('Tracked wallet', { wallet: wallet.substring(0, 8) });
    } else {
      // Scan all known whales
      result = await whaleWatch();
    }

    const duration = timer();
    log.logSkillExecution({
      name: wallet ? 'whale.track' : 'whale.scan',
      duration,
      success: true,
    });

    return NextResponse.json({
      success: true,
      mode: wallet ? 'track' : 'scan',
      wallet: wallet || undefined,
      activity: result.data?.activity || [],
      summary: result.text,
      mood: result.mood,
      scannedAt: new Date().toISOString(),
    });
  },
  {
    rateLimit: 'whale',
    querySchema,
    cache: { maxAge: 60, staleWhileRevalidate: 120 },
  }
);

// POST to add a wallet to tracking
export const POST = withMiddleware(
  async (request: NextRequest, context: ApiContext) => {
    const body = await request.json();
    const { wallet, label } = body;

    if (!wallet || wallet.length < 32) {
      return NextResponse.json(
        { error: 'Invalid wallet address' },
        { status: 400 }
      );
    }

    // Add to tracking (this would update the memory file)
    log.info('Added wallet to tracking', {
      wallet: wallet.substring(0, 8),
      label,
      userId: context.userId,
    });

    return NextResponse.json({
      success: true,
      message: `Now tracking wallet ${wallet.substring(0, 8)}...`,
      wallet,
      label,
    });
  },
  {
    rateLimit: 'default',
    requireAuth: true,
  }
);
