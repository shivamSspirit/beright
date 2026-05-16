'use client';

import { motion } from 'framer-motion';
import { formatVolume } from './types';
import { ApiMarket } from '@/lib/api';
import styles from '../terminal.module.css';

interface MarketGridProps {
  markets: ApiMarket[];
}

/**
 * MarketGrid - Data table for markets
 *
 * Displays market data in a sortable grid format.
 */
export default function MarketGrid({ markets }: MarketGridProps) {
  return (
    <div className={styles.marketGrid}>
      <div className={styles.gridHeader}>
        <span>MARKET</span>
        <span>YES</span>
        <span>NO</span>
        <span>VOL</span>
        <span>PLATFORM</span>
      </div>
      {markets.map((m, i) => (
        <motion.div
          key={m.id || i}
          className={styles.gridRow}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.03 }}
        >
          <span className={`${styles.cell} ${styles.cellTitle}`}>
            {m.title.slice(0, 40)}{m.title.length > 40 ? '...' : ''}
          </span>
          <span className={`${styles.cell} ${styles.cellYes}`}>{m.yesPct.toFixed(0)}¢</span>
          <span className={`${styles.cell} ${styles.cellNo}`}>{m.noPct.toFixed(0)}¢</span>
          <span className={`${styles.cell} ${styles.cellVol}`}>{formatVolume(m.volume)}</span>
          <span className={`${styles.cell} ${styles.cellPlatform}`}>{m.platform.toUpperCase()}</span>
        </motion.div>
      ))}
    </div>
  );
}
