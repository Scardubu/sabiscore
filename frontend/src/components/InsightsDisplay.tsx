import { memo } from 'react'
import { Doughnut } from 'react-chartjs-2'
import {
  ArcElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js'
import type { InsightsResponse } from '../lib/api'
import ConfidenceBadge from './ui/ConfidenceBadge'
import TooltipUI from './ui/Tooltip'
import UncertaintyDisplay from './UncertaintyDisplay'
import CausalInsights from './CausalInsights'
import BettingAgentPanel from './BettingAgentPanel'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale)

interface InsightsDisplayProps {
  insights: InsightsResponse | null
  isLoading?: boolean
}

const formatPercent = (value?: number | null, digits = 1) => {
  if (value === undefined || value === null) {
    return 'N/A'
  }
  return `${(value * 100).toFixed(digits)}%`
}

const InsightsDisplay = ({ insights, isLoading = false }: InsightsDisplayProps) => {
  if (!insights && !isLoading) {
    return null
  }

  const prediction = insights?.predictions
  const xgAnalysis = insights?.xg_analysis
  const valueAnalysis = insights?.value_analysis
  const riskAssessment = insights?.risk_assessment
  const valueBets = valueAnalysis?.bets ?? []
  const matchupParts = insights?.matchup?.split(' vs ') ?? []
  const homeTeamName = matchupParts[0] ?? 'Home Team'
  const awayTeamName = matchupParts[1] ?? 'Away Team'

  const predictionData = prediction
    ? {
        labels: ['Home Win', 'Draw', 'Away Win'],
        datasets: [
          {
            data: [
              prediction.home_win_prob,
              prediction.draw_prob,
              prediction.away_win_prob,
            ],
            backgroundColor: [
              'rgba(79, 70, 229, 0.8)',
              'rgba(139, 92, 246, 0.8)',
              'rgba(34, 197, 94, 0.8)',
            ],
            borderColor: [
              'rgba(79, 70, 229, 1)',
              'rgba(139, 92, 246, 1)',
              'rgba(34, 197, 94, 1)',
            ],
            borderWidth: 2,
          },
        ],
      }
    : null

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: 'rgba(255, 255, 255, 0.8)',
        },
      },
    },
  }

  const BASE_DRAW_RATE = 0.246
  const DRAW_RATIO_GATE = 0.60
  const drawRatio = prediction ? prediction.draw_prob / BASE_DRAW_RATE : null
  const drawCalibrationWarn = drawRatio !== null && drawRatio < DRAW_RATIO_GATE

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Match Header */}
      <div className="glass-card p-4 sm:p-6">
        <div className="text-center">
          {isLoading ? (
            <>
              <div className="shimmer h-6 w-48 mx-auto mb-2 rounded"></div>
              <div className="shimmer h-4 w-32 mx-auto mb-4 rounded"></div>
              <div className="flex items-center justify-center space-x-4 mb-4">
                <div className="shimmer h-5 w-32 rounded"></div>
                <div className="shimmer h-6 w-16 rounded"></div>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-h2 mb-2">{insights?.matchup}</h2>
              <p className="text-body text-gray-400">{insights?.league}</p>
              {prediction && (
                <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                  <span className="text-lg sm:text-2xl font-bold text-indigo-400">
                    Predicted Winner: {prediction.prediction.replace('_', ' ')}
                  </span>
                  <ConfidenceBadge value={prediction.confidence} size="md" />
                </div>
              )}
              {xgAnalysis && (
                <div className="mt-4 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-sm">
                  <TooltipUI content="Expected Goals - statistical measure of goal-scoring opportunities quality" position="bottom">
                    <div className="cursor-help">
                      <span className="text-gray-400">{homeTeamName} xG:</span>
                      <span className="ml-2 text-indigo-400 font-semibold">{xgAnalysis.home_xg.toFixed(2)}</span>
                    </div>
                  </TooltipUI>
                  <TooltipUI content="Expected Goals - statistical measure of goal-scoring opportunities quality" position="bottom">
                    <div className="cursor-help">
                      <span className="text-gray-400">{awayTeamName} xG:</span>
                      <span className="ml-2 text-green-400 font-semibold">{xgAnalysis.away_xg.toFixed(2)}</span>
                    </div>
                  </TooltipUI>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Prediction Chart */}
      <div className="glass-card p-4 sm:p-6">
        {isLoading ? (
          <>
            <div className="shimmer h-6 w-40 mx-auto mb-6 rounded"></div>
            <div className="shimmer h-80 w-full rounded-xl"></div>
          </>
        ) : (
          <>
            <h3 className="text-h3 mb-6 text-center">Win Probabilities</h3>
            <div className="h-64 sm:h-80">
              {predictionData ? (
                <Doughnut data={predictionData} options={chartOptions} />
              ) : (
                <div className="text-center text-sm text-slate-400">
                  Prediction data unavailable
                </div>
              )}
            </div>
            <div className="mt-4 text-center text-sm text-slate-300">
              Based on ensemble ML model trained on historical match data
            </div>
            {drawCalibrationWarn && (
              <div className="mt-4 flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-300">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <span>
                  Draw calibration warning — model draw rate is{' '}
                  <strong>{(drawRatio! * 100).toFixed(0)}%</strong> of the historical base rate.
                  Draw probability may be under-estimated.
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* ExplainPanel — feature contributions */}
      {!isLoading && (
        <>
          <UncertaintyDisplay uncertainty={insights?.uncertainty ?? null} />
          <CausalInsights summary={insights?.causal_summary ?? null} />
          <BettingAgentPanel recommendation={insights?.rl_recommendation ?? null} />
        </>
      )}

      {/* ExplainPanel — feature contributions */}
      {!isLoading && insights?.explanation && (() => {
        const exp = insights.explanation
        // Support both synthetic {top_features:[{name,impact}]} and ModelExplainer {top_contributions:[...]} formats
        type FeatureBar = { name: string; impact: number }
        let bars: FeatureBar[] = []
        if (Array.isArray(exp.top_contributions) && exp.top_contributions.length > 0) {
          bars = (exp.top_contributions as Array<{ feature: string; value: number }>)
            .slice(0, 8)
            .map(c => ({ name: c.feature, impact: c.value }))
        } else if (Array.isArray(exp.top_features) && exp.top_features.length > 0) {
          bars = (exp.top_features as Array<{ name: string; impact: number }>).slice(0, 8)
        } else if (exp.feature_importance && typeof exp.feature_importance === 'object') {
          bars = Object.entries(exp.feature_importance as Record<string, number>)
            .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
            .slice(0, 8)
            .map(([name, impact]) => ({ name, impact }))
        }
        if (bars.length === 0) return null
        const maxAbs = Math.max(...bars.map(b => Math.abs(b.impact)), 1e-6)
        return (
          <div className="glass-card p-4 sm:p-6 border border-purple-500/20">
            <h3 className="text-h3 mb-5 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Feature Contributions
            </h3>
            <div className="space-y-3">
              {bars.map((bar, i) => {
                const pct = (Math.abs(bar.impact) / maxAbs) * 100
                const positive = bar.impact >= 0
                return (
                  <div key={i} className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                    <div className="w-24 sm:w-40 truncate text-slate-300 text-right" title={bar.name}>
                      {bar.name.replace(/_/g, ' ')}
                    </div>
                    <div className="flex-1 flex items-center gap-1">
                      {!positive && (
                        <div
                          className="h-3 rounded bg-red-500/70 transition-all duration-500"
                          style={{ width: `${pct}%`, marginLeft: `${100 - pct}%` }}
                        />
                      )}
                      {positive && (
                        <div
                          className="h-3 rounded bg-indigo-500/70 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      )}
                    </div>
                    <div className={`w-14 text-right font-mono text-xs ${positive ? 'text-indigo-400' : 'text-red-400'}`}>
                      {bar.impact >= 0 ? '+' : ''}{bar.impact.toFixed(3)}
                    </div>
                  </div>
                )
              })}
            </div>
            {exp.summary && (
              <p className="mt-4 text-xs text-slate-500">{exp.summary as string}</p>
            )}
          </div>
        )
      })()}

      {/* Key Takeaways */}
      <div className="glass-card p-4 sm:p-6 border border-indigo-500/20">
        <h3 className="text-h3 mb-6 flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Key Takeaways
        </h3>
        {isLoading ? (
          <div className="space-y-3">
            <div className="shimmer h-4 w-full rounded"></div>
            <div className="shimmer h-4 w-3/4 rounded"></div>
            <div className="shimmer h-4 w-5/6 rounded"></div>
          </div>
        ) : prediction && valueAnalysis ? (
          <div className="space-y-3 text-sm text-slate-300">
            <p>
              • <strong className="text-indigo-400">{prediction.prediction.replace('_', ' ')}</strong> has a{' '}
              {prediction.confidence > 0.7 ? 'strong' : prediction.confidence > 0.6 ? 'moderate' : 'slight'} edge with{' '}
              {(prediction.confidence * 100).toFixed(0)}% model confidence
            </p>
            <p>
              •{' '}
              {valueBets.length > 0
                ? `Found ${valueBets.length} value bet${valueBets.length > 1 ? 's' : ''} with positive expected value`
                : valueAnalysis.summary || 'No clear value opportunities identified in current market'}
            </p>
            {xgAnalysis && (
              <p>
                • Expected Goals: {homeTeamName} {xgAnalysis.home_xg.toFixed(1)} - {xgAnalysis.away_xg.toFixed(1)} {awayTeamName}
                {' '}(Total: {xgAnalysis.total_xg.toFixed(1)} goals)
              </p>
            )}
            {riskAssessment && (
              <p>
                • Risk Level: <span className={
                  riskAssessment.risk_level === 'low' ? 'text-green-400' :
                  riskAssessment.risk_level === 'medium' ? 'text-yellow-400' : 'text-red-400'
                }>{riskAssessment.risk_level.toUpperCase()}</span> - {riskAssessment.recommendation}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-400">Insights unavailable.</p>
        )}
      </div>

      {/* Value Bets */}
      <div className="glass-card p-4 sm:p-6">
        <h3 className="text-h3 mb-6">Value Betting Opportunities</h3>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="glass-card p-4 border border-green-500/20">
                <div className="flex justify-between items-start mb-2">
                  <div className="shimmer h-4 w-20 rounded"></div>
                  <div className="shimmer h-5 w-12 rounded"></div>
                </div>
                <div className="shimmer h-4 w-24 mb-2 rounded"></div>
                <div className="flex justify-between items-center">
                  <div className="shimmer h-4 w-16 rounded"></div>
                  <div className="shimmer h-5 w-14 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        ) : valueAnalysis ? (
          valueBets.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {valueBets.map((bet, index) => (
                <div key={index} className="glass-card p-4 border border-green-500/20">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold">{bet.bet_type.replace('_', ' ')}</span>
                    <span className="text-green-400 font-bold">{bet.market_odds.toFixed(2)}</span>
                  </div>
                  <div className="space-y-1 mb-3">
                    <p className="text-xs text-gray-400">
                      Model Prob: {formatPercent(bet.model_prob)} | Market Prob: {formatPercent(bet.market_prob)}
                    </p>
                    <p className="text-xs text-gray-400">
                      Edge: {formatPercent(bet.edge, 2)} | Value: {bet.value_pct.toFixed(1)}%
                    </p>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">EV: {formatPercent(bet.expected_value)}</span>
                    <span className="text-xs text-gray-400">Kelly: {bet.kelly_stake.toFixed(2)}</span>
                  </div>
                  <div className="mt-2">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        bet.quality.tier === 'Excellent' || bet.quality.tier === 'Good'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}
                    >
                      {bet.recommendation}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center">
              {valueAnalysis.summary || 'No clear value bets identified for this matchup.'}
            </p>
          )
        ) : (
          <p className="text-gray-400 text-center">Value betting data unavailable.</p>
        )}
      </div>

      {/* Monte Carlo Simulation & Scenarios */}
      <div className="glass-card p-4 sm:p-6">
        <h3 className="text-h3 mb-6">Monte Carlo Simulation</h3>
        {isLoading ? (
          <div className="space-y-3">
            <div className="shimmer h-4 w-full rounded"></div>
            <div className="shimmer h-4 w-3/4 rounded"></div>
          </div>
        ) : insights?.monte_carlo ? (
          <div>
            <p className="text-sm text-gray-400 mb-4">
              Based on {insights.monte_carlo.simulations.toLocaleString()} simulations
            </p>
            <div className="space-y-3">
              {Object.entries(insights.monte_carlo.distribution).map(([outcome, prob]) => (
                <div key={outcome} className="flex items-center space-x-2">
                  <div className="w-24 text-sm capitalize">{outcome.replace('_', ' ')}</div>
                  <div className="flex-1 bg-gray-700 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-indigo-500 to-purple-500 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${prob * 100}%` }}
                    ></div>
                  </div>
                  <div className="w-16 text-right text-sm font-semibold">
                    {formatPercent(prob, 1)}
                  </div>
                </div>
              ))}
            </div>
            {insights.scenarios && insights.scenarios.length > 0 && (
              <div className="mt-6">
                <h4 className="font-semibold mb-3">Predicted Scenarios</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {insights.scenarios.map((scenario, idx) => (
                    <div key={idx} className="glass-card p-3 border border-indigo-500/20">
                      <div className="text-sm font-semibold mb-1">{scenario.name}</div>
                      <div className="text-xs text-gray-400 mb-2">
                        Probability: {formatPercent(scenario.probability)}
                      </div>
                      <div className="text-center text-lg font-bold text-indigo-400">
                        {scenario.home_score} - {scenario.away_score}
                      </div>
                      <div className="text-xs text-center text-gray-400 mt-1 capitalize">
                        {scenario.result.replace('_', ' ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-400">Simulation data unavailable.</p>
        )}
      </div>

      {/* Narrative Summary */}
      {insights?.narrative && (
        <div className="glass-card p-4 sm:p-6 border border-purple-500/20">
          <h3 className="text-h3 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Analysis Summary
          </h3>
          <p className="text-sm text-slate-300 leading-relaxed">{insights.narrative}</p>
        </div>
      )}

      {/* Risk Assessment & Additional Details */}
      <div className="glass-card p-4 sm:p-6">
        <h3 className="text-h3 mb-6">Risk Assessment & Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold mb-4">Risk Analysis</h4>
            {isLoading ? (
              <div className="space-y-3">
                <div className="shimmer h-4 w-24 rounded"></div>
                <div className="shimmer h-4 w-32 rounded"></div>
              </div>
            ) : riskAssessment ? (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span>Risk Level</span>
                  <span className={`font-bold ${
                    riskAssessment.risk_level === 'low' ? 'text-green-400' :
                    riskAssessment.risk_level === 'medium' ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {riskAssessment.risk_level.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Confidence Score</span>
                  <span>{formatPercent(riskAssessment.confidence_score)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Value Available</span>
                  <span className={riskAssessment.value_available ? 'text-green-400' : 'text-red-400'}>
                    {riskAssessment.value_available ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="mt-3 p-3 bg-indigo-500/10 rounded border border-indigo-500/20">
                  <div className="text-xs text-gray-400 mb-1">Recommendation</div>
                  <div className="font-semibold">{riskAssessment.recommendation}</div>
                </div>
              </div>
            ) : null}
          </div>
          <div>
            <h4 className="font-semibold mb-4">Match Details</h4>
            {isLoading ? (
              <div className="space-y-3">
                <div className="shimmer h-4 w-28 rounded"></div>
                <div className="shimmer h-4 w-40 rounded"></div>
              </div>
            ) : insights ? (
              <div className="space-y-3 text-sm text-slate-300">
                <div className="flex justify-between">
                  <span>Home Team</span>
                  <span className="text-indigo-400">{insights.metadata.home_team}</span>
                </div>
                <div className="flex justify-between">
                  <span>Away Team</span>
                  <span className="text-green-400">{insights.metadata.away_team}</span>
                </div>
                <div className="flex justify-between">
                  <span>League</span>
                  <span>{insights.league}</span>
                </div>
                <div className="flex justify-between">
                  <span>Confidence Level</span>
                  <span>{formatPercent(insights.confidence_level)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Generated</span>
                  <span className="text-gray-400">{new Date(insights.generated_at).toLocaleString()}</span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export default memo(InsightsDisplay)
