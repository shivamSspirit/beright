import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'BeRight Agent API',
  description: 'BeRight Protocol - Agent Gateway API',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
