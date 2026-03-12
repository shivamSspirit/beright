'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './scout.module.css';

// ══════════════════════════════════════════════════════════════════════════════
//  SCOUT AGENT - Human Replacement for Prediction Market Power Users
//
//  What a power user does manually (50+ times a day):
//  1. Opens Polymarket, Kalshi, Manifold, Limitless, Metaculus tabs
//  2. Looks at trending markets
//  3. Compares prices across platforms by eye
//  4. Calculates arbitrage spreads mentally
//  5. Checks news that might move markets
//
//  Scout does ALL of this autonomously in <2 seconds.
// ══════════════════════════════════════════════════════════════════════════════

// Real data sources (verified APIs)
const DATA_SOURCES = [
  {
    platform: 'Polymarket',
    api: 'gamma-api.polymarket.com',
    auth: 'None (Public)',
    data: 'Markets, prices, volume',
    emoji: '🟣',
    color: '#8B5CF6',
  },
  {
    platform: 'Kalshi (DFlow)',
    api: 'DFlow Metadata API',
    auth: 'None (Public)',
    data: 'Tokenized markets, orderbook, SPL tokens',
    emoji: '🔵',
    color: '#3B82F6',
  },
  {
    platform: 'Manifold',
    api: 'api.manifold.markets/v0',
    auth: 'None (Public)',
    data: 'Play-money markets, probabilities',
    emoji: '🟡',
    color: '#EAB308',
  },
  {
    platform: 'Limitless',
    api: 'api.limitless.exchange',
    auth: 'None (Public)',
    data: 'USDC markets, crypto focus',
    emoji: '🟢',
    color: '#22C55E',
  },
  {
    platform: 'Metaculus',
    api: 'metaculus.com/api2',
    auth: 'Token (Free)',
    data: 'Long-range forecasts',
    emoji: '🔴',
    color: '#EF4444',
  },
];

// Scout intents (what the agent can do)
const INTENTS = [
  { id: 'hot', label: 'Hot Markets', desc: 'Trending by volume', cmd: '/hot' },
  { id: 'arbitrage', label: 'Arbitrage', desc: 'Cross-platform spreads', cmd: '/arb' },
  { id: 'search', label: 'Search', desc: 'Find specific markets', cmd: '/scan' },
  { id: 'compare', label: 'Compare', desc: 'Odds across platforms', cmd: '/compare' },
  { id: 'news', label: 'News', desc: 'Market-moving intel', cmd: '/news' },
  { id: 'tokenized', label: 'Tokenized', desc: 'On-chain tradeable', cmd: '/tokenized' },
];

// The TRUE agentic flow (LLM is the brain)
const AGENTIC_FLOW = [
  {
    step: 1,
    title: 'Receive Natural Language',
    desc: 'User says anything in natural language',
    code: '"find me hot market opportunities"',
    icon: '💬',
  },
  {
    step: 2,
    title: 'LLM Understands & Decides',
    desc: 'LLM reads request, picks tools to call',
    code: 'getAgentDecision(input) → { tool_calls: ["get_hot_markets"] }',
    icon: '🧠',
  },
  {
    step: 3,
    title: 'Execute Tools',
    desc: 'Code runs the tools LLM decided on',
    code: 'tool.execute(params) → real API data',
    icon: '⚡',
  },
  {
    step: 4,
    title: 'LLM Synthesizes',
    desc: 'LLM reads tool results, creates response',
    code: 'synthesizeResponse(input, results) → human-readable',
    icon: '✨',
  },
];

// What Scout replaces
const HUMAN_TASKS = [
  'Open 5 browser tabs for each platform',
  'Manually scroll through trending markets',
  'Copy prices to spreadsheet for comparison',
  'Calculate arbitrage spreads by hand',
  'Check news sites for market-moving events',
  'Repeat 50+ times per day',
];

type TabType = 'overview' | 'data' | 'flow' | 'code';

