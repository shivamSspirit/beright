'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './trader.module.css';

// ══════════════════════════════════════════════════════════════════════════════
//  TRADER AGENT - Execution Desk
//
//  What a professional trader does manually:
//  1. Checks current portfolio positions across platforms
//  2. Calculates position sizes using Kelly criterion
//  3. Finds best prices/liquidity across venues
//  4. Assesses risk exposure and correlations
//  5. Executes trades with proper sizing
//  6. Sets alerts for price movements
//
//  Trader does ALL of this with disciplined risk management.
// ══════════════════════════════════════════════════════════════════════════════

// Risk management principles
const RISK_PRINCIPLES = [
  {
    principle: 'Kelly Criterion',
    desc: 'Optimal position sizing based on edge and probability',
    formula: 'f* = (bp - q) / b',
    icon: '📐',
  },
  {
    principle: 'Fractional Kelly',
    desc: 'Use 25-50% of full Kelly for safety margin',
    formula: 'f = 0.25 × f*',
    icon: '🛡️',
  },
  {
    principle: 'Max Position',
    desc: 'Never bet more than 5% of bankroll on single market',
    formula: 'max = 0.05 × bankroll',
    icon: '🚫',
  },
  {
    principle: 'Correlation Risk',
    desc: 'Track correlated bets (e.g., all Trump markets)',
    formula: 'exposure = Σ correlated_positions',
    icon: '🔗',
  },
];

// Trader intents (what the agent can do)
const INTENTS = [
  { id: 'positions', label: 'Positions', desc: 'Cross-platform portfolio view', cmd: '/positions' },
  { id: 'size', label: 'Size', desc: 'Kelly criterion sizing', cmd: '/size' },
  { id: 'price', label: 'Best Price', desc: 'Find best execution venue', cmd: '/best' },
  { id: 'risk', label: 'Risk', desc: 'Exposure and drawdown analysis', cmd: '/risk' },
  { id: 'trade', label: 'Execute', desc: 'Place trades across platforms', cmd: '/trade' },
  { id: 'alert', label: 'Alert', desc: 'Set price/event triggers', cmd: '/alert' },
];

// The TRUE agentic flow
const AGENTIC_FLOW = [
  {
    step: 1,
    title: 'Receive Trade Request',
    desc: 'User wants to execute or analyze a trade',
    code: '"Buy $100 YES on Trump 2028"',
    icon: '💬',
  },
  {
    step: 2,
    title: 'LLM Assesses & Plans',
    desc: 'Check risk, find best price, calculate size',
    code: 'getAgentDecision() → { tool_calls: ["check_risk", "find_best_price", "calculate_size"] }',
    icon: '🧠',
  },
  {
    step: 3,
    title: 'Execute Tools',
    desc: 'Get positions, check risk limits, find venue',
    code: 'tool.execute() → risk_check, best_venue, kelly_size',
    icon: '⚡',
  },
  {
    step: 4,
    title: 'LLM Synthesizes',
    desc: 'Generate trade plan with risk assessment',
    code: 'synthesizeResponse() → execution_plan + warnings',
    icon: '✨',
  },
];

// What Trader replaces
const HUMAN_TASKS = [
  'Track positions across 5 different platforms',
  'Calculate Kelly criterion by hand',
  'Compare prices across exchanges manually',
  'Monitor correlation between similar bets',
  'Mental math for position sizing',
  'Set price alerts on each platform separately',
];

// Platform execution capabilities
const PLATFORMS = [
  { name: 'Polymarket', type: 'Crypto', execution: 'USDC', emoji: '🟣' },
  { name: 'Kalshi', type: 'Regulated', execution: 'USD', emoji: '🔵' },
  { name: 'Manifold', type: 'Play-money', execution: 'M$', emoji: '🟡' },
  { name: 'Limitless', type: 'Crypto', execution: 'USDC', emoji: '🟢' },
];

