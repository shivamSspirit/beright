import type { Metadata } from 'next';
import CapitalPortfolio from './CapitalPortfolio';

export const metadata: Metadata = {
  title: 'Capital Portfolio — BeRight',
  description: 'Track devnet thesis shares, program NAV value, P&L, and redemption requests.',
};

export default function CapitalPortfolioPage() {
  return <CapitalPortfolio />;
}
