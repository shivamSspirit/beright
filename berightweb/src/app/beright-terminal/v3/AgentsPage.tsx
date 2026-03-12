'use client';

import styles from '../beright.module.css';

interface Agent {
  id: number;
  name: string;
  role: string;
  status: 'ACTIVE' | 'IDLE';
  tasks: number;
  success: string;
}

interface AgentsPageProps {
  onlineAgents?: string[];
}

/**
 * AgentsPage - Full page agent management view
 */
export default function AgentsPage({ onlineAgents = ['SCOUT', 'ANALYST', 'TRADER'] }: AgentsPageProps) {
  const agents: Agent[] = [
    {
      id: 1,
      name: 'Oracle-X',
      role: 'Scout',
      status: onlineAgents.includes('SCOUT') ? 'ACTIVE' : 'IDLE',
      tasks: 142,
      success: '98.2%',
    },
    {
      id: 2,
      name: 'Quant-Delta',
      role: 'Analyst',
      status: onlineAgents.includes('ANALYST') ? 'ACTIVE' : 'IDLE',
      tasks: 87,
      success: '94.5%',
    },
    {
      id: 3,
      name: 'Executioner',
      role: 'Trader',
      status: onlineAgents.includes('TRADER') ? 'ACTIVE' : 'IDLE',
      tasks: 203,
      success: '91.8%',
    },
  ];

  return (
    <div className={styles.fullPageView}>
      <div className={styles.fullPageHeader}>AGENT MANAGEMENT CONSOLE</div>

      {agents.map(agent => (
        <div key={agent.id} className={styles.agentCard}>
          <div className={styles.agentCardLeft}>
            <span className={styles.agentCircle}>{agent.id}</span>
            <div className={styles.agentCardInfo}>
              <h3>{agent.name}</h3>
              <span>{agent.role}</span>
            </div>
          </div>
          <div className={styles.agentCardRight}>
            <div className={`${styles.agentStatus} ${
              agent.status === 'ACTIVE' ? styles.agentStatusActive : styles.agentStatusIdle
            }`}>
              {agent.status}
            </div>
            <div className={styles.agentStats}>
              Tasks: {agent.tasks} | Success: {agent.success}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
