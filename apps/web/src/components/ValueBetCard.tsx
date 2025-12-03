"use client";

import { useState } from 'react';
import { TrendingUp, AlertCircle, Copy, Check, ExternalLink } from 'lucide-react';
import { toast } from 'react-hot-toast';
import type { ValueBet } from '@/types/value-bet';
import { formatCurrency } from '../lib/format';
import { safeMessage } from '../lib/error-utils';
import { KellyTooltip, EdgeTooltip } from './ui/ResponsibleGamblingTooltip';
import { TeamVsDisplay } from './team-display';
import { FeatureFlag, useFeatureFlag } from '@/lib/feature-flags';
import { cn } from '@/lib/utils';

interface ValueBetContext {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  bookmaker?: string;
  clvExpected?: number | null;
}

// Safe defaults for ValueBet fields to prevent runtime errors
const getValueBetDefaults = (bet: ValueBet) => ({
  betType: bet.bet_type ?? 'unknown',
  marketOdds: bet.market_odds ?? 1.0,
  modelProb: bet.model_prob ?? 0,
  marketProb: bet.market_prob ?? 0,
  edge: bet.edge ?? bet.value_pct ?? 0,
  kellyStake: bet.kelly_stake ?? 0,
  qualityTier: bet.quality?.tier ?? 'VALUE',
  recommendation: bet.quality?.recommendation ?? bet.recommendation ?? 'Evaluate carefully',
});

interface ValueBetCardProps {
  bet: ValueBet;
  context: ValueBetContext;
  bankroll?: number;
}

/**
 * ValueBetCard Component
 * 
 * One-click bet slip integration with:
 * - Edge percentage display
 * - Kelly stake recommendation
 * - Quality badge (PREMIUM/VALUE/MARGINAL)
 * - Copy bet details to clipboard
 * - Direct bookmaker link
 * - CLV (Closing Line Value) projection
 */
