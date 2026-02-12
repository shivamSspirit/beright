'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import BottomNav from '@/components/BottomNav';
import { usePrivy } from '@privy-io/react-auth';
import { getHotMarkets, getArbitrageOpportunities, searchMarkets as apiSearchMarkets, getIntel } from '@/lib/api';

// ═══════════════════════════════════════════════════════════════
// BERIGHT TERMINAL v4.0 - Neo-CRT Phosphor Edition
// Deep greens, pixel-perfect, immersive CRT experience
// ═══════════════════════════════════════════════════════════════

interface OutputLine {
  id: string;
  type: 'cmd' | 'out' | 'sys' | 'err' | 'alert' | 'boot' | 'success' | 'highlight';
  text: string;
}

interface LiveAlert {
  id: string;
  type: 'whale' | 'arb' | 'hot';
  text: string;
  time: string;
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

// ═══════════════════════════════════════════════════════════════
// SMART INPUT HANDLING - Same as Telegram bot
// ═══════════════════════════════════════════════════════════════

// Detect if text looks like a legitimate market/topic query
function looksLikeMarketQuery(text: string): boolean {
  const lower = text.toLowerCase().trim();

  // Too short to be a real query
  if (lower.length < 4) return false;

  // Common non-market patterns to REJECT
  const nonMarketPatterns = [
    /^(hi|hello|hey|yo|sup|hola|greetings)/i,
    /^(show|give|tell|get|display|print|list)\s+(me\s+)?(the\s+)?(logs?|errors?|status|config|settings|info|data|users?|messages?)/i,
    /^(who|what)\s+(are|is)\s+(you|this|beright)/i,
    /^(can|do|will|how)\s+you/i,
    /^(help|assist|support)$/i,
    /^(test|testing|debug|check)$/i,
    /^(thanks?|thank\s+you|ok|okay|cool|nice|great|good|awesome)$/i,
    /^what\s+can\s+(you|i)/i,
    /^how\s+(do|does|to)/i,
    /^(this|that|it)\s+(is|was|doesn't|does not)/i,
  ];

  for (const pattern of nonMarketPatterns) {
    if (pattern.test(lower)) return false;
  }

  // Market-related keywords that SUGGEST a real query
  const marketKeywords = [
    'price', 'market', 'odds', 'bet', 'predict', 'election', 'trump', 'biden',
    'bitcoin', 'btc', 'eth', 'crypto', 'stock', 'fed', 'rate', 'inflation',
    'war', 'ukraine', 'china', 'taiwan', 'ai', 'gpt', 'openai', 'tesla',
    'apple', 'google', 'microsoft', 'amazon', 'nvidia', 'meta', 'spacex',
    'senate', 'house', 'congress', 'supreme', 'court', 'impeach', 'indictment',
    'gdp', 'recession', 'unemployment', 'cpi', 'earnings', 'ipo', 'merger',
    'championship', 'super bowl', 'world cup', 'olympics', 'nba', 'nfl',
    'will', 'when', 'who wins', 'chance', 'probability', 'likelihood',
  ];

  for (const keyword of marketKeywords) {
    if (lower.includes(keyword)) return true;
  }

  if (lower.includes('?') || lower.startsWith('will ') || lower.startsWith('what if')) {
    return true;
  }

  return false;
}

// Handle freeform non-command input - returns lines to display or null
function handleFreeformInput(text: string): string[] | null {
  const lower = text.toLowerCase().trim();

  // Greetings
  if (/^(hi|hello|hey|yo|sup|hola|greetings)/i.test(lower)) {
    return [
      '',
      ' ╔══════════════════════════════════════════╗',
      ' ║  BERIGHT TERMINAL                        ║',
      ' ╚══════════════════════════════════════════╝',
      '',
      ' Hey! I\'m BeRight - your prediction market',
      ' intelligence terminal.',
      '',
      ' Try these commands:',
      '   /hot     Trending markets',
      '   /arb     Arbitrage opportunities',
      '   /news    Market intelligence',
      '',
      ' Or search for a topic like "bitcoin" or "election"',
      '',
    ];
  }

  // Who are you / What is this
  if (/^(who|what)\s+(are|is)\s+(you|this|beright)/i.test(lower)) {
    return [
      '',
      ' ╔══════════════════════════════════════════╗',
      ' ║  ABOUT BERIGHT                           ║',
      ' ╚══════════════════════════════════════════╝',
      '',
      ' BeRight is a prediction market intelligence',
      ' terminal that helps you:',
      '',
      ' ▓ Find mispriced markets & arbitrage',
      ' ▓ Analyze odds across platforms',
      ' ▓ Track smart money activity',
      ' ▓ Improve your forecasting accuracy',
      '',
      ' I\'m not a general chatbot - I\'m specialized',
      ' for prediction markets.',
      '',
      ' Type /help to see all commands.',
      '',
    ];
  }

  // What can you do
  if (/^what\s+can\s+(you|i)/i.test(lower) || /^(can|do)\s+you/i.test(lower)) {
    return [
      '',
      ' ╔══════════════════════════════════════════╗',
      ' ║  CAPABILITIES                            ║',
      ' ╚══════════════════════════════════════════╝',
      '',
      ' ► MARKET ANALYSIS',
      '   /hot      Trending markets',
      '   /predict  Search markets',
      '',
      ' ► TRADING',
      '   /arb      Find arbitrage',
      '   /news     Market intelligence',
      '',
      ' ► PROFILE',
      '   /me       Your forecaster stats',
      '',
      ' Type /help for the full command list.',
      '',
    ];
  }

  // System/admin requests
  if (/^(show|give|tell|get|display|print|list)\s+(me\s+)?(the\s+)?(logs?|errors?|status|config|settings|data|users?|messages?|secrets?|keys?|env)/i.test(lower)) {
    return [
      '',
      ' ▓ I\'m a prediction market terminal,',
      '   not a system admin tool.',
      '',
      ' I can help you with:',
      '   /hot   Market trends',
      '   /arb   Arbitrage opportunities',
      '   /news  Market intelligence',
      '',
      ' What market topic interests you?',
      '',
    ];
  }

  // Thanks / acknowledgments
  if (/^(thanks?|thank\s+you|ok|okay|cool|nice|great|good|awesome|got\s+it)$/i.test(lower)) {
    return [
      '',
      ' ▓ You\'re welcome!',
      '',
      ' Quick actions:',
      '   /hot   What\'s trending',
      '   /arb   Arbitrage scanner',
      '   /news  Latest intel',
      '',
    ];
  }

  // Not a recognized pattern
  return null;
}

const STATIC_OUTPUTS: Record<string, string[]> = {
  '/help': [
    '',
    ' ╔══════════════════════════════════════════╗',
    ' ║  BERIGHT TERMINAL v4.0                   ║',
    ' ║  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   ║',
    ' ║  [ LIVE DATA STREAM :: ACTIVE ]          ║',
    ' ╚══════════════════════════════════════════╝',
    '',
    ' ► COMMANDS ─────────────────────────────────',
    '',
    '   /hot      █ Trending markets       [LIVE]',
    '   /arb      █ Arbitrage scanner      [LIVE]',
    '   /news     █ Market intelligence    [LIVE]',
    '   /predict  █ Search markets              ',
    '   /me       █ Forecaster profile          ',
    '   /clear    █ Clear buffer                ',
    '   /help     █ This message                ',
    '',
    ' ► SHORTCUTS ────────────────────────────────',
    '',
    '   [TAB]     Autocomplete',
    '   [↑/↓]     History navigation',
    '',
    ' ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓',
    ' Ready for input...',
    '',
  ],
  '/me': [
    '',
    ' ╔══════════════════════════════════════════╗',
    ' ║  FORECASTER PROFILE                      ║',
    ' ╚══════════════════════════════════════════╝',
    '',
    ' ACCURACY ░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 68.5%',
    ' ████████████████████░░░░░░░░░░░░░░░░░░░░░░░',
    '',
    ' BRIER SCORE     0.187 (Good)',
    ' PREDICTIONS     127 total',
    ' RESOLVED        89 │ PENDING 38',
    '',
    ' ┌─────────────────────────────────────────┐',
    ' │  VS AI BENCHMARK                        │',
    ' ├─────────────────────────────────────────┤',
    ' │                                         │',
    ' │  YOU  ████████████████░░░░  68.5%      │',
    ' │  AI   ███████████████░░░░░  65.3%      │',
    ' │                                         │',
    ' │  ▓▓▓ OUTPERFORMING AI +3.2% ▓▓▓        │',
    ' │  Record: 42W - 31L                     │',
    ' │                                         │',
    ' └─────────────────────────────────────────┘',
    '',
    ' RANK   ► Top 15%',
    ' STREAK ► 7 consecutive wins',
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
    { id: '1', type: 'hot', text: 'Initializing data feed...', time: 'now' },
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
    const interval = setInterval(fetchAlerts, 60000);
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
        { text: '░▒▓ BERIGHT TERMINAL v4.0 ▓▒░', delay: 60 },
        { text: '', delay: 40 },
        { text: '> Establishing secure connection...', delay: 100 },
        { text: '', delay: 30 },
        { text: '  ░░░░░░░░░░░░░░░░░░░░  0%', delay: 80 },
        { text: '  ████░░░░░░░░░░░░░░░░ 20%  Polymarket', delay: 80 },
        { text: '  ████████░░░░░░░░░░░░ 40%  Kalshi', delay: 80 },
        { text: '  ████████████░░░░░░░░ 60%  Manifold', delay: 80 },
        { text: '  ████████████████░░░░ 80%  DFlow', delay: 80 },
        { text: '  ████████████████████ 100% COMPLETE', delay: 100 },
        { text: '', delay: 40 },
        { text: '> Data streams: ACTIVE', delay: 60 },
        { text: '> Encryption: VERIFIED', delay: 60 },
        { text: '> Latency: 12ms', delay: 60 },
        { text: '', delay: 40 },
        { text: ' ╔══════════════════════════════════════╗', delay: 20 },
        { text: ' ║  ▓▓▓ SYSTEM ONLINE ▓▓▓               ║', delay: 20 },
        { text: ' ║  Type /help for commands             ║', delay: 20 },
        { text: ' ╚══════════════════════════════════════╝', delay: 20 },
        { text: '', delay: 40 },
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
      await new Promise(r => setTimeout(r, 10));
      setOutput(prev => [...prev, {
        id: `out-${Date.now()}-${Math.random()}`,
        type: 'out',
        text,
      }]);
    }
    setIsTyping(false);
  }, []);

