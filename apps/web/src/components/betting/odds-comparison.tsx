/**
 * Odds Comparison Component
 * 
 * Displays aggregated odds from multiple sources with best price highlighting.
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Clock, AlertCircle } from 'lucide-react';
import type { AggregatedOdds, CLVMetrics } from '@/lib/betting/free-odds-aggregator';

interface OddsComparisonProps {
  odds: AggregatedOdds;
  clv?: CLVMetrics;
}

export function OddsComparison({ odds, clv }: OddsComparisonProps) {
  const { bestHome, bestDraw, bestAway, sources, spread, liquidity } = odds;
  
  // Get latest update time from sources
  const lastUpdate = Math.max(...sources.map(s => s.timestamp), Date.now());
  
  // Create bestOdds object for display
  const bestOdds = {
    home: bestHome.home,
    draw: bestDraw.draw,
    away: bestAway.away,
  };
  
  // Best source names
  const bestSources = {
    home: bestHome.name,
    draw: bestDraw.name,
    away: bestAway.name,
  };

  // Average spread across markets for display
  const averageSpread = (spread.home + spread.draw + spread.away) / 3;
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-lg"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Best Odds
        </h3>
        <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
          <Clock className="w-3 h-3" />
          {new Date(lastUpdate).toLocaleTimeString()}
        </div>
      </div>
      
      {/* Best Odds Grid */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <OddsCard
          label="Home"
          odds={bestOdds.home}
          source={bestSources.home}
          isBest={true}
        />
        <OddsCard
          label="Draw"
          odds={bestOdds.draw}
          source={bestSources.draw}
          isBest={true}
        />
        <OddsCard
          label="Away"
          odds={bestOdds.away}
          source={bestSources.away}
          isBest={true}
        />
      </div>
      
      {/* All Sources */}
      <div className="space-y-2 mb-4">
        <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          All Sources ({sources.length})
        </h4>
        {sources.map((source, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50"
          >
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 capitalize">
              {source.name}
            </span>
            <div className="flex gap-4 text-sm">
              <span className={source.home === bestOdds.home ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-neutral-600 dark:text-neutral-400'}>
                {typeof source.home === 'number' ? source.home.toFixed(2) : 'N/A'}
              </span>
              <span className={source.draw === bestOdds.draw ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-neutral-600 dark:text-neutral-400'}>
                {typeof source.draw === 'number' ? source.draw.toFixed(2) : 'N/A'}
              </span>
              <span className={source.away === bestOdds.away ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-neutral-600 dark:text-neutral-400'}>
                {typeof source.away === 'number' ? source.away.toFixed(2) : 'N/A'}
              </span>
            </div>
          </div>
        ))}
      </div>
      
      {/* Metadata */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
        <div>
          <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">
            Spread
          </div>
          <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {typeof averageSpread === 'number' ? (averageSpread * 100).toFixed(1) : '0.0'}%
          </div>
        </div>
        
        <div>
          <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">
            Liquidity
          </div>
          <div className={`text-sm font-medium capitalize ${
            liquidity === 'high' 
              ? 'text-emerald-600 dark:text-emerald-400'
              : liquidity === 'medium'
              ? 'text-yellow-600 dark:text-yellow-400'
              : 'text-red-600 dark:text-red-400'
          }`}>
            {liquidity}
          </div>
        </div>
      </div>
      
      {/* CLV Metrics */}
      {clv && (
        <div className="mt-4 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
              Closing Line Value
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-xs text-neutral-600 dark:text-neutral-400">CLV</div>
              <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                {typeof clv.clv === 'number' ? clv.clv.toFixed(1) : '0.0'}%
              </div>
            </div>
            <div>
              <div className="text-xs text-neutral-600 dark:text-neutral-400">Interpretation</div>
              <div className="font-semibold capitalize text-neutral-900 dark:text-neutral-100">
                {clv.interpretation}
              </div>
            </div>
            <div>
              <div className="text-xs text-neutral-600 dark:text-neutral-400">Movement</div>
              <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                {typeof clv.oddsMovement.change === 'number' ? clv.oddsMovement.change.toFixed(2) : '0.00'}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Warning for low liquidity */}
      {liquidity === 'low' && (
        <div className="mt-4 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
          <p className="text-xs text-yellow-700 dark:text-yellow-400">
            Low liquidity detected. Odds may be less reliable. Consider waiting for more sources.
          </p>
        </div>
      )}
    </motion.div>
  );
}

interface OddsCardProps {
  label: string;
  odds: number | null;
  source: string;
  isBest: boolean;
}

function OddsCard({ label, odds, source, isBest }: OddsCardProps) {
  return (
    <div className={`p-4 rounded-lg ${
      isBest 
        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-500 dark:border-emerald-400'
        : 'bg-neutral-50 dark:bg-neutral-800/50'
    }`}>
      <div className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
        {label}
      </div>
      <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-1">
        {typeof odds === 'number' ? odds.toFixed(2) : 'N/A'}
      </div>
      <div className="text-xs text-neutral-600 dark:text-neutral-400 capitalize">
        {source}
      </div>
    </div>
  );
}

export function OddsComparisonSkeleton() {
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-lg animate-pulse">
      <div className="h-6 bg-neutral-200 dark:bg-neutral-800 rounded w-1/4 mb-4" />
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="h-24 bg-neutral-200 dark:bg-neutral-800 rounded" />
        <div className="h-24 bg-neutral-200 dark:bg-neutral-800 rounded" />
        <div className="h-24 bg-neutral-200 dark:bg-neutral-800 rounded" />
      </div>
      <div className="space-y-2">
        <div className="h-12 bg-neutral-200 dark:bg-neutral-800 rounded" />
        <div className="h-12 bg-neutral-200 dark:bg-neutral-800 rounded" />
      </div>
    </div>
  );
}
