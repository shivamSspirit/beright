'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target,
  TrendingUp,
  BarChart3,
  Brain,
  Clock,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Activity,
  Zap,
  Shield,
  Eye,
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

const CATEGORY_CONFIG: Record<string, { bg: string; text: string; border: string }> = {
  politics: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
  crypto: { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' },
  sports: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  economics: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
  science: { bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  technology: { bg: 'bg-pink-500/15', text: 'text-pink-400', border: 'border-pink-500/30' },
  world: { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30' },
  other: { bg: 'bg-slate-500/15', text: 'text-slate-400', border: 'border-slate-500/30' },
};

const ACTION_CONFIG: Record<string, { bg: string; text: string }> = {
  BUY_YES: { bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  BUY_NO: { bg: 'bg-red-500/15', text: 'text-red-400' },
  WAIT: { bg: 'bg-amber-500/15', text: 'text-amber-400' },
  NO_TRADE: { bg: 'bg-slate-500/15', text: 'text-slate-400' },
};

function getEdgeColor(edge: number): string {
  const absEdge = Math.abs(edge);
  if (absEdge >= 0.10) return 'text-emerald-400';
  if (absEdge >= 0.05) return 'text-amber-400';
  return 'text-slate-500';
}

function getBrierColor(score: number | null): string {
  if (score === null) return 'text-slate-400';
  if (score <= 0.1) return 'text-amber-400'; // Elite
  if (score <= 0.15) return 'text-purple-400'; // Excellent
  if (score <= 0.2) return 'text-emerald-400'; // Good
  return 'text-slate-400';
}

function formatTimeAgo(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const diff = now.getTime() - then.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

// =============================================================================
// STAT CARD COMPONENT
// =============================================================================

function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  iconColor,
  valueColor,
  delay = 0,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subValue?: string;
  iconColor: string;
  valueColor?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className="relative overflow-hidden rounded-xl border border-slate-800/50 bg-gradient-to-br from-slate-900/90 to-slate-900/50 p-4 sm:p-5 backdrop-blur-sm"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
    >
      {/* Glow effect */}
      <div className={`absolute -top-12 -right-12 w-24 h-24 ${iconColor.replace('text-', 'bg-')}/10 rounded-full blur-2xl`} />

      <div className="relative">
        <div className={`inline-flex p-2 rounded-lg ${iconColor.replace('text-', 'bg-')}/10 mb-3`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div className={`text-2xl sm:text-3xl font-bold tracking-tight ${valueColor || 'text-slate-100'}`}>
          {value}
        </div>
        <div className="text-xs sm:text-sm text-slate-500 mt-1">{label}</div>
        {subValue && (
          <div className="text-xs text-slate-600 mt-1">{subValue}</div>
        )}
      </div>
    </motion.div>
  );
}

// =============================================================================
// FORECAST CARD COMPONENT
// =============================================================================

function ForecastCard({
  forecast,
  expanded,
  onToggle,
  index,
}: {
  forecast: OracleForecast;
  expanded: boolean;
  onToggle: () => void;
  index: number;
}) {
  const edgePercent = (forecast.edge * 100).toFixed(1);
  const probabilityPercent = (forecast.probability * 100).toFixed(0);
  const marketPricePercent = (forecast.market_price * 100).toFixed(0);
  const category = CATEGORY_CONFIG[forecast.category] || CATEGORY_CONFIG.other;
  const action = ACTION_CONFIG[forecast.action] || ACTION_CONFIG.NO_TRADE;

  return (
    <motion.div
      className="relative overflow-hidden rounded-xl border border-slate-800/50 bg-gradient-to-br from-slate-900/90 to-slate-900/50 backdrop-blur-sm transition-all duration-200 hover:border-slate-700/50"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
    >
      {/* Card Header - Always Visible */}
      <button
        onClick={onToggle}
        className="w-full text-left p-4 sm:p-5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-inset rounded-xl"
        aria-expanded={expanded}
      >
        {/* Top Row: Badges + Probability */}
        <div className="flex items-start justify-between gap-3 sm:gap-4 mb-3">
          {/* Left: Question & Badges */}
          <div className="flex-1 min-w-0">
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`px-2 py-1 rounded-md text-xs font-medium border ${category.bg} ${category.text} ${category.border}`}>
                {forecast.category}
              </span>
              <span className={`px-2 py-1 rounded-md text-xs font-medium ${action.bg} ${action.text}`}>
                {forecast.action.replace('_', ' ')}
              </span>
              {forecast.resolved && (
                <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                  forecast.actual_outcome
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-red-500/15 text-red-400'
                }`}>
                  {forecast.actual_outcome ? 'Correct' : 'Wrong'}
                </span>
              )}
            </div>
            {/* Question */}
            <h3 className="text-sm sm:text-base font-medium text-slate-100 leading-snug line-clamp-2">
              {forecast.question}
            </h3>
          </div>

          {/* Right: Probability */}
          <div className="flex-shrink-0 text-right">
            <div className="text-2xl sm:text-3xl font-bold text-emerald-400 tabular-nums">
              {probabilityPercent}%
            </div>
            <div className={`text-xs sm:text-sm font-medium ${getEdgeColor(forecast.edge)}`}>
              {forecast.edge > 0 ? '+' : ''}{edgePercent}% edge
            </div>
          </div>
        </div>

        {/* Bottom Row: Meta Info */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm text-slate-500">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <span className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" />
              Market: {marketPricePercent}%
            </span>
            <span className="hidden sm:inline">Confidence: {forecast.confidence}</span>
            <span className="capitalize">{forecast.platform}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            <span>{formatTimeAgo(forecast.created_at)}</span>
            <motion.div
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-4 h-4" />
            </motion.div>
          </div>
        </div>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-800/50 p-4 sm:p-5 space-y-4 sm:space-y-5">
              {/* Methodology Section */}
              <div>
                <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-3">
                  <Brain className="w-4 h-4 text-purple-400" />
                  Methodology
                </h4>
                <div className="space-y-3">
                  {/* Outside View */}
                  {forecast.methodology?.outsideView && (
                    <div className="p-3 sm:p-4 rounded-lg bg-slate-800/30 border border-slate-700/30">
                      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                        Outside View (Base Rate)
                      </div>
                      <p className="text-sm text-slate-300">
                        <span className="text-slate-500">Reference class:</span>{' '}
                        {forecast.methodology.outsideView.referenceClass || 'N/A'}
                      </p>
                      <p className="text-sm text-slate-300">
                        <span className="text-slate-500">Base rate:</span>{' '}
                        {forecast.methodology.outsideView.baseRate
                          ? `${(forecast.methodology.outsideView.baseRate * 100).toFixed(0)}%`
                          : 'N/A'}
                      </p>
                    </div>
                  )}

                  {/* Inside View */}
                  {forecast.methodology?.insideView && (
                    <div className="p-3 sm:p-4 rounded-lg bg-slate-800/30 border border-slate-700/30">
                      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
                        Inside View (Evidence)
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Bullish */}
                        <div>
                          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 mb-2">
                            <TrendingUp className="w-3.5 h-3.5" />
                            Bullish Factors
                          </div>
                          <ul className="space-y-1.5">
                            {(forecast.methodology.insideView.bullishFactors || []).slice(0, 3).map((f, i) => (
                              <li key={i} className="text-xs sm:text-sm text-slate-400 flex items-start gap-2">
                                <span className="text-emerald-500 mt-1">•</span>
                                <span>{f.factor}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        {/* Bearish */}
                        <div>
                          <div className="flex items-center gap-1.5 text-xs font-medium text-red-400 mb-2">
                            <TrendingUp className="w-3.5 h-3.5 rotate-180" />
                            Bearish Factors
                          </div>
                          <ul className="space-y-1.5">
                            {(forecast.methodology.insideView.bearishFactors || []).slice(0, 3).map((f, i) => (
                              <li key={i} className="text-xs sm:text-sm text-slate-400 flex items-start gap-2">
                                <span className="text-red-500 mt-1">•</span>
                                <span>{f.factor}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Synthesis */}
                  {forecast.methodology?.synthesis && (
                    <div className="p-3 sm:p-4 rounded-lg bg-slate-800/30 border border-slate-700/30">
                      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                        Synthesis
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">
                        {forecast.methodology.synthesis.description || forecast.methodology.synthesis.reasoning}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Uncertainties & Triggers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Key Uncertainties */}
                {forecast.uncertainties && forecast.uncertainties.length > 0 && (
                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-3">
                      <AlertCircle className="w-4 h-4 text-amber-400" />
                      Key Uncertainties
                    </h4>
                    <ul className="space-y-2">
                      {forecast.uncertainties.slice(0, 3).map((u, i) => (
                        <li key={i} className="text-xs sm:text-sm text-slate-400">
                          <span className="font-medium text-slate-300">{u.factor}:</span>{' '}
                          {u.impact}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Update Triggers */}
                {forecast.update_triggers && forecast.update_triggers.length > 0 && (
                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-3">
                      <Activity className="w-4 h-4 text-cyan-400" />
                      Update Triggers
                    </h4>
                    <ul className="space-y-2">
                      {forecast.update_triggers.slice(0, 3).map((t, i) => (
                        <li key={i} className="text-xs sm:text-sm text-slate-400">
                          <span className="font-medium text-slate-300">{t.event}:</span>{' '}
                          {t.action}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Trading Recommendation */}
              {forecast.action !== 'NO_TRADE' && forecast.action !== 'WAIT' && (
                <div className="p-3 sm:p-4 rounded-lg bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/20">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                        Trading Recommendation
                      </div>
                      <div className="text-base sm:text-lg font-semibold text-emerald-400">
                        {forecast.action.replace('_', ' ')}
                        {forecast.suggested_size && (
                          <span className="text-slate-400 font-normal"> ({forecast.suggested_size} size)</span>
                        )}
                      </div>
                    </div>
                    {forecast.best_platform && (
                      <div className="text-right">
                        <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                          Best Platform
                        </div>
                        <div className="font-medium text-slate-200 capitalize">{forecast.best_platform}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
    // Auto-refresh every minute
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const categories = ['all', 'politics', 'crypto', 'economics', 'sports', 'science', 'technology', 'world'];

  return (
    <div className="min-h-screen bg-[#020617] pb-24 pt-20">
      <Header />

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Hero Section */}
        <motion.div
          className="text-center mb-8 sm:mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-4 sm:mb-6">
            <Zap className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-medium text-purple-400">Autonomous AI Forecaster</span>
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-100 mb-3 sm:mb-4 tracking-tight">
            Oracle
          </h1>

          {/* Description */}
          <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto leading-relaxed">
            BeRight's autonomous superforecaster. Discovers markets, generates predictions,
            and tracks calibration to prove our forecasting credibility.
          </p>

          {/* Live indicator */}
          <div className="flex items-center justify-center gap-2 mt-4 text-sm text-slate-500">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Runs every minute</span>
          </div>
        </motion.div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
            <StatCard
              icon={BarChart3}
              label="Total Forecasts"
              value={stats.totalPredictions}
              iconColor="text-purple-400"
              delay={0.1}
            />
            <StatCard
              icon={Target}
              label="Brier Score"
              value={stats.brierScore !== null ? stats.brierScore.toFixed(3) : 'N/A'}
              subValue={stats.brierScore !== null && stats.brierScore <= 0.15 ? 'Superforecaster' : undefined}
              iconColor="text-emerald-400"
              valueColor={getBrierColor(stats.brierScore)}
              delay={0.15}
            />
            <StatCard
              icon={TrendingUp}
              label="Accuracy"
              value={`${stats.accuracy.toFixed(0)}%`}
              iconColor="text-cyan-400"
              delay={0.2}
            />
            <StatCard
              icon={Shield}
              label="Calibration"
              value={stats.calibrationRating.replace(' (Superforecaster)', '')}
              iconColor="text-amber-400"
              valueColor={getBrierColor(stats.brierScore)}
              delay={0.25}
            />
          </div>
        )}

        {/* Filters */}
        <motion.div
          className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {/* Status Filter */}
          <div className="flex rounded-lg overflow-hidden border border-slate-800 bg-slate-900/50">
            {(['active', 'resolved', 'all'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2.5 text-sm font-medium capitalize transition-all duration-200 cursor-pointer ${
                  filter === status
                    ? 'bg-emerald-500 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2.5 rounded-lg bg-slate-900/50 border border-slate-800 text-sm text-slate-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'all' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>

          {/* Refresh Button */}
          <button
            onClick={fetchData}
            disabled={loading}
            className="ml-auto p-2.5 rounded-lg bg-slate-900/50 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Refresh forecasts"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </motion.div>

        {/* Forecasts List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 sm:py-24">
            <RefreshCw className="w-8 h-8 animate-spin text-purple-400 mb-4" />
            <p className="text-slate-400">Loading forecasts...</p>
          </div>
        ) : forecasts.length === 0 ? (
          <motion.div
            className="text-center py-16 sm:py-24 rounded-xl border border-slate-800/50 bg-slate-900/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Brain className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-slate-600 mb-4" />
            <h3 className="text-lg sm:text-xl font-semibold text-slate-200 mb-2">No Forecasts Yet</h3>
            <p className="text-sm sm:text-base text-slate-400 max-w-sm mx-auto">
              Oracle runs every minute to discover and forecast trending markets.
              Check back soon!
            </p>
          </motion.div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {forecasts.map((forecast, index) => (
              <ForecastCard
                key={forecast.id}
                forecast={forecast}
                expanded={expandedId === forecast.id}
                onToggle={() => setExpandedId(expandedId === forecast.id ? null : forecast.id)}
                index={index}
              />
            ))}
          </div>
        )}

        {/* CTA Section */}
        <motion.div
          className="mt-12 sm:mt-16 text-center rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/90 to-slate-900/50 p-6 sm:p-10 backdrop-blur-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          {/* Decorative glow */}
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-emerald-500/5 via-purple-500/5 to-cyan-500/5 rounded-2xl blur-xl" />

          <div className="inline-flex p-3 rounded-xl bg-emerald-500/10 mb-4">
            <Target className="w-8 h-8 text-emerald-400" />
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-slate-100 mb-3">
            Think You Can Beat Oracle?
          </h2>
          <p className="text-sm sm:text-base text-slate-400 max-w-lg mx-auto mb-6">
            Join BeRight's decentralized forecaster network. Stake your reputation,
            compete for capital delegation, and earn from your predictions.
          </p>
          <Link
            href="/calibration"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold hover:opacity-90 transition-opacity cursor-pointer"
          >
            Join as Forecaster
            <ArrowRight className="w-5 h-5" />
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
