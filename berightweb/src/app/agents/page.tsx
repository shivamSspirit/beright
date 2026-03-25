'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './agents.module.css';

// ══════════════════════════════════════════════════════════════════════════════
//  AGENT PROCESS VISUALIZER
//  Shows how Scout, Analyst, Trader, and Orchestrator actually work
// ══════════════════════════════════════════════════════════════════════════════

// SVG Icon components
const AgentPageIcons: Record<string, React.ReactNode> = {
  // Agent icons
  scout: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  ),
  analyst: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  ),
  trader: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  ),
  orchestrator: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  ),
  // Cognitive loop phase icons
  perceive: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  beliefs: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 10h.01M12 10h.01M16 10h.01" />
    </svg>
  ),
  evaluate: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1ZM2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1ZM7 21h10M12 3v18" />
    </svg>
  ),
  deliberate: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
    </svg>
  ),
  plan: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4M12 16h4M8 11h.01M8 16h.01" />
    </svg>
  ),
  act: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  ),
  reflect: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  ),
  // Channel icons
  terminal: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" x2="20" y1="19" y2="19" />
    </svg>
  ),
  webapp: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  api: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  ),
  discord: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  whatsapp: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
};

interface AgentProcess {
  id: string;
  name: string;
  role: string;
  model: string;
  temperature: number;
  maxGoals: number;
  color: string;
  iconKey: string;
  speed: string;
  capabilities: string[];
  triggers: string[];
  inputs: string[];
  processing: string[];
  outputs: string[];
}

const agents: AgentProcess[] = [
  {
    id: 'scout',
    name: 'SCOUT',
    role: 'Speed + Breadth',
    model: 'Claude Sonnet',
    temperature: 0.2,
    maxGoals: 10,
    color: '#00C2FF',
    iconKey: 'scout',
    speed: '<2s',
    capabilities: ['market_scanning', 'arbitrage_detection', 'news_monitoring', 'whale_tracking'],
    triggers: ['/hot', '/arb', '/scan', '/trending', '/whale'],
    inputs: ['Market filters', 'Topic keywords', 'Platform selection'],
    processing: [
      'Fetch data from 5 platforms',
      'Detect price discrepancies',
      'Calculate arbitrage spreads',
      'Identify volume anomalies',
      'Flag opportunities for Analyst'
    ],
    outputs: ['Market data', 'Arbitrage opportunities', 'Trend alerts', 'Whale movements']
  },
  {
    id: 'analyst',
    name: 'ANALYST',
    role: 'Deep Researcher',
    model: 'Claude Opus',
    temperature: 0.4,
    maxGoals: 3,
    color: '#A855F7',
    iconKey: 'analyst',
    speed: '5-15s',
    capabilities: ['deep_research', 'probability_estimation', 'claim_verification', 'calibration'],
    triggers: ['/research', '/odds', '/analyze', '/forecast'],
    inputs: ['Question to analyze', 'Scout data', 'Historical context'],
    processing: [
      'Apply superforecaster methodology',
      'Calculate base rates',
      'Identify reference classes',
      'Consider outside view',
      'Synthesize probability estimate'
    ],
    outputs: ['Probability forecast', 'Confidence interval', 'Key evidence', 'Edge identification']
  },
  {
    id: 'trader',
    name: 'TRADER',
    role: 'Execution Desk',
    model: 'Claude Sonnet',
    temperature: 0.1,
    maxGoals: 5,
    color: '#10B981',
    iconKey: 'trader',
    speed: '2-3s',
    capabilities: ['trade_execution', 'risk_management', 'position_monitoring', 'portfolio_management'],
    triggers: ['/buy', '/sell', '/swap', '/portfolio', '/positions'],
    inputs: ['Market ticker', 'Direction', 'Size', 'Price limits'],
    processing: [
      'Validate authorization',
      'Calculate position size (Kelly)',
      'Assess risk/reward',
      'Generate quote with fees',
      'Execute only with confirmation'
    ],
    outputs: ['Trade quote', 'Risk assessment', 'Fee breakdown', 'Execution confirmation']
  },
  {
    id: 'orchestrator',
    name: 'ORCHESTRATOR',
    role: 'Intent Router',
    model: 'Claude Sonnet',
    temperature: 0.3,
    maxGoals: 5,
    color: '#FB923C',
    iconKey: 'orchestrator',
    speed: '<1s routing',
    capabilities: ['coordination', 'planning', 'conflict_resolution', 'goal_generation'],
    triggers: ['Arbitrage signal', 'Whale movement', 'Prediction resolved', 'Scheduled task'],
    inputs: ['World state', 'Signals', 'Agent status', 'Pending goals'],
    processing: [
      'PERCEIVE: Gather signals',
      'UPDATE BELIEFS: Score confidence',
      'EVALUATE: Check biases',
      'DELIBERATE: Create goals',
      'PLAN: Assign to agents',
      'ACT: Execute steps',
      'REFLECT: Learn from outcomes'
    ],
    outputs: ['Goal assignments', 'Agent coordination', 'Conflict resolution', 'Learning updates']
  }
];

