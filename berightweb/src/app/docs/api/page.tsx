'use client';

import { useState } from 'react';
import Link from 'next/link';

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
  {
    id: 'markets-ranked',
    method: 'GET',
    path: '/api/markets/ranked',
    title: 'Ranked Markets (AIXBT-style)',
    description: 'Markets ranked by a composite momentum score combining volume, volatility, and social signals.',
    category: 'Markets',
    params: [
      { name: 'limit', type: 'number', required: false, description: 'Max results (default: 50, max: 100)' },
      { name: 'platform', type: 'string', required: false, description: 'Filter by platform' },
    ],
    response: 'Ranked market array with detailed momentum metrics',
    example: {
      request: 'curl "https://beright.io/api/markets/ranked?limit=20"',
      response: `{
  "markets": [
    {
      "rank": 1,
      "id": "eth-4k-q1",
      "question": "ETH above $4K by end of Q1?",
      "momentumScore": 94,
      "volumeRank": 2,
      "volatilityRank": 5,
      "socialRank": 1,
      "platform": "polymarket"
    }
  ],
  "updatedAt": "2026-02-23T10:30:00Z"
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
        "buy": {
          "platform": "kalshi",
          "side": "YES",
          "price": 0.48
        },
        "sell": {
          "platform": "polymarket",
          "side": "NO",
          "price": 0.45
        }
      },
      "totalCost": 0.93,
      "guaranteedReturn": 1.00,
      "urls": {
        "kalshi": "https://kalshi.com/...",
        "polymarket": "https://polymarket.com/..."
      }
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
  "probability": {
    "estimate": 0.42,
    "range": [0.35, 0.50],
    "confidence": "medium"
  },
  "baseRate": {
    "value": 0.38,
    "source": "Historical FOMC decisions"
  },
  "keyFactors": [
    { "factor": "Inflation trending down", "impact": "positive", "weight": 0.3 },
    { "factor": "Unemployment stable", "impact": "neutral", "weight": 0.2 },
    { "factor": "Market expectations", "impact": "positive", "weight": 0.25 }
  ],
  "marketConsensus": {
    "polymarket": 0.40,
    "kalshi": 0.43,
    "average": 0.415
  },
  "cognitiveWarnings": [
    "Recency bias: Don't overweight latest CPI print"
  ]
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
      { name: 'includeSocial', type: 'boolean', required: false, description: 'Include social sentiment (default: true)' },
      { name: 'depth', type: 'string', required: false, description: 'Analysis depth: quick, standard, deep (default: standard)' },
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
  "sources": [
    { "title": "Bitcoin ETF inflows hit record", "url": "...", "relevance": 0.9 }
  ],
  "marketData": {
    "currentPrice": 98420,
    "change24h": 2.3,
    "volume24h": "$42B"
  },
  "recommendation": "Consider YES positions on BTC > $100K markets",
  "relatedMarkets": [...]
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
      "profit": "+$12.4K",
      "vsAI": "+8.2%"
    }
  ],
  "totalForecasters": 2847,
  "updatedAt": "2026-02-23T10:00:00Z"
}`,
    },
  },
  {
    id: 'forecasters',
    method: 'GET',
    path: '/api/forecasters',
    title: 'Forecaster Profile',
    description: 'Get detailed profile and stats for a specific forecaster.',
    category: 'Forecasters',
    params: [
      { name: 'id', type: 'string', required: false, description: 'Telegram ID or wallet address' },
      { name: 'domain', type: 'string', required: false, description: 'Filter by expertise domain (crypto, politics, etc.)' },
      { name: 'limit', type: 'number', required: false, description: 'Results limit for top forecasters list' },
    ],
    response: 'Forecaster profile with performance breakdown',
    example: {
      request: 'curl "https://beright.io/api/forecasters?id=123456789"',
      response: `{
  "forecaster": {
    "id": "123456789",
    "username": "OracleSage",
    "walletAddress": "7xKX...abc",
    "joinedAt": "2025-06-15",
    "stats": {
      "totalPredictions": 847,
      "brierScore": 0.142,
      "accuracy": 78.4,
      "streak": 12,
      "rank": 1
    },
    "byCategory": {
      "crypto": { "predictions": 312, "accuracy": 82.1 },
      "politics": { "predictions": 198, "accuracy": 74.2 },
      "sports": { "predictions": 156, "accuracy": 79.5 }
    },
    "vsAI": {
      "winRate": 68.2,
      "avgOutperformance": "+8.2%"
    },
    "recentPredictions": [...]
  }
}`,
    },
  },
  // Real-time
  {
    id: 'stream',
    method: 'GET',
    path: '/api/stream',
    title: 'Real-time Event Stream (SSE)',
    description: 'Server-Sent Events stream for real-time market updates, arbitrage alerts, and whale activity.',
    category: 'Real-time',
    params: [
      { name: 'types', type: 'string', required: false, description: 'Filter by event type (comma-separated): arbitrage, whale, price, resolution' },
    ],
    response: 'SSE stream with typed events',
    example: {
      request: 'curl -N "https://beright.io/api/stream?types=arbitrage,whale"',
      response: `event: connected
data: {"status":"connected","timestamp":"2026-02-23T10:30:00Z"}

event: arbitrage
data: {"spread":5.2,"question":"Fed rate cut?","platforms":["kalshi","polymarket"]}

event: whale
data: {"wallet":"7xKX...","action":"BUY","amount":50000,"market":"btc-100k"}

event: heartbeat
data: {"timestamp":"2026-02-23T10:30:30Z"}`,
    },
  },
  {
    id: 'signals-stream',
    method: 'GET',
    path: '/api/signals/stream',
    title: 'Signals Stream (SSE)',
    description: 'Real-time trading signals including arbitrage alerts, whale movements, and price triggers.',
    category: 'Real-time',
    params: [],
    response: 'SSE stream of trading signals',
    example: {
      request: 'curl -N "https://beright.io/api/signals/stream"',
      response: `event: signal
data: {"type":"ARBITRAGE","confidence":0.9,"spread":6.2,"action":"BUY kalshi / SELL poly"}

event: signal
data: {"type":"WHALE","wallet":"8yKZ...","action":"BUY YES","amount":"$45,000"}`,
    },
  },
  // Kalshi
  {
    id: 'kalshi',
    method: 'GET',
    path: '/api/kalshi',
    title: 'Kalshi Markets',
    description: 'Access Kalshi market data, positions, and account info.',
    category: 'Trading',
    params: [
      { name: 'action', type: 'string', required: true, description: 'Action: markets, market, balance, positions, portfolio' },
      { name: 'ticker', type: 'string', required: false, description: 'Market ticker (for action=market)' },
      { name: 'limit', type: 'number', required: false, description: 'Results limit (for action=markets)' },
    ],
    response: 'Kalshi data based on action type',
    example: {
      request: 'curl "https://beright.io/api/kalshi?action=markets&limit=5"',
      response: `{
  "markets": [
    {
      "ticker": "FEDRATE-26MAR-T0.25",
      "title": "Fed cuts to 0-0.25% by March FOMC?",
      "yesPrice": 0.04,
      "noPrice": 0.96,
      "volume": 124500,
      "openInterest": 89000,
      "closeTime": "2026-03-19T18:00:00Z"
    }
  ]
}`,
    },
  },
  // Health
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
  // Brief
  {
    id: 'brief',
    method: 'GET',
    path: '/api/brief',
    title: 'Morning Brief',
    description: 'Get a curated morning briefing with top markets, signals, and recommendations.',
    category: 'Intelligence',
    params: [
      { name: 'format', type: 'string', required: false, description: 'Output format: web, telegram, text (default: web)' },
      { name: 'userId', type: 'string', required: false, description: 'User ID for personalized brief' },
    ],
    response: 'Formatted morning briefing',
    example: {
      request: 'curl "https://beright.io/api/brief?format=web"',
      response: `{
  "date": "2026-02-23",
  "headline": "Crypto markets bullish on ETF inflows",
  "marketMood": "BULLISH",
  "topMarkets": [
    { "question": "BTC > $100K March?", "yesPrice": 0.72, "change": "+5%" }
  ],
  "arbitrageAlerts": [
    { "spread": 5.2, "question": "Fed rate cut?", "profit": "5.2%" }
  ],
  "whaleActivity": {
    "totalVolume": "$2.4M",
    "topMove": "8yKZ... bought $120K YES on ETH"
  },
  "recommendation": "Consider crypto YES positions"
}`,
    },
  },

  // ============ V2 API ENDPOINTS ============

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
      { name: 'depth', type: 'string', required: false, description: 'Analysis depth: quick, standard, deep (default: standard)' },
      { name: 'includeNews', type: 'boolean', required: false, description: 'Include recent news analysis (default: true)' },
    ],
    response: 'Structured analysis with probability estimate and reasoning chain',
    example: {
      request: `curl -X POST "https://beright.io/api/v2/analyst" \\
  -H "Content-Type: application/json" \\
  -d '{"marketId": "btc-100k-march"}'`,
      response: `{
  "market": {
    "id": "btc-100k-march",
    "question": "Bitcoin above $100K by March 2026?"
  },
  "analysis": {
    "modelProbability": 0.68,
    "marketProbability": 0.72,
    "edge": -0.04,
    "confidence": 0.75,
    "reasoning": {
      "baseRate": {
        "estimate": 0.55,
        "source": "Historical Q1 BTC performance"
      },
      "evidence": [
        { "item": "ETF inflows at record highs", "impact": "bullish" },
        { "item": "Fed dovish pivot signals", "impact": "bullish" },
        { "item": "Mining difficulty ATH", "impact": "neutral" }
      ],
      "contrarian": "Excessive bullish sentiment often precedes corrections"
    },
    "recommendation": "HOLD"
  },
  "generatedAt": "2026-02-28T10:30:00Z"
}`,
    },
  },

  // V2 Execution Quote
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
    "alternativeRoutes": [
      {
        "platform": "polymarket",
        "price": 0.73,
        "shares": 684.93,
        "fees": 0,
        "slippage": 0.005
      }
    ],
    "totalCost": 502.50,
    "expectedValue": 694.44,
    "breakeven": 0.724,
    "expiresAt": "2026-02-28T10:35:00Z"
  }
}`,
    },
  },

  // V2 Execution
  {
    id: 'v2-execution',
    method: 'POST',
    path: '/api/v2/execution',
    title: 'Execute Trade',
    description: 'Execute a trade using the smart order router. Supports Kalshi, Polymarket, and DFlow (Solana). Requires authentication.',
    category: 'V2 - Execution',
    params: [
      { name: 'quoteId', type: 'string', required: false, description: 'Quote ID from /quote endpoint' },
      { name: 'marketId', type: 'string', required: true, description: 'Market to trade' },
      { name: 'side', type: 'string', required: true, description: 'Trade side: YES or NO' },
      { name: 'amount', type: 'number', required: true, description: 'Trade amount in USD' },
      { name: 'platform', type: 'string', required: false, description: 'Force specific platform (optional)' },
      { name: 'limitPrice', type: 'number', required: false, description: 'Limit price (optional)' },
    ],
    response: 'Execution result with transaction details',
    example: {
      request: `curl -X POST "https://beright.io/api/v2/execution" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
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
    "txHash": "0x...",
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
    "realizedPnL": 1250.00,
    "pnlPercent": 23.4,
    "platforms": {
      "kalshi": { "value": 5200, "positions": 8 },
      "polymarket": { "value": 4800, "positions": 5 },
      "dflow": { "value": 2340, "positions": 3 }
    },
    "positions": 16,
    "winRate": 67.2,
    "lastUpdated": "2026-02-28T10:30:00Z"
  }
}`,
    },
  },

  // V2 Positions
  {
    id: 'v2-positions',
    method: 'GET',
    path: '/api/v2/positions',
    title: 'Open Positions',
    description: 'Get all open positions across platforms with real-time P&L.',
    category: 'V2 - Portfolio',
    params: [
      { name: 'platform', type: 'string', required: false, description: 'Filter by platform: kalshi, polymarket, dflow' },
      { name: 'status', type: 'string', required: false, description: 'Filter by status: open, closed, all (default: open)' },
      { name: 'limit', type: 'number', required: false, description: 'Max results (default: 50)' },
    ],
    response: 'Array of positions with current prices and P&L',
    example: {
      request: 'curl "https://beright.io/api/v2/positions?status=open" -H "Authorization: Bearer YOUR_API_KEY"',
      response: `{
  "positions": [
    {
      "id": "pos_123",
      "marketId": "btc-100k-march",
      "question": "Bitcoin above $100K by March 2026?",
      "platform": "kalshi",
      "side": "YES",
      "shares": 500,
      "avgCost": 0.68,
      "currentPrice": 0.72,
      "value": 360.00,
      "cost": 340.00,
      "pnl": 20.00,
      "pnlPercent": 5.88,
      "openedAt": "2026-02-20T14:30:00Z"
    }
  ],
  "count": 16,
  "totalValue": 12340.50
}`,
    },
  },

  // V2 Performance
  {
    id: 'v2-performance',
    method: 'GET',
    path: '/api/v2/portfolio/performance',
    title: 'Performance History',
    description: 'Get historical P&L performance with daily/weekly/monthly breakdowns.',
    category: 'V2 - Portfolio',
    params: [
      { name: 'period', type: 'string', required: false, description: 'Time period: 7d, 30d, 90d, 1y, all (default: 30d)' },
      { name: 'granularity', type: 'string', required: false, description: 'Data granularity: daily, weekly, monthly (default: daily)' },
    ],
    response: 'Performance history with charts and metrics',
    example: {
      request: 'curl "https://beright.io/api/v2/portfolio/performance?period=30d"',
      response: `{
  "performance": {
    "period": "30d",
    "startValue": 10000.00,
    "endValue": 12340.50,
    "pnl": 2340.50,
    "pnlPercent": 23.4,
    "sharpeRatio": 1.85,
    "maxDrawdown": -8.2,
    "winRate": 67.2,
    "history": [
      { "date": "2026-02-01", "value": 10000, "pnl": 0 },
      { "date": "2026-02-02", "value": 10120, "pnl": 120 },
      { "date": "2026-02-28", "value": 12340, "pnl": 2340 }
    ],
    "byCategory": {
      "crypto": { "pnl": 1500, "trades": 25 },
      "politics": { "pnl": 600, "trades": 12 },
      "sports": { "pnl": 240, "trades": 8 }
    }
  }
}`,
    },
  },

  // V2 Risk
  {
    id: 'v2-risk',
    method: 'GET',
    path: '/api/v2/risk',
    title: 'Risk Metrics',
    description: 'Get portfolio risk analysis including concentration, correlation, and drawdown metrics.',
    category: 'V2 - Risk',
    params: [],
    response: 'Risk metrics and alerts',
    example: {
      request: 'curl "https://beright.io/api/v2/risk" -H "Authorization: Bearer YOUR_API_KEY"',
      response: `{
  "risk": {
    "overallScore": 65,
    "level": "moderate",
    "metrics": {
      "concentration": {
        "topPosition": 18.5,
        "topCategory": 42.0,
        "herfindahl": 0.15
      },
      "correlation": {
        "avgPairwise": 0.35,
        "cryptoExposure": 0.62
      },
      "drawdown": {
        "current": -2.1,
        "max30d": -8.2,
        "max90d": -12.5
      },
      "volatility": {
        "daily": 2.8,
        "weekly": 6.2
      }
    },
    "alerts": [
      {
        "type": "concentration",
        "severity": "warning",
        "message": "Crypto exposure at 62% - consider diversifying"
      }
    ],
    "recommendations": [
      "Consider reducing BTC-100K position size",
      "Add uncorrelated political markets for diversification"
    ]
  }
}`,
    },
  },

  // V2 Signals Stream
  {
    id: 'v2-signals-stream',
    method: 'GET',
    path: '/api/v2/signals/stream',
    title: 'V2 Signals Stream (SSE)',
    description: 'Real-time signal stream with whale activity, arbitrage opportunities, price momentum, and news catalysts.',
    category: 'V2 - Real-time',
    params: [
      { name: 'types', type: 'string', required: false, description: 'Filter by signal types (comma-separated): WHALE_BET, ARB_OPPORTUNITY, PRICE_MOMENTUM, NEWS_CATALYST, VOLUME_SPIKE' },
      { name: 'minConfidence', type: 'number', required: false, description: 'Minimum confidence threshold (0-1, default: 0.5)' },
    ],
    response: 'SSE stream of trading signals',
    example: {
      request: 'curl -N "https://beright.io/api/v2/signals/stream?types=WHALE_BET,ARB_OPPORTUNITY"',
      response: `event: connected
