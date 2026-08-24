import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";
import PageLoader from "@/components/PageLoader";
import BottomNav from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "BeRight — Forecast prediction markets",
  description: "Swipe through live prediction markets, compare your view with AI, and build a forecasting track record.",
  keywords: ["predictions", "forecasting", "prediction markets", "Kalshi", "Polymarket", "Solana", "USDC", "VScore"],
  authors: [{ name: "BeRight" }],
  openGraph: {
    title: "BeRight — Forecast prediction markets",
    description: "Swipe through live prediction markets, compare your view with AI, and build a forecasting track record.",
    type: "website",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 1200,
        alt: "BeRight prediction market forecasting",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BeRight — Forecast prediction markets",
    description: "Swipe through live prediction markets, compare your view with AI, and build a forecasting track record.",
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
