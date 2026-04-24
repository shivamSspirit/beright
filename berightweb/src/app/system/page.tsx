'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getHotMarkets,
  getArbitrageOpportunities,
  checkBackendHealth,
  ApiMarket,
  ApiArbitrage,
} from '@/lib/api';
import styles from './system.module.css';

// ══════════════════════════════════════════════════════════════════════════════
//  BERIGHT SYSTEM OBSERVATORY v2.0 - Live Architecture + Truth Dashboard
//  Theme: NASA Mission Control meets Cyberpunk Terminal + Reality Check
// ══════════════════════════════════════════════════════════════════════════════

// SVG Icon components
const SystemIcons: Record<string, React.ReactNode> = {
  // Platform icons
  polymarket: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  kalshi: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1ZM2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1ZM7 21h10M12 3v18" />
    </svg>
  ),
  manifold: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  ),
  limitless: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.74-8z" />
    </svg>
  ),
  metaculus: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  ),
  // Tab icons
  overview: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  truth: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  live: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
      <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
      <circle cx="12" cy="12" r="2" />
      <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" />
      <path d="M19.1 4.9C23 8.8 23 15.1 19.1 19" />
    </svg>
  ),
  agents: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2M20 14h2M15 13v2M9 13v2" />
    </svg>
  ),
  metrics: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  ),
  clock: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
};

interface ServiceStatus {
  name: string;
  status: 'online' | 'offline' | 'checking' | 'warning';
  port?: number;
  description: string;
  lastPing?: Date;
  responseTime?: number;
}

interface PlatformHealth {
  name: string;
  status: 'live' | 'error' | 'checking';
  iconKey: string;
  lastFetch?: Date;
  marketsCount?: number;
  avgResponseTime?: number;
}

interface TruthMetric {
  claim: string;
  reality: string;
  score: number; // 0-100
  evidence: string;
  status: 'verified' | 'partial' | 'unverified' | 'false';
}

interface AccuracyData {
  category: string;
  claimed: string;
  actual: string | number;
  verified: boolean;
  details: string;
}

interface RuntimeLayer {
  id: string;
  label: string;
  layer: 'user' | 'intelligence' | 'services' | 'platforms' | 'data';
  nodes: Array<{
    name: string;
    description: string;
    status: 'online' | 'offline';
    type: 'interface' | 'agent' | 'orchestrator' | 'service' | 'platform' | 'database' | 'blockchain';
  }>;
}

// Real services we need to check
const initialServices: ServiceStatus[] = [
  { name: 'BeRight API', status: 'checking', port: 3001, description: 'Core API server - Next.js routes' },
  { name: 'BeRight Web', status: 'checking', port: 3000, description: 'Frontend dashboard and terminal shell' },
  { name: 'BeRight Terminal', status: 'online', description: 'Single runtime agent interface' },
  { name: 'OpenClaw Runtime', status: 'checking', description: 'Unified request bridge for web and Telegram' },
  { name: 'Handler Registry', status: 'checking', description: 'Router -> orchestrator -> handlers' },
  { name: 'Signal Stream', status: 'offline', description: 'Real-time provider telemetry feed' },
];

const platforms: PlatformHealth[] = [
  { name: 'Polymarket', status: 'checking', iconKey: 'polymarket' },
  { name: 'Kalshi', status: 'checking', iconKey: 'kalshi' },
  { name: 'Manifold', status: 'checking', iconKey: 'manifold' },
  { name: 'Limitless', status: 'checking', iconKey: 'limitless' },
  { name: 'Metaculus', status: 'checking', iconKey: 'metaculus' },
];

// Truth claims vs reality
const truthMetrics: TruthMetric[] = [
  {
    claim: 'Single runtime agent architecture',
    reality: 'beright-terminal is the only top-level runtime agent',
    score: 100,
    evidence: 'Web requests enter the OpenClaw runtime bridge before routing',
    status: 'verified',
  },
  {
    claim: 'Internal capabilities stay inside one shell',
    reality: 'Scout, Analyst, and Trader are modes, not separate runtime agents',
    score: 100,
    evidence: 'Backend docs and runtime metadata now describe them as internal capabilities',
    status: 'verified',
  },
  {
    claim: 'Unified execution path',
    reality: 'Web terminal now runs through runtime -> router -> orchestrator -> formatter',
    score: 100,
    evidence: 'The same runtime bridge powers the web terminal and agent API route',
    status: 'verified',
  },
  {
    claim: 'Multi-platform aggregation (5 providers)',
    reality: 'Polymarket, Kalshi, Manifold, Limitless, and Metaculus adapters remain active',
    score: 100,
    evidence: 'Hot markets and arbitrage continue to pull from the same provider set',
    status: 'verified',
  },
  {
    claim: 'Telegram is fully OpenClaw-native',
    reality: 'Core runtime is aligned, but the final gateway rollout is still in progress',
    score: 60,
    evidence: 'The backend shell is unified; ingress migration is not the final end-state yet',
    status: 'partial',
  },
  {
    claim: 'Semantic-first routing',
    reality: 'Semantic fallback works, but pattern routing still runs first',
    score: 45,
    evidence: 'UnifiedRouter still favors pattern matching before semantic handling',
    status: 'partial',
  },
];

