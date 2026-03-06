'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { formatCurrency, formatPercent } from './types';
import styles from '../terminal.module.css';

interface PortfolioData {
  overview: {
    portfolioValue: number;
    totalBalance: number;
    unrealizedPnL: number;
    realizedPnL: number;
    openPositions: number;
  };
  today: {
    pnl: number;
    pnlPct: number;
    tradesExecuted: number;
    winRate: number;
  } | null;
  performance: {
    totalReturn: number;
    totalReturnPct: number;
    sharpeRatio: number;
    winRate: number;
    profitFactor: number;
    maxDrawdownPct: number;
  };
  recentPnL: Array<{
    date: string;
    pnl: number;
    pnlPct: number;
  }>;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

/**
 * PortfolioPanel - Bloomberg-style portfolio overview
 *
 * Displays portfolio metrics, P&L, and performance statistics.
 */
export default function PortfolioPanel() {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPortfolio = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/v2/portfolio`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.error || 'Failed to fetch portfolio');
      }
    } catch (err) {
      setError('Failed to connect to backend');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPortfolio();
    const interval = setInterval(fetchPortfolio, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchPortfolio]);

  if (isLoading && !data) {
    return (
      <div className={styles.portfolioPanel}>
        <div className={styles.panelHeaderBar}>
          <span className={styles.panelIcon}>◉</span>
          <span className={styles.panelTitle}>PORTFOLIO</span>
        </div>
        <div className={styles.noData}>
          <span className={styles.noDataIcon}>◉</span>
          <span>Loading portfolio data...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.portfolioPanel}>
        <div className={styles.panelHeaderBar}>
          <span className={styles.panelIcon}>◉</span>
          <span className={styles.panelTitle}>PORTFOLIO</span>
        </div>
        <div className={styles.noData}>
          <span className={styles.noDataIcon}>⚠</span>
          <span>{error || 'No data available'}</span>
          <span className={styles.noDataSub}>Connect beright-ts backend on port 3001</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.portfolioPanel}>
      <div className={styles.panelHeaderBar}>
        <span className={styles.panelIcon}>◉</span>
        <span className={styles.panelTitle}>PORTFOLIO</span>
        <span className={styles.panelCount}>
          {data.overview.openPositions} POSITIONS
        </span>
        <button className={styles.refreshBtn} onClick={fetchPortfolio} disabled={isLoading}>
          {isLoading ? '↻...' : '↻'}
        </button>
      </div>

      {/* Primary Metrics */}
      <div className={styles.portfolioGrid}>
        <motion.div
          className={styles.portfolioMetric}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span className={styles.portfolioMetricLabel}>Portfolio Value</span>
          <span className={styles.portfolioMetricValue}>
            {formatCurrency(data.overview.portfolioValue)}
          </span>
        </motion.div>

        <motion.div
          className={styles.portfolioMetric}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <span className={styles.portfolioMetricLabel}>Available</span>
          <span className={styles.portfolioMetricValue}>
            {formatCurrency(data.overview.totalBalance)}
          </span>
        </motion.div>

        <motion.div
          className={styles.portfolioMetric}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <span className={styles.portfolioMetricLabel}>Unrealized P&L</span>
          <span className={`${styles.portfolioMetricValue} ${
            data.overview.unrealizedPnL >= 0
              ? styles.portfolioMetricPositive
              : styles.portfolioMetricNegative
          }`}>
            {data.overview.unrealizedPnL >= 0 ? '+' : ''}
            {formatCurrency(data.overview.unrealizedPnL)}
          </span>
        </motion.div>

        <motion.div
          className={styles.portfolioMetric}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <span className={styles.portfolioMetricLabel}>Realized P&L</span>
          <span className={`${styles.portfolioMetricValue} ${
            data.overview.realizedPnL >= 0
              ? styles.portfolioMetricPositive
              : styles.portfolioMetricNegative
          }`}>
            {data.overview.realizedPnL >= 0 ? '+' : ''}
            {formatCurrency(data.overview.realizedPnL)}
          </span>
        </motion.div>
      </div>

      {/* Today's Performance */}
      {data.today && (
        <div className={styles.panelHeader} style={{ borderTop: '1px solid var(--nx-border)' }}>
          <span className={styles.panelTitle}>TODAY</span>
          <span className={`${styles.panelStatus} ${
            data.today.pnl >= 0 ? styles.panelStatusOnline : ''
          }`} style={{ color: data.today.pnl >= 0 ? 'var(--nx-green)' : 'var(--nx-red)' }}>
            {data.today.pnl >= 0 ? '+' : ''}{formatPercent(data.today.pnlPct)}
          </span>
        </div>
      )}

      {data.today && (
        <div className={styles.portfolioGrid}>
          <div className={styles.portfolioMetric}>
            <span className={styles.portfolioMetricLabel}>P&L</span>
            <span className={`${styles.portfolioMetricValue} ${
              data.today.pnl >= 0
                ? styles.portfolioMetricPositive
                : styles.portfolioMetricNegative
            }`}>
              {data.today.pnl >= 0 ? '+' : ''}
              {formatCurrency(data.today.pnl)}
            </span>
          </div>
          <div className={styles.portfolioMetric}>
            <span className={styles.portfolioMetricLabel}>Win Rate</span>
            <span className={styles.portfolioMetricValue}>
              {formatPercent(data.today.winRate)}
            </span>
          </div>
        </div>
      )}

      {/* Performance Metrics */}
      <div className={styles.panelHeader} style={{ borderTop: '1px solid var(--nx-border)' }}>
        <span className={styles.panelTitle}>PERFORMANCE</span>
      </div>
      <div className={styles.portfolioGrid}>
        <div className={styles.portfolioMetric}>
          <span className={styles.portfolioMetricLabel}>Total Return</span>
          <span className={`${styles.portfolioMetricValue} ${
            data.performance.totalReturn >= 0
              ? styles.portfolioMetricPositive
              : styles.portfolioMetricNegative
          }`}>
            {data.performance.totalReturn >= 0 ? '+' : ''}
            {formatPercent(data.performance.totalReturnPct)}
          </span>
        </div>
        <div className={styles.portfolioMetric}>
          <span className={styles.portfolioMetricLabel}>Sharpe Ratio</span>
          <span className={styles.portfolioMetricValue}>
            {data.performance.sharpeRatio.toFixed(2)}
          </span>
        </div>
        <div className={styles.portfolioMetric}>
          <span className={styles.portfolioMetricLabel}>Win Rate</span>
          <span className={styles.portfolioMetricValue}>
            {formatPercent(data.performance.winRate)}
          </span>
        </div>
        <div className={styles.portfolioMetric}>
          <span className={styles.portfolioMetricLabel}>Max Drawdown</span>
          <span className={`${styles.portfolioMetricValue} ${styles.portfolioMetricNegative}`}>
            {formatPercent(data.performance.maxDrawdownPct)}
          </span>
        </div>
      </div>
    </div>
  );
}