type TabType = 'overview' | 'risk' | 'flow' | 'code';

export default function TraderDeepDive() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [activeIntent, setActiveIntent] = useState('positions');

  return (
    <div className={styles.page}>
      <div className={styles.backgroundGrid} />

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.agentBadge}>
          <span className={styles.agentIcon}>💼</span>
          <div>
            <h1 className={styles.title}>TRADER AGENT</h1>
            <p className={styles.subtitle}>Execution Desk with Risk Management</p>
          </div>
        </div>
        <a href="/agents" className={styles.backLink}>← Agents</a>
      </header>

      {/* Key Insight */}
      <div className={styles.insightBox}>
        <div className={styles.insightIcon}>🎯</div>
        <div className={styles.insightContent}>
          <strong>Disciplined Execution with Kelly Sizing</strong>
          <p>Trader calculates optimal position sizes, finds best prices across platforms, and manages risk exposure. Never bet more than your edge justifies.</p>
        </div>
      </div>

      {/* Tabs */}
      <nav className={styles.tabs}>
        {(['overview', 'risk', 'flow', 'code'] as TabType[]).map((tab) => (
          <button
            key={tab}
            className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'overview' && '💼 Overview'}
            {tab === 'risk' && '🛡️ Risk Management'}
            {tab === 'flow' && '🔄 Agentic Flow'}
            {tab === 'code' && '💻 Implementation'}
          </button>
        ))}
      </nav>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.section
            key="overview"
            className={styles.content}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {/* What Trader Replaces */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>What Trader Replaces (Execution Work)</h2>
              <div className={styles.humanTasks}>
                {HUMAN_TASKS.map((task, i) => (
                  <div key={i} className={styles.humanTask}>
                    <span className={styles.strikethrough}>{task}</span>
                    <span className={styles.checkmark}>✓</span>
                  </div>
                ))}
              </div>
              <div className={styles.replacementResult}>
                <span className={styles.arrow}>→</span>
                <span>Trader executes with <strong>optimal sizing</strong> and <strong>risk limits</strong></span>
              </div>
            </div>

            {/* Intents */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Trader Capabilities</h2>
              <div className={styles.intentGrid}>
                {INTENTS.map((intent) => (
                  <div
                    key={intent.id}
                    className={`${styles.intentCard} ${activeIntent === intent.id ? styles.intentActive : ''}`}
                    onClick={() => setActiveIntent(intent.id)}
                  >
                    <div className={styles.intentCmd}>{intent.cmd}</div>
                    <div className={styles.intentLabel}>{intent.label}</div>
                    <div className={styles.intentDesc}>{intent.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statValue}>6</div>
                <div className={styles.statLabel}>Tools</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>2-3s</div>
                <div className={styles.statLabel}>Response</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>Sonnet</div>
                <div className={styles.statLabel}>LLM Model</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>0.1</div>
                <div className={styles.statLabel}>Temperature</div>
              </div>
            </div>

            {/* Platforms */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Execution Venues</h2>
              <div className={styles.platformGrid}>
                {PLATFORMS.map((p) => (
                  <div key={p.name} className={styles.platformCard}>
                    <span className={styles.platformEmoji}>{p.emoji}</span>
                    <div className={styles.platformInfo}>
                      <div className={styles.platformName}>{p.name}</div>
                      <div className={styles.platformMeta}>
                        <span>{p.type}</span>
                        <span>•</span>
                        <span>{p.execution}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.section>
        )}

        {activeTab === 'risk' && (
          <motion.section
            key="risk"
            className={styles.content}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Risk Management Framework</h2>
              <p className={styles.sectionDesc}>
                Trader applies professional risk management principles. Never bet more than your edge justifies.
                Use fractional Kelly for a safety margin.
              </p>

              <div className={styles.riskPrinciples}>
                {RISK_PRINCIPLES.map((rp) => (
                  <div key={rp.principle} className={styles.riskPrinciple}>
                    <div className={styles.riskIcon}>{rp.icon}</div>
                    <div className={styles.riskContent}>
                      <div className={styles.riskTitle}>{rp.principle}</div>
                      <div className={styles.riskDesc}>{rp.desc}</div>
                      <code className={styles.riskFormula}>{rp.formula}</code>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Kelly Criterion Example</h2>
              <div className={styles.kellyExample}>
                <div className={styles.kellyStep}>
                  <div className={styles.kellyLabel}>Given:</div>
                  <div className={styles.kellyValue}>
                    Market price: 60% | Your estimate: 70% | Win: 40¢ | Lose: 60¢
                  </div>
                </div>
                <div className={styles.kellyStep}>
                  <div className={styles.kellyLabel}>Edge:</div>
                  <div className={styles.kellyValue}>
                    70% × 40¢ - 30% × 60¢ = 28¢ - 18¢ = <strong>10¢ edge</strong>
                  </div>
                </div>
                <div className={styles.kellyStep}>
                  <div className={styles.kellyLabel}>Full Kelly:</div>
                  <div className={styles.kellyValue}>
                    f* = 10¢ / 40¢ = <strong>25%</strong> of bankroll
                  </div>
                </div>
                <div className={styles.kellyStep}>
                  <div className={styles.kellyLabel}>1/4 Kelly (safe):</div>
                  <div className={styles.kellyValue}>
                    f = 0.25 × 25% = <strong>6.25%</strong> of bankroll
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Risk Checks Before Execution</h2>
              <div className={styles.riskChecks}>
                <div className={styles.riskCheck}>
                  <span className={styles.riskCheckIcon}>✓</span>
                  <span>Position doesn&apos;t exceed max single-market limit (5%)</span>
                </div>
                <div className={styles.riskCheck}>
                  <span className={styles.riskCheckIcon}>✓</span>
                  <span>Total correlated exposure within limits</span>
                </div>
                <div className={styles.riskCheck}>
                  <span className={styles.riskCheckIcon}>✓</span>
                  <span>Not increasing position at worse price</span>
                </div>
                <div className={styles.riskCheck}>
                  <span className={styles.riskCheckIcon}>✓</span>
                  <span>Sufficient liquidity at target venue</span>
                </div>
                <div className={styles.riskCheck}>
                  <span className={styles.riskCheckIcon}>✓</span>
                  <span>Drawdown limits not breached</span>
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {activeTab === 'flow' && (
          <motion.section
            key="flow"
            className={styles.content}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>True Agentic Flow (LLM Decides)</h2>
              <p className={styles.sectionDesc}>
                Trader uses Claude Sonnet with low temperature (0.1) for precise, risk-aware decisions.
                Every execution is validated against risk limits before proceeding.
              </p>

              <div className={styles.flowDiagram}>
                {AGENTIC_FLOW.map((step, i) => (
                  <div key={step.step} className={styles.flowStep}>
                    <div className={styles.flowStepNumber}>{step.step}</div>
                    <div className={styles.flowStepContent}>
                      <div className={styles.flowStepIcon}>{step.icon}</div>
                      <div className={styles.flowStepTitle}>{step.title}</div>
                      <div className={styles.flowStepDesc}>{step.desc}</div>
                      <code className={styles.flowStepCode}>{step.code}</code>
                    </div>
                    {i < AGENTIC_FLOW.length - 1 && (
                      <div className={styles.flowConnector}>↓</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.notTwoTier}>
              <h3>Precision vs Speed Trade-off</h3>
              <div className={styles.comparisonGrid}>
                <div className={styles.comparisonOther}>
                  <div className={styles.comparisonLabel}>🔍 Scout (Speed)</div>
                  <div className={styles.comparisonDesc}>
                    <p>Temperature 0.2</p>
                    <p>Quick scans, market overview</p>
                    <p className={styles.detail}>Best for: Discovery, trending</p>
                  </div>
                </div>
                <div className={styles.comparisonGood}>
                  <div className={styles.comparisonLabel}>💼 Trader (Precision)</div>
                  <div className={styles.comparisonDesc}>
                    <p>Temperature 0.1</p>
                    <p>Precise calculations, no creativity</p>
                    <p className={styles.benefit}>Best for: Execution, risk, sizing</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {activeTab === 'code' && (
          <motion.section
            key="code"
            className={styles.content}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Implementation</h2>

              <div className={styles.codeBlock}>
                <div className={styles.codeHeader}>agents/trader/index.ts - Kelly Position Sizing</div>
                <pre className={styles.codeContent}>{`// The calculate_size tool
{
  name: 'calculate_size',
  description: 'Calculate optimal position size using Kelly criterion',
  parameters: {
    type: 'object',
    properties: {
      estimatedProbability: { type: 'number' },
      marketPrice: { type: 'number' },
      bankroll: { type: 'number' },
      kellyFraction: { type: 'number', default: 0.25 }
    }
  },
  execute: async ({ estimatedProbability, marketPrice, bankroll, kellyFraction }) => {
    const p = estimatedProbability;
    const q = 1 - p;
    const b = (1 - marketPrice) / marketPrice; // Odds received

    // Full Kelly formula: f* = (bp - q) / b
    const fullKelly = (b * p - q) / b;

    // Apply fractional Kelly for safety
    const fractionalKelly = Math.max(0, fullKelly * kellyFraction);

    // Apply position limits
    const maxPosition = bankroll * 0.05; // 5% max
    const suggestedSize = Math.min(bankroll * fractionalKelly, maxPosition);

    return {
      fullKelly: (fullKelly * 100).toFixed(1) + '%',
      fractionalKelly: (fractionalKelly * 100).toFixed(1) + '%',
      suggestedSize: '$' + suggestedSize.toFixed(2),
      edge: (p - marketPrice) * 100 + '%'
    };
  }
}`}</pre>
              </div>

              <div className={styles.codeBlock}>
                <div className={styles.codeHeader}>Tool Definitions</div>
                <pre className={styles.codeContent}>{`export const TRADER_TOOLS: TraderTool[] = [
  {
    name: 'get_positions',
    description: 'Get current portfolio across all platforms',
    execute: async () => { /* ... */ }
  },
  {
    name: 'calculate_size',
    description: 'Kelly criterion position sizing',
    execute: async ({ probability, price, bankroll }) => { /* ... */ }
  },
  {
    name: 'find_best_price',
    description: 'Find best execution venue for a market',
    execute: async ({ market }) => { /* ... */ }
  },
  {
    name: 'check_risk',
    description: 'Assess current risk exposure',
    execute: async () => { /* ... */ }
  },
  {
    name: 'execute_trade',
    description: 'Place trade on specified platform',
    execute: async ({ platform, market, side, amount }) => { /* ... */ }
  },
  {
    name: 'set_alert',
    description: 'Set price alert for a market',
    execute: async ({ market, targetPrice }) => { /* ... */ }
  }
];`}</pre>
              </div>

              <div className={styles.codeBlock}>
                <div className={styles.codeHeader}>Risk Check Before Execution</div>
                <pre className={styles.codeContent}>{`// Before any trade execution
async function validateTrade(trade: TradeRequest): Promise<RiskCheck> {
  const positions = await getPositions();
  const exposure = calculateCorrelatedExposure(positions, trade);

  const checks = {
    positionLimit: trade.amount <= bankroll * 0.05,
    correlationLimit: exposure <= bankroll * 0.20,
    drawdownLimit: currentDrawdown < 0.15,
    liquidityOk: await checkLiquidity(trade),
  };

  const passed = Object.values(checks).every(c => c);

  return {
    passed,
    checks,
    warnings: !passed ? generateWarnings(checks) : []
  };
}`}</pre>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

    </div>
  );
}
