'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Connection, Transaction, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { useUser } from '@/hooks/useUnifiedUser';
import { useMode } from '@/context/ModeContext';
import { getHotMarketsFeed, sendToGateway, fetchTerminalData, GatewayResponse, ApiMarket, getFeed, FeedMarket, waitForJob } from '@/lib/api';
import { getAllExplorerUrls } from '@/lib/explorer';
import { useSignalStream } from '@/hooks/useSignalStream';
import { useConversationStore, useMessages, useIsProcessing, useConversationLoading } from '@/stores/conversationStore';
import { useConversationRealtime, useJobPolling } from '@/hooks/useConversationRealtime';
import { PanelLeft, PanelRight, X } from 'lucide-react';

// Portfolio data structure from API
interface PortfolioData {
  portfolioValue: number;
  dailyChange: number;
  dailyChangePct: number;
  marketExposure: number;
  positionRisk: number;
  openPositions: number;
  tradingAllowed: boolean;
}

// V3 Components
import {
  PulseIndicator,
  NavPill,
  MarketTable,
  ChatInterface,
  PortfolioSidebar,
  CLIInput,
  MarketsPage,
  AgentsPage,
  LogsPage,
  ConversationSidebar,
  TabName,
  ChatMessage,
} from './index';

import { AgentLog, generateId } from '../components/types';
import styles from '../beright.module.css';
import BrandLogo from '@/components/BrandLogo';
import OnboardingTour from '@/components/OnboardingTour';
import RestartTourButton from '@/components/RestartTourButton';
import { getTourSteps } from '@/config/tour-steps';

// Solana devnet RPC and Memo Program
const DEVNET_RPC = process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL || 'https://api.devnet.solana.com';
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

/**
 * BeRight Terminal v3
 *
 * Clean, professional trading terminal with three-column layout.
 * Design inspired by high-end financial terminals.
 */
