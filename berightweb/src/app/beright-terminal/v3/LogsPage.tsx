'use client';

import { useMemo } from 'react';
import { AgentLog } from '../components/types';
import styles from '../beright.module.css';

interface LogEntry {
  time: string;
  level: 'INFO' | 'ANALYSIS' | 'WARN' | 'SYS';
  msg: string;
}

interface LogsPageProps {
  logs?: AgentLog[];
}

/**
 * LogsPage - Full page system logs view
 */
export default function LogsPage({ logs = [] }: LogsPageProps) {
  // Transform API logs or use fallback
  const displayLogs: LogEntry[] = useMemo(() => {
    if (logs.length > 0) {
      return logs.slice(-20).map(log => ({
        time: log.timestamp.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        level: log.type === 'error' ? 'WARN' :
               log.type === 'success' ? 'INFO' :
               log.agent === 'ANALYST' ? 'ANALYSIS' : 'SYS',
        msg: log.message,
      }));
    }

    // Fallback demo logs
    return [
      { time: '14:02:41', level: 'INFO' as const, msg: 'Order executed: BUY ETH_ETF_APPROVAL x10000 @ 0.91' },
      { time: '14:02:15', level: 'ANALYSIS' as const, msg: 'Sentiment model updated with new FED statement data' },
      { time: '13:58:02', level: 'WARN' as const, msg: 'Large sell block detected on BTC_100K_EOY - size: 500k' },
      { time: '13:45:11', level: 'INFO' as const, msg: 'Order executed: SELL ELECTION_REP_WIN x5000 @ 0.52' },
      { time: '13:30:00', level: 'SYS' as const, msg: 'Market data synchronization completed successfully' },
      { time: '13:15:22', level: 'INFO' as const, msg: 'Risk model recalibrated - Market Exposure: 68%' },
      { time: '13:00:00', level: 'SYS' as const, msg: 'Session initialized. All agents online.' },
    ];
  }, [logs]);

  const getLevelClass = (level: LogEntry['level']) => {
    switch (level) {
      case 'INFO': return styles.logLevelInfo;
      case 'ANALYSIS': return styles.logLevelAnalysis;
      case 'WARN': return styles.logLevelWarn;
      case 'SYS': return styles.logLevelSys;
      default: return '';
    }
  };

  return (
    <div className={styles.fullPageView}>
      <div className={styles.fullPageHeader}>SYSTEM LOGS</div>

      <div className={styles.logsList}>
        {displayLogs.map((log, i) => (
          <div key={i} className={styles.logRow}>
            <span className={styles.logTime}>{log.time}</span>
            <span className={`${styles.logLevel} ${getLevelClass(log.level)}`}>
              [{log.level}]
            </span>
            <span className={styles.logMessage}>{log.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