  const addLine = useCallback((text: string, type: 'out' | 'sys' | 'err' | 'success' | 'highlight' = 'out') => {
    setOutput(prev => [...prev, {
      id: `${type}-${Date.now()}-${Math.random()}`,
      type,
      text,
    }]);
  }, []);

  // Fetch and format hot markets
  const fetchHotMarkets = useCallback(async () => {
    addLine('> Querying live market data...', 'sys');

    try {
      const data = await getHotMarkets(5);

      const lines: string[] = [
        '',
        ' ╔══════════════════════════════════════════╗',
        ' ║  TRENDING MARKETS                  [LIVE]║',
        ' ╚══════════════════════════════════════════╝',
        '',
      ];

      if (data.markets?.length > 0) {
        data.markets.forEach((m, i: number) => {
          const platform = m.platform.toUpperCase().slice(0, 4);
          lines.push(` ${String(i + 1).padStart(2, '0')} ▓ ${truncate(m.title, 35)}`);
          lines.push(`    ${progressBar(m.yesPct)} ${m.yesPct}%`);
          lines.push(`    VOL ${formatVol(m.volume)} │ ${platform}`);
          lines.push('');
        });
      } else {
        lines.push(' No markets found');
      }

      lines.push(` ▓▓▓ Updated: ${new Date().toLocaleTimeString()} ▓▓▓`);
      lines.push('');

      await typeOut(lines);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Unknown error';
      addLine(` ▓ ERROR: ${errMsg}`, 'err');
      console.error('Hot markets error:', e);
    }
  }, [addLine, typeOut]);