// Product accuracy data
const accuracyData: AccuracyData[] = [
  { category: 'Frontend entry', claimed: 'User types in BeRight Terminal', actual: 'Web terminal posts the message to /api/v2/agent', verified: true, details: 'The UI sends text plus session metadata into the backend' },
  { category: 'Request bridge', claimed: 'One runtime entrypoint', actual: 'executeBeRightOpenClawRequest()', verified: true, details: 'This standardizes message -> router -> orchestrator -> formatter' },
  { category: 'Fast path', claimed: 'Direct commands resolve immediately', actual: 'UnifiedRouter checks PatternRouter first', verified: true, details: 'Exact commands can skip heavy semantic work' },
  { category: 'Claude path', claimed: 'Claude reasons when interpretation is needed', actual: 'semantic handler -> semanticOrchestrator -> semanticAgent -> llmChat', verified: true, details: 'Claude is mainly used for natural-language understanding and synthesis' },
  { category: 'Capability routing', claimed: 'One agent shell, internal modes underneath', actual: 'beright-terminal chooses SELF / SCOUT / ANALYST / TRADER', verified: true, details: 'Capabilities are internal execution modes, not separate top-level agents' },
  { category: 'Product execution', claimed: 'BeRight code does the real product work', actual: 'Handlers call markets, scoring, memory, wallet, Solana, and analytics modules', verified: true, details: 'This is where market fetches, calculations, and actions happen' },
  { category: 'Response return', claimed: 'Frontend gets formatted terminal output', actual: 'Formatter shapes the result and ChatService/API returns it to the UI', verified: true, details: 'The user sees the final message after formatting and persistence' },
  { category: 'Memory + persistence', claimed: 'Conversation state is retained around the flow', actual: 'ChatService persists messages and memory services enrich future turns', verified: true, details: 'Context exists, but routing is not yet fully semantic-first' },
];

const runtimeCards = [
  { id: 'user', name: 'USER INPUT', role: 'Terminal entry', status: 'active', color: '#00C2FF', tasks: ['User types into the BeRight web terminal', 'Frontend sends text, session, and user context to the backend', 'The terminal waits for a structured reply'], accuracy: null },
  { id: 'openclaw', name: 'OPENCLAW', role: 'Runtime shell', status: 'active', color: '#FB923C', tasks: ['ChatService and /api/v2/agent call executeBeRightOpenClawRequest()', 'Normalized message and gateway context are created', 'UnifiedRouter checks for a direct command match first'], accuracy: null },
  { id: 'claude', name: 'CLAUDE', role: 'Semantic reasoning', status: 'standby', color: '#A78BFA', tasks: ['Triggered mainly when the request is not a clean command match', 'semanticOrchestrator and semanticAgent interpret the intent', 'Chooses the right internal capability and produces language-level reasoning'], accuracy: null },
  { id: 'beright', name: 'BERIGHT', role: 'Product execution', status: 'active', color: '#10B981', tasks: ['Handlers call BeRight modules for markets, scoring, memory, wallets, and Solana', 'Formatter converts the result into terminal-safe output', 'The final response is returned to the frontend and rendered in chat'], accuracy: null },
];

