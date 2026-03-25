'use client';

import { useState } from 'react';
import {
  PageWrapper,
  Section,
  Card,
  useStagger,
} from '@/components/ui';
import styles from './api.module.css';

// ===========================================================================
// Types
// ===========================================================================

interface APIEndpoint {
  id: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  title: string;
  description: string;
  category: string;
  params?: { name: string; type: string; required: boolean; description: string }[];
  response: string;
  example: { request: string; response: string };
}

// ===========================================================================
// API Endpoint Data
// ===========================================================================

const API_ENDPOINTS: APIEndpoint[] = [
  // Markets
  {
    id: 'markets',
    method: 'GET',
    path: '/api/markets',
    title: 'Search Markets',
    description: 'Search and filter prediction markets across all supported platforms.',
    category: 'Markets',
    params: [
      { name: 'q', type: 'string', required: false, description: 'Search query (e.g., "bitcoin", "trump")' },
      { name: 'hot', type: 'boolean', required: false, description: 'Return trending markets only' },
      { name: 'compare', type: 'boolean', required: false, description: 'Include cross-platform comparison data' },
      { name: 'platform', type: 'string', required: false, description: 'Filter by platform: polymarket, kalshi, manifold, metaculus' },
      { name: 'limit', type: 'number', required: false, description: 'Max results (default: 20, max: 100)' },
    ],
    response: 'Array of market objects with prices, volume, and metadata',
    example: {
      request: 'curl "https://beright.io/api/markets?q=bitcoin&hot=true&limit=5"',
      response: `{
  "markets": [
    {
      "id": "btc-100k-march-2026",
      "question": "Bitcoin above $100K by March 2026?",
      "platform": "polymarket",
      "yesPrice": 0.72,
      "noPrice": 0.28,
      "volume": "$4.2M",
      "liquidity": "$890K",
      "endDate": "2026-03-31",
      "category": "crypto",
      "url": "https://polymarket.com/event/..."
    }
  ],
  "count": 1,
  "query": "bitcoin"
}`,
    },
  },
  {
    id: 'markets-hot',
    method: 'GET',
    path: '/api/markets/hot',
    title: 'Hot Markets',
    description: 'Get trending markets ranked by momentum score (volume, price movement, activity).',
    category: 'Markets',
    params: [
      { name: 'limit', type: 'number', required: false, description: 'Max results (default: 20, max: 50)' },
    ],
    response: 'Array of hot markets with momentum scores',
    example: {
      request: 'curl "https://beright.io/api/markets/hot?limit=10"',
      response: `{
  "markets": [
    {
      "id": "fed-rate-march",
      "question": "Fed cuts 50bps at March FOMC?",
      "platform": "kalshi",
      "yesPrice": 0.42,
      "momentumScore": 87,
      "volume24h": "$1.2M",
      "change24h": 8.2,
      "isHot": true
    }
  ]
}`,
    },
  },
  // Arbitrage
  {
    id: 'arbitrage',
    method: 'GET',
    path: '/api/arbitrage',
    title: 'Arbitrage Scanner',
    description: 'Find price discrepancies for the same event across different platforms.',
    category: 'Arbitrage',
    params: [
      { name: 'q', type: 'string', required: false, description: 'Filter by topic (e.g., "crypto", "politics")' },
      { name: 'minSpread', type: 'number', required: false, description: 'Minimum spread percentage (default: 3)' },
      { name: 'limit', type: 'number', required: false, description: 'Max results (default: 20)' },
    ],
    response: 'Array of arbitrage opportunities with profit calculations',
    example: {
      request: 'curl "https://beright.io/api/arbitrage?minSpread=5&limit=10"',
      response: `{
  "opportunities": [
    {
      "id": "arb-trump-win",
      "question": "Trump wins 2028 election?",
      "spread": 7.2,
      "profit": "7.2%",
      "confidence": 0.85,
      "platforms": {
        "buy": { "platform": "kalshi", "side": "YES", "price": 0.48 },
        "sell": { "platform": "polymarket", "side": "NO", "price": 0.45 }
      },
      "totalCost": 0.93,
      "guaranteedReturn": 1.00
    }
  ],
  "scannedAt": "2026-02-23T10:30:00Z"
}`,
    },
  },
  // Intelligence
  {
    id: 'intelligence',
    method: 'GET',
    path: '/api/intelligence',
    title: 'Quick Intelligence',
    description: 'Get AI-powered analysis for any prediction question including base rates, key factors, and probability ranges.',
    category: 'Intelligence',
    params: [
      { name: 'q', type: 'string', required: true, description: 'The prediction question to analyze' },
    ],
    response: 'Intelligence report with probability estimate and analysis',
    example: {
      request: 'curl "https://beright.io/api/intelligence?q=Will%20Fed%20cut%20rates%20in%20March?"',
      response: `{
  "question": "Will Fed cut rates in March?",
  "probability": { "estimate": 0.42, "range": [0.35, 0.50], "confidence": "medium" },
  "baseRate": { "value": 0.38, "source": "Historical FOMC decisions" },
  "keyFactors": [
    { "factor": "Inflation trending down", "impact": "positive", "weight": 0.3 },
    { "factor": "Unemployment stable", "impact": "neutral", "weight": 0.2 }
  ],
  "marketConsensus": { "polymarket": 0.40, "kalshi": 0.43, "average": 0.415 }
}`,
    },
  },
  {
    id: 'research',
    method: 'POST',
    path: '/api/research',
    title: 'Deep Research',
    description: 'Comprehensive research on any topic including news analysis, social sentiment, and market data.',
    category: 'Intelligence',
    params: [
      { name: 'question', type: 'string', required: true, description: 'Research question or topic' },
      { name: 'includeNews', type: 'boolean', required: false, description: 'Include recent news (default: true)' },
      { name: 'depth', type: 'string', required: false, description: 'Analysis depth: quick, standard, deep' },
    ],
    response: 'Detailed research report with sources and recommendations',
    example: {
      request: `curl -X POST "https://beright.io/api/research" \\
  -H "Content-Type: application/json" \\
  -d '{"question": "Bitcoin price trajectory Q1 2026", "depth": "deep"}'`,
      response: `{
  "summary": "Bitcoin shows bullish momentum with institutional accumulation...",
  "mood": "BULLISH",
  "confidence": 0.72,
  "probability": 0.68,
  "sources": [{ "title": "Bitcoin ETF inflows hit record", "relevance": 0.9 }],
  "recommendation": "Consider YES positions on BTC > $100K markets"
}`,
    },
  },
  // Forecasters
  {
    id: 'leaderboard',
    method: 'GET',
    path: '/api/leaderboard',
    title: 'Leaderboard',
    description: 'Get top forecasters ranked by Brier score and accuracy.',
    category: 'Forecasters',
    params: [
      { name: 'limit', type: 'number', required: false, description: 'Max results (default: 50)' },
      { name: 'userId', type: 'string', required: false, description: 'Include specific user rank' },
    ],
    response: 'Ranked leaderboard with performance metrics',
    example: {
      request: 'curl "https://beright.io/api/leaderboard?limit=10"',
      response: `{
  "leaderboard": [
    {
      "rank": 1,
      "username": "OracleSage",
      "walletAddress": "7xKX...abc",
      "brierScore": 0.142,
      "accuracy": 78.4,
      "predictions": 847,
      "streak": 12,
      "vsAI": "+8.2%"
    }
  ],
  "totalForecasters": 2847
}`,
    },
  },
  // V2 Analyst
  {
    id: 'v2-analyst',
    method: 'POST',
    path: '/api/v2/analyst',
    title: 'Superforecaster Analysis',
    description: 'Get AI-powered superforecaster analysis for any market. Uses structured reasoning with base rates, evidence weighting, and calibrated probability estimates.',
    category: 'V2 - Analyst',
    params: [
      { name: 'marketId', type: 'string', required: true, description: 'Market ID to analyze' },
      { name: 'question', type: 'string', required: false, description: 'Or provide a custom question' },
      { name: 'depth', type: 'string', required: false, description: 'Analysis depth: quick, standard, deep' },
    ],
    response: 'Structured analysis with probability estimate and reasoning chain',
    example: {
      request: `curl -X POST "https://beright.io/api/v2/analyst" \\
  -H "Content-Type: application/json" \\
  -d '{"marketId": "btc-100k-march"}'`,
      response: `{
  "market": { "id": "btc-100k-march", "question": "Bitcoin above $100K by March 2026?" },
  "analysis": {
    "modelProbability": 0.68,
    "marketProbability": 0.72,
    "edge": -0.04,
    "confidence": 0.75,
    "reasoning": {
      "baseRate": { "estimate": 0.55, "source": "Historical Q1 BTC performance" },
      "evidence": [
        { "item": "ETF inflows at record highs", "impact": "bullish" },
        { "item": "Fed dovish pivot signals", "impact": "bullish" }
      ]
    },
    "recommendation": "HOLD"
  }
}`,
    },
  },
  // V2 Execution
  {
    id: 'v2-execution-quote',
    method: 'GET',
    path: '/api/v2/execution/quote',
    title: 'Get Execution Quote',
    description: 'Get best execution quote across all platforms (Polymarket, Kalshi, DFlow). Returns optimal routing with expected slippage and fees.',
    category: 'V2 - Execution',
    params: [
      { name: 'marketId', type: 'string', required: true, description: 'Unified market ID' },
      { name: 'side', type: 'string', required: true, description: 'Trade side: YES or NO' },
      { name: 'amount', type: 'number', required: true, description: 'Trade amount in USD' },
    ],
    response: 'Execution quote with best route and price breakdown',
    example: {
      request: 'curl "https://beright.io/api/v2/execution/quote?marketId=btc-100k&side=YES&amount=500"',
      response: `{
  "quote": {
    "id": "quote_abc123",
    "marketId": "btc-100k",
    "side": "YES",
    "amount": 500,
    "bestRoute": {
      "platform": "kalshi",
      "price": 0.72,
      "shares": 694.44,
      "fees": 2.50,
      "slippage": 0.002
    },
    "totalCost": 502.50,
    "expiresAt": "2026-02-28T10:35:00Z"
  }
}`,
    },
  },
  {
    id: 'v2-execution',
    method: 'POST',
    path: '/api/v2/execution',
    title: 'Execute Trade',
    description: 'Execute a trade using the smart order router. Supports Kalshi, Polymarket, and DFlow (Solana). Requires authentication.',
    category: 'V2 - Execution',
    params: [
      { name: 'marketId', type: 'string', required: true, description: 'Market to trade' },
      { name: 'side', type: 'string', required: true, description: 'Trade side: YES or NO' },
      { name: 'amount', type: 'number', required: true, description: 'Trade amount in USD' },
      { name: 'platform', type: 'string', required: false, description: 'Force specific platform (optional)' },
    ],
    response: 'Execution result with transaction details',
    example: {
      request: `curl -X POST "https://beright.io/api/v2/execution" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"marketId": "btc-100k", "side": "YES", "amount": 500}'`,
      response: `{
  "execution": {
    "id": "exec_xyz789",
    "status": "filled",
    "marketId": "btc-100k",
    "side": "YES",
    "platform": "kalshi",
    "shares": 694.44,
    "avgPrice": 0.72,
    "totalCost": 502.50,
    "fees": 2.50,
    "executedAt": "2026-02-28T10:30:05Z"
  }
}`,
    },
  },
  // V2 Portfolio
  {
    id: 'v2-portfolio',
    method: 'GET',
    path: '/api/v2/portfolio',
    title: 'Portfolio Summary',
    description: 'Get cross-platform portfolio summary including positions across Polymarket, Kalshi, and DFlow.',
    category: 'V2 - Portfolio',
    params: [
      { name: 'userId', type: 'string', required: false, description: 'User ID (uses authenticated user if not provided)' },
    ],
    response: 'Portfolio summary with positions and P&L',
    example: {
      request: 'curl "https://beright.io/api/v2/portfolio" -H "Authorization: Bearer YOUR_API_KEY"',
      response: `{
  "portfolio": {
    "totalValue": 12340.50,
    "totalCost": 10000.00,
    "unrealizedPnL": 2340.50,
    "pnlPercent": 23.4,
    "platforms": {
      "kalshi": { "value": 5200, "positions": 8 },
      "polymarket": { "value": 4800, "positions": 5 },
      "dflow": { "value": 2340, "positions": 3 }
    },
    "winRate": 67.2
  }
}`,
    },
  },
  // Real-time
  {
    id: 'v2-signals-stream',
    method: 'GET',
    path: '/api/v2/signals/stream',
    title: 'V2 Signals Stream (SSE)',
    description: 'Real-time signal stream with whale activity, arbitrage opportunities, price momentum, and news catalysts.',
    category: 'V2 - Real-time',
    params: [
      { name: 'types', type: 'string', required: false, description: 'Filter by signal types: WHALE_BET, ARB_OPPORTUNITY, PRICE_MOMENTUM' },
      { name: 'minConfidence', type: 'number', required: false, description: 'Minimum confidence threshold (0-1)' },
    ],
    response: 'SSE stream of trading signals',
    example: {
      request: 'curl -N "https://beright.io/api/v2/signals/stream?types=WHALE_BET,ARB_OPPORTUNITY"',
      response: `event: connected
data: {"status":"connected","detectors":6}

event: signal
data: {
  "type": "WHALE_BET",
  "confidence": 0.85,
  "title": "🐋 $25.4K YES on Bitcoin above $100K",
  "data": { "wallet": "7xKZ...", "amount": 25400, "direction": "YES" }
}

event: signal
data: {
  "type": "ARB_OPPORTUNITY",
  "confidence": 0.92,
  "title": "💰 8.5% arb on Fed rate decision",
  "data": { "spread": 8.5, "buyPlatform": "kalshi" }
}`,
    },
  },
  // System
  {
    id: 'health',
    method: 'GET',
    path: '/api/health',
    title: 'System Health',
    description: 'Check BeRight API health status and service availability.',
    category: 'System',
    params: [],
    response: 'Health status with service checks',
    example: {
      request: 'curl "https://beright.io/api/health"',
      response: `{
  "status": "healthy",
  "timestamp": "2026-02-23T10:30:00Z",
  "version": "1.2.0",
  "services": {
    "database": { "status": "up", "latency": 12 },
    "redis": { "status": "up", "latency": 3 },
    "solana": { "status": "up", "latency": 45 }
  },
  "uptime": "99.97%"
}`,
    },
  },
];

