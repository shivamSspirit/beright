'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';
import { PlatformBadge } from './PlatformBadge';
import { PriceChange } from './PriceChange';
import { ProbabilityBar } from './ProbabilityBar';
import { formatUsd } from '@/lib/ui-utils';
import type { Market } from '@/types';

interface MarketCardProps {
  market: Market;
  showProbabilityBar?: boolean;
}

export function MarketCard({ market, showProbabilityBar = true }: MarketCardProps) {
  const probability = market.yesPrice || market.probability || 0.5;
  const change = market.change24h || 0;

  return (
    <Card hover className="h-full">
      <CardContent className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <PlatformBadge platform={market.platform} />
          {change !== 0 && <PriceChange change={change} />}
        </div>

        {/* Title */}
        <h3 className="text-sm text-white font-medium line-clamp-2 leading-tight">
          {market.title || market.question}
        </h3>

        {/* Probability */}
        {showProbabilityBar ? (
          <ProbabilityBar probability={probability} size="sm" />
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">
              {(probability * 100).toFixed(0)}%
            </span>
            <span className="text-xs text-gray-500">YES</span>
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Vol: {formatUsd(market.volume || 0)}</span>
          {market.participants && (
            <span>{market.participants.toLocaleString()} traders</span>
          )}
        </div>

        {/* Link */}
        {market.url && (
          <a
            href={market.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-green-400 hover:text-green-300 transition-colors"
          >
            View on {market.platform}
          </a>
        )}
      </CardContent>
    </Card>
  );
}
