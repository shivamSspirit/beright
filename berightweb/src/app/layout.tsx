import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "BeRight - Human vs AI Predictions",
  description: "Swipe to predict. Compete against AI. Build your forecaster reputation.",
  keywords: ["predictions", "forecasting", "AI", "prediction markets", "Kalshi", "Polymarket"],
  authors: [{ name: "BeRight" }],
  openGraph: {
    title: "BeRight - Human vs AI Predictions",
    description: "Can you beat the AI at forecasting?",
    type: "website",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 1200,
        alt: "BeRight Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BeRight - Human vs AI Predictions",
    description: "Can you beat the AI at forecasting?",
    images: ["/og-image.jpg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
