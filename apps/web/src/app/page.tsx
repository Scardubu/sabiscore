"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Database,
  Microscope,
  Settings2,
  ShieldCheck,
  Target,
  WalletCards,
} from "lucide-react";
import { BestBetSpotlight } from "@/components/best-bet-spotlight";
import { Header } from "@/components/header";
import { MatchSelector } from "@/components/match-selector";
import { ReadinessRing } from "@/components/readiness-ring";
import { UpcomingMatchesPanel } from "@/components/upcoming-matches-panel";
import { FeatureFlag, useFeatureFlag } from "@/lib/feature-flags";

const HERO_STATS = [
  { label: "Prediction Accuracy", value: "~53%", detail: "Phase 8 Ensemble" },
  { label: "Training Data", value: "10.7k+", detail: "Real matches" },
  { label: "RPS Gate", value: "<=0.21", detail: "Walk-forward validated" },
  { label: "Avg Value Edge", value: "+6-10%", detail: "When edge detected" },
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
    icon: BarChart3,
    footer: "Integrity SLA 99.7%",
  },
  {
    title: "Phase 8 enrichment",
    description: "86-feature vector: Pi-ratings, Berrar, EWMA form, market drift, match importance, and Elo momentum.",
    icon: Microscope,
    footer: "86 walk-forward features",
  },
  {
    title: "CLV + Kelly toolkit",
    description: "Closing-line value, edge quality scoring, and fractional Kelly staking with RL abstention gate.",
    icon: Target,
    footer: "Calibrated per-bet sizing",
  },
] satisfies Array<{ title: string; description: string; icon: LucideIcon; footer: string }>;

const PREMIUM_PILLARS = [
  {
    title: "Data integrity",
    detail: "8 sources cross-checked with automatic failover",
    icon: ShieldCheck,
  },
  {
    title: "Model governance",
    detail: "Live calibration + drift alerts under 180 seconds",
    icon: Settings2,
  },
  {
    title: "Value creation",
    detail: "Kelly, CLV, and bankroll tooling in one workflow",
    icon: WalletCards,
  },
] satisfies Array<{ title: string; detail: string; icon: LucideIcon }>;

const LEGACY_FEATURES = [
  {
    title: "Phase 8 Enrichment",
    description: "86-feature vector: Pi-ratings, Berrar, EWMA form, market drift, match importance, and Elo momentum. All B13-compliant - no synthetic injection.",
    icon: Database,
  },
  {
    title: "CLV + Edge Quality",
    description: "Edge quality scored 0-1 per fixture. Closing-line value computed at kick-off. Fractional Kelly + RL abstention gate on every bet.",
    icon: Target,
  },
  {
    title: "Walk-Forward Validated",
    description: "RPS <= 0.21 gate, draw recall >= 0.25. Temporal splits only, with SHAP ablation per feature family.",
    icon: CheckCircle2,
  },
] satisfies Array<{ title: string; description: string; icon: LucideIcon }>;

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
      <footer className="mt-24 border-t border-slate-800/50 py-12">
        <div className="container mx-auto px-4 text-center text-slate-500">
          <p>SabiScore production intelligence workspace</p>
          <p className="mt-2 text-sm">Built for responsible betting insights and advanced football analytics</p>
        </div>
      </footer>
    </div>
  );
}