  // Fetch and format arbitrage
  const fetchArbitrage = useCallback(async () => {
    addLine('> Scanning cross-platform opportunities...', 'sys');

    try {
      const data = await getArbitrageOpportunities();

      const lines: string[] = [
        '',
        ' ╔══════════════════════════════════════════╗',
        ' ║  ARBITRAGE SCANNER                 [LIVE]║',
        ' ╚══════════════════════════════════════════╝',
        '',
      ];

      if (data.opportunities?.length > 0) {
        lines.push(` ▓▓▓ FOUND ${data.opportunities.length} OPPORTUNITIES ▓▓▓`);
        lines.push('');

        data.opportunities.slice(0, 5).forEach((a, i: number) => {
          lines.push(` [${String(i + 1).padStart(2, '0')}] ${truncate(a.topic, 34)}`);
          const pctA = Math.round(a.priceA * 100);
          const pctB = Math.round(a.priceB * 100);
          lines.push(`      ${a.platformA}: ${pctA}% │ ${a.platformB}: ${pctB}%`);
          lines.push(`      SPREAD: +${a.spread.toFixed(1)}%`);
          lines.push(`      ${a.strategy}`);
          lines.push('');
        });
      } else {
        lines.push(' No arbitrage opportunities detected');
        lines.push(' Minimum spread threshold: 3%');
      }

      lines.push(` ▓▓▓ Scanned: ${data.scannedAt ? new Date(data.scannedAt).toLocaleTimeString() : new Date().toLocaleTimeString()} ▓▓▓`);
      lines.push('');

      await typeOut(lines);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Unknown error';
      addLine(` ▓ ERROR: ${errMsg}`, 'err');
      console.error('Arbitrage error:', e);
    }
  }, [addLine, typeOut]);

