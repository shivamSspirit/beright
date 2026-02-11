import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'BeRight Terminal',
  description: 'Prediction market intelligence terminal — real-time arbitrage, consensus, and whale tracking',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