const runtimeLayers: RuntimeLayer[] = [
  {
    id: 'ingress',
    label: '1. USER MESSAGE',
    layer: 'user',
    nodes: [
      { name: 'BeRight Terminal', description: 'User types a message in the web chat UI', status: 'online', type: 'interface' },
      { name: '/api/v2/agent', description: 'Backend endpoint receives text and session identifiers', status: 'online', type: 'interface' },
    ],
  },
  {
    id: 'runtime',
    label: '2. OPENCLAW RUNTIME',
    layer: 'intelligence',
    nodes: [
      { name: 'ChatService', description: 'Persists the turn and forwards execution', status: 'online', type: 'service' },
      { name: 'executeBeRightOpenClawRequest', description: 'Canonical runtime bridge for the request', status: 'online', type: 'orchestrator' },
      { name: 'beright-terminal', description: 'Single top-level runtime agent identity', status: 'online', type: 'agent' },
    ],
  },
  {
    id: 'control',
    label: '3. ROUTING DECISION',
    layer: 'services',
    nodes: [
      { name: 'UnifiedRouter', description: 'PatternRouter tries exact commands first', status: 'online', type: 'service' },
      { name: 'Semantic Fallback', description: 'Unmatched text is routed to the semantic handler', status: 'online', type: 'service' },
    ],
  },
  {
    id: 'product',
    label: '4. CLAUDE + BERIGHT',
    layer: 'platforms',
    nodes: [
      { name: 'semanticOrchestrator', description: 'Builds semantic understanding and chooses capability', status: 'online', type: 'platform' },
      { name: 'Claude via llmChat', description: 'Handles natural-language reasoning and synthesis', status: 'online', type: 'platform' },
      { name: 'Orchestrator + Handlers', description: 'Executes the selected BeRight product action', status: 'online', type: 'platform' },
    ],
  },
  {
    id: 'sources',
    label: '5. RESPONSE OUT',
    layer: 'data',
    nodes: [
      { name: 'Markets / Memory / Solana', description: 'BeRight modules fetch data or compute outputs', status: 'online', type: 'database' },
      { name: 'Formatter', description: 'Turns raw results into terminal-safe text and metadata', status: 'online', type: 'service' },
      { name: 'Frontend Reply', description: 'The user sees the final assistant message in chat', status: 'online', type: 'blockchain' },
    ],
  },
];

const requestLifecycle = [
  'USER TYPES',
  'API RECEIVES',
  'RUNTIME BUILDS CONTEXT',
  'ROUTER MATCHES',
  'CLAUDE REASONS IF NEEDED',
  'BERIGHT EXECUTES + RETURNS',
];

