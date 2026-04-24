'use client';

import styles from '../beright.module.css';

export type TabName = 'BERIGHT' | 'MARKETS' | 'AGENTS' | 'LOGS';

interface NavPillProps {
  activeTab: TabName;
  onTabChange: (tab: TabName) => void;
}

/**
 * NavPill - Pill-style navigation with inverted active state
 */
export default function NavPill({ activeTab, onTabChange }: NavPillProps) {
  const tabs: TabName[] = ['BERIGHT', 'MARKETS', 'AGENTS', 'LOGS'];
  const labels: Record<TabName, string> = {
    BERIGHT: 'RESEARCH',
    MARKETS: 'OPPS',
    AGENTS: 'TRADERS',
    LOGS: 'JOURNAL',
  };

  return (
    <nav className={styles.navPill}>
      {tabs.map(tab => (
        <button
          key={tab}
          className={`${styles.navItem} ${activeTab === tab ? styles.navItemActive : ''}`}
          onClick={() => onTabChange(tab)}
        >
          {labels[tab]}
        </button>
      ))}
    </nav>
  );
}