export default function ScoutDeepDive() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [activeIntent, setActiveIntent] = useState('hot');

  return (
    <div className={styles.page}>
      <div className={styles.backgroundGrid} />

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.agentBadge}>
          <span className={styles.agentIcon}>🔍</span>
          <div>
            <h1 className={styles.title}>SCOUT AGENT</h1>
            <p className={styles.subtitle}>Human-Replacement for Prediction Market Power Users</p>
          </div>
        </div>
        <a href="/agents" className={styles.backLink}>← Agents</a>
      </header>

      {/* Key Insight */}
      <div className={styles.insightBox}>
        <div className={styles.insightIcon}>🧠</div>
        <div className={styles.insightContent}>
          <strong>LLM is the Brain. Tools are the Hands.</strong>
          <p>Scout uses natural language understanding - no keyword matching. The LLM decides which tools to call based on what you say, then synthesizes the results. Truly autonomous.</p>
        </div>
      </div>

      {/* Tabs */}
      <nav className={styles.tabs}>
        {(['overview', 'data', 'flow', 'code'] as TabType[]).map((tab) => (
          <button
            key={tab}
            className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'overview' && '📊 Overview'}
            {tab === 'data' && '🔌 Data Sources'}
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
            {/* What Scout Replaces */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>What Scout Replaces (Human Work)</h2>
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
                <span>Scout does all of this in <strong>&lt;2 seconds</strong></span>
              </div>
            </div>

            {/* Intents */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Scout Capabilities</h2>
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
                <div className={styles.statValue}>5</div>
                <div className={styles.statLabel}>Platforms</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>&lt;2s</div>
                <div className={styles.statLabel}>Response</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>3%</div>
                <div className={styles.statLabel}>Arb Threshold</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>Real</div>
                <div className={styles.statLabel}>Data</div>
              </div>
            </div>
          </motion.section>
        )}

        {activeTab === 'data' && (
          <motion.section
            key="data"
            className={styles.content}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Real Data Sources (Verified APIs)</h2>
              <p className={styles.sectionDesc}>
                Scout fetches from all 5 platforms in parallel using real, verified APIs.
                No mocked data. No hallucinated prices.
              </p>

              <div className={styles.dataSourceList}>
                {DATA_SOURCES.map((source) => (
                  <div
                    key={source.platform}
                    className={styles.dataSource}
                    style={{ '--platform-color': source.color } as React.CSSProperties}
                  >
                    <div className={styles.dataSourceHeader}>
                      <span className={styles.dataSourceEmoji}>{source.emoji}</span>
                      <span className={styles.dataSourceName}>{source.platform}</span>
                    </div>
                    <div className={styles.dataSourceApi}>
                      <code>{source.api}</code>
                    </div>
                    <div className={styles.dataSourceMeta}>
                      <span>Auth: {source.auth}</span>
                      <span>Data: {source.data}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Data Accuracy</h2>
              <div className={styles.accuracyList}>
                <div className={styles.accuracyItem}>
                  <span className={styles.accuracyCheck}>✓</span>
                  <span>Prices fetched directly from platform APIs</span>
                </div>
                <div className={styles.accuracyItem}>
                  <span className={styles.accuracyCheck}>✓</span>
                  <span>10-second cache TTL for freshness</span>
                </div>
                <div className={styles.accuracyItem}>
                  <span className={styles.accuracyCheck}>✓</span>
                  <span>Parallel fetching with timeout handling</span>
                </div>
                <div className={styles.accuracyItem}>
                  <span className={styles.accuracyCheck}>✓</span>
                  <span>Sports parlays filtered (broken pricing)</span>
                </div>
                <div className={styles.accuracyItem}>
                  <span className={styles.accuracyCheck}>✓</span>
                  <span>Named entity matching for cross-platform comparison</span>
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
                No keyword matching. No switch statements. The LLM understands your natural language request,
                decides which tools to call, and synthesizes the response. Like talking to a human expert.
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
              <h3>LLM is the Brain, Not a Router</h3>
              <div className={styles.comparisonGrid}>
                <div className={styles.comparisonBad}>
                  <div className={styles.comparisonLabel}>❌ Keyword Matching (Wrong)</div>
                  <div className={styles.comparisonDesc}>
                    <p>if (input.includes("hot")) → handler</p>
                    <p>switch (intent) → case "hot":</p>
                    <p className={styles.problem}>Problem: Brittle, misses natural language</p>
                  </div>
                </div>
                <div className={styles.comparisonGood}>
                  <div className={styles.comparisonLabel}>✓ LLM Decides (Right)</div>
                  <div className={styles.comparisonDesc}>
                    <p>LLM understands natural language</p>
                    <p>LLM picks which tools to call</p>
                    <p className={styles.benefit}>Result: Handles any phrasing, truly autonomous</p>
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
                <div className={styles.codeHeader}>agents/scout/index.ts - True Agentic Execute</div>
                <pre className={styles.codeContent}>{`export async function execute(input: string): Promise<SkillResponse> {
  const startTime = Date.now();

  // Step 1: Ask LLM to decide what to do
  const decision = await getAgentDecision(input);

  if (decision.direct_response) {
    // LLM decided no tools needed
    return { text: decision.direct_response, mood: 'NEUTRAL' };
  }

  // Step 2: Execute the tools LLM decided to call
  const toolResults = [];
  for (const toolCall of decision.tool_calls) {
    const tool = SCOUT_TOOLS.find(t => t.name === toolCall.name);
    const result = await tool.execute(toolCall.parameters);
    toolResults.push({ tool: toolCall.name, result });
  }

  // Step 3: Ask LLM to synthesize results
  const response = await synthesizeResponse(input, decision, toolResults);
  return { text: response, data: toolResults };
}`}</pre>
              </div>

              <div className={styles.codeBlock}>
                <div className={styles.codeHeader}>Tool Definitions (LLM Decides)</div>
                <pre className={styles.codeContent}>{`export const SCOUT_TOOLS: ScoutTool[] = [
  {
    name: 'get_hot_markets',
    description: 'Fetch trending markets across all platforms...',
    parameters: { type: 'object', properties: { limit: {...} } },
    execute: async (params) => await getHotMarkets(params.limit)
  },
  {
    name: 'search_markets',
    description: 'Search markets by topic like "Trump", "Bitcoin"...',
    parameters: { type: 'object', properties: { query: {...} } },
    execute: async (params) => await searchMarkets(params.query)
  },
  // ... find_arbitrage, compare_odds, get_news, etc.
];`}</pre>
              </div>

              <div className={styles.codeBlock}>
                <div className={styles.codeHeader}>LLM Decision Making</div>
                <pre className={styles.codeContent}>{`async function getAgentDecision(userInput: string): Promise<AgentDecision> {
  const response = await llmChat({
    system: SCOUT_SYSTEM_PROMPT,
    user: \`User request: "\${userInput}"

Available tools: [get_hot_markets, search_markets, find_arbitrage, ...]

Decide what to do. Return JSON:
{ "reasoning": "...", "tool_calls": [{name, parameters}] }\`
  });

  return JSON.parse(response.text);
  // LLM understands natural language and picks the right tools!
}`}</pre>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

    </div>
  );
}
