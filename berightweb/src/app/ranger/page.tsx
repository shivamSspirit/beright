'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Brain,
  RefreshCw,
  ArrowRight,
  Activity,
  Zap,
  Shield,
  PieChart,
  Percent,
  Target,
  Layers,
  Play,
  Pause,
  Info,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import Header from '@/components/Header';

// =============================================================================
// TYPES (matching /api/ranger response)
// =============================================================================

interface ProtocolRate {
  protocol: string;
  asset: string;
  supplyApy: number;
  tvl: number;
  utilization: number;
  source: string;
  timestamp: number;
}

interface Prediction {
  protocol: string;
  currentRate: number;
  predictedRate: number;
  confidence: number;
  direction: 'up' | 'down' | 'stable';
}

interface Allocation {
  protocol: string;
  currentWeight: number;
  targetWeight: number;
  expectedReturn: number;
  riskScore: number;
  action: 'deposit' | 'withdraw' | 'hold';
}

interface StrategyStats {
  portfolioApy: number;
  portfolioRisk: number;
  sharpeRatio: number;
  alpha: number;
  meetsTarget: boolean;
  targetApy: number;
  totalValueLocked: number;
  lastUpdate: string;
}

interface APIResponse {
  success: boolean;
  data: {
    rates: ProtocolRate[];
    predictions: Prediction[];
    allocations: Allocation[];
    stats: StrategyStats;
  };
}

// =============================================================================
// API FETCH FUNCTION
// =============================================================================

