import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get all leagues
  app.get("/api/leagues", async (req, res) => {
    try {
      const leagues = await storage.getLeagues();
      res.json(leagues);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch leagues" });
    }
  });

  // Get upcoming matches
  app.get("/api/matches/upcoming", async (req, res) => {
    try {
      const leagueId = req.query.leagueId as string;
      const matches = await storage.getUpcomingMatches(leagueId);
      
      // Enrich with predictions
      const matchesWithPredictions = await Promise.all(
        matches.map(async (match) => {
          const prediction = await storage.getPredictionByMatch(match.id);
          return { ...match, prediction };
        })
      );
      
      res.json(matchesWithPredictions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch matches" });
    }
  });

  // Get team stats
  app.get("/api/teams/:teamId/stats", async (req, res) => {
    try {
      const { teamId } = req.params;
      const stats = await storage.getTeamStats(teamId);
      
      if (!stats) {
        return res.status(404).json({ message: "Team stats not found" });
      }
      
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch team stats" });
    }
  });

  // Get detailed match analysis
  app.get("/api/matches/:matchId/analysis", async (req, res) => {
    try {
      const { matchId } = req.params;
      const match = await storage.getMatch(matchId);
      
      if (!match) {
        return res.status(404).json({ message: "Match not found" });
      }

      const homeTeam = await storage.getTeam(match.homeTeamId!);
      const awayTeam = await storage.getTeam(match.awayTeamId!);
      const homeStats = await storage.getTeamStats(match.homeTeamId!);
      const awayStats = await storage.getTeamStats(match.awayTeamId!);
      const prediction = await storage.getPredictionByMatch(matchId);

      res.json({
        match,
        homeTeam,
        awayTeam,
        homeStats,
        awayStats,
        prediction,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch match analysis" });
    }
  });

  // Get analytics dashboard data
  app.get("/api/analytics", async (req, res) => {
    try {
      const analyticsData = await storage.getAnalyticsData();
      res.json(analyticsData);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch analytics data" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
