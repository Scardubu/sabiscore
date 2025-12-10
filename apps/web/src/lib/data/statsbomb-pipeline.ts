/**
 * FREE Data Pipeline using StatsBomb Open Data
 * Provides 10,000+ matches with event-level data at zero cost
 * 
 * @module lib/data/statsbomb-pipeline
 */

// ============================================================================
// Type Definitions
// ============================================================================

export interface StatsBombEvent {
  id: string;
  type: { name: string };
  timestamp: string;
  location?: [number, number];
  player: { name: string };
  team: { name: string };
  shot?: {
    statsbomb_xg: number;
    outcome: { name: string };
    body_part: { name: string };
    technique: { name: string };
  };
  pass?: {
    recipient?: { name: string };
    length?: number;
    angle?: number;
    outcome?: { name: string };
  };
  pressure?: {
    distance: number;
  };
}

export interface Match {
  match_id: number;
  home_team: { id: number; name: string };
  away_team: { id: number; name: string };
  home_score: number;
  away_score: number;
  match_date: string;
  competition: { id: number; name: string };
}

export interface Competition {
  competition_id: number;
  competition_name: string;
  country_name: string;
  seasons: Array<{ season_id: number; season_name: string }>;
}

export interface Shot {
  x: number;
  y: number;
  xg: number;
  goal: boolean;
  bodyPart: string;
  technique: string;
  team: string;
  minute: number;
}

export interface Pass {
  x: number;
  y: number;
  length: number;
  angle: number;
  successful: boolean;
  team: string;
  progressive: boolean;
}

export interface Pressure {
  x: number;
  y: number;
  distance: number;
  team: string;
}

export interface XGStats {
  homeXG: number;
  awayXG: number;
  homeShots: number;
  awayShots: number;
  homeXGPerShot: number;
  awayXGPerShot: number;
}

export interface SpatialMaps {
  shotMap: number[][];
  pressureMap: number[][];
  passMap: number[][];
}

export interface PossessionStats {
  home: number;
  away: number;
}

export interface MatchFeatures {
  shots: Shot[];
  xG: XGStats;
  passes: Pass[];
  pressure: Pressure[];
  spatial: SpatialMaps;
  possession: PossessionStats;
  tempo: number;
}

export interface ModelFeatures {
  homeXG: number;
  awayXG: number;
  homeShots: number;
  awayShots: number;
  homePossession: number;
  awayPossession: number;
  tempo: number;
  shotMap: number[][];
  pressureMap: number[][];
  passMap: number[][];
  homeForm: number[];
  awayForm: number[];
}

export interface TrainingSample {
  matchId: number;
  features: ModelFeatures;
  outcome: 'home' | 'draw' | 'away';
  metadata: {
    competition: string;
    season: string;
    date: string;
    homeTeam: string;
    awayTeam: string;
  };
}

export interface TrainingDataset {
  samples: TrainingSample[];
}

export interface TeamStats {
  avgXG: number;
  avgXGA: number;
  last10Form: number[];
  goalsScored: number;
  goalsConceded: number;
}

export interface PlayerStats {
  xG: number;
  assists: number;
  minutes: number;
}

export interface BuildDatasetOptions {
  competitions: number[];
  minMatches: number;
  maxMatchesPerCompetition?: number;
  onProgress?: (message: string, progress: number) => void;
}

// ============================================================================
// StatsBomb Pipeline
// ============================================================================

export class StatsBombPipeline {
  private baseUrl = 'https://raw.githubusercontent.com/statsbomb/open-data/master/data';
  private cache: Map<string, unknown> = new Map();
  
