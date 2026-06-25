"use client";

import Link from "next/link";
import { MatchSelector } from "@/components/match-selector";
import { Header } from "@/components/header";
import { FeatureFlag, useFeatureFlag } from "@/lib/feature-flags";
import { UpcomingMatchesPanel } from "@/components/upcoming-matches-panel";
import { ReadinessRing } from "@/components/readiness-ring";
import { BestBetSpotlight } from "@/components/best-bet-spotlight";

// Phase 8 Sprint 4 — walk-forward validated metrics (not simulated)
const HERO_STATS = [
  { label: "Prediction Accuracy", value: "~53%", detail: "Phase 8 Ensemble" },
  { label: "Training Data", value: "10.7k+", detail: "Real matches" },
  { label: "RPS Gate", value: "≤0.21", detail: "Walk-forward validated" },
  { label: "Avg Value Edge", value: "+6–10%", detail: "When edge detected" },
];

const TRUST_BADGES = [
  { label: "Leagues + UCL", value: "5+1" },
  { label: "Data refresh", value: "every 180s" },
  { label: "Phase 8 features", value: "86" },
];

const PREMIUM_VALUE_STREAM = [
  {
    title: "Edge telemetry",
    description: "Live anomaly detection across 12 scrapers with automatic fallbacks and DATA_GAP surfacing.",
    icon: "📊",
    footer: "Integrity SLA 99.7%",
  },
  {
    title: "Phase 8 enrichment",
    description: "86-feature vector: Pi-ratings, Berrar, EWMA form, market drift, match importance, and Elo momentum.",
    icon: "🧬",
    footer: "86 walk-forward features",
  },
  {
    title: "CLV + Kelly toolkit",
    description: "Closing-line value, edge quality scoring, and fractional Kelly staking with RL abstention gate.",
    icon: "🎯",
    footer: "Calibrated per-bet sizing",
  },
];

const PREMIUM_PILLARS = [
  {
    title: "Data integrity",
    detail: "8 sources cross-checked with automatic failover",
    icon: "✅",
  },
  {
    title: "Model governance",
    detail: "Live calibration + drift alerts under 180 seconds",
    icon: "⚙️",
  },
  {
    title: "Value creation",
    detail: "Kelly, CLV, and bankroll tooling in one workflow",
    icon: "💰",
  },
];

export default function HomePage() {
  const premiumEnabled = useFeatureFlag(FeatureFlag.PREMIUM_VISUAL_HIERARCHY);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Header />
      <main className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-6xl space-y-12">
          {premiumEnabled ? <PremiumHome /> : <LegacyHome />}
        </div>
      </main>
      <footer className="border-t border-slate-800/50 mt-24 py-12">
        <div className="container mx-auto px-4 text-center text-slate-500">
          <p>Made with ⚡ by the Sabiscore Team</p>
          <p className="mt-2 text-sm">Built for responsible betting insights and advanced football analytics</p>
        </div>
      </footer>
    </div>
  );
}