function PremiumHome() {
  return (
    <>
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 text-left shadow-[0_35px_80px_rgba(2,6,23,0.6)] sm:p-10">
        <div className="relative grid gap-10 lg:grid-cols-[1.2fr,0.8fr]">
          <div className="space-y-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-100">
              <Activity size={14} aria-hidden="true" />
              Evidence-first intelligence
            </span>
            <h1 className="max-w-3xl text-4xl font-black leading-tight text-white md:text-5xl">
              Edge-first football intelligence for analysts
            </h1>
            <p className="max-w-2xl text-lg text-slate-300">
              Calibrated probabilities, market context, and bankroll-aware decision support presented in one cohesive surface.
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
                href="/intelligence"
                className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-400 to-indigo-500 px-8 py-3 text-base font-semibold text-slate-950 shadow-[0_10px_35px_rgba(0,212,255,0.35)] transition hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-cyan-200"
              >
                Open Intelligence
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center justify-center rounded-2xl border border-white/20 px-8 py-3 text-base font-semibold text-white transition hover:border-white/40 focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                Explore Docs
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-6 rounded-[24px] border border-white/10 bg-slate-950/70 p-5 shadow-[0_20px_60px_rgba(3,7,18,0.8)] sm:p-6">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Model pulse</p>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {HERO_STATS.map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-white/5 bg-slate-900/70 p-4">
                    <p className="text-[11px] uppercase tracking-widest text-slate-500">{stat.label}</p>
                    <p className="text-2xl font-bold text-white tabular-nums">{stat.value}</p>
                    <p className="text-xs text-slate-400">{stat.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-slate-900/60 px-4 py-3">
              <p className="mb-3 text-[10px] uppercase tracking-[0.24em] text-slate-600">
                Source readiness
              </p>
              <ReadinessRing />
            </div>

            <div className="space-y-3">
              {PREMIUM_PILLARS.map((pillar) => (
                <div key={pillar.title} className="flex items-center justify-between rounded-2xl border border-white/5 bg-slate-900/60 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <pillar.icon className="h-5 w-5 text-cyan-300" aria-hidden="true" />
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

      <section className="grid gap-6 lg:grid-cols-[1fr,1fr]">
        <BestBetSpotlight />
        <div className="grid gap-4">
          {PREMIUM_VALUE_STREAM.map((card) => (
            <div key={card.title} className="glass-card flex flex-col justify-between gap-3 p-5">
              <div className="flex items-center gap-3 text-slate-200">
                <card.icon className="h-5 w-5 text-cyan-300" aria-hidden="true" />
                <h3 className="text-base font-semibold text-white">{card.title}</h3>
              </div>
              <p className="text-sm text-slate-400">{card.description}</p>
              <span className="text-[10px] uppercase tracking-[0.24em] text-slate-500">{card.footer}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <div className="rounded-[24px] border border-white/10 bg-slate-950/80 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Match predictor</p>
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
      <section className="space-y-6 text-center animate-fade-in">
        <div className="inline-block rounded-full border border-indigo-500/20 bg-indigo-500/10 px-4 py-2">
          <span className="text-sm font-semibold text-indigo-400">
            Phase 8 Ensemble | 86 ML Features | 5 Leagues + UCL | RPS &lt;= 0.21
          </span>
        </div>
        <h1 className="bg-gradient-to-r from-slate-100 via-indigo-200 to-purple-200 bg-clip-text text-5xl font-bold leading-tight text-transparent md:text-7xl">
          Edge-First Football
          <br />
          Intelligence Platform
        </h1>
        <p className="mx-auto max-w-3xl text-xl leading-relaxed text-slate-400">
          Walk-forward validated predictions across 5 leagues + UCL.{" "}
          <span className="font-semibold text-indigo-400">Edge quality scored</span> before every stake.
        </p>
        <div className="flex items-center justify-center gap-4 pt-4">
          <Link
            href="/intelligence"
            className="rounded-xl bg-indigo-600 px-8 py-4 font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all duration-200 hover:scale-105 hover:bg-indigo-500 hover:shadow-indigo-500/40 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          >
            Open Intelligence
          </Link>
          <Link
            href="/docs"
            className="rounded-xl border border-slate-700/50 bg-slate-800/50 px-8 py-4 font-semibold text-slate-200 transition-all duration-200 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            View Docs
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-4 animate-fade-in">
        {HERO_STATS.map((stat) => (
          <div key={stat.label} className="glass-card space-y-2 p-6 transition-colors hover:bg-slate-900/60">
            <p className="text-sm uppercase tracking-wider text-slate-400">{stat.label}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-slate-100 tabular-nums">{stat.value}</p>
              <span className="text-sm font-semibold text-green-400">{stat.detail}</span>
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

      <section className="grid grid-cols-1 gap-8 md:grid-cols-3 animate-fade-in">
        {LEGACY_FEATURES.map((feature) => (
          <div key={feature.title} className="glass-card space-y-4 p-8 transition-colors hover:bg-slate-900/60 group">
            <feature.icon className="h-8 w-8 text-indigo-300 transition-transform group-hover:scale-110" aria-hidden="true" />
            <h3 className="text-xl font-bold text-slate-100">{feature.title}</h3>
            <p className="leading-relaxed text-slate-400">{feature.description}</p>
          </div>
        ))}
      </section>
    </>
  );
}