  // Fetch and format news
  const fetchNews = useCallback(async () => {
    addLine('> Fetching market intelligence...', 'sys');

    try {
      const data = await getIntel('prediction markets', 'news');

      const lines: string[] = [
        '',
        ' ╔══════════════════════════════════════════╗',
        ' ║  MARKET INTELLIGENCE               [LIVE]║',
        ' ╚══════════════════════════════════════════╝',
        '',
        ' ► LATEST HEADLINES',
        '',
      ];

      if (data.news?.length > 0) {
        data.news.slice(0, 5).forEach((a) => {
          lines.push(`   ${truncate(a.title, 41)}`);
          const date = a.publishedAt ? new Date(a.publishedAt).toLocaleDateString() : 'Recent';
          lines.push(`   └─ ${date} │ ${a.source}`);
          lines.push('');
        });
      } else {
        lines.push(' No recent news found');
      }

      lines.push(` ▓▓▓ Updated: ${new Date().toLocaleTimeString()} ▓▓▓`);
      lines.push('');

      await typeOut(lines);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Unknown error';
      addLine(` ▓ ERROR: ${errMsg}`, 'err');
      console.error('News error:', e);
    }
  }, [addLine, typeOut]);

  // Search markets
  const searchMarkets = useCallback(async (query: string) => {
    addLine(`> Searching "${query}"...`, 'sys');

    try {
      const data = await apiSearchMarkets(query, { limit: 5 });

      const lines: string[] = [
        '',
        ` ╔══════════════════════════════════════════╗`,
        ` ║  SEARCH: "${truncate(query, 27)}"`,
        ` ╚══════════════════════════════════════════╝`,
        '',
      ];

      if (data.markets?.length > 0) {
        lines.push(` ► Found ${data.markets.length} markets`);
        lines.push('');

        data.markets.forEach((m, i: number) => {
          lines.push(` ${String(i + 1).padStart(2, '0')}. ${truncate(m.title, 37)}`);
          lines.push(`     ${m.yesPct}% YES │ ${formatVol(m.volume)} │ ${m.platform}`);
          lines.push('');
        });
      } else {
        lines.push(' No markets found matching query');
      }

      lines.push('');
      await typeOut(lines);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Unknown error';
      addLine(` ▓ ERROR: ${errMsg}`, 'err');
      console.error('Search error:', e);
    }
  }, [addLine, typeOut]);

