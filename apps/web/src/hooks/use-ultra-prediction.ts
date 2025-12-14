/**
 * Ultra Prediction Hook
 * 
 * React hook for making predictions with automatic fallback:
 * 1. Try Ultra API (90%+ accuracy, <30ms latency)
 * 2. Fall back to legacy API if Ultra unavailable
 * 
 * @module hooks/use-ultra-prediction
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  ultraApiClient, 
  isUltraApiHealthy, 
  type UltraMatchFeatures,
  type UltraPredictionResponse 
} from '@/lib/ultra-api-client';
import { apiClient } from '@/lib/api-client';

export interface UltraPredictionState {
  loading: boolean;
  error: string | null;
  prediction: UltraPredictionResponse | null;
  source: 'ultra' | 'legacy' | null;
  latencyMs: number;
}

export interface UltraPredictionOptions {
  homeTeam: string;
  awayTeam: string;
  league: string;
  features?: Partial<UltraMatchFeatures>;
  bankroll?: number;
  forceUltra?: boolean;
  forceLegacy?: boolean;
}

// Track Ultra API health status
let ultraHealthy: boolean | null = null;
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 60000; // 1 minute

/**
 * Check Ultra API health with caching
 */
async function checkUltraHealth(): Promise<boolean> {
  const now = Date.now();
  
  if (ultraHealthy !== null && now - lastHealthCheck < HEALTH_CHECK_INTERVAL) {
    return ultraHealthy;
  }
  
  try {
    ultraHealthy = await isUltraApiHealthy();
    lastHealthCheck = now;
  } catch {
    ultraHealthy = false;
    lastHealthCheck = now;
  }
  
  return ultraHealthy;
}

/**
 * Hook for making predictions with automatic Ultra/Legacy fallback
 */
