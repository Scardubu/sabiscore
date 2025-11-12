/**
 * Frontend API client for Sabiscore predictions
 * Handles all communication with the FastAPI backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface Match {
  id: string;
  home_team: string;
  away_team: string;
  league: string;
  match_date: string;
  venue?: string;
  status: string;
  has_odds: boolean;
}

export interface Prediction {
  match_id: string;
  home_team: string;
  away_team: string;
  league: string;
  predictions: {
    home_win: number;
    draw: number;
    away_win: number;
  };
  confidence: number;
  brier_score: number;
  value_bets: ValueBet[];
  confidence_intervals?: any;
  explanations?: any;
  metadata: {
    model_version: string;
    processing_time_ms?: number;
    data_freshness?: string;
  };
}

export interface ValueBet {
  match_id: string;
  home_team: string;
  away_team: string;
  league: string;
  bet_type: string;
  recommended_odds: number;
  market_odds: number;
  edge_ngn: number;
  edge_percent: number;
  kelly_stake_ngn: number;
  confidence: number;
  match_date?: string;
}

export interface PredictionRequest {
  match_id?: string;
  home_team: string;
  away_team: string;
  league: string;
  odds?: {
    home_win?: number;
    draw?: number;
    away_win?: number;
  };
  bankroll?: number;
}

class SabiscoreAPIClient {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  /**
   * Fetch upcoming matches
   */
  async getUpcomingMatches(params?: {
    league?: string;
    days_ahead?: number;
    limit?: number;
  }): Promise<{ matches: Match[]; total: number }> {
    const queryParams = new URLSearchParams();
    if (params?.league) queryParams.append('league', params.league);
    if (params?.days_ahead) queryParams.append('days_ahead', params.days_ahead.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const url = `${this.baseURL}/api/v1/matches/upcoming?${queryParams.toString()}`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store', // Disable caching for fresh data
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch matches: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching upcoming matches:', error);
      throw error;
    }
  }

  /**
   * Get match details
   */
  async getMatchDetail(matchId: string): Promise<Match> {
    const url = `${this.baseURL}/api/v1/matches/${matchId}`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch match details: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching match details:', error);
      throw error;
    }
  }

  /**
   * Create a new prediction
   */
  async createPrediction(request: PredictionRequest): Promise<Prediction> {
    const url = `${this.baseURL}/api/v1/predictions/`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        cache: 'no-store',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to create prediction: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating prediction:', error);
      throw error;
    }
  }

  /**
   * Get existing prediction for a match
   */
  async getPrediction(matchId: string): Promise<Prediction> {
    const url = `${this.baseURL}/api/v1/predictions/${matchId}`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('PREDICTION_NOT_FOUND');
        }
        if (response.status === 410) {
          throw new Error('PREDICTION_STALE');
        }
        throw new Error(`Failed to fetch prediction: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching prediction:', error);
      throw error;
    }
  }

  /**
   * Get today's value bets
   */
  async getTodaysValueBets(params?: {
    min_edge?: number;
    min_confidence?: number;
    league?: string;
    limit?: number;
  }): Promise<ValueBet[]> {
    const queryParams = new URLSearchParams();
    if (params?.min_edge) queryParams.append('min_edge', params.min_edge.toString());
    if (params?.min_confidence) queryParams.append('min_confidence', params.min_confidence.toString());
    if (params?.league) queryParams.append('league', params.league);
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const url = `${this.baseURL}/api/v1/predictions/value-bets/today?${queryParams.toString()}`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch value bets: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching value bets:', error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const url = `${this.baseURL}/health`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('API unhealthy');
      }

      return await response.json();
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const apiClient = new SabiscoreAPIClient();

// Export class for custom instances
export default SabiscoreAPIClient;
