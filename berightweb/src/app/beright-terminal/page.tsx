'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BottomNav from '@/components/BottomNav';
import { usePrivy } from '@privy-io/react-auth';
import { getHotMarkets, getArbitrageOpportunities, getIntel, sendToGateway, GatewayResponse, ApiMarket, ApiArbitrage } from '@/lib/api';
import { useSignalStream, LiveSignal } from '@/hooks/useSignalStream';

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  BERIGHT AI TERMINAL - CYBERPUNK PREDICTION MARKET INTERFACE             ║
// ║  Aesthetic: Matrix meets Blade Runner trading terminal                   ║
// ║  Font: Share Tech Mono (terminal) + Orbitron (headers)                   ║
// ╚══════════════════════════════════════════════════════════════════════════╝

type ViewMode = 'terminal' | 'markets' | 'agents' | 'intel' | 'signals';

interface AgentLog {
  id: string;
  agent: 'SCOUT' | 'ANALYST' | 'TRADER' | 'BUILDER' | 'SYSTEM';
  message: string;
  timestamp: Date;
  type: 'info' | 'success' | 'warning' | 'error' | 'data';
}

interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'system' | 'error' | 'success' | 'data' | 'link';
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
    { cmd: '/help', desc: 'All commands' },
    { cmd: '/hot', desc: 'Hot markets' },
    { cmd: '/alpha', desc: 'Alpha plays' },
    { cmd: '/arb', desc: 'Arbitrage' },
    { cmd: '/research', desc: 'Research' },
    { cmd: '/intelligence', desc: 'AI analysis' },
    { cmd: '/whale', desc: 'Whales' },
    { cmd: '/intel', desc: 'News' },
    { cmd: '/brief', desc: 'Briefing' },
    { cmd: '/me', desc: 'My stats' },
    { cmd: '/predict', desc: 'Predict' },
    { cmd: '/signals', desc: 'Signals' },
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
            {line.type === 'link' && <span className="prompt link">↗</span>}
            {line.type === 'link' ? (
              <a
                href={line.content.replace('→ Trade: ', '')}
                target="_blank"
                rel="noopener noreferrer"
                className="line-content market-link"
              >
                {line.content}
              </a>
            ) : (
              <span className="line-content">{line.content}</span>
            )}
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
// SIGNAL TYPE META (action colors / labels)
// ═══════════════════════════════════════════════════════════════════════════

const SIGNAL_ACTION_COLOR: Record<string, string> = {
  ALERT: '#ff0055',
  WATCH: '#00fff7',
  SKIP:  '#444',
};

const SIGNAL_TYPE_LABEL: Record<string, string> = {
  volume_surge:        'VOL SURGE',
  odds_shift:          'ODDS SHIFT',
  arb_opportunity:     'ARB',
  resolution_imminent: 'RESOLVING',
  new_market:          'NEW MKT',
  smart_money:         'SMART $',
  narrative_emergence: 'NARRATIVE',
  cross_market:        'CROSS-MKT',
  insider_pattern:     'INSIDER',
  consensus_flip:      'FLIP',
  whale_entry:         'WHALE',
};

// ═══════════════════════════════════════════════════════════════════════════
// SIGNALS FEED PANEL
// ═══════════════════════════════════════════════════════════════════════════

