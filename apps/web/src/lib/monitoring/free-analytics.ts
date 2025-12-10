/**
 * Free Monitoring & Analytics
 * 
 * Tracks predictions, calculates rolling metrics, and detects model drift.
 * Uses in-memory storage with optional persistence to localStorage.
 * 
 * @module lib/monitoring/free-analytics
 */

export interface PredictionRecord {
  id: string;
  matchup: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  timestamp: number;
  prediction: {
    homeWin: number;
    draw: number;
    awayWin: number;
    confidence: number;
  };
  actual?: 'home' | 'draw' | 'away';
  correct?: boolean;
  brierScore?: number;
  odds?: {
    home: number;
    draw: number;
    away: number;
  };
  betPlaced?: boolean;
  betOutcome?: 'win' | 'loss' | 'pending';
  betProfit?: number;
}

export interface RollingMetrics {
  accuracy: number;
  brierScore: number;
  roi: number;
  totalPredictions: number;
  correctPredictions: number;
  totalBets: number;
  winningBets: number;
  totalProfit: number;
  updatedAt: number;
  byOutcome: {
    home: { total: number; correct: number; accuracy: number };
    draw: { total: number; correct: number; accuracy: number };
    away: { total: number; correct: number; accuracy: number };
  };
}

export type HealthStatus = 'healthy' | 'degraded' | 'critical' | 'initializing';

export interface HealthMetrics {
  accuracy: number;
  brierScore: number;
  roi: number;
  status: HealthStatus;
  lastUpdate: number;
  predictionCount: number;
  issues: string[];
  hasSufficientData: boolean;
}

export interface DriftReport {
  driftDetected: boolean;
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  recommendation: string;
  metrics: {
    accuracyDrift: number;
    brierDrift: number;
    roiDrift: number;
  };
  baseline: Partial<RollingMetrics>;
  current: Partial<RollingMetrics>;
}

// ============================================================================
// Free Monitoring System
// ============================================================================

const MIN_HEALTH_SAMPLE = 50;

export class FreeMonitoring {
  private predictions: Map<string, PredictionRecord> = new Map();
  private baseline: RollingMetrics | null = null;
  private readonly MAX_PREDICTIONS = 1000; // Keep last 1000 predictions
  private readonly STORAGE_KEY = 'sabiscore-monitoring';
  
  constructor() {
    this.loadFromStorage();
  }
  
  /**
   * Track a new prediction
   */
  async trackPrediction(record: PredictionRecord): Promise<void> {
    // Add to map
    this.predictions.set(record.id, record);
    
    // Enforce size limit
    if (this.predictions.size > this.MAX_PREDICTIONS) {
      const oldest = Array.from(this.predictions.keys())[0];
      this.predictions.delete(oldest);
    }
    
    // Update rolling metrics
    await this.updateMetrics();
    
    // Persist to storage
    this.saveToStorage();
  }
  
  /**
   * Update a prediction with actual outcome
   * Optionally updates bet outcome and profit as well
   */
  async updateOutcome(
    predictionId: string,
    actual: 'home' | 'draw' | 'away',
    betOutcome?: 'win' | 'loss' | 'void',
    betProfit?: number
  ): Promise<void> {
    const prediction = this.predictions.get(predictionId);
    if (!prediction) {
      throw new Error(`Prediction ${predictionId} not found`);
    }
    
    // Update record
    prediction.actual = actual;
    
    // Determine if prediction was correct
    const predictedOutcome = this.getPredictedOutcome(prediction.prediction);
    prediction.correct = predictedOutcome === actual;
    
    // Calculate Brier score
    prediction.brierScore = this.calculateBrierScore(prediction.prediction, actual);
    
    // Update bet outcome if provided
    if (betOutcome !== undefined) {
      prediction.betOutcome = betOutcome;
    }
    if (betProfit !== undefined) {
      prediction.betProfit = betProfit;
    }
    
    this.predictions.set(predictionId, prediction);
    
    // Update metrics
    await this.updateMetrics();
    this.saveToStorage();
  }
  
