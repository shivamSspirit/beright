import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'BeRight Capital — Tokenized Prediction Theses',
  description: 'Explore, create, and fund transparent devnet thesis vaults combining prediction strategies with modeled USDC yield.',
};

export default function CapitalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
