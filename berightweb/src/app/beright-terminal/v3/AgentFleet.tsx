'use client';

import { useMemo } from 'react';
import PulseIndicator from './PulseIndicator';
import styles from '../beright.module.css';

interface Agent {
  id: number;
  name: string;
  role: string;
  status: 'active' | 'idle' | 'alert';
  tasks?: number;
  success?: string;
}

interface RiskMetric {
  label: string;
  value: number;
  color: 'green' | 'cyan' | 'red';
}

interface AgentFleetProps {
  onlineAgents?: string[];
}

/**
 * AgentFleet - Left panel showing agent status and risk exposure
 */
export default function AgentFleet({ onlineAgents = ['SCOUT', 'ANALYST', 'TRADER'] }: AgentFleetProps) {
  const agents: Agent[] = useMemo(() => [
    {
      id: 1,
      name: 'Oracle-X',
      role: 'Scout',
      status: onlineAgents.includes('SCOUT') ? 'active' : 'idle',
    },
    {
      id: 2,
      name: 'Quant-Delta',
      role: 'Analyst',
      status: onlineAgents.includes('ANALYST') ? 'active' : 'idle',
    },
    {
      id: 3,
      name: 'Executioner',
      role: 'Trader',
      status: onlineAgents.includes('TRADER') ? 'active' : 'idle',
    },
  ], [onlineAgents]);

  const riskMetrics: RiskMetric[] = [
    { label: 'Market Exposure', value: 68, color: 'cyan' },
    { label: 'Position Risk', value: 42, color: 'green' },
  ];

  const activeCount = agents.filter(a => a.status === 'active').length;

  return (
    <>
      {/* Agent Fleet Header */}
      <div className={styles.panelHeader}>
        <span className={styles.panelLabel}>AGENT FLEET STATUS</span>
        <span className={styles.panelBadge}>{activeCount} ACTIVE</span>
      </div>

      {/* Agent List */}
      <ul className={styles.agentList}>
        {agents.map(agent => (
          <li key={agent.id} className={styles.agentItem}>
            <span className={styles.agentCircle}>{agent.id}</span>
            <div className={styles.agentInfo}>
              <span className={styles.agentName}>{agent.name}</span>
              <span className={styles.agentRole}>{agent.role}</span>
            </div>
            <PulseIndicator state={agent.status} />
          </li>
        ))}
      </ul>

      {/* Risk Exposure Section */}
      <div className={styles.riskSection}>
        <div className={styles.panelHeader}>
          <span className={styles.panelLabel}>RISK EXPOSURE</span>
        </div>

        {riskMetrics.map((metric, i) => (
          <div key={i} className={styles.riskItem}>
            <div className={styles.riskLabels}>
              <span className={styles.riskLabel}>{metric.label}</span>
              <span className={`${styles.riskValue} ${
                metric.color === 'green' ? styles.riskValueGreen :
                metric.color === 'cyan' ? styles.riskValueCyan :
                styles.riskValueRed
              }`}>
                {metric.value}%
              </span>
            </div>
            <div className={styles.riskBarBg}>
              <div
                className={`${styles.riskBarFill} ${
                  metric.color === 'green' ? styles.riskBarGreen :
                  metric.color === 'cyan' ? styles.riskBarCyan :
                  styles.riskBarRed
                }`}
                style={{ width: `${metric.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
