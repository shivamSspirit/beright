'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES (mirrored from beright-ts)
// ─────────────────────────────────────────────────────────────────────────────

type ChannelTier = 'free' | 'pro' | 'whale';

interface SignalChannel {
  id: string;
  forecaster_telegram_id: number;
  forecaster_display_name: string;
  name: string;
  description: string;
  slug: string;
  tier: ChannelTier;
  monthly_price_usd: number;
  signal_count: number;
  subscriber_count: number;
  win_rate: number | null;
  avg_roi: number | null;
  best_signal_text: string | null;
  is_active: boolean;
  is_verified: boolean;
  signals_7d: number;
  signals_30d: number;
  created_at: string;
}

interface ChannelSignal {
  id: string;
  market_title: string;
  platform: string;
  direction: 'YES' | 'NO';
  probability: number;
  confidence: 'low' | 'medium' | 'high';
  reasoning: string;
  time_horizon: string;
  on_chain_tx: string | null;
  resolved_at: string | null;
  outcome: boolean | null;
  brier_score: number | null;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

const TIER_COLOR: Record<ChannelTier, string> = {
  free: '#666',
  pro: '#00fff7',
  whale: '#ff00ff',
};

const TIER_BG: Record<ChannelTier, string> = {
  free: 'transparent',
  pro: 'rgba(0, 255, 247, 0.08)',
  whale: 'rgba(255, 0, 255, 0.08)',
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function fetchChannels(): Promise<SignalChannel[]> {
  try {
    const r = await fetch(`${API_BASE}/api/vaults?limit=20`);
    const data = await r.json();
    return data.channels || [];
  } catch {
    return [];
  }
}

async function fetchChannelDetail(slug: string): Promise<{ channel: SignalChannel; signals: ChannelSignal[] } | null> {
  try {
    const r = await fetch(`${API_BASE}/api/vaults?slug=${slug}&signals=true`);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHANNEL CARD
// ─────────────────────────────────────────────────────────────────────────────

function ChannelCard({ channel, onClick }: { channel: SignalChannel; onClick: () => void }) {
  const winPct = channel.win_rate != null ? Math.round(channel.win_rate * 100) : null;

  return (
    <motion.div
      className="channel-card"
      style={{ borderColor: TIER_COLOR[channel.tier], background: TIER_BG[channel.tier] }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01, borderColor: '#00fff7' }}
      onClick={onClick}
    >
      <div className="card-header">
        <div className="card-title-row">
          <h3 className="card-name">{channel.name}</h3>
          {channel.is_verified && <span className="verified-badge">✓ VERIFIED</span>}
          {channel.tier !== 'free' && (
            <span className="tier-badge" style={{ color: TIER_COLOR[channel.tier], borderColor: TIER_COLOR[channel.tier] }}>
              {channel.tier.toUpperCase()}
            </span>
          )}
        </div>
        <div className="card-forecaster">by {channel.forecaster_display_name}</div>
      </div>

      {channel.description && (
        <p className="card-desc">{channel.description}</p>
      )}

      <div className="card-stats">
        <div className="stat-chip">
          <span className="chip-icon">👥</span>
          <span className="chip-value">{channel.subscriber_count}</span>
          <span className="chip-label">subs</span>
        </div>
        <div className="stat-chip">
          <span className="chip-icon">📊</span>
          <span className="chip-value">{channel.signal_count}</span>
          <span className="chip-label">signals</span>
        </div>
        {winPct !== null && (
          <div className="stat-chip win">
            <span className="chip-icon">🎯</span>
            <span className="chip-value">{winPct}%</span>
            <span className="chip-label">wins</span>
          </div>
        )}
        <div className="stat-chip">
          <span className="chip-icon">📅</span>
          <span className="chip-value">{channel.signals_7d}</span>
          <span className="chip-label">this week</span>
        </div>
      </div>

      {channel.best_signal_text && (
        <blockquote className="card-quote">"{channel.best_signal_text}"</blockquote>
      )}

      <div className="card-footer">
        <span className="card-price">
          {channel.monthly_price_usd === 0 ? 'Free' : `$${channel.monthly_price_usd}/mo`}
        </span>
        <span className="subscribe-hint">Subscribe on Telegram: /subscribe-channel {channel.slug}</span>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SIGNAL ROW (in channel detail)
// ─────────────────────────────────────────────────────────────────────────────

function SignalRow({ signal }: { signal: ChannelSignal }) {
  const dirColor = signal.direction === 'YES' ? '#00ff00' : '#ff0055';
  let statusIcon = '⏳';
  if (signal.resolved_at) {
    statusIcon = signal.outcome ? '✅' : '❌';
  }

  return (
    <div className="signal-detail-row">
      <div className="sdr-status">{statusIcon}</div>
      <div className="sdr-dir" style={{ color: dirColor }}>{signal.direction}</div>
      <div className="sdr-body">
        <div className="sdr-title">{signal.market_title}</div>
        <div className="sdr-meta">
          {Math.round(signal.probability * 100)}% · {signal.confidence} conf · {signal.time_horizon}
          {signal.on_chain_tx && (
            <a
              href={`https://solscan.io/tx/${signal.on_chain_tx}`}
              target="_blank"
              rel="noopener noreferrer"
              className="sdr-chain-link"
            >
              ⛓ on-chain
            </a>
          )}
        </div>
        {signal.reasoning && <div className="sdr-reason">{signal.reasoning}</div>}
      </div>
      <div className="sdr-time">
        {new Date(signal.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHANNEL DETAIL MODAL
// ─────────────────────────────────────────────────────────────────────────────

function ChannelDetail({
  slug,
  onClose,
}: {
  slug: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<{ channel: SignalChannel; signals: ChannelSignal[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChannelDetail(slug).then(d => {
      setData(d);
      setLoading(false);
    });
  }, [slug]);

  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="modal-panel"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        onClick={e => e.stopPropagation()}
      >
        {loading ? (
          <div className="modal-loading">Loading channel...</div>
        ) : !data ? (
          <div className="modal-loading">Channel not found</div>
        ) : (
          <>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">{data.channel.name}</h2>
                <div className="modal-sub">by {data.channel.forecaster_display_name}</div>
              </div>
              <button className="modal-close" onClick={onClose}>✕</button>
            </div>

            <div className="modal-stats-row">
              <div className="modal-stat">
                <div className="ms-val">{data.channel.subscriber_count}</div>
                <div className="ms-label">Subscribers</div>
              </div>
              <div className="modal-stat">
                <div className="ms-val">{data.channel.signal_count}</div>
                <div className="ms-label">Total Signals</div>
              </div>
              {data.channel.win_rate != null && (
                <div className="modal-stat">
                  <div className="ms-val" style={{ color: '#00ff00' }}>{Math.round(data.channel.win_rate * 100)}%</div>
                  <div className="ms-label">Win Rate</div>
                </div>
              )}
              <div className="modal-stat">
                <div className="ms-val">{data.channel.monthly_price_usd === 0 ? 'Free' : `$${data.channel.monthly_price_usd}`}</div>
                <div className="ms-label">Per Month</div>
              </div>
            </div>

            <div className="modal-subscribe-box">
              <span>Subscribe on Telegram:</span>
              <code className="modal-subscribe-cmd">/subscribe-channel {data.channel.slug}</code>
            </div>

            <div className="modal-signals-header">Recent Signals ({data.signals.length})</div>
            <div className="modal-signals-list">
              {data.signals.length === 0 ? (
                <div className="modal-no-signals">No signals yet</div>
              ) : (
                data.signals.map(s => <SignalRow key={s.id} signal={s} />)
              )}
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function VaultsPage() {
  const [channels, setChannels] = useState<SignalChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  useEffect(() => {
    fetchChannels().then(data => {
      setChannels(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="vaults-page">
      <header className="vaults-header">
        <div className="header-inner">
          <h1 className="header-title">◈ Signal Channels</h1>
          <p className="header-sub">
            Subscribe to top forecasters. Get their predictions delivered to Telegram before the market moves.
          </p>
        </div>
      </header>

      <main className="vaults-main">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner" />
            <span>Loading channels...</span>
          </div>
        ) : channels.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📡</div>
            <h3>No channels yet</h3>
            <p>Be the first to create a signal channel on Telegram.</p>
            <p className="empty-cmd">/create-channel [name]</p>
          </div>
        ) : (
          <div className="channels-grid">
            {channels.map(channel => (
              <ChannelCard
                key={channel.id}
                channel={channel}
                onClick={() => setSelectedSlug(channel.slug)}
              />
            ))}
          </div>
        )}

        <div className="cta-section">
          <div className="cta-card">
            <h3>📡 Create Your Channel</h3>
            <p>
              Share your predictions. Build a following. Every signal is timestamped on Solana — your track record is public and verifiable.
            </p>
            <div className="cta-steps">
              <div className="cta-step">
                <span className="step-num">1</span>
                <span>Open the BeRight bot on Telegram</span>
              </div>
              <div className="cta-step">
                <span className="step-num">2</span>
                <span>Run: <code>/create-channel [name]</code></span>
              </div>
              <div className="cta-step">
                <span className="step-num">3</span>
                <span>Broadcast: <code>/signal YES "market?" 0.75 high "reasoning"</code></span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <AnimatePresence>
        {selectedSlug && (
          <ChannelDetail
            slug={selectedSlug}
            onClose={() => setSelectedSlug(null)}
          />
        )}
      </AnimatePresence>


      <style jsx>{`
        .vaults-page {
          min-height: 100dvh;
          background: #0a0a0f;
          color: #e0e0e0;
          font-family: 'Share Tech Mono', 'Fira Code', monospace;
          padding-bottom: calc(70px + env(safe-area-inset-bottom));
        }

        .vaults-header {
          background: linear-gradient(180deg, #0d0d14 0%, #0a0a0f 100%);
          border-bottom: 1px solid #1a1a2e;
          padding: 24px 16px;
        }

        .header-inner {
          max-width: 900px;
          margin: 0 auto;
        }

        .header-title {
          font-family: 'Orbitron', sans-serif;
          font-size: 22px;
          font-weight: 900;
          color: #00fff7;
          text-shadow: 0 0 20px #00fff730;
          margin: 0 0 8px;
          letter-spacing: 2px;
        }

        .header-sub {
          font-size: 13px;
          color: #666;
          margin: 0;
          line-height: 1.5;
        }

        .vaults-main {
          max-width: 900px;
          margin: 0 auto;
          padding: 16px;
        }

        /* Loading */
        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          padding: 60px 20px;
          color: #666;
        }

        .loading-spinner {
          width: 32px;
          height: 32px;
          border: 2px solid #1a1a2e;
          border-top-color: #00fff7;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Empty state */
        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #666;
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .empty-state h3 {
          color: #e0e0e0;
          margin: 0 0 8px;
        }

        .empty-cmd {
          font-size: 13px;
          color: #00fff7;
          margin-top: 8px;
        }

        /* Channels grid */
        .channels-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 12px;
          margin-bottom: 24px;
        }

        /* Channel card */
        .channel-card {
          background: #0d0d14;
          border: 1px solid #1a1a2e;
          border-radius: 8px;
          padding: 16px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .card-header {
          margin-bottom: 10px;
        }

        .card-title-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 4px;
        }

        .card-name {
          font-size: 14px;
          font-weight: bold;
          color: #fff;
          margin: 0;
        }

        .verified-badge {
          font-size: 9px;
          color: #00ff00;
          border: 1px solid #00ff0040;
          padding: 2px 6px;
          border-radius: 3px;
        }

        .tier-badge {
          font-size: 9px;
          border: 1px solid;
          padding: 2px 6px;
          border-radius: 3px;
        }

        .card-forecaster {
          font-size: 11px;
          color: #666;
        }

        .card-desc {
          font-size: 11px;
          color: #999;
          line-height: 1.5;
          margin: 0 0 12px;
        }

        .card-stats {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 10px;
        }

        .stat-chip {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          background: #12121a;
          border: 1px solid #1a1a2e;
          border-radius: 4px;
          font-size: 11px;
        }

        .stat-chip.win .chip-value { color: #00ff00; }

        .chip-icon { font-size: 10px; }
        .chip-value { color: #fff; font-weight: bold; }
        .chip-label { color: #555; font-size: 10px; }

        .card-quote {
          font-size: 11px;
          color: #888;
          font-style: italic;
          border-left: 2px solid #1a1a2e;
          margin: 0 0 10px;
          padding-left: 8px;
          line-height: 1.4;
        }

        .card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top: 1px solid #1a1a2e;
          padding-top: 8px;
          gap: 8px;
        }

        .card-price {
          font-size: 12px;
          font-weight: bold;
          color: #00fff7;
        }

        .subscribe-hint {
          font-size: 9px;
          color: #444;
          flex: 1;
          text-align: right;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* CTA section */
        .cta-section {
          margin-top: 24px;
        }

        .cta-card {
          background: #0d0d14;
          border: 1px solid #1a1a2e;
          border-radius: 8px;
          padding: 24px;
        }

        .cta-card h3 {
          font-family: 'Orbitron', sans-serif;
          font-size: 14px;
          color: #00fff7;
          margin: 0 0 8px;
          letter-spacing: 1px;
        }

        .cta-card p {
          font-size: 12px;
          color: #888;
          line-height: 1.6;
          margin: 0 0 16px;
        }

        .cta-steps {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .cta-step {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 12px;
          color: #ccc;
        }

        .step-num {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #1a1a2e;
          border: 1px solid #00fff730;
          color: #00fff7;
          font-size: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .cta-step code {
          background: #12121a;
          border: 1px solid #1a1a2e;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 11px;
          color: #00fff7;
        }

        /* Modal */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          z-index: 1000;
          display: flex;
          align-items: flex-end;
          padding: 16px;
        }

        @media (min-width: 640px) {
          .modal-overlay {
            align-items: center;
            justify-content: center;
          }
        }

        .modal-panel {
          background: #0d0d14;
          border: 1px solid #1a1a2e;
          border-radius: 12px 12px 0 0;
          width: 100%;
          max-width: 600px;
          max-height: 80dvh;
          overflow-y: auto;
          padding: 20px;
        }

        @media (min-width: 640px) {
          .modal-panel {
            border-radius: 12px;
          }
        }

        .modal-loading {
          text-align: center;
          padding: 40px;
          color: #666;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .modal-title {
          font-family: 'Orbitron', sans-serif;
          font-size: 16px;
          color: #fff;
          margin: 0 0 4px;
          letter-spacing: 1px;
        }

        .modal-sub {
          font-size: 12px;
          color: #666;
        }

        .modal-close {
          background: #12121a;
          border: 1px solid #1a1a2e;
          color: #666;
          width: 32px;
          height: 32px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.2s;
        }

        .modal-close:hover {
          border-color: #ff0055;
          color: #ff0055;
        }

        .modal-stats-row {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .modal-stat {
          flex: 1;
          min-width: 80px;
          text-align: center;
          background: #12121a;
          border: 1px solid #1a1a2e;
          border-radius: 6px;
          padding: 10px;
        }

        .ms-val {
          font-size: 18px;
          font-weight: bold;
          color: #00fff7;
        }

        .ms-label {
          font-size: 10px;
          color: #555;
          margin-top: 2px;
        }

        .modal-subscribe-box {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          background: #12121a;
          border: 1px solid #00fff720;
          border-radius: 6px;
          font-size: 12px;
          color: #888;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .modal-subscribe-cmd {
          color: #00fff7;
          font-size: 12px;
        }

        .modal-signals-header {
          font-size: 12px;
          color: #666;
          margin-bottom: 8px;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .modal-no-signals {
          text-align: center;
          padding: 24px;
          color: #444;
          font-size: 12px;
        }

        .modal-signals-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        /* Signal detail row */
        .signal-detail-row {
          display: grid;
          grid-template-columns: 20px 32px 1fr 48px;
          gap: 8px;
          align-items: start;
          padding: 10px;
          background: #0a0a0f;
          border: 1px solid #1a1a2e;
          border-radius: 6px;
          font-size: 11px;
        }

        .sdr-status {
          font-size: 14px;
        }

        .sdr-dir {
          font-weight: bold;
          font-size: 11px;
          padding-top: 1px;
        }

        .sdr-body {
          min-width: 0;
        }

        .sdr-title {
          color: #e0e0e0;
          margin-bottom: 3px;
          line-height: 1.3;
        }

        .sdr-meta {
          color: #555;
          display: flex;
          gap: 6px;
          align-items: center;
          flex-wrap: wrap;
          margin-bottom: 3px;
        }

        .sdr-chain-link {
          color: #00fff7;
          text-decoration: none;
          font-size: 10px;
        }

        .sdr-chain-link:hover {
          text-decoration: underline;
        }

        .sdr-reason {
          color: #666;
          font-style: italic;
          line-height: 1.4;
        }

        .sdr-time {
          color: #444;
          text-align: right;
          padding-top: 1px;
        }

        @media (max-width: 480px) {
          .channels-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
