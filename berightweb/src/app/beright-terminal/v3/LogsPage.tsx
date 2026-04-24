'use client';

import { useMemo } from 'react';
import { LiveSignal } from '@/hooks/useSignalStream';
import { AgentLog } from '../components/types';
import styles from '../beright.module.css';

interface PortfolioAlert {
  id: string;
  type: string;
  priority: string;
  title?: string;
  message: string;
  createdAt: string;
}

interface LogsPageProps {
  logs?: AgentLog[];
  signals?: LiveSignal[];
  alerts?: PortfolioAlert[];
}

interface JournalEntry {
  id: string;
  time: string;
  sortAt: number;
  source: string;
  headline: string;
  detail: string;
  actionability: 'live' | 'watch' | 'stale';
  risk: 'low' | 'medium' | 'high';
}

export default function LogsPage({ logs = [], signals = [], alerts = [] }: LogsPageProps) {
  const journal = useMemo<JournalEntry[]>(() => {
    const signalEntries = signals.map((signal) => {
      const ageMinutes = getAgeMinutes(signal.createdAt);
      return {
        id: signal.id,
        time: formatTime(signal.createdAt),
        sortAt: new Date(signal.createdAt).getTime(),
        source: `signal:${signal.signalType}`,
        headline: signal.marketTitle || signal.alertText || 'Signal triggered',
        detail: signal.reasoning || `${signal.action} on ${signal.platform}`,
        actionability: getActionability(ageMinutes, signal.confidence),
        risk: getSignalRisk(signal),
      } satisfies JournalEntry;
    });

    const alertEntries = alerts.map((alert) => ({
      id: alert.id,
      time: formatTime(alert.createdAt),
      sortAt: new Date(alert.createdAt).getTime(),
      source: `risk:${alert.priority}`,
      headline: alert.title || alert.type,
      detail: alert.message,
      actionability: alert.priority === 'critical' ? 'live' : 'watch',
      risk: alert.priority === 'critical' ? 'high' : alert.priority === 'high' ? 'medium' : 'low',
    }) satisfies JournalEntry);

    const logEntries = logs.map((log) => ({
      id: log.id,
      time: log.timestamp.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      sortAt: log.timestamp.getTime(),
      source: `agent:${log.agent.toLowerCase()}`,
      headline: log.message,
      detail: `${log.agent} ${log.type}`,
      actionability: log.type === 'error' ? 'live' : 'watch',
      risk: log.type === 'error' ? 'high' : log.type === 'warning' ? 'medium' : 'low',
    }) satisfies JournalEntry);

    return [...signalEntries, ...alertEntries, ...logEntries]
      .sort((a, b) => b.sortAt - a.sortAt)
      .slice(0, 24);
  }, [alerts, logs, signals]);

  const counts = useMemo(() => ({
    live: journal.filter((entry) => entry.actionability === 'live').length,
    watch: journal.filter((entry) => entry.actionability === 'watch').length,
    highRisk: journal.filter((entry) => entry.risk === 'high').length,
  }), [journal]);

  return (
    <div className={styles.fullPageView}>
      <div className={styles.fullPageHeader}>
        <span>ALERT JOURNAL</span>
        <span className={styles.feedMeta}>Truth source: live signals + portfolio alerts + agent runtime</span>
      </div>

      <div className={styles.terminalIntroBlock}>
        <div>
          <div className={styles.terminalIntroEyebrow}>ACTIONABILITY</div>
          <h2 className={styles.terminalIntroTitle}>See what is still tradable, not just what happened.</h2>
        </div>
        <div className={styles.terminalIntroMeta}>
          <span>`live` means recent enough to act on now</span>
          <span>`stale` means useful for review, not for copying</span>
        </div>
      </div>

      <div className={styles.metricStrip}>
        <div className={styles.metricCard}>
          <span className={styles.metricCardLabel}>LIVE</span>
          <strong className={styles.metricCardValue}>{counts.live}</strong>
          <span className={styles.metricCardDetail}>Fresh alerts worth checking now</span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricCardLabel}>WATCH</span>
          <strong className={styles.metricCardValue}>{counts.watch}</strong>
          <span className={styles.metricCardDetail}>Needs confirmation or patience</span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricCardLabel}>HIGH RISK</span>
          <strong className={styles.metricCardValue}>{counts.highRisk}</strong>
          <span className={styles.metricCardDetail}>Resolution, execution, or system risk</span>
        </div>
      </div>

      {journal.length === 0 ? (
        <div className={styles.emptyState}>No alert history yet. Keep the terminal connected to build the journal.</div>
      ) : (
        <div className={styles.journalList}>
          {journal.map((entry) => (
            <article key={entry.id} className={styles.journalCard}>
              <div className={styles.journalTopRow}>
                <span className={styles.journalTime}>{entry.time}</span>
                <span className={styles.journalSource}>{entry.source}</span>
                <span className={`${styles.executionBadge} ${styles[`executionBadge${capitalize(entry.actionability)}`]}`}>
                  {entry.actionability}
                </span>
                <span className={`${styles.executionBadge} ${styles[`journalRisk${capitalize(entry.risk)}`]}`}>
                  {entry.risk} risk
                </span>
              </div>
              <h3 className={styles.journalHeadline}>{entry.headline}</h3>
              <p className={styles.journalDetail}>{entry.detail}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function getActionability(ageMinutes: number, confidence: number): 'live' | 'watch' | 'stale' {
  if (ageMinutes <= 10 && confidence >= 0.8) return 'live';
  if (ageMinutes <= 45) return 'watch';
  return 'stale';
}

function getSignalRisk(signal: LiveSignal): 'low' | 'medium' | 'high' {
  if (signal.confidence < 0.55 || signal.strength < 0.45) return 'high';
  if (signal.confidence < 0.75) return 'medium';
  return 'low';
}

function getAgeMinutes(timestamp: string): number {
  return Math.max(Math.round((Date.now() - new Date(timestamp).getTime()) / 60_000), 0);
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
