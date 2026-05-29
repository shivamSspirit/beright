/**
 * MCP (Model Context Protocol) Server
 *
 * Exposes BeRight intelligence to Claude Code via MCP.
 * Enables Claude to query markets, signals, and intelligence directly.
 *
 * Tools provided:
 *   - beright_markets: Search and list markets
 *   - beright_signals: Get recent signals
 *   - beright_arbitrage: Find arbitrage opportunities
 *   - beright_momentum: Get hot markets by momentum
 *   - beright_synthesis: Get latest intelligence report
 *
 * Usage:
 *   Run: npx ts-node lib/channels/mcp.ts
 *   Configure in Claude Code settings
 */

import { getRecentSignals, formatSignalsReport } from '../signals';
import { getRankedMarkets, getHotMarkets, formatMomentumReport } from '../momentum';
import { getRecentReports, formatSynthesisForTelegram } from '../synthesis';
import { supabaseAdmin, isSupabaseConfigured } from '../supabase/client';

// MCP Tool definitions
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface MCPToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

// Tool definitions
export const MCP_TOOLS: MCPTool[] = [
  {
    name: 'beright_markets',
    description: 'Search prediction markets across Polymarket, Kalshi, Manifold, and more. Returns market titles, odds, and volume.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query for market titles' },
        platform: { type: 'string', description: 'Filter by platform (polymarket, kalshi, manifold, etc.)' },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
    },
  },
  {
    name: 'beright_signals',
    description: 'Get recent market signals detected by the AI. Signals include volume surges, odds shifts, whale activity, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Filter by signal type (volume_surge, odds_shift, whale_entry, etc.)' },
        action: { type: 'string', description: 'Filter by action (ALERT, WATCH)' },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
    },
  },
  {
    name: 'beright_arbitrage',
    description: 'Find arbitrage opportunities across prediction market platforms. Returns price differences and profit potential.',
    inputSchema: {
      type: 'object',
      properties: {
        minProfit: { type: 'number', description: 'Minimum profit percentage (default 1.5)' },
        limit: { type: 'number', description: 'Max results (default 5)' },
      },
    },
  },
  {
    name: 'beright_momentum',
    description: 'Get markets ranked by momentum score. High momentum indicates strong activity and potential opportunities.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Filter by category (politics, crypto, sports, etc.)' },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
    },
  },
  {
    name: 'beright_synthesis',
    description: 'Get the latest market intelligence synthesis report. Provides agent-assisted analysis of current market conditions.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// Tool handlers
export async function handleMCPTool(
  name: string,
  args: Record<string, any>
): Promise<MCPToolResult> {
  try {
    switch (name) {
      case 'beright_markets':
        return await handleMarketsQuery(args);
      case 'beright_signals':
        return await handleSignalsQuery(args);
      case 'beright_arbitrage':
        return await handleArbQuery(args);
      case 'beright_momentum':
        return await handleMomentumQuery(args);
      case 'beright_synthesis':
        return await handleSynthesisQuery();
      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : 'Unknown error'}` }],
      isError: true,
    };
  }
}

async function handleMarketsQuery(args: Record<string, any>): Promise<MCPToolResult> {
  if (!isSupabaseConfigured) {
    return { content: [{ type: 'text', text: 'Database not configured' }], isError: true };
  }

  const limit = args.limit || 10;

  let query = supabaseAdmin
    .from('market_cache')
    .select('market_id, title, platform, yes_price, volume, category')
    .order('volume', { ascending: false })
    .limit(limit);

  if (args.query) {
    query = query.ilike('title', `%${args.query}%`);
  }

  if (args.platform) {
    query = query.eq('platform', args.platform);
  }

  const { data, error } = await query;

  if (error) {
    return { content: [{ type: 'text', text: `Query error: ${error.message}` }], isError: true };
  }

  if (!data || data.length === 0) {
    return { content: [{ type: 'text', text: 'No markets found' }] };
  }

  const text = data.map((m: any) =>
    `${m.title}\n  Platform: ${m.platform} | Odds: ${(m.yes_price * 100).toFixed(0)}% | Volume: $${m.volume?.toLocaleString() || 'N/A'}`
  ).join('\n\n');

  return { content: [{ type: 'text', text }] };
}

async function handleSignalsQuery(args: Record<string, any>): Promise<MCPToolResult> {
  const signals = await getRecentSignals({
    limit: args.limit || 10,
    action: args.action,
    type: args.type,
  });

  if (signals.length === 0) {
    return { content: [{ type: 'text', text: 'No recent signals' }] };
  }

  const text = formatSignalsReport(signals);
  return { content: [{ type: 'text', text }] };
}

async function handleArbQuery(args: Record<string, any>): Promise<MCPToolResult> {
  if (!isSupabaseConfigured) {
    return { content: [{ type: 'text', text: 'Database not configured' }], isError: true };
  }

  const minProfit = args.minProfit || 1.5;
  const limit = args.limit || 5;

  // Get from arb_opportunities table
  const { data, error } = await supabaseAdmin
    .from('arb_opportunities')
    .select('*')
    .gte('profit_pct', minProfit)
    .order('profit_pct', { ascending: false })
    .limit(limit);

  if (error || !data || data.length === 0) {
    return { content: [{ type: 'text', text: 'No arbitrage opportunities found' }] };
  }

  const text = data.map((a: any) =>
    `${a.topic}\n  Profit: ${a.profit_pct.toFixed(2)}% | ${a.platform_a} ↔ ${a.platform_b}`
  ).join('\n\n');

  return { content: [{ type: 'text', text }] };
}

async function handleMomentumQuery(args: Record<string, any>): Promise<MCPToolResult> {
  const markets = await getRankedMarkets({
    limit: args.limit || 10,
    platform: args.category, // Use category as platform filter
  });

  if (markets.length === 0) {
    return { content: [{ type: 'text', text: 'No momentum data available' }] };
  }

  const text = formatMomentumReport(markets);
  return { content: [{ type: 'text', text }] };
}

async function handleSynthesisQuery(): Promise<MCPToolResult> {
  const reports = await getRecentReports(1);

  if (reports.length === 0) {
    return { content: [{ type: 'text', text: 'No synthesis reports available' }] };
  }

  const text = formatSynthesisForTelegram(reports[0]);
  return { content: [{ type: 'text', text }] };
}

// MCP Server Implementation (stdio transport)
export async function runMCPServer(): Promise<void> {
  const readline = await import('readline');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  console.error('[MCP] BeRight MCP Server started');

  rl.on('line', async (line) => {
    try {
      const request = JSON.parse(line);

      if (request.method === 'tools/list') {
        const response = {
          jsonrpc: '2.0',
          id: request.id,
          result: { tools: MCP_TOOLS },
        };
        console.log(JSON.stringify(response));
      } else if (request.method === 'tools/call') {
        const result = await handleMCPTool(request.params.name, request.params.arguments || {});
        const response = {
          jsonrpc: '2.0',
          id: request.id,
          result,
        };
        console.log(JSON.stringify(response));
      } else if (request.method === 'initialize') {
        const response = {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: {
              name: 'beright-mcp',
              version: '1.0.0',
            },
          },
        };
        console.log(JSON.stringify(response));
      } else {
        const response = {
          jsonrpc: '2.0',
          id: request.id,
          error: { code: -32601, message: 'Method not found' },
        };
        console.log(JSON.stringify(response));
      }
    } catch (err) {
      console.error('[MCP] Error:', err);
    }
  });
}

// CLI entry point
if (require.main === module) {
  runMCPServer().catch(console.error);
}
