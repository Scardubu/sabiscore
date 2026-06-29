import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { BookOpen, Gauge, ShieldCheck, Trophy } from "lucide-react";
import "./globals.css";
import { Providers } from "./providers";
import { ToastProvider } from "./toast-provider";
import { ConsentProvider } from "../components/consent-banner";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { ClientEffects } from "./client-effects";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://sabiscore.vercel.app");

const LEAGUES = [
  ["Premier League", "EPL"],
  ["La Liga", "LA_LIGA"],
  ["Bundesliga", "BUNDESLIGA"],
  ["Serie A", "SERIE_A"],
  ["Ligue 1", "LIGUE_1"],
  ["Eredivisie", "EREDIVISIE"],
  ["Champions League", "UCL"],
] as const;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "SabiScore — Football Betting Intelligence", template: "%s | SabiScore" },
  description: "Evidence-first football probabilities, market value analysis, and responsible staking guidance.",
  authors: [{ name: "SabiScore" }],
  creator: "SabiScore",
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }] },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: "#07110f", width: "device-width", initialScale: 1 };
export const preferredRegion = "auto";
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-[#07110f] text-slate-100 antialiased">
        <a href="#main-content" className="sr-only z-[100] rounded-md bg-white px-4 py-2 font-bold text-slate-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
        <ErrorBoundary>
          <Providers>
            <ClientEffects />
            <ToastProvider />
            <ConsentProvider requireConsent>
              <div className="min-h-screen lg:grid lg:grid-cols-[250px_minmax(0,1fr)]">
                <aside className="hidden border-r border-white/10 bg-[#0b1714] lg:block">
                  <div className="sticky top-0 flex h-screen flex-col">
                    <Brand className="border-b border-white/10 px-5 py-5" />
                    <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="League navigation">
                      <p className="px-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Competitions</p>
                      <div className="mt-3 space-y-1">
                        {LEAGUES.map(([label, code]) => (
                          <Link key={code} href={`/intelligence?league=${code}`} className="flex min-h-11 items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-300 transition hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300">
                            <span className="flex items-center gap-2"><Trophy className="h-4 w-4 text-emerald-300" aria-hidden="true" />{label}</span>
                            <span className="text-[10px] font-bold text-slate-600">{code}</span>
                          </Link>
                        ))}
                      </div>
                    </nav>
                    <div className="border-t border-white/10 p-4">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-200"><ShieldCheck className="h-4 w-4" aria-hidden="true" />Fail-closed</div>
                        <p className="mt-2 text-xs leading-5 text-slate-400">Missing evidence produces a pass state, never a fabricated estimate.</p>
                      </div>
                    </div>
                  </div>
                </aside>

                <div className="min-w-0">
                  <header className="sticky top-0 z-40 border-b border-white/10 bg-[#07110f]/90 backdrop-blur-xl">
                    <div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
                      <Brand className="lg:hidden" />
                      <div className="hidden lg:block">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Production workspace</p>
                        <p className="mt-1 text-sm font-semibold text-slate-200">Verified evidence → calibrated probability → verdict</p>
                      </div>
                      <nav className="flex items-center gap-2" aria-label="Primary navigation">
                        <Link href="/intelligence" className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-bold text-slate-300 hover:bg-white/5 hover:text-white">Intelligence</Link>
                        <Link href="/docs" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm font-bold text-slate-300 hover:border-white/20 hover:text-white"><BookOpen className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">Methodology</span></Link>
                      </nav>
                    </div>
                    <nav className="flex gap-2 overflow-x-auto border-t border-white/[0.06] px-4 py-2 lg:hidden" aria-label="Mobile league navigation">
                      {LEAGUES.map(([label, code]) => <Link key={code} href={`/intelligence?league=${code}`} className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-white/10 px-3 text-xs font-bold text-slate-300">{label}</Link>)}
                    </nav>
                  </header>
                  <main id="main-content" className="min-h-[calc(100vh-4rem)] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
                  <footer className="border-t border-white/10 px-4 py-8 text-xs leading-5 text-slate-500 sm:px-6 lg:px-8">
                    <p>Staking suggestions are illustrative. Never stake more than you can afford to lose.</p>
                    <p className="mt-1">SabiScore provides statistical decision support, not guaranteed outcomes.</p>
                  </footer>
                </div>
              </div>
            </ConsentProvider>
          </Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}

function Brand({ className = "" }: { className?: string }) {
  return (
    <div className={className}>
      <Link href="/" className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-300 text-slate-950"><Gauge className="h-5 w-5" aria-hidden="true" /></span>
        <span><span className="block font-black tracking-tight text-white">SabiScore</span><span className="block text-[11px] text-slate-500">Betting intelligence</span></span>
      </Link>
    </div>
  );
}
