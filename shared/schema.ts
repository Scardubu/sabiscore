import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const leagues = pgTable("leagues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  country: text("country").notNull(),
  flag: text("flag").notNull(),
});

export const teams = pgTable("teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  leagueId: varchar("league_id").references(() => leagues.id),
  logo: text("logo").notNull(),
});

export const matches = pgTable("matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  homeTeamId: varchar("home_team_id").references(() => teams.id),
  awayTeamId: varchar("away_team_id").references(() => teams.id),
  leagueId: varchar("league_id").references(() => leagues.id),
  matchDate: timestamp("match_date").notNull(),
  status: text("status").notNull().default("upcoming"), // upcoming, live, finished
});

export const predictions = pgTable("predictions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  matchId: varchar("match_id").references(() => matches.id),
  prediction: text("prediction").notNull(), // home_win, away_win, draw
  confidence: integer("confidence").notNull(), // 0-100
  expectedGoalsHome: decimal("expected_goals_home", { precision: 3, scale: 1 }),
  expectedGoalsAway: decimal("expected_goals_away", { precision: 3, scale: 1 }),
  valueBets: json("value_bets"),
  insights: json("insights"),
});

export const teamStats = pgTable("team_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id").references(() => teams.id),
  goalsPerGame: decimal("goals_per_game", { precision: 3, scale: 1 }),
  expectedGoals: decimal("expected_goals", { precision: 3, scale: 1 }),
  possessionPercent: integer("possession_percent"),
  shotsOnTarget: decimal("shots_on_target", { precision: 3, scale: 1 }),
  recentForm: text("recent_form"), // e.g., "WWDWW"
});

export const insertLeagueSchema = createInsertSchema(leagues).omit({ id: true });
export const insertTeamSchema = createInsertSchema(teams).omit({ id: true });
export const insertMatchSchema = createInsertSchema(matches).omit({ id: true });
export const insertPredictionSchema = createInsertSchema(predictions).omit({ id: true });
export const insertTeamStatsSchema = createInsertSchema(teamStats).omit({ id: true });

export type League = typeof leagues.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type Prediction = typeof predictions.$inferSelect;
export type TeamStats = typeof teamStats.$inferSelect;

export type InsertLeague = z.infer<typeof insertLeagueSchema>;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type InsertPrediction = z.infer<typeof insertPredictionSchema>;
export type InsertTeamStats = z.infer<typeof insertTeamStatsSchema>;
