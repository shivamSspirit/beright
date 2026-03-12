'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { formatCurrency, formatPercent } from './types';
import styles from '../terminal.module.css';

interface RiskData {
  status: {
    tradingAllowed: boolean;
    exposure: {
      current: number;
      limit: number;
      utilizationPct: number;
    };
    dailyStatus: {
      currentLoss: number;
      remainingLossAllowance: number;
    };
    alerts: {
      unacknowledged: number;
      critical: number;
    };
  };
  config: {
    maxPositionSize: number;
    maxTotalExposure: number;
    maxDailyLoss: number;
    maxDrawdownPct: number;
    kellyFraction: number;
    minEdgeForTrade: number;
    minConfidenceForTrade: number;
  };
}

interface Alert {
  id: string;
  type: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  timestamp: string;
  acknowledged: boolean;
  data?: Record<string, unknown>;
}

// Use relative path - Next.js rewrites will proxy to backend
const BACKEND_URL = '';

/**
 * RiskPanel - Bloomberg-style risk management display
 *
 * Shows exposure limits, daily P&L status, and risk alerts.
 */
export default function RiskPanel() {
  const [riskData, setRiskData] = useState<RiskData | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRiskData = useCallback(async () => {
    try {
      setIsLoading(true);

      const [riskResponse, alertsResponse] = await Promise.all([
        fetch(`${BACKEND_URL}/api/v2/risk`),
        fetch(`${BACKEND_URL}/api/v2/portfolio/alerts?limit=10`),
      ]);

      const riskResult = await riskResponse.json();
      const alertsResult = await alertsResponse.json();

      if (riskResult.success) {
        setRiskData(riskResult.data);
      }

      if (alertsResult.success) {
        setAlerts(alertsResult.data.alerts || []);
      }

      setError(null);
    } catch (err) {
      setError('Failed to connect to backend');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const acknowledgeAlert = useCallback(async (alertId: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/v2/portfolio/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId }),
      });

      if (response.ok) {
        setAlerts(prev => prev.filter(a => a.id !== alertId));
      }
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  }, []);

  useEffect(() => {
    fetchRiskData();
    const interval = setInterval(fetchRiskData, 30000);
    return () => clearInterval(interval);
  }, [fetchRiskData]);

  const getRiskBarClass = (utilization: number) => {
    if (utilization >= 90) return styles.riskBarDanger;
    if (utilization >= 70) return styles.riskBarWarning;
    return styles.riskBarSafe;
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'RISK_LIMIT_WARNING': return '⚠';
      case 'POSITION_STOP_LOSS': return '🛑';
      case 'DAILY_LOSS_LIMIT': return '📉';
      case 'DRAWDOWN_WARNING': return '📊';
      case 'MARKET_CLOSING_SOON': return '⏰';
      default: return '◈';
    }
  };

  if (isLoading && !riskData) {
    return (
      <div className={styles.riskPanel}>
        <div className={styles.panelHeaderBar}>
          <span className={styles.panelIcon}>⚠</span>
          <span className={styles.panelTitle}>RISK_MANAGEMENT</span>
        </div>
        <div className={styles.noData}>
          <span className={styles.noDataIcon}>◉</span>
          <span>Loading risk data...</span>
        </div>
      </div>
    );
  }

  if (error || !riskData) {
    return (
      <div className={styles.riskPanel}>
        <div className={styles.panelHeaderBar}>
          <span className={styles.panelIcon}>⚠</span>
          <span className={styles.panelTitle}>RISK_MANAGEMENT</span>
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
    <div className={styles.riskPanel}>
      <div className={styles.panelHeaderBar}>
        <span className={styles.panelIcon}>⚠</span>
        <span className={styles.panelTitle}>RISK_MANAGEMENT</span>
        <span className={`${styles.panelStatus} ${
          riskData.status.tradingAllowed ? styles.panelStatusOnline : ''
        }`} style={{ color: riskData.status.tradingAllowed ? 'var(--nx-green)' : 'var(--nx-red)' }}>
          {riskData.status.tradingAllowed ? 'TRADING ENABLED' : 'TRADING BLOCKED'}
        </span>
        <button className={styles.refreshBtn} onClick={fetchRiskData} disabled={isLoading}>
          {isLoading ? '↻...' : '↻'}
        </button>
      </div>

      {/* Exposure Indicator */}
      <motion.div
        className={styles.riskIndicator}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <span className={styles.riskLabel}>EXPOSURE</span>
        <div className={styles.riskBar}>
          <div
            className={`${styles.riskBarFill} ${getRiskBarClass(riskData.status.exposure.utilizationPct)}`}
            style={{ width: `${Math.min(riskData.status.exposure.utilizationPct, 100)}%` }}
          />
        </div>
        <span className={styles.riskValue} style={{
          color: riskData.status.exposure.utilizationPct >= 90 ? 'var(--nx-red)' :
                 riskData.status.exposure.utilizationPct >= 70 ? 'var(--nx-amber)' : 'var(--nx-green)'
        }}>
          {formatPercent(riskData.status.exposure.utilizationPct / 100)}
        </span>
      </motion.div>

      {/* Daily Loss Indicator */}
      <motion.div
        className={styles.riskIndicator}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.05 }}
      >
        <span className={styles.riskLabel}>DAILY P&L</span>
        <div className={styles.riskBar}>
          <div
            className={`${styles.riskBarFill} ${
              riskData.status.dailyStatus.currentLoss > 0 ? styles.riskBarDanger : styles.riskBarSafe
            }`}
            style={{
              width: `${Math.min(
                Math.abs(riskData.status.dailyStatus.currentLoss) /
                  (riskData.config.maxDailyLoss || 100) * 100,
                100
              )}%`
            }}
          />
        </div>
        <span className={styles.riskValue} style={{
          color: riskData.status.dailyStatus.currentLoss > 0 ? 'var(--nx-red)' : 'var(--nx-green)'
        }}>
          {riskData.status.dailyStatus.currentLoss > 0 ? '-' : '+'}
          {formatCurrency(Math.abs(riskData.status.dailyStatus.currentLoss))}
        </span>
      </motion.div>

      {/* Risk Config Summary */}
      <div className={styles.portfolioGrid} style={{ borderTop: '1px solid var(--nx-border)', paddingTop: '8px' }}>
        <div className={styles.portfolioMetric}>
          <span className={styles.portfolioMetricLabel}>Max Position</span>
          <span className={styles.portfolioMetricValue}>
            {formatCurrency(riskData.config.maxPositionSize)}
          </span>
        </div>
        <div className={styles.portfolioMetric}>
          <span className={styles.portfolioMetricLabel}>Max Daily Loss</span>
          <span className={styles.portfolioMetricValue}>
            {formatCurrency(riskData.config.maxDailyLoss)}
          </span>
        </div>
        <div className={styles.portfolioMetric}>
          <span className={styles.portfolioMetricLabel}>Kelly Fraction</span>
          <span className={styles.portfolioMetricValue}>
            {formatPercent(riskData.config.kellyFraction)}
          </span>
        </div>
        <div className={styles.portfolioMetric}>
          <span className={styles.portfolioMetricLabel}>Min Edge</span>
          <span className={styles.portfolioMetricValue}>
            {formatPercent(riskData.config.minEdgeForTrade)}
          </span>
        </div>
      </div>

      {/* Alerts Section */}
      <div className={styles.panelHeader} style={{ borderTop: '1px solid var(--nx-border)' }}>
        <span className={styles.panelTitle}>ALERTS</span>
        <span className={styles.panelCount} style={{
          color: riskData.status.alerts.critical > 0 ? 'var(--nx-red)' : undefined
        }}>
          {alerts.length} ACTIVE
        </span>
      </div>

      <div className={styles.alertsList}>
        {alerts.length === 0 ? (
          <div className={styles.noData} style={{ padding: '20px' }}>
            <span style={{ fontSize: '24px', opacity: 0.3 }}>✓</span>
            <span>No active alerts</span>
          </div>
        ) : (
          alerts.map((alert, i) => (
            <motion.div
              key={alert.id}
              className={`${styles.alertItem} ${
                alert.priority === 'critical' ? styles.alertPriorityCritical :
                alert.priority === 'high' ? styles.alertPriorityHigh :
                styles.alertPriorityMedium
              }`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <span className={styles.alertIcon}>{getAlertIcon(alert.type)}</span>
              <div className={styles.alertContent}>
                <div className={styles.alertMessage}>{alert.message}</div>
                <div className={styles.alertMeta}>
                  {alert.priority.toUpperCase()} • {new Date(alert.timestamp).toLocaleTimeString()}
                </div>
              </div>
              <button
                className={styles.hintChip}
                onClick={() => acknowledgeAlert(alert.id)}
                style={{ fontSize: '8px' }}
              >
                ACK
              </button>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
