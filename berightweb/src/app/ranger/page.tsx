'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface VaultState {
  status: 'starting' | 'running' | 'stopped' | 'error';
  executionMode: 'LIVE' | 'PAPER' | 'DRY_RUN';
  cycleCount: number;
  lastCycleTime: number | null;
  uptime: number;
  startedAt: number;
}

interface RateInfo {
  protocol?: string;
  apy: string;
  raw: number;
}

interface LendingRate {
  protocol: string;
  apy: string;
  tvl: string;
  utilizationRate: string | null;
}

interface Signals {
  timestamp: number;
  collectionDurationMs: number;
  rates: {
    bestLending: RateInfo;
    bestFunding: RateInfo;
    rwa: RateInfo;
    portfolio: RateInfo;
  };
  lending: LendingRate[];
  funding: {
    solPerp: { rate: string; apy: string; direction: string } | null;
    btcPerp: { rate: string; apy: string } | null;
    consecutiveNegative: number;
  };
  rwa: {
    apy: string;
    tvl: string;
    isActive: boolean;
  };
  vault: {
    nav: string;
    drawdown: string;
    positions: number;
  };
  riskFlags: {
    driftHealthCritical: boolean;
    driftHealthWarning: boolean;
    drawdownTriggered: boolean;
    fundingKillSwitch: boolean;
  };
  driftHealth: {
    healthFactor: string;
    marginUtilization: string;
  } | null;
}

interface AIDecision {
  cycleNumber: number;
  timestamp: number;
  reasoning: string;
  toolCalls: Array<{
    name: string;
    args: Record<string, unknown>;
    result: string;
  }>;
  status: 'pending' | 'executed' | 'skipped' | 'error';
  error?: string;
}

interface Alert {
  type: 'info' | 'warning' | 'error';
  message: string;
  timestamp: number;
}

interface DashboardData {
  vault: VaultState;
  signals: Signals | null;
  decisions: AIDecision[];
  alerts: Alert[];
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_RANGER_API_URL || 'http://localhost:3002';
const REFRESH_INTERVAL = 5000;

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'running': return '#00ff00';
    case 'starting': return '#ffff00';
    case 'stopped': return '#666';
    case 'error': return '#ff0055';
    default: return '#666';
  }
}

function getModeColor(mode: string): string {
  switch (mode) {
    case 'LIVE': return '#ff0055';
    case 'PAPER': return '#00fff7';
    case 'DRY_RUN': return '#666';
    default: return '#666';
  }
}

function getAlertColor(type: string): string {
  switch (type) {
    case 'info': return '#00fff7';
    case 'warning': return '#ffaa00';
    case 'error': return '#ff0055';
    default: return '#666';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className="status-badge"
      style={{
        color: getStatusColor(status),
        borderColor: getStatusColor(status),
      }}
    >
      <span className="status-dot" style={{ background: getStatusColor(status) }} />
      {status.toUpperCase()}
    </span>
  );
}

function ModeBadge({ mode }: { mode: string }) {
  return (
    <span
      className="mode-badge"
      style={{
        color: getModeColor(mode),
        borderColor: getModeColor(mode),
      }}
    >
      {mode}
    </span>
  );
}

function RiskFlag({ label, active }: { label: string; active: boolean }) {
  return (
    <div className={`risk-flag ${active ? 'active' : ''}`}>
      <span className="rf-icon">{active ? '!' : '/'}</span>
      <span className="rf-label">{label}</span>
    </div>
  );
}

