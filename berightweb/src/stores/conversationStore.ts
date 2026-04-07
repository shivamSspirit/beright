/**
 * Conversation Store
 * Persistent state management for chat conversations
 *
 * Features:
 * - Persists across navigation and page refresh
 * - Syncs with backend via /api/v2/conversations
 * - Tracks async jobs for navigation resilience
 * - OpenClaw-compatible memory integration
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { useEffect, useRef } from 'react';

// ============ TYPES ============

export type AgentType = 'SCOUT' | 'ANALYST' | 'TRADER' | 'SYSTEM';
export type MessageRole = 'user' | 'agent' | 'system';
export type AgentMood = 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'CAUTIOUS' | 'EDUCATIONAL' | 'ERROR';
export type JobStatus = 'pending' | 'running' | 'complete' | 'failed';

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  agent_type?: AgentType;
  content: string;
  mood?: AgentMood;
  tool_calls?: Record<string, unknown>;
  market_ids?: string[];
  prediction_ids?: string[];
  created_at: string;
}

export interface Conversation {
  id: string;
  wallet_address: string;
  title?: string;
  gateway_session_id?: string;
  bookmarked: boolean;
  pinned: boolean;
  archived: boolean;
  tags?: string[];
  summary?: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface ConversationWithMessages extends Conversation {
  messages: Message[];
}

export interface AsyncJob {
  id: string;
  wallet_address: string;
  conversation_id?: string;
  job_type: string;
  gateway_job_id?: string;
  status: JobStatus;
  progress: number;
  progress_message?: string;
  result?: Record<string, unknown>;
  error?: string;
  created_at: string;
  updated_at: string;
}

// ============ API HELPERS ============

const API_BASE = '';

async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `API error: ${response.status}`);
  }

  return response.json();
}

// ============ STORE STATE ============

interface ConversationState {
  // Current session
  activeConversationId: string | null;
  activeConversation: ConversationWithMessages | null;
  gatewaySessionId: string | null;

  // Conversations list (for sidebar)
  conversations: Conversation[];
  conversationsLoaded: boolean;

  // Loading state for switching conversations
  isLoadingConversation: boolean;
  loadingError: string | null;

  // Processing state (for sending messages)
  isProcessing: boolean;
  processingMessage: string | null;

  // Async jobs (for navigation resilience)
  pendingJobs: AsyncJob[];

  // Wallet
  walletAddress: string | null;

  // Actions
  setWallet: (address: string | null) => void;

  // Conversation CRUD
  loadConversations: () => Promise<void>;
  createConversation: (initialMessage?: string) => Promise<string>;
  loadConversation: (id: string) => Promise<void>;
  setActiveConversation: (id: string | null) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;

  // Messages
  addMessage: (message: Omit<Message, 'id' | 'created_at'>) => void;
  addOptimisticMessage: (content: string, role: MessageRole) => string;
  updateMessage: (tempId: string, message: Message) => void;

  // Processing
  setProcessing: (isProcessing: boolean, message?: string | null) => void;
  setGatewaySessionId: (sessionId: string | null) => void;
  setActiveConversationId: (id: string | null) => void;  // Sync conversation ID from server

  // Jobs
  addJob: (job: AsyncJob) => void;
  updateJob: (id: string, updates: Partial<AsyncJob>) => void;
  removeJob: (id: string) => void;
  checkPendingJobs: () => Promise<void>;

  // Utilities
  clearActiveConversation: () => void;
  reset: () => void;
}

// ============ STORE IMPLEMENTATION ============

export const useConversationStore = create<ConversationState>()(
  persist(
    (set, get) => ({
      // Initial state
      activeConversationId: null,
      activeConversation: null,
      gatewaySessionId: null,
      conversations: [],
      conversationsLoaded: false,
      isLoadingConversation: false,
      loadingError: null,
      isProcessing: false,
      processingMessage: null,
      pendingJobs: [],
      walletAddress: null,

      // Set wallet address
      setWallet: (address) => {
        const currentWallet = get().walletAddress;
        if (currentWallet !== address) {
          // Wallet changed, reset state
          set({
            walletAddress: address,
            activeConversationId: null,
            activeConversation: null,
            conversations: [],
            conversationsLoaded: false,
            pendingJobs: [],
          });
        }
      },

      // Load conversations for sidebar
      loadConversations: async () => {
        const { walletAddress } = get();
        if (!walletAddress) return;

        try {
          const response = await apiFetch<{
            success: boolean;
            data: Conversation[];
          }>(`/api/v2/conversations?wallet=${walletAddress}&limit=50`);

          if (response.success) {
            set({
              conversations: response.data,
              conversationsLoaded: true,
            });
          }
        } catch (error) {
          console.error('[ConversationStore] Failed to load conversations:', error);
        }
      },

      // Create new conversation
      createConversation: async (initialMessage) => {
        const { walletAddress, gatewaySessionId } = get();
        if (!walletAddress) {
          console.error('[ConversationStore] createConversation failed: wallet not connected');
          throw new Error('Wallet not connected');
        }
        console.log('[ConversationStore] Creating new conversation for wallet:', walletAddress.slice(0, 8) + '...');

        const response = await apiFetch<{
          success: boolean;
          data: Conversation;
        }>('/api/v2/conversations', {
          method: 'POST',
          body: JSON.stringify({
            wallet_address: walletAddress,
            gateway_session_id: gatewaySessionId,
            initial_message: initialMessage ? {
              role: 'user',
              content: initialMessage,
            } : undefined,
          }),
        });

        if (!response.success) {
          console.error('[ConversationStore] API returned failure for conversation creation');
          throw new Error('Failed to create conversation');
        }

        const conversation = response.data;
        console.log('[ConversationStore] Conversation created successfully:', conversation.id);

        // Add to conversations list
        set((state) => ({
          conversations: [conversation, ...state.conversations],
          activeConversationId: conversation.id,
          activeConversation: {
            ...conversation,
            messages: initialMessage ? [{
              id: `temp-${Date.now()}`,
              conversation_id: conversation.id,
              role: 'user' as MessageRole,
              content: initialMessage,
              created_at: new Date().toISOString(),
            }] : [],
          },
        }));

        console.log('[ConversationStore] Active conversation set:', conversation.id);
        return conversation.id;
      },

      // Load single conversation with messages
      loadConversation: async (id) => {
        // Set loading state
        set({
          isLoadingConversation: true,
          loadingError: null,
          activeConversationId: id, // Set ID immediately for UI feedback
        });

        try {
          // API returns { conversation: Conversation, messages: Message[] }
          const response = await apiFetch<{
            success: boolean;
            data: { conversation: Conversation; messages: Message[] };
            error?: string;
          }>(`/api/v2/conversations/${id}`);

          if (response.success && response.data) {
            const { conversation, messages } = response.data;
            // Merge into flat ConversationWithMessages structure
            const conversationWithMessages: ConversationWithMessages = {
              ...conversation,
              messages: messages || [],
            };

            set({
              activeConversation: conversationWithMessages,
              gatewaySessionId: conversation.gateway_session_id || null,
              isLoadingConversation: false,
              loadingError: null,
            });
          } else {
            // API returned an error
            set({
              isLoadingConversation: false,
              loadingError: response.error || 'Failed to load conversation',
              activeConversation: null,
            });
          }
        } catch (error) {
          console.error('[ConversationStore] Failed to load conversation:', error);
          set({
            isLoadingConversation: false,
            loadingError: error instanceof Error ? error.message : 'Failed to load conversation',
            activeConversation: null,
          });
        }
      },

      // Set active conversation (local only, for switching)
      setActiveConversation: (id) => {
        if (id === null) {
          set({
            activeConversationId: null,
            activeConversation: null,
          });
        } else {
          // Load the conversation
          get().loadConversation(id);
        }
      },

      // Update conversation metadata
      updateConversation: async (id, updates) => {
        try {
          await apiFetch(`/api/v2/conversations/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(updates),
          });

          // Update local state
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c.id === id ? { ...c, ...updates } : c
            ),
            activeConversation: state.activeConversation?.id === id
              ? { ...state.activeConversation, ...updates }
              : state.activeConversation,
          }));
        } catch (error) {
          console.error('[ConversationStore] Failed to update conversation:', error);
        }
      },

      // Delete conversation
      deleteConversation: async (id) => {
        try {
          await apiFetch(`/api/v2/conversations/${id}`, {
            method: 'DELETE',
          });

          set((state) => ({
            conversations: state.conversations.filter((c) => c.id !== id),
            activeConversationId: state.activeConversationId === id ? null : state.activeConversationId,
            activeConversation: state.activeConversation?.id === id ? null : state.activeConversation,
          }));
        } catch (error) {
          console.error('[ConversationStore] Failed to delete conversation:', error);
        }
      },

      // Add message (for real messages from API)
      addMessage: (message) => {
        const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const fullMessage: Message = {
          ...message,
          id,
          created_at: new Date().toISOString(),
        };

        set((state) => {
          if (!state.activeConversation) {
            console.warn('[ConversationStore] addMessage called but no activeConversation - message will not be added:', {
              messageRole: message.role,
              contentPreview: message.content.slice(0, 50),
            });
            return state;
          }

          console.log('[ConversationStore] Adding message to conversation:', {
            conversationId: state.activeConversation.id,
            messageId: id,
            role: message.role,
          });

          return {
            activeConversation: {
              ...state.activeConversation,
              messages: [...state.activeConversation.messages, fullMessage],
              message_count: state.activeConversation.message_count + 1,
            },
          };
        });
      },

      // Add optimistic message (returns temp ID for later update)
      addOptimisticMessage: (content, role) => {
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const { activeConversation } = get();

        if (!activeConversation) return tempId;

        const message: Message = {
          id: tempId,
          conversation_id: activeConversation.id,
          role,
          content,
          created_at: new Date().toISOString(),
        };

        set((state) => ({
          activeConversation: state.activeConversation ? {
            ...state.activeConversation,
            messages: [...state.activeConversation.messages, message],
          } : null,
        }));

        return tempId;
      },

      // Update optimistic message with real data
      updateMessage: (tempId, message) => {
        set((state) => {
          if (!state.activeConversation) return state;

          return {
            activeConversation: {
              ...state.activeConversation,
              messages: state.activeConversation.messages.map((m) =>
                m.id === tempId ? message : m
              ),
            },
          };
        });
      },

      // Set processing state
      setProcessing: (isProcessing, message = null) => {
        set({
          isProcessing,
          processingMessage: message,
        });
      },

      // Set gateway session ID
      setGatewaySessionId: (sessionId) => {
        set({ gatewaySessionId: sessionId });
      },

      // Set active conversation ID (synced from server response)
      setActiveConversationId: (id) => {
        if (id === get().activeConversationId) return;

        set({ activeConversationId: id });

        // If we have an ID, try to load the full conversation
        if (id) {
          get().loadConversation(id).catch((error) => {
            console.warn('[ConversationStore] Failed to load conversation:', error);
          });
        }
      },

      // Add async job
      addJob: (job) => {
        set((state) => ({
          pendingJobs: [...state.pendingJobs, job],
        }));
      },

      // Update job status
      updateJob: (id, updates) => {
        set((state) => ({
          pendingJobs: state.pendingJobs.map((j) =>
            j.id === id ? { ...j, ...updates } : j
          ),
        }));
      },

      // Remove job
      removeJob: (id) => {
        set((state) => ({
          pendingJobs: state.pendingJobs.filter((j) => j.id !== id),
        }));
      },

      // Check for pending jobs (called on mount/navigation)
      checkPendingJobs: async () => {
        const { walletAddress, pendingJobs } = get();
        if (!walletAddress || pendingJobs.length === 0) return;

        // Check status of pending jobs
        for (const job of pendingJobs) {
          if (job.status === 'pending' || job.status === 'running') {
            try {
              const response = await apiFetch<{
                success: boolean;
                data: AsyncJob;
              }>(`/api/jobs/${job.id}`);

              if (response.success && response.data) {
                const updatedJob = response.data;

                if (updatedJob.status === 'complete' || updatedJob.status === 'failed') {
                  // Job finished, update and potentially add result as message
                  get().updateJob(job.id, updatedJob);

                  if (updatedJob.status === 'complete' && updatedJob.result) {
                    // Add result as agent message
                    const resultText = typeof updatedJob.result === 'string'
                      ? updatedJob.result
                      : (updatedJob.result as { text?: string }).text || 'Task completed';

                    get().addMessage({
                      conversation_id: job.conversation_id || '',
                      role: 'agent',
                      content: resultText,
                      mood: (updatedJob.result as { mood?: AgentMood }).mood,
                    });
                  }

                  // Remove completed job after processing
                  setTimeout(() => get().removeJob(job.id), 1000);
                } else {
                  // Still running, update progress
                  get().updateJob(job.id, updatedJob);
                }
              }
            } catch (error) {
              console.error('[ConversationStore] Failed to check job status:', error);
            }
          }
        }
      },

      // Clear active conversation (for starting fresh)
      clearActiveConversation: () => {
        set({
          activeConversationId: null,
          activeConversation: null,
          gatewaySessionId: null,
          isLoadingConversation: false,
          loadingError: null,
          isProcessing: false,
          processingMessage: null,
        });
      },

      // Reset entire store
      reset: () => {
        set({
          activeConversationId: null,
          activeConversation: null,
          gatewaySessionId: null,
          conversations: [],
          conversationsLoaded: false,
          isLoadingConversation: false,
          loadingError: null,
          isProcessing: false,
          processingMessage: null,
          pendingJobs: [],
          walletAddress: null,
        });
      },
    }),
    {
      name: 'beright-conversations',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist essential state
        activeConversationId: state.activeConversationId,
        gatewaySessionId: state.gatewaySessionId,
        pendingJobs: state.pendingJobs,
        walletAddress: state.walletAddress,
        // Don't persist full conversations - reload from API
      }),
    }
  )
);

// ============ HOOKS ============

/**
 * Hook to initialize conversation store with wallet
 * Call this in your main terminal component
 *
 * NOTE: This hook is deprecated. Use separate useEffects instead to avoid
 * calling setState during render which causes infinite loops.
 */
