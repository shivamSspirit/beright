'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Target,
  TrendingUp,
  BarChart3,
  Brain,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Activity,
} from 'lucide-react';
import Link from 'next/link';
import Header from '@/components/Header';

// =============================================================================
// TYPES
// =============================================================================

interface OracleForecast {
  id: string;
  market_id: string;
  platform: string;
  question: string;
  category: string;
  probability: number;
  confidence: string;
  confidence_low: number;
  confidence_high: number;
  market_price: number;
  edge: number;
  edge_direction: string;
  action: string;
  suggested_size: string | null;
  risk_level: string | null;
  best_platform: string | null;
  methodology: {
    outsideView?: {
      referenceClass?: string;
      baseRate?: number;
      reasoning?: string;
    };
    insideView?: {
      bullishFactors?: Array<{ factor: string; weight?: string }>;
      bearishFactors?: Array<{ factor: string; weight?: string }>;
      netDirection?: string;
    };
    synthesis?: {
      description?: string;
      reasoning?: string;
    };
  };
  uncertainties: Array<{ factor: string; impact: string }>;
  update_triggers: Array<{ event: string; action: string }>;
  resolved: boolean;
  actual_outcome: boolean | null;
  brier_score: number | null;
  created_at: string;
  resolved_at: string | null;
  market_end_date: string | null;
}

