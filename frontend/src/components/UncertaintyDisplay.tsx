import { memo } from 'react'
import type { UncertaintyBreakdown } from '../lib/api'

interface UncertaintyDisplayProps {
  uncertainty?: UncertaintyBreakdown | null
}

const toPct = (value: number, digits = 1) => `${(value * 100).toFixed(digits)}%`

/** Clamp to [0,1] and map to a width percentage string for progress bars. */
const barWidth = (value: number, max = 0.5) =>
  `${Math.min(100, (Math.max(0, value) / max) * 100).toFixed(1)}%`

interface MetricBarProps {
  label: string
  value: number
  formatted: string
  max?: number
  colorClass: string
  tooltip: string
}

const MetricBar = ({ label, value, formatted, max = 0.5, colorClass, tooltip }: MetricBarProps) => (
  <div className="space-y-1" title={tooltip}>
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-400">{label}</span>
      <span className={`font-semibold tabular-nums ${colorClass}`}>{formatted}</span>
    </div>
    <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${colorClass.replace('text-', 'bg-')}`}
        style={{ width: barWidth(value, max) }}
      />
    </div>
  </div>
)

const UncertaintyDisplay = ({ uncertainty }: UncertaintyDisplayProps) => {
  if (!uncertainty) return null

  const ep = uncertainty.epistemic_unc
  const al = uncertainty.aleatoric_unc
  const span = Math.max(0, uncertainty.credible_interval.upper - uncertainty.credible_interval.lower)
  const lowConfidence = ep > 0.15

  // Derived signal quality: high when epistemic is low AND CI span is narrow
  const signalQuality = Math.max(0, 1 - ep * 4 - span)
  const qualityLabel =
    signalQuality >= 0.7 ? 'High Signal' : signalQuality >= 0.4 ? 'Moderate' : 'Uncertain'
  const qualityColor =
    signalQuality >= 0.7
      ? 'text-emerald-400 bg-emerald-500/15'
      : signalQuality >= 0.4
        ? 'text-amber-400 bg-amber-500/15'
        : 'text-rose-400 bg-rose-500/15'

  return (
    <section className="glass-card p-6 border border-cyan-500/20">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-5">
        <h3 className="text-h3 flex items-center gap-2">
          <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 17v-2m3 2v-4m3 4V7m2 10a2 2 0 002 2h1a2 2 0 002-2V5a2 2 0 00-2-2h-1a2 2 0 00-2 2m-6 12a2 2 0 002 2h1a2 2 0 002-2m-6 0a2 2 0 01-2 2H9a2 2 0 01-2-2m0 0V9a2 2 0 012-2h1a2 2 0 012 2v8" />
          </svg>
          Uncertainty Breakdown
        </h3>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${qualityColor}`}>
            {qualityLabel}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded ${lowConfidence ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
            {lowConfidence ? '⚠ Low Confidence' : '✓ Stable'}
          </span>
        </div>
      </div>

      {/* Progress bar metrics */}
      <div className="space-y-4">
        <MetricBar
          label="Epistemic (model uncertainty)"
          value={ep}
          formatted={toPct(ep)}
          max={0.40}
          colorClass={ep > 0.20 ? 'text-rose-400' : ep > 0.10 ? 'text-amber-400' : 'text-cyan-400'}
          tooltip="Unknown-unknowns — reducible with more data. High values trigger abstention."
        />
        <MetricBar
          label="Aleatoric (inherent noise)"
          value={al}
          formatted={toPct(al)}
          max={1.10}
          colorClass="text-violet-400"
          tooltip="Irreducible randomness in football outcomes. Cannot be reduced by more data."
        />
        <MetricBar
          label="CI Span (95% interval width)"
          value={span}
          formatted={toPct(span)}
          max={0.60}
          colorClass={span > 0.30 ? 'text-amber-400' : 'text-teal-400'}
          tooltip="Width of the 95% credible interval. Narrower is more precise."
        />
      </div>

      {/* Concentration + CI footer */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-slate-900/40 p-3 border border-slate-800/60">
          <div className="text-xs text-slate-500 mb-0.5">Dirichlet Concentration α₀</div>
          <div className="text-cyan-300 font-semibold text-sm tabular-nums">
            {uncertainty.concentration.toFixed(2)}
          </div>
          <div className="text-xs text-slate-600 mt-0.5">Higher = more confident evidence</div>
        </div>
        <div className="rounded-lg bg-slate-900/40 p-3 border border-slate-800/60">
          <div className="text-xs text-slate-500 mb-0.5">95% Credible Interval</div>
          <div className="text-cyan-300 font-semibold text-sm tabular-nums">
            {toPct(uncertainty.credible_interval.lower)} – {toPct(uncertainty.credible_interval.upper)}
          </div>
          <div className="text-xs text-slate-600 mt-0.5">Top-class probability range</div>
        </div>
      </div>
    </section>
  )
}

export default memo(UncertaintyDisplay)
