import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { ToastProvider } from "./toast-provider";
import { ConsentProvider } from "../components/consent-banner";
import { ErrorBoundary } from "../components/ErrorBoundary";

const inter = Inter({ 
  subsets: ["latin"], 
  variable: "--font-inter", 
  display: "swap",
  fallback: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  title: {
    default: "Sabiscore - AI-Powered Football Analytics",
    template: "%s | Sabiscore",
  },
  description:
    "Advanced football betting insights & predictions powered by machine learning. 73.7% accuracy, +18.4% ROI, +₦60 avg CLV.",
  keywords: [
    "football predictions",
    "betting analytics",
    "value betting",
    "xG analysis",
    "football statistics",
    "sports betting AI",
  ],
  authors: [{ name: "Sabiscore Team" }],
  creator: "Sabiscore",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://sabiscore.com",
    title: "Sabiscore - AI-Powered Football Analytics",
    description: "73.7% prediction accuracy, +18.4% ROI, +₦60 avg CLV vs Pinnacle",
    siteName: "Sabiscore",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sabiscore - AI-Powered Football Analytics",
    description: "73.7% prediction accuracy, +18.4% ROI, +₦60 avg CLV vs Pinnacle",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Preconnect to external resources */}
        <link rel="preconnect" href="https://api.football-data.org" />
        <link rel="preconnect" href="https://raw.githubusercontent.com" />
        <link rel="dns-prefetch" href="https://api.football-data.org" />
        <link rel="dns-prefetch" href="https://raw.githubusercontent.com" />
      </head>
      <body className={`${inter.className} bg-slate-950 text-slate-100 antialiased min-h-screen`}>
        <ErrorBoundary>
          <Providers>
            <ToastProvider />
            <ConsentProvider requireConsent={true}>
              {children}
            </ConsentProvider>
          </Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
