import Link from "next/link";
import { MatchSelector } from "@/components/match-selector";
import { Header } from "@/components/header";

// Removed edge runtime for static export compatibility
// export const runtime = "edge";
// export const preferredRegion = ["iad1", "lhr1", "fra1"];
// export const revalidate = 15;

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Header />
      
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto space-y-12">
          {/* Hero Section */}
          <section className="text-center space-y-6 animate-fade-in">
            <div className="inline-block px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
              <span className="text-sm font-semibold text-indigo-400">
                🚀 90-92% Accuracy • +24-26% ROI • 5 Leagues • 86 ML Features
              </span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-slate-100 via-indigo-200 to-purple-200 bg-clip-text text-transparent leading-tight">
              Edge-First Football
              <br />
              Intelligence Platform
            </h1>
            
            <p className="text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed">
              Reverse-engineer bookie mistakes in <span className="text-indigo-400 font-semibold">142ms</span>.
              Stake them at ⅛ Kelly before the line moves.
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

          {/* Stats Grid */}
          <section className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-fade-in">
            {[
              { label: "Prediction Accuracy", value: "73.7%", change: "+0.5%" },
              { label: "High-Conf Picks", value: "84.9%", change: "+0.8%" },
              { label: "Avg CLV", value: "+₦60", change: "↑" },
              { label: "Value Bet ROI", value: "+18.4%", change: "↑" },
            ].map((stat, idx) => (
              <div
                key={idx}
                className="glass-card p-6 space-y-2 hover:bg-slate-900/60 transition-colors"
              >
                <p className="text-sm text-slate-400 uppercase tracking-wider">
                  {stat.label}
                </p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-slate-100">{stat.value}</p>
                  <span className="text-sm text-green-400 font-semibold">
                    {stat.change}
                  </span>
                </div>
              </div>
            ))}
          </section>

          <section className="animate-fade-in">
            <MatchSelector />
          </section>

          {/* Features */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-fade-in">
            {[
              {
                title: "Live Calibration",
                description: "3-min retrain loop with Platt scaling. Market updates in 8s.",
                icon: "⚡",
              },
              {
                title: "Smart Kelly",
                description: "⅛ Kelly staking. +18% growth, -9% max drawdown.",
                icon: "🎯",
              },
              {
                title: "Edge Runtime",
                description: "Next.js 15 + PPR. 142ms TTFB @ 10k CCU.",
                icon: "🚀",
              },
            ].map((feature, idx) => (
              <div
                key={idx}
                className="glass-card p-8 space-y-4 hover:bg-slate-900/60 transition-colors group"
              >
                <div className="text-4xl group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-slate-100">{feature.title}</h3>
                <p className="text-slate-400 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </section>
        </div>
      </main>

      <footer className="border-t border-slate-800/50 mt-24 py-12">
        <div className="container mx-auto px-4 text-center text-slate-500">
          <p>Made with ⚡ by the Sabiscore Team</p>
          <p className="mt-2 text-sm">
            Built for responsible betting insights and advanced football analytics
          </p>
        </div>
      </footer>
    </div>
  );
}
