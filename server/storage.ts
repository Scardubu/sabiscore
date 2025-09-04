import { type League, type Team, type Match, type Prediction, type TeamStats } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Leagues
  getLeagues(): Promise<League[]>;
  
  // Teams
  getTeamsByLeague(leagueId: string): Promise<Team[]>;
  getTeam(id: string): Promise<Team | undefined>;
  
  // Matches
  getUpcomingMatches(leagueId?: string): Promise<(Match & { homeTeam: Team; awayTeam: Team; league: League })[]>;
  getMatch(id: string): Promise<Match | undefined>;
  
  // Predictions
  getPredictionByMatch(matchId: string): Promise<Prediction | undefined>;
  
  // Team Stats
  getTeamStats(teamId: string): Promise<TeamStats | undefined>;
}

export class MemStorage implements IStorage {
  private leagues: Map<string, League>;
  private teams: Map<string, Team>;
  private matches: Map<string, Match>;
  private predictions: Map<string, Prediction>;
  private teamStats: Map<string, TeamStats>;

  constructor() {
    this.leagues = new Map();
    this.teams = new Map();
    this.matches = new Map();
    this.predictions = new Map();
    this.teamStats = new Map();
    this.initializeData();
  }

  private initializeData() {
    // Initialize leagues
    const leagueData = [
      { id: "1", name: "Premier League", country: "England", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
      { id: "2", name: "La Liga", country: "Spain", flag: "🇪🇸" },
      { id: "3", name: "Bundesliga", country: "Germany", flag: "🇩🇪" },
      { id: "4", name: "Serie A", country: "Italy", flag: "🇮🇹" },
      { id: "5", name: "Ligue 1", country: "France", flag: "🇫🇷" },
      { id: "6", name: "Champions League", country: "Europe", flag: "🏆" },
    ];

    leagueData.forEach(league => this.leagues.set(league.id, league));

    // Initialize teams
    const teamData = [
      { id: "1", name: "Manchester City", leagueId: "1", logo: "fas fa-shield-alt" },
      { id: "2", name: "Arsenal", leagueId: "1", logo: "fas fa-cannon" },
      { id: "3", name: "Chelsea", leagueId: "1", logo: "fas fa-lion" },
      { id: "4", name: "Real Madrid", leagueId: "6", logo: "fas fa-crown" },
      { id: "5", name: "Bayern Munich", leagueId: "6", logo: "fas fa-star" },
      { id: "6", name: "Liverpool", leagueId: "6", logo: "fas fa-fire" },
    ];

    teamData.forEach(team => this.teams.set(team.id, team));

    // Initialize matches
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(20, 0, 0, 0);

    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);
    dayAfter.setHours(20, 0, 0, 0);

    const matchData = [
      { id: "1", homeTeamId: "1", awayTeamId: "4", leagueId: "6", matchDate: tomorrow, status: "upcoming" },
      { id: "2", homeTeamId: "5", awayTeamId: "6", leagueId: "6", matchDate: dayAfter, status: "upcoming" },
      { id: "3", homeTeamId: "2", awayTeamId: "3", leagueId: "1", matchDate: dayAfter, status: "upcoming" },
    ];

    matchData.forEach(match => this.matches.set(match.id, match));

    // Initialize predictions
    const predictionData = [
      {
        id: "1",
        matchId: "1",
        prediction: "home_win",
        confidence: 78,
        expectedGoalsHome: "2.1",
        expectedGoalsAway: "1.3",
        valueBets: [
          { bet: "Manchester City Win", expectedOdds: 1.85, marketOdds: 2.20, value: 18.9 },
        ],
        insights: ["Man City unbeaten in last 8 home games", "Both teams average 2+ goals per game"],
      },
      {
        id: "2",
        matchId: "2",
        prediction: "draw",
        confidence: 62,
        expectedGoalsHome: "1.8",
        expectedGoalsAway: "1.9",
        valueBets: [
          { bet: "Over 2.5 Goals", expectedOdds: 1.75, marketOdds: 1.95, value: 11.4 },
        ],
        insights: ["Both teams in excellent form", "Historical matches tend to be high-scoring"],
      },
      {
        id: "3",
        matchId: "3",
        prediction: "draw",
        confidence: 58,
        expectedGoalsHome: "1.5",
        expectedGoalsAway: "1.4",
        valueBets: [
          { bet: "BTTS Yes", expectedOdds: 1.90, marketOdds: 2.00, value: 5.3 },
        ],
        insights: ["London derby typically tight", "Both teams strong at home"],
      },
    ];

    predictionData.forEach(prediction => this.predictions.set(prediction.id, prediction));

    // Initialize team stats
    const statsData = [
      { id: "1", teamId: "1", goalsPerGame: "2.3", expectedGoals: "2.1", possessionPercent: 63, shotsOnTarget: "5.2", recentForm: "WWDWW" },
      { id: "2", teamId: "4", goalsPerGame: "2.1", expectedGoals: "1.8", possessionPercent: 58, shotsOnTarget: "4.8", recentForm: "WWWLW" },
      { id: "3", teamId: "5", goalsPerGame: "2.0", expectedGoals: "1.9", possessionPercent: 60, shotsOnTarget: "4.5", recentForm: "WWLWW" },
      { id: "4", teamId: "6", goalsPerGame: "1.9", expectedGoals: "1.8", possessionPercent: 55, shotsOnTarget: "4.2", recentForm: "WDWWL" },
    ];

    statsData.forEach(stats => this.teamStats.set(stats.id, stats));
  }

  async getLeagues(): Promise<League[]> {
    return Array.from(this.leagues.values());
  }

  async getTeamsByLeague(leagueId: string): Promise<Team[]> {
    return Array.from(this.teams.values()).filter(team => team.leagueId === leagueId);
  }

  async getTeam(id: string): Promise<Team | undefined> {
    return this.teams.get(id);
  }

  async getUpcomingMatches(leagueId?: string): Promise<(Match & { homeTeam: Team; awayTeam: Team; league: League })[]> {
    const matches = Array.from(this.matches.values()).filter(match => 
      match.status === "upcoming" && (!leagueId || match.leagueId === leagueId)
    );

    return matches.map(match => {
      const homeTeam = this.teams.get(match.homeTeamId!)!;
      const awayTeam = this.teams.get(match.awayTeamId!)!;
      const league = this.leagues.get(match.leagueId!)!;
      return { ...match, homeTeam, awayTeam, league };
    });
  }

  async getMatch(id: string): Promise<Match | undefined> {
    return this.matches.get(id);
  }

  async getPredictionByMatch(matchId: string): Promise<Prediction | undefined> {
    return Array.from(this.predictions.values()).find(prediction => prediction.matchId === matchId);
  }

  async getTeamStats(teamId: string): Promise<TeamStats | undefined> {
    return Array.from(this.teamStats.values()).find(stats => stats.teamId === teamId);
  }
}

export const storage = new MemStorage();
