"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { FeatureFlag, useFeatureFlag } from "@/lib/feature-flags";

const premiumNavLinks = [
  { href: "/match", label: "Match Insights", detail: "Live ML edge" },
  { href: "/monitoring", label: "Monitoring", detail: "Model health" },
  { href: "/docs", label: "Docs", detail: "Playbooks + API" },
  { href: "/docs#api", label: "API", detail: "REST access" },
];

const premiumMetrics = [
  { label: "Accuracy", value: "73.7%" },
  { label: "ROI", value: "+18.4%" },
];

const premiumStatusBadges = [
  { label: "Latency", value: "620ms" },
  { label: "Models", value: "Ensemble v3" },
  { label: "Sources", value: "8 live feeds" },
];

export function Header() {
  const [mounted, setMounted] = useState(false);
  const premiumEnabled = useFeatureFlag(FeatureFlag.PREMIUM_VISUAL_HIERARCHY, false);
  const labsPreviewEnabled = useFeatureFlag(FeatureFlag.PREDICTION_INTERSTITIAL_V2, false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!premiumEnabled) {
    return (
      <header className="sticky top-0 z-50 w-full border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-xl">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center space-x-2 group">
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500/20 blur-xl group-hover:bg-indigo-500/30 transition-colors"></div>
                <div className="relative text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  Sabiscore
                </div>
              </div>
            </Link>

            <nav className="flex items-center space-x-6">
              <Link
                href="/match"
                className="text-sm font-medium text-slate-300 hover:text-slate-100 transition-colors"
              >
                Matches
              </Link>
              <Link
                href="/monitoring"
                className="text-sm font-medium text-slate-300 hover:text-slate-100 transition-colors"
              >
                Monitoring
              </Link>
              <Link
                href="/docs"
                className="text-sm font-medium text-slate-300 hover:text-slate-100 transition-colors"
              >
                Docs
              </Link>
              <a
                href="https://github.com/sabiscore"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-slate-300 hover:text-slate-100 transition-colors"
              >
                GitHub
              </a>
              
              <div className="pl-4 border-l border-slate-800">
                <div className="flex items-center space-x-2 text-xs">
                  <div className="flex items-center space-x-1">
                    <div className={`h-2 w-2 rounded-full ${mounted ? "bg-green-500" : "bg-slate-600"} animate-pulse`}></div>
                    <span className="text-slate-400">
                      {mounted ? "Live" : "Loading"}
                    </span>
                  </div>
                </div>
              </div>
            </nav>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-slate-950/80 shadow-[0_15px_45px_rgba(8,14,35,0.7)] backdrop-blur-2xl">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap items-center justify-between gap-4 py-4">
          <Link href="/" className="group flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-cyan-500/20 blur-2xl transition-opacity group-hover:opacity-80" aria-hidden></div>
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

          <nav className="flex flex-1 flex-wrap items-center justify-center gap-3 text-sm">
            {premiumNavLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group rounded-2xl border border-white/5 bg-white/5 px-4 py-2 text-slate-200 transition hover:border-cyan-400/40 hover:bg-cyan-400/10"
              >
                <span className="block font-semibold">{link.label}</span>
                <span className="text-[11px] text-slate-500">{link.detail}</span>
              </Link>
            ))}
          </nav>

          <div className="flex flex-wrap justify-center gap-2 text-[10px] uppercase tracking-widest text-slate-500 sm:flex-1">
            {premiumStatusBadges.map((badge) => (
              <div
                key={badge.label}
                className="rounded-full border border-white/10 bg-slate-900/70 px-3 py-1 text-[10px] font-semibold text-slate-300"
              >
                <span className="text-slate-500">{badge.label} · </span>
                <span className="text-slate-200">{badge.value}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 text-xs sm:flex-row sm:items-center sm:gap-4">
            <div
              className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/80 px-3 py-1 text-[11px] font-semibold text-slate-200"
              aria-live="polite"
            >
              <span className={`h-2 w-2 rounded-full ${mounted ? "bg-emerald-400" : "bg-slate-600"} animate-pulse`}></span>
              Edge feed {mounted ? "live" : "syncing"}
            </div>
            <div className="hidden items-center gap-4 text-right text-slate-300 sm:flex">
              {premiumMetrics.map((metric) => (
                <div key={metric.label}>
                  <p className="text-[11px] uppercase tracking-widest text-slate-500">{metric.label}</p>
                  <p className="text-lg font-semibold text-white">{metric.value}</p>
                </div>
              ))}
            </div>
            <Link
              href="/match"
              className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-400 to-indigo-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-[0_10px_30px_rgba(0,212,255,0.35)] transition hover:scale-[1.02]"
            >
              Launch App
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