export function useUltraPrediction() {
  const [state, setState] = useState<UltraPredictionState>({
    loading: false,
    error: null,
    prediction: null,
    source: null,
    latencyMs: 0,
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);
  
  /**
   * Generate prediction using Ultra API with legacy fallback
   */
  const predict = useCallback(async (options: UltraPredictionOptions): Promise<UltraPredictionResponse | null> => {
    const {
      homeTeam,
      awayTeam,
      league,
      features = {},
      forceUltra = false,
      forceLegacy = false,
    } = options;
    
    // Cancel any in-flight request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    
    setState(prev => ({ ...prev, loading: true, error: null }));
    const startTime = Date.now();
    
    try {
      // Check if we should use Ultra API
      const useUltra = forceLegacy ? false : (forceUltra ? true : await checkUltraHealth());
      
      if (useUltra) {
        // Try Ultra API
        try {
          const matchId = `${homeTeam.toLowerCase().replace(/\s+/g, '_')}_${awayTeam.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
          
          const ultraFeatures = ultraApiClient.convertFromLegacy(
            matchId,
            homeTeam,
            awayTeam,
            league,
            features
          );
          
          const result = await ultraApiClient.predict(ultraFeatures);
          const latencyMs = Date.now() - startTime;
          
          setState({
            loading: false,
            error: null,
            prediction: result,
            source: 'ultra',
            latencyMs,
          });
          
          return result;
        } catch (ultraError) {
          console.warn('Ultra API failed, falling back to legacy:', ultraError);
          // Fall through to legacy
          ultraHealthy = false;
        }
      }
      
      // Use legacy API
      const legacyResult = await apiClient.createPrediction({
        home_team: homeTeam,
        away_team: awayTeam,
        league,
        match_id: undefined,
      });
      
      const latencyMs = Date.now() - startTime;
      
      // Convert legacy response to Ultra format
      const ultraFormatResult: UltraPredictionResponse = {
        match_id: legacyResult.match_id,
        home_win_prob: legacyResult.predictions.home_win,
        draw_prob: legacyResult.predictions.draw,
        away_win_prob: legacyResult.predictions.away_win,
        predicted_outcome: getPredictedOutcome(legacyResult.predictions),
        confidence: legacyResult.confidence,
        uncertainty: 1 - legacyResult.confidence,
        model_version: legacyResult.metadata?.model_version || 'legacy',
        latency_ms: latencyMs,
        cached: false,
      };
      
      setState({
        loading: false,
        error: null,
        prediction: ultraFormatResult,
        source: 'legacy',
        latencyMs,
      });
      
      return ultraFormatResult;
      
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Prediction failed';
      
      setState({
        loading: false,
        error: errorMessage,
        prediction: null,
        source: null,
        latencyMs,
      });
      
      return null;
    }
  }, []);
  
  /**
   * Make batch predictions
   */
  const predictBatch = useCallback(async (
    matches: Array<{
      homeTeam: string;
      awayTeam: string;
      league: string;
      features?: Partial<UltraMatchFeatures>;
    }>
  ): Promise<UltraPredictionResponse[]> => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    const startTime = Date.now();
    
    try {
      const useUltra = await checkUltraHealth();
      
      if (useUltra) {
        // Use Ultra batch API
        const ultraMatches = matches.map(m => 
          ultraApiClient.convertFromLegacy(
            `${m.homeTeam}_${m.awayTeam}_${Date.now()}`,
            m.homeTeam,
            m.awayTeam,
            m.league,
            m.features
          )
        );
        
        const result = await ultraApiClient.predictBatch(ultraMatches);
        const latencyMs = Date.now() - startTime;
        
        setState({
          loading: false,
          error: null,
          prediction: result.predictions[0] || null,
          source: 'ultra',
          latencyMs,
        });
        
        return result.predictions;
      }
      
      // Fallback: run legacy predictions sequentially
      const results: UltraPredictionResponse[] = [];
      
      for (const match of matches) {
        const result = await predict({
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          league: match.league,
          features: match.features,
          forceLegacy: true,
        });
        
        if (result) {
          results.push(result);
        }
      }
      
      const latencyMs = Date.now() - startTime;
      
      setState(prev => ({
        ...prev,
        loading: false,
        latencyMs,
      }));
      
      return results;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Batch prediction failed';
      
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
      
      return [];
    }
  }, [predict]);
  
  /**
   * Reset prediction state
   */
  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    setState({
      loading: false,
      error: null,
      prediction: null,
      source: null,
      latencyMs: 0,
    });
  }, []);
  
  /**
   * Force refresh Ultra health check
   */
  const refreshHealth = useCallback(async (): Promise<boolean> => {
    lastHealthCheck = 0; // Reset cache
    return checkUltraHealth();
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);
  
  return {
    ...state,
    predict,
    predictBatch,
    reset,
    refreshHealth,
    isUltraAvailable: ultraHealthy ?? false,
  };
}

/**
 * Helper to determine predicted outcome from probabilities
 */
function getPredictedOutcome(predictions: { home_win: number; draw: number; away_win: number }): 'home_win' | 'draw' | 'away_win' {
  const { home_win, draw, away_win } = predictions;
  
  if (home_win >= draw && home_win >= away_win) return 'home_win';
  if (draw >= home_win && draw >= away_win) return 'draw';
  return 'away_win';
}

/**
 * Utility: Format prediction for display
 */
export function formatPrediction(prediction: UltraPredictionResponse): {
  homeWinPercent: string;
  drawPercent: string;
  awayWinPercent: string;
  confidencePercent: string;
  predictedOutcomeLabel: string;
} {
  const outcomeLabels = {
    home_win: 'Home Win',
    draw: 'Draw',
    away_win: 'Away Win',
  };
  
  return {
    homeWinPercent: `${(prediction.home_win_prob * 100).toFixed(1)}%`,
    drawPercent: `${(prediction.draw_prob * 100).toFixed(1)}%`,
    awayWinPercent: `${(prediction.away_win_prob * 100).toFixed(1)}%`,
    confidencePercent: `${(prediction.confidence * 100).toFixed(1)}%`,
    predictedOutcomeLabel: outcomeLabels[prediction.predicted_outcome] || 'Unknown',
  };
}

export default useUltraPrediction;