function SignalsFeed({ signals, connected, alertCount, clearAlerts }: {
  signals: LiveSignal[];
  connected: boolean;
  alertCount: number;
  clearAlerts: () => void;
}) {
  const feedRef = useRef<HTMLDivElement>(null);

  if (signals.length === 0) {
    return (
      <div className="signals-panel">
        <div className="panel-header-bar">
          <span className="panel-icon">⚡</span>
          <span className="panel-title">SIGNAL_INTELLIGENCE</span>
          <span className={`signal-conn-badge ${connected ? 'live' : 'offline'}`}>
            {connected ? '● LIVE' : '○ OFFLINE'}
          </span>
        </div>
        <div className="no-data">
          <span className="no-data-icon">⚡</span>
          <span>{connected ? 'Awaiting first signal...' : 'Connecting to signal feed...'}</span>
          <span className="no-data-sub">Signals are emitted every ~5 minutes from market detectors</span>
        </div>
      </div>
    );
  }

  return (
    <div className="signals-panel">
      <div className="panel-header-bar">
        <span className="panel-icon">⚡</span>
        <span className="panel-title">SIGNAL_INTELLIGENCE</span>
        <span className={`signal-conn-badge ${connected ? 'live' : 'offline'}`}>
          {connected ? '● LIVE' : '○ OFFLINE'}
        </span>
        <span className="panel-count">{signals.length} SIGNALS</span>
        {alertCount > 0 && (
          <button className="clear-alerts-btn" onClick={clearAlerts}>
            ✗ CLEAR {alertCount}
          </button>
        )}
      </div>

      <div className="signals-feed" ref={feedRef}>
        {signals.map((sig, i) => (
          <motion.div
            key={sig.id}
            className={`signal-row ${sig.action.toLowerCase()}`}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i < 5 ? i * 0.04 : 0 }}
          >
            {/* Action badge */}
            <div
              className="sig-action"
              style={{ color: SIGNAL_ACTION_COLOR[sig.action], borderColor: SIGNAL_ACTION_COLOR[sig.action] }}
            >
              {sig.action}
            </div>

            {/* Type tag */}
            <div className="sig-type">
              {SIGNAL_TYPE_LABEL[sig.signalType] || sig.signalType.toUpperCase()}
            </div>

            {/* Main info */}
            <div className="sig-body">
              <div className="sig-title">{sig.marketTitle}</div>
              {sig.alertText && <div className="sig-alert">{sig.alertText}</div>}
              {sig.reasoning && <div className="sig-reason">{sig.reasoning}</div>}
            </div>

            {/* Right stats */}
            <div className="sig-stats">
              <div className="sig-platform">{sig.platform.toUpperCase()}</div>
              <div className="sig-confidence">
                <span className="sig-conf-label">CONF</span>
                <span className="sig-conf-value">{Math.round(sig.confidence * 100)}%</span>
              </div>
              <div className="sig-strength-bar">
                <div
                  className="sig-strength-fill"
                  style={{
                    width: `${Math.round(sig.strength * 100)}%`,
                    background: sig.strength > 0.7
                      ? SIGNAL_ACTION_COLOR.ALERT
                      : sig.strength > 0.4
                        ? SIGNAL_ACTION_COLOR.WATCH
                        : '#444',
                  }}
                />
              </div>
              <div className="sig-time">
                {new Date(sig.createdAt).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
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
    '> Connecting signal intelligence feed...',
    '  ├─ Volume Surge detector... [ARMED]',
    '  ├─ Odds Shift detector..... [ARMED]',
    '  ├─ Arb Opportunity......... [ARMED]',
    '  ├─ Smart Money tracker..... [ARMED]',
    '  └─ 7 more detectors........ [ARMED]',
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

  // Process terminal command through unified gateway
  const processCommand = useCallback(async (cmd: string) => {
    addTerminalLine('input', cmd);
    setIsProcessing(true);

    const command = cmd.toLowerCase().trim();

    // LOCAL COMMANDS (don't need gateway)
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

    // Determine which agent will handle this (for UI feedback)
    const getAgentForCommand = (text: string): 'SCOUT' | 'ANALYST' | 'TRADER' | 'SYSTEM' => {
      const lower = text.toLowerCase();
      if (lower.startsWith('/hot') || lower.startsWith('/scan') || lower.startsWith('/alpha')) return 'SCOUT';
      if (lower.startsWith('/research') || lower.startsWith('/odds') || lower.startsWith('/intelligence') || lower.startsWith('/analyze')) return 'ANALYST';
      if (lower.startsWith('/arb')) return 'ANALYST';
      if (lower.startsWith('/whale') || lower.startsWith('/track')) return 'SCOUT';
      if (lower.startsWith('/trade') || lower.startsWith('/buy') || lower.startsWith('/sell') || lower.startsWith('/kalshi') || lower.startsWith('/dflow')) return 'TRADER';
      return 'ANALYST';
    };

    const agent = getAgentForCommand(cmd);
    addAgentLog(agent, `Processing: ${cmd.slice(0, 50)}${cmd.length > 50 ? '...' : ''}`, 'info');

    try {
      // SEND TO UNIFIED GATEWAY
      // This routes through the same handler as Telegram with full agent/skill system
      const response: GatewayResponse = await sendToGateway(cmd, {
        sessionId: gatewaySessionId || undefined,
      });

      // Save session ID for context persistence
      if (response.sessionId && response.sessionId !== gatewaySessionId) {
        setGatewaySessionId(response.sessionId);
      }

      if (response.success) {
        // Parse the response and display it line by line
        const lines = response.text.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          // Detect line types based on content
          if (trimmed.startsWith('═') || trimmed.startsWith('─') || trimmed.startsWith('━')) {
            addTerminalLine('system', trimmed);
          } else if (trimmed.startsWith('✅') || trimmed.startsWith('✓') || trimmed.includes('SUCCESS')) {
            addTerminalLine('success', trimmed);
          } else if (trimmed.startsWith('❌') || trimmed.startsWith('✗') || trimmed.includes('ERROR') || trimmed.includes('Failed')) {
            addTerminalLine('error', trimmed);
          } else if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.includes(': http')) {
            // Extract URL and make it a link
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

        // Update local state if we got market data
        if (response.data) {
          // If response contains markets array, update local state
          if (Array.isArray(response.data) && response.data.length > 0 && response.data[0].title) {
            setMarkets(response.data);
          }
          // If response contains arbitrage opportunities
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
          <span className={`stat ${signalsConnected ? 'signal-live' : ''}`}>
            <span className="stat-icon" style={{ color: signalsConnected ? '#ff0055' : undefined }}>◉</span>
            <span className="stat-value" style={{ color: alertCount > 0 ? '#ff0055' : undefined }}>
              {alertCount > 0 ? alertCount : signals.length}
            </span>
            <span className="stat-label">{alertCount > 0 ? 'ALERTS' : 'SIGNALS'}</span>
          </span>
        </div>
      </header>

      {/* View Toggle */}
      <nav className="view-toggle">
        {(['terminal', 'markets', 'agents', 'intel', 'signals'] as ViewMode[]).map(mode => (
          <button
            key={mode}
            className={`toggle-btn ${viewMode === mode ? 'active' : ''}`}
            onClick={() => {
              setViewMode(mode);
              if (mode === 'signals') clearAlerts();
            }}
          >
            {mode === 'terminal' && '▸ TERMINAL'}
            {mode === 'markets' && '◈ MARKETS'}
            {mode === 'agents' && '◉ AGENTS'}
            {mode === 'intel' && '⚡ INTEL'}
            {mode === 'signals' && (
              <span className="signals-nav-label">
                ◉ SIGNALS
                {alertCount > 0 && (
                  <span className="signals-alert-badge">{alertCount}</span>
                )}
              </span>
            )}
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

          {viewMode === 'signals' && (
            <motion.div
              key="signals"
              className="full-panel"
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

  .terminal-line.link .line-content,
  .terminal-line.link .market-link {
    color: var(--nx-cyan);
    text-decoration: none;
    cursor: pointer;
    transition: color 0.15s ease;
  }

  .terminal-line.link .market-link:hover {
    color: var(--nx-green);
    text-decoration: underline;
  }

  .prompt.link {
    color: var(--nx-cyan);
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

  /* ═══ SIGNALS NAV BADGE ═══ */
  .signals-nav-label {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .signals-alert-badge {
    position: absolute;
    top: -8px;
    right: -12px;
    min-width: 16px;
    height: 16px;
    background: #ff0055;
    color: #fff;
    font-size: 9px;
    font-weight: bold;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 3px;
    animation: pulse 1s infinite;
    line-height: 1;
  }

  .stat.signal-live {
    border-color: #ff005540;
  }

  /* ═══ SIGNALS FEED ═══ */
  .signals-panel {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .signal-conn-badge {
    font-size: 10px;
    padding: 3px 8px;
    border-radius: 3px;
    background: var(--nx-bg);
    border: 1px solid var(--nx-border);
  }

  .signal-conn-badge.live {
    color: #ff0055;
    border-color: #ff005540;
    text-shadow: 0 0 8px #ff0055;
    animation: pulse 2s infinite;
  }

  .signal-conn-badge.offline {
    color: var(--nx-text-dim);
  }

  .clear-alerts-btn {
    margin-left: auto;
    padding: 4px 10px;
    background: var(--nx-bg);
    border: 1px solid #ff005540;
    border-radius: 4px;
    font-family: var(--nx-font-mono);
    font-size: 10px;
    color: #ff0055;
    cursor: pointer;
    transition: all 0.2s;
  }

  .clear-alerts-btn:hover {
    background: #ff005515;
    border-color: #ff0055;
  }

  .signals-feed {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .signal-row {
    display: grid;
    grid-template-columns: 60px 90px 1fr 120px;
    gap: 10px;
    align-items: start;
    padding: 10px 12px;
    background: var(--nx-bg);
    border: 1px solid var(--nx-border);
    border-radius: 6px;
    transition: all 0.2s;
  }

  .signal-row:hover {
    background: var(--nx-bg-elevated);
    border-color: var(--nx-border-glow);
  }

  .signal-row.alert {
    border-left: 3px solid #ff0055;
  }

  .signal-row.watch {
    border-left: 3px solid #00fff7;
  }

  .sig-action {
    font-size: 9px;
    font-weight: bold;
    letter-spacing: 1px;
    padding: 3px 6px;
    border-radius: 3px;
    border: 1px solid;
    text-align: center;
    align-self: start;
    margin-top: 2px;
    background: rgba(0,0,0,0.3);
  }

  .sig-type {
    font-size: 9px;
    color: var(--nx-amber);
    letter-spacing: 0.5px;
    padding: 4px 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    align-self: start;
  }

  .sig-body {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .sig-title {
    font-size: 12px;
    color: var(--nx-text-bright);
    line-height: 1.3;
  }

  .sig-alert {
    font-size: 11px;
    color: var(--nx-amber);
    font-style: italic;
  }

  .sig-reason {
    font-size: 10px;
    color: var(--nx-text-dim);
    line-height: 1.4;
  }

  .sig-stats {
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: flex-end;
  }

  .sig-platform {
    font-size: 9px;
    color: var(--nx-text-dim);
    padding: 2px 6px;
    background: var(--nx-bg-elevated);
    border-radius: 2px;
  }

  .sig-confidence {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .sig-conf-label {
    font-size: 8px;
    color: var(--nx-text-dim);
  }

  .sig-conf-value {
    font-size: 11px;
    color: var(--nx-cyan);
    font-weight: bold;
  }

  .sig-strength-bar {
    width: 60px;
    height: 3px;
    background: var(--nx-border);
    border-radius: 2px;
    overflow: hidden;
  }

  .sig-strength-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.5s ease;
  }

  .sig-time {
    font-size: 9px;
    color: var(--nx-text-dim);
  }

  @media (max-width: 768px) {
    .signal-row {
      grid-template-columns: 50px 80px 1fr;
    }
    .sig-stats {
      display: none;
    }
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

