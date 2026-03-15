'use client';

import { cn, getGradeColor } from '@/lib/ui-utils';

interface Stat {
  label: string;
  value: string | number;
  subValue?: string;
  highlight?: boolean;
}

interface StatsGridProps {
  stats: Stat[];
  columns?: 2 | 3 | 4;
  className?: string;
}

export function StatsGrid({ stats, columns = 2, className }: StatsGridProps) {
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
  };

  return (
    <div className={cn('grid gap-4', gridCols[columns], className)}>
      {stats.map((stat, index) => (
        <div
          key={index}
          className={cn(
            'p-4 bg-gray-800/50 rounded-lg border border-gray-700',
            stat.highlight && 'border-green-700/50 bg-green-900/20'
          )}
        >
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
            {stat.label}
          </p>
          <p className="text-xl font-bold text-white">{stat.value}</p>
          {stat.subValue && (
            <p className="text-xs text-gray-500 mt-1">{stat.subValue}</p>
          )}
        </div>
      ))}
    </div>
  );
}

interface ForecasterStatsProps {
  brierScore: number;
  accuracy: number;
  streak: number;
  totalPredictions: number;
  resolvedPredictions: number;
  grade: string;
  className?: string;
}

export function ForecasterStats({
  brierScore,
  accuracy,
  streak,
  totalPredictions,
  resolvedPredictions,
  grade,
  className,
}: ForecasterStatsProps) {
  const stats: Stat[] = [
    {
      label: 'Brier Score',
      value: brierScore.toFixed(3),
      subValue: 'Lower is better',
      highlight: brierScore < 0.2,
    },
    {
      label: 'Accuracy',
      value: `${(accuracy * 100).toFixed(1)}%`,
    },
    {
      label: 'Grade',
      value: grade,
    },
    {
      label: 'Win Streak',
      value: streak,
    },
    {
      label: 'Resolved',
      value: resolvedPredictions,
      subValue: `of ${totalPredictions} total`,
    },
    {
      label: 'Pending',
      value: totalPredictions - resolvedPredictions,
    },
  ];

  return <StatsGrid stats={stats} columns={3} className={className} />;
}
