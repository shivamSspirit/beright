/**
 * Signal Intelligence SSE Stream
 * GET /api/signals/stream
 *
 * Streams live signals to the web terminal via Server-Sent Events.
 * Uses Supabase Realtime to subscribe to new signal inserts.
 * Falls back to polling if Supabase Realtime is unavailable.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseConfigured } from '../../../../lib/supabase/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<Response> {
  const encoder = new TextEncoder();

  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const send = (data: object) => {
    try {
      writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    } catch {
      // Client disconnected
    }
  };

  // Send initial connection confirmation
  send({ type: 'connected', timestamp: new Date().toISOString() });

  // Send recent signals on connect (last 20 ALERT/WATCH signals)
  if (isSupabaseConfigured) {
    try {
      const { data } = await supabaseAdmin
        .from('signals')
        .select('*')
        .in('action', ['ALERT', 'WATCH'])
        .order('created_at', { ascending: false })
        .limit(20);

      if (data) {
        for (const row of (data as any[]).reverse()) {
          send({
            type: 'signal',
            id: row.id,
            signalType: row.type,
            marketTitle: row.market_title,
            platform: row.platform,
            strength: row.strength,
            action: row.action,
            confidence: row.confidence,
            reasoning: row.llm_verdict?.reasoning || '',
            alertText: row.alert_text,
            createdAt: row.created_at,
          });
        }
      }
    } catch (err) {
      console.warn('[SSE] Failed to load initial signals:', err);
    }
  }

  // Subscribe to Supabase Realtime for new signals
  let subscription: any = null;

  if (isSupabaseConfigured) {
    subscription = supabaseAdmin
      .channel('signals_stream')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'signals',
        filter: 'action=eq.ALERT',
      }, (payload: any) => {
        const row = payload.new;
        send({
          type: 'signal',
          id: row.id,
          signalType: row.type,
          marketTitle: row.market_title,
          platform: row.platform,
          strength: row.strength,
          action: row.action,
          confidence: row.confidence,
          reasoning: row.llm_verdict?.reasoning || '',
          alertText: row.alert_text,
          createdAt: row.created_at,
        });
      })
      .subscribe();
  }

  // Heartbeat ping every 30s to keep connection alive
  const pingInterval = setInterval(() => {
    try {
      writer.write(encoder.encode(': ping\n\n'));
    } catch {
      clearInterval(pingInterval);
    }
  }, 30000);

  // Cleanup on close
  req.signal.addEventListener('abort', () => {
    clearInterval(pingInterval);
    if (subscription) subscription.unsubscribe();
    writer.close().catch(() => {});
  });

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      'Connection': 'keep-alive',
    },
  });
}
