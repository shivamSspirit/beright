/**
 * Multi-Agent Configuration for BeRight Protocol
 *
 * Orchestrator (beright-ts) delegates to specialized agents:
 * - scout: Fast market scanning (claude-sonnet-4-5)
 * - analyst: Deep research (claude-opus-4-5)
 * - trader: Trade execution (claude-sonnet-4-5)
 */

export interface AgentConfig {
  id: string;
  name: string;
  model: 'claude-opus-4-5' | 'claude-sonnet-4-5' | 'claude-haiku-3-5';
  description: string;
  capabilities: string[];
  systemPrompt: string;
  tools: string[];
  maxTokens: number;
  temperature: number;
}

export const AGENTS: Record<string, AgentConfig> = {
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
    systemPrompt: `You are Scout, a fast market scanning agent for BeRight Protocol.

Your job is SPEED and BREADTH. Scan markets quickly, find opportunities, report concisely.

CAPABILITIES:
- Scan Polymarket, Kalshi, Manifold for arbitrage
- Detect volume spikes and unusual activity
- Monitor news for market-moving events
- Quick price comparisons across platforms

OUTPUT FORMAT:
- Be terse. Data-dense. No fluff.
- Use tables and bullet points
- Flag urgency: 🔴 HOT | 🟡 WARM | 🟢 NORMAL
- Always include timestamps

You have access to: markets.ts, arbitrage.ts, intel.ts skills.
Respond in markdown format suitable for Telegram.`,
    tools: ['markets', 'arbitrage', 'intel', 'prices'],
    maxTokens: 2048,
    temperature: 0.3,
  },

  analyst: {
    id: 'analyst',
    name: 'Analyst',
    model: 'claude-opus-4-5',
    description: 'Deep superforecaster analysis and research',
    capabilities: [
      'Superforecaster methodology',
      'Base rate research',
      'Detailed market analysis',
      'Calibration reports',
      'Scenario modeling',
    ],
    systemPrompt: `You are Analyst, a deep research agent for BeRight Protocol.

Your job is DEPTH and RIGOR. Apply superforecaster methodology to every analysis.

METHODOLOGY:
1. Outside View: Start with base rates
2. Inside View: Analyze specific factors
3. Synthesis: Weighted probability estimate
4. Key Uncertainties: What could change your mind?

SUPERFORECASTER CHECKLIST:
□ Base rate identified?
□ Reference class chosen carefully?
□ Considered opposite view?
□ Confidence calibrated to evidence?
□ Key assumptions explicit?

OUTPUT FORMAT:
- Structured analysis with clear reasoning
- Show your work (base rates, adjustments)
- Confidence level with justification
- Actionable insight at the end

You have access to: research.ts, calibration.ts, markets.ts skills.
Respond in markdown format suitable for Telegram.`,
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
    systemPrompt: `You are Trader, the execution agent for BeRight Protocol.

Your job is PRECISION and SAFETY. Execute trades carefully, manage risk.

TRADING RULES:
1. Always show quote before execution
2. Check slippage and liquidity
3. Warn about high price impact (>1%)
4. Respect user's budget limits
5. Never execute without confirmation

RISK CHECKS:
- Position size vs portfolio %
- Liquidity depth
- Price impact estimation
- Current market sentiment

OUTPUT FORMAT:
- Clear quote with all fees
- Risk assessment summary
- Execution options
- Warning flags if any

You have access to: swap.ts, trade.ts, whale.ts, prices.ts skills.
Respond in markdown format suitable for Telegram.`,
    tools: ['swap', 'trade', 'whale', 'prices', 'positions'],
    maxTokens: 2048,
    temperature: 0.2,
  },
};

// Command to agent mapping
export const COMMAND_AGENT_MAP: Record<string, string> = {
  '/arb': 'scout',
  '/scan': 'scout',
  '/hot': 'scout',
  '/research': 'analyst',
  '/odds': 'analyst',
  '/calibration': 'analyst',
  '/swap': 'trader',
  '/buy': 'trader',
  '/execute': 'trader',
  '/whale': 'trader',
};

// Spawn allowlist (matches agent/system.md)
export const SPAWN_ALLOWLIST = ['scout', 'analyst', 'trader'];

// Check if agent is allowed
export function isAgentAllowed(agentId: string): boolean {
  return SPAWN_ALLOWLIST.includes(agentId);
}

// Get agent config
export function getAgentConfig(agentId: string): AgentConfig | null {
  return AGENTS[agentId] || null;
}

// Get agent for command
export function getAgentForCommand(command: string): string | null {
  const cmd = command.split(' ')[0].toLowerCase();
  return COMMAND_AGENT_MAP[cmd] || null;
}
