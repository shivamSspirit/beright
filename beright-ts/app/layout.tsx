import './globals.css';
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Navbar } from '@/components/layout/Navbar';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { PrivyProvider, WalletProvider } from '@/components/wallet';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'BeRight - Prediction Market Intelligence',
    template: '%s | BeRight',
  },
  description: 'AI-powered prediction market intelligence. Real-time arbitrage, on-chain calibration, and forecaster rankings.',
  keywords: ['prediction markets', 'forecasting', 'polymarket', 'kalshi', 'AI trading'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-gray-950 text-gray-100 antialiased">
        <PrivyProvider>
          <WalletProvider>
            <ErrorBoundary>
              <Navbar />
              <main className="min-h-screen">{children}</main>
            </ErrorBoundary>
          </WalletProvider>
        </PrivyProvider>
      </body>
    </html>
  );
}
