/**
 * useConversationRealtime
 *
 * Real-time subscription hook for conversation messages.
 * Uses Supabase Realtime to receive instant message updates.
 *
 * Features:
 * - Subscribes to messages table for active conversation
 * - Handles INSERT events for new messages
 * - Handles UPDATE events for message edits
 * - Reconciles optimistic updates with server data
 * - Syncs sidebar when conversations list changes
 *
 * Usage:
 * ```tsx
 * function Terminal() {
 *   const { walletAddress } = useWallet();
 *   const { activeConversationId } = useConversationStore();
 *
 *   useConversationRealtime({
 *     conversationId: activeConversationId,
 *     walletAddress,
 *     enabled: true,
 *   });
 *
 *   // Messages will auto-update via store
 * }
 * ```
 */

import { useEffect, useRef, useCallback } from 'react';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useConversationStore, Message, Conversation } from '../stores/conversationStore';

// ============================================
// TYPES
// ============================================

export interface UseConversationRealtimeOptions {
  conversationId: string | null;
  walletAddress: string | null;
  enabled?: boolean;
  onNewMessage?: (message: Message) => void;
  onMessageUpdate?: (message: Message) => void;
  onConversationUpdate?: (conversation: Conversation) => void;
}

interface DatabaseMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'agent' | 'system';
  agent_type?: string;
  content: string;
  mood?: string;
  tool_calls?: Record<string, unknown>;
  market_ids?: string[];
  prediction_ids?: string[];
  created_at: string;
  updated_at: string;
}

interface DatabaseConversation {
  id: string;
  wallet_address: string;
  title?: string;
  summary?: string;
  gateway_session_id?: string;
  bookmarked: boolean;
  pinned: boolean;
  archived: boolean;
  tags?: string[];
  message_count?: number;
  created_at: string;
  updated_at: string;
  last_message_at?: string;
}

// ============================================
// HOOK
// ============================================

