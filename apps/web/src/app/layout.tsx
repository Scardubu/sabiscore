import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { ToastProvider } from "./toast-provider";
import { ConsentProvider } from "../components/consent-banner";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { ClientEffects } from "./client-effects";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://sabiscore.com");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Sabiscore - AI-Powered Football Analytics",
    template: "%s | Sabiscore",
  },
  description:
    "Phase 8 football intelligence platform. Walk-forward validated ensemble with 86 ML features across 5 leagues + UCL. Edge quality scoring, CLV, and fractional Kelly staking.",
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
    description: "Phase 8 ensemble trained on 10.7k+ matches. 86 walk-forward validated features. Edge quality scored, CLV-ready, RPS ≤ 0.21.",
    siteName: "Sabiscore",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sabiscore - AI-Powered Football Analytics",
    description: "Phase 8 ensemble trained on 10.7k+ matches. 86 walk-forward validated features. Edge quality scored, CLV-ready, RPS ≤ 0.21.",
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

export const preferredRegion = "auto";

// Opt out of static generation: this app serves live sports data and all
// pages must reflect current state on every request.
export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* flagcdn serves country flags rendered inside CachedLogo on every page. */}
        <link rel="preconnect" href="https://flagcdn.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://flagcdn.com" />
      </head>
      <body className="bg-slate-950 text-slate-100 antialiased min-h-screen font-sans">
        <ErrorBoundary>
          <Providers>
            <ClientEffects />
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
