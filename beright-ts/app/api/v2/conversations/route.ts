/**
 * Conversations API
 * GET /api/v2/conversations - List conversations for wallet
 * POST /api/v2/conversations - Create new conversation
 */

import { NextRequest, NextResponse } from 'next/server';
import { conversations, messages } from '@/lib/supabase/conversations';
import type { NewConversation, NewMessage } from '@/lib/supabase/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const bookmarkedOnly = searchParams.get('bookmarked') === 'true';
    const archived = searchParams.get('archived') === 'true';
    const search = searchParams.get('q');

    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: 'wallet parameter required' },
        { status: 400 }
      );
    }

    let result;

    if (search) {
      // Search mode
      result = await conversations.search(walletAddress, search, { limit });
    } else {
      // List mode
      result = await conversations.listByWallet(walletAddress, {
        limit,
        offset,
        bookmarkedOnly,
        archived,
      });
    }

    return NextResponse.json({
      success: true,
      data: result,
      pagination: {
        limit,
        offset,
        hasMore: result.length === limit,
      },
    });
  } catch (error) {
    console.error('[API] GET /conversations error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet_address, title, gateway_session_id, tags, initial_message } = body;

    if (!wallet_address) {
      return NextResponse.json(
        { success: false, error: 'wallet_address required' },
        { status: 400 }
      );
    }

    // Create conversation
    const conversation = await conversations.create({
      wallet_address,
      title,
      gateway_session_id,
      tags,
    } as NewConversation);

    // If initial message provided, add it
    if (initial_message) {
      await messages.create({
        conversation_id: conversation.id,
        role: initial_message.role || 'user',
        agent_type: initial_message.agent_type,
        content: initial_message.content,
        mood: initial_message.mood,
      } as NewMessage);
    }

    return NextResponse.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    console.error('[API] POST /conversations error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create conversation' },
      { status: 500 }
    );
  }
}