export function ValueBetCard({ bet, context, bankroll = 1000 }: ValueBetCardProps) {
  const [copied, setCopied] = useState(false);
  const bookmakerName = context.bookmaker ?? 'Preferred Book';
  const premiumVisualsEnabled = useFeatureFlag(FeatureFlag.PREMIUM_VISUAL_HIERARCHY);
  
  // Apply safe defaults to prevent undefined/null errors
  const safe = getValueBetDefaults(bet);

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'PREMIUM':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'VALUE':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'MARGINAL':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default:
        return 'bg-red-500/20 text-red-400 border-red-500/30';
    }
  };

  const getMarketLabel = () => {
    switch (safe.betType) {
      case 'home_win':
        return `${context.homeTeam} Win`;
      case 'away_win':
        return `${context.awayTeam} Win`;
      case 'draw':
        return 'Draw';
      default:
        return safe.betType.replace(/_/g, ' ');
    }
  };

  const kellyFraction = Math.max(safe.kellyStake, 0);
  const stakeValue = bankroll * kellyFraction;
  const bookmakerOdds = safe.marketOdds;
  const potentialReturnValue = stakeValue * bookmakerOdds;
  const potentialProfitValue = potentialReturnValue - stakeValue;
  const fairProbability = safe.modelProb;
  const impliedProbability = safe.marketProb;
  const edgePercentage = safe.edge * 100;
  const qualityTier = safe.qualityTier;

  const copyBetDetails = async () => {
    const betDetails = `
🎯 VALUE BET ALERT
${context.homeTeam} vs ${context.awayTeam}
Market: ${getMarketLabel()}
Odds: ${bookmakerOdds.toFixed(2)} @ ${bookmakerName}
Edge: ${edgePercentage.toFixed(1)}%
Recommended Stake: ${formatCurrency(stakeValue)} (${(kellyFraction * 100).toFixed(1)}% of bankroll)
Potential Return: ${formatCurrency(potentialReturnValue)}
Quality: ${qualityTier}
${context.clvExpected ? `Expected CLV: ${context.clvExpected.toFixed(1)}¢` : ''}
    `.trim();

    try {
      if (!navigator?.clipboard) {
        throw new Error('Clipboard API not available');
      }
      await navigator.clipboard.writeText(betDetails);
      setCopied(true);
      toast.success(safeMessage('Bet details copied to clipboard!'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(safeMessage('Failed to copy bet details'));
    }
  };

  const openBookmaker = () => {
    toast.success(safeMessage(`Opening ${bookmakerName}...`));
    // In production, open bookmaker deep link
    // window.open(`https://${bookmakerName}.com/match/${context.matchId}`, '_blank');
  };

  return (
    <div className={cn(
      "group relative overflow-hidden rounded-xl border p-6 backdrop-blur-sm transition-all",
      premiumVisualsEnabled
        ? "border-white/10 bg-gradient-to-br from-slate-950/80 to-slate-900/60 hover:border-cyan-400/40 hover:shadow-[0_15px_45px_rgba(0,212,255,0.25)]"
        : "border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/50 hover:border-green-500/50 hover:shadow-lg hover:shadow-green-500/20"
    )}>
      {/* Quality Badge */}
      <div className="absolute right-4 top-4">
        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${getQualityColor(qualityTier)}`}>
          {qualityTier}
        </span>
      </div>

      {/* Match Info */}
      <div className="mb-4">
        <div className="mb-1">
          <TeamVsDisplay 
            homeTeam={context.homeTeam}
            awayTeam={context.awayTeam}
            size="sm"
            showCountryFlags={false}
            className="justify-start"
          />
        </div>
        <p className="text-sm text-slate-400">
          {getMarketLabel()} @ {bookmakerName}
        </p>
      </div>

      {/* Edge Display */}
      <div className="mb-4 grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-slate-800/50 p-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <TrendingUp className="h-4 w-4" />
            <span>Edge</span>
            <EdgeTooltip />
          </div>
          <p className="mt-1 text-2xl font-bold text-green-400">
            +{edgePercentage.toFixed(1)}%
          </p>
        </div>

        <div className="rounded-lg bg-slate-800/50 p-3">
          <div className="text-xs text-slate-400">Odds</div>
          <p className="mt-1 text-2xl font-bold text-white">
            {bookmakerOdds.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Stake Recommendation */}
      <div className="mb-4 rounded-lg border border-slate-700/50 bg-slate-900/50 p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-slate-300">Recommended Stake</span>
            <KellyTooltip />
          </div>
          <span className="text-xs text-slate-500">
            {(kellyFraction * 100).toFixed(1)}% Kelly
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-white">{formatCurrency(stakeValue)}</span>
          <span className="text-sm text-slate-400">
            → {formatCurrency(potentialReturnValue)} return
          </span>
        </div>
        <div className="mt-2 text-xs text-green-400">
          Potential profit: {formatCurrency(potentialProfitValue)}
        </div>
      </div>

      {/* Probability Breakdown */}
      <div className="mb-4 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Fair Probability</span>
          <span className="font-medium text-white">
            {(fairProbability * 100).toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Implied Probability</span>
          <span className="font-medium text-slate-500">
            {(impliedProbability * 100).toFixed(1)}%
          </span>
        </div>
        {typeof context.clvExpected === 'number' && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Expected CLV</span>
            <span className="font-medium text-blue-400">
              +{context.clvExpected.toFixed(1)}¢
            </span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={copyBetDetails}
          className={cn(
            "flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all active:scale-95",
            premiumVisualsEnabled
              ? "border-white/10 bg-slate-900/60 text-slate-200 hover:border-cyan-400/30 hover:bg-cyan-400/10"
              : "border-slate-600 bg-slate-700/50 text-white hover:bg-slate-700"
          )}
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copy
            </>
          )}
        </button>

        <button
          onClick={openBookmaker}
          className={cn(
            "flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all active:scale-95",
            premiumVisualsEnabled
              ? "bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-[0_8px_20px_rgba(0,212,255,0.3)] hover:scale-[1.02]"
              : "bg-green-600 text-white hover:bg-green-700"
          )}
        >
          <ExternalLink className="h-4 w-4" />
          Place Bet
        </button>
      </div>

      {/* Warning for MARGINAL/AVOID */}
      {(qualityTier === 'MARGINAL' || qualityTier === 'AVOID') && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-yellow-400" />
          <p className="text-xs text-yellow-300">
            {qualityTier === 'MARGINAL' 
              ? 'Edge is marginal. Consider waiting for better opportunities.'
              : 'Edge below threshold. Not recommended for betting.'}
          </p>
        </div>
      )}
    </div>
  );
}
