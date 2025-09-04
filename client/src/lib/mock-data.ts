// This file contains mock data structure definitions for reference
// The actual data is served from the backend API

export interface MockLeague {
  id: string;
  name: string;
  country: string;
  flag: string;
}

export interface MockTeam {
  id: string;
  name: string;
  leagueId: string;
  logo: string;
}

export interface MockMatch {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  leagueId: string;
  matchDate: Date;
  status: string;
}

export interface MockPrediction {
  id: string;
  matchId: string;
  prediction: string;
  confidence: number;
  expectedGoalsHome: string;
  expectedGoalsAway: string;
  valueBets: Array<{
    bet: string;
    expectedOdds: number;
    marketOdds: number;
    value: number;
  }>;
  insights: string[];
}

export interface MockTeamStats {
  id: string;
  teamId: string;
  goalsPerGame: string;
  expectedGoals: string;
  possessionPercent: number;
  shotsOnTarget: string;
  recentForm: string;
}
