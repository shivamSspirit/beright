/**
 * Notifications API Route
 * GET /api/notifications - Get user notifications
 * POST /api/notifications - Create a notification (internal use)
 * PATCH /api/notifications - Mark notifications as read
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');
    const telegramId = searchParams.get('telegram');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status'); // pending, sent, all

    if (!walletAddress && !telegramId) {
      return NextResponse.json(
        { error: 'Must provide wallet or telegram parameter' },
        { status: 400 }
      );
    }

    // First get the user ID
    let userId: string | null = null;

    if (walletAddress) {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('wallet_address', walletAddress)
        .single();
      userId = user?.id;
    } else if (telegramId) {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('telegram_id', telegramId)
        .single();
      userId = user?.id;
    }

    if (!userId) {
      return NextResponse.json({ notifications: [], total: 0 });
    }

    // Fetch notifications
    let query = supabase
      .from('notification_queue')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: notifications, error, count } = await query;

    if (error) {
      console.error('Error fetching notifications:', error);
      return NextResponse.json(
        { error: 'Failed to fetch notifications' },
        { status: 500 }
      );
    }

    // Format notifications for frontend
    const formatted = (notifications || []).map(n => ({
      id: n.id,
      type: n.notification_type,
      title: n.title,
      body: n.body,
      data: n.data,
      status: n.status,
      createdAt: n.created_at,
      sentAt: n.sent_at,
    }));

    return NextResponse.json({
      notifications: formatted,
      total: count || 0,
    });

  } catch (error) {
    console.error('Notifications API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, walletAddress, telegramId, type, title, message, data, channels } = body;

    // Get user ID if not provided
    let targetUserId = userId;

    if (!targetUserId && walletAddress) {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('wallet_address', walletAddress)
        .single();
      targetUserId = user?.id;
    }

    if (!targetUserId && telegramId) {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('telegram_id', telegramId)
        .single();
      targetUserId = user?.id;
    }

    if (!targetUserId) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Create notification
    const { data: notification, error } = await supabase
      .from('notification_queue')
      .insert({
        user_id: targetUserId,
        notification_type: type || 'general',
        title,
        body: message,
        data,
        channels: channels || ['telegram', 'web'],
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating notification:', error);
      return NextResponse.json(
        { error: 'Failed to create notification' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      notification: {
        id: notification.id,
        type: notification.notification_type,
        title: notification.title,
        body: notification.body,
        createdAt: notification.created_at,
      },
    });

  } catch (error) {
    console.error('Notifications POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { notificationIds, status } = body;

    if (!notificationIds || !Array.isArray(notificationIds)) {
      return NextResponse.json(
        { error: 'notificationIds array required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('notification_queue')
      .update({
        status: status || 'sent',
        sent_at: new Date().toISOString(),
      })
      .in('id', notificationIds);

    if (error) {
      console.error('Error updating notifications:', error);
      return NextResponse.json(
        { error: 'Failed to update notifications' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Notifications PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
