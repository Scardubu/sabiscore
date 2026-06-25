/**
 * Live Prediction Updates
 * 
 * Real-time probability updates as match progresses using xG flow.
 * Provides dynamic predictions that evolve with live match events.
 * 
 * Impact: Great engagement, keeps users coming back during matches
 */

import { kv } from '@vercel/kv';

export interface LiveMatchEvent {
  minute: number;
  type: 'goal' | 'shot' | 'corner' | 'card' | 'substitution';
  team: 'home' | 'away';
  xG?: number; // Expected goals for shot events
  player?: string;
}

export interface LiveMatchState {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  minute: number;
  score: { home: number; away: number };
  events: LiveMatchEvent[];
  xGFlow: {
    home: number; // Cumulative xG
    away: number;
  };
  lastUpdated: Date;
}

export interface LivePrediction {
  homeWin: number;
  draw: number;
  awayWin: number;
  confidence: number;
  trend: 'improving_home' | 'improving_away' | 'stable';
  updatedAt: Date;
}

export class LivePredictionEngine {
  private static readonly KV_PREFIX = 'live:match:';
  private static readonly UPDATE_INTERVAL_MS = 30000; // 30 seconds
  
  /**
   * Initialize live tracking for a match
   */
  static async startTracking(matchId: string, homeTeam: string, awayTeam: string): Promise<void> {
    const state: LiveMatchState = {
      matchId,
      homeTeam,
      awayTeam,
      minute: 0,
      score: { home: 0, away: 0 },
      events: [],
      xGFlow: { home: 0, away: 0 },
      lastUpdated: new Date(),
    };
    
    await kv.set(
      `${this.KV_PREFIX}${matchId}`,
      JSON.stringify(state),
      { ex: 60 * 60 * 3 } // 3 hours TTL
    );
  }
  
  /**
   * Update match state with new event
   */
  static async recordEvent(matchId: string, event: LiveMatchEvent): Promise<void> {
    const state = await this.getMatchState(matchId);
    if (!state) {
      throw new Error(`Match ${matchId} not being tracked`);
    }
    
    // Update events
    state.events.push(event);
    state.minute = event.minute;
    
    // Update score
    if (event.type === 'goal') {
      if (event.team === 'home') {
        state.score.home++;
      } else {
        state.score.away++;
      }
    }
    
    // Update xG flow
    if (event.type === 'shot' && event.xG) {
      if (event.team === 'home') {
        state.xGFlow.home += event.xG;
      } else {
        state.xGFlow.away += event.xG;
      }
    }
    
    state.lastUpdated = new Date();
    
    await kv.set(
      `${this.KV_PREFIX}${matchId}`,
      JSON.stringify(state),
      { ex: 60 * 60 * 3 }
    );
  }
  
  /**
   * Get current match state
   */
  static async getMatchState(matchId: string): Promise<LiveMatchState | null> {
    const data = await kv.get<string>(`${this.KV_PREFIX}${matchId}`);
    if (!data) return null;
    
    const state = JSON.parse(data);
    state.lastUpdated = new Date(state.lastUpdated);
    return state;
  }
  
  /**
   * Calculate live prediction based on current match state
   */
  static async calculateLivePrediction(matchId: string): Promise<LivePrediction | null> {
    const state = await this.getMatchState(matchId);
    if (!state) return null;
    
    // Get initial prediction (cached)
    const initialKey = `prediction:${matchId}`;
    const initialData = await kv.get<string>(initialKey);
    
    let initialPrediction = { homeWin: 0.33, draw: 0.33, awayWin: 0.33 };
    if (initialData) {
      const parsed = JSON.parse(initialData);
      initialPrediction = {
        homeWin: parsed.homeWin || 0.33,
        draw: parsed.draw || 0.33,
        awayWin: parsed.awayWin || 0.33,
      };
    }
    
    // Adjust probabilities based on current state
    const adjusted = this.adjustProbabilities(state, initialPrediction);
    
    // Calculate trend
    const trend = this.calculateTrend(state);
    
    return {
      ...adjusted,
      trend,
      updatedAt: new Date(),
    };
  }
  
