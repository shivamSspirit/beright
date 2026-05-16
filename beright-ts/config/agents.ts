/**
 * Internal capability profiles for the BeRight Terminal runtime.
 *
 * `beright-terminal` is the only top-level runtime agent.
 * These profiles describe the internal specialist capabilities used by the
 * semantic execution path.
 */

export type BeRightCapabilityId = 'scout' | 'analyst' | 'trader';

export interface AgentConfig {
  id: BeRightCapabilityId;
  name: string;
  model: 'claude-opus-4-5' | 'claude-sonnet-4-5' | 'claude-haiku-3-5';
  description: string;
  capabilities: string[];
  systemPrompt: string;
  tools: string[];
  maxTokens: number;
  temperature: number;
}

export const AGENTS: Record<BeRightCapabilityId, AgentConfig> = {
  scout: {
    id: 'scout',
    name: 'Scout',
    model: 'claude-sonnet-4-5',
    description: 'Fast market scanning and opportunity detection',
    capabilities: [
      'Hot markets detection',
      'Arbitrage scanning across platforms',
      'News monitoring',
      'Quick price checks',
      'Volume spike detection',
    ],
    systemPrompt: `You are Scout, an internal market-scanning capability used by the BeRight Terminal.

Your job is SPEED and BREADTH. Scan markets quickly, find opportunities, report concisely.

OUTPUT RULES:
- Be terse and data-dense
- Flag urgency clearly
- Prefer concrete numbers over generic commentary
- Respond in markdown-ready text`,
    tools: ['markets', 'arbitrage', 'intel', 'prices'],
    maxTokens: 2048,
    temperature: 0.3,
  },

  analyst: {
    id: 'analyst',
    name: 'Analyst',
    model: 'claude-opus-4-5',
    description: 'Deep research and probability analysis',
    capabilities: [
      'Superforecaster methodology',
      'Base rate research',
      'Detailed market analysis',
      'Calibration reports',
      'Scenario modeling',
    ],
    systemPrompt: `You are Analyst, an internal research capability used by the BeRight Terminal.

Your job is DEPTH and RIGOR. Apply superforecaster methodology to every analysis.

METHODOLOGY:
1. Outside View
2. Inside View
3. Synthesis
4. Key uncertainties

OUTPUT RULES:
- Show reasoning clearly
- State confidence explicitly
- End with an actionable conclusion
- Respond in markdown-ready text`,
    tools: ['research', 'calibration', 'markets', 'intel'],
    maxTokens: 4096,
    temperature: 0.5,
  },

  trader: {
    id: 'trader',
    name: 'Trader',
    model: 'claude-sonnet-4-5',
    description: 'Trade execution and position management',
    capabilities: [
      'Quote generation',
      'Position management',
      'Whale tracking',
      'Trade execution',
      'Risk assessment',
    ],
    systemPrompt: `You are Trader, an internal execution capability used by the BeRight Terminal.

Your job is PRECISION and SAFETY for PREDICTION MARKETS ONLY.

HARD CONSTRAINTS:
1. Only discuss prediction market execution on venues like Polymarket, Kalshi, Jupiter prediction, DFlow, Manifold, or Metaculus.
2. Never switch the user into spot, perpetual futures, options, margin, or generic CEX trading unless the user explicitly asks for that non-prediction product.
3. Never invent Binance, ETH perpetuals, or leveraged futures as the target market for an ambiguous request.
4. If the market, venue, or ticker is unclear, say so explicitly and ask for the exact market title or URL.
5. Prefer safe, deterministic guidance over generic trading commentary.

RULES:
1. Always show quote before execution
2. Check slippage and liquidity
3. Warn on high price impact
4. Respect budget constraints
5. Keep execution guidance tied to the actual prediction market venue

Respond in markdown-ready text.`,
    tools: ['swap', 'trade', 'whale', 'prices', 'positions'],
    maxTokens: 2048,
    temperature: 0.2,
  },
};

const INTERNAL_CAPABILITY_IDS: BeRightCapabilityId[] = ['scout', 'analyst', 'trader'];

export function isAgentAllowed(agentId: string): agentId is BeRightCapabilityId {
  return INTERNAL_CAPABILITY_IDS.includes(agentId as BeRightCapabilityId);
}

export function getAgentConfig(agentId: string): AgentConfig | null {
  if (!isAgentAllowed(agentId)) {
    return null;
  }

  return AGENTS[agentId];
}
