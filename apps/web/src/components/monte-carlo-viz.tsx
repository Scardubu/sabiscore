/**
 * Monte Carlo Simulation Visualizer
 * 
 * Shows users 1000 possible match outcomes in real-time.
 * Provides visual representation of prediction uncertainty.
 * 
 * Impact: Great UX, helps users understand probability distributions
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, Pause, RotateCcw, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Simulation {
  outcome: 'home' | 'draw' | 'away';
  score: { home: number; away: number };
}

export interface MonteCarloVizProps {
  prediction: {
    homeWin: number;
    draw: number;
    awayWin: number;
  };
  homeTeam: string;
  awayTeam: string;
  iterations?: number;
}

export function MonteCarloVisualizer({
  prediction,
  homeTeam,
  awayTeam,
  iterations = 1000,
}: MonteCarloVizProps) {
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState({
    homeWins: 0,
    draws: 0,
    awayWins: 0,
  });
  
  const runSimulation = async () => {
    setRunning(true);
    setProgress(0);
    setSimulations([]);
    
    const sims: Simulation[] = [];
    const batchSize = 50;
    
    for (let i = 0; i < iterations; i += batchSize) {
      // Simulate batch
      for (let j = 0; j < batchSize && i + j < iterations; j++) {
        const random = Math.random();
        let outcome: 'home' | 'draw' | 'away';
        
        if (random < prediction.homeWin) {
          outcome = 'home';
        } else if (random < prediction.homeWin + prediction.draw) {
          outcome = 'draw';
        } else {
          outcome = 'away';
        }
        
        // Generate realistic score based on outcome
        const score = generateScore(outcome, prediction);
        
        sims.push({ outcome, score });
      }
      
      setProgress(((i + batchSize) / iterations) * 100);
      setSimulations([...sims]);
      
      // Yield to UI thread
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    // Calculate final results
    const homeWins = sims.filter(s => s.outcome === 'home').length;
    const draws = sims.filter(s => s.outcome === 'draw').length;
    const awayWins = sims.filter(s => s.outcome === 'away').length;
    
    setResults({ homeWins, draws, awayWins });
    setRunning(false);
    setProgress(100);
  };
  
  const reset = () => {
    setSimulations([]);
    setProgress(0);
    setResults({ homeWins: 0, draws: 0, awayWins: 0 });
  };
  
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-purple-500" />
            Monte Carlo Simulation
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={running ? () => setRunning(false) : runSimulation}
              disabled={running}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                running
                  ? 'bg-yellow-500/20 text-yellow-300 cursor-not-allowed'
                  : 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30'
              )}
            >
              {running ? (
                <>
                  <Pause className="h-4 w-4" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run {iterations.toLocaleString()} Simulations
                </>
              )}
            </button>
            <button
              onClick={reset}
              disabled={running}
              className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors disabled:opacity-50"
              title="Reset"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Progress Bar */}
        {running && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="text-purple-400 font-mono">{progress.toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        )}
        
        {/* Results Visualization */}
        {simulations.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-4">
              <SimulationBar
                label={homeTeam}
                count={results.homeWins}
                color="from-blue-500 to-cyan-500"
                total={simulations.length}
              />
              <SimulationBar
                label="Draw"
                count={results.draws}
                color="from-yellow-500 to-orange-500"
                total={simulations.length}
              />
              <SimulationBar
                label={awayTeam}
                count={results.awayWins}
                color="from-red-500 to-pink-500"
                total={simulations.length}
              />
            </div>
            
            {/* Score Distribution */}
            <ScoreDistribution simulations={simulations} />
            
            {/* Statistics */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-800">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">
                  {((results.homeWins / simulations.length) * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {homeTeam} Win Rate
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-400">
                  {((results.draws / simulations.length) * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Draw Rate
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-400">
                  {((results.awayWins / simulations.length) * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {awayTeam} Win Rate
                </div>
              </div>
            </div>
          </>
        )}
        
        {/* Empty State */}
        {simulations.length === 0 && !running && (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-500/20 mb-4">
              <TrendingUp className="h-8 w-8 text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Ready to Simulate</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Click &quot;Run Simulations&quot; to visualize {iterations.toLocaleString()} possible match outcomes
              based on the prediction probabilities.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper component for simulation bars
function SimulationBar({
  label,
  count,
  color,
  total,
}: {
  label: string;
  count: number;
  color: string;
  total: number;
}) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium truncate">{label}</span>
        <span className="text-muted-foreground ml-2">{count}</span>
      </div>
      <div className="relative h-32 bg-slate-800 rounded-lg overflow-hidden">
        <motion.div
          className={cn('absolute bottom-0 w-full bg-gradient-to-t', color)}
          initial={{ height: 0 }}
          animate={{ height: `${percentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
        <div className="absolute inset-0 flex items-end justify-center pb-2">
          <span className="text-lg font-bold text-white drop-shadow-lg">
            {percentage.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}

// Score distribution heatmap
function ScoreDistribution({ simulations }: { simulations: Simulation[] }) {
  // Count score occurrences
  const scoreMap = new Map<string, number>();
  
  simulations.forEach(sim => {
    const key = `${sim.score.home}-${sim.score.away}`;
    scoreMap.set(key, (scoreMap.get(key) || 0) + 1);
  });
  
  // Get top 10 most common scores
  const topScores = Array.from(scoreMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  if (topScores.length === 0) return null;
  
  const maxCount = topScores[0][1];
  
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">Most Likely Scores</h4>
      <div className="space-y-2">
        {topScores.map(([score, count]) => {
          const percentage = (count / simulations.length) * 100;
          const opacity = count / maxCount;
          
          return (
            <div key={score} className="flex items-center gap-3">
              <div className="w-16 text-sm font-mono text-right text-muted-foreground">
                {score}
              </div>
              <div className="flex-1 h-8 bg-slate-800 rounded-lg overflow-hidden relative">
                <motion.div
                  className="h-full bg-gradient-to-r from-purple-500/80 to-pink-500/80"
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%`, opacity }}
                  transition={{ duration: 0.5 }}
                />
                <div className="absolute inset-0 flex items-center px-3">
                  <span className="text-xs font-medium text-white drop-shadow">
                    {percentage.toFixed(1)}% ({count}x)
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Generate realistic score based on outcome
function generateScore(
  outcome: 'home' | 'draw' | 'away',
  _prediction: { homeWin: number; draw: number; awayWin: number }
): { home: number; away: number } {
  // Use Poisson-like distribution for goals
  const avgGoals = 2.5;
  
  if (outcome === 'draw') {
    const goals = poissonSample(avgGoals / 2);
    return { home: goals, away: goals };
  }
  
  if (outcome === 'home') {
    const homeGoals = poissonSample(avgGoals * 0.6);
    const awayGoals = poissonSample(avgGoals * 0.4);
    return { home: Math.max(homeGoals, awayGoals + 1), away: awayGoals };
  }
  
  // away win
  const homeGoals = poissonSample(avgGoals * 0.4);
  const awayGoals = poissonSample(avgGoals * 0.6);
  return { home: homeGoals, away: Math.max(awayGoals, homeGoals + 1) };
}

// Simple Poisson sampling
function poissonSample(lambda: number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  
  return Math.max(0, k - 1);
}
