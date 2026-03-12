'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { getHotMarkets, getArbitrageOpportunities, sendToGateway, GatewayResponse, ApiMarket } from '@/lib/api';
import { useSignalStream } from '@/hooks/useSignalStream';

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
  const { authenticated, login, ready } = usePrivy();

  // Navigation
  const [activeTab, setActiveTab] = useState<TabName>('BERIGHT');

  // Signal intelligence stream (SSE)
  const { signals, connected: signalsConnected } = useSignalStream();

  // Data
  const [markets, setMarkets] = useState<ApiMarket[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Terminal state
  const [isProcessing, setIsProcessing] = useState(false);

  // Gateway session for context persistence
  const [gatewaySessionId, setGatewaySessionId] = useState<string | null>(null);

  // Agent state
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([]);
  const [onlineAgents] = useState(['SCOUT', 'ANALYST', 'TRADER']);

  // Chat messages for the conversation interface
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

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

  // Fetch data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    addAgentLog('SCOUT', 'Initiating market scan...', 'info');

    try {
      const [hotData] = await Promise.all([
        getHotMarkets(20),
        getArbitrageOpportunities(),
      ]);

      if (hotData.markets?.length > 0) {
        setMarkets(hotData.markets);
        addAgentLog('SCOUT', `Found ${hotData.markets.length} active markets`, 'success');
      }
    } catch (error) {
      addAgentLog('SYSTEM', 'Failed to fetch market data', 'error');
    }

    setIsLoading(false);
  }, [addAgentLog]);

  // Initial data fetch
  useEffect(() => {
    if (authenticated) {
      fetchData();
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
      const response: GatewayResponse = await sendToGateway(cmd, {
        sessionId: gatewaySessionId || undefined,
      });

      if (response.sessionId && response.sessionId !== gatewaySessionId) {
        setGatewaySessionId(response.sessionId);
      }

      if (response.success) {
        // Add agent response to chat
        addChatMessage('agent', response.text, agent, response.mood);
        addAgentLog(agent, `Response received (${response.mood || 'NEUTRAL'})`, 'success');

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
  }, [gatewaySessionId, addAgentLog, addChatMessage]);

  // Calculate latency display
  const latencyDisplay = useMemo(() => {
    return signalsConnected ? '12ms' : '--';
  }, [signalsConnected]);

  // Loading state
  if (!ready) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingText}>INITIALIZING...</div>
      </div>
    );
  }

  // Connect prompt
  if (!authenticated) {
    return (
      <div className={styles.connectScreen}>
        <div className={styles.connectLogo}>
          <BrandLogo size={48} />
          <span className={styles.connectLogoText}>BeRight</span>
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
      return <MarketsPage markets={markets} />;
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
          <AgentFleet onlineAgents={onlineAgents} />
        </aside>

        {/* Center Panel - Chat Interface */}
        <section className={styles.panelChat}>
          <ChatInterface messages={chatMessages} isProcessing={isProcessing} />
        </section>

        {/* Right Panel - Portfolio */}
        <aside className={styles.panelLast}>
          <PortfolioSidebar signals={signals} />
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
          <span className={styles.systemMode}>SYS.OP.MODE: AUTONOMOUS</span>
        </div>
        <div className={styles.topBarRight}>
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
