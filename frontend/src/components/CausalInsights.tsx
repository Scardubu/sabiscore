import { memo } from 'react'
import type { CausalSummary } from '../lib/api'

interface CausalInsightsProps {
  summary?: CausalSummary | null
}

/** Normalize a snake_case feature name for display. */
const formatName = (name: string) =>
  name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

/** Pill classification badge. */
const StatusPill = ({ status }: { status: string }) => {
  const isReady = status === 'ready'
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded font-medium ${
        isReady ? 'bg-fuchsia-500/15 text-fuchsia-300' : 'bg-slate-700 text-slate-400'
      }`}
    >
      {isReady ? '✓ Report ready' : status}
    </span>
  )
}

const DriverChip = ({ name, index }: { name: string; index: number }) => {
  /** Opacity decreases from full → 60% as rank increases (1st driver is strongest signal). */
  const opacity = Math.max(0.55, 1 - index * 0.09)
  return (
    <li
      className="flex items-center gap-2 group"
      style={{ opacity }}
    >
      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-fuchsia-500/20 text-fuchsia-400
                       flex items-center justify-center text-[10px] font-bold">
        {index + 1}
      </span>
      <span className="truncate text-fuchsia-300 text-sm group-hover:text-fuchsia-200 transition-colors">
        {formatName(name)}
      </span>
    </li>
  )
}

const WarningChip = ({ name }: { name: string }) => (
  <li className="flex items-center gap-2">
    <svg className="w-3.5 h-3.5 flex-shrink-0 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
        d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
    <span className="truncate text-amber-300 text-sm">{formatName(name)}</span>
  </li>
)

const CausalInsights = ({ summary }: CausalInsightsProps) => {
  if (!summary) return null

  const hasDrivers = summary.top_drivers.length > 0
  const hasWarnings = summary.collider_warnings.length > 0

  return (
    <section className="glass-card p-6 border border-fuchsia-500/20">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-5">
        <h3 className="text-h3 flex items-center gap-2">
          <svg className="w-5 h-5 text-fuchsia-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Causal Signals
        </h3>
        <StatusPill status={summary.status} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top causal drivers */}
        <div className="rounded-lg bg-slate-900/40 p-4 border border-slate-800/60">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-3 font-medium">
            Top Causal Drivers
          </div>
          {hasDrivers ? (
            <ul className="space-y-2">
              {summary.top_drivers.map((driver, i) => (
                <DriverChip key={driver} name={driver} index={i} />
              ))}
            </ul>
          ) : (
            <p className="text-slate-500 text-sm">
              {summary.status === 'unavailable'
                ? 'Run scripts/causal_feature_analysis.py to generate the report.'
                : 'No causal drivers identified.'}
            </p>
          )}
        </div>

        {/* Collider warnings */}
        <div className="rounded-lg bg-slate-900/40 p-4 border border-slate-800/60">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-3 font-medium">
            Collider Warnings
          </div>
          {hasWarnings ? (
            <ul className="space-y-2">
              {summary.collider_warnings.map((w) => (
                <WarningChip key={w} name={w} />
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              No collider warnings detected
            </div>
          )}

          {/* Explanation note */}
          <p className="mt-4 text-xs text-slate-600 leading-relaxed">
            Colliders are features whose conditioning on can introduce spurious correlations.
            Treat them with caution in downstream feature engineering.
          </p>
        </div>
      </div>

      {/* Footer */}
      {summary.source && (
        <div className="mt-4 text-xs text-slate-600 truncate">
          Source: {summary.source}
        </div>
      )}
    </section>
  )
}

export default memo(CausalInsights)