export function useConversationRealtime(options: UseConversationRealtimeOptions) {
  const {
    conversationId,
    walletAddress,
    enabled = true,
    onNewMessage,
    onMessageUpdate,
    onConversationUpdate,
  } = options;

  const channelRef = useRef<RealtimeChannel | null>(null);
  const conversationsChannelRef = useRef<RealtimeChannel | null>(null);

  // Store actions
  const addMessage = useConversationStore((state) => state.addMessage);
  const updateMessage = useConversationStore((state) => state.updateMessage);
  const loadConversations = useConversationStore((state) => state.loadConversations);
  const activeConversation = useConversationStore((state) => state.activeConversation);

  // Convert database message to store message format
  const toStoreMessage = useCallback((dbMessage: DatabaseMessage): Message => {
    return {
      id: dbMessage.id,
      conversation_id: dbMessage.conversation_id,
      role: dbMessage.role,
      agent_type: dbMessage.agent_type as Message['agent_type'],
      content: dbMessage.content,
      mood: dbMessage.mood as Message['mood'],
      tool_calls: dbMessage.tool_calls,
      market_ids: dbMessage.market_ids,
      prediction_ids: dbMessage.prediction_ids,
      created_at: dbMessage.created_at,
    };
  }, []);

  // Handle new message from realtime
  const handleNewMessage = useCallback(
    (payload: RealtimePostgresChangesPayload<DatabaseMessage>) => {
      const dbMessage = payload.new as DatabaseMessage;

      // Skip if not for our conversation
      if (dbMessage.conversation_id !== conversationId) return;

      const message = toStoreMessage(dbMessage);

      // Check if this message already exists (optimistic update)
      const existingMessages = activeConversation?.messages || [];
      const existingIndex = existingMessages.findIndex(
        (m) =>
          m.id === message.id ||
          // Match optimistic messages by content and rough timestamp
          (m.id.startsWith('temp-') &&
            m.content === message.content &&
            m.role === message.role &&
            Math.abs(new Date(m.created_at).getTime() - new Date(message.created_at).getTime()) < 5000)
      );

      if (existingIndex >= 0) {
        // Update existing optimistic message with real data
        const existingMsg = existingMessages[existingIndex];
        if (existingMsg.id.startsWith('temp-')) {
          updateMessage(existingMsg.id, message);
          console.log('[Realtime] Reconciled optimistic message:', message.id);
        }
        // If already has real ID, skip (duplicate)
        return;
      }

      // New message - add to store
      addMessage({
        conversation_id: message.conversation_id,
        role: message.role,
        agent_type: message.agent_type,
        content: message.content,
        mood: message.mood,
        tool_calls: message.tool_calls,
        market_ids: message.market_ids,
        prediction_ids: message.prediction_ids,
      });

      console.log('[Realtime] New message received:', message.id);
      onNewMessage?.(message);
    },
    [conversationId, activeConversation, toStoreMessage, addMessage, updateMessage, onNewMessage]
  );

  // Handle message update from realtime
  const handleMessageUpdate = useCallback(
    (payload: RealtimePostgresChangesPayload<DatabaseMessage>) => {
      const dbMessage = payload.new as DatabaseMessage;

      // Skip if not for our conversation
      if (dbMessage.conversation_id !== conversationId) return;

      const message = toStoreMessage(dbMessage);
      updateMessage(message.id, message);

      console.log('[Realtime] Message updated:', message.id);
      onMessageUpdate?.(message);
    },
    [conversationId, toStoreMessage, updateMessage, onMessageUpdate]
  );

  // Handle conversation updates (for sidebar sync)
  const handleConversationChange = useCallback(
    (payload: RealtimePostgresChangesPayload<DatabaseConversation>) => {
      const dbConversation = payload.new as DatabaseConversation;

      // Skip if not our wallet
      if (dbConversation.wallet_address !== walletAddress) return;

      // Reload conversations list for sidebar
      loadConversations();

      console.log('[Realtime] Conversation updated:', dbConversation.id);

      const conversation: Conversation = {
        id: dbConversation.id,
        wallet_address: dbConversation.wallet_address,
        title: dbConversation.title,
        summary: dbConversation.summary,
        gateway_session_id: dbConversation.gateway_session_id,
        bookmarked: dbConversation.bookmarked,
        pinned: dbConversation.pinned,
        archived: dbConversation.archived,
        tags: dbConversation.tags,
        message_count: dbConversation.message_count || 0,
        created_at: dbConversation.created_at,
        updated_at: dbConversation.updated_at,
      };

      onConversationUpdate?.(conversation);
    },
    [walletAddress, loadConversations, onConversationUpdate]
  );

  // Subscribe to messages for active conversation
  useEffect(() => {
    if (!enabled || !conversationId) {
      // Cleanup existing subscription
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    // Create channel for messages
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        handleNewMessage
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        handleMessageUpdate
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Subscribed to messages for conversation:', conversationId);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Failed to subscribe to messages');
        }
      });

    channelRef.current = channel;

    // Cleanup on unmount or conversation change
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, conversationId, handleNewMessage, handleMessageUpdate]);

  // Subscribe to conversations for sidebar sync
  useEffect(() => {
    if (!enabled || !walletAddress) {
      if (conversationsChannelRef.current) {
        supabase.removeChannel(conversationsChannelRef.current);
        conversationsChannelRef.current = null;
      }
      return;
    }

    // Create channel for conversations
    const channel = supabase
      .channel(`conversations:${walletAddress}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversations',
          filter: `wallet_address=eq.${walletAddress}`,
        },
        handleConversationChange
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `wallet_address=eq.${walletAddress}`,
        },
        handleConversationChange
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Subscribed to conversations for wallet:', walletAddress.slice(0, 8));
        }
      });

    conversationsChannelRef.current = channel;

    return () => {
      if (conversationsChannelRef.current) {
        supabase.removeChannel(conversationsChannelRef.current);
        conversationsChannelRef.current = null;
      }
    };
  }, [enabled, walletAddress, handleConversationChange]);

  // Return subscription status
  return {
    isSubscribed: !!channelRef.current,
    messagesChannel: channelRef.current,
    conversationsChannel: conversationsChannelRef.current,
  };
}

// ============================================
// UTILITY HOOK: Subscribe to Job Updates
// ============================================

interface UseJobRealtimeOptions {
  jobId: string | null;
  enabled?: boolean;
  onProgress?: (progress: number, message?: string) => void;
  onComplete?: (result: unknown) => void;
  onError?: (error: string) => void;
}

/**
 * Subscribe to job progress updates via polling
 * (Jobs are stored in Redis, so we use HTTP polling instead of Supabase Realtime)
 */
export function useJobPolling(options: UseJobRealtimeOptions) {
  const { jobId, enabled = true, onProgress, onComplete, onError } = options;

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const updateJob = useConversationStore((state) => state.updateJob);
  const removeJob = useConversationStore((state) => state.removeJob);

  useEffect(() => {
    if (!enabled || !jobId) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const pollJob = async () => {
      try {
        const response = await fetch(`/api/jobs/${jobId}`);
        if (!response.ok) {
          if (response.status === 404) {
            // Job expired or deleted
            clearInterval(intervalRef.current!);
            intervalRef.current = null;
            removeJob(jobId);
            return;
          }
          throw new Error(`Job fetch failed: ${response.status}`);
        }

        const data = await response.json();

        // Update progress
        onProgress?.(data.progress, data.progressMessage);

        if (data.status === 'complete') {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          onComplete?.(data.result);
          updateJob(jobId, { status: 'complete', progress: 100, result: data.result });
          // Remove job after brief delay
          setTimeout(() => removeJob(jobId), 2000);
        } else if (data.status === 'failed') {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          onError?.(data.error || 'Job failed');
          updateJob(jobId, { status: 'failed', error: data.error });
          setTimeout(() => removeJob(jobId), 5000);
        } else {
          // Still running
          updateJob(jobId, {
            status: data.status,
            progress: data.progress,
            progress_message: data.progressMessage,
          });
        }
      } catch (error) {
        console.error('[JobPolling] Error polling job:', error);
      }
    };

    // Poll immediately, then every 2 seconds
    pollJob();
    intervalRef.current = setInterval(pollJob, 2000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, jobId, onProgress, onComplete, onError, updateJob, removeJob]);

  return {
    isPolling: !!intervalRef.current,
  };
}

export default useConversationRealtime;
