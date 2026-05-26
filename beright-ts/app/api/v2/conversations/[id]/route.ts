/**
 * Single Conversation API
 * GET /api/v2/conversations/:id - Get conversation with messages
 * PATCH /api/v2/conversations/:id - Update conversation metadata
 * DELETE /api/v2/conversations/:id - Delete conversation
 */

import { NextRequest, NextResponse } from 'next/server';
import { conversations } from '@/lib/supabase/conversations';
import { hasSupabaseAdminKey, isSupabaseConfigured } from '@/lib/supabase/client';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  if (!isSupabaseConfigured || !hasSupabaseAdminKey) {
    return NextResponse.json(
      {
        success: false,
        error: 'Supabase not configured',
        requiredEnv: ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
      },
      { status: 503 }
    );
  }

  try {
    const { id } = await context.params;

    const result = await conversations.getWithMessages(id);

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[API] GET /conversations/:id error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch conversation' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!isSupabaseConfigured || !hasSupabaseAdminKey) {
    return NextResponse.json(
      {
        success: false,
        error: 'Supabase not configured',
        requiredEnv: ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
      },
      { status: 503 }
    );
  }

  try {
    const { id } = await context.params;
    const body = await request.json();

    // Only allow certain fields to be updated
    const allowedFields = ['title', 'bookmarked', 'pinned', 'archived', 'tags', 'summary'];
    const updates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const conversation = await conversations.update(id, updates);

    return NextResponse.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    console.error('[API] PATCH /conversations/:id error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update conversation' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!isSupabaseConfigured || !hasSupabaseAdminKey) {
    return NextResponse.json(
      {
        success: false,
        error: 'Supabase not configured',
        requiredEnv: ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
      },
      { status: 503 }
    );
  }

  try {
    const { id } = await context.params;

    await conversations.delete(id);

    return NextResponse.json({
      success: true,
      data: { deleted: true },
    });
  } catch (error) {
    console.error('[API] DELETE /conversations/:id error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete conversation' },
      { status: 500 }
    );
  }
}