  /**
   * Update bet outcome
   */
  async updateBetOutcome(
    predictionId: string,
    outcome: 'win' | 'loss',
    profit: number
  ): Promise<void> {
    const prediction = this.predictions.get(predictionId);
    if (!prediction) {
      throw new Error(`Prediction ${predictionId} not found`);
    }
    
    prediction.betOutcome = outcome;
    prediction.betProfit = profit;
    
    this.predictions.set(predictionId, prediction);
    
    await this.updateMetrics();
    this.saveToStorage();
  }
  
  /**
   * Calculate and update rolling metrics
   */
  private async updateMetrics(): Promise<void> {
    const predictions = Array.from(this.predictions.values());
    const withActuals = predictions.filter(p => p.actual !== undefined);
    
    if (withActuals.length === 0) {
      return;
    }
    
    // Calculate accuracy
    const correct = withActuals.filter(p => p.correct).length;
    const accuracy = correct / withActuals.length;
    
    // Calculate Brier score
    const brierScores = withActuals
      .filter(p => p.brierScore !== undefined)
      .map(p => p.brierScore!);
    const brierScore = brierScores.length > 0
      ? brierScores.reduce((a, b) => a + b, 0) / brierScores.length
      : 0;
    
    // Calculate ROI
    const withBets = predictions.filter(p => p.betPlaced && p.betOutcome !== 'pending');
    const totalProfit = withBets.reduce((sum, p) => sum + (p.betProfit || 0), 0);
    const roi = withBets.length > 0 ? totalProfit / withBets.length : 0;
    
    // Calculate by outcome
    const byOutcome = {
      home: this.calculateOutcomeMetrics(withActuals, 'home'),
      draw: this.calculateOutcomeMetrics(withActuals, 'draw'),
      away: this.calculateOutcomeMetrics(withActuals, 'away'),
    };
    
    const metrics: RollingMetrics = {
      accuracy,
      brierScore,
      roi,
      totalPredictions: predictions.length,
      correctPredictions: correct,
      totalBets: withBets.length,
      winningBets: withBets.filter(p => p.betOutcome === 'win').length,
      totalProfit,
      updatedAt: Date.now(),
      byOutcome,
    };
    
    // Set baseline if not set
    if (!this.baseline && withActuals.length >= 100) {
      this.baseline = { ...metrics };
    }
  }
  
  /**
   * Calculate metrics for a specific outcome
   */
  private calculateOutcomeMetrics(
    predictions: PredictionRecord[],
    outcome: 'home' | 'draw' | 'away'
  ): { total: number; correct: number; accuracy: number } {
    const forOutcome = predictions.filter(p => p.actual === outcome);
    const correct = forOutcome.filter(p => p.correct).length;
    
    return {
      total: forOutcome.length,
      correct,
      accuracy: forOutcome.length > 0 ? correct / forOutcome.length : 0,
    };
  }
  
  /**
   * Get current rolling metrics
   */
  async getMetrics(): Promise<RollingMetrics> {
    await this.updateMetrics();
    
    const predictions = Array.from(this.predictions.values());
    const withActuals = predictions.filter(p => p.actual !== undefined);
    
    if (withActuals.length === 0) {
      return this.getEmptyMetrics();
    }
    
    const correct = withActuals.filter(p => p.correct).length;
    const accuracy = correct / withActuals.length;
    
    const brierScores = withActuals
      .filter(p => p.brierScore !== undefined)
      .map(p => p.brierScore!);
    const brierScore = brierScores.length > 0
      ? brierScores.reduce((a, b) => a + b, 0) / brierScores.length
      : 0;
    
    const withBets = predictions.filter(p => p.betPlaced && p.betOutcome !== 'pending');
    const totalProfit = withBets.reduce((sum, p) => sum + (p.betProfit || 0), 0);
    const roi = withBets.length > 0 ? totalProfit / withBets.length : 0;
    
    return {
      accuracy,
      brierScore,
      roi,
      totalPredictions: predictions.length,
      correctPredictions: correct,
      totalBets: withBets.length,
      winningBets: withBets.filter(p => p.betOutcome === 'win').length,
      totalProfit,
      updatedAt: Date.now(),
      byOutcome: {
        home: this.calculateOutcomeMetrics(withActuals, 'home'),
        draw: this.calculateOutcomeMetrics(withActuals, 'draw'),
        away: this.calculateOutcomeMetrics(withActuals, 'away'),
      },
    };
  }
  
