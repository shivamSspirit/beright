/**
 * Memory API
 * GET /api/v2/memory - Get memory entries for wallet
 * POST /api/v2/memory - Create memory entry
 */

import { NextRequest, NextResponse } from 'next/server';
import { memory } from '@/lib/supabase/conversations';
import type { NewMemoryEntry } from '@/lib/supabase/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');
    const type = searchParams.get('type'); // 'persistent' | 'daily' | 'search'
    const query = searchParams.get('q');
    const date = searchParams.get('date');
    const entryType = searchParams.get('entry_type');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: 'wallet parameter required' },
        { status: 400 }
      );
    }

    let result;

    if (query) {
      // Search mode
      result = await memory.search(walletAddress, query, { limit, entryType: entryType || undefined });
    } else if (type === 'daily') {
      // Daily notes
      result = await memory.getDailyNotes(walletAddress, { date: date || undefined });
    } else {
      // Persistent memory (default)
      result = await memory.getPersistent(walletAddress);
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[API] GET /memory error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch memory' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      wallet_address,
      entry_type,
      content,
      agent_source,
      conversation_id,
      entry_date,
      importance,
      expires_at,
    } = body;

    if (!wallet_address || !entry_type || !content) {
      return NextResponse.json(
        { success: false, error: 'wallet_address, entry_type, and content required' },
        { status: 400 }
      );
    }

    const entry = await memory.create({
      wallet_address,
      entry_type,
      content,
      agent_source,
      conversation_id,
      entry_date,
      importance,
      expires_at,
    } as NewMemoryEntry);

    return NextResponse.json({
      success: true,
      data: entry,
    });
  } catch (error) {
    console.error('[API] POST /memory error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create memory entry' },
      { status: 500 }
    );
  }
}
