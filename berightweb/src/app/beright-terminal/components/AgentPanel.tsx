'use client';

import { useEffect, useRef } from 'react';
import { AgentLog, AGENTS_CONFIG, AGENT_COLORS, formatTime } from './types';
import styles from '../terminal.module.css';

interface AgentPanelProps {
  logs: AgentLog[];
  onlineAgents: string[];
}

/**
 * AgentPanel - Agent network status display
 *
 * Shows connected AI agents and their activity logs.
 */
export default function AgentPanel({ logs, onlineAgents }: AgentPanelProps) {
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Public agents (BUILDER is superadmin only)
  const agentKeys = ['SCOUT', 'ANALYST', 'TRADER'] as const;

  return (
    <div className={styles.agentPanel}>
      <div className={styles.panelHeader}>
        <span className={styles.panelIcon}>◈</span>
        <span className={styles.panelTitle}>AGENT_NETWORK</span>
        <span className={`${styles.panelStatus} ${styles.panelStatusOnline}`}>CONNECTED</span>
      </div>

      <div className={styles.agentGrid}>
        {agentKeys.map(agent => {
          const config = AGENTS_CONFIG[agent];
          const isOnline = onlineAgents.includes(agent);
          return (
            <div
              key={agent}
              className={`${styles.agentNode} ${isOnline ? styles.agentNodeOnline : styles.agentNodeOffline}`}
              style={{ '--agent-color': config.color } as React.CSSProperties}
            >
              <div className={`${styles.nodeIndicator} ${isOnline ? styles.nodeIndicatorOnline : ''}`} />
              <span className={`${styles.nodeName} ${isOnline ? styles.nodeNameOnline : ''}`}>{agent}</span>
              <span className={styles.nodeSpec}>{config.specialization}</span>
              <span className={`${styles.nodeModel} ${isOnline ? styles.nodeModelOnline : ''}`}>
                {config.model.toUpperCase()}
              </span>
              <span className={`${styles.nodeStatus} ${!isOnline ? styles.nodeStatusOffline : ''}`}>
                {isOnline ? 'ACTIVE' : 'DISABLED'}
              </span>
            </div>
          );
        })}
      </div>

      <div className={styles.agentLogs}>
        <div className={styles.logsHeader}>
          <span>▸ ACTIVITY_LOG</span>
          <span className={styles.logCount}>{logs.length}</span>
        </div>
        <div className={styles.logsFeed}>
          {logs.slice(-20).map(log => (
            <div
              key={log.id}
              className={`${styles.logEntry} ${
                log.type === 'error' ? styles.logEntryError :
                log.type === 'success' ? styles.logEntrySuccess :
                log.type === 'warning' ? styles.logEntryWarning : ''
              }`}
            >
              <span className={styles.logTime}>[{formatTime(log.timestamp)}]</span>
              <span
                className={styles.logAgent}
                style={{ color: AGENT_COLORS[log.agent] }}
              >
                [{log.agent}]
              </span>
              <span className={styles.logMessage}>{log.message}</span>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}
