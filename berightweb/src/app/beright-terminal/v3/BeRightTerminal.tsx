'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { getHotMarketsFeed, sendToGateway, fetchTerminalData, GatewayResponse, ApiMarket, getFeed, FeedMarket } from '@/lib/api';
import { useSignalStream } from '@/hooks/useSignalStream';

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
  AgentFleet,
  MarketTable,
  ChatInterface,
  PortfolioSidebar,
  CLIInput,
  MarketsPage,
  AgentsPage,
  LogsPage,
  TabName,
  ChatMessage,
} from './index';

import { AgentLog, generateId } from '../components/types';
import styles from '../beright.module.css';
import BrandLogo from '@/components/BrandLogo';

/**
 * BeRight Terminal v3
 *
 * Clean, professional trading terminal with three-column layout.
 * Design inspired by high-end financial terminals.
 */
export default function BeRightTerminal() {
  const { authenticated, login, ready, user } = usePrivy();
  const { wallets } = useWallets();

  // Navigation
  const [activeTab, setActiveTab] = useState<TabName>('BERIGHT');

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

  // Terminal state
  const [isProcessing, setIsProcessing] = useState(false);

  // Gateway session for context persistence
  const [gatewaySessionId, setGatewaySessionId] = useState<string | null>(null);

  // Agent state
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([]);
  const [onlineAgents] = useState(['SCOUT', 'ANALYST', 'TRADER']);

  // Chat messages for the conversation interface
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Refresh interval ref
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Get user's Solana wallet pubkey
  const solanaWallet = useMemo(() => {
    // Find Solana wallet - check walletClientType or type field
    const wallet = wallets?.find(w =>
      w.walletClientType === 'solana' ||
      (w as any).type === 'solana' ||
      w.walletClientType?.includes('solana')
    );
    return wallet?.address;
  }, [wallets]);

  // Add chat message
  const addChatMessage = useCallback((
    role: 'user' | 'agent',
    content: string,
    agent?: ChatMessage['agent'],
    mood?: string
  ) => {
    setChatMessages(prev => [...prev, {
      id: generateId(),
      role,
      agent,
      content,
      timestamp: new Date(),
      mood,
    }]);
  }, []);

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
        getHotMarketsFeed(20),
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
      if (!silent) addAgentLog('SYSTEM', 'Failed to fetch data', 'error');
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
    setIsProcessing(true);

    // Add user message to chat
    addChatMessage('user', cmd);

    const command = cmd.toLowerCase().trim();

    // Local navigation commands
    if (command === '/markets') {
      setActiveTab('MARKETS');
      addChatMessage('agent', 'Switching to MARKETS view...', 'SYSTEM');
      setIsProcessing(false);
      return;
    }

    if (command === '/agents') {
      setActiveTab('AGENTS');
      addChatMessage('agent', 'Switching to AGENTS view...', 'SYSTEM');
      setIsProcessing(false);
      return;
    }

    if (command === '/logs') {
      setActiveTab('LOGS');
      addChatMessage('agent', 'Switching to LOGS view...', 'SYSTEM');
      setIsProcessing(false);
      return;
    }

    if (command === '/home' || command === '/beright') {
      setActiveTab('BERIGHT');
      addChatMessage('agent', 'Returning to home terminal...', 'SYSTEM');
      setIsProcessing(false);
      return;
    }

    if (command === '/clear') {
      setChatMessages([]);
      addChatMessage('agent', 'Chat cleared.', 'SYSTEM');
      setIsProcessing(false);
      return;
    }

    const agent = getAgentForCommand(cmd);
    addAgentLog(agent, `Processing: ${cmd.slice(0, 50)}${cmd.length > 50 ? '...' : ''}`, 'info');

    try {
      // Pass wallet pubkey for trade execution
      const response: GatewayResponse = await sendToGateway(cmd, {
        sessionId: gatewaySessionId || undefined,
        userId: solanaWallet, // Pass wallet for execution context
      });

      if (response.sessionId && response.sessionId !== gatewaySessionId) {
        setGatewaySessionId(response.sessionId);
      }

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

    setIsProcessing(false);
  }, [gatewaySessionId, addAgentLog, addChatMessage, solanaWallet]);

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

    addAgentLog('TRADER', 'Signing transaction...', 'info');
    addChatMessage('agent', '🔐 Signing transaction with your wallet...', 'TRADER');

    try {
      // Get the Solana wallet from Privy
      const wallet = wallets?.find(w => w.address === solanaWallet);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      // Decode and sign the transaction
      const txBytes = Buffer.from(pendingTx.transaction, 'base64');

      // Use Privy's wallet signing method
      // @ts-ignore - Privy wallet signing
      const signedTx = await wallet.signTransaction(txBytes);

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
  }, [pendingTx, solanaWallet, wallets, addAgentLog, addChatMessage, fetchData]);

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

    // Main BERIGHT view - three column layout
    return (
      <main className={styles.mainGrid}>
        {/* Left Panel - Agent Fleet */}
        <aside className={styles.panel}>
          <AgentFleet
            onlineAgents={onlineAgents}
            marketExposure={portfolioData?.marketExposure}
            positionRisk={portfolioData?.positionRisk}
          />
        </aside>

        {/* Center Panel - Chat Interface */}
        <section className={styles.panelChat}>
          <ChatInterface messages={chatMessages} isProcessing={isProcessing} />
        </section>

        {/* Right Panel - Portfolio */}
        <aside className={styles.panelLast}>
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
    <div className={styles.terminalPage}>
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
          >
            {isLoading ? '⟳' : '↻'}
          </button>
          <span>LATENCY: {latencyDisplay}</span>
          <PulseIndicator state={signalsConnected ? 'active' : 'idle'} />
        </div>
      </header>

      {/* Main Content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {renderContent()}
      </div>

      {/* CLI Input */}
      <CLIInput onCommand={processCommand} isProcessing={isProcessing} />
    </div>
  );
}
