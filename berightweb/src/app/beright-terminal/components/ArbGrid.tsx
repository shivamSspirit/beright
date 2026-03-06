'use client';

import { motion } from 'framer-motion';
import { ApiArbitrage } from '@/lib/api';
import styles from '../terminal.module.css';

interface ArbGridProps {
  opportunities: ApiArbitrage[];
}

/**
 * ArbGrid - Arbitrage opportunity cards
 *
 * Displays cross-platform arbitrage opportunities.
 */
export default function ArbGrid({ opportunities }: ArbGridProps) {
  if (opportunities.length === 0) {
    return (
      <div className={styles.noData}>
        <span className={styles.noDataIcon}>⚖</span>
        <span>No arbitrage opportunities detected</span>
        <span className={styles.noDataSub}>Minimum spread threshold: 3%</span>
      </div>
    );
  }

  return (
    <div className={styles.arbGrid}>
      {opportunities.map((arb, i) => (
        <motion.div
          key={i}
          className={styles.arbCard}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.05 }}
        >
          <div className={styles.arbHeader}>
            <span className={styles.arbSpread}>+{arb.spread.toFixed(1)}%</span>
            <span className={`${styles.arbConf} ${
              arb.confidence > 0.8 ? styles.arbConfHigh :
              arb.confidence > 0.5 ? styles.arbConfMed : styles.arbConfLow
            }`}>
              {(arb.confidence * 100).toFixed(0)}% CONF
            </span>
          </div>
          <h4 className={styles.arbTopic}>{arb.topic}</h4>
          <div className={styles.arbCompare}>
            <div className={styles.arbSide}>
              <span className={styles.arbPlatform}>{arb.platformA.toUpperCase()}</span>
              <span className={styles.arbPrice}>{(arb.priceA * 100).toFixed(0)}¢</span>
            </div>
            <span className={styles.arbVs}>VS</span>
            <div className={styles.arbSide}>
              <span className={styles.arbPlatform}>{arb.platformB.toUpperCase()}</span>
              <span className={styles.arbPrice}>{(arb.priceB * 100).toFixed(0)}¢</span>
            </div>
          </div>
          <p className={styles.arbStrategy}>{arb.strategy}</p>
        </motion.div>
      ))}
    </div>
  );
}
