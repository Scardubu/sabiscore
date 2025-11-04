const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '')

const resolveApiBaseUrl = (): string => {
  const configured = import.meta.env.VITE_API_URL?.trim()
  if (configured) {
    return trimTrailingSlash(configured)
  }

  if (typeof window !== 'undefined') {
    const { location } = window

    // When running the static preview server (vite preview defaults to 4173),
    // automatically target the FastAPI backend on port 8000.
    if (location.hostname === 'localhost' && location.port === '4173') {
      return 'http://localhost:8000/api/v1'
    }

    // Handle common dev ports used by Vite (5173) and the custom dev server (3000).
    if (location.hostname === 'localhost' && (location.port === '5173' || location.port === '3000')) {
      return '/api/v1'
    }
  }

  return '/api/v1'
}

const API_BASE_URL = resolveApiBaseUrl()

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy'
  database: boolean
  models: boolean
  cache: boolean
  cache_metrics: any
  latency_ms: number
}

export interface MatchSearchResult {
  id: string
  home_team: string
  away_team: string
  league: string
  match_date: string | null
  venue: string
}

export interface InsightsRequest {
  matchup: string
  league?: string
}

export interface ValueBet {
  market: string
  selection: string
  odds: number
  expected_value: number
  recommendation: string
}

export interface MarketAnalysis {
  over_under_line: number
  over_probability: number
  under_probability: number
}

export interface TeamMetrics {
  average_goals_scored?: number
  average_goals_conceded?: number
  win_rate?: number
  clean_sheet_rate?: number
}

export interface HeadToHeadStats {
  total_meetings?: number
  home_wins?: number
  away_wins?: number
  form_edge?: string
}

export interface PredictionSummary {
  home_win_prob: number
  draw_prob: number
  away_win_prob: number
  prediction: string
  confidence: number
}

export interface XGAnalysis {
  home_xg: number
  away_xg: number
  total_xg: number
  xg_difference: number
}

export interface ValueBetQuality {
  quality_score: number
  tier: string
  recommendation: string
  ev_contribution: number
  confidence_contribution: number
  liquidity_contribution: number
}

export interface ValueBet {
  bet_type: string
  market_odds: number
  model_prob: number
  market_prob: number
  expected_value: number
  value_pct: number
  kelly_stake: number
  confidence_interval: number[]
  edge: number
  recommendation: string
  quality: ValueBetQuality
}

export interface MonteCarloData {
  simulations: number
  distribution: Record<string, number>
  confidence_intervals: Record<string, number[]>
}

export interface Scenario {
  name: string
  probability: number
  home_score: number
  away_score: number
  result: string
}

export interface RiskAssessment {
  risk_level: string
  confidence_score: number
  value_available: boolean
  best_bet?: ValueBet | null
  distribution: Record<string, number>
  recommendation: string
}

export interface Metadata {
  matchup: string
  league: string
  home_team: string
  away_team: string
}

export interface InsightsResponse {
  matchup: string
  league: string
  metadata: Metadata
  predictions: PredictionSummary
  xg_analysis: XGAnalysis
  value_analysis: {
    bets: ValueBet[]
    edges: Record<string, number>
    best_bet?: ValueBet | null
    summary: string
  }
  monte_carlo: MonteCarloData
  scenarios: Scenario[]
  explanation: Record<string, any>
  risk_assessment: RiskAssessment
  narrative: string
  generated_at: string
  confidence_level: number
}

class APIClient {
  private baseURL: string
  private readonly maxRetries = 3
  private readonly retryDelays = [1000, 2000, 4000] // Exponential backoff: 1s, 2s, 4s

  constructor(baseURL = API_BASE_URL) {
    this.baseURL = trimTrailingSlash(baseURL)
  }

  /**
   * Check if an error should trigger a retry.
   * Retries on network errors, timeouts, and server errors (503).
   */
  private isRetriableError(error: unknown, response?: Response): boolean {
    if (response) {
      // Retry on service unavailable (503) or gateway errors (502, 504)
      return response.status === 503 || response.status === 502 || response.status === 504
    }

    if (error instanceof Error) {
      // Retry on network errors and timeouts
      return (
        error.name === 'AbortError' ||
        error.message.includes('Failed to fetch') ||
        error.message.includes('Network request failed') ||
        error.message.includes('timeout')
      )
    }

    return false
  }

  /**
   * Delay execution for the specified number of milliseconds.
   */
  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const url = `${this.baseURL}${endpoint}`
      
      // Create an AbortController for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 seconds timeout
      
      const config: RequestInit = {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
        ...options,
      }

      try {
        const response = await fetch(url, config)
        clearTimeout(timeoutId) // Clear timeout if request completes

        if (!response.ok) {
          let errorMessage = `HTTP ${response.status}: ${response.statusText}`
          
          try {
            const errorData = await response.json()
            errorMessage = errorData.detail || errorData.message || errorMessage
          } catch {
            // If we can't parse error JSON, use the status text
          }
          
          // Check if we should retry
          if (this.isRetriableError(null, response) && attempt < this.maxRetries) {
            console.warn(`Request failed (attempt ${attempt + 1}/${this.maxRetries + 1}): ${errorMessage}. Retrying...`)
            await this.delay(this.retryDelays[attempt] || 1000)
            continue
          }
          
          if (response.status >= 500) {
            throw new Error('SabiScore backend returned an internal error. Ensure the backend service is running (./START_SABISCORE.bat) and reachable at the configured API URL.')
          }
          
          throw new Error(errorMessage)
        }

        const data = await response.json()
        
        // Log successful retry
        if (attempt > 0) {
          console.info(`Request succeeded after ${attempt + 1} attempts`)
        }
        
        return data
      } catch (error) {
        clearTimeout(timeoutId) // Clear timeout on error
        lastError = error instanceof Error ? error : new Error('An unexpected error occurred')
        
        // Check if we should retry
        if (this.isRetriableError(error) && attempt < this.maxRetries) {
          console.warn(`Request failed (attempt ${attempt + 1}/${this.maxRetries + 1}): ${lastError.message}. Retrying...`)
          await this.delay(this.retryDelays[attempt] || 1000)
          continue
        }
        
        // No more retries, throw the error
        if (lastError.name === 'AbortError') {
          throw new Error('Request timeout')
        }
        if (lastError.message.includes('Failed to fetch')) {
          throw new Error('Unable to connect to server. Please check if the backend is running.')
        }
        throw lastError
      }
    }

    // Should never reach here, but TypeScript needs this
    throw lastError || new Error('An unexpected error occurred')
  }

  async healthCheck(): Promise<HealthResponse> {
    return this.request('/health')
  }

  async searchMatches(query: string, league?: string): Promise<MatchSearchResult[]> {
    const params = new URLSearchParams({ q: query })
    if (league) params.append('league', league)
    return this.request(`/matches/search?${params}`)
  }

  async generateInsights(matchup: string, league = 'EPL'): Promise<InsightsResponse> {
    return this.request('/insights', {
      method: 'POST',
      body: JSON.stringify({ matchup, league }),
    })
  }
}

export const apiClient = new APIClient()