  /**
   * Get all available competitions (FREE!)
   */
  async getCompetitions(): Promise<Competition[]> {
    const cacheKey = 'competitions';
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) as Competition[];
    }
    
    const response = await fetch(`${this.baseUrl}/competitions.json`);
    if (!response.ok) {
      throw new Error(`Failed to fetch competitions: ${response.statusText}`);
    }
    
    const competitions = await response.json();
    this.cache.set(cacheKey, competitions);
    return competitions;
  }
  
  /**
   * Get all matches for a competition/season
   */
  async getMatches(competitionId: number, seasonId: number): Promise<Match[]> {
    const cacheKey = `matches_${competitionId}_${seasonId}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) as Match[];
    }
    
    try {
      const response = await fetch(
        `${this.baseUrl}/matches/${competitionId}/${seasonId}.json`
      );
      
      if (!response.ok) {
        console.warn(`No matches found for competition ${competitionId}, season ${seasonId}`);
        return [];
      }
      
      const matches = await response.json();
      this.cache.set(cacheKey, matches);
      return matches;
    } catch (error) {
      console.error('Failed to fetch matches:', error);
      return [];
    }
  }
  
  /**
   * Get all events for a match (shots, passes, pressure, etc.)
   */
  async getMatchEvents(matchId: number): Promise<StatsBombEvent[]> {
    const cacheKey = `events_${matchId}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) as StatsBombEvent[];
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/events/${matchId}.json`);
      
      if (!response.ok) {
        console.warn(`No events found for match ${matchId}`);
        return [];
      }
      
      const events = await response.json();
      this.cache.set(cacheKey, events);
      return events;
    } catch (error) {
      console.error('Failed to fetch events:', error);
      return [];
    }
  }
  
  /**
   * Extract comprehensive features from match events
   */
  async extractMatchFeatures(matchId: number, homeTeamName?: string): Promise<MatchFeatures | null> {
    const events = await this.getMatchEvents(matchId);
    
    if (events.length === 0) {
      return null;
    }
    
    // Determine home team from first event or provided name
    const firstTeam = homeTeamName || events[0]?.team?.name;
    if (!firstTeam) {
      return null;
    }
    
    const homeEvents = events.filter(e => e.team?.name === firstTeam);
    const awayEvents = events.filter(e => e.team?.name !== firstTeam);
    
    return {
      shots: this.extractShots(events),
      xG: this.calculateTeamXG(homeEvents, awayEvents),
      passes: this.extractPasses(events),
      pressure: this.extractPressure(events),
      spatial: this.createSpatialMaps(events, firstTeam),
      possession: this.calculatePossession(events, firstTeam),
      tempo: this.calculateTempo(events)
    };
  }
  
  /**
   * Extract shot data with xG
   */
  private extractShots(events: StatsBombEvent[]): Shot[] {
    return events
      .filter(e => e.type?.name === 'Shot' && e.shot)
      .map(e => ({
        x: e.location?.[0] || 0,
        y: e.location?.[1] || 0,
        xg: e.shot!.statsbomb_xg || 0,
        goal: e.shot!.outcome?.name === 'Goal',
        bodyPart: e.shot!.body_part?.name || 'Unknown',
        technique: e.shot!.technique?.name || 'Unknown',
        team: e.team?.name || 'Unknown',
        minute: this.parseTimestamp(e.timestamp)
      }));
  }
  
  /**
   * Calculate team xG totals
   */
  private calculateTeamXG(homeEvents: StatsBombEvent[], awayEvents: StatsBombEvent[]): XGStats {
    const homeShots = homeEvents.filter(e => e.type?.name === 'Shot' && e.shot);
    const awayShots = awayEvents.filter(e => e.type?.name === 'Shot' && e.shot);
    
    const homeXG = homeShots.reduce((sum, e) => sum + (e.shot?.statsbomb_xg || 0), 0);
    const awayXG = awayShots.reduce((sum, e) => sum + (e.shot?.statsbomb_xg || 0), 0);
    
    return {
      homeXG,
      awayXG,
      homeShots: homeShots.length,
      awayShots: awayShots.length,
      homeXGPerShot: homeShots.length > 0 ? homeXG / homeShots.length : 0,
      awayXGPerShot: awayShots.length > 0 ? awayXG / awayShots.length : 0
    };
  }
  
  /**
   * Extract pass data (for network analysis)
   */
  private extractPasses(events: StatsBombEvent[]): Pass[] {
    return events
      .filter(e => e.type?.name === 'Pass' && e.pass)
      .map(e => ({
        x: e.location?.[0] || 0,
        y: e.location?.[1] || 0,
        length: e.pass!.length || 0,
        angle: e.pass!.angle || 0,
        successful: e.pass!.outcome?.name !== 'Incomplete',
        team: e.team?.name || 'Unknown',
        progressive: this.isProgressive(e)
      }));
  }
  
  /**
   * Extract pressure events
   */
  private extractPressure(events: StatsBombEvent[]): Pressure[] {
    return events
      .filter(e => e.type?.name === 'Pressure')
      .map(e => ({
        x: e.location?.[0] || 0,
        y: e.location?.[1] || 0,
        distance: e.pressure?.distance || 0,
        team: e.team?.name || 'Unknown'
      }));
  }
  
  /**
   * Create 12x8 spatial heatmaps (for CNN model)
   */
  private createSpatialMaps(events: StatsBombEvent[], homeTeam: string): SpatialMaps {
    const shotMap = this.createGridMap(12, 8);
    const pressureMap = this.createGridMap(12, 8);
    const passMap = this.createGridMap(12, 8);
    
    events.forEach(e => {
      if (!e.location) return;
      
      // StatsBomb pitch is 120x80
      const gridX = Math.min(11, Math.max(0, Math.floor((e.location[0] / 120) * 12)));
      const gridY = Math.min(7, Math.max(0, Math.floor((e.location[1] / 80) * 8)));
      
      const value = e.team?.name === homeTeam ? 1 : -1;
      
      if (e.type?.name === 'Shot') {
        shotMap[gridX][gridY] += value * (e.shot?.statsbomb_xg || 0.1);
      } else if (e.type?.name === 'Pressure') {
        pressureMap[gridX][gridY] += value;
      } else if (e.type?.name === 'Pass') {
        passMap[gridX][gridY] += value * 0.1;
      }
    });
    
    return {
      shotMap: this.normalizeMap(shotMap),
      pressureMap: this.normalizeMap(pressureMap),
      passMap: this.normalizeMap(passMap)
    };
  }
  
  /**
   * Calculate possession percentage
   */
  private calculatePossession(events: StatsBombEvent[], homeTeam: string): PossessionStats {
    const homeEvents = events.filter(e => e.team?.name === homeTeam);
    const totalEvents = events.length;
    
    if (totalEvents === 0) {
      return { home: 50, away: 50 };
    }
    
    const homePossession = (homeEvents.length / totalEvents) * 100;
    
    return {
      home: homePossession,
      away: 100 - homePossession
    };
  }
  
  /**
   * Calculate tempo (events per minute)
   */
  private calculateTempo(events: StatsBombEvent[]): number {
    if (events.length === 0) return 0;
    
    const lastEvent = events[events.length - 1];
    const minutes = this.parseTimestamp(lastEvent.timestamp);
    
    return minutes > 0 ? events.length / minutes : 0;
  }
  
  /**
   * Build complete training dataset from multiple competitions
   */
  async buildTrainingDataset(options: BuildDatasetOptions): Promise<TrainingDataset> {
    const {
      competitions = [11, 37, 43], // La Liga, FA Women's Super League, FIFA World Cup
      minMatches = 500,
      maxMatchesPerCompetition = 200,
      onProgress
    } = options;
    
    onProgress?.('📦 Building training dataset from StatsBomb open data...', 0);
    
    const samples: TrainingSample[] = [];
    const allCompetitions = await this.getCompetitions();
    
    let totalProcessed = 0;
    const targetMatches = Math.min(minMatches, competitions.length * maxMatchesPerCompetition);
    
    for (const compId of competitions) {
      const comp = allCompetitions.find(c => c.competition_id === compId);
      
      if (!comp) {
        onProgress?.(`⚠️ Competition ${compId} not found, skipping...`, totalProcessed / targetMatches);
        continue;
      }
      
      let compMatchCount = 0;
      
      for (const season of comp.seasons) {
        if (compMatchCount >= maxMatchesPerCompetition) break;
        if (samples.length >= minMatches) break;
        
        const matches = await this.getMatches(compId, season.season_id);
        
        onProgress?.(
          `Processing ${comp.competition_name} ${season.season_name} (${matches.length} matches)`,
          totalProcessed / targetMatches
        );
        
        for (const match of matches) {
          if (compMatchCount >= maxMatchesPerCompetition) break;
          if (samples.length >= minMatches) break;
          
          try {
            const features = await this.extractMatchFeatures(
              match.match_id,
              match.home_team?.name
            );
            
            if (!features) continue;
            
            const outcome: 'home' | 'draw' | 'away' = 
              match.home_score > match.away_score ? 'home' :
              match.home_score < match.away_score ? 'away' : 'draw';
            
            samples.push({
              matchId: match.match_id,
              features: this.formatFeatures(features),
              outcome,
              metadata: {
                competition: comp.competition_name,
                season: season.season_name,
                date: match.match_date,
                homeTeam: match.home_team?.name || 'Unknown',
                awayTeam: match.away_team?.name || 'Unknown'
              }
            });
            
            compMatchCount++;
            totalProcessed++;
            
            if (totalProcessed % 10 === 0) {
              onProgress?.(
                `Processed ${totalProcessed} matches (${samples.length} valid samples)`,
                Math.min(1, totalProcessed / targetMatches)
              );
            }
            
            // Small delay to avoid rate limiting
            await this.delay(50);
            
          } catch (error) {
            console.error(`Failed to process match ${match.match_id}:`, error);
          }
        }
      }
    }
    
    onProgress?.(`✅ Dataset complete: ${samples.length} matches`, 1);
    
    return { samples };
  }
  
  /**
   * Format features for ML model
   */
  private formatFeatures(raw: MatchFeatures): ModelFeatures {
    return {
      // Dense features
      homeXG: raw.xG.homeXG,
      awayXG: raw.xG.awayXG,
      homeShots: raw.xG.homeShots,
      awayShots: raw.xG.awayShots,
      homePossession: raw.possession.home,
      awayPossession: raw.possession.away,
      tempo: raw.tempo,
      
      // Spatial features (12x8 grids)
      shotMap: raw.spatial.shotMap,
      pressureMap: raw.spatial.pressureMap,
      passMap: raw.spatial.passMap,
      
      // Temporal features (placeholder - would need historical data)
      homeForm: new Array(10).fill(0.5),
      awayForm: new Array(10).fill(0.5)
    };
  }
  
  /**
   * Helper methods
   */
  private createGridMap(width: number, height: number): number[][] {
    return Array.from({ length: width }, () => Array(height).fill(0));
  }
  
  private normalizeMap(map: number[][]): number[][] {
    const flat = map.flat();
    const max = Math.max(...flat.map(Math.abs));
    
    if (max === 0) return map;
    
    return map.map(row => row.map(val => val / max));
  }
  
  private isProgressive(event: StatsBombEvent): boolean {
    if (!event.location || !event.pass?.length) return false;
    
    const x = event.location[0];
    const length = event.pass.length;
    
    // Progressive if moves ball closer to goal
    return x < 60 && length > 10;
  }
  
  private parseTimestamp(timestamp: string): number {
    if (!timestamp) return 0;
    const parts = timestamp.split(':');
    return parseInt(parts[0] || '0') + parseInt(parts[1] || '0') / 60;
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// ============================================================================
// FBref Scraper (for real-time stats)
// ============================================================================

export class FBrefScraper {
  /**
   * Get team advanced stats via API route (to avoid CORS)
   */
  async getTeamStats(teamName: string, season: string): Promise<TeamStats> {
    try {
      const response = await fetch('/api/scrape/fbref', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'team', teamName, season })
      });
      
      if (!response.ok) {
        throw new Error(`FBref scrape failed: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.warn('FBref scrape failed, returning defaults:', error);
      return {
        avgXG: 1.5,
        avgXGA: 1.2,
        last10Form: new Array(10).fill(0.5),
        goalsScored: 0,
        goalsConceded: 0
      };
    }
  }
  
  /**
   * Get player stats
   */
  async getPlayerStats(playerId: string): Promise<PlayerStats> {
    try {
      const response = await fetch('/api/scrape/fbref', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'player', playerId })
      });
      
      if (!response.ok) {
        throw new Error(`FBref player scrape failed: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.warn('FBref player scrape failed, returning defaults:', error);
      return { xG: 0, assists: 0, minutes: 0 };
    }
  }
}

// ============================================================================
// Combined Pipeline
// ============================================================================

export class FreeDataPipeline {
  private statsbomb: StatsBombPipeline;
  private fbref: FBrefScraper;
  
  constructor() {
    this.statsbomb = new StatsBombPipeline();
    this.fbref = new FBrefScraper();
  }
  
  /**
   * Build comprehensive training dataset
   */
  async build(options?: Partial<BuildDatasetOptions>): Promise<TrainingDataset> {
    return this.statsbomb.buildTrainingDataset({
      competitions: [11, 37, 43, 2], // La Liga, WSL, World Cup, Premier League
      minMatches: 500,
      maxMatchesPerCompetition: 150,
      ...options
    });
  }
  
  /**
   * Get live match features (for real-time predictions)
   */
  async getLiveFeatures(homeTeam: string, awayTeam: string): Promise<ModelFeatures> {
    const [homeStats, awayStats] = await Promise.all([
      this.fbref.getTeamStats(homeTeam, '2024-2025'),
      this.fbref.getTeamStats(awayTeam, '2024-2025')
    ]);
    
    return this.combineStats(homeStats, awayStats);
  }
  
  private combineStats(home: TeamStats, away: TeamStats): ModelFeatures {
    return {
      homeXG: home.avgXG,
      awayXG: away.avgXG,
      homeShots: Math.round(home.avgXG * 8), // Approximate
      awayShots: Math.round(away.avgXG * 8),
      homePossession: 50,
      awayPossession: 50,
      tempo: 20,
      shotMap: this.createEmptyGrid(12, 8),
      pressureMap: this.createEmptyGrid(12, 8),
      passMap: this.createEmptyGrid(12, 8),
      homeForm: home.last10Form,
      awayForm: away.last10Form
    };
  }
  
  private createEmptyGrid(width: number, height: number): number[][] {
    return Array.from({ length: width }, () => Array(height).fill(0));
  }
  
  /**
   * Get the underlying StatsBomb pipeline
   */
  getStatsBombPipeline(): StatsBombPipeline {
    return this.statsbomb;
  }
}

// ============================================================================
// Exports
// ============================================================================

export const statsBombPipeline = new StatsBombPipeline();
export const freeDataPipeline = new FreeDataPipeline();
