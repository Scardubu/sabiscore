"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { FeatureFlag, useFeatureFlag } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/match", label: "Matches", detail: "Live ML edge" },
  { href: "/intelligence", label: "Intelligence", detail: "Edge quality + value bets" },
  { href: "/performance", label: "Performance", detail: "Accuracy + value scanner" },
  { href: "/monitoring", label: "Monitoring", detail: "Model health" },
  { href: "/docs", label: "Docs", detail: "Playbooks + API" },
];

const PREMIUM_STATUS_BADGES = [
  { label: "Features", value: "86 Phase 8" },
  { label: "Model", value: "Ensemble P8" },
  { label: "Leagues", value: "5 + UCL" },
];

const PREMIUM_METRICS = [
  { label: "3-way Accuracy", value: "~53%" },
  { label: "Avg Edge", value: "+6–10%" },
];

// ─── Mobile menu button ────────────────────────────────────────────────────────

function HamburgerButton({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={open ? "Close navigation menu" : "Open navigation menu"}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-800/60 text-slate-300 transition hover:border-slate-600 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 md:hidden"
    >
      <svg
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
        aria-hidden
      >
        {open ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M3 12h18M3 18h18" />
        )}
      </svg>
    </button>
  );
}

// ─── Mobile drawer ─────────────────────────────────────────────────────────────

function MobileDrawer({
  open,
  onClose,
  mounted,
}: {
  open: boolean;
  onClose: () => void;
  mounted: boolean;
}) {
  if (!open) return null;
  return (
    <div
      className="absolute inset-x-0 top-full z-40 border-b border-slate-800/60 bg-slate-950/95 px-4 py-4 backdrop-blur-xl md:hidden"
      role="navigation"
      aria-label="Mobile navigation"
    >
      <ul className="space-y-1">
        {NAV_LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              onClick={onClose}
              className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800/60 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <span>{link.label}</span>
              <span className="text-[11px] text-slate-600">{link.detail}</span>
            </Link>
          </li>
        ))}
        <li>
          <a
            href="https://github.com/Scardubu/sabiscore"
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800/60 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            <span>GitHub</span>
            <svg
              className="h-3.5 w-3.5 text-slate-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        </li>
      </ul>
      <div className="mt-3 border-t border-slate-800/40 pt-3 flex items-center gap-2 px-3">
        <span
          className={cn("h-2 w-2 rounded-full", mounted ? "bg-green-500" : "bg-slate-600", "motion-safe:animate-pulse")}
          aria-hidden
        />
        <span className="text-xs text-slate-500">{mounted ? "Live data" : "Connecting…"}</span>
      </div>
    </div>
  );
}

// ─── Legacy (standard) header ─────────────────────────────────────────────────

function LegacyHeader() {
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  const toggleMenu = useCallback(() => setMenuOpen((v) => !v), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  // Close on Escape
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closeMenu(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [menuOpen, closeMenu]);

  const navLinkClass =
    "rounded text-sm font-medium text-slate-300 hover:text-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-xl">
      <div className="container mx-auto px-4">
        <div className="relative flex h-16 items-center justify-between">
          {/* Logo */}
          <Link
            href="/"
            aria-label="Sabiscore home"
            className="flex items-center space-x-2 group rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500/20 blur-xl group-hover:bg-indigo-500/30 transition-colors" aria-hidden />
              <span className="relative text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Sabiscore
              </span>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav aria-label="Primary" className="hidden items-center space-x-6 md:flex">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className={navLinkClass}>
                {link.label}
              </Link>
            ))}
            <a
              href="https://github.com/Scardubu/sabiscore"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Sabiscore source code on GitHub (opens in a new tab)"
              className={navLinkClass}
            >
              GitHub
            </a>

            <div className="pl-4 border-l border-slate-800">
              <div
                role="status"
                aria-label={mounted ? "Live data feed connected" : "Loading data feed"}
                className="flex items-center space-x-2 text-xs"
              >
                <span
                  aria-hidden
                  className={cn(
                    "h-2 w-2 rounded-full motion-safe:animate-pulse",
                    mounted ? "bg-green-500" : "bg-slate-600",
                  )}
                />
                <span className="text-slate-400">{mounted ? "Live" : "Loading"}</span>
              </div>
            </div>
          </nav>

          {/* Mobile menu button */}
          <HamburgerButton open={menuOpen} onToggle={toggleMenu} />
        </div>
      </div>

      {/* Mobile drawer */}
      <MobileDrawer open={menuOpen} onClose={closeMenu} mounted={mounted} />
    </header>
  );
}

