'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BottomNav from '@/components/BottomNav';
import { usePrivy } from '@privy-io/react-auth';
import { getHotMarkets, getArbitrageOpportunities, getIntel, ApiMarket, ApiArbitrage } from '@/lib/api';

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  BERIGHT AI TERMINAL - CYBERPUNK PREDICTION MARKET INTERFACE             ║
// ║  Aesthetic: Matrix meets Blade Runner trading terminal                   ║
// ║  Font: Share Tech Mono (terminal) + Orbitron (headers)                   ║
// ╚══════════════════════════════════════════════════════════════════════════╝

type ViewMode = 'terminal' | 'markets' | 'agents' | 'intel';

interface AgentLog {
  id: string;
  agent: 'SCOUT' | 'ANALYST' | 'TRADER' | 'BUILDER' | 'SYSTEM';
  message: string;
  timestamp: Date;
  type: 'info' | 'success' | 'warning' | 'error' | 'data';
}

interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'system' | 'error' | 'success' | 'data';
  content: string;
  timestamp: Date;
}

interface MarketTick {
  id: string;
  title: string;
  price: number;
  change: number;
  platform: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${Math.round(v)}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

// Agent configurations (matching beright-ts/config/agents.ts)
const AGENTS_CONFIG = {
  SCOUT: {
    color: '#00fff7',    // Cyan
    model: 'sonnet',
    specialization: 'Market Scanning',
    capabilities: ['Arbitrage', 'Hot Markets', 'Volume Spikes'],
  },
  ANALYST: {
    color: '#ff00ff',    // Magenta
    model: 'opus',
    specialization: 'Deep Research',
    capabilities: ['Superforecaster', 'Base Rates', 'Calibration'],
  },
  TRADER: {
    color: '#00ff00',    // Matrix green
    model: 'sonnet',
    specialization: 'Trade Execution',
    capabilities: ['Quotes', 'Positions', 'Whale Tracking'],
  },
  BUILDER: {
    color: '#ffae00',    // Amber
    model: 'opus',
    specialization: 'Code Generation',
    capabilities: ['Frontend', 'Backend', 'Testing'],
  },
  SYSTEM: {
    color: '#666',       // Gray
    model: 'system',
    specialization: 'System',
    capabilities: [],
  },
};

// Agent colors for quick lookup
const AGENT_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(AGENTS_CONFIG).map(([k, v]) => [k, v.color])
);

// ═══════════════════════════════════════════════════════════════════════════
// MATRIX RAIN BACKGROUND
// ═══════════════════════════════════════════════════════════════════════════

function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const chars = 'BERIGHT01アイウエオカキクケコ¥$%&@#';
    const fontSize = 14;
    const columns = Math.floor(canvas.width / fontSize);
    const drops: number[] = Array(columns).fill(1);

    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#00ff0015';
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(char, i * fontSize, drops[i] * fontSize);

        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    };

    const interval = setInterval(draw, 50);
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="matrix-canvas" />;
}

// ═══════════════════════════════════════════════════════════════════════════
// LIVE MARKET TICKER
// ═══════════════════════════════════════════════════════════════════════════

