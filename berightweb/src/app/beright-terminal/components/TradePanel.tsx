'use client';

import { useState } from 'react';
import { TrendingUp, TrendingDown, AlertCircle, Check, Loader2 } from 'lucide-react';
import styles from './TradePanel.module.css';

interface TradePanelProps {
  selectedMarket?: {
    id: string;
    question: string;
    yesPrice: number;
    noPrice: number;
    platform: string;
  };
  onTrade?: (trade: TradeOrder) => Promise<void>;
}

interface TradeOrder {
  marketId: string;
  side: 'YES' | 'NO';
  amount: number;
  price: number;
  platform: string;
}

export default function TradePanel({ selectedMarket, onTrade }: TradePanelProps) {
  const [side, setSide] = useState<'YES' | 'NO'>('YES');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const price = side === 'YES' ? selectedMarket?.yesPrice : selectedMarket?.noPrice;
  const potentialPayout = amount && price ? (parseFloat(amount) / price).toFixed(2) : '0.00';
  const potentialProfit = amount && price ? ((parseFloat(amount) / price) - parseFloat(amount)).toFixed(2) : '0.00';

  const handleSubmit = async () => {
    if (!selectedMarket || !amount || !price) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      if (onTrade) {
        await onTrade({
          marketId: selectedMarket.id,
          side,
          amount: parseFloat(amount),
          price,
          platform: selectedMarket.platform,
        });
      }
      setSuccess(true);
      setAmount('');
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Trade failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!selectedMarket) {
    return (
      <div className={`${styles.tradePanel} ${styles.empty}`}>
        <div className={styles.emptyState}>
          <TrendingUp size={32} className={styles.emptyIcon} />
          <p>Select a market to trade</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.tradePanel}>
      <div className={styles.panelHeader}>
        <h3>Trade</h3>
        <span className={styles.platformBadge}>{selectedMarket.platform}</span>
      </div>

      <div className={styles.marketInfo}>
        <p className={styles.marketQuestion}>{selectedMarket.question}</p>
      </div>

      <div className={styles.sideSelector}>
        <button
          className={`${styles.sideBtn} ${styles.yes} ${side === 'YES' ? styles.active : ''}`}
          onClick={() => setSide('YES')}
        >
          <TrendingUp size={16} />
          YES @ {(selectedMarket.yesPrice * 100).toFixed(0)}¢
        </button>
        <button
          className={`${styles.sideBtn} ${styles.no} ${side === 'NO' ? styles.active : ''}`}
          onClick={() => setSide('NO')}
        >
          <TrendingDown size={16} />
          NO @ {(selectedMarket.noPrice * 100).toFixed(0)}¢
        </button>
      </div>

      <div className={styles.amountInput}>
        <label>Amount (USD)</label>
        <div className={styles.inputWrapper}>
          <span className={styles.currency}>$</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.01"
          />
        </div>
      </div>

      <div className={styles.quickAmounts}>
        {[10, 25, 50, 100].map((val) => (
          <button key={val} onClick={() => setAmount(val.toString())} className={styles.quickBtn}>
            ${val}
          </button>
        ))}
      </div>

      <div className={styles.tradeSummary}>
        <div className={styles.summaryRow}>
          <span>Price</span>
          <span>{price ? `${(price * 100).toFixed(0)}¢` : '-'}</span>
        </div>
        <div className={styles.summaryRow}>
          <span>Potential Payout</span>
          <span className={styles.payout}>${potentialPayout}</span>
        </div>
        <div className={`${styles.summaryRow} ${styles.highlight}`}>
          <span>Potential Profit</span>
          <span className={styles.profit}>+${potentialProfit}</span>
        </div>
      </div>

      {error && (
        <div className={styles.errorMsg}>
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {success && (
        <div className={styles.successMsg}>
          <Check size={14} />
          Trade submitted successfully!
        </div>
      )}

      <button
        className={`${styles.submitBtn} ${side === 'YES' ? styles.yes : styles.no}`}
        onClick={handleSubmit}
        disabled={!amount || isSubmitting}
      >
        {isSubmitting ? (
          <Loader2 size={18} className={styles.spin} />
        ) : (
          <>Buy {side}</>
        )}
      </button>
    </div>
  );
}
