'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BottomNav from '@/components/BottomNav';
import { usePrivy } from '@privy-io/react-auth';
import { getHotMarkets, getArbitrageOpportunities, sendToGateway, GatewayResponse, ApiMarket, ApiArbitrage } from '@/lib/api';
import { useSignalStream } from '@/hooks/useSignalStream';

// Modular components
import {
  MatrixRain,
  MarketTicker,
  BootSequence,
  AgentPanel,
  TerminalInterface,
  MarketGrid,
  ArbGrid,
  SignalsFeed,
  PortfolioPanel,
  RiskPanel,
  ViewMode,
  AgentLog,
  TerminalLine,
  MarketTick,
  generateId,
} from './components';

import styles from './terminal.module.css';

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  BERIGHT AI TERMINAL v2.0.0 - MODULAR ARCHITECTURE                       ║
// ║  Aesthetic: Matrix meets Blade Runner trading terminal                   ║
// ║  Now with Portfolio & Risk Management panels                             ║
// ╚══════════════════════════════════════════════════════════════════════════╝

export default function BeRightTerminal() {
  const { authenticated, login, ready } = usePrivy();

  // Boot state
  const [isBooting, setIsBooting] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('terminal');

  // Signal intelligence stream (SSE)
  const { signals, connected: signalsConnected, alertCount, clearAlerts } = useSignalStream();

  // Data
  const [markets, setMarkets] = useState<ApiMarket[]>([]);
  const [arbOpportunities, setArbOpportunities] = useState<ApiArbitrage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Terminal state
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Gateway session for context persistence
  const [gatewaySessionId, setGatewaySessionId] = useState<string | null>(null);

  // Agent state
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([]);
  const [onlineAgents, setOnlineAgents] = useState(['SCOUT', 'ANALYST', 'TRADER']);

  // Market ticker data (real data from API)
  const tickerMarkets = useMemo((): MarketTick[] => {
    return markets.slice(0, 8).map((m, i) => ({
      id: m.id || `${i}`,
      title: m.title,
      price: m.yesPct,
      change: 0,
      platform: m.platform,
    }));
  }, [markets]);

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

  // Add terminal line
  const addTerminalLine = useCallback((type: TerminalLine['type'], content: string) => {
    setTerminalLines(prev => [...prev, {
      id: generateId(),
      type,
      content,
      timestamp: new Date(),
    }]);
  }, []);

  // Fetch data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    addAgentLog('SCOUT', 'Initiating market scan...', 'info');

    try {
      const [hotData, arbData] = await Promise.all([
        getHotMarkets(20),
        getArbitrageOpportunities(),
      ]);

      if (hotData.markets?.length > 0) {
        setMarkets(hotData.markets);
        addAgentLog('SCOUT', `Found ${hotData.markets.length} active markets`, 'success');
      }

      if (arbData.opportunities?.length > 0) {
        setArbOpportunities(arbData.opportunities);
        addAgentLog('ANALYST', `Detected ${arbData.opportunities.length} arbitrage opportunities`, 'success');
      } else {
        addAgentLog('ANALYST', 'No arbitrage opportunities above threshold', 'info');
      }
    } catch (error) {
      addAgentLog('SYSTEM', 'Failed to fetch market data', 'error');
    }

    setIsLoading(false);
  }, [addAgentLog]);

  // Initial data fetch
  useEffect(() => {
    if (!isBooting && authenticated) {
      fetchData();
    }
  }, [isBooting, authenticated, fetchData]);

  // Determine which agent handles command
  const getAgentForCommand = (text: string): AgentLog['agent'] => {
    const lower = text.toLowerCase();
    if (lower.startsWith('/hot') || lower.startsWith('/scan') || lower.startsWith('/alpha')) return 'SCOUT';
    if (lower.startsWith('/research') || lower.startsWith('/odds') || lower.startsWith('/intelligence') || lower.startsWith('/analyze')) return 'ANALYST';
    if (lower.startsWith('/arb')) return 'ANALYST';
    if (lower.startsWith('/whale') || lower.startsWith('/track')) return 'SCOUT';
    if (lower.startsWith('/trade') || lower.startsWith('/buy') || lower.startsWith('/sell') || lower.startsWith('/kalshi') || lower.startsWith('/dflow')) return 'TRADER';
    if (lower.startsWith('/portfolio') || lower.startsWith('/risk')) return 'TRADER';
    return 'ANALYST';
  };

  // Process terminal command
  const processCommand = useCallback(async (cmd: string) => {
    addTerminalLine('input', cmd);
    setIsProcessing(true);

    const command = cmd.toLowerCase().trim();

    // LOCAL COMMANDS
    if (command === '/clear' || command === 'clear') {
      setTerminalLines([]);
      setIsProcessing(false);
      return;
    }

    if (command === '/agents') {
      setViewMode('agents');
      addTerminalLine('system', 'Switching to AGENT_NETWORK view...');
      setIsProcessing(false);
      return;
    }

    if (command === '/signals') {
      setViewMode('signals');
      clearAlerts();
      addTerminalLine('system', 'Switching to SIGNAL_INTELLIGENCE feed...');
      addTerminalLine('data', `${signals.length} signals loaded | ${signalsConnected ? 'LIVE feed active' : 'Connecting...'}`);
      setIsProcessing(false);
      return;
    }

    if (command === '/markets') {
      setViewMode('markets');
      addTerminalLine('system', 'Switching to MARKETS view...');
      setIsProcessing(false);
      return;
    }

    if (command === '/portfolio') {
      setViewMode('portfolio');
      addTerminalLine('system', 'Switching to PORTFOLIO view...');
      setIsProcessing(false);
      return;
    }

    if (command === '/risk') {
      setViewMode('risk');
      addTerminalLine('system', 'Switching to RISK_MANAGEMENT view...');
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
        const lines = response.text.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith('═') || trimmed.startsWith('─') || trimmed.startsWith('━')) {
            addTerminalLine('system', trimmed);
          } else if (trimmed.startsWith('✅') || trimmed.startsWith('✓') || trimmed.includes('SUCCESS')) {
            addTerminalLine('success', trimmed);
          } else if (trimmed.startsWith('❌') || trimmed.startsWith('✗') || trimmed.includes('ERROR') || trimmed.includes('Failed')) {
            addTerminalLine('error', trimmed);
          } else if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.includes(': http')) {
            const urlMatch = trimmed.match(/(https?:\/\/[^\s]+)/);
            if (urlMatch) {
              addTerminalLine('link', `→ ${urlMatch[1]}`);
            } else {
              addTerminalLine('data', trimmed);
            }
          } else if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*') || /^\d+\./.test(trimmed)) {
            addTerminalLine('data', trimmed);
          } else if (trimmed.startsWith('/')) {
            addTerminalLine('data', trimmed);
          } else {
            addTerminalLine('output', trimmed);
          }
        }

        if (response.data) {
          if (Array.isArray(response.data) && response.data.length > 0 && response.data[0].title) {
            setMarkets(response.data);
          }
          if (response.data.opportunities) {
            setArbOpportunities(response.data.opportunities);
          }
        }

        addAgentLog(agent, `Response received (${response.mood || 'NEUTRAL'})`, 'success');
      } else {
        addTerminalLine('error', response.error || 'Gateway request failed');
        addAgentLog(agent, 'Gateway error', 'error');
      }
    } catch (error) {
      console.error('[Terminal] Gateway error:', error);
      addTerminalLine('error', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      addTerminalLine('data', 'Tip: Make sure beright-ts backend is running on port 3001');
      addAgentLog(agent, 'Request failed', 'error');
    }

    setIsProcessing(false);
  }, [gatewaySessionId, signals, signalsConnected, clearAlerts, addTerminalLine, addAgentLog]);

  // Boot complete handler
  const handleBootComplete = useCallback(() => {
    setIsBooting(false);
    addTerminalLine('system', 'BeRight AI Terminal v2.0 initialized. Type /help for commands.');
    addTerminalLine('data', 'New: /portfolio and /risk commands for portfolio management.');
  }, [addTerminalLine]);

  // Show loading while checking auth
  if (!ready) {
    return (
      <div className={styles.nexusPage} style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <MatrixRain />
        <div style={{ zIndex: 100, color: 'var(--nx-cyan)', fontFamily: 'monospace' }}>
          INITIALIZING...
        </div>
      </div>
    );
  }

  // Show connect prompt if not authenticated
  if (!authenticated) {
    return (
      <div className={styles.nexusPage} style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px',
        padding: '20px'
      }}>
        <MatrixRain />
        <div style={{ zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
          <div style={{ color: 'var(--nx-cyan)', fontSize: '24px' }}>◉ BERIGHT TERMINAL</div>
          <div style={{ color: 'var(--nx-text-dim)', textAlign: 'center' }}>
            Connect your wallet to access the AI Terminal
          </div>
          <button
            onClick={login}
            style={{
              padding: '14px 32px',
              background: 'linear-gradient(135deg, #00C2FF 0%, #10B981 100%)',
              border: 'none',
              borderRadius: '12px',
              color: '#000',
              fontWeight: '600',
              fontSize: '16px',
              cursor: 'pointer',
              fontFamily: 'inherit'
            }}
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  // Boot sequence
  if (isBooting) {
    return (
      <div className={styles.nexusPage}>
        <MatrixRain />
        <BootSequence onComplete={handleBootComplete} />
      </div>
    );
  }

  // View mode buttons
  const viewButtons: Array<{ mode: ViewMode; label: string; icon: string }> = [
    { mode: 'terminal', label: 'TERMINAL', icon: '▸' },
    { mode: 'markets', label: 'MARKETS', icon: '◈' },
    { mode: 'agents', label: 'AGENTS', icon: '◉' },
    { mode: 'intel', label: 'INTEL', icon: '⚡' },
    { mode: 'signals', label: 'SIGNALS', icon: '◉' },
    { mode: 'portfolio', label: 'PORTFOLIO', icon: '📊' },
    { mode: 'risk', label: 'RISK', icon: '⚠' },
  ];

  return (
    <div className={styles.nexusPage}>
      <MatrixRain />

      {/* Scan Lines Overlay */}
      <div className={styles.scanlines} />
      <div className={styles.vignette} />

      {/* Status Bar */}
      <header className={styles.statusBar}>
        <div className={styles.statusLeft}>
          <span className={styles.nexusLogo}>◈ BERIGHT AI</span>
          <span className={styles.statusDivider}>│</span>
          <span className={styles.connectionStatus}>
            <span className={`${styles.statusDot} ${styles.statusDotOnline}`} />
            CONNECTED
          </span>
        </div>
        <div className={styles.statusCenter}>
          <MarketTicker markets={tickerMarkets} />
        </div>
        <div className={styles.statusRight}>
          <span className={styles.stat}>
            <span className={styles.statIcon}>◈</span>
            <span className={styles.statValue}>{markets.length}</span>
            <span className={styles.statLabel}>MARKETS</span>
          </span>
          <span className={styles.stat}>
            <span className={styles.statIcon}>⚡</span>
            <span className={styles.statValue}>{arbOpportunities.length}</span>
            <span className={styles.statLabel}>ARBS</span>
          </span>
          <span className={`${styles.stat} ${signalsConnected ? styles.signalLive : ''}`}>
            <span className={styles.statIcon} style={{ color: signalsConnected ? '#ff0055' : undefined }}>◉</span>
            <span className={styles.statValue} style={{ color: alertCount > 0 ? '#ff0055' : undefined }}>
              {alertCount > 0 ? alertCount : signals.length}
            </span>
            <span className={styles.statLabel}>{alertCount > 0 ? 'ALERTS' : 'SIGNALS'}</span>
          </span>
        </div>
      </header>

      {/* View Toggle */}
      <nav className={styles.viewToggle}>
        {viewButtons.map(({ mode, label, icon }) => (
          <button
            key={mode}
            className={`${styles.toggleBtn} ${viewMode === mode ? styles.toggleBtnActive : ''}`}
            onClick={() => {
              setViewMode(mode);
              if (mode === 'signals') clearAlerts();
            }}
          >
            {mode === 'signals' ? (
              <span className={styles.signalsNavLabel}>
                {icon} {label}
                {alertCount > 0 && (
                  <span className={styles.signalsAlertBadge}>{alertCount}</span>
                )}
              </span>
            ) : (
              `${icon} ${label}`
            )}
          </button>
        ))}
      </nav>

      {/* Main Content Area */}
      <main className={styles.nexusMain}>
        <AnimatePresence mode="wait">
          {viewMode === 'terminal' && (
            <motion.div
              key="terminal"
              className={styles.splitView}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className={styles.mainPanel}>
                <TerminalInterface
                  lines={terminalLines}
                  onCommand={processCommand}
                  isProcessing={isProcessing}
                />
              </div>
              <div className={styles.sidePanel}>
                <AgentPanel logs={agentLogs} onlineAgents={onlineAgents} />
              </div>
            </motion.div>
          )}

          {viewMode === 'markets' && (
            <motion.div
              key="markets"
              className={styles.fullPanel}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className={styles.panelHeaderBar}>
                <span className={styles.panelIcon}>◈</span>
                <span className={styles.panelTitle}>LIVE_MARKETS</span>
                <span className={styles.panelCount}>{markets.length} ACTIVE</span>
                <button className={styles.refreshBtn} onClick={fetchData} disabled={isLoading}>
                  {isLoading ? '↻ LOADING...' : '↻ REFRESH'}
                </button>
              </div>
              <MarketGrid markets={markets} />
            </motion.div>
          )}

          {viewMode === 'agents' && (
            <motion.div
              key="agents"
              className={`${styles.fullPanel} ${styles.agentsView}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <AgentPanel logs={agentLogs} onlineAgents={onlineAgents} />
            </motion.div>
          )}

          {viewMode === 'intel' && (
            <motion.div
              key="intel"
              className={styles.fullPanel}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className={styles.panelHeaderBar}>
                <span className={styles.panelIcon}>⚡</span>
                <span className={styles.panelTitle}>ARBITRAGE_INTEL</span>
                <span className={styles.panelCount}>{arbOpportunities.length} SIGNALS</span>
              </div>
              <ArbGrid opportunities={arbOpportunities} />
            </motion.div>
          )}

          {viewMode === 'signals' && (
            <motion.div
              key="signals"
              className={styles.fullPanel}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <SignalsFeed
                signals={signals}
                connected={signalsConnected}
                alertCount={alertCount}
                clearAlerts={clearAlerts}
              />
            </motion.div>
          )}

          {viewMode === 'portfolio' && (
            <motion.div
              key="portfolio"
              className={styles.fullPanel}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <PortfolioPanel />
            </motion.div>
          )}

          {viewMode === 'risk' && (
            <motion.div
              key="risk"
              className={styles.fullPanel}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <RiskPanel />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  );
}
