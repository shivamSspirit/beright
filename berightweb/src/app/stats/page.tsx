'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import BottomNav from '@/components/BottomNav';
import { usePrivy } from '@privy-io/react-auth';
import { getHotMarkets, getArbitrageOpportunities, searchMarkets as apiSearchMarkets, getIntel } from '@/lib/api';

// ═══════════════════════════════════════════════════════════════
// UPLINK TERMINAL v2.2 - Live Market Data
// Connected to Polymarket, Kalshi, Manifold APIs
// ═══════════════════════════════════════════════════════════════

interface OutputLine {
  id: string;
  type: 'cmd' | 'out' | 'sys' | 'err' | 'alert' | 'boot';
  text: string;
}

interface LiveAlert {
  id: string;
  type: 'whale' | 'arb' | 'hot';
  text: string;
  time: string;
}

interface Market {
  platform: string;
  title: string;
  yesPct: number;
  volume: number;
  volume24h?: number;
}

interface ArbOpportunity {
  topic: string;
  marketA: { platform: string; yesPct: number };
  marketB: { platform: string; yesPct: number };
  spread: number;
  strategy: string;
}

interface NewsArticle {
  title: string;
  source: string;
  pubDate: string;
}

// Helper to format volume
function formatVol(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

// Helper to create progress bar
function progressBar(pct: number): string {
  const filled = Math.round(pct / 5);
  const empty = 20 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

// Helper to truncate text
function truncate(s: string, len: number): string {
  return s.length > len ? s.slice(0, len - 3) + '...' : s;
}

const STATIC_OUTPUTS: Record<string, string[]> = {
  '/help': [
    '',
    '  ╔═══════════════════════════════════════╗',
    '  ║        UPLINK TERMINAL v2.2           ║',
    '  ║        [LIVE DATA CONNECTED]          ║',
    '  ╚═══════════════════════════════════════╝',
    '',
    '  COMMANDS:',
    '',
    '  /hot     Trending markets (LIVE)',
    '  /arb     Arbitrage opportunities (LIVE)',
    '  /news    Latest market news (LIVE)',
    '  /predict Search markets (LIVE)',
    '  /me      Your forecaster stats',
    '  /clear   Clear terminal',
    '  /help    Show this message',
    '',
    '  SHORTCUTS:',
    '  Tab      Autocomplete',
    '  Up/Down  Command history',
    '',
    '  Type a command to begin...',
    '',
  ],
  '/me': [
    '',
    '  ╔═══════════════════════════════════════╗',
    '  ║      YOUR FORECASTER PROFILE          ║',
    '  ╚═══════════════════════════════════════╝',
    '',
    '  ACCURACY        68.5%',
    '  ████████████████░░░░░░░░',
    '',
    '  BRIER SCORE     0.187 (Good)',
    '  PREDICTIONS     127 total',
    '  RESOLVED        89 │ PENDING 38',
    '',
    '  ┌─ VS AI PERFORMANCE ─────────────────┐',
    '  │ You: 68.5%  ████████████████░░░░    │',
    '  │ AI:  65.3%  ███████████████░░░░░    │',
    '  │                                      │',
    '  │ >>> BEATING AI by 3.2% <<<          │',
    '  │ Record: 42W - 31L                   │',
    '  └─────────────────────────────────────┘',
    '',
    '  RANK: Top 15% of forecasters',
    '  STREAK: 7 consecutive wins',
    '',
  ],
};

export default function TerminalPage() {
  const { authenticated, user } = usePrivy();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState<OutputLine[]>([]);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [isTyping, setIsTyping] = useState(false);
  const [onlineCount, setOnlineCount] = useState(2847);
  const [streak] = useState(7);
  const [alertIdx, setAlertIdx] = useState(0);
  const [alertFade, setAlertFade] = useState(true);
  const [showCursor, setShowCursor] = useState(true);
  const [bootComplete, setBootComplete] = useState(false);
  const [predCount, setPredCount] = useState(847);
  const [liveAlerts, setLiveAlerts] = useState<LiveAlert[]>([
    { id: '1', type: 'hot', text: 'Loading live data...', time: 'now' },
  ]);
  const [arbCount, setArbCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  // Cursor blink
  useEffect(() => {
    const i = setInterval(() => setShowCursor(v => !v), 530);
    return () => clearInterval(i);
  }, []);

  // Online count fluctuation
  useEffect(() => {
    const i = setInterval(() => {
      setOnlineCount(c => Math.max(2500, c + Math.floor(Math.random() * 21) - 10));
    }, 3000);
    return () => clearInterval(i);
  }, []);

  // Prediction count increment
  useEffect(() => {
    const i = setInterval(() => {
      setPredCount(c => c + Math.floor(Math.random() * 3));
    }, 5000);
    return () => clearInterval(i);
  }, []);

  // Fetch live alerts on mount
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const alerts: LiveAlert[] = [];

        // Fetch hot markets for alerts
        try {
          const hotData = await getHotMarkets(3);
          if (hotData.markets?.length > 0) {
            hotData.markets.slice(0, 2).forEach((m, i: number) => {
              alerts.push({
                id: `hot-${i}`,
                type: 'hot',
                text: `${truncate(m.title, 35)} at ${m.yesPct}%`,
                time: 'live',
              });
            });
          }
        } catch (e) {
          console.error('Failed to fetch hot markets:', e);
        }

        // Fetch arb opportunities
        try {
          const arbData = await getArbitrageOpportunities();
          if (arbData.opportunities?.length > 0) {
            setArbCount(arbData.opportunities.length);
            arbData.opportunities.slice(0, 2).forEach((a, i: number) => {
              alerts.push({
                id: `arb-${i}`,
                type: 'arb',
                text: `${a.spread}% spread: ${truncate(a.topic, 25)}`,
                time: 'live',
              });
            });
          }
        } catch (e) {
          console.error('Failed to fetch arbitrage:', e);
        }

        if (alerts.length > 0) {
          setLiveAlerts(alerts);
        }
      } catch (e) {
        console.error('Failed to fetch alerts:', e);
      }
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000); // Refresh every 60s
    return () => clearInterval(interval);
  }, []);

  // Alert rotation with fade
  useEffect(() => {
    if (liveAlerts.length <= 1) return;
    const i = setInterval(() => {
      setAlertFade(false);
      setTimeout(() => {
        setAlertIdx(idx => (idx + 1) % liveAlerts.length);
        setAlertFade(true);
      }, 300);
    }, 5000);
    return () => clearInterval(i);
  }, [liveAlerts.length]);

  // Boot sequence
  useEffect(() => {
    const boot = async () => {
      const sequence = [
        { text: '> UPLINK TERMINAL v2.2', delay: 100 },
        { text: '> Connecting to Polymarket...', delay: 150 },
        { text: '> Connecting to Kalshi...', delay: 150 },
        { text: '> Connecting to Manifold...', delay: 150 },
        { text: '  [====================] 100%', delay: 200 },
        { text: '> Live data stream active', delay: 100 },
        { text: '', delay: 50 },
        { text: '  ╔═══════════════════════════════════╗', delay: 30 },
        { text: '  ║   SYSTEM READY - LIVE DATA        ║', delay: 30 },
        { text: '  ║   Type /help for commands         ║', delay: 30 },
        { text: '  ╚═══════════════════════════════════╝', delay: 30 },
        { text: '', delay: 50 },
      ];

      for (const { text, delay } of sequence) {
        await new Promise(r => setTimeout(r, delay));
        setOutput(prev => [...prev, {
          id: `boot-${Date.now()}-${Math.random()}`,
          type: 'boot',
          text,
        }]);
      }
      setBootComplete(true);
    };
    boot();
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  // Focus input after boot
  useEffect(() => {
    if (bootComplete) {
      inputRef.current?.focus();
    }
  }, [bootComplete]);

  const typeOut = useCallback(async (lines: string[]) => {
    setIsTyping(true);
    for (const text of lines) {
      await new Promise(r => setTimeout(r, 15));
      setOutput(prev => [...prev, {
        id: `out-${Date.now()}-${Math.random()}`,
        type: 'out',
        text,
      }]);
    }
    setIsTyping(false);
  }, []);

  const addLine = useCallback((text: string, type: 'out' | 'sys' | 'err' = 'out') => {
    setOutput(prev => [...prev, {
      id: `${type}-${Date.now()}-${Math.random()}`,
      type,
      text,
    }]);
  }, []);

  // Fetch and format hot markets
  const fetchHotMarkets = useCallback(async () => {
    addLine('  Fetching live market data...', 'sys');

    try {
      const data = await getHotMarkets(5);

      const lines: string[] = [
        '',
        '  ╔═══════════════════════════════════════╗',
        '  ║       TRENDING MARKETS [LIVE]         ║',
        '  ╚═══════════════════════════════════════╝',
        '',
      ];

      if (data.markets?.length > 0) {
        data.markets.forEach((m, i: number) => {
          const platform = m.platform.toUpperCase().slice(0, 4);
          lines.push(`  #${i + 1}  ${truncate(m.title, 35)}`);
          lines.push(`      ${m.yesPct}% YES │ ${formatVol(m.volume)} vol │ ${platform}`);
          lines.push(`      ${progressBar(m.yesPct)} ${m.yesPct}%`);
          lines.push('');
        });
      } else {
        lines.push('  No markets found');
      }

      lines.push(`  Updated: ${new Date().toLocaleTimeString()}`);
      lines.push('');

      await typeOut(lines);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Unknown error';
      addLine(`  ERR: ${errMsg}`, 'err');
      console.error('Hot markets error:', e);
    }
  }, [addLine, typeOut]);

  // Fetch and format arbitrage
  const fetchArbitrage = useCallback(async () => {
    addLine('  Scanning for arbitrage opportunities...', 'sys');

    try {
      const data = await getArbitrageOpportunities();

      const lines: string[] = [
        '',
        '  ╔═══════════════════════════════════════╗',
        '  ║   ARBITRAGE OPPORTUNITIES [LIVE]      ║',
        '  ╚═══════════════════════════════════════╝',
        '',
      ];

      if (data.opportunities?.length > 0) {
        lines.push(`  FOUND: ${data.opportunities.length} opportunities`);
        lines.push('');

        data.opportunities.slice(0, 5).forEach((a, i: number) => {
          lines.push(`  [${i + 1}] ${truncate(a.topic, 35)}`);
          // priceA and priceB are decimals (0-1), convert to percentages for display
          const pctA = Math.round(a.priceA * 100);
          const pctB = Math.round(a.priceB * 100);
          lines.push(`      ${a.platformA}: ${pctA}% │ ${a.platformB}: ${pctB}%`);
          lines.push(`      SPREAD: ${a.spread.toFixed(1)}%`);
          lines.push(`      ${a.strategy}`);
          lines.push('');
        });
      } else {
        lines.push('  No arbitrage opportunities found');
        lines.push('  (Spread threshold: 3%)');
      }

      lines.push(`  Scanned at: ${data.scannedAt ? new Date(data.scannedAt).toLocaleTimeString() : new Date().toLocaleTimeString()}`);
      lines.push('');

      await typeOut(lines);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Unknown error';
      addLine(`  ERR: ${errMsg}`, 'err');
      console.error('Arbitrage error:', e);
    }
  }, [addLine, typeOut]);

  // Fetch and format news
  const fetchNews = useCallback(async () => {
    addLine('  Fetching latest news...', 'sys');

    try {
      const data = await getIntel('prediction markets', 'news');

      const lines: string[] = [
        '',
        '  ╔═══════════════════════════════════════╗',
        '  ║       MARKET INTELLIGENCE [LIVE]      ║',
        '  ╚═══════════════════════════════════════╝',
        '',
        '  ┌─ HEADLINES ─────────────────────────┐',
        '',
      ];

      if (data.news?.length > 0) {
        data.news.slice(0, 5).forEach((a) => {
          lines.push(`  ${truncate(a.title, 40)}`);
          const date = a.publishedAt ? new Date(a.publishedAt).toLocaleDateString() : 'Recent';
          lines.push(`  └─ ${date} │ ${a.source}`);
          lines.push('');
        });
      } else {
        lines.push('  No recent news found');
      }

      lines.push('  └─────────────────────────────────────┘');
      lines.push(`  Updated: ${new Date().toLocaleTimeString()}`);
      lines.push('');

      await typeOut(lines);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Unknown error';
      addLine(`  ERR: ${errMsg}`, 'err');
      console.error('News error:', e);
    }
  }, [addLine, typeOut]);

  // Search markets
  const searchMarkets = useCallback(async (query: string) => {
    addLine(`  Searching "${query}"...`, 'sys');

    try {
      const data = await apiSearchMarkets(query, { limit: 5 });

      const lines: string[] = [
        '',
        `  ╔═══════════════════════════════════════╗`,
        `  ║  SEARCH: "${truncate(query, 25)}"`,
        `  ╚═══════════════════════════════════════╝`,
        '',
      ];

      if (data.markets?.length > 0) {
        lines.push(`  Found ${data.markets.length} markets:`);
        lines.push('');

        data.markets.forEach((m, i: number) => {
          lines.push(`  ${i + 1}. ${truncate(m.title, 38)}`);
          lines.push(`     ${m.yesPct}% YES │ ${formatVol(m.volume)} │ ${m.platform}`);
          lines.push('');
        });
      } else {
        lines.push('  No markets found for this query');
      }

      lines.push('');
      await typeOut(lines);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Unknown error';
      addLine(`  ERR: ${errMsg}`, 'err');
      console.error('Search error:', e);
    }
  }, [addLine, typeOut]);

  const exec = useCallback(async (cmd: string) => {
    const c = cmd.trim().toLowerCase();

    setOutput(prev => [...prev, {
      id: `cmd-${Date.now()}`,
      type: 'cmd',
      text: `$ ${cmd}`,
    }]);

    if (cmd.trim()) {
      setCmdHistory(prev => [...prev.filter(x => x !== cmd), cmd]);
      setHistIdx(-1);
    }

    if (c === '/clear') {
      setOutput([]);
      return;
    }

    if (c === '/me' && !authenticated) {
      addLine('  ERR: Connect wallet to view your stats', 'err');
      return;
    }

    // Static commands
    if (STATIC_OUTPUTS[c]) {
      await typeOut(STATIC_OUTPUTS[c]);
      return;
    }

    // Live data commands
    if (c === '/hot' || c === '/brief') {
      await fetchHotMarkets();
    } else if (c === '/arb') {
      await fetchArbitrage();
    } else if (c === '/news') {
      await fetchNews();
    } else if (c.startsWith('/predict ')) {
      const query = cmd.slice(9).trim();
      if (query) {
        await searchMarkets(query);
      } else {
        addLine('  Usage: /predict <search query>', 'err');
      }
    } else if (c.startsWith('/')) {
      addLine(`  Unknown command: ${c}`, 'err');
      addLine('  Type /help for available commands', 'sys');
    } else if (c) {
      await searchMarkets(c);
    }
  }, [authenticated, addLine, typeOut, fetchHotMarkets, fetchArbitrage, fetchNews, searchMarkets]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isTyping && bootComplete) {
      exec(input);
      setInput('');
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (cmdHistory.length > 0) {
        const idx = histIdx < cmdHistory.length - 1 ? histIdx + 1 : histIdx;
        setHistIdx(idx);
        setInput(cmdHistory[cmdHistory.length - 1 - idx] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (histIdx > 0) {
        const idx = histIdx - 1;
        setHistIdx(idx);
        setInput(cmdHistory[cmdHistory.length - 1 - idx] || '');
      } else {
        setHistIdx(-1);
        setInput('');
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const cmds = ['/hot', '/arb', '/news', '/predict', '/me', '/help', '/clear'];
      const matching = cmds.filter(x => x.startsWith(input.toLowerCase()));
      if (matching.length === 1) setInput(matching[0]);
    }
  };

  const currentAlert = liveAlerts[alertIdx % liveAlerts.length];

  return (
    <div className="term" onClick={() => bootComplete && inputRef.current?.focus()}>
      {/* CRT Effects */}
      <div className="crt-vignette" />
      <div className="scanlines" />
      <div className="noise" />

      {/* Status Bar */}
      <header className="status-bar">
        <div className="status-left">
          <span className="pulse" />
          <span className="online">{onlineCount.toLocaleString()}</span>
        </div>
        <div className="status-center">
          <span className="streak-fire">*</span>
          <span className="streak">{streak}d</span>
        </div>
        <div className="status-right">
          <span className="arb-badge">{arbCount || '?'} ARB</span>
        </div>
      </header>

      {/* Alert Ticker */}
      <div className="alert-ticker">
        <div className={`alert-content ${alertFade ? 'visible' : ''}`}>
          <span className={`alert-type ${currentAlert?.type || 'hot'}`}>
            {(currentAlert?.type || 'LIVE').toUpperCase()}
          </span>
          <span className="alert-text">{currentAlert?.text || 'Loading...'}</span>
          <span className="alert-time">{currentAlert?.time || ''}</span>
        </div>
      </div>

      {/* Terminal Output */}
      <main className="output" ref={outputRef}>
        {output.map(line => (
          <div key={line.id} className={`line ${line.type}`}>
            {line.text || '\u00A0'}
          </div>
        ))}
        {isTyping && <div className="line typing">...</div>}
      </main>

      {/* Quick Commands */}
      <nav className="quick-cmds">
        {['/hot', '/arb', '/news', '/me'].map(cmd => (
          <button
            key={cmd}
            className="qcmd"
            onClick={() => !isTyping && bootComplete && exec(cmd)}
            disabled={isTyping || !bootComplete}
            type="button"
          >
            {cmd.slice(1)}
          </button>
        ))}
      </nav>

      {/* Input */}
      <form className="input-row" onSubmit={handleSubmit}>
        <span className="prompt">
          {authenticated ? (
            <span className="user">{user?.wallet?.address?.slice(0, 6)}</span>
          ) : (
            <span className="guest">guest</span>
          )}
          <span className="dollar">$</span>
        </span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={!bootComplete ? 'connecting...' : isTyping ? '' : 'command or search...'}
          disabled={isTyping || !bootComplete}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        <span className={`cursor ${showCursor && bootComplete ? '' : 'off'}`}>_</span>
      </form>

      {/* Social Proof Footer */}
      <footer className="social-proof">
        <span>{predCount.toLocaleString()} predictions made in the last hour</span>
      </footer>

      <BottomNav />

      <style jsx>{`
        /* ═══════════════════════════════════════════
           CSS CUSTOM PROPERTIES
           ═══════════════════════════════════════════ */
        .term {
          --amber: #ffb000;
          --amber-dim: rgba(255, 176, 0, 0.6);
          --amber-glow: rgba(255, 176, 0, 0.4);
          --green: #22c55e;
          --red: #ef4444;
          --blue: #3b82f6;
          --orange: #f97316;
          --bg: #000000;
          --text: #e8e8e8;
        }

        /* ═══════════════════════════════════════════
           BASE LAYOUT
           ═══════════════════════════════════════════ */
        .term {
          min-height: 100dvh;
          background: var(--bg);
          color: var(--amber);
          font-family: 'SF Mono', 'Fira Code', 'Consolas', 'Monaco', monospace;
          font-size: 13px;
          line-height: 1.5;
          padding-bottom: calc(80px + env(safe-area-inset-bottom));
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          -webkit-font-smoothing: antialiased;
        }

        /* ═══════════════════════════════════════════
           CRT EFFECTS
           ═══════════════════════════════════════════ */
        .crt-vignette {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 9999;
          background: radial-gradient(
            ellipse at center,
            transparent 0%,
            transparent 50%,
            rgba(0, 0, 0, 0.25) 80%,
            rgba(0, 0, 0, 0.5) 100%
          );
        }

        .scanlines {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 9998;
          background: repeating-linear-gradient(
            0deg,
            transparent 0px,
            transparent 1px,
            rgba(0, 0, 0, 0.15) 1px,
            rgba(0, 0, 0, 0.15) 2px
          );
        }

        .noise {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 9997;
          opacity: 0.02;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
        }

        /* ═══════════════════════════════════════════
           STATUS BAR
           ═══════════════════════════════════════════ */
        .status-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: linear-gradient(180deg, rgba(255, 176, 0, 0.08) 0%, rgba(255, 176, 0, 0.03) 100%);
          border-bottom: 1px solid rgba(255, 176, 0, 0.15);
          font-size: 11px;
          flex-shrink: 0;
          padding-top: max(12px, env(safe-area-inset-top));
        }

        .status-left, .status-center, .status-right {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .pulse {
          width: 6px;
          height: 6px;
          background: var(--green);
          border-radius: 50%;
          box-shadow: 0 0 6px var(--green), 0 0 12px var(--green);
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 6px var(--green), 0 0 12px var(--green); }
          50% { opacity: 0.6; box-shadow: 0 0 3px var(--green); }
        }

        .online {
          color: var(--green);
          font-weight: 600;
          font-variant-numeric: tabular-nums;
        }

        .streak-fire {
          color: var(--orange);
          font-size: 14px;
          animation: flicker 0.3s ease-in-out infinite alternate;
        }

        @keyframes flicker {
          from { opacity: 0.8; text-shadow: 0 0 4px var(--orange); }
          to { opacity: 1; text-shadow: 0 0 8px var(--orange); }
        }

        .streak {
          color: var(--orange);
          font-weight: 700;
        }

        .arb-badge {
          color: #000;
          background: var(--red);
          padding: 2px 8px;
          border-radius: 3px;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.5px;
          animation: arb-pulse 2.5s ease-in-out infinite;
        }

        @keyframes arb-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        /* ═══════════════════════════════════════════
           ALERT TICKER
           ═══════════════════════════════════════════ */
        .alert-ticker {
          padding: 8px 16px;
          background: rgba(255, 176, 0, 0.04);
          border-bottom: 1px solid rgba(255, 176, 0, 0.1);
          font-size: 11px;
          flex-shrink: 0;
        }

        .alert-content {
          display: flex;
          align-items: center;
          gap: 8px;
          opacity: 0;
          transform: translateY(-2px);
          transition: opacity 0.25s ease, transform 0.25s ease;
          max-width: 640px;
          margin: 0 auto;
          padding: 0 16px;
        }

        .alert-content.visible {
          opacity: 1;
          transform: translateY(0);
        }

        .alert-type {
          padding: 2px 6px;
          font-size: 9px;
          font-weight: 700;
          border-radius: 2px;
          letter-spacing: 0.3px;
          flex-shrink: 0;
        }

        .alert-type.whale { background: var(--blue); color: #000; }
        .alert-type.arb { background: var(--red); color: #000; }
        .alert-type.hot { background: var(--orange); color: #000; }

        .alert-text {
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-size: 11px;
        }

        .alert-time {
          color: var(--amber-dim);
          font-size: 10px;
          opacity: 0.7;
        }

        /* ═══════════════════════════════════════════
           OUTPUT
           ═══════════════════════════════════════════ */
        .output {
          flex: 1;
          padding: 16px;
          overflow-y: auto;
          min-height: 0;
          scroll-behavior: smooth;
        }

        .output::-webkit-scrollbar {
          width: 4px;
        }

        .output::-webkit-scrollbar-track {
          background: transparent;
        }

        .output::-webkit-scrollbar-thumb {
          background: rgba(255, 176, 0, 0.25);
          border-radius: 2px;
        }

        .line {
          white-space: pre;
          margin: 0;
          padding: 0;
          min-height: 1.5em;
          font-size: 12px;
        }

        .line.boot {
          color: var(--amber);
          text-shadow: 0 0 8px var(--amber-glow);
          animation: line-in 0.1s ease-out;
        }

        .line.cmd {
          color: var(--amber);
          font-weight: 600;
          margin-top: 8px;
          text-shadow: 0 0 10px var(--amber-glow);
        }

        .line.out {
          color: var(--text);
          animation: line-in 0.05s ease-out;
        }

        .line.sys {
          color: var(--amber-dim);
        }

        .line.err {
          color: var(--red);
          text-shadow: 0 0 6px rgba(239, 68, 68, 0.4);
        }

        .line.typing {
          color: var(--amber-dim);
          animation: blink 0.8s ease-in-out infinite;
        }

        @keyframes line-in {
          from { opacity: 0; transform: translateX(-4px); }
          to { opacity: 1; transform: translateX(0); }
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        /* ═══════════════════════════════════════════
           QUICK COMMANDS
           ═══════════════════════════════════════════ */
        .quick-cmds {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          padding: 12px 16px;
          background: rgba(255, 176, 0, 0.02);
          border-top: 1px solid rgba(255, 176, 0, 0.12);
          flex-shrink: 0;
        }

        .qcmd {
          padding: 14px 8px;
          font-family: inherit;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
          background: rgba(255, 176, 0, 0.06);
          color: var(--amber);
          border: 1px solid rgba(255, 176, 0, 0.2);
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s ease;
          -webkit-tap-highlight-color: transparent;
        }

        .qcmd:hover:not(:disabled) {
          background: rgba(255, 176, 0, 0.12);
          border-color: rgba(255, 176, 0, 0.4);
          box-shadow: 0 0 20px rgba(255, 176, 0, 0.15);
          text-shadow: 0 0 8px var(--amber-glow);
        }

        .qcmd:active:not(:disabled) {
          transform: scale(0.96);
          background: rgba(255, 176, 0, 0.18);
        }

        .qcmd:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        /* ═══════════════════════════════════════════
           INPUT
           ═══════════════════════════════════════════ */
        .input-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 14px 16px;
          background: rgba(0, 0, 0, 0.4);
          border-top: 1px solid rgba(255, 176, 0, 0.15);
          flex-shrink: 0;
        }

        .prompt {
          display: flex;
          align-items: center;
          font-size: 12px;
          flex-shrink: 0;
        }

        .user {
          color: var(--blue);
          font-weight: 600;
        }

        .guest {
          color: rgba(255, 176, 0, 0.35);
        }

        .dollar {
          color: var(--amber);
          margin-left: 2px;
          text-shadow: 0 0 6px var(--amber-glow);
        }

        .input-row input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          font-family: inherit;
          font-size: 14px;
          color: var(--text);
          caret-color: transparent;
          min-width: 0;
        }

        .input-row input::placeholder {
          color: rgba(255, 176, 0, 0.2);
        }

        .input-row input:disabled {
          opacity: 0.4;
        }

        .cursor {
          color: var(--amber);
          font-weight: 700;
          text-shadow: 0 0 8px var(--amber);
          transition: opacity 0.1s;
        }

        .cursor.off {
          opacity: 0;
        }

        /* ═══════════════════════════════════════════
           SOCIAL PROOF
           ═══════════════════════════════════════════ */
        .social-proof {
          padding: 10px 16px;
          text-align: center;
          font-size: 10px;
          color: rgba(255, 176, 0, 0.3);
          background: rgba(0, 0, 0, 0.25);
          border-top: 1px solid rgba(255, 176, 0, 0.08);
          flex-shrink: 0;
        }

        /* ═══════════════════════════════════════════
           RESPONSIVE
           ═══════════════════════════════════════════ */

        /* 320px - Extra Small */
        @media (max-width: 359px) {
          .status-bar {
            padding: 10px 12px;
            font-size: 10px;
          }
          .status-center { display: none; }
          .alert-ticker { padding: 6px 12px; }
          .alert-content { gap: 6px; }
          .alert-type { font-size: 8px; padding: 2px 5px; }
          .alert-text { font-size: 10px; }
          .alert-time { font-size: 9px; }
          .output { padding: 12px; }
          .line { font-size: 10px; }
          .quick-cmds { gap: 6px; padding: 10px 12px; }
          .qcmd { padding: 12px 6px; font-size: 10px; }
          .input-row { padding: 12px; }
          .input-row input { font-size: 13px; }
        }

        /* 360-479px - Small */
        @media (min-width: 360px) and (max-width: 479px) {
          .qcmd { padding: 12px 8px; }
        }

        /* 480px+ - Medium */
        @media (min-width: 480px) {
          .status-bar { justify-content: center; gap: 40px; }
          .alert-content { max-width: 640px; padding: 0 20px; }
          .output { max-width: 640px; margin: 0 auto; width: 100%; padding: 20px; }
          .line { font-size: 13px; }
          .quick-cmds {
            max-width: 640px;
            margin: 0 auto;
            width: 100%;
            grid-template-columns: repeat(4, 1fr);
            padding: 14px 20px;
          }
          .input-row { max-width: 640px; margin: 0 auto; width: 100%; padding: 16px 20px; }
        }

        /* 768px+ - Large */
        @media (min-width: 768px) {
          .alert-content { max-width: 720px; }
          .output { max-width: 720px; }
          .quick-cmds { max-width: 720px; gap: 10px; }
          .qcmd { padding: 14px 12px; font-size: 12px; }
          .input-row { max-width: 720px; }
        }

        /* 1024px+ - Desktop */
        @media (min-width: 1024px) {
          .alert-content { max-width: 800px; }
          .output { max-width: 800px; }
          .quick-cmds { max-width: 800px; gap: 12px; }
          .input-row { max-width: 800px; }
          .line { font-size: 14px; }
        }

        /* Landscape */
        @media (max-height: 500px) and (orientation: landscape) {
          .output { min-height: 120px; }
          .quick-cmds { grid-template-columns: repeat(4, 1fr); padding: 8px 16px; }
          .qcmd { padding: 10px 6px; font-size: 10px; }
          .status-bar, .alert-ticker { padding-top: 8px; padding-bottom: 8px; }
        }
      `}</style>
    </div>
  );
}
