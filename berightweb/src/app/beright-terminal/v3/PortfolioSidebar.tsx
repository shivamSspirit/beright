'use client';

import { useMemo } from 'react';
import { LiveSignal } from '@/hooks/useSignalStream';
import styles from '../beright.module.css';

interface Signal {
  time: string;
  type: 'EXEC' | 'ANALYSIS' | 'SCOUT' | 'SYS';
  message: string;
  isFirst?: boolean;
}

interface PortfolioSidebarProps {
  signals?: LiveSignal[];
  portfolioValue?: number;
  dailyChange?: number;
  dailyChangePercent?: number;
}

/**
 * PortfolioSidebar - Right panel with PnL display and live signal feed
 */
export default function PortfolioSidebar({
  signals = [],
  portfolioValue = 2408192.50,
  dailyChange = 14204.10,
  dailyChangePercent = 0.59,
}: PortfolioSidebarProps) {
  // Transform API signals to display format
  const displaySignals: Signal[] = useMemo(() => {
    if (signals.length > 0) {
      return signals.slice(0, 8).map((sig, i) => {
        const time = new Date(sig.createdAt).toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });

        // Map signal action to type
        const type: Signal['type'] =
          sig.action === 'ALERT' ? 'EXEC' :
          sig.signalType?.includes('analysis') ? 'ANALYSIS' :
          sig.signalType?.includes('scout') ? 'SCOUT' : 'SYS';

        return {
          time: `[${time}]`,
          type,
          message: sig.marketTitle || sig.reasoning || 'Signal received',
          isFirst: i === 0,
        };
      });
    }

    // Fallback demo signals
    return [
      { time: '[14:02:41]', type: 'EXEC' as const, message: 'Bought 10k shares ETH_ETF_APPROVAL @ 0.91', isFirst: true },
      { time: '[14:02:15]', type: 'ANALYSIS' as const, message: 'Sentiment shift detected on FED statements. Risk model adjusted.', isFirst: false },
      { time: '[13:58:02]', type: 'SCOUT' as const, message: 'Large block sell observed on BTC_100K_EOY. Monitoring.', isFirst: false },
      { time: '[13:45:11]', type: 'EXEC' as const, message: 'Sold 5k shares ELECTION_REP_WIN @ 0.52. Profit secured.', isFirst: false },
      { time: '[13:30:00]', type: 'SYS' as const, message: 'Market data sync complete. Latency stable.', isFirst: false },
    ];
  }, [signals]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatChange = (value: number) => {
    const prefix = value >= 0 ? '+' : '';
    return prefix + formatCurrency(value);
  };

  const getTypeClass = (type: Signal['type']) => {
    switch (type) {
      case 'EXEC': return styles.signalTypeExec;
      case 'ANALYSIS': return styles.signalTypeAnalysis;
      case 'SCOUT': return styles.signalTypeScout;
      case 'SYS': return styles.signalTypeSys;
      default: return '';
    }
  };

  const isPositive = dailyChange >= 0;

  return (
    <>
      {/* Portfolio Value Block */}
      <div className={styles.pnlBlock}>
        <div className={styles.pnlLabel}>TOTAL PORTFOLIO VALUE (USD)</div>
        <div className={styles.pnlValue}>{formatCurrency(portfolioValue)}</div>
        <div className={`${styles.pnlChange} ${!isPositive ? styles.pnlChangeNegative : ''}`}>
          <span>{isPositive ? '▲' : '▼'} {formatChange(dailyChange)}</span>
          <span className={styles.pnlPercent}>({dailyChangePercent.toFixed(2)}%) Today</span>
        </div>
      </div>

      {/* Signal Feed Header */}
      <div className={styles.panelHeader} style={{ marginTop: 'auto' }}>
        <span className={styles.panelLabel}>LIVE SIGNAL FEED</span>
      </div>

      {/* Signal Feed */}
      <div className={styles.signalFeed}>
        {displaySignals.map((signal, index) => (
          <div
            key={index}
            className={signal.isFirst ? styles.signalItemFirst : styles.signalItem}
          >
            <span className={styles.signalTime}>{signal.time}</span>
            <span className={`${styles.signalType} ${getTypeClass(signal.type)}`}>
              {signal.type}
            </span>
            {' '}
            <span className={styles.signalMessage}>{signal.message}</span>
          </div>
        ))}
      </div>
    </>
  );
}
