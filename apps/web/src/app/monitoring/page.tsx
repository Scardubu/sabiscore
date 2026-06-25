import { Metadata } from "next";
import { PerformanceDashboard } from "@/components/monitoring/performance-dashboard";

export const metadata: Metadata = {
  title: "Model Monitoring | Sabiscore",
  description: "Real-time monitoring of ML model performance, drift detection, and system health",
};

export default function MonitoringPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-7xl space-y-8">
          {/* Header Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1 text-sm font-semibold text-emerald-200">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                  </span>
                  Live Monitoring
                </div>
                <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
                  Model Performance Dashboard
                </h1>
                <p className="text-lg text-slate-400">
                  Real-time insights into model health, prediction accuracy, and drift detection
                </p>
              </div>
            </div>
          </section>

          {/* Performance Dashboard */}
          <PerformanceDashboard />

          {/* Info Cards */}
          <section className="grid gap-6 md:grid-cols-3">
            <div className="rounded-[28px] border border-white/10 bg-slate-950/80 p-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-5 w-5"
                  >
                    <path d="M12 2v20M2 12h20" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white">Auto-Refresh</h3>
              </div>
              <p className="text-sm text-slate-400">
                Dashboard automatically updates every 30 seconds to provide real-time monitoring data
              </p>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-slate-950/80 p-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-5 w-5"
                  >
                    <path d="M3 3v18h18" />
                    <path d="m19 9-5 5-4-4-3 3" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white">Drift Detection</h3>
              </div>
              <p className="text-sm text-slate-400">
                Automated drift detection monitors prediction quality and alerts on degradation
              </p>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-slate-950/80 p-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-5 w-5"
                  >
                    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white">Health Checks</h3>
              </div>
              <p className="text-sm text-slate-400">
                Comprehensive health scoring tracks system reliability and uptime metrics
              </p>
            </div>
          </section>

          {/* Technical Details */}
          <section className="rounded-[28px] border border-white/10 bg-slate-950/80 p-8 space-y-6">
            <h2 className="text-2xl font-bold text-white">Monitoring Architecture</h2>
            
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-slate-200">Metrics Tracked</h3>
                <ul className="space-y-2 text-sm text-slate-400">
                  <li className="flex items-start gap-2">
                    <span className="mt-1 text-emerald-400">•</span>
                    <span><strong className="text-slate-300">Accuracy:</strong> Rolling 90-day prediction accuracy</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 text-emerald-400">•</span>
                    <span><strong className="text-slate-300">Brier Score:</strong> Calibration quality measurement</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 text-emerald-400">•</span>
                    <span><strong className="text-slate-300">ROI:</strong> Betting return on investment tracking</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 text-emerald-400">•</span>
                    <span><strong className="text-slate-300">CLV:</strong> Closing line value analysis</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 text-emerald-400">•</span>
                    <span><strong className="text-slate-300">Response Time:</strong> API latency monitoring</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-slate-200">Drift Detection</h3>
                <ul className="space-y-2 text-sm text-slate-400">
                  <li className="flex items-start gap-2">
                    <span className="mt-1 text-emerald-400">•</span>
                    <span><strong className="text-slate-300">None:</strong> Model performing within expected range</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 text-yellow-400">•</span>
                    <span><strong className="text-slate-300">Minor:</strong> Small deviation detected, monitoring</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 text-orange-400">•</span>
                    <span><strong className="text-slate-300">Moderate:</strong> Noticeable drift, review recommended</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 text-red-400">•</span>
                    <span><strong className="text-slate-300">Significant:</strong> Major drift, action required</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 text-red-500">•</span>
                    <span><strong className="text-slate-300">Critical:</strong> Severe drift, immediate attention</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-slate-200">Data Storage</h3>
              <p className="text-sm text-slate-400">
                All monitoring data is stored locally using <code className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300">localStorage</code> for
                lightweight, privacy-focused analytics. No external services or databases required. Data persists across sessions
                and automatically manages storage limits with rolling windows.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
