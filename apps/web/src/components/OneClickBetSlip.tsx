/**
 * OneClickBetSlip - Interactive bet slip with scenario simulators
 * Displays value bets with Smart Kelly stakes and real-time CLV tracking
 */

'use client';

import { useState } from 'react';
import { formatNaira } from '@/lib/currency';

interface ValueBet {
  match: string;
  home_team: string;
  away_team: string;
  market: string;
  odds: number;
  edge_percent: number;
  kelly_stake_ngn: number;
  clv_ngn: number;
  confidence: number;
  brier_score: number;
}

interface OneClickBetSlipProps {
  valueBet: ValueBet;
  bankroll: number;
}

export function OneClickBetSlip({ valueBet, bankroll }: OneClickBetSlipProps) {
  const [scenarioMode, setScenarioMode] = useState<string | null>(null);
  const [simulated, setSimulated] = useState<ValueBet>(valueBet);

  const runScenario = (scenario: string) => {
    setScenarioMode(scenario);
    
    // Simulate scenario impact on bet
    const scenarios: Record<string, Partial<ValueBet>> = {
      red_card: {
        edge_percent: valueBet.edge_percent * 0.7, // 30% edge reduction
        confidence: valueBet.confidence * 0.85,
        kelly_stake_ngn: valueBet.kelly_stake_ngn * 0.6,
      },
      injury: {
        edge_percent: valueBet.edge_percent * 0.8,
        confidence: valueBet.confidence * 0.9,
        kelly_stake_ngn: valueBet.kelly_stake_ngn * 0.7,
      },
      weather: {
        edge_percent: valueBet.edge_percent * 0.92, // Rain reduces xG
        confidence: valueBet.confidence * 0.95,
        kelly_stake_ngn: valueBet.kelly_stake_ngn * 0.85,
      },
    };

    const adjustment = scenarios[scenario] || {};
    setSimulated({ ...valueBet, ...adjustment });
  };

  const resetScenario = () => {
    setScenarioMode(null);
    setSimulated(valueBet);
  };

  const currentBet = scenarioMode ? simulated : valueBet;

  return (
    <div className="max-w-md mx-auto p-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-slate-700 shadow-2xl">
      {/* Match Header */}
      <div className="text-center space-y-2 mb-6">
        <h3 className="text-2xl font-bold text-white">
          {currentBet.home_team} vs {currentBet.away_team}
        </h3>
        <p className="text-slate-400 text-sm">{currentBet.market}</p>
      </div>

      {/* Value Indicators */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
          <p className="text-xs text-green-400 uppercase tracking-wide">Edge</p>
          <p className="text-2xl font-black text-green-400">
            +{currentBet.edge_percent.toFixed(1)}%
          </p>
          <p className="text-xs text-slate-400 mt-1">EV</p>
        </div>
        
        <div className="p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
          <p className="text-xs text-indigo-400 uppercase tracking-wide">Live CLV</p>
          <p className="text-2xl font-black text-indigo-400">
            {formatNaira(currentBet.clv_ngn)}
          </p>
          <p className="text-xs text-slate-400 mt-1">vs Pinnacle</p>
        </div>
      </div>

      {/* Bet Details */}
      <div className="space-y-3 mb-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
        <div className="flex justify-between">
          <span className="text-slate-400">Odds:</span>
          <span className="text-white font-semibold">{currentBet.odds.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Kelly Stake (⅛):</span>
          <span className="text-green-400 font-bold text-lg">
            {formatNaira(currentBet.kelly_stake_ngn)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">From Bankroll:</span>
          <span className="text-slate-300">
            {((currentBet.kelly_stake_ngn / bankroll) * 100).toFixed(1)}%
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Confidence:</span>
          <span className="text-blue-400 font-semibold">
            {(currentBet.confidence * 100).toFixed(1)}%
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Brier Score:</span>
          <span className="text-purple-400">
            {currentBet.brier_score.toFixed(3)}
          </span>
        </div>
      </div>

      {/* Scenario Simulator */}
      <div className="mb-6">
        <p className="text-sm text-slate-400 mb-3 font-semibold">What If Scenarios:</p>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => runScenario('red_card')}
            className={`p-2 rounded-lg text-xs font-medium transition-all ${
              scenarioMode === 'red_card'
                ? 'bg-red-500 text-white'
                : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
            }`}
          >
            🟥 Red Card
          </button>
          <button
            onClick={() => runScenario('injury')}
            className={`p-2 rounded-lg text-xs font-medium transition-all ${
              scenarioMode === 'injury'
                ? 'bg-orange-500 text-white'
                : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
            }`}
          >
            🏥 Injury
          </button>
          <button
            onClick={() => runScenario('weather')}
            className={`p-2 rounded-lg text-xs font-medium transition-all ${
              scenarioMode === 'weather'
                ? 'bg-blue-500 text-white'
                : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
            }`}
          >
            🌧️ Rain
          </button>
        </div>
        {scenarioMode && (
          <button
            onClick={resetScenario}
            className="mt-2 w-full p-2 bg-slate-700 text-slate-300 rounded-lg text-xs hover:bg-slate-600 transition-colors"
          >
            Reset to Original
          </button>
        )}
      </div>

      {/* Quick Actions */}
      <div className="space-y-2">
        <button
          onClick={() => {
            const betfairUrl = `https://www.betfair.com/exchange/plus/en/football-betting-${currentBet.match.toLowerCase().replace(' ', '-')}`;
            window.open(betfairUrl, '_blank');
          }}
          className="w-full py-3 bg-gradient-to-r from-yellow-600 to-yellow-500 text-white font-bold rounded-lg hover:from-yellow-500 hover:to-yellow-400 transition-all shadow-lg"
        >
          📋 Copy Betfair Lay URL
        </button>
        
        <button
          onClick={() => {
            const pinnacleUrl = `https://www.pinnacle.com/en/soccer/${currentBet.match}`;
            window.open(pinnacleUrl, '_blank');
          }}
          className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-bold rounded-lg hover:from-indigo-500 hover:to-indigo-400 transition-all shadow-lg"
        >
          🎟️ Copy Pinnacle Ticket
        </button>
      </div>

      {/* Scenario Warning */}
      {scenarioMode && (
        <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <p className="text-xs text-amber-400">
            ⚠️ Scenario simulation active. Edge and stake adjusted based on {scenarioMode.replace('_', ' ')} impact.
          </p>
        </div>
      )}
    </div>
  );
}
