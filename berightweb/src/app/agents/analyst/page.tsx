'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './analyst.module.css';

// ══════════════════════════════════════════════════════════════════════════════
//  ANALYST AGENT - Superforecaster Methodology
//
//  What a senior research analyst does manually:
//  1. Gathers all available evidence on a topic
//  2. Finds historical base rates (reference class forecasting)
//  3. Weighs bullish vs bearish factors
//  4. Generates calibrated probability estimates
//  5. Tracks prediction accuracy over time
//
//  Analyst does ALL of this autonomously with Tetlock methodology.
// ══════════════════════════════════════════════════════════════════════════════

// Methodology components
const METHODOLOGY = [
  {
    step: 1,
    title: 'Outside View (Base Rate)',
    desc: 'Start with historical frequency - how often do events like this happen?',
    example: 'Incumbent presidents win re-election 66% of the time',
    icon: '📊',
  },
  {
    step: 2,
    title: 'Inside View (Evidence)',
    desc: 'Adjust based on specific factors for THIS situation',
    example: 'Economy strong (+5%), approval low (-8%), legal issues (-10%)',
    icon: '🔬',
  },
  {
    step: 3,
    title: 'Synthesis',
    desc: 'Combine views with appropriate weighting',
    example: 'Base: 66% → Adjusted: 53% (with confidence interval)',
    icon: '⚖️',
  },
  {
    step: 4,
    title: 'Calibration Check',
    desc: 'Compare to past accuracy - am I overconfident?',
    example: 'My 70% predictions happen 65% → slight overconfidence',
    icon: '🎯',
  },
];

// Analyst intents (what the agent can do)
const INTENTS = [
  { id: 'research', label: 'Research', desc: 'Deep dive on a market', cmd: '/research' },
  { id: 'probability', label: 'Probability', desc: 'Superforecaster estimate', cmd: '/prob' },
  { id: 'evidence', label: 'Evidence', desc: 'Bullish vs bearish factors', cmd: '/evidence' },
  { id: 'baserate', label: 'Base Rate', desc: 'Historical precedent', cmd: '/baserate' },
  { id: 'compare', label: 'Compare', desc: 'Price analysis across platforms', cmd: '/analyze' },
  { id: 'calibration', label: 'Calibration', desc: 'Track accuracy', cmd: '/calibrate' },
];

// The TRUE agentic flow (LLM is the brain)
const AGENTIC_FLOW = [
  {
    step: 1,
    title: 'Receive Analysis Request',
    desc: 'User asks for probability estimate or research',
    code: '"What\'s the probability Trump wins 2028?"',
    icon: '💬',
  },
  {
    step: 2,
    title: 'LLM Plans Research',
    desc: 'LLM determines what evidence to gather',
    code: 'getAgentDecision(input) → { tool_calls: ["find_base_rate", "gather_evidence"] }',
    icon: '🧠',
  },
  {
    step: 3,
    title: 'Execute Tools',
    desc: 'Gather base rates, evidence, market prices',
    code: 'tool.execute(params) → structured research data',
    icon: '⚡',
  },
  {
    step: 4,
    title: 'LLM Synthesizes',
    desc: 'Apply Tetlock methodology, generate estimate',
    code: 'synthesizeResponse() → probability + reasoning',
    icon: '✨',
  },
];

// What Analyst replaces
const HUMAN_TASKS = [
  'Read 20+ articles about a topic',
  'Search for historical precedents manually',
  'Track predictions in a spreadsheet',
  'Calculate Brier scores by hand',
  'Remember to check calibration',
  'Write up research reports',
];

// Reference classes (Tetlock methodology)
const REFERENCE_CLASSES = [
  { category: 'Elections', example: 'Incumbent re-election rates, party switching patterns' },
  { category: 'Economics', example: 'Recession frequency, rate cut timing' },
  { category: 'Technology', example: 'Product launch success rates, adoption curves' },
  { category: 'Geopolitics', example: 'Conflict resolution timelines, treaty compliance' },
  { category: 'Sports', example: 'Upset frequencies, home advantage effects' },
];

type TabType = 'overview' | 'methodology' | 'flow' | 'code';