// ─── Premium header ────────────────────────────────────────────────────────────

function PremiumHeader() {
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const labsPreviewEnabled = useFeatureFlag(FeatureFlag.PREDICTION_INTERSTITIAL_V2, false);

  useEffect(() => { setMounted(true); }, []);
  const toggleMenu = useCallback(() => setMenuOpen((v) => !v), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closeMenu(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [menuOpen, closeMenu]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-slate-950/80 shadow-[0_15px_45px_rgba(8,14,35,0.7)] backdrop-blur-2xl">
      <div className="container mx-auto px-4">
        <div className="relative flex flex-wrap items-center justify-between gap-4 py-4">
          {/* Logo */}
          <Link href="/" className="group flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 rounded-lg">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-cyan-500/20 blur-2xl transition-opacity group-hover:opacity-80" aria-hidden />
              <span className="relative text-2xl font-black tracking-tight text-white">Sabiscore</span>
            </div>
            <div className="flex flex-col text-[11px] font-medium uppercase tracking-widest text-slate-400">
              <span>AI Football Intelligence</span>
              <span className="text-[10px] text-slate-500">Live Scores • Zero Ads</span>
            </div>
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase text-slate-200">
              {labsPreviewEnabled ? "Labs preview" : "Premium"}
            </span>
          </Link>

          {/* Desktop nav */}
          <nav
            aria-label="Primary"
            className="hidden flex-1 flex-wrap items-center justify-center gap-3 text-sm md:flex"
          >
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group rounded-2xl border border-white/5 bg-white/5 px-4 py-2 text-slate-200 transition hover:border-cyan-400/40 hover:bg-cyan-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                <span className="block font-semibold">{link.label}</span>
                <span className="text-[11px] text-slate-500">{link.detail}</span>
              </Link>
            ))}
          </nav>

          {/* Desktop status badges */}
          <div className="hidden flex-wrap justify-center gap-2 sm:flex sm:flex-1 text-[10px] uppercase tracking-widest text-slate-500">
            {PREMIUM_STATUS_BADGES.map((badge) => (
              <div
                key={badge.label}
                className="rounded-full border border-white/10 bg-slate-900/70 px-3 py-1 text-[10px] font-semibold text-slate-300"
              >
                <span className="text-slate-500">{badge.label} · </span>
                <span className="text-slate-200">{badge.value}</span>
              </div>
            ))}
          </div>

          {/* Desktop metrics + CTA */}
          <div className="hidden items-center gap-4 md:flex">
            <div className="hidden items-center gap-4 text-right text-slate-300 sm:flex">
              {PREMIUM_METRICS.map((metric) => (
                <div key={metric.label}>
                  <p className="text-[11px] uppercase tracking-widest text-slate-500">{metric.label}</p>
                  <p className="text-lg font-semibold text-white">{metric.value}</p>
                </div>
              ))}
            </div>
            <div
              className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/80 px-3 py-1 text-[11px] font-semibold text-slate-200"
              aria-live="polite"
            >
              <span className={cn("h-2 w-2 rounded-full animate-pulse", mounted ? "bg-emerald-400" : "bg-slate-600")} aria-hidden />
              Edge feed {mounted ? "live" : "syncing"}
            </div>
            <Link
              href="/match"
              className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-400 to-indigo-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-[0_10px_30px_rgba(0,212,255,0.35)] transition hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              Launch App
            </Link>
          </div>

          {/* Mobile menu button */}
          <HamburgerButton open={menuOpen} onToggle={toggleMenu} />
        </div>
      </div>

      {/* Mobile drawer */}
      <MobileDrawer open={menuOpen} onClose={closeMenu} mounted={mounted} />
    </header>
  );
}

// ─── Exported component ────────────────────────────────────────────────────────

export function Header() {
  const premiumEnabled = useFeatureFlag(FeatureFlag.PREMIUM_VISUAL_HIERARCHY, false);
  return premiumEnabled ? <PremiumHeader /> : <LegacyHeader />;
}
