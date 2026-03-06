'use client';

import { MarketTick } from './types';
import styles from '../terminal.module.css';

interface MarketTickerProps {
  markets: MarketTick[];
}

/**
 * MarketTicker - Scrolling price ticker
 *
 * Displays real-time market prices in a scrolling ticker format.
 */
export default function MarketTicker({ markets }: MarketTickerProps) {
  return (
    <div className={styles.tickerContainer}>
      <div className={styles.tickerTrack}>
        {[...markets, ...markets].map((m, i) => (
          <div key={`${m.id}-${i}`} className={styles.tickerItem}>
            <span className={styles.tickerTitle}>{m.title.slice(0, 30)}</span>
            <span className={`${styles.tickerPrice} ${m.change >= 0 ? styles.tickerPriceUp : styles.tickerPriceDown}`}>
              {m.price.toFixed(0)}¢
            </span>
            <span className={`${styles.tickerChange} ${m.change >= 0 ? styles.tickerChangeUp : styles.tickerChangeDown}`}>
              {m.change >= 0 ? '▲' : '▼'}{Math.abs(m.change).toFixed(1)}%
            </span>
            <span className={styles.tickerPlatform}>{m.platform}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
