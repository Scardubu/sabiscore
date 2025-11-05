"use client";

import React, { useState } from 'react';
import { TrendingUp, AlertCircle, Copy, Check, ExternalLink } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatCurrency } from '../lib/format';

interface ValueBet {
  match_id: string;
  home_team: string;
  away_team: string;
  market: 'home' | 'draw' | 'away';
  fair_probability: number;
  bookmaker_odds: number;
  implied_probability: number;
  edge_percentage: number;
  kelly_stake_percentage: number;
  recommended_stake: number;
  quality: 'PREMIUM' | 'VALUE' | 'MARGINAL' | 'AVOID';
  bookmaker: string;
  clv_expected?: number;
}

interface ValueBetCardProps {
  bet: ValueBet;
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
export function ValueBetCard({ bet, bankroll = 1000 }: ValueBetCardProps) {
  const [copied, setCopied] = useState(false);

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

  const getMarketLabel = (market: string) => {
    switch (market) {
      case 'home':
        return `${bet.home_team} Win`;
      case 'away':
        return `${bet.away_team} Win`;
      default:
        return 'Draw';
    }
  };

  const stakeValue = bet.recommended_stake * bankroll;
  const potentialReturnValue = stakeValue * bet.bookmaker_odds;
  const potentialProfitValue = potentialReturnValue - stakeValue;
  const stakeAmount = stakeValue.toFixed(2);
  const potentialReturn = potentialReturnValue.toFixed(2);
  const potentialProfit = potentialProfitValue.toFixed(2);

  const copyBetDetails = async () => {
  const betDetails = `
🎯 VALUE BET ALERT
${bet.home_team} vs ${bet.away_team}
Market: ${getMarketLabel(bet.market)}
Odds: ${bet.bookmaker_odds.toFixed(2)} @ ${bet.bookmaker}
Edge: ${bet.edge_percentage.toFixed(1)}%
Recommended Stake: ${formatCurrency(stakeValue)} (${(bet.kelly_stake_percentage * 100).toFixed(1)}% of bankroll)
Potential Return: ${formatCurrency(potentialReturnValue)}
Quality: ${bet.quality}
${bet.clv_expected ? `Expected CLV: ${bet.clv_expected.toFixed(1)}¢` : ''}
    `.trim();

    try {
      await navigator.clipboard.writeText(betDetails);
      setCopied(true);
      toast.success('Bet details copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy bet details');
    }
  };

  const openBookmaker = () => {
    toast.success(`Opening ${bet.bookmaker}...`);
    // In production, open bookmaker deep link
    // window.open(`https://${bet.bookmaker}.com/match/${bet.match_id}`, '_blank');
  };

  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-6 backdrop-blur-sm transition-all hover:border-green-500/50 hover:shadow-lg hover:shadow-green-500/20">
      {/* Quality Badge */}
      <div className="absolute right-4 top-4">
        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${getQualityColor(bet.quality)}`}>
          {bet.quality}
        </span>
      </div>

      {/* Match Info */}
      <div className="mb-4">
        <h3 className="text-lg font-bold text-white">
          {bet.home_team} vs {bet.away_team}
        </h3>
        <p className="text-sm text-slate-400">
          {getMarketLabel(bet.market)} @ {bet.bookmaker}
        </p>
      </div>

      {/* Edge Display */}
      <div className="mb-4 grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-slate-800/50 p-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <TrendingUp className="h-4 w-4" />
            <span>Edge</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-green-400">
            +{bet.edge_percentage.toFixed(1)}%
          </p>
        </div>

        <div className="rounded-lg bg-slate-800/50 p-3">
          <div className="text-xs text-slate-400">Odds</div>
          <p className="mt-1 text-2xl font-bold text-white">
            {bet.bookmaker_odds.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Stake Recommendation */}
      <div className="mb-4 rounded-lg border border-slate-700/50 bg-slate-900/50 p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-300">Recommended Stake</span>
          <span className="text-xs text-slate-500">
            {(bet.kelly_stake_percentage * 100).toFixed(1)}% Kelly
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
            {(bet.fair_probability * 100).toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Implied Probability</span>
          <span className="font-medium text-slate-500">
            {(bet.implied_probability * 100).toFixed(1)}%
          </span>
        </div>
        {bet.clv_expected && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Expected CLV</span>
            <span className="font-medium text-blue-400">
              +{bet.clv_expected.toFixed(1)}¢
            </span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={copyBetDetails}
          className="flex items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-slate-700 active:scale-95"
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
          className="flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-green-700 active:scale-95"
        >
          <ExternalLink className="h-4 w-4" />
          Place Bet
        </button>
      </div>

      {/* Warning for MARGINAL/AVOID */}
      {(bet.quality === 'MARGINAL' || bet.quality === 'AVOID') && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-yellow-400" />
          <p className="text-xs text-yellow-300">
            {bet.quality === 'MARGINAL' 
              ? 'Edge is marginal. Consider waiting for better opportunities.'
              : 'Edge below threshold. Not recommended for betting.'}
          </p>
        </div>
      )}
    </div>
  );
}
