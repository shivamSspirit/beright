/**
 * Supabase Client for BeRight Web
 * Enables realtime sync with Telegram via beright_events table
 */

import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found. Realtime sync disabled.');
}

// Create Supabase client
export const supabase: SupabaseClient = createClient(
  supabaseUrl || '',
  supabaseAnonKey || '',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

// Event types from beright_events table
export type EventType =
  | 'telegram_message'
  | 'agent_response'
  | 'arb_alert'
  | 'whale_alert'
  | 'prediction'
  | 'heartbeat'
  | 'error';

export type AgentType = 'scout' | 'analyst' | 'trader' | 'commander';

export interface BerightEvent {
  id: string;
  event_type: EventType;
  session_id?: string;
  telegram_id?: number;
  telegram_username?: string;
  agent?: AgentType;
  command?: string;
  response?: string;
  mood?: string;
  data?: Record<string, unknown>;
  created_at: string;
}

// Subscribe to realtime events
export function subscribeToEvents(
  onEvent: (event: BerightEvent) => void,
  options?: {
    eventTypes?: EventType[];
    sessionId?: string;
  }
): RealtimeChannel {
  const channel = supabase
    .channel('beright-events')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'beright_events',
      },
      (payload) => {
        const event = payload.new as BerightEvent;

        // Filter by event type if specified
        if (options?.eventTypes && !options.eventTypes.includes(event.event_type)) {
          return;
        }

        // Filter by session if specified
        if (options?.sessionId && event.session_id !== options.sessionId) {
          return;
        }

        onEvent(event);
      }
    )
    .subscribe();

  return channel;
}

// Unsubscribe from channel
export function unsubscribeFromEvents(channel: RealtimeChannel): void {
  supabase.removeChannel(channel);
}

// Fetch recent events
export async function getRecentEvents(options?: {
  limit?: number;
  eventTypes?: EventType[];
  sessionId?: string;
}): Promise<BerightEvent[]> {
  let query = supabase
    .from('beright_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(options?.limit || 50);

  if (options?.eventTypes && options.eventTypes.length > 0) {
    query = query.in('event_type', options.eventTypes);
  }

  if (options?.sessionId) {
    query = query.eq('session_id', options.sessionId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to fetch events:', error);
    return [];
  }

  return (data || []) as BerightEvent[];
}

export default supabase;
