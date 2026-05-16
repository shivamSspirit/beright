'use client';

import { useState, useEffect } from 'react';
import { Star, Plus, X, TrendingUp, TrendingDown, Eye } from 'lucide-react';
import styles from './Watchlist.module.css';

interface WatchlistItem {
  id: string;
  question: string;
  platform: string;
  yesPrice: number;
  change24h: number;
  addedAt: Date;
}

interface WatchlistProps {
  onSelectMarket?: (marketId: string) => void;
}

export default function Watchlist({ onSelectMarket }: WatchlistProps) {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load from localStorage
    const stored = localStorage.getItem('beright-watchlist');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setItems(parsed.map((item: any) => ({
          ...item,
          addedAt: new Date(item.addedAt),
        })));
      } catch (e) {
        console.error('Failed to parse watchlist:', e);
      }
    }
    setIsLoading(false);

    // Demo items if empty
    if (!stored) {
      const demoItems: WatchlistItem[] = [
        {
          id: 'btc-100k-mar',
          question: 'Bitcoin above $100k by March 31?',
          platform: 'Polymarket',
          yesPrice: 0.68,
          change24h: 2.5,
          addedAt: new Date(),
        },
        {
          id: 'eth-etf-apr',
          question: 'Ethereum ETF approved by April?',
          platform: 'Kalshi',
          yesPrice: 0.42,
          change24h: -1.2,
          addedAt: new Date(),
        },
        {
          id: 'sol-200-q1',
          question: 'Solana above $200 end of Q1?',
          platform: 'Polymarket',
          yesPrice: 0.55,
          change24h: 5.8,
          addedAt: new Date(),
        },
      ];
      setItems(demoItems);
      localStorage.setItem('beright-watchlist', JSON.stringify(demoItems));
    }
  }, []);

  const removeItem = (id: string) => {
    const updated = items.filter(item => item.id !== id);
    setItems(updated);
    localStorage.setItem('beright-watchlist', JSON.stringify(updated));
  };

  const handleSelect = (id: string) => {
    if (onSelectMarket) {
      onSelectMarket(id);
    }
  };

  if (isLoading) {
    return (
      <div className={`${styles.watchlist} ${styles.loading}`}>
        <div className={styles.loader} />
      </div>
    );
  }

  return (
    <div className={styles.watchlist}>
      <div className={styles.panelHeader}>
        <div className={styles.headerLeft}>
          <Star size={14} className={styles.starIcon} />
          <h3>Watchlist</h3>
        </div>
        <span className={styles.count}>{items.length} markets</span>
      </div>

      {items.length === 0 ? (
        <div className={styles.emptyState}>
          <Eye size={24} className={styles.emptyIcon} />
          <p>No markets in watchlist</p>
          <span>Click the star icon on any market to add it</span>
        </div>
      ) : (
        <div className={styles.watchlistItems}>
          {items.map((item) => (
            <div key={item.id} className={styles.watchlistItem} onClick={() => handleSelect(item.id)}>
              <div className={styles.itemMain}>
                <span className={styles.platformTag}>{item.platform}</span>
                <p className={styles.itemQuestion}>{item.question}</p>
              </div>
              <div className={styles.itemData}>
                <div className={styles.priceCol}>
                  <span className={styles.price}>{(item.yesPrice * 100).toFixed(0)}¢</span>
                  <span className={`${styles.change} ${item.change24h >= 0 ? styles.up : styles.down}`}>
                    {item.change24h >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {Math.abs(item.change24h).toFixed(1)}%
                  </span>
                </div>
                <button className={styles.removeBtn} onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}>
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button className={styles.addBtn}>
        <Plus size={14} />
        Add Market
      </button>
    </div>
  );
}