async function fetchRangerData(): Promise<APIResponse | null> {
  try {
    const response = await fetch('/api/ranger');
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch ranger data:', error);
    return null;
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const PROTOCOL_COLORS: Record<string, { bg: string; text: string; border: string; gradient: string }> = {
  Drift: {
    bg: 'bg-blue-500/15',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    gradient: 'from-blue-500/20 to-blue-500/5',
  },
  Kamino: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    gradient: 'from-emerald-500/20 to-emerald-500/5',
  },
  Marginfi: {
    bg: 'bg-purple-500/15',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
    gradient: 'from-purple-500/20 to-purple-500/5',
  },
};

function formatTVL(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
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
// PROTOCOL RATE CARD
// =============================================================================

function ProtocolRateCard({
  rate,
  prediction,
  index,
}: {
  rate: ProtocolRate;
  prediction?: Prediction;
  index: number;
}) {
  const colors = PROTOCOL_COLORS[rate.protocol] || PROTOCOL_COLORS.Marginfi;
  const direction = prediction?.direction || 'stable';
  const TrendIcon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Activity;

  return (
    <motion.div
      className={`relative overflow-hidden rounded-xl border ${colors.border} bg-gradient-to-br ${colors.gradient} p-4 sm:p-5 backdrop-blur-sm`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center`}>
            <span className={`text-lg font-bold ${colors.text}`}>{rate.protocol[0]}</span>
          </div>
          <div>
            <h3 className="font-semibold text-slate-100">{rate.protocol}</h3>
            <p className="text-xs text-slate-500">{rate.asset} Lending</p>
          </div>
        </div>
        <div className={`flex items-center gap-1 px-2 py-1 rounded-md ${colors.bg}`}>
          <TrendIcon className={`w-3.5 h-3.5 ${colors.text}`} />
          <span className={`text-xs font-medium ${colors.text}`}>
            {rate.source}
          </span>
        </div>
      </div>

      {/* APY Display */}
      <div className="mb-4">
        <div className="text-3xl font-bold text-slate-100 tabular-nums">
          {rate.supplyApy.toFixed(2)}%
        </div>
        <div className="text-sm text-slate-500">Current APY</div>
      </div>

      {/* Prediction */}
      {prediction && (
        <div className={`p-3 rounded-lg ${colors.bg} border ${colors.border}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className={`w-4 h-4 ${colors.text}`} />
              <span className="text-xs font-medium text-slate-400">4h Prediction</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-semibold ${colors.text}`}>
                {prediction.predictedRate.toFixed(2)}%
              </span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                prediction.direction === 'up' ? 'bg-emerald-500/20 text-emerald-400' :
                prediction.direction === 'down' ? 'bg-red-500/20 text-red-400' :
                'bg-slate-500/20 text-slate-400'
              }`}>
                {prediction.direction === 'up' ? '↑' : prediction.direction === 'down' ? '↓' : '→'}
              </span>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full ${colors.text.replace('text-', 'bg-')} rounded-full`}
                style={{ width: `${prediction.confidence * 100}%` }}
              />
            </div>
            <span className="text-xs text-slate-500">{(prediction.confidence * 100).toFixed(0)}%</span>
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-slate-500">TVL</div>
          <div className="text-sm font-medium text-slate-300">{formatTVL(rate.tvl)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Utilization</div>
          <div className="text-sm font-medium text-slate-300">{(rate.utilization * 100).toFixed(0)}%</div>
        </div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// ALLOCATION VISUALIZATION
// =============================================================================

function AllocationChart({ allocations }: { allocations: Allocation[] }) {
  const total = allocations.reduce((sum, a) => sum + a.targetWeight, 0);

  return (
    <motion.div
      className="relative overflow-hidden rounded-xl border border-slate-800/50 bg-gradient-to-br from-slate-900/90 to-slate-900/50 p-5 sm:p-6 backdrop-blur-sm"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <PieChart className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100">Target Allocation</h3>
            <p className="text-xs text-slate-500">Optimized by Sharpe ratio</p>
          </div>
        </div>
      </div>

      {/* Pie Chart Visualization */}
      <div className="flex items-center gap-6 mb-6">
        {/* Simple bar representation */}
        <div className="flex-1 h-8 rounded-full overflow-hidden flex">
          {allocations.map((alloc, i) => {
            const colors = PROTOCOL_COLORS[alloc.protocol] || PROTOCOL_COLORS.Marginfi;
            return (
              <motion.div
                key={alloc.protocol}
                className={`h-full ${colors.text.replace('text-', 'bg-')}`}
                initial={{ width: 0 }}
                animate={{ width: `${(alloc.targetWeight / total) * 100}%` }}
                transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
              />
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-3">
        {allocations.map((alloc, index) => {
          const colors = PROTOCOL_COLORS[alloc.protocol] || PROTOCOL_COLORS.Marginfi;
          const diff = alloc.targetWeight - alloc.currentWeight;

          return (
            <motion.div
              key={alloc.protocol}
              className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + index * 0.1 }}
            >
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${colors.text.replace('text-', 'bg-')}`} />
                <span className="font-medium text-slate-200">{alloc.protocol}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-100">
                    {(alloc.targetWeight * 100).toFixed(1)}%
                  </div>
                  <div className={`text-xs ${diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                    {diff > 0 ? '+' : ''}{(diff * 100).toFixed(1)}%
                  </div>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-medium ${
                  alloc.action === 'deposit' ? 'bg-emerald-500/15 text-emerald-400' :
                  alloc.action === 'withdraw' ? 'bg-red-500/15 text-red-400' :
                  'bg-slate-500/15 text-slate-400'
                }`}>
                  {alloc.action}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// =============================================================================
// STRATEGY EXPLAINER - SIMPLIFIED
// =============================================================================

function StrategyExplainer() {
  return (
    <motion.div
      className="relative overflow-hidden rounded-xl border border-slate-800/50 bg-gradient-to-br from-slate-900/90 to-slate-900/50 p-5 sm:p-6 backdrop-blur-sm"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 rounded-lg bg-cyan-500/10">
          <Info className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-100">How It Works</h3>
          <p className="text-xs text-slate-500">Simple 3-step process</p>
        </div>
      </div>

      {/* Visual Flow */}
      <div className="flex items-center justify-between gap-2 mb-5">
        {/* Step 1 */}
        <div className="flex-1 text-center">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-2">
            <BarChart3 className="w-5 h-5 text-blue-400" />
          </div>
          <div className="text-xs font-medium text-slate-200">Fetch Rates</div>
        </div>
        <ArrowRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
        {/* Step 2 */}
        <div className="flex-1 text-center">
          <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-2">
            <Brain className="w-5 h-5 text-purple-400" />
          </div>
          <div className="text-xs font-medium text-slate-200">Predict APY</div>
        </div>
        <ArrowRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
        {/* Step 3 */}
        <div className="flex-1 text-center">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-2">
            <Zap className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-xs font-medium text-slate-200">Optimize</div>
        </div>
      </div>

      {/* Simple Explanation */}
      <div className="space-y-3 text-sm text-slate-400">
        <div className="flex items-start gap-2">
          <span className="text-emerald-400 font-bold">1.</span>
          <span>Get real-time rates from Drift, Kamino, Marginfi</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-purple-400 font-bold">2.</span>
          <span>Predict which protocol will have higher rates soon</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-cyan-400 font-bold">3.</span>
          <span>Put more money where rates are going up</span>
        </div>
      </div>

      {/* Result */}
      <div className="mt-4 p-3 rounded-lg bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-medium text-emerald-400">Target: 10%+ APY</span>
          <span className="text-xs text-slate-500 ml-auto">USDC Lending Only</span>
        </div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function RangerPage() {
  const [rates, setRates] = useState<ProtocolRate[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [stats, setStats] = useState<StrategyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(true); // Start live by default
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch from real API
      const response = await fetchRangerData();

      if (response && response.success) {
        setRates(response.data.rates);
        setPredictions(response.data.predictions);
        setAllocations(response.data.allocations);
        setStats(response.data.stats);
      } else {
        setError('Failed to fetch data');
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Auto-refresh if live mode is enabled
    let interval: NodeJS.Timeout;
    if (isLive) {
      interval = setInterval(fetchData, 30000); // Every 30 seconds
    }
    return () => clearInterval(interval);
  }, [fetchData, isLive]);

  return (
    <div className="min-h-screen bg-[#020617] pb-24 pt-20">
      <Header />

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Hero Section */}
        <motion.div
          className="text-center mb-8 sm:mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/20 mb-4 sm:mb-6">
            <Layers className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-medium text-orange-400">Ranger Build-A-Bear Hackathon</span>
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-100 mb-3 sm:mb-4 tracking-tight">
            Alpha Yield Optimizer
          </h1>

          {/* Description */}
          <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto leading-relaxed">
            Prediction-enhanced USDC yield strategy powered by BeRight's forecasting engine.
            Dynamically allocates across Drift, Kamino, and Marginfi based on rate predictions.
          </p>

          {/* Live Toggle */}
          <div className="flex items-center justify-center gap-4 mt-6">
            <button
              onClick={() => setIsLive(!isLive)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all cursor-pointer ${
                isLive
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-300'
              }`}
            >
              {isLive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span className="text-sm font-medium">{isLive ? 'Live' : 'Paused'}</span>
              {isLive && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              )}
            </button>
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </motion.div>

        {/* Error Message */}
        {error && (
          <motion.div
            className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="text-red-400 text-sm">{error}. Retrying...</p>
          </motion.div>
        )}

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
            <StatCard
              icon={Percent}
              label="Portfolio APY"
              value={`${stats.portfolioApy.toFixed(2)}%`}
              subValue={stats.meetsTarget ? '10%+ target met' : 'Below 10% target'}
              iconColor={stats.meetsTarget ? 'text-emerald-400' : 'text-amber-400'}
              valueColor={stats.meetsTarget ? 'text-emerald-400' : 'text-amber-400'}
              delay={0.1}
            />
            <StatCard
              icon={Target}
              label="Sharpe Ratio"
              value={stats.sharpeRatio.toFixed(2)}
              subValue="Risk-adjusted"
              iconColor="text-purple-400"
              delay={0.15}
            />
            <StatCard
              icon={TrendingUp}
              label="Alpha vs Benchmark"
              value={`${stats.alpha >= 0 ? '+' : ''}${stats.alpha.toFixed(2)}%`}
              subValue="vs equal-weight"
              iconColor="text-cyan-400"
              valueColor="text-cyan-400"
              delay={0.2}
            />
            <StatCard
              icon={Shield}
              label="Risk Score"
              value={`${stats.portfolioRisk.toFixed(1)}/10`}
              subValue="Lower is safer"
              iconColor="text-amber-400"
              delay={0.25}
            />
          </div>
        )}

        {/* Protocol Rates */}
        <motion.div
          className="mb-6 sm:mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-100">Live Protocol Rates</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {rates.map((rate, index) => (
              <ProtocolRateCard
                key={rate.protocol}
                rate={rate}
                prediction={predictions.find((p) => p.protocol === rate.protocol)}
                index={index}
              />
            ))}
          </div>
        </motion.div>

        {/* Two Column Layout */}
        <div className="grid gap-6 lg:grid-cols-2 mb-6 sm:mb-8">
          {/* Allocation Chart */}
          <AllocationChart allocations={allocations} />

          {/* Strategy Explainer */}
          <StrategyExplainer />
        </div>

        {/* CTA Section */}
        <motion.div
          className="text-center rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/90 to-slate-900/50 p-6 sm:p-10 backdrop-blur-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="inline-flex p-3 rounded-xl bg-orange-500/10 mb-4">
            <Zap className="w-8 h-8 text-orange-400" />
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-slate-100 mb-3">
            Built for Ranger Hackathon
          </h2>
          <p className="text-sm sm:text-base text-slate-400 max-w-lg mx-auto mb-6">
            This strategy combines BeRight's prediction engine with Ranger's vault infrastructure
            to create an intelligent yield optimizer that adapts to market conditions.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="https://github.com/anthropics/beright-ranger"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 font-medium hover:bg-slate-700 transition-colors cursor-pointer"
            >
              View Source
              <ExternalLink className="w-4 h-4" />
            </a>
            <Link
              href="/oracle"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold hover:opacity-90 transition-opacity cursor-pointer"
            >
              See Oracle Forecasts
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
