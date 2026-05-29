/**
 * BeRight Agents - True Agentic Architecture
 *
 * Four specialized agents following the BeRight pattern:
 * - LLM is the brain (understands, decides)
 * - Tools are the hands (execute)
 * - Agents are specialists (each with unique purpose)
 *
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────┐
 * │                      ORCHESTRATOR                           │
 * │               (Understands → Routes → Synthesizes)          │
 * └──────────────────────────┬──────────────────────────────────┘
 *                            │
 *        ┌───────────────────┼───────────────────┐
 *        ▼                   ▼                   ▼
 * ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
 * │    SCOUT     │   │   ANALYST    │   │   TRADER     │
 * │ Speed+Breadth│   │    Depth     │   │  Execution   │
 * └──────────────┘   └──────────────┘   └──────────────┘
 *
 * Each agent follows the agentic loop:
 * 1. LLM understands natural language
 * 2. LLM decides which tools to call
 * 3. Code executes the tools
 * 4. LLM synthesizes the response
 *
 * @author BeRight Protocol
 * @version 3.0.0 - Bloomberg Terminal Architecture
 */

// Export all agents
export { default as Forecaster, FORECASTER_CONFIG, FORECASTER_TOOLS, FORECASTER_SOUL } from './forecaster';
export { default as Scout, SCOUT_CONFIG, SCOUT_TOOLS } from './scout';
export { default as Analyst, ANALYST_CONFIG, ANALYST_TOOLS } from './analyst';
export { default as Trader, TRADER_CONFIG, TRADER_TOOLS } from './trader';
export { default as Orchestrator, ORCHESTRATOR_CONFIG } from './orchestrator';
export { default as XDegen, XDEGEN_CONFIG, XDEGEN_TOOLS } from './xdegen';

// Export types
export type { ForecasterTool } from './forecaster';
export type { ScoutTool } from './scout';
export type { AnalystTool } from './analyst';
export type { TraderTool } from './trader';
export type { XDegenTool } from './xdegen';
export type { IntentType, AgentId, RoutingDecision } from './orchestrator';

// ============================================================================
// AGENT SUMMARY
// ============================================================================

/**
 * Agent roles and responsibilities
 */
export const AGENT_ROLES = {
  forecaster: {
    id: 'forecaster',
    name: 'Forecaster',
    emoji: '🔮',
    role: 'Autonomous Superforecaster',
    cognitive: 'Calibrated Reasoning',
    model: 'Claude Opus',
    temperature: 0.3,
    responseTime: '10-30 seconds',
    purpose: 'BE a forecaster - make predictions, track calibration, compete in the network',
    tools: [
      'triage_markets',
      'make_forecast',
      'record_forecast',
      'update_forecast',
      'check_my_calibration',
      'run_postmortem',
    ],
    triggers: [
      'What markets should I forecast?',
      'Make a prediction on X',
      'What\'s your forecast for X?',
      'Check my calibration',
      'Run postmortem on X',
    ],
  },
  scout: {
    id: 'scout',
    name: 'Scout',
    emoji: '🔍',
    role: 'Junior Analyst',
    cognitive: 'Pattern Recognition',
    model: 'Claude Sonnet',
    temperature: 0.2,
    responseTime: '<2 seconds',
    purpose: 'Speed + Breadth - Quick scans across all platforms',
    tools: [
      'get_hot_markets',
      'search_markets',
      'find_arbitrage',
      'compare_odds',
      'get_news',
      'get_tokenized_markets',
      'track_whales',
    ],
    triggers: [
      'What\'s hot?',
      'Any arbs?',
      'What\'s moving?',
      'Quick market scan',
      'Search for X',
    ],
  },
  analyst: {
    id: 'analyst',
    name: 'Analyst',
    emoji: '📊',
    role: 'Senior Research Analyst',
    cognitive: 'Deep Reasoning',
    model: 'Claude Opus',
    temperature: 0.4,
    responseTime: '5-15 seconds',
    purpose: 'Depth - Deep research on one topic at a time',
    tools: [
      'research_market',
      'estimate_probability',
      'gather_evidence',
      'find_base_rate',
      'compare_prices',
      'check_calibration',
    ],
    triggers: [
      'What\'s your probability for X?',
      'Analyze the Trump election market',
      'Why is this priced at 65%?',
      'Give me your research on Bitcoin ETF',
      'Should I bet YES or NO?',
    ],
  },
  trader: {
    id: 'trader',
    name: 'Trader',
    emoji: '💼',
    role: 'Execution Desk',
    cognitive: 'Risk Calculation',
    model: 'Claude Sonnet',
    temperature: 0.1,
    responseTime: '2-3 seconds',
    purpose: 'Execution - Precise, risk-aware action',
    tools: [
      'get_positions',
      'calculate_size',
      'find_best_price',
      'check_risk',
      'execute_trade',
      'set_alert',
    ],
    triggers: [
      'Buy $100 of YES on X',
      'What\'s my portfolio?',
      'How much should I bet?',
      'What\'s my risk exposure?',
      'Alert me when this hits 70%',
    ],
  },
  orchestrator: {
    id: 'orchestrator',
    name: 'Orchestrator',
    emoji: '🎯',
    role: 'Trading Floor Manager',
    cognitive: 'Intent Understanding',
    model: 'Claude Sonnet',
    temperature: 0.3,
    responseTime: '<1 second',
    purpose: 'Router - Understands intent, routes to specialists',
    tools: [], // Orchestrator doesn't have tools - it IS the router
    triggers: [
      'Any natural language query',
      'Complex multi-step requests',
      'Ambiguous questions',
    ],
  },
  xdegen: {
    id: 'xdegen',
    name: 'xDegen',
    emoji: '📢',
    role: 'Social Media Alpha Bot',
    cognitive: 'Content Generation',
    model: 'Claude Sonnet',
    temperature: 0.7,
    responseTime: '2-5 seconds',
    purpose: 'Autonomous X/Twitter posting - alpha signals, viral content, brand promotion',
    tools: [
      'generate_alpha_post',
      'post_to_twitter',
      'get_market_alpha',
      'check_post_status',
      'generate_thread',
      'schedule_post',
    ],
    triggers: [
      'Post about X',
      'Generate a tweet',
      'Create content',
      'Tweet the alpha',
      'Schedule a post',
      '/xpost',
      '/tweet',
    ],
  },
};

/**
 * Get all tool counts
 */
export function getToolCounts() {
  return {
    forecaster: 6,
    scout: 7,
    analyst: 6,
    trader: 6,
    xdegen: 6,
    total: 31,
  };
}

/**
 * Main entry point for the agent system
 *
 * Use this to process any user input through the full agent system.
 */
export async function processMessage(input: string) {
  const { default: Orchestrator } = await import('./orchestrator');
  return Orchestrator.execute(input);
}

if (require.main === module) {
  const input = process.argv.slice(2).join(' ').trim();

  if (!input) {
    console.error('Usage: npm run agents:personas -- "What markets are hot?"');
    process.exit(1);
  }

  processMessage(input)
    .then((response) => {
      console.log(response.text);
      if (response.data) {
        console.log('\nData:');
        console.log(JSON.stringify(response.data, null, 2));
      }
      process.exit(0);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