export default function BeRightTerminal() {
  const { isAuthenticated, login, isLoading: userLoading, walletAddress } = useUser();
  const { isDemo, isLoading: modeLoading } = useMode();

  // Use wallet adapter directly for demo mode signing
  const wallet = useWallet();
  const { signTransaction: walletSignTransaction } = wallet;

  // Derived state for compatibility
  const ready = !userLoading && !modeLoading;
  const authenticated = isAuthenticated;

  // Navigation
  const [activeTab, setActiveTab] = useState<TabName>('BERIGHT');
  const [mobileSheet, setMobileSheet] = useState<'history' | 'portfolio' | null>(null);

  // Signal intelligence stream (SSE)
  const { signals, connected: signalsConnected } = useSignalStream();

  // Data
  const [markets, setMarkets] = useState<ApiMarket[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Portfolio data (from /api/v2/portfolio)
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null);

  // Pending transaction for wallet signing (from Trader agent)
  const [pendingTx, setPendingTx] = useState<{
    transaction: string;
    description: string;
    marketTitle: string;
    amount: string;
  } | null>(null);

  // Conversation store - use SELECTORS to avoid re-renders on every store change
  // State values (reactive - will re-render when these change)
  const activeConversation = useConversationStore((state) => state.activeConversation);
  const activeConversationId = useConversationStore((state) => state.activeConversationId);
  const gatewaySessionId = useConversationStore((state) => state.gatewaySessionId);

  // Get messages from store (with selector for performance)
  const storeMessages = useMessages();
  const { isProcessing, processingMessage } = useIsProcessing();
  const { isLoadingConversation, loadingError } = useConversationLoading();

  // Store actions - get via getState() to avoid re-renders (actions are stable)
  const storeActions = useMemo(() => ({
    setWallet: useConversationStore.getState().setWallet,
    loadConversations: useConversationStore.getState().loadConversations,
    createConversation: useConversationStore.getState().createConversation,
    setActiveConversation: useConversationStore.getState().setActiveConversation,
    addMessage: useConversationStore.getState().addMessage,
    addOptimisticMessage: useConversationStore.getState().addOptimisticMessage,
    setProcessing: useConversationStore.getState().setProcessing,
    setGatewaySessionId: useConversationStore.getState().setGatewaySessionId,
    checkPendingJobs: useConversationStore.getState().checkPendingJobs,
  }), []);

  // Destructure for easier use
  const {
    setWallet,
    loadConversations,
    createConversation,
    setActiveConversation,
    addMessage,
    setProcessing,
    setGatewaySessionId,
    checkPendingJobs,
  } = storeActions;

  // Convert store messages to ChatMessage format for ChatInterface
  const chatMessages: ChatMessage[] = useMemo(() => {
    return storeMessages.map((msg) => ({
      id: msg.id,
      role: msg.role === 'user' ? 'user' : 'agent',
      agent: msg.agent_type as ChatMessage['agent'],
      content: msg.content,
      timestamp: new Date(msg.created_at),
      mood: msg.mood,
    }));
  }, [storeMessages]);

  // Agent state
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([]);
  const [onlineAgents] = useState(['SCOUT', 'ANALYST', 'TRADER']);

  // Refresh interval ref
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Get user's Solana wallet pubkey (from unified hook)
  const solanaWallet = walletAddress;

  // Get tour steps safely (must be at top level before any returns)
  const tourSteps = useMemo(() => {
    try {
      return getTourSteps('terminal');
    } catch (error) {
      console.error('[BeRightTerminal] Error loading tour steps:', error);
      return [];
    }
  }, []);

  // Debug logging for tour conditions (must be at top level before any returns)
  useEffect(() => {
    console.log('[BeRightTerminal] Tour conditions:', {
      isDemo,
      authenticated,
      ready,
      willShowTour: isDemo && authenticated,
      tourStepsLoaded: tourSteps.length,
    });
  }, [isDemo, authenticated, ready, tourSteps.length]);

  // Initialize conversation store with wallet - split to avoid dependency loops
  const conversationsLoaded = useConversationStore((state) => state.conversationsLoaded);

  useEffect(() => {
    if (walletAddress) {
      setWallet(walletAddress);
    }
  }, [walletAddress]); // setWallet is stable from zustand

  useEffect(() => {
    if (walletAddress && !conversationsLoaded) {
      loadConversations();
      checkPendingJobs();
    }
  }, [walletAddress, conversationsLoaded]); // loadConversations/checkPendingJobs are stable

  // Auto-load persisted active conversation on mount
  // This fixes the issue where activeConversationId is in localStorage but activeConversation is null
  useEffect(() => {
    if (walletAddress && activeConversationId && !activeConversation && !isLoadingConversation) {
      console.log('[Terminal] Auto-loading persisted conversation:', activeConversationId);
      useConversationStore.getState().loadConversation(activeConversationId);
    }
  }, [walletAddress, activeConversationId, activeConversation, isLoadingConversation]);

  // Close mobile sheet on Escape (mobile + desktop)
  useEffect(() => {
    if (!mobileSheet) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileSheet(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileSheet]);

  // If user navigates away from chat, ensure the sheet doesn't "stick" in state.
  useEffect(() => {
    if (activeTab !== 'BERIGHT') setMobileSheet(null);
  }, [activeTab]);

  // Real-time subscription for live message updates
  // This enables multi-tab sync and instant message delivery
  const { isSubscribed: realtimeConnected } = useConversationRealtime({
    conversationId: activeConversationId,
    walletAddress: walletAddress || null,
    enabled: !!walletAddress && !!activeConversationId,
    onNewMessage: (message) => {
      console.log('[Terminal] Real-time message received:', message.id);
    },
  });

  // Track last agent message ID for updates (for async progress)
  const lastAgentMessageIdRef = useRef<string | null>(null);

  // Add chat message - now uses the store
  const addChatMessage = useCallback(async (
    role: 'user' | 'agent',
    content: string,
    agent?: ChatMessage['agent'],
    mood?: string
  ): Promise<string | null> => {
    // Get current state to check activeConversation (not just ID)
    const currentState = useConversationStore.getState();
    const hasActiveConversation = currentState.activeConversation !== null;

    // For user messages: if no active conversation object loaded, create a new one
    if (role === 'user' && !hasActiveConversation) {
      try {
        // Pass the initial message to createConversation - it will add the message to state
        const convId = await createConversation(content);
        console.log('[Terminal] Created conversation with initial message:', convId);
        // Message is already added by createConversation, just return success
        const id = `msg-${Date.now()}`;
        return id;
      } catch (error) {
        console.error('[Terminal] Failed to create conversation:', error);
        const errorMsg = error instanceof Error ? error.message : 'Failed to create conversation';
        console.error('[Terminal] Unable to add message - conversation creation failed:', errorMsg);
        return null;
      }
    }

    // For agent messages or when conversation exists: add message to store
    const convId = currentState.activeConversationId;
    if (!convId || !hasActiveConversation) {
      console.error('[Terminal] Cannot add message - no active conversation');
      return null;
    }

    // Add message to store
    addMessage({
      conversation_id: convId,
      role: role === 'user' ? 'user' : 'agent',
      agent_type: agent as any,
      content,
      mood: mood as any,
    });

    const id = `msg-${Date.now()}`;
    if (role === 'agent') {
      lastAgentMessageIdRef.current = id;
    }
    return id;
  }, [createConversation, addMessage]);

  // Update the last agent message (for async progress updates)
  // This uses local state for progress since store updates would be too heavy
  const [progressContent, setProgressContent] = useState<{ content: string; mood?: string } | null>(null);

  const updateLastAgentMessage = useCallback((content: string, mood?: string) => {
    // Update progress state - this will be merged with the last message visually
    setProgressContent({ content, mood });
  }, []);

  // Merge progress content into chat messages for display
  const displayMessages: ChatMessage[] = useMemo(() => {
    if (!progressContent || chatMessages.length === 0) return chatMessages;

    const lastIdx = chatMessages.length - 1;
    const lastMsg = chatMessages[lastIdx];
    if (lastMsg.role !== 'agent') return chatMessages;

    // Replace last agent message content with progress content
    return [
      ...chatMessages.slice(0, lastIdx),
      { ...lastMsg, content: progressContent.content, mood: progressContent.mood || lastMsg.mood },
    ];
  }, [chatMessages, progressContent]);

  // Clear progress when a new message is added
  useEffect(() => {
    if (chatMessages.length > 0 && progressContent !== null) {
      setProgressContent(null);
    }
  }, [chatMessages.length, progressContent]);

  // Add agent log
  const addAgentLog = useCallback((agent: AgentLog['agent'], message: string, type: AgentLog['type'] = 'info') => {
    setAgentLogs(prev => [...prev.slice(-50), {
      id: generateId(),
      agent,
      message,
      timestamp: new Date(),
      type,
    }]);
  }, []);

  // Fetch all terminal data (markets + portfolio + risk)
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    if (!silent) addAgentLog('SCOUT', 'Initiating ML-powered market scan...', 'info');

    try {
      // Fetch markets from v2 feed API and terminal data in parallel
      const [hotData, terminalData] = await Promise.all([
        getHotMarketsFeed(20).catch((err) => {
          if (!silent) addAgentLog('SYSTEM', `Feed API failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
          return { markets: [], count: 0 } as any;
        }),
        fetchTerminalData().catch(() => ({ markets: [], arbitrage: [], portfolio: null, risk: null, connected: false })),
      ]);

      // Update markets from ML-powered feed
      if (hotData.markets?.length > 0) {
        setMarkets(hotData.markets);
        if (!silent) addAgentLog('SCOUT', `ML matched ${hotData.markets.length} markets across platforms`, 'success');
      }

      // Update portfolio data from API response
      if (terminalData.portfolio) {
        const p = terminalData.portfolio;
        setPortfolioData({
          portfolioValue: p.overview?.portfolioValue || 0,
          dailyChange: p.today?.pnl || 0,
          dailyChangePct: p.today?.pnlPct || 0,
          marketExposure: p.risk?.exposure?.utilizationPct || 0,
          positionRisk: Math.min(100, (p.positions?.length || 0) * 15), // Rough risk calc
          openPositions: p.overview?.openPositions || 0,
          tradingAllowed: p.risk?.tradingAllowed ?? true,
        });
        if (!silent) addAgentLog('SYSTEM', 'Portfolio synced', 'success');
      }
    } catch (error) {
      if (!silent) addAgentLog('SYSTEM', `Failed to fetch data: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }

    if (!silent) setIsLoading(false);
  }, [addAgentLog]);

  // Initial data fetch + refresh polling
  useEffect(() => {
    if (authenticated) {
      // Initial fetch
      fetchData();

      // Set up polling every 30 seconds
      refreshIntervalRef.current = setInterval(() => {
        fetchData(true); // Silent refresh
      }, 30_000);

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [authenticated, fetchData]);

  // Determine which agent handles command
  const getAgentForCommand = (text: string): AgentLog['agent'] => {
    const lower = text.toLowerCase();
    if (lower.startsWith('/hot') || lower.startsWith('/scan') || lower.startsWith('/alpha')) return 'SCOUT';
    if (lower.startsWith('/research') || lower.startsWith('/odds') || lower.startsWith('/analyze')) return 'ANALYST';
    if (lower.startsWith('/arb')) return 'ANALYST';
    if (lower.startsWith('/trade') || lower.startsWith('/buy') || lower.startsWith('/sell')) return 'TRADER';
    return 'ANALYST';
  };

  // Process terminal command
  const processCommand = useCallback(async (cmd: string) => {
    setProcessing(true, 'Processing...');

    // Ensure wallet is synced to store before processing
    // This fixes a race condition where wallet might not be set yet
    if (walletAddress) {
      const storeWallet = useConversationStore.getState().walletAddress;
      if (storeWallet !== walletAddress) {
        setWallet(walletAddress);
      }
    }

    // Add user message to chat
    const msgId = await addChatMessage('user', cmd);

    // If message failed to add (e.g., wallet not connected), show error
    if (!msgId) {
      addAgentLog('SYSTEM', 'Failed to send message - please ensure wallet is connected', 'error');
      setProcessing(false);
      return;
    }

    const command = cmd.toLowerCase().trim();

    // Local navigation commands
    if (command === '/markets') {
      setActiveTab('MARKETS');
      addChatMessage('agent', 'Switching to MARKETS view...', 'SYSTEM');
      setProcessing(false);
      return;
    }

    if (command === '/agents') {
      setActiveTab('AGENTS');
      addChatMessage('agent', 'Switching to AGENTS view...', 'SYSTEM');
      setProcessing(false);
      return;
    }

    if (command === '/logs') {
      setActiveTab('LOGS');
      addChatMessage('agent', 'Switching to LOGS view...', 'SYSTEM');
      setProcessing(false);
      return;
    }

    if (command === '/home' || command === '/beright') {
      setActiveTab('BERIGHT');
      addChatMessage('agent', 'Returning to home terminal...', 'SYSTEM');
      setProcessing(false);
      return;
    }

    if (command === '/clear') {
      // Clear is now a new conversation
      useConversationStore.getState().clearActiveConversation();
      addChatMessage('agent', 'Starting a new conversation...', 'SYSTEM');
      setProcessing(false);
      return;
    }

    if (command === '/new') {
      // Start a new conversation
      try {
        await createConversation();
        addChatMessage('agent', 'New conversation started.', 'SYSTEM');
      } catch (error) {
        addChatMessage('agent', 'Failed to create new conversation.', 'SYSTEM');
      }
      setProcessing(false);
      return;
    }

    const agent = getAgentForCommand(cmd);
    addAgentLog(agent, `Processing: ${cmd.slice(0, 50)}${cmd.length > 50 ? '...' : ''}`, 'info');

    try {
      // Pass wallet pubkey for trade execution and persistence
      const response: GatewayResponse = await sendToGateway(cmd, {
        sessionId: gatewaySessionId || undefined,
        userId: solanaWallet || undefined,
        walletAddress: solanaWallet || undefined,           // Enable Supabase persistence
        conversationId: activeConversationId || undefined,  // Continue existing conversation
      });

      // Update session and conversation IDs from response
      if (response.sessionId && response.sessionId !== gatewaySessionId) {
        setGatewaySessionId(response.sessionId);
      }

      // If backend created/returned a conversation ID, sync it to our store
      if (response.conversationId && response.conversationId !== activeConversationId) {
        useConversationStore.getState().setActiveConversationId(response.conversationId);
      }

      // Handle async jobs (long-running operations)
      if (response.async && response.jobId) {
        // Show initial processing message
        addChatMessage('agent', `${response.text}\n\n⏳ Progress: 0%`, agent, 'NEUTRAL');
        addAgentLog(agent, `Async job started: ${response.jobId}`, 'info');

        try {
          // Poll for completion with progress updates
          const finalResponse = await waitForJob(response.jobId, {
            onProgress: (progress, message) => {
              const progressBar = '█'.repeat(Math.floor(progress / 10)) + '░'.repeat(10 - Math.floor(progress / 10));
              updateLastAgentMessage(
                `Processing your request...\n\n${progressBar} ${progress}%${message ? `\n${message}` : ''}`
              );
              addAgentLog(agent, `Progress: ${progress}% - ${message || 'Working...'}`, 'info');
            },
          });

          // Update with final result
          updateLastAgentMessage(finalResponse.text, finalResponse.mood);
          addAgentLog(agent, `Analysis complete (${finalResponse.mood || 'NEUTRAL'})`, 'success');

          // Handle data from final response
          if (finalResponse.data) {
            if (Array.isArray(finalResponse.data) && finalResponse.data.length > 0 && finalResponse.data[0].title) {
              setMarkets(finalResponse.data);
            }
          }
        } catch (jobError) {
          const errorMsg = jobError instanceof Error ? jobError.message : 'Job failed';
          updateLastAgentMessage(`❌ ${errorMsg}\n\nPlease try again.`, 'ERROR');
          addAgentLog(agent, `Job failed: ${errorMsg}`, 'error');
        }

        setProcessing(false);
        return;
      }

      // Handle synchronous response
      if (response.success) {
        // Add agent response to chat
        addChatMessage('agent', response.text, agent, response.mood);
        addAgentLog(agent, `Response received (${response.mood || 'NEUTRAL'})`, 'success');

        // Check if agent returned a transaction that needs wallet signing
        if (response.data && checkForPendingTransaction(response.data)) {
          // Transaction detected - will be handled by pendingTx state
          addAgentLog('TRADER', 'Trade ready for execution - sign with wallet', 'info');
        }

        // Update markets if data returned
        if (response.data) {
          if (Array.isArray(response.data) && response.data.length > 0 && response.data[0].title) {
            setMarkets(response.data);
          }
        }
      } else {
        addChatMessage('agent', response.error || 'Sorry, I encountered an error processing your request.', 'SYSTEM');
        addAgentLog(agent, response.error || 'Gateway error', 'error');
      }
    } catch (error) {
      console.error('[Terminal] Gateway error:', error);
      const errorMsg = error instanceof Error ? error.message : 'An unexpected error occurred';
      addChatMessage('agent', `Error: ${errorMsg}\n\nTip: Make sure the backend is running.`, 'SYSTEM');
      addAgentLog(agent, 'Request failed', 'error');
    }

    setProcessing(false);
  }, [gatewaySessionId, addAgentLog, addChatMessage, updateLastAgentMessage, solanaWallet, setProcessing, createConversation, setGatewaySessionId, walletAddress, setWallet, activeConversationId]);

  // Check if agent response contains a transaction that needs signing
  const checkForPendingTransaction = useCallback((data: any): boolean => {
    // Look for Jupiter trade transaction in tool results
    if (Array.isArray(data)) {
      for (const toolResult of data) {
        if (toolResult.result?.requiresWalletSign && toolResult.result?.transaction?.base64) {
          const trade = toolResult.result.trade || {};
          setPendingTx({
            transaction: toolResult.result.transaction.base64,
            description: `${trade.direction || 'BUY'} ${trade.amount || ''} on ${trade.market || 'market'}`,
            marketTitle: trade.market || 'Prediction Market',
            amount: trade.amount || '',
          });
          return true;
        }
      }
    }
    return false;
  }, []);

  // Sign and submit pending transaction
  const signAndSubmitTransaction = useCallback(async () => {
    if (!pendingTx || !solanaWallet) {
      addChatMessage('agent', 'No wallet connected. Please connect your Solana wallet first.', 'SYSTEM');
      return;
    }

    // Demo mode - record prediction to calibration program on devnet
    if (isDemo) {
      addAgentLog('TRADER', 'Recording prediction to calibration program...', 'info');
      addChatMessage('agent', '🔐 Signing prediction on Solana Devnet (Calibration Program)...', 'TRADER');

      try {
        const connection = new Connection(DEVNET_RPC, 'confirmed');

        // Use wallet adapter signTransaction for demo mode
        if (!walletSignTransaction || !walletAddress) {
          throw new Error('Wallet not connected. Please connect your wallet first.');
        }

        // Parse direction from description (e.g., "BUY YES on market" or "SELL NO")
        const descLower = pendingTx.description.toLowerCase();
        const direction: 'yes' | 'no' = descLower.includes('no') ? 'no' : 'yes';

        // Generate a market ID from the market title
        const marketId = `terminal_${pendingTx.marketTitle.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase().slice(0, 32)}`;

        // Default probability based on direction (YES = 0.7, NO = 0.3)
        const probability = direction === 'yes' ? 0.7 : 0.3;

        // First, call calibration API to build the record transaction
        const res = await fetch('/api/v2/calibration', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'record',
            authority: walletAddress,
            marketId,
            predictedProbability: probability,
            direction,
            category: 0,
          }),
        });

        const json = await res.json();

        if (!json.success) {
          // If forecaster not initialized, initialize first
          if (json.code === 'NOT_INITIALIZED') {
            addAgentLog('TRADER', 'Initializing forecaster account...', 'info');

            const initRes = await fetch('/api/v2/calibration', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'initialize',
                authority: walletAddress,
              }),
            });

            const initJson = await initRes.json();
            if (initJson.success) {
              const initTxBytes = Buffer.from(initJson.data.transaction, 'base64');
              const initTransaction = Transaction.from(initTxBytes);

              // CRITICAL: Get fresh blockhash to avoid "Blockhash not found" error
              const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
              initTransaction.recentBlockhash = blockhash;

              try {
                const signedInitTx = await walletSignTransaction(initTransaction);
                const initSig = await connection.sendRawTransaction(
                  (signedInitTx as Transaction).serialize(),
                  { skipPreflight: false, preflightCommitment: 'confirmed' }
                );
                await connection.confirmTransaction({
                  signature: initSig,
                  blockhash,
                  lastValidBlockHeight,
                }, 'confirmed');
                addAgentLog('TRADER', `Forecaster initialized: ${initSig.slice(0, 16)}...`, 'success');
              } catch (initErr) {
                // Handle "account already in use" - forecaster exists but RPC cache was stale
                const errMsg = initErr instanceof Error ? initErr.message : String(initErr);
                if (errMsg.includes('already in use') || errMsg.includes('0x0')) {
                  addAgentLog('TRADER', 'Forecaster already exists (RPC cache was stale)', 'info');
                } else {
                  throw initErr;
                }
              }
            } else if (initJson.code === 'ALREADY_INITIALIZED') {
              addAgentLog('TRADER', 'Forecaster already initialized', 'info');
            }

            // Wait for RPC propagation then retry record
            await new Promise(resolve => setTimeout(resolve, 2000));
            const retryRes = await fetch('/api/v2/calibration', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'record',
                authority: walletAddress,
                marketId,
                predictedProbability: probability,
                direction,
                category: 0,
              }),
            });
            const retryJson = await retryRes.json();
            if (!retryJson.success) {
              throw new Error(retryJson.error || 'Failed to build record transaction');
            }
            Object.assign(json, retryJson);
          } else {
            throw new Error(json.error || 'Failed to build transaction');
          }
        }

        // Build and sign record transaction
        const txBytes = Buffer.from(json.data.transaction, 'base64');
        const transaction = Transaction.from(txBytes);

        // CRITICAL: Get fresh blockhash to avoid "Blockhash not found" error
        const { blockhash: recordBlockhash, lastValidBlockHeight: recordBlockHeight } = await connection.getLatestBlockhash('confirmed');
        transaction.recentBlockhash = recordBlockhash;

        const signedTx = await walletSignTransaction(transaction);

        // Submit to devnet
        const signature = await connection.sendRawTransaction(
          (signedTx as Transaction).serialize(),
          { skipPreflight: false, preflightCommitment: 'confirmed' }
        );

        addAgentLog('TRADER', `Transaction submitted: ${signature.slice(0, 16)}...`, 'info');

        // Confirm transaction with proper blockhash
        await connection.confirmTransaction({
          signature,
          blockhash: recordBlockhash,
          lastValidBlockHeight: recordBlockHeight,
        }, 'confirmed');

        // Get all explorer links
        const explorerLinks = getAllExplorerUrls(signature, 'devnet');
        const linksText = explorerLinks.map(l => `• [${l.name}](${l.url})`).join('\n');

        addChatMessage('agent', `✅ Prediction recorded on Calibration Program!\n\n${pendingTx.description}\n\n**View transaction:**\n${linksText}`, 'TRADER', 'BULLISH');
        addAgentLog('TRADER', `Prediction confirmed: ${signature.slice(0, 16)}...`, 'success');

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Transaction failed';
        addChatMessage('agent', `❌ Prediction failed: ${errorMsg}`, 'TRADER', 'ERROR');
        addAgentLog('TRADER', `Prediction failed: ${errorMsg}`, 'error');
      } finally {
        setPendingTx(null);
      }
      return;
    }

    addAgentLog('TRADER', 'Signing transaction...', 'info');
    addChatMessage('agent', '🔐 Signing transaction with your wallet...', 'TRADER');

    try {
      // In production mode, use window wallet signing
      const walletFuncs = (window as Window & {
        __BERIGHT_WALLET_FUNCS__?: {
          signTransaction?: (tx: Uint8Array) => Promise<Uint8Array>;
        };
      }).__BERIGHT_WALLET_FUNCS__;

      if (!walletFuncs?.signTransaction) {
        throw new Error('Wallet signing not available');
      }

      // Decode and sign the transaction
      const txBytes = Buffer.from(pendingTx.transaction, 'base64');
      const signedTx = await walletFuncs.signTransaction(txBytes);

      // Submit to Solana
      const response = await fetch('/api/v2/jupiter/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signedTransaction: Buffer.from(signedTx).toString('base64'),
        }),
      });

      const result = await response.json();

      if (result.success) {
        addChatMessage('agent', `✅ Trade executed successfully!\n\nSignature: ${result.signature}\n\n${pendingTx.description}`, 'TRADER', 'BULLISH');
        addAgentLog('TRADER', `Trade executed: ${result.signature.slice(0, 16)}...`, 'success');

        // Refresh portfolio after trade
        setTimeout(() => fetchData(true), 2000);
      } else {
        throw new Error(result.error || 'Transaction failed');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Transaction failed';
      addChatMessage('agent', `❌ Trade failed: ${errorMsg}`, 'TRADER', 'ERROR');
      addAgentLog('TRADER', `Trade failed: ${errorMsg}`, 'error');
    } finally {
      setPendingTx(null);
    }
  }, [pendingTx, solanaWallet, isDemo, addAgentLog, addChatMessage, fetchData, walletSignTransaction, walletAddress]);

  // Auto-sign when pendingTx is set (agent-driven execution)
  useEffect(() => {
    if (pendingTx && solanaWallet) {
      // Auto-execute after brief delay to show user what's happening
      const timer = setTimeout(() => {
        signAndSubmitTransaction();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [pendingTx, solanaWallet, signAndSubmitTransaction]);

  // Calculate latency display
  const latencyDisplay = useMemo(() => {
    return signalsConnected ? '12ms' : '--';
  }, [signalsConnected]);

  // Loading state
  if (!ready) {
    return (
      <div className={styles.loadingScreen}>
        <BrandLogo size={56} className={styles.loadingLogo} />
        <div className={styles.loadingText}>beright AI</div>
        <div className={styles.loadingSubtext}>Initializing...</div>
      </div>
    );
  }

  // Connect prompt
  if (!authenticated) {
    return (
      <div className={styles.connectScreen}>
        <div className={styles.connectLogo}>
          <BrandLogo size={48} />
          <span className={styles.connectLogoText}>beright AI</span>
        </div>
        <div className={styles.connectText}>
          Connect your wallet to access the AI Terminal
        </div>
        <button className={styles.connectButton} onClick={login}>
          Connect Wallet
        </button>
      </div>
    );
  }

  // Render content based on active tab
  const renderContent = () => {
    if (activeTab === 'MARKETS') {
      return <MarketsPage />;
    }

    if (activeTab === 'AGENTS') {
      return <AgentsPage onlineAgents={onlineAgents} />;
    }

    if (activeTab === 'LOGS') {
      return <LogsPage logs={agentLogs} />;
    }

    // Main BERIGHT view - three column layout: conversations | chat | portfolio
    return (
      <main className={styles.mainGridThreeCol} data-tour="terminal-main">
        {/* Left Panel - Conversation History */}
        <aside className={styles.panelHistory}>
          <ConversationSidebar
            walletAddress={walletAddress}
            onConversationSelect={setActiveConversation}
          />
        </aside>

        {/* Center Panel - Chat Interface */}
        <section className={styles.panelChat}>
          <ChatInterface
            messages={displayMessages}
            isProcessing={isProcessing}
            isLoadingConversation={isLoadingConversation}
            loadingError={loadingError}
          />
        </section>

        {/* Right Panel - Portfolio */}
        <aside className={styles.panelLast} data-tour="portfolio-sidebar">
          <PortfolioSidebar
            signals={signals}
            portfolioValue={portfolioData?.portfolioValue}
            dailyChange={portfolioData?.dailyChange}
            dailyChangePercent={portfolioData?.dailyChangePct}
          />
        </aside>
      </main>
    );
  };

  return (
    <div
      className={styles.terminalPage}
      style={{ ['--app-header-offset' as any]: authenticated ? '72px' : '0px' }}
    >
      {/* Onboarding Tour - Only in demo mode */}
      {isDemo && authenticated && tourSteps.length > 0 && (
        <OnboardingTour
          steps={tourSteps}
          storageKey="beright-terminal-tour-completed"
          onComplete={() => addAgentLog('SYSTEM', 'Welcome aboard! Start exploring.', 'success')}
          forceShow={false} // Set to true to always show tour for testing
          debug={true}
        />
      )}

      {/* Restart Tour Button - Only in demo mode */}
      {isDemo && authenticated && (
        <RestartTourButton
          storageKey="beright-terminal-tour-completed"
          ariaLabel="Restart terminal tour"
        />
      )}

      {/* Top Bar */}
      <header className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <NavPill activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
        <div className={styles.topBarRight}>
          <button
            onClick={() => fetchData()}
            disabled={isLoading}
            className={styles.refreshBtn}
            title="Refresh data"
            data-tour="markets-tab"
          >
            {isLoading ? '⟳' : '↻'}
          </button>
          <span>LATENCY: {latencyDisplay}</span>
          <PulseIndicator state={signalsConnected ? 'active' : 'idle'} />
        </div>

        {/* Mobile actions (shown via CSS breakpoints) */}
        {activeTab === 'BERIGHT' && (
          <div className={styles.topBarMobileActions} aria-label="Terminal panels">
            <button
              type="button"
              className={styles.mobileActionBtn}
              onClick={() => setMobileSheet((prev) => (prev === 'history' ? null : 'history'))}
              aria-label="Open conversation history"
            >
              <PanelLeft size={18} />
            </button>
            <button
              type="button"
              className={styles.mobileActionBtn}
              onClick={() => setMobileSheet((prev) => (prev === 'portfolio' ? null : 'portfolio'))}
              aria-label="Open portfolio panel"
            >
              <PanelRight size={18} />
            </button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {renderContent()}
      </div>

      {/* Mobile sheet overlay (conversation history / portfolio). Only relevant on BERIGHT tab. */}
      {activeTab === 'BERIGHT' && mobileSheet && (
        <div className={styles.mobileSheetLayer} role="dialog" aria-modal="true">
          <button
            type="button"
            className={styles.mobileSheetBackdrop}
            onClick={() => setMobileSheet(null)}
            aria-label="Close panel"
          />
          <div className={styles.mobileSheet}>
            <div className={styles.mobileSheetHeader}>
              <span className={styles.mobileSheetTitle}>
                {mobileSheet === 'history' ? 'Conversations' : 'Portfolio'}
              </span>
              <button
                type="button"
                className={styles.mobileSheetClose}
                onClick={() => setMobileSheet(null)}
                aria-label="Close panel"
              >
                <X size={18} />
              </button>
            </div>
            <div className={styles.mobileSheetBody}>
              {mobileSheet === 'history' ? (
                <ConversationSidebar
                  walletAddress={walletAddress}
                  onConversationSelect={(id) => {
                    setActiveConversation(id);
                    setMobileSheet(null);
                  }}
                />
              ) : (
                <PortfolioSidebar
                  signals={signals}
                  portfolioValue={portfolioData?.portfolioValue}
                  dailyChange={portfolioData?.dailyChange}
                  dailyChangePercent={portfolioData?.dailyChangePct}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* CLI Input - Only show on BERIGHT (chat) tab */}
      {activeTab === 'BERIGHT' && (
        <div data-tour="cli-input">
          <CLIInput onCommand={processCommand} isProcessing={isProcessing} />
        </div>
      )}
    </div>
  );
}