interface OracleStats {
  totalPredictions: number;
  resolvedPredictions: number;
  pendingPredictions: number;
  correctPredictions: number;
  brierScore: number | null;
  accuracy: number;
  calibrationRating: string;
  lastForecastAt: string | null;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const CATEGORY_COLORS: Record<string, string> = {
  politics: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  crypto: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  sports: 'bg-green-500/20 text-green-400 border-green-500/30',
  economics: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  science: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  technology: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  world: 'bg-red-500/20 text-red-400 border-red-500/30',
  other: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const ACTION_COLORS: Record<string, string> = {
  BUY_YES: 'bg-green-500/20 text-green-400',
  BUY_NO: 'bg-red-500/20 text-red-400',
  WAIT: 'bg-yellow-500/20 text-yellow-400',
  NO_TRADE: 'bg-gray-500/20 text-gray-400',
};

function getEdgeColor(edge: number): string {
  const absEdge = Math.abs(edge);
  if (absEdge >= 0.10) return 'text-green-400';
  if (absEdge >= 0.05) return 'text-yellow-400';
  return 'text-[var(--text-muted)]';
}

function getBrierRatingColor(rating: string): string {
  if (rating.includes('Elite') || rating.includes('Superforecaster')) return 'text-yellow-400';
  if (rating.includes('Excellent')) return 'text-purple-400';
  if (rating.includes('Good')) return 'text-green-400';
  return 'text-[var(--text-muted)]';
}

function formatTimeAgo(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const diff = now.getTime() - then.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  return 'Just now';
}

// =============================================================================
// FORECAST CARD COMPONENT
// =============================================================================

function ForecastCard({ forecast, expanded, onToggle }: {
  forecast: OracleForecast;
  expanded: boolean;
  onToggle: () => void;
}) {
  const edgePercent = (forecast.edge * 100).toFixed(1);
  const probabilityPercent = (forecast.probability * 100).toFixed(0);
  const marketPricePercent = (forecast.market_price * 100).toFixed(0);

  return (
    <motion.div
      className="glass-card overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Header */}
      <div className="p-4 cursor-pointer" onClick={onToggle}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2 py-0.5 rounded text-xs border ${CATEGORY_COLORS[forecast.category] || CATEGORY_COLORS.other}`}>
                {forecast.category}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs ${ACTION_COLORS[forecast.action] || ACTION_COLORS.NO_TRADE}`}>
                {forecast.action.replace('_', ' ')}
              </span>
              {forecast.resolved && (
                <span className={`px-2 py-0.5 rounded text-xs ${
                  forecast.actual_outcome ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {forecast.actual_outcome ? 'Correct' : 'Wrong'}
                </span>
              )}
            </div>
            <h3 className="font-medium text-sm leading-snug">{forecast.question}</h3>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-2xl font-bold text-[var(--yes-primary)]">
              {probabilityPercent}%
            </div>
            <div className={`text-xs ${getEdgeColor(forecast.edge)}`}>
              {forecast.edge > 0 ? '+' : ''}{edgePercent}% edge
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
          <div className="flex items-center gap-4">
            <span>Market: {marketPricePercent}%</span>
            <span>Confidence: {forecast.confidence}</span>
            <span>{forecast.platform}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={12} />
            <span>{formatTimeAgo(forecast.created_at)}</span>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="border-t border-[var(--border-subtle)]"
        >
          <div className="p-4 space-y-4">
            {/* Methodology */}
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Brain size={14} className="text-[var(--ai-primary)]" />
                Methodology
              </h4>
              <div className="space-y-3 text-sm">
                {/* Outside View */}
                {forecast.methodology?.outsideView && (
                  <div className="p-3 rounded-lg bg-[var(--bg-secondary)]">
                    <div className="font-medium text-xs text-[var(--text-muted)] mb-1">Outside View (Base Rate)</div>
                    <p className="text-[var(--text-secondary)]">
                      Reference class: {forecast.methodology.outsideView.referenceClass || 'N/A'}
                    </p>
                    <p className="text-[var(--text-secondary)]">
                      Base rate: {forecast.methodology.outsideView.baseRate
                        ? `${(forecast.methodology.outsideView.baseRate * 100).toFixed(0)}%`
                        : 'N/A'}
                    </p>
                  </div>
                )}

                {/* Inside View */}
                {forecast.methodology?.insideView && (
                  <div className="p-3 rounded-lg bg-[var(--bg-secondary)]">
                    <div className="font-medium text-xs text-[var(--text-muted)] mb-2">Inside View (Evidence)</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-green-400 mb-1">Bullish Factors</div>
                        <ul className="space-y-1">
                          {(forecast.methodology.insideView.bullishFactors || []).slice(0, 3).map((f, i) => (
                            <li key={i} className="text-xs text-[var(--text-secondary)]">• {f.factor}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="text-xs text-red-400 mb-1">Bearish Factors</div>
                        <ul className="space-y-1">
                          {(forecast.methodology.insideView.bearishFactors || []).slice(0, 3).map((f, i) => (
                            <li key={i} className="text-xs text-[var(--text-secondary)]">• {f.factor}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Synthesis */}
                {forecast.methodology?.synthesis && (
                  <div className="p-3 rounded-lg bg-[var(--bg-secondary)]">
                    <div className="font-medium text-xs text-[var(--text-muted)] mb-1">Synthesis</div>
                    <p className="text-[var(--text-secondary)]">
                      {forecast.methodology.synthesis.description || forecast.methodology.synthesis.reasoning}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Uncertainties & Triggers */}
            <div className="grid grid-cols-2 gap-4">
              {/* Key Uncertainties */}
              {forecast.uncertainties && forecast.uncertainties.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <AlertCircle size={14} className="text-yellow-400" />
                    Key Uncertainties
                  </h4>
                  <ul className="space-y-1">
                    {forecast.uncertainties.slice(0, 3).map((u, i) => (
                      <li key={i} className="text-xs text-[var(--text-secondary)]">
                        <span className="font-medium">{u.factor}:</span> {u.impact}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Update Triggers */}
              {forecast.update_triggers && forecast.update_triggers.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Activity size={14} className="text-cyan-400" />
                    Update Triggers
                  </h4>
                  <ul className="space-y-1">
                    {forecast.update_triggers.slice(0, 3).map((t, i) => (
                      <li key={i} className="text-xs text-[var(--text-secondary)]">
                        <span className="font-medium">{t.event}:</span> {t.action}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Trading Recommendation */}
            {forecast.action !== 'NO_TRADE' && forecast.action !== 'WAIT' && (
              <div className="p-3 rounded-lg bg-gradient-to-r from-[var(--yes-primary)]/10 to-transparent border border-[var(--yes-primary)]/20">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-[var(--text-muted)] mb-1">Trading Recommendation</div>
                    <div className="font-semibold text-[var(--yes-primary)]">
                      {forecast.action.replace('_', ' ')}
                      {forecast.suggested_size && ` (${forecast.suggested_size} size)`}
                    </div>
                  </div>
                  {forecast.best_platform && (
                    <div className="text-right">
                      <div className="text-xs text-[var(--text-muted)]">Best Platform</div>
                      <div className="font-medium capitalize">{forecast.best_platform}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function OraclePage() {
  const [stats, setStats] = useState<OracleStats | null>(null);
  const [forecasts, setForecasts] = useState<OracleForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'active' | 'resolved' | 'all'>('active');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, forecastsRes] = await Promise.all([
        fetch('/api/v2/oracle/stats'),
        fetch(`/api/v2/oracle/forecasts?status=${filter}&limit=50${categoryFilter !== 'all' ? `&category=${categoryFilter}` : ''}`),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (statsData.success) setStats(statsData.data);
      }

      if (forecastsRes.ok) {
        const forecastsData = await forecastsRes.json();
        if (forecastsData.success) setForecasts(forecastsData.data.forecasts || []);
      }
    } catch (error) {
      console.error('Error fetching oracle data:', error);
    } finally {
      setLoading(false);
    }
  }, [filter, categoryFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const categories = ['all', 'politics', 'crypto', 'economics', 'sports', 'science', 'technology', 'world'];

  return (
    <div className="min-h-screen bg-mesh pb-24 pt-20">
      <Header />

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Hero Section */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--ai-primary)]/10 border border-[var(--ai-primary)]/20 mb-4">
            <Brain size={16} className="text-[var(--ai-primary)]" />
            <span className="text-sm text-[var(--ai-primary)]">Autonomous AI Forecaster</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">Oracle</h1>
          <p className="text-[var(--text-muted)] max-w-lg mx-auto">
            BeRight's autonomous superforecaster. Discovers markets, generates predictions,
            and tracks calibration to prove our forecasting credibility.
          </p>
        </motion.div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <motion.div
              className="glass-card p-4 text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="flex justify-center mb-2">
                <BarChart3 size={20} className="text-[var(--ai-primary)]" />
              </div>
              <div className="text-2xl font-bold">{stats.totalPredictions}</div>
              <div className="text-xs text-[var(--text-muted)]">Total Forecasts</div>
            </motion.div>

            <motion.div
              className="glass-card p-4 text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <div className="flex justify-center mb-2">
                <TrendingUp size={20} className="text-green-400" />
              </div>
              <div className={`text-2xl font-bold ${getBrierRatingColor(stats.calibrationRating)}`}>
                {stats.brierScore !== null ? stats.brierScore.toFixed(3) : 'N/A'}
              </div>
              <div className="text-xs text-[var(--text-muted)]">Brier Score</div>
            </motion.div>

            <motion.div
              className="glass-card p-4 text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex justify-center mb-2">
                <Target size={20} className="text-[var(--yes-primary)]" />
              </div>
              <div className="text-2xl font-bold">{stats.accuracy.toFixed(0)}%</div>
              <div className="text-xs text-[var(--text-muted)]">Accuracy</div>
            </motion.div>

            <motion.div
              className="glass-card p-4 text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <div className="flex justify-center mb-2">
                <CheckCircle2 size={20} className="text-purple-400" />
              </div>
              <div className={`text-lg font-bold ${getBrierRatingColor(stats.calibrationRating)}`}>
                {stats.calibrationRating.replace(' (Superforecaster)', '')}
              </div>
              <div className="text-xs text-[var(--text-muted)]">Calibration</div>
            </motion.div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex rounded-lg overflow-hidden border border-[var(--border-subtle)]">
            {(['active', 'resolved', 'all'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 text-sm capitalize transition-colors ${
                  filter === status
                    ? 'bg-[var(--ai-primary)] text-white'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-white'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-sm"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'all' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>

          <button
            onClick={fetchData}
            disabled={loading}
            className="ml-auto p-2 rounded-lg bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-white transition-colors"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Forecasts List */}
        {loading ? (
          <div className="text-center py-12">
            <RefreshCw size={24} className="animate-spin mx-auto text-[var(--ai-primary)] mb-2" />
            <p className="text-[var(--text-muted)]">Loading forecasts...</p>
          </div>
        ) : forecasts.length === 0 ? (
          <div className="text-center py-12 glass-card">
            <Brain size={48} className="mx-auto text-[var(--text-muted)] mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Forecasts Yet</h3>
            <p className="text-[var(--text-muted)] mb-4">
              Oracle runs every 6 hours to discover and forecast trending markets.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {forecasts.map((forecast) => (
              <ForecastCard
                key={forecast.id}
                forecast={forecast}
                expanded={expandedId === forecast.id}
                onToggle={() => setExpandedId(expandedId === forecast.id ? null : forecast.id)}
              />
            ))}
          </div>
        )}

        {/* CTA */}
        <motion.div
          className="mt-12 text-center glass-card p-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-xl font-bold mb-2">Think You Can Beat Oracle?</h2>
          <p className="text-[var(--text-muted)] mb-6">
            Join BeRight's decentralized forecaster network. Stake your reputation,
            compete for capital delegation, and earn from your predictions.
          </p>
          <Link
            href="/calibration"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-[var(--yes-primary)] to-[var(--ai-primary)] text-white font-medium hover:opacity-90 transition-opacity"
          >
            Join as Forecaster
            <ArrowRight size={18} />
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