  /**
   * Get health check status
   */
  async getHealthCheck(): Promise<HealthMetrics> {
    const metrics = await this.getMetrics();
    
    const issues: string[] = [];
    const hasSufficientData = metrics.totalPredictions >= MIN_HEALTH_SAMPLE;
    let status: HealthStatus = hasSufficientData ? 'healthy' : 'initializing';

    if (!hasSufficientData) {
      issues.push(`Insufficient data (< ${MIN_HEALTH_SAMPLE} predictions)`);
    }

    if (hasSufficientData) {
      if (metrics.accuracy < 0.50) {
        issues.push('Accuracy below 50% (worse than random)');
        status = 'critical';
      } else if (metrics.accuracy < 0.65) {
        issues.push('Accuracy below target (65%)');
        status = 'degraded';
      }
      
      if (metrics.brierScore > 0.25) {
        issues.push('Brier score above 0.25 (poor calibration)');
        status = status === 'critical' ? 'critical' : 'degraded';
      }
      
      if (metrics.roi < -5 && metrics.totalBets > 20) {
        issues.push('Negative ROI over 20+ bets');
        status = 'critical';
      }
    }
    
    return {
      accuracy: metrics.accuracy,
      brierScore: metrics.brierScore,
      roi: metrics.roi,
      status,
      lastUpdate: metrics.updatedAt,
      predictionCount: metrics.totalPredictions,
      issues,
      hasSufficientData,
    };
  }
  
  /**
   * Detect model drift
   */
  async detectDrift(): Promise<DriftReport> {
    if (!this.baseline) {
      return {
        driftDetected: false,
        severity: 'none',
        recommendation: 'Insufficient baseline data. Need 100+ predictions.',
        metrics: {
          accuracyDrift: 0,
          brierDrift: 0,
          roiDrift: 0,
        },
        baseline: {},
        current: {},
      };
    }
    
    const current = await this.getMetrics();
    
    // Calculate drift
    const accuracyDrift = Math.abs(current.accuracy - this.baseline.accuracy);
    const brierDrift = Math.abs(current.brierScore - this.baseline.brierScore);
    const roiDrift = Math.abs(current.roi - this.baseline.roi);
    
    // Determine severity
    let severity: DriftReport['severity'] = 'none';
    let driftDetected = false;
    
    if (accuracyDrift > 0.10 || brierDrift > 0.05 || roiDrift > 10) {
      severity = 'critical';
      driftDetected = true;
    } else if (accuracyDrift > 0.07 || brierDrift > 0.03 || roiDrift > 7) {
      severity = 'high';
      driftDetected = true;
    } else if (accuracyDrift > 0.05 || brierDrift > 0.02 || roiDrift > 5) {
      severity = 'medium';
      driftDetected = true;
    } else if (accuracyDrift > 0.03 || brierDrift > 0.01) {
      severity = 'low';
      driftDetected = true;
    }
    
    // Generate recommendation
    let recommendation = 'Model performance is stable.';
    if (driftDetected) {
      recommendation = this.getDriftRecommendation(severity, {
        accuracyDrift,
        brierDrift,
        roiDrift,
      });
    }
    
    return {
      driftDetected,
      severity,
      recommendation,
      metrics: {
        accuracyDrift,
        brierDrift,
        roiDrift,
      },
      baseline: {
        accuracy: this.baseline.accuracy,
        brierScore: this.baseline.brierScore,
        roi: this.baseline.roi,
      },
      current: {
        accuracy: current.accuracy,
        brierScore: current.brierScore,
        roi: current.roi,
      },
    };
  }
  
