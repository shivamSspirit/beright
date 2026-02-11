'use client';

import { motion } from 'framer-motion';
import { Bot, Users, TrendingUp, AlertCircle, CheckCircle2, HelpCircle } from 'lucide-react';

interface ConsensusData {
  question: string;
  marketAvg: number;
  aiPrediction: number;
  topForecasters: number;
  sources: {
    platform: string;
    prediction: number;
    weight: number;
  }[];
}

interface ConsensusViewProps {
  data: ConsensusData;
  showDetails?: boolean;
}

function getConfidenceLevel(spread: number): {
  level: 'high' | 'medium' | 'low';
  label: string;
  color: string;
  icon: typeof CheckCircle2;
} {
  if (spread <= 10) {
    return {
      level: 'high',
      label: 'High Confidence',
      color: 'text-green-400',
      icon: CheckCircle2,
    };
  } else if (spread <= 20) {
    return {
      level: 'medium',
      label: 'Moderate Confidence',
      color: 'text-yellow-400',
      icon: HelpCircle,
    };
  } else {
    return {
      level: 'low',
      label: 'Low Confidence',
      color: 'text-red-400',
      icon: AlertCircle,
    };
  }
}

function ConsensusBar({
  label,
  value,
  icon: Icon,
  color,
  delay = 0,
}: {
  label: string;
  value: number;
  icon: typeof Bot;
  color: string;
  delay?: number;
}) {
  return (
    <motion.div
      className="flex items-center gap-3"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
        <Icon size={16} />
      </div>
      <div className="flex-1">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-[var(--text-muted)]">{label}</span>
          <span className="text-sm font-bold mono">{value}%</span>
        </div>
        <div className="h-2 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${
              color.includes('purple')
                ? 'bg-purple-500'
                : color.includes('blue')
                ? 'bg-blue-500'
                : 'bg-amber-500'
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${value}%` }}
            transition={{ delay: delay + 0.2, duration: 0.5 }}
          />
        </div>
      </div>
    </motion.div>
  );
}

export default function ConsensusView({ data, showDetails = true }: ConsensusViewProps) {
  // Calculate consensus (weighted average)
  const consensus = Math.round(
    data.marketAvg * 0.4 + data.aiPrediction * 0.35 + data.topForecasters * 0.25
  );

  // Calculate spread (how much sources disagree)
  const values = [data.marketAvg, data.aiPrediction, data.topForecasters];
  const spread = Math.max(...values) - Math.min(...values);
  const confidence = getConfidenceLevel(spread);
  const ConfidenceIcon = confidence.icon;

  // Determine if AI is bullish or bearish vs market
  const aiVsMarket = data.aiPrediction - data.marketAvg;
  const aiSentiment =
    aiVsMarket > 5 ? 'Bullish' : aiVsMarket < -5 ? 'Bearish' : 'Aligned';

  return (
    <div className="glass-card p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold mb-1">BeRight Consensus</h3>
          <p className="text-xs text-[var(--text-muted)] line-clamp-2">
            {data.question}
          </p>
        </div>
        <div className="text-right">
          <motion.div
            className="text-3xl font-bold mono text-[var(--yes-primary)]"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
          >
            {consensus}%
          </motion.div>
          <div className={`text-xs flex items-center gap-1 justify-end ${confidence.color}`}>
            <ConfidenceIcon size={12} />
            {confidence.label}
          </div>
        </div>
      </div>

      {/* Consensus Bars */}
      <div className="space-y-4 mb-4">
        <ConsensusBar
          label="Market Average"
          value={data.marketAvg}
          icon={TrendingUp}
          color="bg-blue-500/20 text-blue-400"
          delay={0}
        />
        <ConsensusBar
          label="BeRight AI"
          value={data.aiPrediction}
          icon={Bot}
          color="bg-purple-500/20 text-purple-400"
          delay={0.1}
        />
        <ConsensusBar
          label="Top Forecasters"
          value={data.topForecasters}
          icon={Users}
          color="bg-amber-500/20 text-amber-400"
          delay={0.2}
        />
      </div>

      {/* AI Insight */}
      <motion.div
        className={`p-3 rounded-xl border ${
          aiVsMarket > 5
            ? 'bg-green-500/10 border-green-500/20'
            : aiVsMarket < -5
            ? 'bg-red-500/10 border-red-500/20'
            : 'bg-[var(--bg-secondary)] border-[var(--border-subtle)]'
        }`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center gap-2 mb-1">
          <Bot size={14} className="text-[var(--ai-primary)]" />
          <span className="text-xs font-semibold">AI Insight</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
              aiVsMarket > 5
                ? 'bg-green-500/20 text-green-400'
                : aiVsMarket < -5
                ? 'bg-red-500/20 text-red-400'
                : 'bg-[var(--bg-card)] text-[var(--text-muted)]'
            }`}
          >
            {aiSentiment} vs Market
          </span>
        </div>
        <p className="text-xs text-[var(--text-secondary)]">
          {aiVsMarket > 5
            ? `AI is ${Math.abs(aiVsMarket)}% more bullish than the market average.`
            : aiVsMarket < -5
            ? `AI is ${Math.abs(aiVsMarket)}% more bearish than the market average.`
            : 'AI prediction aligns with market consensus.'}
        </p>
      </motion.div>

      {/* Platform Breakdown */}
      {showDetails && data.sources.length > 0 && (
        <motion.div
          className="mt-4 pt-4 border-t border-[var(--border-subtle)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <div className="text-xs text-[var(--text-muted)] mb-2">Platform Breakdown</div>
          <div className="flex flex-wrap gap-2">
            {data.sources.map((source) => (
              <div
                key={source.platform}
                className="px-2 py-1 rounded-lg bg-[var(--bg-secondary)] text-xs"
              >
                <span className="text-[var(--text-muted)]">{source.platform}:</span>{' '}
                <span className="font-medium mono">{source.prediction}%</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

// Helper to generate consensus data from a prediction
export function generateConsensusData(
  question: string,
  marketOdds: number,
  platform: string
): ConsensusData {
  // Simulate slight variations for AI and forecasters
  const variance1 = (Math.random() - 0.5) * 15;
  const variance2 = (Math.random() - 0.5) * 10;

  const aiPrediction = Math.max(5, Math.min(95, Math.round(marketOdds + variance1)));
  const topForecasters = Math.max(5, Math.min(95, Math.round(marketOdds + variance2)));

  return {
    question,
    marketAvg: marketOdds,
    aiPrediction,
    topForecasters,
    sources: [
      { platform, prediction: marketOdds, weight: 0.5 },
      { platform: 'Manifold', prediction: Math.round(marketOdds + (Math.random() - 0.5) * 10), weight: 0.25 },
      { platform: 'Metaculus', prediction: Math.round(marketOdds + (Math.random() - 0.5) * 8), weight: 0.25 },
    ],
  };
}