  const exec = useCallback(async (cmd: string) => {
    const c = cmd.trim().toLowerCase();

    setOutput(prev => [...prev, {
      id: `cmd-${Date.now()}`,
      type: 'cmd',
      text: `▓ ${cmd}`,
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
      addLine(' ▓ ERROR: Wallet connection required', 'err');
      return;
    }

    if (STATIC_OUTPUTS[c]) {
      await typeOut(STATIC_OUTPUTS[c]);
      return;
    }

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
        addLine(' Usage: /predict <search query>', 'err');
      }
    } else if (c.startsWith('/')) {
      addLine(` Unknown command: ${c}`, 'err');
      addLine(' Type /help for available commands', 'sys');
    } else if (c) {
      // Smart input handling - check if it's a greeting, meta question, etc.
      const freeformResponse = handleFreeformInput(c);
      if (freeformResponse) {
        await typeOut(freeformResponse);
        return;
      }

      // Only search markets if it looks like a legitimate topic
      if (looksLikeMarketQuery(c)) {
        await searchMarkets(c);
      } else {
        // Default: explain what the terminal does
        await typeOut([
          '',
          ' ╔══════════════════════════════════════════╗',
          ' ║  BERIGHT TERMINAL                        ║',
          ' ╚══════════════════════════════════════════╝',
          '',
          ' I\'m your prediction market intelligence',
          ' terminal. I help you find opportunities',
          ' and make better forecasts.',
          '',
          ' Try these:',
          '   /hot       Trending markets',
          '   /arb       Arbitrage opportunities',
          '   /news      Market intelligence',
          '   /predict   Search markets',
          '',
          ' Or ask about a topic like "bitcoin" or',
          ' "fed rate" to search markets.',
          '',
          ' Type /help for all commands.',
          '',
        ]);
      }
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
      {/* CRT Effects Layer */}
      <div className="crt-overlay" />
      <div className="crt-vignette" />
      <div className="scanlines" />
      <div className="flicker" />

      {/* Status Bar */}
      <div className="status-bar">
        <div className="pill online">
          <span className="pill-dot" />
          <span className="pill-text">{onlineCount.toLocaleString()} online</span>
        </div>
        <div className="pill streak">
          <span className="pill-text">{streak} day streak</span>
        </div>
        <div className="pill arb">
          <span className="pill-text">{arbCount || '0'} arb</span>
        </div>
      </div>

      {/* Alert Ticker */}
      <div className="alert-ticker">
        <div className={`alert-content ${alertFade ? 'visible' : ''}`}>
          <span className={`alert-type ${currentAlert?.type || 'hot'}`}>
            ▓ {(currentAlert?.type || 'LIVE').toUpperCase()}
          </span>
          <span className="alert-text">{currentAlert?.text || 'Loading...'}</span>
        </div>
      </div>

      {/* Terminal Output */}
      <main className="output" ref={outputRef}>
        {output.map(line => (
          <div key={line.id} className={`line ${line.type}`}>
            {line.text || '\u00A0'}
          </div>
        ))}
        {isTyping && <div className="line typing">█</div>}
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
            <span className="qcmd-icon">▓</span>
            <span className="qcmd-text">{cmd.slice(1).toUpperCase()}</span>
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
          <span className="prompt-symbol">►</span>
        </span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={!bootComplete ? 'initializing...' : isTyping ? '' : 'enter command or search...'}
          disabled={isTyping || !bootComplete}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        <span className={`cursor ${showCursor && bootComplete ? '' : 'off'}`}>█</span>
      </form>

      {/* Footer */}
      <footer className="social-proof">
        <span className="proof-bar">▓▓▓</span>
        <span>{predCount.toLocaleString()} predictions in the last hour</span>
        <span className="proof-bar">▓▓▓</span>
      </footer>

      <BottomNav />

      <style jsx>{`
        /* ═══════════════════════════════════════════
           NEO-CRT PHOSPHOR COLOR SYSTEM
           Deep, saturated, rich greens with true blacks
           ═══════════════════════════════════════════ */
        .term {
          /* Primary phosphor greens - deep and saturated */
          --phosphor: #20C20E;
          --phosphor-bright: #33FF33;
          --phosphor-dim: #1A9E0B;
          --phosphor-dark: #0D5F07;
          --phosphor-glow: rgba(32, 194, 14, 0.6);
          --phosphor-subtle: rgba(32, 194, 14, 0.12);

          /* Accent colors */
          --amber: #FFB000;
          --amber-glow: rgba(255, 176, 0, 0.5);
          --crimson: #FF2D2D;
          --crimson-glow: rgba(255, 45, 45, 0.5);
          --cyan: #00BFFF;
          --cyan-glow: rgba(0, 191, 255, 0.5);

          /* Background - true black with subtle green tint */
          --bg-black: #000000;
          --bg-dark: #020502;
          --bg-panel: #040804;

          /* Text */
          --text-bright: #EAFFEA;
          --text-dim: rgba(234, 255, 234, 0.4);
        }

        /* ═══════════════════════════════════════════
           BASE LAYOUT
           ═══════════════════════════════════════════ */
        .term {
          min-height: 100dvh;
          background: var(--bg-black);
          color: var(--phosphor);
          font-family: 'IBM Plex Mono', 'SF Mono', 'Consolas', monospace;
          font-size: 13px;
          line-height: 1.5;
          letter-spacing: 0.02em;
          padding-bottom: calc(80px + env(safe-area-inset-bottom));
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          -webkit-font-smoothing: none;
          -moz-osx-font-smoothing: unset;
          image-rendering: pixelated;
        }

        /* ═══════════════════════════════════════════
           CRT EFFECTS - IMMERSIVE LAYER
           ═══════════════════════════════════════════ */
        .crt-overlay {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 9996;
          background:
            radial-gradient(ellipse at center, transparent 0%, rgba(0, 15, 0, 0.15) 100%);
        }

        .crt-vignette {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 9999;
          box-shadow:
            inset 0 0 150px 60px rgba(0, 0, 0, 0.9),
            inset 0 0 80px 30px rgba(0, 0, 0, 0.6);
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
            rgba(0, 0, 0, 0.3) 1px,
            rgba(0, 0, 0, 0.3) 2px
          );
          opacity: 0.8;
        }

        .flicker {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 9997;
          animation: flicker 0.15s infinite;
          opacity: 0.02;
          background: var(--phosphor);
        }

        @keyframes flicker {
          0% { opacity: 0.02; }
          50% { opacity: 0.018; }
          100% { opacity: 0.02; }
        }

        /* ═══════════════════════════════════════════
           STATUS BAR - Clean Pill Design
           ═══════════════════════════════════════════ */
        .status-bar {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 10px;
          padding: 16px 20px;
          padding-top: max(16px, env(safe-area-inset-top));
          background: var(--bg-black);
          flex-shrink: 0;
        }

        .pill {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          border-radius: 100px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.3px;
        }

        .pill-text {
          font-variant-numeric: tabular-nums;
        }

        /* Online - Green */
        .pill.online {
          background: rgba(0, 255, 85, 0.15);
          border: 2px solid #00FF55;
        }

        .pill.online .pill-dot {
          width: 8px;
          height: 8px;
          background: #00FF55;
          border-radius: 50%;
          animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .pill.online .pill-text {
          color: #00FF55;
        }

        /* Streak - Orange */
        .pill.streak {
          background: rgba(255, 165, 0, 0.15);
          border: 2px solid #FFA500;
        }

        .pill.streak .pill-text {
          color: #FFA500;
        }

        /* ARB - Red */
        .pill.arb {
          background: rgba(255, 68, 68, 0.15);
          border: 2px solid #FF4444;
        }

        .pill.arb .pill-text {
          color: #FF4444;
        }

        /* ═══════════════════════════════════════════
           ALERT TICKER
           ═══════════════════════════════════════════ */
        .alert-ticker {
          padding: 10px 20px;
          background: linear-gradient(90deg, var(--bg-dark) 0%, var(--bg-panel) 50%, var(--bg-dark) 100%);
          border-bottom: 1px solid var(--phosphor-dark);
          font-size: 12px;
          flex-shrink: 0;
          overflow: hidden;
        }

        .alert-content {
          display: flex;
          align-items: center;
          gap: 12px;
          opacity: 0;
          transform: translateY(-4px);
          transition: all 0.3s ease;
          max-width: 800px;
          margin: 0 auto;
        }

        .alert-content.visible {
          opacity: 1;
          transform: translateY(0);
        }

        .alert-type {
          padding: 4px 10px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1px;
          flex-shrink: 0;
        }

        .alert-type.whale {
          background: var(--cyan);
          color: var(--bg-black);
          box-shadow: 0 0 10px var(--cyan-glow);
        }
        .alert-type.arb {
          background: var(--crimson);
          color: #fff;
          box-shadow: 0 0 10px var(--crimson-glow);
        }
        .alert-type.hot {
          background: var(--amber);
          color: var(--bg-black);
          box-shadow: 0 0 10px var(--amber-glow);
        }

        .alert-text {
          color: var(--text-bright);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* ═══════════════════════════════════════════
           OUTPUT - THE TERMINAL HEART
           ═══════════════════════════════════════════ */
        .output {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
          min-height: 0;
          scroll-behavior: smooth;
          background: var(--bg-black);
        }

        .output::-webkit-scrollbar {
          width: 8px;
        }

        .output::-webkit-scrollbar-track {
          background: var(--bg-dark);
        }

        .output::-webkit-scrollbar-thumb {
          background: var(--phosphor-dark);
          border: 1px solid var(--phosphor-dim);
        }

        .output::-webkit-scrollbar-thumb:hover {
          background: var(--phosphor-dim);
        }

        .line {
          white-space: pre;
          margin: 0;
          padding: 0;
          min-height: 1.5em;
          font-size: 12px;
        }

        .line.boot {
          color: var(--phosphor-bright);
          text-shadow:
            0 0 2px var(--phosphor),
            0 0 5px var(--phosphor-glow),
            0 0 10px var(--phosphor-glow);
          animation: line-glow 0.1s ease-out;
        }

        .line.cmd {
          color: var(--phosphor-bright);
          font-weight: 700;
          margin-top: 16px;
          text-shadow:
            0 0 3px var(--phosphor),
            0 0 8px var(--phosphor-glow),
            0 0 15px var(--phosphor-glow);
        }

        .line.out {
          color: var(--phosphor);
          text-shadow: 0 0 2px var(--phosphor-glow);
          animation: line-in 0.05s ease-out;
        }

        .line.sys {
          color: var(--phosphor-dim);
          font-style: italic;
          text-shadow: 0 0 2px rgba(26, 158, 11, 0.3);
        }

        .line.err {
          color: var(--crimson);
          text-shadow:
            0 0 3px var(--crimson),
            0 0 8px var(--crimson-glow);
        }

        .line.success {
          color: var(--phosphor-bright);
          text-shadow:
            0 0 5px var(--phosphor),
            0 0 10px var(--phosphor-glow);
        }

        .line.highlight {
          color: var(--amber);
          text-shadow: 0 0 8px var(--amber-glow);
        }

        .line.typing {
          color: var(--phosphor-bright);
          text-shadow: 0 0 8px var(--phosphor-glow);
          animation: cursor-blink 0.6s step-end infinite;
        }

        @keyframes line-glow {
          from { opacity: 0.5; text-shadow: 0 0 20px var(--phosphor); }
          to { opacity: 1; }
        }

        @keyframes line-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }

        /* ═══════════════════════════════════════════
           QUICK COMMANDS
           ═══════════════════════════════════════════ */
        .quick-cmds {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          padding: 14px 20px;
          background: var(--bg-panel);
          border-top: 2px solid var(--phosphor-dark);
          flex-shrink: 0;
        }

        .qcmd {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 14px 8px;
          font-family: inherit;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1px;
          background: var(--bg-dark);
          color: var(--phosphor);
          border: 1px solid var(--phosphor-dark);
          cursor: pointer;
          transition: all 0.15s ease;
          -webkit-tap-highlight-color: transparent;
        }

        .qcmd-icon {
          color: var(--phosphor-dim);
        }

        .qcmd:hover:not(:disabled) {
          background: var(--phosphor-dark);
          border-color: var(--phosphor);
          color: var(--phosphor-bright);
          text-shadow: 0 0 8px var(--phosphor-glow);
          box-shadow:
            0 0 15px var(--phosphor-glow),
            inset 0 0 20px rgba(32, 194, 14, 0.1);
        }

        .qcmd:hover:not(:disabled) .qcmd-icon {
          color: var(--phosphor-bright);
        }

        .qcmd:active:not(:disabled) {
          transform: scale(0.98);
          background: var(--phosphor-dim);
        }

        .qcmd:disabled {
          opacity: 0.25;
          cursor: not-allowed;
        }

        /* ═══════════════════════════════════════════
           INPUT ROW
           ═══════════════════════════════════════════ */
        .input-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 16px 20px;
          background: var(--bg-dark);
          border-top: 1px solid var(--phosphor-dark);
          flex-shrink: 0;
        }

        .prompt {
          display: flex;
          align-items: center;
          font-size: 13px;
          flex-shrink: 0;
          gap: 6px;
        }

        .user {
          color: var(--cyan);
          font-weight: 600;
          text-shadow: 0 0 6px var(--cyan-glow);
        }

        .guest {
          color: var(--phosphor-dim);
        }

        .prompt-symbol {
          color: var(--phosphor-bright);
          text-shadow:
            0 0 4px var(--phosphor),
            0 0 8px var(--phosphor-glow);
        }

        .input-row input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          font-family: inherit;
          font-size: 14px;
          color: var(--text-bright);
          caret-color: transparent;
          min-width: 0;
        }

        .input-row input::placeholder {
          color: var(--phosphor-dark);
        }

        .input-row input:disabled {
          opacity: 0.3;
        }

        .cursor {
          color: var(--phosphor-bright);
          text-shadow:
            0 0 5px var(--phosphor),
            0 0 10px var(--phosphor-glow);
          transition: opacity 0.1s;
        }

        .cursor.off {
          opacity: 0;
        }

        /* ═══════════════════════════════════════════
           SOCIAL PROOF FOOTER
           ═══════════════════════════════════════════ */
        .social-proof {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 12px 20px;
          font-size: 11px;
          color: var(--phosphor-dim);
          background: var(--bg-panel);
          border-top: 1px solid var(--phosphor-dark);
          flex-shrink: 0;
        }

        .proof-bar {
          color: var(--phosphor-dark);
          letter-spacing: -2px;
        }

        /* ═══════════════════════════════════════════
           RESPONSIVE DESIGN
           ═══════════════════════════════════════════ */

        @media (max-width: 359px) {
          .status-bar { gap: 6px; padding: 12px 10px; }
          .pill { padding: 8px 12px; font-size: 10px; }
          .alert-ticker { padding: 8px 12px; }
          .alert-text { font-size: 10px; }
          .output { padding: 14px 12px; }
          .line { font-size: 10px; }
          .quick-cmds { gap: 6px; padding: 10px 12px; }
          .qcmd { padding: 12px 6px; font-size: 10px; }
          .qcmd-icon { display: none; }
          .input-row { padding: 12px; }
          .input-row input { font-size: 13px; }
        }

        @media (min-width: 360px) and (max-width: 479px) {
          .pill { padding: 8px 14px; font-size: 11px; }
          .qcmd { padding: 12px 8px; }
        }

        @media (min-width: 480px) {
          .status-bar { gap: 12px; }
          .alert-content { max-width: 700px; }
          .output { max-width: 800px; margin: 0 auto; width: 100%; padding: 24px; }
          .line { font-size: 13px; }
          .quick-cmds {
            max-width: 800px;
            margin: 0 auto;
            width: 100%;
            padding: 16px 24px;
            gap: 12px;
          }
          .input-row { max-width: 800px; margin: 0 auto; width: 100%; padding: 18px 24px; }
        }

        @media (min-width: 768px) {
          .alert-content { max-width: 900px; }
          .output { max-width: 900px; }
          .quick-cmds { max-width: 900px; }
          .qcmd { padding: 16px 12px; font-size: 12px; }
          .input-row { max-width: 900px; }
        }

        @media (min-width: 1024px) {
          .output { max-width: 1000px; }
          .quick-cmds { max-width: 1000px; }
          .input-row { max-width: 1000px; }
          .line { font-size: 14px; }
        }

        @media (max-height: 500px) and (orientation: landscape) {
          .output { min-height: 120px; }
          .quick-cmds { padding: 8px 16px; }
          .qcmd { padding: 10px 6px; font-size: 10px; }
          .status-bar { padding: 8px 16px; }
        }
      `}</style>
    </div>
  );
}