function PremiumHome() {
  return (
    <>
      <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-10 text-left shadow-[0_35px_80px_rgba(2,6,23,0.6)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-70 bg-[radial-gradient(circle_at_20%_20%,rgba(0,212,255,0.35),transparent_55%),radial-gradient(circle_at_80%_10%,rgba(123,47,247,0.25),transparent_45%)]"
          aria-hidden="true"
        />
        <div className="relative grid gap-10 lg:grid-cols-[1.2fr,0.8fr]">
          <div className="space-y-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-100">
              Premium • Visual Hierarchy
            </span>
            <h1 className="text-4xl font-black leading-tight text-white md:text-5xl">
              Edge-first football intelligence for professional bettors
            </h1>
            <p className="text-lg text-slate-300">
              Precision probabilities, fan pulse overlays, and Kelly-ready bet slips presented in a single, cohesive surface.
            </p>
            <div className="flex flex-wrap gap-3">
              {TRUST_BADGES.map((badge) => (
                <span
                  key={badge.label}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-2 text-sm text-slate-200"
                >
                  <strong className="text-white">{badge.value}</strong>
                  <span className="text-slate-400">{badge.label}</span>
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/match"
                className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-400 to-indigo-500 px-8 py-3 text-base font-semibold text-slate-950 shadow-[0_10px_35px_rgba(0,212,255,0.35)] transition hover:scale-[1.02]"
              >
                Launch Live Insights
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center justify-center rounded-2xl border border-white/20 px-8 py-3 text-base font-semibold text-white transition hover:border-white/40"
              >
                Explore Docs
              </Link>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-slate-950/70 p-6 shadow-[0_20px_60px_rgba(3,7,18,0.8)] flex flex-col gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Model pulse</p>
              <div className="mt-4 grid grid-cols-2 gap-4">
                {HERO_STATS.map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-white/5 bg-slate-900/70 p-4">
                    <p className="text-[11px] uppercase tracking-widest text-slate-500">{stat.label}</p>
                    <p className="text-2xl font-bold text-white tabular-nums">{stat.value}</p>
                    <p className="text-xs text-slate-400">{stat.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Live source readiness — fetched from /api/v1/sources/freshness */}
            <div className="rounded-2xl border border-white/5 bg-slate-900/60 px-4 py-3">
              <p className="mb-3 text-[10px] uppercase tracking-[0.3em] text-slate-600">
                Source readiness
              </p>
              <ReadinessRing />
            </div>

            <div className="space-y-3">
              {PREMIUM_PILLARS.map((pillar) => (
                <div key={pillar.title} className="flex items-center justify-between rounded-2xl border border-white/5 bg-slate-900/60 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{pillar.icon}</span>
                    <div>
                      <p className="font-semibold text-white">{pillar.title}</p>
                      <p className="text-sm text-slate-400">{pillar.detail}</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Live</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Best bet spotlight — top edge bet from live scanner */}
      <section className="grid gap-6 lg:grid-cols-[1fr,1fr]">
        <BestBetSpotlight />
        <div className="grid gap-4">
          {PREMIUM_VALUE_STREAM.map((card) => (
            <div key={card.title} className="glass-card flex flex-col justify-between gap-3 p-5">
              <div className="flex items-center gap-3 text-slate-200">
                <span className="text-xl">{card.icon}</span>
                <h3 className="text-base font-semibold text-white">{card.title}</h3>
              </div>
              <p className="text-sm text-slate-400">{card.description}</p>
              <span className="text-[10px] uppercase tracking-[0.35em] text-slate-500">{card.footer}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <div className="rounded-[28px] border border-white/10 bg-slate-950/80 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Match predictor</p>
              <p className="text-sm text-slate-400">Select any fixture for a full 86-feature prediction.</p>
            </div>
          </div>
          <div className="mt-4">
            <MatchSelector />
          </div>
        </div>
        <UpcomingMatchesPanel title="Upcoming Fixtures" />
      </section>
    </>
  );
}

function LegacyHome() {
  return (
    <>
      <section className="text-center space-y-6 animate-fade-in">
        <div className="inline-block rounded-full border border-indigo-500/20 bg-indigo-500/10 px-4 py-2">
          <span className="text-sm font-semibold text-indigo-400">
            🚀 Phase 8 Ensemble • 86 ML Features • 5 Leagues + UCL • RPS ≤ 0.21
          </span>
        </div>
        <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-slate-100 via-indigo-200 to-purple-200 bg-clip-text text-transparent leading-tight">
          Edge-First Football
          <br />
          Intelligence Platform
        </h1>
        <p className="text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed">
          Walk-forward validated predictions across 5 leagues + UCL.{" "}
          <span className="text-indigo-400 font-semibold">Edge quality scored</span> before every stake.
        </p>
        <div className="flex items-center justify-center gap-4 pt-4">
          <Link
            href="/match"
            className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-105"
          >
            Get Started
          </Link>
          <Link
            href="/docs"
            className="px-8 py-4 bg-slate-800/50 hover:bg-slate-800 text-slate-200 font-semibold rounded-xl transition-all duration-200 border border-slate-700/50"
          >
            View Docs
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-fade-in">
        {HERO_STATS.map((stat) => (
          <div key={stat.label} className="glass-card p-6 space-y-2 hover:bg-slate-900/60 transition-colors">
            <p className="text-sm text-slate-400 uppercase tracking-wider">{stat.label}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-slate-100 tabular-nums">{stat.value}</p>
              <span className="text-sm text-green-400 font-semibold">{stat.detail}</span>
            </div>
          </div>
        ))}
      </section>

      <section className="animate-fade-in">
        <MatchSelector />
      </section>

      <section className="animate-fade-in">
        <UpcomingMatchesPanel title="Upcoming Fixtures" />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-fade-in">
        {[
          {
            title: "Phase 8 Enrichment",
            description: "86-feature vector: Pi-ratings, Berrar, EWMA form, market drift, match importance, and Elo momentum. All B13-compliant — no synthetic injection.",
            icon: "🧬",
          },
          {
            title: "CLV + Edge Quality",
            description: "Edge quality scored 0–1 per fixture. Closing-line value computed at kick-off. Fractional Kelly + RL abstention gate on every bet.",
            icon: "🎯",
          },
          {
            title: "Walk-Forward Validated",
            description: "RPS ≤ 0.21 gate, draw recall ≥ 0.25. No random k-fold — temporal splits only. SHAP ablation per feature family.",
            icon: "📊",
          },
        ].map((feature) => (
          <div key={feature.title} className="glass-card p-8 space-y-4 hover:bg-slate-900/60 transition-colors group">
            <div className="text-4xl group-hover:scale-110 transition-transform">{feature.icon}</div>
            <h3 className="text-xl font-bold text-slate-100">{feature.title}</h3>
            <p className="text-slate-400 leading-relaxed">{feature.description}</p>
          </div>
        ))}
      </section>
    </>
  );
}