export function useInitConversations(walletAddress: string | null) {
  const { setWallet, loadConversations, checkPendingJobs } = useConversationStore();
  const storeWallet = useConversationStore((state) => state.walletAddress);
  const conversationsLoaded = useConversationStore((state) => state.conversationsLoaded);

  // Use useEffect to avoid calling setState during render
  useEffect(() => {
    if (walletAddress !== storeWallet) {
      setWallet(walletAddress);
    }
  }, [walletAddress, storeWallet, setWallet]);

  useEffect(() => {
    if (walletAddress && !conversationsLoaded) {
      loadConversations();
      checkPendingJobs();
    }
  }, [walletAddress, conversationsLoaded, loadConversations, checkPendingJobs]);
}

// Stable empty array reference to avoid creating new arrays on each render
const EMPTY_MESSAGES: Message[] = [];

// Stable selector functions defined outside hooks to prevent re-creation
const selectMessages = (state: ConversationState) => state.activeConversation?.messages;
const selectProcessing = (state: ConversationState) => ({
  isProcessing: state.isProcessing,
  processingMessage: state.processingMessage,
});

/**
 * Selector for active messages (optimized re-renders)
 * Uses stable empty array reference when no messages
 */
export const useMessages = () => {
  const messages = useConversationStore(selectMessages);
  return messages ?? EMPTY_MESSAGES;
};

/**
 * Selector for processing state
 * Uses useShallow for proper object comparison to prevent unnecessary re-renders
 */
export const useIsProcessing = () => {
  return useConversationStore(useShallow(selectProcessing));
};

/**
 * Selector for conversations list
 */
export const useConversationsList = () => {
  return useConversationStore((state) => state.conversations);
};

/**
 * Selector for conversation loading state
 */
export const useConversationLoading = () => {
  return useConversationStore(
    useShallow((state) => ({
      isLoadingConversation: state.isLoadingConversation,
      loadingError: state.loadingError,
    }))
  );
};