data: {"status":"connected","detectors":6,"timestamp":"2026-02-28T10:30:00Z"}

event: signal
data: {
  "type": "WHALE_BET",
  "confidence": 0.85,
  "urgency": "high",
  "title": "🐋 $25.4K YES on Bitcoin above $100K",
  "market": { "id": "btc-100k", "platform": "kalshi" },
  "data": {
    "wallet": "7xKZ...",
    "amount": 25400,
    "direction": "YES",
    "isSmartMoney": true
  }
}

event: signal
data: {
  "type": "ARB_OPPORTUNITY",
  "confidence": 0.92,
  "urgency": "critical",
  "title": "💰 8.5% arb on Fed rate decision",
  "market": { "id": "fed-march-cut" },
  "data": {
    "spread": 8.5,
    "buyPlatform": "kalshi",
    "sellPlatform": "polymarket"
  }
}

event: heartbeat
data: {"timestamp":"2026-02-28T10:30:30Z"}`,
    },
  },
];

const CATEGORIES = [...new Set(API_ENDPOINTS.map(ep => ep.category))];

export default function APIDocsPage() {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredEndpoints = activeCategory === 'all'
    ? API_ENDPOINTS
    : API_ENDPOINTS.filter(ep => ep.category === activeCategory);

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="api-page">
      {/* Header */}
      <header className="docs-header">
        <Link href="/" className="logo">
          <span className="logo-be">Be</span>
          <span className="logo-right">Right</span>
        </Link>
        <nav className="nav-links">
          <Link href="/docs" className="nav-link">Docs</Link>
          <Link href="/docs/api" className="nav-link active">API</Link>
          <Link href="/docs/faq" className="nav-link">FAQ</Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="api-hero">
        <h1>API Reference</h1>
        <p>Build with BeRight's prediction market intelligence</p>
        <div className="hero-badges">
          <span className="badge">REST API</span>
          <span className="badge">SSE Streaming</span>
          <span className="badge">No Auth Required</span>
        </div>
      </section>

      {/* Base URL */}
      <section className="base-url">
        <span className="base-label">Base URL</span>
        <code className="base-code">https://beright.io</code>
      </section>

      {/* Category Nav */}
      <nav className="category-nav">
        <button
          className={`cat-btn ${activeCategory === 'all' ? 'active' : ''}`}
          onClick={() => setActiveCategory('all')}
        >
          All Endpoints
        </button>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            className={`cat-btn ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </nav>

      {/* Endpoints */}
      <section className="endpoints">
        {filteredEndpoints.map(ep => (
          <article key={ep.id} id={ep.id} className="endpoint">
            <div className="endpoint-header">
              <span className={`method ${ep.method.toLowerCase()}`}>{ep.method}</span>
              <code className="path">{ep.path}</code>
              <span className="category-tag">{ep.category}</span>
            </div>

            <h2>{ep.title}</h2>
            <p className="description">{ep.description}</p>

            {ep.params && ep.params.length > 0 && (
              <div className="params">
                <h3>Parameters</h3>
                <table>
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
                        <td><code>{p.name}</code></td>
                        <td><code className="type">{p.type}</code></td>
                        <td>{p.required ? <span className="required">Yes</span> : 'No'}</td>
                        <td>{p.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="example">
              <div className="example-header">
                <h3>Example</h3>
                <button
                  className="copy-btn"
                  onClick={() => copyToClipboard(ep.example.request, `${ep.id}-req`)}
                >
                  {copiedId === `${ep.id}-req` ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="code-block request">
                <span className="code-label">Request</span>
                <pre>{ep.example.request}</pre>
              </div>
              <div className="code-block response">
                <span className="code-label">Response</span>
                <pre>{ep.example.response}</pre>
              </div>
            </div>
          </article>
        ))}
      </section>

      {/* Rate Limits */}
      <section className="rate-limits">
        <h2>Rate Limits</h2>
        <div className="limits-grid">
          <div className="limit-card">
            <span className="limit-tier">Anonymous</span>
            <span className="limit-value">100 req/min</span>
            <span className="limit-desc">No authentication required</span>
          </div>
          <div className="limit-card">
            <span className="limit-tier">API Key (Coming Soon)</span>
            <span className="limit-value">1000 req/min</span>
            <span className="limit-desc">Higher limits with API key</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="docs-footer">
        <div className="footer-brand">
          <span className="logo-be">Be</span>
          <span className="logo-right">Right</span>
        </div>
        <div className="footer-links">
          <a href="https://x.com/AgentBEright" target="_blank" rel="noopener">Twitter</a>
          <a href="https://t.me/berightaii" target="_blank" rel="noopener">Telegram</a>
        </div>
      </footer>

      <style jsx>{`
        .api-page {
          min-height: 100vh;
          background: #080C14;
          color: #fff;
          font-family: 'Outfit', system-ui, sans-serif;
        }

        /* Header */
        .docs-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 40px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          position: sticky;
          top: 0;
          background: rgba(3, 3, 5, 0.95);
          backdrop-filter: blur(12px);
          z-index: 100;
        }

        .logo {
          display: flex;
          text-decoration: none;
          font-size: 22px;
          font-weight: 800;
        }

        .logo-be { color: #fff; }
        .logo-right {
          background: linear-gradient(135deg, #10B981, #00C2FF, #8B5CF6);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .nav-links {
          display: flex;
          gap: 32px;
        }

        .nav-link {
          color: rgba(255, 255, 255, 0.6);
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          transition: color 0.2s;
        }

        .nav-link:hover, .nav-link.active {
          color: #fff;
        }

        /* Hero */
        .api-hero {
          text-align: center;
          padding: 80px 24px 40px;
          background: linear-gradient(180deg, rgba(16, 185, 129, 0.03) 0%, transparent 100%);
        }

        .api-hero h1 {
          font-size: 42px;
          font-weight: 800;
          margin: 0 0 12px;
          letter-spacing: -1px;
        }

        .api-hero p {
          font-size: 18px;
          color: rgba(255, 255, 255, 0.6);
          margin: 0 0 24px;
        }

        .hero-badges {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
        }

        .badge {
          padding: 8px 16px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 100px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.7);
        }

        /* Base URL */
        .base-url {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 24px;
          margin: 0 auto 20px;
          max-width: 600px;
          background: rgba(16, 185, 129, 0.05);
          border: 1px solid rgba(16, 185, 129, 0.15);
          border-radius: 12px;
        }

        .base-label {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
        }

        .base-code {
          font-family: 'JetBrains Mono', monospace;
          font-size: 16px;
          color: #10B981;
        }

        /* Category Nav */
        .category-nav {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 0 24px 40px;
          flex-wrap: wrap;
        }

        .cat-btn {
          padding: 10px 18px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          color: rgba(255, 255, 255, 0.7);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }

        .cat-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
        }

        .cat-btn.active {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(0, 194, 255, 0.15));
          border-color: rgba(16, 185, 129, 0.3);
          color: #10B981;
        }

        /* Endpoints */
        .endpoints {
          max-width: 900px;
          margin: 0 auto;
          padding: 0 24px 60px;
          display: flex;
          flex-direction: column;
          gap: 40px;
        }

        .endpoint {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
          padding: 28px;
        }

        .endpoint-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .method {
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 700;
          font-family: 'JetBrains Mono', monospace;
          letter-spacing: 0.5px;
        }

        .method.get {
          background: rgba(16, 185, 129, 0.15);
          color: #10B981;
        }

        .method.post {
          background: rgba(0, 194, 255, 0.15);
          color: #00C2FF;
        }

        .method.patch {
          background: rgba(255, 193, 7, 0.15);
          color: #FFC107;
        }

        .method.delete {
          background: rgba(255, 82, 82, 0.15);
          color: #F43F5E;
        }

        .path {
          font-family: 'JetBrains Mono', monospace;
          font-size: 14px;
          color: #fff;
        }

        .category-tag {
          margin-left: auto;
          padding: 4px 10px;
          background: rgba(139, 92, 246, 0.15);
          border-radius: 6px;
          font-size: 11px;
          color: #A78BFA;
        }

        .endpoint h2 {
          font-size: 20px;
          font-weight: 700;
          margin: 0 0 8px;
        }

        .description {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.6);
          margin: 0 0 24px;
          line-height: 1.6;
        }

        /* Params */
        .params {
          margin-bottom: 24px;
        }

        .params h3 {
          font-size: 14px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.7);
          margin: 0 0 12px;
        }

        .params table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .params th {
          text-align: left;
          padding: 10px 12px;
          background: rgba(255, 255, 255, 0.03);
          color: rgba(255, 255, 255, 0.5);
          font-weight: 600;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .params td {
          padding: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.04);
          color: rgba(255, 255, 255, 0.8);
        }

        .params code {
          padding: 2px 6px;
          background: rgba(255, 255, 255, 0.06);
          border-radius: 4px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
        }

        .params .type {
          color: #00C2FF;
        }

        .params .required {
          color: #F43F5E;
          font-weight: 600;
        }

        /* Example */
        .example-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .example h3 {
          font-size: 14px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.7);
          margin: 0;
        }

        .copy-btn {
          padding: 6px 12px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          color: rgba(255, 255, 255, 0.7);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }

        .copy-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }

        .code-block {
          background: #0D1117;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          margin-bottom: 12px;
          overflow: hidden;
        }

        .code-label {
          display: block;
          padding: 8px 14px;
          background: rgba(255, 255, 255, 0.02);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .code-block pre {
          margin: 0;
          padding: 16px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.8);
          overflow-x: auto;
          white-space: pre-wrap;
          word-break: break-word;
        }

        /* Rate Limits */
        .rate-limits {
          max-width: 700px;
          margin: 0 auto;
          padding: 60px 24px 80px;
        }

        .rate-limits h2 {
          font-size: 24px;
          font-weight: 700;
          margin: 0 0 24px;
          text-align: center;
        }

        .limits-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 16px;
        }

        .limit-card {
          padding: 24px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          text-align: center;
        }

        .limit-tier {
          display: block;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          margin-bottom: 8px;
        }

        .limit-value {
          display: block;
          font-size: 28px;
          font-weight: 800;
          color: #10B981;
          font-family: 'JetBrains Mono', monospace;
          margin-bottom: 8px;
        }

        .limit-desc {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.4);
        }

        /* Footer */
        .docs-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 30px 40px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .footer-brand {
          font-size: 18px;
          font-weight: 800;
        }

        .footer-links {
          display: flex;
          gap: 24px;
        }

        .footer-links a {
          color: rgba(255, 255, 255, 0.5);
          text-decoration: none;
          font-size: 14px;
          transition: color 0.2s;
        }

        .footer-links a:hover {
          color: #fff;
        }

        @media (max-width: 768px) {
          .docs-header {
            padding: 16px 20px;
          }

          .api-hero h1 {
            font-size: 28px;
          }

          .hero-badges {
            flex-wrap: wrap;
          }

          .endpoint-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .category-tag {
            margin-left: 0;
          }

          .params table {
            display: block;
            overflow-x: auto;
          }

          .docs-footer {
            flex-direction: column;
            gap: 20px;
            text-align: center;
          }
        }
      `}</style>
    </div>
  );
}
