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
  
  // Analytics
  getAnalyticsData(): Promise<any>;
}

export class MemStorage implements IStorage {
  private analyticsData: {
    valueBets: Array<{
      bet: string;
      expected: number;
      market: number;
      value: number;
      confidence: number;
      type: string;
    }>;
    marketMovements: Array<{
      bet: string;
      change: number;
      from: number;
      to: number;
      direction: string;
    }>;
    todayStats: Array<{
      label: string;
      value: string;
      testId: string;
      color?: string;
    }>;
    performance: Array<{
      period: string;
      value: string;
      progress: number;
    }>;
  };

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
    this.analyticsData = {
      valueBets: [],
      marketMovements: [],
      todayStats: [],
      performance: []
    };
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

    // Initialize teams with proper logos and extended roster
    const teamData = [
      // Premier League
      { id: "1", name: "Manchester City", leagueId: "1", logo: "🏃‍♂️" },
      { id: "2", name: "Arsenal", leagueId: "1", logo: "🔴" },
      { id: "3", name: "Chelsea", leagueId: "1", logo: "🔵" },
      { id: "4", name: "Liverpool", leagueId: "1", logo: "🔴" },
      { id: "5", name: "Manchester United", leagueId: "1", logo: "👹" },
      { id: "6", name: "Tottenham", leagueId: "1", logo: "⚪" },
      
      // La Liga
      { id: "7", name: "Real Madrid", leagueId: "2", logo: "👑" },
      { id: "8", name: "Barcelona", leagueId: "2", logo: "🔴🔵" },
      { id: "9", name: "Atletico Madrid", leagueId: "2", logo: "⚪🔴" },
      { id: "10", name: "Sevilla", leagueId: "2", logo: "⚪🔴" },
      
      // Bundesliga
      { id: "11", name: "Bayern Munich", leagueId: "3", logo: "🔴⚪" },
      { id: "12", name: "Borussia Dortmund", leagueId: "3", logo: "🟡⚫" },
      { id: "13", name: "RB Leipzig", leagueId: "3", logo: "🔴⚪" },
      { id: "14", name: "Bayer Leverkusen", leagueId: "3", logo: "⚫🔴" },
      
      // Serie A
      { id: "15", name: "Juventus", leagueId: "4", logo: "⚫⚪" },
      { id: "16", name: "Inter Milan", leagueId: "4", logo: "🔵⚫" },
      { id: "17", name: "AC Milan", leagueId: "4", logo: "🔴⚫" },
      { id: "18", name: "Napoli", leagueId: "4", logo: "🔵" },
      
      // Ligue 1
      { id: "19", name: "Paris Saint-Germain", leagueId: "5", logo: "🔵🔴" },
      { id: "20", name: "Marseille", leagueId: "5", logo: "⚪🔵" },
      { id: "21", name: "Lyon", leagueId: "5", logo: "🔵⚪" },
      { id: "22", name: "Monaco", leagueId: "5", logo: "🔴⚪" },
      
      // Champions League (top teams)
      { id: "23", name: "Real Madrid", leagueId: "6", logo: "👑" },
      { id: "24", name: "Manchester City", leagueId: "6", logo: "🏃‍♂️" },
      { id: "25", name: "Bayern Munich", leagueId: "6", logo: "🔴⚪" },
      { id: "26", name: "Barcelona", leagueId: "6", logo: "🔴🔵" },
      { id: "27", name: "Liverpool", leagueId: "6", logo: "🔴" },
      { id: "28", name: "Inter Milan", leagueId: "6", logo: "🔵⚫" },
    ];

    teamData.forEach(team => this.teams.set(team.id, team));

