import { memo } from 'react'
import type { RLRecommendation } from '../lib/api'

interface BettingAgentPanelProps {
  recommendation?: RLRecommendation | null
}

const toPct = (value: number, digits = 1) => `${(value * 100).toFixed(digits)}%`

const MAX_KELLY_CAP = 0.05 // matches settings.rl_max_kelly_cap

/** Semi-circular gauge SVG for stake fraction (0 → MAX_KELLY_CAP). */
const StakeGauge = ({ fraction, abstain }: { fraction: number; abstain: boolean }) => {
  const pct = Math.min(1, fraction / MAX_KELLY_CAP) // 0–1 normalised to cap
  const RADIUS = 36
  const CIRCUMFERENCE = Math.PI * RADIUS // half-circle arc
  const offset = CIRCUMFERENCE * (1 - pct)
  const color = abstain
    ? '#f59e0b' // amber — abstain
    : pct >= 0.75
      ? '#f87171' // rose — aggressive
      : pct >= 0.40
        ? '#34d399' // emerald — healthy
        : '#22d3ee' // cyan — conservative

  return (
    <svg viewBox="0 0 88 50" className="w-full max-w-[120px] mx-auto" aria-hidden>
      {/* Track */}
      <path
        d="M8,44 A36,36 0 0,1 80,44"
        fill="none"
        stroke="#1e293b"
        strokeWidth="8"
        strokeLinecap="round"
      />
      {/* Fill */}
      <path
        d="M8,44 A36,36 0 0,1 80,44"
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s ease' }}
      />
      {/* Centre label */}
      <text x="44" y="42" textAnchor="middle" fontSize="11" fill={color} fontWeight="600">
        {abstain ? '—' : toPct(fraction, 2)}
      </text>
    </svg>
  )
}

/** Reward component row with signed bar. */
const RewardRow = ({ label, value }: { label: string; value: number }) => {
  const isPos = value >= 0
  const barPct = `${Math.min(100, Math.abs(value) * 200).toFixed(1)}%`
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 text-slate-400 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${isPos ? 'bg-emerald-500' : 'bg-rose-500'}`}
          style={{ width: barPct, marginLeft: isPos ? 0 : undefined }}
        />
      </div>
      <span className={`w-14 text-right tabular-nums font-medium ${isPos ? 'text-emerald-300' : 'text-rose-300'}`}>
        {isPos ? '+' : ''}{value.toFixed(4)}
      </span>
    </div>
  )
}

const BettingAgentPanel = ({ recommendation }: BettingAgentPanelProps) => {
  if (!recommendation) return null

  const { stake_fraction, abstain, reward_components, reason } = recommendation
  const components = Object.entries(reward_components ?? {})

  const decisionColor = abstain
    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'

  return (
    <section className="glass-card p-6 border border-emerald-500/20">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-5">
        <h3 className="text-h3 flex items-center gap-2">
          <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8c-1.657 0-3 1.12-3 2.5S10.343 13 12 13s3 1.12 3 2.5S13.657 18 12 18m0-10V6m0 12v-2m8-4a8 8 0 11-16 0 8 8 0 0116 0z" />
          </svg>
          RL Betting Agent
        </h3>
        <span className={`text-xs px-2.5 py-0.5 rounded border font-medium ${decisionColor}`}>
          {abstain ? '⚠ Abstain' : '✓ Active Stake'}
        </span>
      </div>

      {/* Gauge + summary */}
      <div className="flex items-center gap-6 mb-5">
        <div className="flex-shrink-0">
          <StakeGauge fraction={stake_fraction} abstain={abstain} />
          <p className="text-xs text-slate-500 text-center mt-1">
            {abstain ? 'No bet placed' : `of ${toPct(MAX_KELLY_CAP)} Kelly cap`}
          </p>
        </div>
        <div className="flex-1 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Stake fraction</span>
            <span className="text-emerald-300 font-semibold tabular-nums">{toPct(stake_fraction, 2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Decision</span>
            <span className={abstain ? 'text-amber-300' : 'text-emerald-300'}>
              {abstain ? 'No Bet' : 'Place Bet'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Kelly cap</span>
            <span className="text-slate-300 tabular-nums">{toPct(MAX_KELLY_CAP)}</span>
          </div>
        </div>
      </div>

      {/* Reward component breakdown */}
      {components.length > 0 && (
        <div className="rounded-lg bg-slate-900/40 p-4 border border-slate-800/60 space-y-2.5">
          <div className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-1">
            Reward Components (C14)
          </div>
          {components.map(([key, value]) => (
            <RewardRow key={key} label={key} value={value} />
          ))}
        </div>
      )}

      {/* Reason string */}
      {reason && (
        <p className="mt-4 text-xs text-slate-500 leading-relaxed border-t border-slate-800/60 pt-3">
          {reason}
        </p>
      )}
    </section>
  )
}

export default memo(BettingAgentPanel)
