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
 * No mock data - shows real portfolio values or placeholder state
 */
export default function PortfolioSidebar({
  signals = [],
  portfolioValue,
  dailyChange,
  dailyChangePercent,
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

    // No signals yet - return empty state
    return [];
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

  const hasPortfolioData = portfolioValue !== undefined;
  const isPositive = (dailyChange ?? 0) >= 0;

  return (
    <>
      {/* Portfolio Value Block */}
      <div className={styles.pnlBlock}>
        <div className={styles.pnlLabel}>TOTAL PORTFOLIO VALUE (USD)</div>
        <div className={styles.pnlValue}>
          {hasPortfolioData ? formatCurrency(portfolioValue) : '--'}
        </div>
        {hasPortfolioData && dailyChange !== undefined ? (
          <div className={`${styles.pnlChange} ${!isPositive ? styles.pnlChangeNegative : ''}`}>
            <span>{isPositive ? '▲' : '▼'} {formatChange(dailyChange)}</span>
            <span className={styles.pnlPercent}>({(dailyChangePercent ?? 0).toFixed(2)}%) Today</span>
          </div>
        ) : (
          <div className={styles.pnlChange}>
            <span style={{ opacity: 0.5 }}>Connect wallet to view</span>
          </div>
        )}
      </div>

      {/* Signal Feed Header */}
      <div className={styles.panelHeader} style={{ marginTop: 'auto' }}>
        <span className={styles.panelLabel}>LIVE SIGNAL FEED</span>
      </div>

      {/* Signal Feed */}
      <div className={styles.signalFeed}>
        {displaySignals.length > 0 ? (
          displaySignals.map((signal, index) => (
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
          ))
        ) : (
          <div className={styles.signalItem} style={{ opacity: 0.5 }}>
            <span className={styles.signalTime}>[--:--:--]</span>
            <span className={styles.signalType}>SYS</span>
            {' '}
            <span className={styles.signalMessage}>Awaiting live signals...</span>
          </div>
        )}
      </div>
    </>
  );
}