  /**
   * Adjust probabilities based on live match state
   */
  private static adjustProbabilities(
    state: LiveMatchState,
    initial: { homeWin: number; draw: number; awayWin: number }
  ): { homeWin: number; draw: number; awayWin: number; confidence: number } {
    // Factor 1: Current score (strongest signal)
    const scoreDiff = state.score.home - state.score.away;
    let homeWin = initial.homeWin;
    let draw = initial.draw;
    let awayWin = initial.awayWin;
    
    if (scoreDiff > 0) {
      // Home team leading
      const leadBoost = Math.min(scoreDiff * 0.15, 0.4);
      homeWin = Math.min(homeWin + leadBoost, 0.95);
      draw = Math.max(draw - leadBoost * 0.5, 0.02);
      awayWin = Math.max(awayWin - leadBoost * 0.5, 0.02);
    } else if (scoreDiff < 0) {
      // Away team leading
      const leadBoost = Math.min(Math.abs(scoreDiff) * 0.15, 0.4);
      awayWin = Math.min(awayWin + leadBoost, 0.95);
      draw = Math.max(draw - leadBoost * 0.5, 0.02);
      homeWin = Math.max(homeWin - leadBoost * 0.5, 0.02);
    }
    
    // Factor 2: xG flow (momentum signal)
    const xGDiff = state.xGFlow.home - state.xGFlow.away;
    const xGAdjust = xGDiff * 0.05; // Subtle adjustment
    
    homeWin = Math.max(0.01, Math.min(0.98, homeWin + xGAdjust));
    awayWin = Math.max(0.01, Math.min(0.98, awayWin - xGAdjust));
    
    // Factor 3: Time remaining (urgency factor)
    const minutesRemaining = 90 - state.minute;
    const timeWeight = minutesRemaining / 90;
    
    if (scoreDiff === 0) {
      // Draw becomes more likely as time runs out
      draw = Math.min(draw + (1 - timeWeight) * 0.1, 0.5);
    }
    
    // Normalize probabilities
    const total = homeWin + draw + awayWin;
    homeWin /= total;
    draw /= total;
    awayWin /= total;
    
    // Calculate confidence (higher when score is clear or near full time)
    const scoreConfidence = Math.abs(scoreDiff) * 0.2;
    const timeConfidence = (90 - minutesRemaining) / 90 * 0.3;
    const confidence = Math.min(
      initial.homeWin + scoreConfidence + timeConfidence,
      0.95
    );
    
    return {
      homeWin: Math.round(homeWin * 1000) / 1000,
      draw: Math.round(draw * 1000) / 1000,
      awayWin: Math.round(awayWin * 1000) / 1000,
      confidence: Math.round(confidence * 1000) / 1000,
    };
  }
  
  /**
   * Calculate prediction trend
   */
  private static calculateTrend(state: LiveMatchState): 'improving_home' | 'improving_away' | 'stable' {
    // Look at recent events (last 10 minutes)
    const recentEvents = state.events.filter(e => e.minute >= state.minute - 10);
    
    let homeXG = 0;
    let awayXG = 0;
    
    recentEvents.forEach(event => {
      if (event.type === 'shot' && event.xG) {
        if (event.team === 'home') {
          homeXG += event.xG;
        } else {
          awayXG += event.xG;
        }
      }
    });
    
    const diff = homeXG - awayXG;
    
    if (diff > 0.3) return 'improving_home';
    if (diff < -0.3) return 'improving_away';
    return 'stable';
  }
  
  /**
   * Stop tracking match (cleanup)
   */
  static async stopTracking(matchId: string): Promise<void> {
    await kv.del(`${this.KV_PREFIX}${matchId}`);
  }
  
  /**
   * Get all active live matches
   */
  static async getActiveMatches(): Promise<string[]> {
    // Note: This requires scanning keys, which is expensive
    // In production, maintain a separate set of active match IDs
    const keys = await kv.keys(`${this.KV_PREFIX}*`);
    return keys.map(key => key.replace(this.KV_PREFIX, ''));
  }
}

/**
 * WebSocket-like update listener (for future WebSocket integration)
 */
export class LiveUpdateListener {
  private intervalId?: NodeJS.Timeout;
  private matchId: string;
  private callback: (prediction: LivePrediction) => void;
  
  constructor(matchId: string, callback: (prediction: LivePrediction) => void) {
    this.matchId = matchId;
    this.callback = callback;
  }
  
  /**
   * Start polling for updates
   */
  start(intervalMs: number = 30000): void {
    if (this.intervalId) return;
    
    // Initial update
    this.update();
    
    // Set up polling
    this.intervalId = setInterval(() => {
      this.update();
    }, intervalMs);
  }
  
  /**
   * Stop polling
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }
  
  /**
   * Fetch and emit update
   */
  private async update(): Promise<void> {
    try {
      const prediction = await LivePredictionEngine.calculateLivePrediction(this.matchId);
      if (prediction) {
        this.callback(prediction);
      }
    } catch (error) {
      console.error('Failed to fetch live prediction:', error);
    }
  }
}

/**
 * React hook for live predictions (usage example)
 */
export function useLivePrediction(_matchId: string) {
  // Implementation would go in a separate hooks file
  // This is just a placeholder to show the API
  
  // Example usage:
  // const { prediction, isLive } = useLivePrediction('match-123');
  // return <div>{prediction.homeWin}</div>;
}