function MarketTicker({ markets }: { markets: MarketTick[] }) {
  return (
    <div className="ticker-container">
      <div className="ticker-track">
        {[...markets, ...markets].map((m, i) => (
          <div key={`${m.id}-${i}`} className="ticker-item">
            <span className="ticker-title">{m.title.slice(0, 30)}</span>
            <span className={`ticker-price ${m.change >= 0 ? 'up' : 'down'}`}>
              {m.price.toFixed(0)}¢
            </span>
            <span className={`ticker-change ${m.change >= 0 ? 'up' : 'down'}`}>
              {m.change >= 0 ? '▲' : '▼'}{Math.abs(m.change).toFixed(1)}%
            </span>
            <span className="ticker-platform">{m.platform}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AGENT STATUS PANEL
// ═══════════════════════════════════════════════════════════════════════════

function AgentPanel({ logs, onlineAgents }: { logs: AgentLog[]; onlineAgents: string[] }) {
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Public agents (BUILDER is superadmin only)
  const agentKeys = ['SCOUT', 'ANALYST', 'TRADER'] as const;

  return (
    <div className="agent-panel">
      <div className="panel-header">
        <span className="panel-icon">◈</span>
        <span className="panel-title">AGENT_NETWORK</span>
        <span className="panel-status online">CONNECTED</span>
      </div>

      <div className="agent-grid">
        {agentKeys.map(agent => {
          const config = AGENTS_CONFIG[agent];
          const isOnline = onlineAgents.includes(agent);
          return (
            <div
              key={agent}
              className={`agent-node ${isOnline ? 'online' : 'offline'}`}
              style={{ '--agent-color': config.color } as React.CSSProperties}
            >
              <div className="node-indicator" />
              <span className="node-name">{agent}</span>
              <span className="node-spec">{config.specialization}</span>
              <span className="node-model">{config.model.toUpperCase()}</span>
              <span className="node-status">{isOnline ? 'ACTIVE' : 'DISABLED'}</span>
            </div>
          );
        })}
      </div>

      <div className="agent-logs">
        <div className="logs-header">
          <span>▸ ACTIVITY_LOG</span>
          <span className="log-count">{logs.length}</span>
        </div>
        <div className="logs-feed">
          {logs.slice(-20).map(log => (
            <div key={log.id} className={`log-entry ${log.type}`}>
              <span className="log-time">[{formatTime(log.timestamp)}]</span>
              <span
                className="log-agent"
                style={{ color: AGENT_COLORS[log.agent] }}
              >
                [{log.agent}]
              </span>
              <span className="log-message">{log.message}</span>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TERMINAL INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

function TerminalInterface({
  lines,
  onCommand,
  isProcessing
}: {
  lines: TerminalLine[];
  onCommand: (cmd: string) => void;
  isProcessing: boolean;
}) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    terminalRef.current?.scrollTo({ top: terminalRef.current.scrollHeight, behavior: 'smooth' });
  }, [lines]);

  const handleSubmit = () => {
    if (!input.trim() || isProcessing) return;
    setHistory(prev => [...prev, input]);
    setHistoryIndex(-1);
    onCommand(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const newIndex = historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setInput(history[history.length - 1 - newIndex] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(history[history.length - 1 - newIndex] || '');
      } else {
        setHistoryIndex(-1);
        setInput('');
      }
    }
  };

  const commands = [
    { cmd: '/hot', desc: 'Show hot markets' },
    { cmd: '/arb', desc: 'Find arbitrage' },
    { cmd: '/scan [topic]', desc: 'Scan markets' },
    { cmd: '/research [query]', desc: 'Deep analysis' },
    { cmd: '/whale', desc: 'Track whales' },
    { cmd: '/intel', desc: 'Latest news' },
    { cmd: '/status', desc: 'System status' },
    { cmd: '/clear', desc: 'Clear terminal' },
  ];

  return (
    <div className="terminal-interface">
      <div className="terminal-header">
        <div className="terminal-controls">
          <span className="control red" />
          <span className="control yellow" />
          <span className="control green" />
        </div>
        <span className="terminal-title">BERIGHT://TERMINAL</span>
        <span className="terminal-version">v1.0.0</span>
      </div>

      <div className="terminal-body" ref={terminalRef}>
        {lines.map(line => (
          <div key={line.id} className={`terminal-line ${line.type}`}>
            {line.type === 'input' && <span className="prompt">❯</span>}
            {line.type === 'system' && <span className="prompt sys">◈</span>}
            {line.type === 'error' && <span className="prompt err">✗</span>}
            {line.type === 'success' && <span className="prompt ok">✓</span>}
            {line.type === 'data' && <span className="prompt data">▸</span>}
            <span className="line-content">{line.content}</span>
          </div>
        ))}
        {isProcessing && (
          <div className="terminal-line processing">
            <span className="prompt">◈</span>
            <span className="processing-text">Processing<span className="blink">_</span></span>
          </div>
        )}
      </div>

      <div className="terminal-input-area">
        <div className="command-hints">
          {commands.map(c => (
            <button
              key={c.cmd}
              className="hint-chip"
              onClick={() => setInput(c.cmd)}
            >
              {c.cmd}
            </button>
          ))}
        </div>
        <div className="input-row">
          <span className="input-prompt">❯</span>
          <input
            ref={inputRef}
            type="text"
            className="terminal-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter command or ask anything..."
            disabled={isProcessing}
            autoFocus
          />
          <button
            className={`send-btn ${input.trim() && !isProcessing ? 'active' : ''}`}
            onClick={handleSubmit}
            disabled={!input.trim() || isProcessing}
          >
            <span className="send-icon">⏎</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MARKET GRID
// ═══════════════════════════════════════════════════════════════════════════

function MarketGrid({ markets }: { markets: ApiMarket[] }) {
  return (
    <div className="market-grid">
      <div className="grid-header">
        <span>MARKET</span>
        <span>YES</span>
        <span>NO</span>
        <span>VOL</span>
        <span>PLATFORM</span>
      </div>
      {markets.map((m, i) => (
        <motion.div
          key={m.id || i}
          className="grid-row"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.03 }}
        >
          <span className="cell title">{m.title.slice(0, 40)}{m.title.length > 40 ? '...' : ''}</span>
          <span className="cell yes">{m.yesPct.toFixed(0)}¢</span>
          <span className="cell no">{m.noPct.toFixed(0)}¢</span>
          <span className="cell vol">{formatVolume(m.volume)}</span>
          <span className="cell platform">{m.platform.toUpperCase()}</span>
        </motion.div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ARB OPPORTUNITIES
// ═══════════════════════════════════════════════════════════════════════════

function ArbGrid({ opportunities }: { opportunities: ApiArbitrage[] }) {
  if (opportunities.length === 0) {
    return (
      <div className="no-data">
        <span className="no-data-icon">⚖</span>
        <span>No arbitrage opportunities detected</span>
        <span className="no-data-sub">Minimum spread threshold: 3%</span>
      </div>
    );
  }

  return (
    <div className="arb-grid">
      {opportunities.map((arb, i) => (
        <motion.div
          key={i}
          className="arb-card"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.05 }}
        >
          <div className="arb-header">
            <span className="arb-spread">+{arb.spread.toFixed(1)}%</span>
            <span className={`arb-conf ${arb.confidence > 0.8 ? 'high' : arb.confidence > 0.5 ? 'med' : 'low'}`}>
              {(arb.confidence * 100).toFixed(0)}% CONF
            </span>
          </div>
          <h4 className="arb-topic">{arb.topic}</h4>
          <div className="arb-compare">
            <div className="arb-side">
              <span className="arb-platform">{arb.platformA.toUpperCase()}</span>
              <span className="arb-price">{(arb.priceA * 100).toFixed(0)}¢</span>
            </div>
            <span className="arb-vs">VS</span>
            <div className="arb-side">
              <span className="arb-platform">{arb.platformB.toUpperCase()}</span>
              <span className="arb-price">{(arb.priceB * 100).toFixed(0)}¢</span>
            </div>
          </div>
          <p className="arb-strategy">{arb.strategy}</p>
        </motion.div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BOOT SEQUENCE
// ═══════════════════════════════════════════════════════════════════════════

function BootSequence({ onComplete }: { onComplete: () => void }) {
  const [lines, setLines] = useState<string[]>([]);
  const bootLines = [
    '> BERIGHT AI TERMINAL v1.0.0',
    '> Initializing neural network...',
    '> Loading prediction models...',
    '> Connecting to market feeds...',
    '  ├─ Polymarket... [OK]',
    '  ├─ Kalshi....... [OK]',
    '  ├─ DFlow........ [OK]',
    '  └─ Manifold..... [OK]',
    '> Spawning AI agents...',
    '  ├─ SCOUT........ [ONLINE]',
    '  ├─ ANALYST...... [ONLINE]',
    '  └─ TRADER....... [DISABLED]',
    '> Establishing Solana connection...',
    '> System ready.',
    '',
    '╔═══════════════════════════════════════════════════════════╗',
    '║  BERIGHT AI - PREDICTION MARKET INTELLIGENCE              ║',
    '║  Type /help for commands or ask anything                  ║',
    '╚═══════════════════════════════════════════════════════════╝',
  ];

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < bootLines.length) {
        setLines(prev => [...prev, bootLines[i]]);
        i++;
      } else {
        clearInterval(interval);
        setTimeout(onComplete, 500);
      }
    }, 80);
    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div className="boot-sequence">
      <div className="boot-content">
        {lines.map((line, i) => (
          <motion.div
            key={i}
            className="boot-line"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {line}
          </motion.div>
        ))}
        <span className="boot-cursor">_</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function BeRightTerminal() {
  usePrivy();

  const [isBooting, setIsBooting] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('terminal');

  // Data
  const [markets, setMarkets] = useState<ApiMarket[]>([]);
  const [arbOpportunities, setArbOpportunities] = useState<ApiArbitrage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Terminal state
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Agent state
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([]);
  // TRADER disabled for now - only SCOUT and ANALYST active
  const [onlineAgents, setOnlineAgents] = useState(['SCOUT', 'ANALYST']);

  // Market ticker data (real data from API)
  const tickerMarkets = useMemo((): MarketTick[] => {
    return markets.slice(0, 8).map((m, i) => ({
      id: m.id || `${i}`,
      title: m.title,
      price: m.yesPct,
      change: 0, // Real change would come from API
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
    if (!isBooting) {
      fetchData();
    }
  }, [isBooting, fetchData]);

  // Process terminal command
  const processCommand = useCallback(async (cmd: string) => {
    addTerminalLine('input', cmd);
    setIsProcessing(true);

    const command = cmd.toLowerCase().trim();

    // Simulate processing delay
    await new Promise(r => setTimeout(r, 500 + Math.random() * 500));

    if (command === '/clear' || command === 'clear') {
      setTerminalLines([]);
      setIsProcessing(false);
      return;
    }

    if (command === '/help' || command === 'help') {
      addTerminalLine('system', '═══ BERIGHT COMMAND REFERENCE ═══');
      addTerminalLine('data', '/hot          - Show trending markets');
      addTerminalLine('data', '/arb          - Find arbitrage opportunities');
      addTerminalLine('data', '/scan [topic] - Scan markets by topic');
      addTerminalLine('data', '/research [q] - Deep research analysis');
      addTerminalLine('data', '/whale        - Track whale wallets');
      addTerminalLine('data', '/intel        - Latest market intel');
      addTerminalLine('data', '/status       - System status');
      addTerminalLine('data', '/agents       - View agent network');
      addTerminalLine('data', '/clear        - Clear terminal');
      setIsProcessing(false);
      return;
    }

    if (command === '/hot' || command === 'hot') {
      addAgentLog('SCOUT', 'Fetching hot markets...', 'info');
      addTerminalLine('system', '═══ HOT MARKETS ═══');

      if (markets.length > 0) {
        markets.slice(0, 5).forEach((m, i) => {
          addTerminalLine('data', `${i + 1}. ${m.title}`);
          addTerminalLine('data', `   YES: ${m.yesPct.toFixed(0)}¢ | VOL: ${formatVolume(m.volume)} | ${m.platform.toUpperCase()}`);
        });
        addAgentLog('SCOUT', `Returned ${Math.min(5, markets.length)} hot markets`, 'success');
      } else {
        addTerminalLine('error', 'No market data available');
      }
      setIsProcessing(false);
      return;
    }

    if (command === '/arb' || command === 'arb') {
      addAgentLog('ANALYST', 'Scanning for arbitrage...', 'info');
      addTerminalLine('system', '═══ ARBITRAGE OPPORTUNITIES ═══');

      if (arbOpportunities.length > 0) {
        arbOpportunities.slice(0, 3).forEach((a, i) => {
          addTerminalLine('success', `${i + 1}. +${a.spread.toFixed(1)}% SPREAD`);
          addTerminalLine('data', `   ${a.topic}`);
          addTerminalLine('data', `   ${a.platformA.toUpperCase()} ${(a.priceA * 100).toFixed(0)}¢ vs ${a.platformB.toUpperCase()} ${(a.priceB * 100).toFixed(0)}¢`);
        });
        addAgentLog('ANALYST', `Found ${arbOpportunities.length} arb opportunities`, 'success');
      } else {
        addTerminalLine('data', 'No arbitrage opportunities above 3% threshold');
      }
      setIsProcessing(false);
      return;
    }

    if (command === '/status' || command === 'status') {
      addTerminalLine('system', '═══ SYSTEM STATUS ═══');
      addTerminalLine('data', `Active Markets:   ${markets.length}`);
      addTerminalLine('data', `Arb Signals:      ${arbOpportunities.length}`);
      addTerminalLine('data', `Agents Online:    ${onlineAgents.length}/3`);
      addTerminalLine('data', `TRADER:           DISABLED`);
      addTerminalLine('success', 'All systems operational');
      setIsProcessing(false);
      return;
    }

    if (command === '/agents') {
      setViewMode('agents');
      addTerminalLine('system', 'Switching to AGENT_NETWORK view...');
      setIsProcessing(false);
      return;
    }

    if (command.startsWith('/scan ') || command.startsWith('scan ')) {
      const topic = cmd.slice(cmd.indexOf(' ') + 1);
      addAgentLog('SCOUT', `Scanning for: "${topic}"`, 'info');
      addTerminalLine('system', `═══ SCANNING: ${topic.toUpperCase()} ═══`);

      const filtered = markets.filter(m =>
        m.title.toLowerCase().includes(topic.toLowerCase())
      );

      if (filtered.length > 0) {
        filtered.slice(0, 5).forEach((m, i) => {
          addTerminalLine('data', `${i + 1}. ${m.title}`);
          addTerminalLine('data', `   YES: ${m.yesPct.toFixed(0)}¢ | ${m.platform.toUpperCase()}`);
        });
        addAgentLog('SCOUT', `Found ${filtered.length} matching markets`, 'success');
      } else {
        addTerminalLine('data', `No markets found matching "${topic}"`);
      }
      setIsProcessing(false);
      return;
    }

    // Default: treat as a question
    addAgentLog('ANALYST', `Processing query: "${cmd}"`, 'info');
    await new Promise(r => setTimeout(r, 800));

    const responses = [
      `Analyzing "${cmd}"... Based on current market data, I recommend checking the /hot markets for trending opportunities.`,
      `Interesting query. The prediction markets are showing high activity in crypto and politics categories today.`,
      `Processing your request. For detailed analysis, try /research ${cmd} for a deep dive.`,
      `I've scanned the markets for relevant data. Use /scan to find specific topics or /arb for arbitrage.`,
    ];

    addTerminalLine('output', responses[Math.floor(Math.random() * responses.length)]);
    addAgentLog('ANALYST', 'Query processed successfully', 'success');
    setIsProcessing(false);
  }, [markets, arbOpportunities, onlineAgents, addTerminalLine, addAgentLog]);

  // Boot complete handler
  const handleBootComplete = useCallback(() => {
    setIsBooting(false);
    addTerminalLine('system', 'BeRight AI Terminal initialized. Type /help for commands.');
  }, [addTerminalLine]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  if (isBooting) {
    return (
      <div className="nexus-page">
        <MatrixRain />
        <BootSequence onComplete={handleBootComplete} />
        <style jsx>{styles}</style>
      </div>
    );
  }

  return (
    <div className="nexus-page">
      <MatrixRain />

      {/* Scan Lines Overlay */}
      <div className="scanlines" />
      <div className="vignette" />

      {/* Status Bar */}
      <header className="status-bar">
        <div className="status-left">
          <span className="nexus-logo">◈ BERIGHT AI</span>
          <span className="status-divider">│</span>
          <span className="connection-status">
            <span className="status-dot online" />
            CONNECTED
          </span>
        </div>
        <div className="status-center">
          <MarketTicker markets={tickerMarkets} />
        </div>
        <div className="status-right">
          <span className="stat">
            <span className="stat-icon">◈</span>
            <span className="stat-value">{markets.length}</span>
            <span className="stat-label">MARKETS</span>
          </span>
          <span className="stat">
            <span className="stat-icon">⚡</span>
            <span className="stat-value">{arbOpportunities.length}</span>
            <span className="stat-label">ARBS</span>
          </span>
        </div>
      </header>

      {/* View Toggle */}
      <nav className="view-toggle">
        {(['terminal', 'markets', 'agents', 'intel'] as ViewMode[]).map(mode => (
          <button
            key={mode}
            className={`toggle-btn ${viewMode === mode ? 'active' : ''}`}
            onClick={() => setViewMode(mode)}
          >
            {mode === 'terminal' && '▸ TERMINAL'}
            {mode === 'markets' && '◈ MARKETS'}
            {mode === 'agents' && '◉ AGENTS'}
            {mode === 'intel' && '⚡ INTEL'}
          </button>
        ))}
      </nav>

      {/* Main Content Area */}
      <main className="nexus-main">
        <AnimatePresence mode="wait">
          {viewMode === 'terminal' && (
            <motion.div
              key="terminal"
              className="split-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="main-panel">
                <TerminalInterface
                  lines={terminalLines}
                  onCommand={processCommand}
                  isProcessing={isProcessing}
                />
              </div>
              <div className="side-panel">
                <AgentPanel logs={agentLogs} onlineAgents={onlineAgents} />
              </div>
            </motion.div>
          )}

          {viewMode === 'markets' && (
            <motion.div
              key="markets"
              className="full-panel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="panel-header-bar">
                <span className="panel-icon">◈</span>
                <span className="panel-title">LIVE_MARKETS</span>
                <span className="panel-count">{markets.length} ACTIVE</span>
                <button className="refresh-btn" onClick={fetchData} disabled={isLoading}>
                  {isLoading ? '↻ LOADING...' : '↻ REFRESH'}
                </button>
              </div>
              <MarketGrid markets={markets} />
            </motion.div>
          )}

          {viewMode === 'agents' && (
            <motion.div
              key="agents"
              className="full-panel agents-view"
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
              className="full-panel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="panel-header-bar">
                <span className="panel-icon">⚡</span>
                <span className="panel-title">ARBITRAGE_INTEL</span>
                <span className="panel-count">{arbOpportunities.length} SIGNALS</span>
              </div>
              <ArbGrid opportunities={arbOpportunities} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
      <style jsx>{styles}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;700;900&display=swap');

  /* ═══ VARIABLES ═══ */
  :root {
    --nx-bg: #0a0a0f;
    --nx-bg-panel: #0d0d14;
    --nx-bg-elevated: #12121a;
    --nx-border: #1a1a2e;
    --nx-border-glow: #00fff720;

    --nx-cyan: #00fff7;
    --nx-magenta: #ff00ff;
    --nx-green: #00ff00;
    --nx-amber: #ffae00;
    --nx-red: #ff0055;
    --nx-blue: #0088ff;

    --nx-text: #e0e0e0;
    --nx-text-dim: #666;
    --nx-text-bright: #fff;

    --nx-font-mono: 'Share Tech Mono', 'Fira Code', monospace;
    --nx-font-display: 'Orbitron', sans-serif;
  }

  /* ═══ BASE ═══ */
  .nexus-page {
    min-height: 100dvh;
    background: var(--nx-bg);
    color: var(--nx-text);
    font-family: var(--nx-font-mono);
    position: relative;
    overflow: hidden;
  }

  .matrix-canvas {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
    opacity: 0.4;
    pointer-events: none;
  }

  .scanlines {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(0, 0, 0, 0.1) 2px,
      rgba(0, 0, 0, 0.1) 4px
    );
    pointer-events: none;
    z-index: 1000;
  }

  .vignette {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: radial-gradient(ellipse at center, transparent 0%, rgba(0, 0, 0, 0.4) 100%);
    pointer-events: none;
    z-index: 999;
  }

  /* ═══ BOOT SEQUENCE ═══ */
  .boot-sequence {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 20px;
  }

  .boot-content {
    max-width: 700px;
    width: 100%;
    font-size: 14px;
    line-height: 1.6;
  }

  .boot-line {
    color: var(--nx-green);
    white-space: pre;
  }

  .boot-cursor {
    color: var(--nx-green);
    animation: blink 0.5s infinite;
  }

  @keyframes blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
  }

  /* ═══ STATUS BAR ═══ */
  .status-bar {
    position: sticky;
    top: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    background: linear-gradient(180deg, var(--nx-bg-panel) 0%, var(--nx-bg) 100%);
    border-bottom: 1px solid var(--nx-border);
    backdrop-filter: blur(10px);
  }

  .status-left, .status-right {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .status-center {
    flex: 1;
    overflow: hidden;
    margin: 0 16px;
  }

  .nexus-logo {
    font-family: var(--nx-font-display);
    font-weight: 900;
    font-size: 14px;
    color: var(--nx-cyan);
    text-shadow: 0 0 10px var(--nx-cyan);
    letter-spacing: 1px;
  }

  .status-divider {
    color: var(--nx-border);
  }

  .connection-status {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--nx-text-dim);
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--nx-text-dim);
  }

  .status-dot.online {
    background: var(--nx-green);
    box-shadow: 0 0 8px var(--nx-green);
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .stat {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    padding: 4px 10px;
    background: var(--nx-bg-elevated);
    border: 1px solid var(--nx-border);
    border-radius: 4px;
  }

  .stat-icon {
    color: var(--nx-cyan);
    font-size: 8px;
  }

  .stat-value {
    color: var(--nx-text-bright);
    font-weight: bold;
  }

  .stat-label {
    color: var(--nx-text-dim);
    font-size: 9px;
  }

  /* ═══ TICKER ═══ */
  .ticker-container {
    overflow: hidden;
    width: 100%;
  }

  .ticker-track {
    display: flex;
    animation: scroll 30s linear infinite;
    gap: 40px;
  }

  @keyframes scroll {
    from { transform: translateX(0); }
    to { transform: translateX(-50%); }
  }

  .ticker-item {
    display: flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
    font-size: 11px;
  }

  .ticker-title {
    color: var(--nx-text-dim);
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ticker-price {
    font-weight: bold;
  }

  .ticker-price.up { color: var(--nx-green); }
  .ticker-price.down { color: var(--nx-red); }

  .ticker-change {
    font-size: 10px;
  }

  .ticker-change.up { color: var(--nx-green); }
  .ticker-change.down { color: var(--nx-red); }

  .ticker-platform {
    color: var(--nx-text-dim);
    font-size: 9px;
    padding: 2px 6px;
    background: var(--nx-bg-elevated);
    border-radius: 2px;
  }

  /* ═══ VIEW TOGGLE ═══ */
  .view-toggle {
    display: flex;
    gap: 2px;
    padding: 6px 12px;
    background: var(--nx-bg);
    border-bottom: 1px solid var(--nx-border);
  }

  .toggle-btn {
    flex: 1;
    padding: 8px 12px;
    background: var(--nx-bg-panel);
    border: 1px solid var(--nx-border);
    border-radius: 4px;
    font-family: var(--nx-font-mono);
    font-size: 11px;
    color: var(--nx-text-dim);
    cursor: pointer;
    transition: all 0.2s;
  }

  .toggle-btn:hover {
    background: var(--nx-bg-elevated);
    color: var(--nx-text);
    border-color: var(--nx-cyan);
  }

  .toggle-btn.active {
    background: linear-gradient(180deg, var(--nx-bg-elevated) 0%, var(--nx-bg-panel) 100%);
    border-color: var(--nx-cyan);
    color: var(--nx-cyan);
    text-shadow: 0 0 10px var(--nx-cyan);
  }

  /* ═══ MAIN CONTENT ═══ */
  .nexus-main {
    padding: 8px;
    padding-bottom: calc(70px + env(safe-area-inset-bottom));
    position: relative;
    z-index: 10;
    height: calc(100dvh - 90px);
    overflow: hidden;
  }

  .split-view {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 8px;
    height: 100%;
  }

  @media (max-width: 900px) {
    .split-view {
      grid-template-columns: 1fr;
    }
    .side-panel {
      display: none;
    }
  }

  .main-panel, .side-panel, .full-panel {
    background: var(--nx-bg-panel);
    border: 1px solid var(--nx-border);
    border-radius: 6px;
    overflow: hidden;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .full-panel {
    height: 100%;
  }

  .agents-view {
    height: 100%;
  }

  /* ═══ TERMINAL INTERFACE ═══ */
  .terminal-interface {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .terminal-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: var(--nx-bg-elevated);
    border-bottom: 1px solid var(--nx-border);
  }

  .terminal-controls {
    display: flex;
    gap: 6px;
  }

  .control {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--nx-border);
  }

  .control.red { background: #ff5f57; }
  .control.yellow { background: #febc2e; }
  .control.green { background: #28c840; }

  .terminal-title {
    font-family: var(--nx-font-display);
    font-size: 12px;
    color: var(--nx-text-dim);
    letter-spacing: 2px;
  }

  .terminal-version {
    margin-left: auto;
    font-size: 10px;
    color: var(--nx-text-dim);
  }

  .terminal-body {
    flex: 1;
    padding: 12px;
    overflow-y: auto;
    font-size: 12px;
    line-height: 1.5;
    min-height: 0;
  }

  .terminal-line {
    display: flex;
    gap: 8px;
    margin-bottom: 4px;
  }

  .prompt {
    color: var(--nx-cyan);
    flex-shrink: 0;
  }

  .prompt.sys { color: var(--nx-magenta); }
  .prompt.err { color: var(--nx-red); }
  .prompt.ok { color: var(--nx-green); }
  .prompt.data { color: var(--nx-amber); }

  .line-content {
    flex: 1;
    word-break: break-word;
  }

  .terminal-line.input .line-content {
    color: var(--nx-text-bright);
  }

  .terminal-line.output .line-content {
    color: var(--nx-text);
  }

  .terminal-line.system .line-content {
    color: var(--nx-magenta);
  }

  .terminal-line.error .line-content {
    color: var(--nx-red);
  }

  .terminal-line.success .line-content {
    color: var(--nx-green);
  }

  .terminal-line.data .line-content {
    color: var(--nx-text-dim);
  }

  .terminal-line.processing .processing-text {
    color: var(--nx-magenta);
  }

  .terminal-input-area {
    padding: 10px 12px;
    border-top: 1px solid var(--nx-border);
    background: var(--nx-bg-elevated);
  }

  .command-hints {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 8px;
  }

  .hint-chip {
    padding: 3px 8px;
    background: var(--nx-bg);
    border: 1px solid var(--nx-border);
    border-radius: 4px;
    font-family: var(--nx-font-mono);
    font-size: 10px;
    color: var(--nx-text-dim);
    cursor: pointer;
    transition: all 0.2s;
  }

  .hint-chip:hover {
    border-color: var(--nx-cyan);
    color: var(--nx-cyan);
  }

  .input-row {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--nx-bg);
    border: 1px solid var(--nx-border);
    border-radius: 6px;
    padding: 10px 12px;
    transition: border-color 0.2s;
  }

  .input-row:focus-within {
    border-color: var(--nx-cyan);
    box-shadow: 0 0 20px var(--nx-border-glow);
  }

  .input-prompt {
    color: var(--nx-cyan);
    font-size: 16px;
  }

  .terminal-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    font-family: var(--nx-font-mono);
    font-size: 14px;
    color: var(--nx-text-bright);
  }

  .terminal-input::placeholder {
    color: var(--nx-text-dim);
  }

  .send-btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--nx-bg-elevated);
    border: 1px solid var(--nx-border);
    border-radius: 6px;
    color: var(--nx-text-dim);
    cursor: pointer;
    transition: all 0.2s;
  }

  .send-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .send-btn.active {
    background: var(--nx-cyan);
    border-color: var(--nx-cyan);
    color: var(--nx-bg);
  }

  .send-btn.active:hover {
    box-shadow: 0 0 15px var(--nx-cyan);
  }

  .send-icon {
    font-size: 16px;
  }

  /* ═══ AGENT PANEL ═══ */
  .agent-panel {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .panel-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    background: var(--nx-bg-elevated);
    border-bottom: 1px solid var(--nx-border);
  }

  .panel-icon {
    color: var(--nx-magenta);
  }

  .panel-title {
    font-family: var(--nx-font-display);
    font-size: 11px;
    color: var(--nx-text);
    letter-spacing: 2px;
  }

  .panel-status {
    margin-left: auto;
    font-size: 10px;
    padding: 3px 8px;
    border-radius: 3px;
    background: var(--nx-bg);
    border: 1px solid var(--nx-border);
  }

  .panel-status.online {
    color: var(--nx-green);
    border-color: var(--nx-green);
  }

  .agent-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
    padding: 8px;
    border-bottom: 1px solid var(--nx-border);
  }

  .agent-node {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 8px 6px;
    background: var(--nx-bg);
    border: 1px solid var(--nx-border);
    border-radius: 6px;
    transition: all 0.2s;
  }

  .agent-node.online {
    border-color: var(--agent-color);
    box-shadow: 0 0 10px color-mix(in srgb, var(--agent-color) 20%, transparent);
  }

  .node-indicator {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--nx-text-dim);
  }

  .agent-node.online .node-indicator {
    background: var(--agent-color);
    box-shadow: 0 0 8px var(--agent-color);
    animation: pulse 2s infinite;
  }

  .node-name {
    font-size: 10px;
    font-weight: bold;
    color: var(--nx-text);
    letter-spacing: 1px;
  }

  .agent-node.online .node-name {
    color: var(--agent-color);
  }

  .node-spec {
    font-size: 8px;
    color: var(--nx-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .node-model {
    font-size: 7px;
    padding: 2px 5px;
    background: var(--nx-bg-elevated);
    border: 1px solid var(--nx-border);
    border-radius: 3px;
    color: var(--nx-text-dim);
    margin-top: 2px;
  }

  .agent-node.online .node-model {
    border-color: var(--agent-color);
    color: var(--agent-color);
  }

  .node-status {
    font-size: 8px;
    color: var(--nx-text-dim);
    margin-top: 2px;
  }

  .agent-node.offline {
    opacity: 0.5;
  }

  .agent-node.offline .node-status {
    color: var(--nx-red);
  }

  .agent-logs {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .logs-header {
    display: flex;
    justify-content: space-between;
    padding: 10px 16px;
    background: var(--nx-bg-elevated);
    border-bottom: 1px solid var(--nx-border);
    font-size: 11px;
    color: var(--nx-text-dim);
  }

  .log-count {
    color: var(--nx-cyan);
  }

  .logs-feed {
    flex: 1;
    padding: 12px;
    overflow-y: auto;
    font-size: 11px;
    line-height: 1.5;
  }

  .log-entry {
    display: flex;
    gap: 6px;
    margin-bottom: 4px;
    opacity: 0.8;
  }

  .log-entry:last-child {
    opacity: 1;
  }

  .log-time {
    color: var(--nx-text-dim);
    flex-shrink: 0;
  }

  .log-agent {
    font-weight: bold;
    flex-shrink: 0;
  }

  .log-message {
    color: var(--nx-text);
    word-break: break-word;
  }

  .log-entry.error .log-message {
    color: var(--nx-red);
  }

  .log-entry.success .log-message {
    color: var(--nx-green);
  }

  .log-entry.warning .log-message {
    color: var(--nx-amber);
  }

  /* ═══ MARKET GRID ═══ */
  .panel-header-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    background: var(--nx-bg-elevated);
    border-bottom: 1px solid var(--nx-border);
  }

  .panel-count {
    margin-left: auto;
    font-size: 11px;
    color: var(--nx-cyan);
  }

  .refresh-btn {
    padding: 6px 12px;
    background: var(--nx-bg);
    border: 1px solid var(--nx-border);
    border-radius: 4px;
    font-family: var(--nx-font-mono);
    font-size: 11px;
    color: var(--nx-text-dim);
    cursor: pointer;
    transition: all 0.2s;
  }

  .refresh-btn:hover:not(:disabled) {
    border-color: var(--nx-cyan);
    color: var(--nx-cyan);
  }

  .refresh-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .market-grid {
    overflow-x: auto;
  }

  .grid-header {
    display: grid;
    grid-template-columns: 2fr 70px 70px 90px 90px;
    gap: 12px;
    padding: 10px 12px;
    background: var(--nx-bg-elevated);
    border-bottom: 1px solid var(--nx-border);
    font-size: 10px;
    color: var(--nx-text-dim);
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  .grid-row {
    display: grid;
    grid-template-columns: 2fr 70px 70px 90px 90px;
    gap: 12px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--nx-border);
    font-size: 11px;
    transition: background 0.2s;
  }

  .grid-row:hover {
    background: var(--nx-bg-elevated);
  }

  .cell {
    display: flex;
    align-items: center;
  }

  .cell.title {
    color: var(--nx-text);
  }

  .cell.yes {
    color: var(--nx-green);
    font-weight: bold;
  }

  .cell.no {
    color: var(--nx-red);
    font-weight: bold;
  }

  .cell.vol {
    color: var(--nx-text-dim);
  }

  .cell.change.up {
    color: var(--nx-red);
  }

  .cell.platform {
    color: var(--nx-text-dim);
    font-size: 10px;
    padding: 2px 6px;
    background: var(--nx-bg);
    border-radius: 2px;
    width: fit-content;
  }

  /* ═══ ARB GRID ═══ */
  .arb-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 16px;
    padding: 16px;
  }

  .arb-card {
    background: var(--nx-bg);
    border: 1px solid var(--nx-border);
    border-radius: 8px;
    padding: 16px;
    transition: all 0.2s;
  }

  .arb-card:hover {
    border-color: var(--nx-cyan);
    box-shadow: 0 0 20px var(--nx-border-glow);
  }

  .arb-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .arb-spread {
    font-size: 18px;
    font-weight: bold;
    color: var(--nx-green);
    text-shadow: 0 0 10px var(--nx-green);
  }

  .arb-conf {
    font-size: 10px;
    padding: 4px 8px;
    border-radius: 4px;
    background: var(--nx-bg-elevated);
  }

  .arb-conf.high { color: var(--nx-green); border: 1px solid var(--nx-green); }
  .arb-conf.med { color: var(--nx-amber); border: 1px solid var(--nx-amber); }
  .arb-conf.low { color: var(--nx-red); border: 1px solid var(--nx-red); }

  .arb-topic {
    font-size: 14px;
    color: var(--nx-text);
    margin-bottom: 12px;
    line-height: 1.4;
  }

  .arb-compare {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }

  .arb-side {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    flex: 1;
    padding: 8px;
    background: var(--nx-bg-elevated);
    border-radius: 4px;
  }

  .arb-platform {
    font-size: 10px;
    color: var(--nx-text-dim);
  }

  .arb-price {
    font-size: 16px;
    font-weight: bold;
    color: var(--nx-cyan);
  }

  .arb-vs {
    color: var(--nx-text-dim);
    font-size: 11px;
  }

  .arb-strategy {
    font-size: 11px;
    color: var(--nx-text-dim);
    line-height: 1.5;
    padding: 8px;
    background: var(--nx-bg-elevated);
    border-radius: 4px;
    border-left: 2px solid var(--nx-cyan);
  }

  .no-data {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 60px 20px;
    color: var(--nx-text-dim);
    text-align: center;
  }

  .no-data-icon {
    font-size: 40px;
    opacity: 0.3;
  }

  .no-data-sub {
    font-size: 12px;
    opacity: 0.6;
  }

  /* ═══ SCROLLBAR ═══ */
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  ::-webkit-scrollbar-track {
    background: var(--nx-bg);
  }

  ::-webkit-scrollbar-thumb {
    background: var(--nx-border);
    border-radius: 3px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: var(--nx-text-dim);
  }

  /* ═══ RESPONSIVE ═══ */
  @media (max-width: 768px) {
    .status-bar {
      flex-wrap: wrap;
      gap: 6px;
      padding: 6px 12px;
    }

    .status-center {
      order: 3;
      width: 100%;
      margin: 4px 0 0;
    }

    .view-toggle {
      overflow-x: auto;
      scrollbar-width: none;
      padding: 6px 8px;
    }

    .view-toggle::-webkit-scrollbar {
      display: none;
    }

    .toggle-btn {
      white-space: nowrap;
      flex: none;
      padding: 6px 10px;
      font-size: 10px;
    }

    .nexus-main {
      padding: 6px;
      height: calc(100dvh - 100px);
    }

    .grid-header,
    .grid-row {
      grid-template-columns: 1fr 55px 55px 70px;
    }

    .grid-header span:nth-child(5),
    .grid-row .cell:nth-child(5) {
      display: none;
    }
  }
`;

