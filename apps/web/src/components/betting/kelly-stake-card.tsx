/**
 * Kelly Stake Card
 * 
 * Displays betting recommendations with Kelly criterion optimization.
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, AlertTriangle, DollarSign, BarChart3 } from 'lucide-react';
import type { BettingRecommendation, MonteCarloResult } from '@/lib/betting/kelly-optimizer';

interface KellyStakeCardProps {
  recommendation: BettingRecommendation;
  monteCarlo?: MonteCarloResult;
  currency?: string;
  currencySymbol?: string;
}

export function KellyStakeCard({
  recommendation,
  monteCarlo,
  currency = 'NGN',
  currencySymbol = '₦',
}: KellyStakeCardProps) {
  const { recommendation: shouldBet, stake, edge, expectedValue, riskLevel } = recommendation;
  const isBet = shouldBet === 'bet';
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-lg"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Kelly Recommendation
        </h3>
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${
          isBet 
            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
        }`}>
          {isBet ? 'VALUE BET' : 'NO BET'}
        </div>
      </div>
      
      {isBet ? (
        <>
          {/* Stake */}
          <div className="mb-6">
            <div className="flex items-baseline gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
                {currencySymbol}{stake.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                (Optimal Kelly Stake)
              </span>
            </div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400">
              Risk Profile: <span className="font-medium capitalize">{riskLevel}</span>
            </div>
          </div>
          
          {/* Edge & EV */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  Edge
                </span>
              </div>
              <div className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                {(edge * 100).toFixed(1)}%
              </div>
            </div>
            
            <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  Expected Value
                </span>
              </div>
              <div className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                {currencySymbol}{expectedValue.toFixed(0)}
              </div>
            </div>
          </div>
          
          {/* Monte Carlo Results */}
          {monteCarlo && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Monte Carlo Simulation (10,000 iterations)
              </h4>
              
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
                  <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">P5</div>
                  <div className="text-sm font-semibold text-red-700 dark:text-red-400">
                    {currencySymbol}{monteCarlo.p5.toFixed(0)}
                  </div>
                </div>
                
                <div className="text-center p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
                  <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">P50</div>
                  <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {currencySymbol}{monteCarlo.p50.toFixed(0)}
                  </div>
                </div>
                
                <div className="text-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                  <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">P95</div>
                  <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    {currencySymbol}{monteCarlo.p95.toFixed(0)}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <div>
                  <div className="text-xs text-neutral-600 dark:text-neutral-400">Win Rate</div>
                  <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {(monteCarlo.winRate * 100).toFixed(1)}%
                  </div>
                </div>
                
                <div>
                  <div className="text-xs text-neutral-600 dark:text-neutral-400">Sharpe Ratio</div>
                  <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {monteCarlo.sharpeRatio.toFixed(2)}
                  </div>
                </div>
                
                <div>
                  <div className="text-xs text-neutral-600 dark:text-neutral-400">Ruin Risk</div>
                  <div className={`text-sm font-medium ${
                    monteCarlo.ruinProbability > 0.01 
                      ? 'text-red-600 dark:text-red-400' 
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {(monteCarlo.ruinProbability * 100).toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="py-8 text-center">
          <AlertTriangle className="w-12 h-12 text-neutral-400 dark:text-neutral-600 mx-auto mb-3" />
          <p className="text-neutral-600 dark:text-neutral-400 text-sm">
            {recommendation.reasoning || 'No betting edge identified'}
          </p>
        </div>
      )}
    </motion.div>
  );
}

export function KellyStakeCardSkeleton() {
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-lg animate-pulse">
      <div className="h-6 bg-neutral-200 dark:bg-neutral-800 rounded w-1/3 mb-4" />
      <div className="h-10 bg-neutral-200 dark:bg-neutral-800 rounded w-1/2 mb-6" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-20 bg-neutral-200 dark:bg-neutral-800 rounded" />
        <div className="h-20 bg-neutral-200 dark:bg-neutral-800 rounded" />
      </div>
    </div>
  );
}
