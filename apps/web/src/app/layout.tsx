import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { ToastProvider } from "./toast-provider";
import { ConsentProvider } from "../components/consent-banner";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { ModelWarmup } from "../components/model-warmup";
import { BackendWarmup } from "../components/backend-warmup";

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
    "Advanced football betting insights & predictions powered by 6-model ML ensemble. 52.8% accuracy (professional-grade for 3-way), +234% value bet ROI.",
  keywords: [
    "football predictions",
    "betting analytics",
    "value betting",
    "xG analysis",
    "football statistics",
    "sports betting AI",
    "machine learning predictions",
    "ensemble model",
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
    description: "6-model ML ensemble trained on 10.7k matches. 52.8% 3-way accuracy, +234% value bet ROI.",
    siteName: "Sabiscore",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sabiscore - AI-Powered Football Analytics",
    description: "6-model ML ensemble trained on 10.7k matches. 52.8% 3-way accuracy, +234% value bet ROI.",
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

// Use Node.js runtime for root layout to avoid Edge Function size limits
// Individual API routes can opt-in to Edge runtime as needed
export const runtime = 'nodejs';

// Enable progressive enhancement with auto region selection
export const preferredRegion = 'auto';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Preconnect to external resources for faster API calls */}
        <link rel="preconnect" href="https://api.football-data.org" />
        <link rel="preconnect" href="https://raw.githubusercontent.com" />
        <link rel="dns-prefetch" href="https://api.football-data.org" />
        <link rel="dns-prefetch" href="https://raw.githubusercontent.com" />
        {/* Icon is loaded on-demand, no preload needed */}
      </head>
      <body className={`${inter.className} bg-slate-950 text-slate-100 antialiased min-h-screen`}>
        <ErrorBoundary>
          <Providers>
            <ModelWarmup />
            <BackendWarmup />
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
