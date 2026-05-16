'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import styles from '../terminal.module.css';

interface BootSequenceProps {
  onComplete: () => void;
}

/**
 * BootSequence - Terminal boot animation
 *
 * Displays the startup sequence when the terminal initializes.
 */
export default function BootSequence({ onComplete }: BootSequenceProps) {
  const [lines, setLines] = useState<string[]>([]);

  const bootLines = [
    '> BERIGHT AI TERMINAL v2.0.0',
    '> Initializing neural network...',
    '> Loading prediction models...',
    '> Connecting to market feeds...',
    '  ├─ Polymarket... [OK]',
    '  ├─ Kalshi....... [OK]',
    '  ├─ DFlow........ [OK]',
    '  └─ Manifold..... [OK]',
    '> Spawning AI agents...',
    '  ├─ SCOUT........ [ONLINE]',
    '  ├─ ANALYST...... [ONLINE]',
    '  └─ TRADER....... [ONLINE]',
    '> Initializing Data Fabric...',
    '  ├─ Market aggregator... [OK]',
    '  └─ Signal engine...... [OK]',
    '> Starting Portfolio Manager...',
    '  ├─ Risk system... [ARMED]',
    '  ├─ P&L tracker... [ACTIVE]',
    '  └─ Kelly sizing.. [READY]',
    '> Connecting signal intelligence feed...',
    '  ├─ Volume Surge detector... [ARMED]',
    '  ├─ Odds Shift detector..... [ARMED]',
    '  ├─ Arb Opportunity......... [ARMED]',
    '  ├─ Smart Money tracker..... [ARMED]',
    '  └─ 7 more detectors........ [ARMED]',
    '> System ready.',
    '',
    '╔═══════════════════════════════════════════════════════════╗',
    '║  BERIGHT AI - PREDICTION MARKET INTELLIGENCE              ║',
    '║  Type /help for commands or ask anything                  ║',
    '╚═══════════════════════════════════════════════════════════╝',
  ];

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < bootLines.length) {
        setLines(prev => [...prev, bootLines[i]]);
        i++;
      } else {
        clearInterval(interval);
        setTimeout(onComplete, 500);
      }
    }, 60);
    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div className={styles.bootSequence}>
      <div className={styles.bootContent}>
        {lines.map((line, i) => (
          <motion.div
            key={i}
            className={styles.bootLine}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {line}
          </motion.div>
        ))}
        <span className={styles.bootCursor}>_</span>
      </div>
    </div>
  );
}