export default function AnalystDeepDive() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [activeIntent, setActiveIntent] = useState('probability');

  return (
    <div className={styles.page}>
      <div className={styles.backgroundGrid} />

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.agentBadge}>
          <span className={styles.agentIcon}>📊</span>
          <div>
            <h1 className={styles.title}>ANALYST AGENT</h1>
            <p className={styles.subtitle}>Superforecaster Methodology for Prediction Markets</p>
          </div>
        </div>
        <a href="/agents" className={styles.backLink}>← Agents</a>
      </header>

      {/* Key Insight */}
      <div className={styles.insightBox}>
        <div className={styles.insightIcon}>🎯</div>
        <div className={styles.insightContent}>
          <strong>Philip Tetlock&apos;s Superforecasting Methodology</strong>
          <p>Outside View (base rates) + Inside View (specific evidence) = Calibrated Probability. Analyst applies rigorous forecasting discipline - no gut feelings, just evidence-weighted estimates.</p>
        </div>
      </div>

      {/* Tabs */}
      <nav className={styles.tabs}>
        {(['overview', 'methodology', 'flow', 'code'] as TabType[]).map((tab) => (
          <button
            key={tab}
            className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'overview' && '📊 Overview'}
            {tab === 'methodology' && '🎯 Methodology'}
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
            {/* What Analyst Replaces */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>What Analyst Replaces (Research Work)</h2>
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
                <span>Analyst delivers <strong>calibrated estimates</strong> with full reasoning</span>
              </div>
            </div>

            {/* Intents */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Analyst Capabilities</h2>
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
                <div className={styles.statValue}>5-15s</div>
                <div className={styles.statLabel}>Response</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>Opus</div>
                <div className={styles.statLabel}>LLM Model</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>0.4</div>
                <div className={styles.statLabel}>Temperature</div>
              </div>
            </div>
          </motion.section>
        )}

        {activeTab === 'methodology' && (
          <motion.section
            key="methodology"
            className={styles.content}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Tetlock Superforecasting Methodology</h2>
              <p className={styles.sectionDesc}>
                Based on Philip Tetlock&apos;s research showing that rigorous methodology beats
                gut instincts. Superforecasters beat CIA analysts by 30% through disciplined thinking.
              </p>

              <div className={styles.methodologySteps}>
                {METHODOLOGY.map((step) => (
                  <div key={step.step} className={styles.methodologyStep}>
                    <div className={styles.methodologyIcon}>{step.icon}</div>
                    <div className={styles.methodologyContent}>
                      <div className={styles.methodologyTitle}>
                        <span className={styles.methodologyNumber}>{step.step}.</span>
                        {step.title}
                      </div>
                      <div className={styles.methodologyDesc}>{step.desc}</div>
                      <div className={styles.methodologyExample}>
                        <strong>Example:</strong> {step.example}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Reference Class Database</h2>
              <p className={styles.sectionDesc}>
                Analyst maintains base rates for common prediction categories.
              </p>
              <div className={styles.referenceClasses}>
                {REFERENCE_CLASSES.map((rc) => (
                  <div key={rc.category} className={styles.referenceClass}>
                    <div className={styles.referenceCategory}>{rc.category}</div>
                    <div className={styles.referenceExample}>{rc.example}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Calibration Tracking</h2>
              <div className={styles.calibrationInfo}>
                <div className={styles.calibrationItem}>
                  <span className={styles.calibrationIcon}>📈</span>
                  <span>Tracks Brier Score for every prediction</span>
                </div>
                <div className={styles.calibrationItem}>
                  <span className={styles.calibrationIcon}>🎯</span>
                  <span>Identifies over/under-confidence patterns</span>
                </div>
                <div className={styles.calibrationItem}>
                  <span className={styles.calibrationIcon}>🔄</span>
                  <span>Updates beliefs when new evidence arrives</span>
                </div>
                <div className={styles.calibrationItem}>
                  <span className={styles.calibrationIcon}>📊</span>
                  <span>Compares to market consensus</span>
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
                Analyst uses Claude Opus for deeper reasoning. The LLM decides what research to conduct,
                applies Tetlock methodology, and generates calibrated estimates.
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
              <h3>Deep Reasoning vs Quick Scan</h3>
              <div className={styles.comparisonGrid}>
                <div className={styles.comparisonOther}>
                  <div className={styles.comparisonLabel}>🔍 Scout (Speed)</div>
                  <div className={styles.comparisonDesc}>
                    <p>Sonnet model, 0.2 temperature</p>
                    <p>Quick scans across platforms</p>
                    <p className={styles.detail}>Best for: &quot;What&apos;s hot?&quot;, &quot;Any arbs?&quot;</p>
                  </div>
                </div>
                <div className={styles.comparisonGood}>
                  <div className={styles.comparisonLabel}>📊 Analyst (Depth)</div>
                  <div className={styles.comparisonDesc}>
                    <p>Opus model, 0.4 temperature</p>
                    <p>Deep reasoning on one topic</p>
                    <p className={styles.benefit}>Best for: &quot;What&apos;s the probability?&quot;, &quot;Analyze this&quot;</p>
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
                <div className={styles.codeHeader}>agents/analyst/index.ts - Probability Estimation</div>
                <pre className={styles.codeContent}>{`// The estimate_probability tool
{
  name: 'estimate_probability',
  description: 'Generate a superforecaster-style probability estimate',
  parameters: {
    type: 'object',
    properties: {
      question: { type: 'string', description: 'The prediction question' },
      currentPrice: { type: 'number', description: 'Current market price' }
    }
  },
  execute: async ({ question, currentPrice }) => {
    // Gather base rate
    const baseRate = await findBaseRate(question);

    // Gather evidence
    const evidence = await gatherEvidence(question);

    // LLM applies Tetlock methodology
    const estimate = await llmChat({
      system: SUPERFORECASTER_PROMPT,
      user: \`Question: \${question}
Base Rate: \${baseRate}
Evidence: \${evidence}
Current Market: \${currentPrice}

Apply Outside View + Inside View synthesis.\`
    });

    return estimate;
  }
}`}</pre>
              </div>

              <div className={styles.codeBlock}>
                <div className={styles.codeHeader}>Tool Definitions</div>
                <pre className={styles.codeContent}>{`export const ANALYST_TOOLS: AnalystTool[] = [
  {
    name: 'research_market',
    description: 'Deep dive research on a specific market',
    execute: async ({ query }) => { /* ... */ }
  },
  {
    name: 'estimate_probability',
    description: 'Superforecaster methodology probability estimate',
    execute: async ({ question, currentPrice }) => { /* ... */ }
  },
  {
    name: 'gather_evidence',
    description: 'Collect bullish vs bearish factors',
    execute: async ({ market }) => { /* ... */ }
  },
  {
    name: 'find_base_rate',
    description: 'Find historical frequency for similar events',
    execute: async ({ eventType }) => { /* ... */ }
  },
  {
    name: 'compare_prices',
    description: 'Compare same market across platforms',
    execute: async ({ market }) => { /* ... */ }
  },
  {
    name: 'check_calibration',
    description: 'Check past prediction accuracy',
    execute: async () => { /* ... */ }
  }
];`}</pre>
              </div>

              <div className={styles.codeBlock}>
                <div className={styles.codeHeader}>Superforecaster System Prompt</div>
                <pre className={styles.codeContent}>{`const SUPERFORECASTER_PROMPT = \`You are a superforecaster using
Philip Tetlock's methodology.

ALWAYS follow this process:
1. OUTSIDE VIEW: Start with base rate
   - Find reference class frequency
   - Historical precedent matters

2. INSIDE VIEW: Adjust for specifics
   - What makes THIS case different?
   - Weight evidence by reliability

3. SYNTHESIS: Combine both views
   - Don't anchor too hard on base rate
   - Don't over-adjust for inside view
   - Express uncertainty honestly

4. CALIBRATION: Check your track record
   - Past predictions: Brier score
   - Over/under-confidence patterns

Output format:
- Probability: X% (confidence interval)
- Base Rate: Historical frequency
- Key Factors: Bullish/bearish
- Edge vs Market: Your view vs price\`;`}</pre>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

    </div>
  );
}
