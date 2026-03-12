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

  return (
    <nav className={styles.navPill}>
      {tabs.map(tab => (
        <button
          key={tab}
          className={`${styles.navItem} ${activeTab === tab ? styles.navItemActive : ''}`}
          onClick={() => onTabChange(tab)}
        >
          {tab}
        </button>
      ))}
    </nav>
  );
}