function RateCard({ label, value, subtext, highlight }: {
  label: string;
  value: string;
  subtext?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rate-card ${highlight ? 'highlight' : ''}`}>
      <div className="rc-label">{label}</div>
      <div className="rc-value">{value}</div>
      {subtext && <div className="rc-sub">{subtext}</div>}
    </div>
  );
}

function DecisionCard({ decision }: { decision: AIDecision }) {
  const [expanded, setExpanded] = useState(false);

  const statusIcon = {
    executed: '/',
    skipped: '-',
    error: '!',
    pending: '...',
  }[decision.status];

  const statusColor = {
    executed: '#00ff00',
    skipped: '#666',
    error: '#ff0055',
    pending: '#ffff00',
  }[decision.status];

  return (
    <motion.div
      className="decision-card"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="dc-header" onClick={() => setExpanded(!expanded)}>
        <div className="dc-status" style={{ color: statusColor }}>[{statusIcon}]</div>
        <div className="dc-cycle">Cycle #{decision.cycleNumber}</div>
        <div className="dc-time">{formatTime(decision.timestamp)}</div>
        <div className="dc-expand">{expanded ? 'v' : '>'}</div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            className="dc-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <div className="dc-reasoning">{decision.reasoning}</div>

            {decision.toolCalls.length > 0 && (
              <div className="dc-tools">
                <div className="dc-tools-label">Tool Calls:</div>
                {decision.toolCalls.map((tc, i) => (
                  <div key={i} className="dc-tool">
                    <code className="dc-tool-name">{tc.name}</code>
                    <div className="dc-tool-result">{tc.result}</div>
                  </div>
                ))}
              </div>
            )}

            {decision.error && (
              <div className="dc-error">{decision.error}</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function AlertItem({ alert }: { alert: Alert }) {
  return (
    <div className="alert-item" style={{ borderLeftColor: getAlertColor(alert.type) }}>
      <span className="ai-type" style={{ color: getAlertColor(alert.type) }}>
        [{alert.type.toUpperCase()}]
      </span>
      <span className="ai-message">{alert.message}</span>
      <span className="ai-time">{formatTime(alert.timestamp)}</span>
    </div>
  );
}

function LendingTable({ rates }: { rates: LendingRate[] }) {
  return (
    <div className="lending-table">
      <div className="lt-header">
        <span>Protocol</span>
        <span>APY</span>
        <span>TVL</span>
        <span>Util</span>
      </div>
      {rates.map((rate, i) => (
        <div key={i} className="lt-row">
          <span className="lt-protocol">{rate.protocol}</span>
          <span className="lt-apy">{rate.apy}</span>
          <span className="lt-tvl">{rate.tvl}</span>
          <span className="lt-util">{rate.utilizationRate || '-'}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function RangerDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/dashboard`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setData(json);
      setError(null);
      setLastRefresh(Date.now());
    } catch (err) {
      setError('Unable to connect to Ranger API');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className="ranger-page">
      <header className="ranger-header">
        <div className="header-inner">
          <div className="header-title-row">
            <h1 className="header-title">RANGER VAULT</h1>
            {data && (
              <>
                <StatusBadge status={data.vault.status} />
                <ModeBadge mode={data.vault.executionMode} />
              </>
            )}
          </div>
          <p className="header-sub">
            AI-Managed DeFi Strategy - Real-time Dashboard
          </p>
        </div>
      </header>

      <main className="ranger-main">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner" />
            <span>Connecting to Ranger...</span>
          </div>
        ) : error ? (
          <div className="error-state">
            <div className="error-icon">!</div>
            <h3>{error}</h3>
            <p>Make sure the Ranger bot is running:</p>
            <code>cd beright-ranger && npm run start</code>
            <p className="retry-hint">Retrying every 5 seconds...</p>
          </div>
        ) : data ? (
          <>
            {/* Vault Status Section */}
            <section className="section vault-status">
              <h2 className="section-title">Vault Status</h2>
              <div className="stats-grid">
                <div className="stat-box">
                  <div className="sb-label">Uptime</div>
                  <div className="sb-value">{formatUptime(data.vault.uptime)}</div>
                </div>
                <div className="stat-box">
                  <div className="sb-label">Cycles</div>
                  <div className="sb-value">{data.vault.cycleCount}</div>
                </div>
                <div className="stat-box">
                  <div className="sb-label">Last Cycle</div>
                  <div className="sb-value">
                    {data.vault.lastCycleTime
                      ? formatTime(data.vault.lastCycleTime)
                      : '-'}
                  </div>
                </div>
                <div className="stat-box">
                  <div className="sb-label">Last Refresh</div>
                  <div className="sb-value">{formatTime(lastRefresh)}</div>
                </div>
              </div>
            </section>

            {/* Market Signals Section */}
            {data.signals && (
              <section className="section signals">
                <h2 className="section-title">Market Signals</h2>

                {/* APY Rates */}
                <div className="rates-grid">
                  <RateCard
                    label="Best Lending"
                    value={data.signals.rates.bestLending.apy}
                    subtext={data.signals.rates.bestLending.protocol}
                    highlight
                  />
                  <RateCard
                    label="Funding Rate"
                    value={data.signals.rates.bestFunding.apy}
                    subtext={data.signals.funding.solPerp?.direction}
                  />
                  <RateCard
                    label="RWA (OnRe)"
                    value={data.signals.rates.rwa.apy}
                    subtext={data.signals.rwa.isActive ? 'Active' : 'Inactive'}
                  />
                  <RateCard
                    label="Portfolio"
                    value={data.signals.rates.portfolio.apy}
                  />
                </div>

                {/* Lending Protocols */}
                <div className="subsection">
                  <h3 className="subsection-title">Lending Protocols</h3>
                  <LendingTable rates={data.signals.lending} />
                </div>

                {/* Vault Health */}
                <div className="subsection">
                  <h3 className="subsection-title">Vault Health</h3>
                  <div className="vault-health-grid">
                    <div className="vh-item">
                      <span className="vh-label">NAV</span>
                      <span className="vh-value">{data.signals.vault.nav}</span>
                    </div>
                    <div className="vh-item">
                      <span className="vh-label">Drawdown</span>
                      <span className="vh-value">{data.signals.vault.drawdown}</span>
                    </div>
                    <div className="vh-item">
                      <span className="vh-label">Positions</span>
                      <span className="vh-value">{data.signals.vault.positions}</span>
                    </div>
                  </div>
                </div>

                {/* Risk Flags */}
                <div className="subsection">
                  <h3 className="subsection-title">Risk Flags</h3>
                  <div className="risk-flags-grid">
                    <RiskFlag label="Drift HF Critical" active={data.signals.riskFlags.driftHealthCritical} />
                    <RiskFlag label="Drift HF Warning" active={data.signals.riskFlags.driftHealthWarning} />
                    <RiskFlag label="Drawdown Trigger" active={data.signals.riskFlags.drawdownTriggered} />
                    <RiskFlag label="Funding Kill" active={data.signals.riskFlags.fundingKillSwitch} />
                  </div>
                </div>
              </section>
            )}

            {/* AI Decisions Section */}
            <section className="section decisions">
              <h2 className="section-title">AI Decisions</h2>
              <div className="decisions-list">
                {data.decisions.length === 0 ? (
                  <div className="no-decisions">No decisions yet</div>
                ) : (
                  data.decisions.map((d, i) => (
                    <DecisionCard key={i} decision={d} />
                  ))
                )}
              </div>
            </section>

            {/* Alerts Section */}
            <section className="section alerts">
              <h2 className="section-title">System Alerts</h2>
              <div className="alerts-list">
                {data.alerts.length === 0 ? (
                  <div className="no-alerts">No alerts</div>
                ) : (
                  data.alerts.map((a, i) => (
                    <AlertItem key={i} alert={a} />
                  ))
                )}
              </div>
            </section>
          </>
        ) : null}
      </main>

      <style jsx>{`
        .ranger-page {
          min-height: 100dvh;
          background: #0a0a0f;
          color: #e0e0e0;
          font-family: 'Share Tech Mono', 'Fira Code', monospace;
          padding-bottom: calc(70px + env(safe-area-inset-bottom));
        }

        .ranger-header {
          background: linear-gradient(180deg, #0d0d14 0%, #0a0a0f 100%);
          border-bottom: 1px solid #1a1a2e;
          padding: 24px 16px;
        }

        .header-inner {
          max-width: 1200px;
          margin: 0 auto;
        }

        .header-title-row {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 8px;
        }

        .header-title {
          font-family: 'Orbitron', sans-serif;
          font-size: 24px;
          font-weight: 900;
          color: #00fff7;
          text-shadow: 0 0 20px #00fff730;
          margin: 0;
          letter-spacing: 3px;
        }

        .header-sub {
          font-size: 13px;
          color: #666;
          margin: 0;
        }

        .status-badge, .mode-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 10px;
          padding: 4px 10px;
          border: 1px solid;
          border-radius: 4px;
          letter-spacing: 1px;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .ranger-main {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px 16px;
        }

        .loading-state, .error-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 20px;
          text-align: center;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 2px solid #1a1a2e;
          border-top-color: #00fff7;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin-bottom: 16px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .error-state {
          color: #ff0055;
        }

        .error-icon {
          font-size: 48px;
          width: 80px;
          height: 80px;
          border: 2px solid #ff0055;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
        }

        .error-state h3 {
          margin: 0 0 8px;
          color: #e0e0e0;
        }

        .error-state p {
          margin: 8px 0;
          color: #666;
          font-size: 13px;
        }

        .error-state code {
          background: #12121a;
          border: 1px solid #1a1a2e;
          padding: 8px 16px;
          border-radius: 4px;
          font-size: 12px;
          color: #00fff7;
        }

        .retry-hint {
          color: #444 !important;
          font-size: 11px !important;
        }

        .section {
          background: #0d0d14;
          border: 1px solid #1a1a2e;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 16px;
        }

        .section-title {
          font-family: 'Orbitron', sans-serif;
          font-size: 12px;
          color: #00fff7;
          margin: 0 0 16px;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .subsection {
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid #1a1a2e;
        }

        .subsection-title {
          font-size: 11px;
          color: #666;
          margin: 0 0 12px;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 12px;
        }

        .stat-box {
          background: #12121a;
          border: 1px solid #1a1a2e;
          border-radius: 6px;
          padding: 12px;
          text-align: center;
        }

        .sb-label {
          font-size: 10px;
          color: #555;
          margin-bottom: 4px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .sb-value {
          font-size: 16px;
          color: #00fff7;
          font-weight: bold;
        }

        .rates-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 12px;
        }

        .rate-card {
          background: #12121a;
          border: 1px solid #1a1a2e;
          border-radius: 6px;
          padding: 16px;
          text-align: center;
        }

        .rate-card.highlight {
          border-color: #00fff720;
          background: rgba(0, 255, 247, 0.03);
        }

        .rc-label {
          font-size: 10px;
          color: #555;
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .rc-value {
          font-size: 20px;
          color: #00ff00;
          font-weight: bold;
        }

        .rc-sub {
          font-size: 10px;
          color: #666;
          margin-top: 4px;
        }

        .lending-table {
          font-size: 12px;
        }

        .lt-header, .lt-row {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr;
          gap: 8px;
          padding: 8px 0;
        }

        .lt-header {
          color: #555;
          border-bottom: 1px solid #1a1a2e;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .lt-row {
          border-bottom: 1px solid #1a1a2e10;
        }

        .lt-protocol {
          color: #e0e0e0;
        }

        .lt-apy {
          color: #00ff00;
        }

        .lt-tvl, .lt-util {
          color: #666;
        }

        .vault-health-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        .vh-item {
          display: flex;
          justify-content: space-between;
          padding: 8px 12px;
          background: #12121a;
          border: 1px solid #1a1a2e;
          border-radius: 4px;
        }

        .vh-label {
          color: #555;
          font-size: 11px;
        }

        .vh-value {
          color: #00fff7;
          font-size: 12px;
          font-weight: bold;
        }

        .risk-flags-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 8px;
        }

        .risk-flag {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: #12121a;
          border: 1px solid #1a1a2e;
          border-radius: 4px;
          font-size: 11px;
        }

        .risk-flag.active {
          border-color: #ff005540;
          background: rgba(255, 0, 85, 0.05);
        }

        .rf-icon {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          background: #1a1a2e;
          color: #00ff00;
        }

        .risk-flag.active .rf-icon {
          background: #ff0055;
          color: #fff;
        }

        .rf-label {
          color: #888;
        }

        .risk-flag.active .rf-label {
          color: #ff0055;
        }

        .decisions-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .decision-card {
          background: #12121a;
          border: 1px solid #1a1a2e;
          border-radius: 6px;
          overflow: hidden;
        }

        .dc-header {
          display: grid;
          grid-template-columns: 32px 1fr auto auto;
          gap: 12px;
          padding: 12px;
          cursor: pointer;
          align-items: center;
        }

        .dc-header:hover {
          background: #1a1a2e20;
        }

        .dc-status {
          font-family: monospace;
          font-size: 14px;
        }

        .dc-cycle {
          font-size: 12px;
          color: #e0e0e0;
        }

        .dc-time {
          font-size: 11px;
          color: #555;
        }

        .dc-expand {
          color: #555;
          font-size: 10px;
        }

        .dc-body {
          padding: 0 12px 12px;
          overflow: hidden;
        }

        .dc-reasoning {
          font-size: 12px;
          color: #888;
          line-height: 1.5;
          padding: 8px;
          background: #0a0a0f;
          border-radius: 4px;
          margin-bottom: 8px;
        }

        .dc-tools {
          margin-top: 8px;
        }

        .dc-tools-label {
          font-size: 10px;
          color: #555;
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .dc-tool {
          padding: 8px;
          background: #0a0a0f;
          border: 1px solid #1a1a2e;
          border-radius: 4px;
          margin-bottom: 4px;
        }

        .dc-tool-name {
          font-size: 11px;
          color: #00fff7;
        }

        .dc-tool-result {
          font-size: 11px;
          color: #666;
          margin-top: 4px;
        }

        .dc-error {
          padding: 8px;
          background: rgba(255, 0, 85, 0.1);
          border: 1px solid #ff005530;
          border-radius: 4px;
          font-size: 11px;
          color: #ff0055;
        }

        .no-decisions, .no-alerts {
          text-align: center;
          padding: 24px;
          color: #444;
          font-size: 12px;
        }

        .alerts-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
          max-height: 300px;
          overflow-y: auto;
        }

        .alert-item {
          display: grid;
          grid-template-columns: 80px 1fr auto;
          gap: 8px;
          padding: 8px 12px;
          background: #12121a;
          border-left: 2px solid;
          border-radius: 0 4px 4px 0;
          font-size: 11px;
        }

        .ai-type {
          font-size: 9px;
          letter-spacing: 1px;
        }

        .ai-message {
          color: #888;
        }

        .ai-time {
          color: #444;
        }

        @media (max-width: 640px) {
          .rates-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .vault-health-grid {
            grid-template-columns: 1fr;
          }

          .risk-flags-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .alert-item {
            grid-template-columns: 1fr auto;
          }

          .ai-type {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
