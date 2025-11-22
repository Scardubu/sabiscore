import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "./providers";
import { ToastProvider } from "./toast-provider";

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
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
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
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <Providers>
          {children}
        </Providers>
        <ToastProvider />
      </body>
    </html>
  );
}
