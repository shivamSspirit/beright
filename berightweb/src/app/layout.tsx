import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";
import PageLoader from "@/components/PageLoader";
import BottomNav from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "BeRight — Get funded to trade prediction markets on Solana",
  description: "A Solana-based public fund that allocates USDC capital to proven prediction-market forecasters.",
  keywords: ["predictions", "forecasting", "prediction markets", "Kalshi", "Polymarket", "Solana", "USDC", "VScore"],
  authors: [{ name: "BeRight" }],
  openGraph: {
    title: "BeRight — Get funded to trade prediction markets on Solana",
    description: "A Solana-based public fund that allocates USDC capital to proven prediction-market forecasters.",
    type: "website",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 1200,
        alt: "BeRight - Public fund for prediction market forecasters",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BeRight — Get funded to trade prediction markets on Solana",
    description: "A Solana-based public fund that allocates USDC capital to proven prediction-market forecasters.",
    images: ["/og-image.jpg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#050508",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <PageLoader />
        <Providers>
          {children}
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
