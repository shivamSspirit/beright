/**
 * Conversation Messages API
 * GET /api/v2/conversations/:id/messages - Get messages
 * POST /api/v2/conversations/:id/messages - Add message
 */

import { NextRequest, NextResponse } from 'next/server';
import { messages } from '@/lib/supabase/conversations';
import type { NewMessage } from '@/lib/supabase/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: conversationId } = await context.params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const before = searchParams.get('before') || undefined;

    const result = await messages.getByConversation(conversationId, { limit, before });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[API] GET /conversations/:id/messages error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: conversationId } = await context.params;
    const body = await request.json();

    const { role, agent_type, content, mood, tool_calls, market_ids, prediction_ids } = body;

    if (!role || !content) {
      return NextResponse.json(
        { success: false, error: 'role and content required' },
        { status: 400 }
      );
    }

    const message = await messages.create({
      conversation_id: conversationId,
      role,
      agent_type,
      content,
      mood,
      tool_calls,
      market_ids,
      prediction_ids,
    } as NewMessage);

    return NextResponse.json({
      success: true,
      data: message,
    });
  } catch (error) {
    console.error('[API] POST /conversations/:id/messages error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add message' },
      { status: 500 }
    );
  }
}