  /**
   * Get drift recommendation
   */
  private getDriftRecommendation(
    severity: 'none' | 'low' | 'medium' | 'high' | 'critical',
    metrics: { accuracyDrift: number; brierDrift: number; roiDrift: number }
  ): string {
    const parts = [];
    
    if (severity === 'critical') {
      parts.push('🚨 CRITICAL: Immediate retraining required.');
    } else if (severity === 'high') {
      parts.push('⚠️ HIGH: Schedule retraining within 24 hours.');
    } else if (severity === 'medium') {
      parts.push('⚠️ MEDIUM: Plan retraining within 1 week.');
    } else {
      parts.push('ℹ️ LOW: Monitor closely. Consider retraining if drift persists.');
    }
    
    if (metrics.accuracyDrift > 0.05) {
      parts.push(`Accuracy drift: ${(metrics.accuracyDrift * 100).toFixed(1)}%.`);
    }
    if (metrics.brierDrift > 0.02) {
      parts.push(`Calibration drift: ${(metrics.brierDrift * 100).toFixed(1)}%.`);
    }
    if (metrics.roiDrift > 5) {
      parts.push(`ROI drift: ${metrics.roiDrift.toFixed(1)}%.`);
    }
    
    return parts.join(' ');
  }
  
  /**
   * Calculate Brier score for a prediction
   */
  private calculateBrierScore(
    prediction: { homeWin: number; draw: number; awayWin: number },
    actual: 'home' | 'draw' | 'away'
  ): number {
    const actualVector = {
      home: actual === 'home' ? 1 : 0,
      draw: actual === 'draw' ? 1 : 0,
      away: actual === 'away' ? 1 : 0,
    };
    
    return (
      Math.pow(prediction.homeWin - actualVector.home, 2) +
      Math.pow(prediction.draw - actualVector.draw, 2) +
      Math.pow(prediction.awayWin - actualVector.away, 2)
    ) / 3;
  }
  
  /**
   * Get predicted outcome
   */
  private getPredictedOutcome(
    prediction: { homeWin: number; draw: number; awayWin: number }
  ): 'home' | 'draw' | 'away' {
    const max = Math.max(prediction.homeWin, prediction.draw, prediction.awayWin);
    if (max === prediction.homeWin) return 'home';
    if (max === prediction.draw) return 'draw';
    return 'away';
  }
  
  /**
   * Get empty metrics
   */
  private getEmptyMetrics(): RollingMetrics {
    return {
      accuracy: 0,
      brierScore: 0,
      roi: 0,
      totalPredictions: 0,
      correctPredictions: 0,
      totalBets: 0,
      winningBets: 0,
      totalProfit: 0,
      updatedAt: Date.now(),
      byOutcome: {
        home: { total: 0, correct: 0, accuracy: 0 },
        draw: { total: 0, correct: 0, accuracy: 0 },
        away: { total: 0, correct: 0, accuracy: 0 },
      },
    };
  }
  
  /**
   * Save to localStorage
   */
  private saveToStorage(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const data = {
        predictions: Array.from(this.predictions.entries()),
        baseline: this.baseline,
        timestamp: Date.now(),
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save monitoring data:', error);
    }
  }
  
  /**
   * Load from localStorage
   */
  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return;
      
      const data = JSON.parse(stored);
      this.predictions = new Map(data.predictions);
      this.baseline = data.baseline;
    } catch (error) {
      console.warn('Failed to load monitoring data:', error);
    }
  }
  
  /**
   * Track an error for monitoring
   */
  async trackError(error: {
    type: string;
    message: string;
    timestamp: number;
  }): Promise<void> {
    // In a full implementation, you'd store these in a separate errors collection
    // For now, just log to console
    console.error(`[${error.type}] ${error.message}`, {
      timestamp: new Date(error.timestamp).toISOString(),
    });
  }
  
  /**
   * Clear all data
   */
  clear(): void {
    this.predictions.clear();
    this.baseline = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.STORAGE_KEY);
    }
  }
  
  /**
   * Export data for analysis
   */
  exportData(): {
    predictions: PredictionRecord[];
    metrics: RollingMetrics;
    baseline: RollingMetrics | null;
  } {
    return {
      predictions: Array.from(this.predictions.values()),
      metrics: this.getEmptyMetrics(), // Sync call for export
      baseline: this.baseline,
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const freeMonitoring = new FreeMonitoring();