const CATEGORIES = [...new Set(API_ENDPOINTS.map(ep => ep.category))];

// ===========================================================================
// Main Component
// ===========================================================================

export default function APIDocsPage() {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const endpointsRef = useStagger<HTMLDivElement>({ stagger: 0.08 });

  const filteredEndpoints = activeCategory === 'all'
    ? API_ENDPOINTS
    : API_ENDPOINTS.filter(ep => ep.category === activeCategory);

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getMethodClass = (method: string) => {
    switch (method) {
      case 'GET': return styles.methodGet;
      case 'POST': return styles.methodPost;
      case 'PATCH': return styles.methodPatch;
      case 'DELETE': return styles.methodDelete;
      default: return '';
    }
  };

  return (
    <PageWrapper showHeader={false} showFooter={false}>
      {/* Hero */}
      <Section variant="gradient" size="lg" className={styles.hero}>
        <h1 className={styles.heroTitle}>API Reference</h1>
        <p className={styles.heroSubtitle}>Build with BeRight's prediction market intelligence</p>
        <div className={styles.heroBadges}>
          <span className={styles.heroBadge}>REST API</span>
          <span className={styles.heroBadge}>SSE Streaming</span>
          <span className={styles.heroBadge}>No Auth Required</span>
        </div>
      </Section>

      {/* Base URL */}
      <Section size="sm">
        <div className={styles.baseUrl}>
          <span className={styles.baseLabel}>Base URL</span>
          <code className={styles.baseCode}>https://beright.io</code>
        </div>
      </Section>

      {/* Category Nav */}
      <Section size="sm">
        <nav className={styles.categoryNav}>
          <button
            className={`${styles.catBtn} ${activeCategory === 'all' ? styles.catBtnActive : ''}`}
            onClick={() => setActiveCategory('all')}
          >
            All Endpoints
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              className={`${styles.catBtn} ${activeCategory === cat ? styles.catBtnActive : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </nav>
      </Section>

      {/* Endpoints */}
      <Section>
        <div ref={endpointsRef} className={styles.endpoints}>
          {filteredEndpoints.map(ep => (
            <article key={ep.id} id={ep.id} className={styles.endpoint}>
              <div className={styles.endpointHeader}>
                <span className={`${styles.method} ${getMethodClass(ep.method)}`}>{ep.method}</span>
                <code className={styles.path}>{ep.path}</code>
                <span className={styles.categoryTag}>{ep.category}</span>
              </div>

              <h2 className={styles.endpointTitle}>{ep.title}</h2>
              <p className={styles.endpointDesc}>{ep.description}</p>

              {ep.params && ep.params.length > 0 && (
                <div className={styles.params}>
                  <h3 className={styles.paramsTitle}>Parameters</h3>
                  <table className={styles.paramsTable}>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Required</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ep.params.map(p => (
                        <tr key={p.name}>
                          <td><code className={styles.paramCode}>{p.name}</code></td>
                          <td><code className={`${styles.paramCode} ${styles.paramType}`}>{p.type}</code></td>
                          <td>{p.required ? <span className={styles.paramRequired}>Yes</span> : 'No'}</td>
                          <td>{p.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div>
                <div className={styles.exampleHeader}>
                  <h3 className={styles.exampleTitle}>Example</h3>
                  <button
                    className={styles.copyBtn}
                    onClick={() => copyToClipboard(ep.example.request, `${ep.id}-req`)}
                  >
                    {copiedId === `${ep.id}-req` ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className={styles.codeBlock}>
                  <span className={styles.codeLabel}>Request</span>
                  <pre className={styles.codeContent}>{ep.example.request}</pre>
                </div>
                <div className={styles.codeBlock}>
                  <span className={styles.codeLabel}>Response</span>
                  <pre className={styles.codeContent}>{ep.example.response}</pre>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Section>

      {/* Rate Limits */}
      <Section variant="alt" className={styles.rateLimits}>
        <h2 className={styles.rateLimitsTitle}>Rate Limits</h2>
        <div className={styles.limitsGrid}>
          <Card variant="default" padding="lg">
            <span className={styles.limitTier}>Anonymous</span>
            <span className={styles.limitValue}>100 req/min</span>
            <span className={styles.limitDesc}>No authentication required</span>
          </Card>
          <Card variant="default" padding="lg">
            <span className={styles.limitTier}>API Key (Coming Soon)</span>
            <span className={styles.limitValue}>1000 req/min</span>
            <span className={styles.limitDesc}>Higher limits with API key</span>
          </Card>
        </div>
      </Section>
    </PageWrapper>
  );
}