const cognitiveLoopPhases = [
  { id: 'perceive', name: 'PERCEIVE', desc: 'Gather unprocessed signals from world state', iconKey: 'perceive' },
  { id: 'beliefs', name: 'UPDATE BELIEFS', desc: 'Convert observations to confidence-scored beliefs', iconKey: 'beliefs' },
  { id: 'evaluate', name: 'EVALUATE', desc: 'Analyze episodes, detect biases, extract lessons', iconKey: 'evaluate' },
  { id: 'deliberate', name: 'DELIBERATE', desc: 'Create goals from high-priority events', iconKey: 'deliberate' },
  { id: 'plan', name: 'PLAN', desc: 'Create action plan with steps and preconditions', iconKey: 'plan' },
  { id: 'act', name: 'ACT', desc: 'Execute plan, delegate to specialist agents', iconKey: 'act' },
  { id: 'reflect', name: 'REFLECT', desc: 'Learn from outcomes, update calibration', iconKey: 'reflect' }
];

const channels = [
  { name: 'Terminal', iconKey: 'terminal', status: 'gateway' },
  { name: 'Web App', iconKey: 'webapp', status: 'gateway' },
  { name: 'API', iconKey: 'api', status: 'gateway' },
  { name: 'Discord', iconKey: 'discord', status: 'gateway' },
  { name: 'WhatsApp', iconKey: 'whatsapp', status: 'coming' },
];

