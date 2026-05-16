'use client';

import { useState, useMemo } from 'react';
import { ApiMarket } from '@/lib/api';
import styles from '../beright.module.css';

interface MarketTableProps {
  markets: ApiMarket[];
}

/**
 * MarketTable - Center panel market data table
 *
 * Displays markets with probability-colored values and hover states.
 */
export default function MarketTable({ markets }: MarketTableProps) {
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  // Transform API markets to display format
  const displayMarkets = useMemo(() => {
    return markets.slice(0, 12).map(m => {
      const prob = m.yesPct;
      const probColor = prob >= 70 ? 'green' : prob >= 40 ? 'cyan' : prob <= 20 ? 'red' : 'neutral';

      // Generate market ID from title
      const marketId = m.title
        .toUpperCase()
        .replace(/[^A-Z0-9\s]/g, '')
        .split(' ')
        .slice(0, 3)
        .join('_')
        .slice(0, 20);

      // Format bid/ask from yes price
      const bid = (m.yesPrice - 0.01).toFixed(2);
      const ask = (m.yesPrice + 0.01).toFixed(2);

      // Format volume
      const vol = m.volume >= 1_000_000
        ? `${(m.volume / 1_000_000).toFixed(1)}M`
        : m.volume >= 1_000
          ? `${Math.round(m.volume / 1_000)}K`
          : `${Math.round(m.volume)}`;

      return {
        id: marketId,
        prob: `${prob.toFixed(1)}%`,
        probColor,
        bid,
        ask,
        vol,
        originalTitle: m.title,
      };
    });
  }, [markets]);

  // Fallback demo data if no markets
  const fallbackMarkets = [
    { id: 'FED_RATE_CUT_JUL', prob: '78.4%', probColor: 'green', bid: '0.78', ask: '0.79', vol: '12.4M' },
    { id: 'ETH_ETF_APPROVAL', prob: '92.1%', probColor: 'cyan', bid: '0.91', ask: '0.93', vol: '45.1M' },
    { id: 'BTC_100K_EOY', prob: '45.0%', probColor: 'neutral', bid: '0.44', ask: '0.46', vol: '8.2M' },
    { id: 'ELECTION_REP_WIN', prob: '51.2%', probColor: 'red', bid: '0.50', ask: '0.52', vol: '104M' },
    { id: 'GPT5_RELEASE_Q3', prob: '63.8%', probColor: 'green', bid: '0.62', ask: '0.65', vol: '3.1M' },
    { id: 'SOL_FLIP_ETH', prob: '08.4%', probColor: 'red', bid: '0.07', ask: '0.09', vol: '1.5M' },
    { id: 'US_RECESSION_2024', prob: '22.1%', probColor: 'cyan', bid: '0.21', ask: '0.23', vol: '9.8M' },
  ];

  const tableData = displayMarkets.length > 0 ? displayMarkets : fallbackMarkets;

  const getProbClass = (color: string) => {
    switch (color) {
      case 'green': return styles.probGreen;
      case 'cyan': return styles.probCyan;
      case 'red': return styles.probRed;
      default: return styles.probNeutral;
    }
  };

  return (
    <table className={styles.marketTable}>
      <thead>
        <tr>
          <th>Market ID</th>
          <th>Probability</th>
          <th>Bid</th>
          <th>Ask</th>
          <th>Vol (24H)</th>
        </tr>
      </thead>
      <tbody>
        {tableData.map((market, index) => (
          <tr
            key={market.id}
            onMouseEnter={() => setHoveredRow(index)}
            onMouseLeave={() => setHoveredRow(null)}
            style={{
              background: hoveredRow === index ? 'rgba(255,255,255,0.02)' : 'transparent'
            }}
          >
            <td>
              <span className={styles.marketId}>{market.id}</span>
            </td>
            <td>
              <span className={`${styles.marketProb} ${getProbClass(market.probColor)}`}>
                {market.prob}
              </span>
            </td>
            <td>{market.bid}</td>
            <td>{market.ask}</td>
            <td className={styles.marketVol}>{market.vol}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