    // Initialize matches with more variety
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(20, 0, 0, 0);

    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);
    dayAfter.setHours(16, 30, 0, 0);

    const dayAfter2 = new Date();
    dayAfter2.setDate(dayAfter2.getDate() + 3);
    dayAfter2.setHours(18, 45, 0, 0);

    const matchData = [
      // Champions League matches
      { id: "1", homeTeamId: "24", awayTeamId: "23", leagueId: "6", matchDate: tomorrow, status: "upcoming" },
      { id: "2", homeTeamId: "25", awayTeamId: "27", leagueId: "6", matchDate: dayAfter, status: "upcoming" },
      { id: "3", homeTeamId: "26", awayTeamId: "28", leagueId: "6", matchDate: dayAfter2, status: "upcoming" },
      
      // Premier League matches
      { id: "4", homeTeamId: "2", awayTeamId: "3", leagueId: "1", matchDate: dayAfter, status: "upcoming" },
      { id: "5", homeTeamId: "1", awayTeamId: "4", leagueId: "1", matchDate: dayAfter2, status: "upcoming" },
      { id: "6", homeTeamId: "5", awayTeamId: "6", leagueId: "1", matchDate: tomorrow, status: "upcoming" },
      
      // La Liga matches
      { id: "7", homeTeamId: "7", awayTeamId: "8", leagueId: "2", matchDate: tomorrow, status: "upcoming" },
      { id: "8", homeTeamId: "9", awayTeamId: "10", leagueId: "2", matchDate: dayAfter, status: "upcoming" },
      
      // Bundesliga matches
      { id: "9", homeTeamId: "11", awayTeamId: "12", leagueId: "3", matchDate: dayAfter, status: "upcoming" },
      { id: "10", homeTeamId: "13", awayTeamId: "14", leagueId: "3", matchDate: dayAfter2, status: "upcoming" },
      
      // Serie A matches
      { id: "11", homeTeamId: "15", awayTeamId: "16", leagueId: "4", matchDate: tomorrow, status: "upcoming" },
      { id: "12", homeTeamId: "17", awayTeamId: "18", leagueId: "4", matchDate: dayAfter2, status: "upcoming" },
      
      // Ligue 1 matches
      { id: "13", homeTeamId: "19", awayTeamId: "20", leagueId: "5", matchDate: dayAfter, status: "upcoming" },
      { id: "14", homeTeamId: "21", awayTeamId: "22", leagueId: "5", matchDate: dayAfter2, status: "upcoming" },
    ];

    matchData.forEach(match => this.matches.set(match.id, match));

    // Initialize predictions with dynamic data
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
          { bet: "Over 2.5 Goals", expectedOdds: 1.65, marketOdds: 1.85, value: 12.1 },
        ],
        insights: ["Man City's home form is exceptional with 8 wins in last 10", "Real Madrid struggles away in England", "Historical El Clasico matchups favor attacking play"],
      },
      {
        id: "2",
        matchId: "2",
        prediction: "away_win",
        confidence: 72,
        expectedGoalsHome: "1.6",
        expectedGoalsAway: "2.3",
        valueBets: [
          { bet: "Liverpool Win", expectedOdds: 2.10, marketOdds: 2.40, value: 14.3 },
          { bet: "Over 3.5 Goals", expectedOdds: 2.25, marketOdds: 2.50, value: 11.1 },
        ],
        insights: ["Liverpool's counter-attacking style perfect against Bayern's high line", "Both teams average 2.8+ goals in Champions League", "Anfield atmosphere gives significant home advantage"],
      },
      {
        id: "3",
        matchId: "3",
        prediction: "home_win",
        confidence: 68,
        expectedGoalsHome: "2.0",
        expectedGoalsAway: "1.2",
        valueBets: [
          { bet: "Barcelona Win", expectedOdds: 1.75, marketOdds: 1.95, value: 11.4 },
          { bet: "Messi Anytime Scorer", expectedOdds: 1.80, marketOdds: 2.00, value: 11.1 },
        ],
        insights: ["Barcelona unbeaten at Camp Nou in Champions League this season", "Inter Milan's away form concerning with only 2 wins in 8", "Head-to-head record favors Barcelona significantly"],
      },
      {
        id: "4",
        matchId: "4",
        prediction: "draw",
        confidence: 61,
        expectedGoalsHome: "1.7",
        expectedGoalsAway: "1.5",
        valueBets: [
          { bet: "Draw", expectedOdds: 3.20, marketOdds: 3.60, value: 12.5 },
          { bet: "BTTS Yes", expectedOdds: 1.90, marketOdds: 2.10, value: 10.5 },
        ],
        insights: ["London derby typically tight affairs", "Both teams strong defensively this season", "Arsenal's Emirates form vs Chelsea's away struggles"],
      },
      {
        id: "5",
        matchId: "5",
        prediction: "home_win",
        confidence: 75,
        expectedGoalsHome: "2.2",
        expectedGoalsAway: "1.4",
        valueBets: [
          { bet: "Man City Win", expectedOdds: 1.65, marketOdds: 1.85, value: 12.1 },
          { bet: "City -1 Handicap", expectedOdds: 2.30, marketOdds: 2.60, value: 13.0 },
        ],
        insights: ["City's Etihad dominance continues", "Liverpool's defensive injuries showing", "Guardiola's tactical edge in recent meetings"],
      },
      {
        id: "6",
        matchId: "6",
        prediction: "away_win",
        confidence: 69,
        expectedGoalsHome: "1.3",
        expectedGoalsAway: "1.9",
        valueBets: [
          { bet: "Tottenham Win", expectedOdds: 2.20, marketOdds: 2.50, value: 13.6 },
          { bet: "Under 2.5 Goals", expectedOdds: 1.95, marketOdds: 2.15, value: 10.3 },
        ],
        insights: ["United's home form concerning lately", "Spurs excel in big away fixtures", "Conte's defensive setup perfect for Old Trafford"],
      },
      {
        id: "7",
        matchId: "7",
        prediction: "home_win",
        confidence: 82,
        expectedGoalsHome: "2.5",
        expectedGoalsAway: "1.1",
        valueBets: [
          { bet: "Real Madrid Win", expectedOdds: 1.55, marketOdds: 1.70, value: 9.7 },
          { bet: "Real -1.5 Handicap", expectedOdds: 2.40, marketOdds: 2.75, value: 14.6 },
        ],
        insights: ["El Clasico at Bernabeu heavily favors Real", "Barcelona's away form in crisis", "Benzema vs Ter Stegen key individual battle"],
      },
      {
        id: "8",
        matchId: "8",
        prediction: "home_win",
        confidence: 71,
        expectedGoalsHome: "1.9",
        expectedGoalsAway: "1.2",
        valueBets: [
          { bet: "Atletico Win", expectedOdds: 1.95, marketOdds: 2.15, value: 10.3 },
          { bet: "Under 2.5 Goals", expectedOdds: 1.75, marketOdds: 1.90, value: 8.6 },
        ],
        insights: ["Atletico's fortress mentality at Wanda", "Sevilla struggles against defensive teams", "Simeone's tactical discipline key factor"],
      },
      {
        id: "9",
        matchId: "9",
        prediction: "away_win",
        confidence: 76,
        expectedGoalsHome: "1.4",
        expectedGoalsAway: "2.1",
        valueBets: [
          { bet: "Dortmund Win", expectedOdds: 2.05, marketOdds: 2.35, value: 14.6 },
          { bet: "Haaland Anytime Scorer", expectedOdds: 1.65, marketOdds: 1.85, value: 12.1 },
        ],
        insights: ["Der Klassiker always delivers goals", "Dortmund's young guns in top form", "Bayern's recent defensive vulnerabilities exposed"],
      },
      {
        id: "10",
        matchId: "10",
        prediction: "home_win",
        confidence: 64,
        expectedGoalsHome: "1.8",
        expectedGoalsAway: "1.3",
        valueBets: [
          { bet: "Leipzig Win", expectedOdds: 1.85, marketOdds: 2.05, value: 10.8 },
          { bet: "Both Teams Score", expectedOdds: 1.80, marketOdds: 1.95, value: 8.3 },
        ],
        insights: ["Leipzig's Red Bull Arena advantage", "Leverkusen's inconsistent away form", "High-pressing styles should create chances"],
      },
      {
        id: "11",
        matchId: "11",
        prediction: "draw",
        confidence: 59,
        expectedGoalsHome: "1.6",
        expectedGoalsAway: "1.5",
        valueBets: [
          { bet: "Draw", expectedOdds: 3.10, marketOdds: 3.50, value: 12.9 },
          { bet: "Under 3.5 Goals", expectedOdds: 1.65, marketOdds: 1.80, value: 9.1 },
        ],
        insights: ["Derby della Mole always tightly contested", "Both teams defensively solid this season", "Recent meetings typically low-scoring affairs"],
      },
      {
        id: "12",
        matchId: "12",
        prediction: "away_win",
        confidence: 67,
        expectedGoalsHome: "1.2",
        expectedGoalsAway: "1.9",
        valueBets: [
          { bet: "Napoli Win", expectedOdds: 2.25, marketOdds: 2.50, value: 11.1 },
          { bet: "Osimhen Anytime Scorer", expectedOdds: 1.90, marketOdds: 2.10, value: 10.5 },
        ],
        insights: ["Napoli's title charge continues", "Milan's San Siro not the fortress it once was", "Spalletti's tactics perfect for big games"],
      },
      {
        id: "13",
        matchId: "13",
        prediction: "home_win",
        confidence: 79,
        expectedGoalsHome: "2.3",
        expectedGoalsAway: "1.0",
        valueBets: [
          { bet: "PSG Win", expectedOdds: 1.45, marketOdds: 1.60, value: 10.3 },
          { bet: "Mbappe 2+ Goals", expectedOdds: 3.50, marketOdds: 4.00, value: 14.3 },
        ],
        insights: ["PSG's Parc des Princes dominance", "Marseille's Le Classique struggles", "Star power difference too significant"],
      },
      {
        id: "14",
        matchId: "14",
        prediction: "draw",
        confidence: 55,
        expectedGoalsHome: "1.4",
        expectedGoalsAway: "1.3",
        valueBets: [
          { bet: "Draw", expectedOdds: 3.30, marketOdds: 3.80, value: 15.2 },
          { bet: "Under 2.5 Goals", expectedOdds: 1.85, marketOdds: 2.05, value: 10.8 },
        ],
        insights: ["Both teams in transition phase", "Tactical battle between experienced managers", "Historical meetings often cagey affairs"],
      },
    ];

    predictionData.forEach(prediction => this.predictions.set(prediction.id, prediction));

    // Initialize comprehensive team stats
    const statsData = [
      // Premier League teams
      { id: "1", teamId: "1", goalsPerGame: "2.3", expectedGoals: "2.1", possessionPercent: 63, shotsOnTarget: "5.2", recentForm: "WWDWW" },
      { id: "2", teamId: "2", goalsPerGame: "1.9", expectedGoals: "1.7", possessionPercent: 58, shotsOnTarget: "4.1", recentForm: "WDWWL" },
      { id: "3", teamId: "3", goalsPerGame: "1.8", expectedGoals: "1.6", possessionPercent: 55, shotsOnTarget: "3.9", recentForm: "LWWDW" },
      { id: "4", teamId: "4", goalsPerGame: "2.1", expectedGoals: "1.9", possessionPercent: 60, shotsOnTarget: "4.8", recentForm: "WWLWW" },
      { id: "5", teamId: "5", goalsPerGame: "1.7", expectedGoals: "1.5", possessionPercent: 52, shotsOnTarget: "3.4", recentForm: "LDWLW" },
      { id: "6", teamId: "6", goalsPerGame: "1.6", expectedGoals: "1.4", possessionPercent: 49, shotsOnTarget: "3.2", recentForm: "WLDWL" },
      
      // La Liga teams
      { id: "7", teamId: "7", goalsPerGame: "2.4", expectedGoals: "2.2", possessionPercent: 65, shotsOnTarget: "5.8", recentForm: "WWWWL" },
      { id: "8", teamId: "8", goalsPerGame: "2.0", expectedGoals: "1.8", possessionPercent: 68, shotsOnTarget: "4.5", recentForm: "WDLWW" },
      { id: "9", teamId: "9", goalsPerGame: "1.4", expectedGoals: "1.2", possessionPercent: 45, shotsOnTarget: "2.8", recentForm: "DWWDL" },
      { id: "10", teamId: "10", goalsPerGame: "1.6", expectedGoals: "1.4", possessionPercent: 54, shotsOnTarget: "3.6", recentForm: "WLWDW" },
      
      // Bundesliga teams
      { id: "11", teamId: "11", goalsPerGame: "2.5", expectedGoals: "2.3", possessionPercent: 62, shotsOnTarget: "5.9", recentForm: "WWWDW" },
      { id: "12", teamId: "12", goalsPerGame: "2.2", expectedGoals: "2.0", possessionPercent: 58, shotsOnTarget: "5.1", recentForm: "WLWWW" },
      { id: "13", teamId: "13", goalsPerGame: "1.9", expectedGoals: "1.7", possessionPercent: 56, shotsOnTarget: "4.2", recentForm: "DWWLW" },
      { id: "14", teamId: "14", goalsPerGame: "2.0", expectedGoals: "1.8", possessionPercent: 59, shotsOnTarget: "4.7", recentForm: "WWDWL" },
      
      // Serie A teams
      { id: "15", teamId: "15", goalsPerGame: "1.5", expectedGoals: "1.3", possessionPercent: 51, shotsOnTarget: "3.1", recentForm: "DWWDW" },
      { id: "16", teamId: "16", goalsPerGame: "1.8", expectedGoals: "1.6", possessionPercent: 54, shotsOnTarget: "3.8", recentForm: "WDWWL" },
      { id: "17", teamId: "17", goalsPerGame: "1.7", expectedGoals: "1.5", possessionPercent: 53, shotsOnTarget: "3.5", recentForm: "LWWDW" },
      { id: "18", teamId: "18", goalsPerGame: "2.1", expectedGoals: "1.9", possessionPercent: 57, shotsOnTarget: "4.9", recentForm: "WWWWW" },
      
      // Ligue 1 teams
      { id: "19", teamId: "19", goalsPerGame: "2.6", expectedGoals: "2.4", possessionPercent: 64, shotsOnTarget: "6.1", recentForm: "WWWWW" },
      { id: "20", teamId: "20", goalsPerGame: "1.3", expectedGoals: "1.1", possessionPercent: 48, shotsOnTarget: "2.9", recentForm: "LDWLW" },
      { id: "21", teamId: "21", goalsPerGame: "1.6", expectedGoals: "1.4", possessionPercent: 52, shotsOnTarget: "3.4", recentForm: "WDLWW" },
      { id: "22", teamId: "22", goalsPerGame: "1.8", expectedGoals: "1.6", possessionPercent: 55, shotsOnTarget: "4.0", recentForm: "DWWLW" },
      
      // Champions League teams (overlapping with league teams for consistent data)
      { id: "23", teamId: "23", goalsPerGame: "2.4", expectedGoals: "2.2", possessionPercent: 65, shotsOnTarget: "5.8", recentForm: "WWWWL" },
      { id: "24", teamId: "24", goalsPerGame: "2.3", expectedGoals: "2.1", possessionPercent: 63, shotsOnTarget: "5.2", recentForm: "WWDWW" },
      { id: "25", teamId: "25", goalsPerGame: "2.5", expectedGoals: "2.3", possessionPercent: 62, shotsOnTarget: "5.9", recentForm: "WWWDW" },
      { id: "26", teamId: "26", goalsPerGame: "2.0", expectedGoals: "1.8", possessionPercent: 68, shotsOnTarget: "4.5", recentForm: "WDLWW" },
      { id: "27", teamId: "27", goalsPerGame: "2.1", expectedGoals: "1.9", possessionPercent: 60, shotsOnTarget: "4.8", recentForm: "WWLWW" },
      { id: "28", teamId: "28", goalsPerGame: "1.8", expectedGoals: "1.6", possessionPercent: 54, shotsOnTarget: "3.8", recentForm: "WDWWL" },
    ];

    statsData.forEach(stats => this.teamStats.set(stats.id, stats));

    // Initialize analytics data
    this.initializeAnalyticsData();
  }

  private initializeAnalyticsData() {
    // Generate dynamic value bets from current predictions
    const topPredictions = Array.from(this.predictions.values())
      .filter(p => p.confidence >= 60)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);

    this.analyticsData.valueBets = topPredictions.map(prediction => {
      const match = this.matches.get(prediction.matchId!);
      const homeTeam = this.teams.get(match?.homeTeamId!);
      const awayTeam = this.teams.get(match?.awayTeamId!);
      const valueBet = prediction.valueBets?.[0];
      
      return {
        bet: valueBet?.bet || `${homeTeam?.name} vs ${awayTeam?.name}`,
        expected: valueBet?.expectedOdds || 1.85,
        market: valueBet?.marketOdds || 2.20,
        value: valueBet?.value || (prediction.confidence * 0.25),
        confidence: prediction.confidence,
        type: prediction.confidence >= 75 ? "high" : prediction.confidence >= 60 ? "medium" : "low"
      };
    });

    // Generate market movements
    this.analyticsData.marketMovements = [
      { bet: "Man City Win", change: 0.15, from: 2.05, to: 2.20, direction: "up" },
      { bet: "El Clasico Draw", change: -0.20, from: 3.60, to: 3.40, direction: "down" },
      { bet: "Bayern Over 2.5", change: 0.10, from: 1.75, to: 1.85, direction: "up" },
      { bet: "Arsenal BTTS", change: -0.15, from: 2.10, to: 1.95, direction: "down" }
    ];

    // Generate today's stats dynamically
    const totalMatches = this.matches.size;
    const totalPredictions = this.predictions.size;
    const highConfidencePredictions = Array.from(this.predictions.values()).filter(p => p.confidence >= 70).length;
    const avgConfidence = Math.round(
      Array.from(this.predictions.values()).reduce((sum, p) => sum + p.confidence, 0) / totalPredictions
    );

    this.analyticsData.todayStats = [
      { label: "Predictions Made", value: totalPredictions.toString(), testId: "stat-predictions" },
      { label: "Success Rate", value: "73%", testId: "stat-success-rate", color: "text-success" },
      { label: "High Confidence Bets", value: highConfidencePredictions.toString(), testId: "stat-value-bets", color: "text-secondary" },
      { label: "Avg Confidence", value: `${avgConfidence}%`, testId: "stat-avg-confidence" }
    ];

    // Performance data
    this.analyticsData.performance = [
      { period: "This Week", value: "+12.3%", progress: 75 },
      { period: "This Month", value: "+8.7%", progress: 60 },
      { period: "All Time", value: "+15.2%", progress: 85 }
    ];
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

  async getAnalyticsData() {
    return this.analyticsData;
  }
}

export const storage = new MemStorage();
