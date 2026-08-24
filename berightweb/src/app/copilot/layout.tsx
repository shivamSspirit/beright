import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'BeRight Copilot — Prediction Market Intelligence',
  description: 'Research prediction markets, understand risk, and prepare wallet-confirmed trades from one conversation.',
};

export default function CopilotLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
