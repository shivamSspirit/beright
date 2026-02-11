'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bot, TrendingUp, Users, ExternalLink, Loader2 } from 'lucide-react';

interface EmbedWidgetProps {
  marketId?: string;
  question?: string;
  platform?: string;
  showAI?: boolean;
  showConsensus?: boolean;
  theme?: 'dark' | 'light';
  compact?: boolean;
}

interface MarketData {
  id: string;
  question: string;
  platform: string;
  yesPct: number;
  noPct: number;
  volume: number;
  url: string;
  aiPrediction?: number;
  topForecasters?: number;
}

// Standalone embed widget that can be used on external sites
export default function EmbedWidget({
  marketId,
  question,
  platform = 'polymarket',
  showAI = true,
  showConsensus = true,
  theme = 'dark',
  compact = false,
}: EmbedWidgetProps) {
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMarket = async () => {
      try {
        // In production, this would fetch from the BeRight API
        // For now, simulate with mock data
        await new Promise(resolve => setTimeout(resolve, 500));

        setData({
          id: marketId || '1',
          question: question || 'Will Bitcoin hit $150K by end of 2026?',
          platform: platform,
          yesPct: 67,
          noPct: 33,
          volume: 2500000,
          url: `https://polymarket.com/event/${marketId || 'btc-150k'}`,
          aiPrediction: showAI ? 72 : undefined,
          topForecasters: showConsensus ? 65 : undefined,
        });
      } catch (err) {
        setError('Failed to load market');
      } finally {
        setLoading(false);
      }
    };

    fetchMarket();
  }, [marketId, question, platform, showAI, showConsensus]);

  const isDark = theme === 'dark';
  const bgClass = isDark ? 'bg-[#0a0a0f]' : 'bg-white';
  const borderClass = isDark ? 'border-[#1a1a2e]' : 'border-gray-200';
  const textClass = isDark ? 'text-white' : 'text-gray-900';
  const mutedClass = isDark ? 'text-gray-400' : 'text-gray-500';

  if (loading) {
    return (
      <div className={`${bgClass} ${borderClass} border rounded-xl p-4 flex items-center justify-center`}>
        <Loader2 size={24} className="animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={`${bgClass} ${borderClass} border rounded-xl p-4 text-center ${mutedClass}`}>
        {error || 'Unable to load market'}
      </div>
    );
  }

  // Calculate consensus if AI and forecasters are available
  const consensus = data.aiPrediction && data.topForecasters
    ? Math.round((data.yesPct + data.aiPrediction + data.topForecasters) / 3)
    : data.yesPct;

  if (compact) {
    return (
      <motion.a
        href={data.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`${bgClass} ${borderClass} border rounded-xl p-3 flex items-center gap-3 hover:border-blue-500/50 transition-colors no-underline`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="flex-1 min-w-0">
          <div className={`text-xs ${mutedClass} mb-1`}>{data.platform}</div>
          <div className={`text-sm font-medium ${textClass} truncate`}>{data.question}</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-blue-500">{consensus}%</div>
          <div className={`text-[10px] ${mutedClass}`}>YES</div>
        </div>
        <ExternalLink size={14} className={mutedClass} />
      </motion.a>
    );
  }

  return (
    <motion.div
      className={`${bgClass} ${borderClass} border rounded-xl overflow-hidden`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Header */}
      <div className={`px-4 py-3 border-b ${borderClass} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-purple-500/20 flex items-center justify-center">
            <span className="text-xs">🟣</span>
          </div>
          <span className={`text-xs font-medium ${mutedClass}`}>{data.platform}</span>
        </div>
        <a
          href="https://beright.xyz"
          target="_blank"
          rel="noopener noreferrer"
          className={`text-[10px] ${mutedClass} hover:text-blue-500 transition-colors no-underline`}
        >
          Powered by BeRight
        </a>
      </div>

      {/* Question */}
      <div className="p-4">
        <h3 className={`text-sm font-medium ${textClass} mb-4`}>{data.question}</h3>

        {/* Main Odds Display */}
        <div className="flex justify-between items-end mb-4">
          <div>
            <div className="text-3xl font-bold text-blue-500">{consensus}%</div>
            <div className={`text-xs ${mutedClass}`}>BeRight Consensus</div>
          </div>
          <div className="text-right">
            <div className={`text-lg font-bold ${textClass}`}>
              ${(data.volume / 1000000).toFixed(1)}M
            </div>
            <div className={`text-xs ${mutedClass}`}>volume</div>
          </div>
        </div>

        {/* Odds Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-blue-500 font-medium">YES {data.yesPct}%</span>
            <span className="text-red-500 font-medium">NO {data.noPct}%</span>
          </div>
          <div className={`h-2 rounded-full ${isDark ? 'bg-gray-800' : 'bg-gray-100'} overflow-hidden flex`}>
            <div
              className="h-full bg-blue-500"
              style={{ width: `${data.yesPct}%` }}
            />
            <div
              className="h-full bg-red-500"
              style={{ width: `${data.noPct}%` }}
            />
          </div>
        </div>

        {/* Consensus Breakdown */}
        {showConsensus && (data.aiPrediction || data.topForecasters) && (
          <div className={`p-3 rounded-lg ${isDark ? 'bg-[#111118]' : 'bg-gray-50'} space-y-2`}>
            <div className="flex items-center justify-between">
              <span className={`flex items-center gap-2 text-xs ${mutedClass}`}>
                <TrendingUp size={12} className="text-blue-400" />
                Market
              </span>
              <span className={`text-sm font-bold ${textClass}`}>{data.yesPct}%</span>
            </div>
            {data.aiPrediction && (
              <div className="flex items-center justify-between">
                <span className={`flex items-center gap-2 text-xs ${mutedClass}`}>
                  <Bot size={12} className="text-purple-400" />
                  BeRight AI
                </span>
                <span className="text-sm font-bold text-purple-400">{data.aiPrediction}%</span>
              </div>
            )}
            {data.topForecasters && (
              <div className="flex items-center justify-between">
                <span className={`flex items-center gap-2 text-xs ${mutedClass}`}>
                  <Users size={12} className="text-amber-400" />
                  Top Forecasters
                </span>
                <span className={`text-sm font-bold ${textClass}`}>{data.topForecasters}%</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer CTA */}
      <a
        href={data.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`block px-4 py-3 border-t ${borderClass} text-center text-sm font-medium text-blue-500 hover:bg-blue-500/10 transition-colors no-underline`}
      >
        Trade on {data.platform} →
      </a>
    </motion.div>
  );
}

// Export embed code generator
export function generateEmbedCode(options: {
  marketId: string;
  theme?: 'dark' | 'light';
  showAI?: boolean;
  compact?: boolean;
}): string {
  const params = new URLSearchParams();
  params.set('id', options.marketId);
  if (options.theme) params.set('theme', options.theme);
  if (options.showAI !== undefined) params.set('ai', String(options.showAI));
  if (options.compact) params.set('compact', 'true');

  return `<iframe
  src="https://beright.xyz/embed?${params.toString()}"
  width="400"
  height="${options.compact ? '80' : '320'}"
  frameborder="0"
  style="border-radius: 12px; max-width: 100%;"
></iframe>`;
}
