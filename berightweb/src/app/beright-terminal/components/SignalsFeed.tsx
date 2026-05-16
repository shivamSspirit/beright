'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';
import { LiveSignal } from '@/hooks/useSignalStream';
import { SIGNAL_ACTION_COLOR, SIGNAL_TYPE_LABEL } from './types';
import styles from '../terminal.module.css';

interface SignalsFeedProps {
  signals: LiveSignal[];
  connected: boolean;
  alertCount: number;
  clearAlerts: () => void;
}

/**
 * SignalsFeed - Live signal intelligence panel
 *
 * Displays real-time market signals from the SSE feed.
 */
export default function SignalsFeed({
  signals,
  connected,
  alertCount,
  clearAlerts
}: SignalsFeedProps) {
  const feedRef = useRef<HTMLDivElement>(null);

  if (signals.length === 0) {
    return (
      <div className={styles.signalsPanel}>
        <div className={styles.panelHeaderBar}>
          <span className={styles.panelIcon}>⚡</span>
          <span className={styles.panelTitle}>SIGNAL_INTELLIGENCE</span>
          <span className={`${styles.signalConnBadge} ${connected ? styles.signalConnBadgeLive : styles.signalConnBadgeOffline}`}>
            {connected ? '● LIVE' : '○ OFFLINE'}
          </span>
        </div>
        <div className={styles.noData}>
          <span className={styles.noDataIcon}>⚡</span>
          <span>{connected ? 'Awaiting first signal...' : 'Connecting to signal feed...'}</span>
          <span className={styles.noDataSub}>Signals are emitted every ~5 minutes from market detectors</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.signalsPanel}>
      <div className={styles.panelHeaderBar}>
        <span className={styles.panelIcon}>⚡</span>
        <span className={styles.panelTitle}>SIGNAL_INTELLIGENCE</span>
        <span className={`${styles.signalConnBadge} ${connected ? styles.signalConnBadgeLive : styles.signalConnBadgeOffline}`}>
          {connected ? '● LIVE' : '○ OFFLINE'}
        </span>
        <span className={styles.panelCount}>{signals.length} SIGNALS</span>
        {alertCount > 0 && (
          <button className={styles.clearAlertsBtn} onClick={clearAlerts}>
            ✗ CLEAR {alertCount}
          </button>
        )}
      </div>

      <div className={styles.signalsFeed} ref={feedRef}>
        {signals.map((sig, i) => (
          <motion.div
            key={sig.id}
            className={`${styles.signalRow} ${
              sig.action === 'ALERT' ? styles.signalRowAlert :
              sig.action === 'WATCH' ? styles.signalRowWatch : ''
            }`}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i < 5 ? i * 0.04 : 0 }}
          >
            {/* Action badge */}
            <div
              className={styles.sigAction}
              style={{
                color: SIGNAL_ACTION_COLOR[sig.action],
                borderColor: SIGNAL_ACTION_COLOR[sig.action]
              }}
            >
              {sig.action}
            </div>

            {/* Type tag */}
            <div className={styles.sigType}>
              {SIGNAL_TYPE_LABEL[sig.signalType] || sig.signalType.toUpperCase()}
            </div>

            {/* Main info */}
            <div className={styles.sigBody}>
              <div className={styles.sigTitle}>{sig.marketTitle}</div>
              {sig.alertText && <div className={styles.sigAlert}>{sig.alertText}</div>}
              {sig.reasoning && <div className={styles.sigReason}>{sig.reasoning}</div>}
            </div>

            {/* Right stats */}
            <div className={styles.sigStats}>
              <div className={styles.sigPlatform}>{sig.platform.toUpperCase()}</div>
              <div className={styles.sigConfidence}>
                <span className={styles.sigConfLabel}>CONF</span>
                <span className={styles.sigConfValue}>{Math.round(sig.confidence * 100)}%</span>
              </div>
              <div className={styles.sigStrengthBar}>
                <div
                  className={styles.sigStrengthFill}
                  style={{
                    width: `${Math.round(sig.strength * 100)}%`,
                    background: sig.strength > 0.7
                      ? SIGNAL_ACTION_COLOR.ALERT
                      : sig.strength > 0.4
                        ? SIGNAL_ACTION_COLOR.WATCH
                        : '#444',
                  }}
                />
              </div>
              <div className={styles.sigTime}>
                {new Date(sig.createdAt).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