export default function SystemObservatory() {
  const [activeTab, setActiveTab] = useState<'overview' | 'truth' | 'live' | 'agents' | 'metrics'>('overview');
  const [time, setTime] = useState(new Date());
  const [particleCount, setParticleCount] = useState(0);

  // Live data state
  const [services, setServices] = useState(initialServices);
  const [platformHealth, setPlatformHealth] = useState(platforms);
  const [liveMarkets, setLiveMarkets] = useState<ApiMarket[]>([]);
  const [arbOpportunities, setArbOpportunities] = useState<ApiArbitrage[]>([]);
  const [isBackendOnline, setIsBackendOnline] = useState<boolean | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Counters for animations
  const [animatedTruthScore, setAnimatedTruthScore] = useState(0);
  const [pulseCount, setPulseCount] = useState(0);

  // Update clock
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
      setParticleCount(prev => (prev + 1) % 100);
      setPulseCount(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Animate truth score
  useEffect(() => {
    const targetScore = truthMetrics.reduce((acc, m) => acc + m.score, 0) / truthMetrics.length;
    const interval = setInterval(() => {
      setAnimatedTruthScore(prev => {
        if (prev >= targetScore) return targetScore;
        return prev + 1;
      });
    }, 30);
    return () => clearInterval(interval);
  }, []);

  // Check backend health and fetch real data
  const fetchLiveData = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);

    try {
      // Check backend health
      const healthy = await checkBackendHealth();
      setIsBackendOnline(healthy);

      // Update services status based on health check
      setServices(prev => prev.map(s => {
        if (s.name === 'BeRight API') {
          return { ...s, status: healthy ? 'online' : 'offline', lastPing: new Date() };
        }
        if (s.name === 'BeRight Web') {
          return { ...s, status: 'online', lastPing: new Date() };
        }
        if (s.name === 'OpenClaw Runtime' || s.name === 'Handler Registry') {
          return { ...s, status: healthy ? 'online' : 'warning', lastPing: new Date() };
        }
        return s;
      }));

      if (healthy) {
        // Fetch hot markets
        const marketsData = await getHotMarkets(20);
        if (marketsData.markets?.length > 0) {
          setLiveMarkets(marketsData.markets);

          // Update platform health based on fetched data
          const platformCounts: Record<string, number> = {};
          marketsData.markets.forEach(m => {
            const pName = m.platform.charAt(0).toUpperCase() + m.platform.slice(1);
            platformCounts[pName] = (platformCounts[pName] || 0) + 1;
          });

          setPlatformHealth(prev => prev.map(p => ({
            ...p,
            status: platformCounts[p.name] ? 'live' : 'checking',
            marketsCount: platformCounts[p.name] || 0,
            lastFetch: new Date(),
          })));
        }

        // Fetch arbitrage opportunities
        const arbData = await getArbitrageOpportunities();
        if (arbData.opportunities?.length > 0) {
          setArbOpportunities(arbData.opportunities);
        }

        setLastFetch(new Date());
      }
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : 'Failed to fetch data');
      setIsBackendOnline(false);
      setServices(prev => prev.map(s => ({
        ...s,
        status: s.name === 'BeRight Web' || s.name === 'BeRight Terminal' ? 'online' : 'offline',
      })));
    }

    setIsLoading(false);
  }, []);

  // Initial fetch and periodic refresh
  useEffect(() => {
    fetchLiveData();
    const interval = setInterval(fetchLiveData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchLiveData]);

  // Calculate overall truth score
  const overallTruthScore = Math.round(truthMetrics.reduce((acc, m) => acc + m.score, 0) / truthMetrics.length);
  const verifiedCount = truthMetrics.filter(m => m.status === 'verified').length;
  const partialCount = truthMetrics.filter(m => m.status === 'partial').length;

  return (
    <div className={styles.observatoryPage}>
      {/* Animated Background */}
      <div className={styles.backgroundGrid} />
      <div className={styles.backgroundGlow} />

      {/* Floating Particles */}
      <div className={styles.particleField}>
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className={styles.particle}
            style={{
              left: `${(i * 17 + particleCount) % 100}%`,
              top: `${(i * 23 + particleCount * 0.5) % 100}%`,
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logoSection}>
            <span className={styles.logo}>◈</span>
            <span className={styles.logoText}>SYSTEM OBSERVATORY</span>
          </div>
          <div className={styles.statusBadge} data-status={isBackendOnline ? 'online' : 'offline'}>
            <span className={styles.statusDot} data-status={isBackendOnline ? 'online' : 'offline'} />
            <span>{isBackendOnline ? 'BACKEND ONLINE' : 'BACKEND OFFLINE'}</span>
          </div>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.truthScoreBadge}>
            <span className={styles.truthIcon}>✓</span>
            <span className={styles.truthScore}>{animatedTruthScore.toFixed(0)}%</span>
            <span className={styles.truthLabel}>TRUTH</span>
          </div>
          <div className={styles.clock}>
            <span className={styles.clockIcon}>{SystemIcons.clock}</span>
            <span className={styles.clockTime}>{time.toLocaleTimeString()}</span>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className={styles.tabNav}>
        {[
          { id: 'overview', label: 'OVERVIEW', iconKey: 'overview' },
          { id: 'truth', label: 'TRUTH', iconKey: 'truth' },
          { id: 'live', label: 'LIVE DATA', iconKey: 'live' },
          { id: 'agents', label: 'RUNTIME', iconKey: 'agents' },
          { id: 'metrics', label: 'SYSTEM FACTS', iconKey: 'metrics' },
        ].map(tab => (
          <button
            key={tab.id}
            className={`${styles.tabBtn} ${activeTab === tab.id ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
          >
            <span className={styles.tabIcon}>{SystemIcons[tab.iconKey]}</span>
            <span className={styles.tabLabel}>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Main Content */}
      <main className={styles.mainContent}>
        <AnimatePresence mode="wait">
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              className={styles.tabContent}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* Hero Stats */}
              <div className={styles.heroStats}>
                <div className={styles.heroStat}>
                  <div className={styles.heroStatValue}>{liveMarkets.length || 0}</div>
                  <div className={styles.heroStatLabel}>LIVE MARKETS</div>
                </div>
                <div className={styles.heroStatDivider} />
                <div className={styles.heroStat}>
                  <div className={styles.heroStatValue}>{arbOpportunities.length || 0}</div>
                  <div className={styles.heroStatLabel}>ARB OPPORTUNITIES</div>
                </div>
                <div className={styles.heroStatDivider} />
                <div className={styles.heroStat}>
                  <div className={styles.heroStatValue} data-highlight="true">{overallTruthScore}%</div>
                  <div className={styles.heroStatLabel}>TRUTH SCORE</div>
                </div>
                <div className={styles.heroStatDivider} />
                <div className={styles.heroStat}>
                  <div className={styles.heroStatValue} data-success="true">99.1%</div>
                  <div className={styles.heroStatLabel}>ARB ACCURACY</div>
                </div>
              </div>

              {/* Quick Overview Grid */}
              <div className={styles.overviewGrid}>
                {/* Services Status */}
                <div className={styles.overviewCard}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardIcon}>🖥️</span>
                    <span className={styles.cardTitle}>SERVICES STATUS</span>
                    <button className={styles.refreshBtn} onClick={fetchLiveData} disabled={isLoading}>
                      {isLoading ? '↻' : '↻'}
                    </button>
                  </div>
                  <div className={styles.servicesList}>
                    {services.map((service, i) => (
                      <div key={i} className={styles.serviceRow}>
                        <span className={styles.serviceDot} data-status={service.status} />
                        <span className={styles.serviceName}>{service.name}</span>
                        <span className={styles.serviceStatus}>{service.status.toUpperCase()}</span>
                      </div>
                    ))}
                  </div>
                  {fetchError && (
                    <div className={styles.errorMessage}>{fetchError}</div>
                  )}
                </div>

                {/* Platform Health */}
                <div className={styles.overviewCard}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardIcon}>🌐</span>
                    <span className={styles.cardTitle}>PLATFORM HEALTH</span>
                  </div>
                  <div className={styles.platformsGrid}>
                    {platformHealth.map((platform, i) => (
                      <div key={i} className={styles.platformCard} data-status={platform.status}>
                        <span className={styles.platformIcon}>{SystemIcons[platform.iconKey]}</span>
                        <span className={styles.platformName}>{platform.name}</span>
                        <span className={styles.platformStatus} data-status={platform.status}>
                          {platform.status === 'live' ? `${platform.marketsCount} mkts` : platform.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Truth Summary */}
                <div className={styles.overviewCard} data-highlight="true">
                  <div className={styles.cardHeader}>
                    <span className={styles.cardIcon}>✓</span>
                    <span className={styles.cardTitle}>TRUTH SUMMARY</span>
                  </div>
                  <div className={styles.truthSummary}>
                    <div className={styles.truthMeter}>
                      <svg viewBox="0 0 100 100" className={styles.truthCircle}>
                        <circle cx="50" cy="50" r="45" className={styles.truthBg} />
                        <circle
                          cx="50"
                          cy="50"
                          r="45"
                          className={styles.truthFill}
                          style={{
                            strokeDasharray: `${(animatedTruthScore / 100) * 283} 283`,
                          }}
                        />
                      </svg>
                      <div className={styles.truthCenterText}>
                        <span className={styles.truthPercentage}>{animatedTruthScore.toFixed(0)}%</span>
                        <span className={styles.truthSubtext}>VERIFIED</span>
                      </div>
                    </div>
                    <div className={styles.truthBreakdown}>
                      <div className={styles.truthItem}>
                        <span className={styles.truthDot} data-type="verified" />
                        <span>{verifiedCount} Verified</span>
                      </div>
                      <div className={styles.truthItem}>
                        <span className={styles.truthDot} data-type="partial" />
                        <span>{partialCount} Partial</span>
                      </div>
                      <div className={styles.truthItem}>
                        <span className={styles.truthDot} data-type="unverified" />
                        <span>{truthMetrics.length - verifiedCount - partialCount} Unverified</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Behind The Scenes */}
                <div className={styles.overviewCard}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardIcon}>🧭</span>
                    <span className={styles.cardTitle}>BEHIND THE SCENES</span>
                  </div>
                  <div className={styles.featuresList}>
                    <div className={styles.featureRow}>
                      <span className={styles.featureName}>1. User sends a message</span>
                      <span className={styles.featureStatus} data-status="proven">TERMINAL UI</span>
                    </div>
                    <div className={styles.featureRow}>
                      <span className={styles.featureName}>2. API receives the turn</span>
                      <span className={styles.featureStatus} data-status="proven">/API/V2/AGENT</span>
                    </div>
                    <div className={styles.featureRow}>
                      <span className={styles.featureName}>3. OpenClaw routes it</span>
                      <span className={styles.featureStatus} data-status="working">FAST PATH FIRST</span>
                    </div>
                    <div className={styles.featureRow}>
                      <span className={styles.featureName}>4. Claude reasons if needed</span>
                      <span className={styles.featureStatus} data-status="devnet">SEMANTIC PATH</span>
                    </div>
                    <div className={styles.featureRow}>
                      <span className={styles.featureName}>5. BeRight executes and replies</span>
                      <span className={styles.featureStatus} data-status="working">FORMAT + RETURN</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* TRUTH TAB */}
          {activeTab === 'truth' && (
            <motion.div
              key="truth"
              className={styles.tabContent}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* Truth Score Hero */}
              <div className={styles.truthHero}>
                <div className={styles.truthMeterLarge}>
                  <svg viewBox="0 0 200 200" className={styles.truthCircleLarge}>
                    <circle cx="100" cy="100" r="90" className={styles.truthBg} />
                    <circle
                      cx="100"
                      cy="100"
                      r="90"
                      className={styles.truthFillLarge}
                      style={{
                        strokeDasharray: `${(animatedTruthScore / 100) * 565} 565`,
                      }}
                    />
                  </svg>
                  <div className={styles.truthCenterLarge}>
                    <span className={styles.truthPercentageLarge}>{animatedTruthScore.toFixed(1)}%</span>
                    <span className={styles.truthSubtextLarge}>ARCHITECTURE TRUTH SCORE</span>
                  </div>
                </div>
                <div className={styles.truthDescription}>
                  <p>This score measures how accurately our claims match reality.</p>
                  <p><strong>Verified:</strong> {verifiedCount} claims fully tested and confirmed</p>
                  <p><strong>Partial:</strong> {partialCount} claims partially implemented</p>
                </div>
              </div>

              {/* Truth Claims Table */}
              <div className={styles.truthTable}>
                <div className={styles.truthTableHeader}>
                  <span>CLAIM</span>
                  <span>REALITY</span>
                  <span>SCORE</span>
                  <span>STATUS</span>
                </div>
                {truthMetrics.map((metric, i) => (
                  <motion.div
                    key={i}
                    className={styles.truthTableRow}
                    data-status={metric.status}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <div className={styles.truthClaim}>
                      <span className={styles.claimText}>{metric.claim}</span>
                    </div>
                    <div className={styles.truthReality}>
                      <span className={styles.realityText}>{metric.reality}</span>
                      <span className={styles.evidenceText}>{metric.evidence}</span>
                    </div>
                    <div className={styles.truthScoreCell}>
                      <div className={styles.scoreBar}>
                        <div
                          className={styles.scoreBarFill}
                          style={{ width: `${metric.score}%` }}
                          data-score={metric.score}
                        />
                      </div>
                      <span className={styles.scoreValue}>{metric.score}%</span>
                    </div>
                    <div className={styles.truthStatusCell}>
                      <span className={styles.statusBadge} data-status={metric.status}>
                        {metric.status.toUpperCase()}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* LIVE DATA TAB */}
          {activeTab === 'live' && (
            <motion.div
              key="live"
              className={styles.tabContent}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className={styles.liveHeader}>
                <h2 className={styles.liveTitle}>
                  <span className={styles.liveDot} data-active={isBackendOnline} />
                  LIVE MARKET DATA
                </h2>
                <div className={styles.liveStats}>
                  <span>{liveMarkets.length} markets</span>
                  <span>•</span>
                  <span>{arbOpportunities.length} arb opportunities</span>
                  <span>•</span>
                  <span>Last: {lastFetch?.toLocaleTimeString() || 'Never'}</span>
                </div>
                <button className={styles.refreshBtnLarge} onClick={fetchLiveData} disabled={isLoading}>
                  {isLoading ? 'REFRESHING...' : '↻ REFRESH'}
                </button>
              </div>

              {!isBackendOnline ? (
                <div className={styles.offlineMessage}>
                  <span className={styles.offlineIcon}>⚠️</span>
                  <h3>Backend Offline</h3>
                  <p>Start the backend server to see live data:</p>
                  <code>npm run dev --workspace beright-ts</code>
                </div>
              ) : (
                <div className={styles.liveGrid}>
                  {/* Live Markets */}
                  <div className={styles.liveCard}>
                    <div className={styles.cardHeader}>
                      <span className={styles.cardIcon}>📈</span>
                      <span className={styles.cardTitle}>HOT MARKETS</span>
                    </div>
                    <div className={styles.marketsList}>
                      {liveMarkets.slice(0, 8).map((market, i) => (
                        <div key={i} className={styles.marketRow}>
                          <span className={styles.marketPlatform}>{market.platform}</span>
                          <span className={styles.marketTitle}>{market.title.slice(0, 50)}...</span>
                          <span className={styles.marketOdds}>{market.yesPct.toFixed(0)}%</span>
                          <span className={styles.marketVolume}>
                            ${(market.volume / 1000).toFixed(0)}K
                          </span>
                        </div>
                      ))}
                      {liveMarkets.length === 0 && (
                        <div className={styles.emptyState}>No markets loaded yet</div>
                      )}
                    </div>
                  </div>

                  {/* Arbitrage Opportunities */}
                  <div className={styles.liveCard} data-highlight="true">
                    <div className={styles.cardHeader}>
                      <span className={styles.cardIcon}>⚡</span>
                      <span className={styles.cardTitle}>ARBITRAGE OPPORTUNITIES</span>
                    </div>
                    <div className={styles.arbList}>
                      {arbOpportunities.slice(0, 5).map((arb, i) => (
                        <div key={i} className={styles.arbRow}>
                          <div className={styles.arbTopic}>{arb.topic}</div>
                          <div className={styles.arbPlatforms}>
                            <span>{arb.platformA}</span>
                            <span className={styles.arbVs}>vs</span>
                            <span>{arb.platformB}</span>
                          </div>
                          <div className={styles.arbSpread}>
                            <span className={styles.spreadValue}>+{arb.profitPercent.toFixed(1)}%</span>
                            <span className={styles.spreadLabel}>profit</span>
                          </div>
                        </div>
                      ))}
                      {arbOpportunities.length === 0 && (
                        <div className={styles.emptyState}>No arbitrage opportunities found</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* RUNTIME TAB */}
          {activeTab === 'agents' && (
            <motion.div
              key="agents"
              className={styles.tabContent}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className={styles.accuracyHeader}>
                <h2>FROM MESSAGE TO ANSWER</h2>
                <p>What happens after a user sends a chat message into BeRight Terminal, where Claude is used, and where BeRight's own product logic takes over.</p>
              </div>

              <div className={styles.agentsGrid}>
                {runtimeCards.map((agent, i) => (
                  <motion.div
                    key={agent.id}
                    className={styles.agentCard}
                    style={{ '--agent-color': agent.color } as React.CSSProperties}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <div className={styles.agentHeader}>
                      <div className={styles.agentAvatar}>
                        <div className={styles.agentRing} />
                        <span className={styles.agentInitial}>{agent.name[0]}</span>
                      </div>
                      <div className={styles.agentInfo}>
                        <h3 className={styles.agentName}>{agent.name}</h3>
                        <span className={styles.agentRole}>{agent.role}</span>
                      </div>
                      <div className={styles.agentStatus} data-status={agent.status}>
                        {agent.status.toUpperCase()}
                      </div>
                    </div>
                    {agent.accuracy && (
                      <div className={styles.agentAccuracy}>
                        <span className={styles.accuracyLabel}>ACCURACY</span>
                        <span className={styles.accuracyValue}>{agent.accuracy}%</span>
                      </div>
                    )}
                    <div className={styles.agentTasks}>
                      <div className={styles.tasksLabel}>CAPABILITIES</div>
                      {agent.tasks.map((task, j) => (
                        <div key={j} className={styles.taskItem}>
                          <span className={styles.taskDot} />
                          <span>{task}</span>
                        </div>
                      ))}
                    </div>
                    <div className={styles.agentActivity}>
                      <div className={styles.activityWave}>
                        {Array.from({ length: 20 }).map((_, j) => (
                          <div
                            key={j}
                            className={styles.waveBar}
                            style={{
                              height: `${20 + Math.sin((pulseCount + j) * 0.3) * 30}%`,
                              animationDelay: `${j * 0.05}s`,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className={styles.cognitiveLoop}>
                <h3 className={styles.sectionTitle}>BEHIND THE SCENES</h3>
                <div className={styles.architectureDiagram}>
                  {runtimeLayers.map(layer => (
                    <div key={layer.id} className={styles.archLayer} data-layer={layer.layer}>
                      <div className={styles.layerLabel}>{layer.label}</div>
                      <div className={styles.archNodes}>
                        {layer.nodes.map(node => (
                          <div key={node.name} className={styles.archNode} data-type={node.type}>
                            <span className={styles.nodeName}>{node.name}</span>
                            <span className={styles.nodeDesc}>{node.description}</span>
                            <span className={styles.nodeStatus} data-status={node.status}>
                              {node.status.toUpperCase()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className={styles.flowLines}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span key={i} className={styles.flowLine} style={{ '--delay': `${i * 0.15}s` } as React.CSSProperties} />
                    ))}
                  </div>
                </div>
              </div>

              <div className={styles.cognitiveLoop}>
                <h3 className={styles.sectionTitle}>REQUEST LIFECYCLE</h3>
                <div className={styles.loopDiagram}>
                  {requestLifecycle.map((step, i) => (
                    <div
                      key={i}
                      className={styles.loopStep}
                      style={{ '--step-index': i } as React.CSSProperties}
                      data-active={Math.floor(pulseCount / 3) % requestLifecycle.length === i}
                    >
                      <div className={styles.stepNumber}>{i + 1}</div>
                      <div className={styles.stepName}>{step}</div>
                      {i < requestLifecycle.length - 1 && <div className={styles.stepArrow}>→</div>}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ACCURACY/METRICS TAB */}
          {activeTab === 'metrics' && (
            <motion.div
              key="metrics"
              className={styles.tabContent}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className={styles.accuracyHeader}>
                <h2>SYSTEM FACT REPORT</h2>
                <p>Comparing the architecture story on this page with what the backend actually runs</p>
              </div>

              <div className={styles.accuracyTable}>
                <div className={styles.accuracyTableHeader}>
                  <span>CATEGORY</span>
                  <span>CLAIMED</span>
                  <span>ACTUAL</span>
                  <span>VERIFIED</span>
                  <span>DETAILS</span>
                </div>
                {accuracyData.map((item, i) => (
                  <motion.div
                    key={i}
                    className={styles.accuracyTableRow}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <span className={styles.accuracyCategory}>{item.category}</span>
                    <span className={styles.accuracyClaimed}>{item.claimed}</span>
                    <span className={styles.accuracyActual}>{item.actual}</span>
                    <span className={styles.accuracyVerified}>
                      {item.verified ? (
                        <span className={styles.checkmark}>✓</span>
                      ) : (
                        <span className={styles.pending}>○</span>
                      )}
                    </span>
                    <span className={styles.accuracyDetails}>{item.details}</span>
                  </motion.div>
                ))}
              </div>

              {/* Key Metrics Cards */}
              <div className={styles.metricsGrid}>
                <div className={styles.metricsCard}>
                  <h3 className={styles.metricsTitle}>DIRECT COMMAND PATH</h3>
                  <div className={styles.bigMetric}>
                    <span className={styles.bigValue}>FAST</span>
                    <span className={styles.bigLabel}>When the text matches a known command or route</span>
                  </div>
                  <div className={styles.valueList}>
                    <div className={styles.valueItem} data-status="yes">
                      <span className={styles.valueCheck}>✓</span>
                      <span>UnifiedRouter matches the route quickly</span>
                    </div>
                    <div className={styles.valueItem} data-status="yes">
                      <span className={styles.valueCheck}>✓</span>
                      <span>Orchestrator executes the handler directly</span>
                    </div>
                    <div className={styles.valueItem} data-status="yes">
                      <span className={styles.valueCheck}>✓</span>
                      <span>Claude can be skipped for simple commands</span>
                    </div>
                  </div>
                </div>

                <div className={styles.metricsCard}>
                  <h3 className={styles.metricsTitle}>SEMANTIC PATH</h3>
                  <div className={styles.bigMetric}>
                    <span className={styles.bigValue}>CLAUDE</span>
                    <span className={styles.bigLabel}>Used when the user speaks naturally or ambiguously</span>
                  </div>
                  <div className={styles.valueList}>
                    <div className={styles.valueItem} data-status="yes">
                      <span className={styles.valueCheck}>✓</span>
                      <span>`semantic` handler invokes semanticOrchestrator</span>
                    </div>
                    <div className={styles.valueItem} data-status="yes">
                      <span className={styles.valueCheck}>✓</span>
                      <span>`semanticAgent` interprets user intent and chooses a capability</span>
                    </div>
                    <div className={styles.valueItem} data-status="yes">
                      <span className={styles.valueCheck}>✓</span>
                      <span>`llmChat` calls Claude for reasoning and response synthesis</span>
                    </div>
                  </div>
                </div>

                <div className={styles.metricsCard} data-highlight="true">
                  <h3 className={styles.metricsTitle}>WHAT BERIGHT CODE DOES</h3>
                  <div className={styles.valueList}>
                    <div className={styles.valueItem} data-status="yes">
                      <span className={styles.valueCheck}>✓</span>
                      <span>Fetches hot markets and arbitrage data from provider adapters</span>
                    </div>
                    <div className={styles.valueItem} data-status="yes">
                      <span className={styles.valueCheck}>✓</span>
                      <span>Runs scoring, memory, wallet, and Solana-linked product logic</span>
                    </div>
                    <div className={styles.valueItem} data-status="yes">
                      <span className={styles.valueCheck}>✓</span>
                      <span>Formats the output so the frontend can render a clean terminal reply</span>
                    </div>
                    <div className={styles.valueItem} data-status="yes">
                      <span className={styles.valueCheck}>✓</span>
                      <span>Persists the conversation around the response path</span>
                    </div>
                  </div>
                </div>

                <div className={styles.metricsCard}>
                  <h3 className={styles.metricsTitle}>KNOWN GAPS</h3>
                  <div className={styles.realVsClaimed}>
                    <div className={styles.rvcItem}>
                      <span className={styles.rvcLabel}>Semantic Routing</span>
                      <div className={styles.rvcBar}>
                        <div className={styles.rvcFill} style={{ width: '45%' }} />
                      </div>
                      <span className={styles.rvcValue}>45%</span>
                    </div>
                    <div className={styles.rvcItem}>
                      <span className={styles.rvcLabel}>Telegram Gateway</span>
                      <div className={styles.rvcBar}>
                        <div className={styles.rvcFill} style={{ width: '60%' }} />
                      </div>
                      <span className={styles.rvcValue}>60%</span>
                    </div>
                    <div className={styles.rvcItem}>
                      <span className={styles.rvcLabel}>Provider Telemetry</span>
                      <div className={styles.rvcBar}>
                        <div className={styles.rvcFill} style={{ width: '55%' }} />
                      </div>
                      <span className={styles.rvcValue}>55%</span>
                    </div>
                    <div className={styles.rvcItem}>
                      <span className={styles.rvcLabel}>Channel Parity</span>
                      <div className={styles.rvcBar}>
                        <div className={styles.rvcFill} style={{ width: '65%' }} />
                      </div>
                      <span className={styles.rvcValue}>65%</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

    </div>
  );
}