export default function AgentVisualizer() {
  const router = useRouter();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [activePhase, setActivePhase] = useState(0);
  const [isAnimating, setIsAnimating] = useState(true);

  // Animate cognitive loop
  useEffect(() => {
    if (!isAnimating) return;
    const interval = setInterval(() => {
      setActivePhase(prev => (prev + 1) % cognitiveLoopPhases.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [isAnimating]);

  const selectedAgentData = agents.find(a => a.id === selectedAgent);

  return (
    <div className={styles.page}>
      <div className={styles.backgroundGrid} />

      {/* Header */}
      <header className={styles.header}>
        <h1 className={styles.title}>Agent Architecture</h1>
        <p className={styles.subtitle}>Gateway → Agents → Intelligence</p>
      </header>

      {/* Architecture Overview */}
      <section className={styles.architectureSection}>
        {/* Channels Row */}
        <div className={styles.channelsRow}>
          <div className={styles.channelsLabel}>CHANNELS (Input/Output)</div>
          <div className={styles.channelsList}>
            {channels.map((channel, i) => (
              <div key={i} className={styles.channelBadge}>
                <span>{AgentPageIcons[channel.iconKey]}</span>
                <span>{channel.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Arrow Down */}
        <div className={styles.flowArrow}>
          <div className={styles.arrowLine} />
          <div className={styles.arrowHead}>▼</div>
        </div>

        {/* Gateway */}
        <div className={styles.gatewayBox}>
          <div className={styles.gatewayIcon}>◈</div>
          <div className={styles.gatewayContent}>
            <h3>OPENCLAW GATEWAY</h3>
            <p>Single source of truth for sessions, routing, and connections</p>
          </div>
        </div>

        {/* Arrow Down */}
        <div className={styles.flowArrow}>
          <div className={styles.arrowLine} />
          <div className={styles.arrowHead}>▼</div>
        </div>

        {/* Agents Grid */}
        <div className={styles.agentsSection}>
          <div className={styles.agentsLabel}>AGENT SYSTEM (The Real Work)</div>
          <div className={styles.agentsGrid}>
            {agents.map((agent) => (
              <motion.div
                key={agent.id}
                className={`${styles.agentCard} ${selectedAgent === agent.id ? styles.agentCardSelected : ''}`}
                style={{ '--agent-color': agent.color } as React.CSSProperties}
                onClick={() => setSelectedAgent(selectedAgent === agent.id ? null : agent.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className={styles.agentIcon}>{AgentPageIcons[agent.iconKey]}</div>
                <div className={styles.agentName}>{agent.name}</div>
                <div className={styles.agentRole}>{agent.role}</div>
                <div className={styles.agentSpeed}>{agent.speed}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Agent Detail Panel */}
      <AnimatePresence>
        {selectedAgentData && (
          <motion.section
            className={styles.detailPanel}
            style={{ '--agent-color': selectedAgentData.color } as React.CSSProperties}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <div className={styles.detailHeader}>
              <span className={styles.detailIcon}>{AgentPageIcons[selectedAgentData.iconKey]}</span>
              <div>
                <h2>{selectedAgentData.name} AGENT</h2>
                <p>{selectedAgentData.role}</p>
              </div>
              <button className={styles.closeBtn} onClick={() => setSelectedAgent(null)}>×</button>
            </div>

            <div className={styles.detailMeta}>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Model</span>
                <span className={styles.metaValue}>{selectedAgentData.model}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Temperature</span>
                <span className={styles.metaValue}>{selectedAgentData.temperature}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Max Goals</span>
                <span className={styles.metaValue}>{selectedAgentData.maxGoals}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Speed</span>
                <span className={styles.metaValue}>{selectedAgentData.speed}</span>
              </div>
            </div>

            {/* Process Flow */}
            <div className={styles.processFlow}>
              <div className={styles.processColumn}>
                <h4>TRIGGERS</h4>
                {selectedAgentData.triggers.map((t, i) => (
                  <div key={i} className={styles.processItem}>{t}</div>
                ))}
              </div>
              <div className={styles.processArrow}>→</div>
              <div className={styles.processColumn}>
                <h4>INPUTS</h4>
                {selectedAgentData.inputs.map((t, i) => (
                  <div key={i} className={styles.processItem}>{t}</div>
                ))}
              </div>
              <div className={styles.processArrow}>→</div>
              <div className={styles.processColumn + ' ' + styles.processColumnWide}>
                <h4>PROCESSING</h4>
                {selectedAgentData.processing.map((t, i) => (
                  <div key={i} className={styles.processStep}>
                    <span className={styles.stepNumber}>{i + 1}</span>
                    <span>{t}</span>
                  </div>
                ))}
              </div>
              <div className={styles.processArrow}>→</div>
              <div className={styles.processColumn}>
                <h4>OUTPUTS</h4>
                {selectedAgentData.outputs.map((t, i) => (
                  <div key={i} className={styles.processItem} data-output="true">{t}</div>
                ))}
              </div>
            </div>

            {/* Capabilities */}
            <div className={styles.capabilities}>
              <h4>CAPABILITIES</h4>
              <div className={styles.capsList}>
                {selectedAgentData.capabilities.map((cap, i) => (
                  <span key={i} className={styles.capBadge}>{cap}</span>
                ))}
              </div>
            </div>

            {/* View Implementation Button */}
            {selectedAgentData.id === 'scout' && (
              <button
                className={styles.viewImplBtn}
                onClick={() => router.push('/agents/scout')}
              >
                <span>🔍</span>
                <span>View Scout Implementation</span>
                <span>→</span>
              </button>
            )}
            {selectedAgentData.id === 'analyst' && (
              <button
                className={styles.viewImplBtn}
                onClick={() => router.push('/agents/analyst')}
              >
                <span>📊</span>
                <span>View Analyst Implementation</span>
                <span>→</span>
              </button>
            )}
            {selectedAgentData.id === 'trader' && (
              <button
                className={styles.viewImplBtn}
                onClick={() => router.push('/agents/trader')}
              >
                <span>💼</span>
                <span>View Trader Implementation</span>
                <span>→</span>
              </button>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      {/* Cognitive Loop Visualization */}
      <section className={styles.cognitiveSection}>
        <div className={styles.cognitiveHeader}>
          <h2>Orchestrator Cognitive Loop</h2>
          <p>Runs every 30 seconds - Proactively creates goals from signals</p>
          <button
            className={styles.playPauseBtn}
            onClick={() => setIsAnimating(!isAnimating)}
          >
            {isAnimating ? '⏸ Pause' : '▶ Play'}
          </button>
        </div>

        <div className={styles.cognitiveLoop}>
          {cognitiveLoopPhases.map((phase, i) => (
            <div
              key={phase.id}
              className={`${styles.loopPhase} ${activePhase === i ? styles.loopPhaseActive : ''}`}
            >
              <div className={styles.phaseIcon}>{AgentPageIcons[phase.iconKey]}</div>
              <div className={styles.phaseName}>{phase.name}</div>
              <div className={styles.phaseDesc}>{phase.desc}</div>
              {i < cognitiveLoopPhases.length - 1 && (
                <div className={styles.phaseConnector}>
                  <div className={styles.connectorLine} />
                  <div className={styles.connectorArrow}>→</div>
                </div>
              )}
            </div>
          ))}
          {/* Loop back arrow */}
          <div className={styles.loopBack}>
            <span>↩ Loop</span>
          </div>
        </div>
      </section>

      {/* Message Flow */}
      <section className={styles.flowSection}>
        <h2>Message Flow</h2>
        <div className={styles.flowDiagram}>
          <div className={styles.flowStep}>
            <div className={styles.flowStepIcon}>📱</div>
            <div className={styles.flowStepLabel}>User sends message</div>
            <div className={styles.flowStepDetail}>via any channel</div>
          </div>
          <div className={styles.flowConnector}>→</div>
          <div className={styles.flowStep}>
            <div className={styles.flowStepIcon}>◈</div>
            <div className={styles.flowStepLabel}>Gateway receives</div>
            <div className={styles.flowStepDetail}>sessions + routing</div>
          </div>
          <div className={styles.flowConnector}>→</div>
          <div className={styles.flowStep}>
            <div className={styles.flowStepIcon}>🎯</div>
            <div className={styles.flowStepLabel}>Semantic Router</div>
            <div className={styles.flowStepDetail}>intent detection</div>
          </div>
          <div className={styles.flowConnector}>→</div>
          <div className={styles.flowStep}>
            <div className={styles.flowStepIcon}>🤖</div>
            <div className={styles.flowStepLabel}>Agent executes</div>
            <div className={styles.flowStepDetail}>Scout/Analyst/Trader</div>
          </div>
          <div className={styles.flowConnector}>→</div>
          <div className={styles.flowStep}>
            <div className={styles.flowStepIcon}>✨</div>
            <div className={styles.flowStepLabel}>Response</div>
            <div className={styles.flowStepDetail}>back to user</div>
          </div>
        </div>
      </section>

      {/* Key Insight */}
      <section className={styles.insightSection}>
        <div className={styles.insightBox}>
          <div className={styles.insightIcon}>💡</div>
          <div className={styles.insightContent}>
            <h3>The Key Insight</h3>
            <p><strong>The Terminal is just a channel.</strong> It's an interface.</p>
            <p><strong>The Agents are the product.</strong> They do the actual work.</p>
            <p>Build features in agents, not in channels. Channels are interchangeable.</p>
          </div>
        </div>
      </section>

    </div>
  );
}
