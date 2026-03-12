'use client';

import { ApiMarket } from '@/lib/api';
import MarketTable from './MarketTable';
import styles from '../beright.module.css';

interface MarketsPageProps {
  markets: ApiMarket[];
}

/**
 * MarketsPage - Full page markets view
 */
export default function MarketsPage({ markets }: MarketsPageProps) {
  return (
    <div className={styles.fullPageView}>
      <div className={styles.fullPageHeader}>ALL MARKETS</div>
      <MarketTable markets={markets} />
    </div>
  );
}
