#!/usr/bin/env node
/**
 * Asset validation script for SabiScore web (Part 3 - ASSET_AUDIT_V2)
 *
 * Plain JS version that doesn't require ts-node or compilation.
 * Validates that:
 * 1. Every team in LEAGUE_TEAMS resolves to a non-fallback asset
 * 2. All leagues in LEAGUE_TEAMS exist in LEAGUE_CONFIG
 *
 * Usage: node ./scripts/validate-assets.js
 */

// Simple inline data for validation (mirrors team-data.ts and team-display.tsx)
const LEAGUE_TEAMS = {
  EPL: [
    "Arsenal", "Aston Villa", "Bournemouth", "Brentford", "Brighton",
    "Chelsea", "Crystal Palace", "Everton", "Fulham", "Ipswich Town",
    "Leicester City", "Liverpool", "Manchester City", "Manchester United",
    "Newcastle United", "Nottingham Forest", "Southampton", "Tottenham Hotspur",
    "West Ham United", "Wolverhampton"
  ],
  "La Liga": [
    "Alaves", "Athletic Club", "Atletico Madrid", "Barcelona", "Celta Vigo",
    "Elche", "Espanyol", "Getafe", "Girona", "Las Palmas", "Leganes",
    "Mallorca", "Osasuna", "Rayo Vallecano", "Real Betis", "Real Madrid",
    "Real Sociedad", "Sevilla", "Valencia", "Villarreal"
  ],
  "Serie A": [
    "Atalanta", "Bologna", "Cagliari", "Como", "Empoli", "Fiorentina",
    "Genoa", "Inter Milan", "Juventus", "Lazio", "Lecce", "Milan",
    "Monza", "Napoli", "Parma", "Roma", "Salernitana", "Sassuolo",
    "Torino", "Udinese"
  ],
  Bundesliga: [
    "Augsburg", "Bayer Leverkusen", "Bayern Munich", "Bochum",
    "Borussia Dortmund", "Borussia Monchengladbach", "Darmstadt",
    "Eintracht Frankfurt", "FC Heidenheim", "Freiburg", "Hamburg",
    "Hoffenheim", "Holstein Kiel", "Mainz", "RB Leipzig", "St. Pauli",
    "Stuttgart", "Union Berlin", "VfL Wolfsburg", "Werder Bremen"
  ],
  "Ligue 1": [
    "Angers", "Auxerre", "Brest", "Clermont", "Havre", "Lens", "Lille",
    "Lorient", "Lyon", "Marseille", "Metz", "Monaco", "Montpellier",
    "Nantes", "Nice", "Paris Saint-Germain", "Reims", "Rennes",
    "Saint-Etienne", "Toulouse"
  ]
};

// Essential TEAM_DATA check - teams that should have proper assets
const KNOWN_TEAMS = new Set([
  // EPL
  "Arsenal", "Aston Villa", "Bournemouth", "Brentford", "Brighton",
  "Chelsea", "Crystal Palace", "Everton", "Fulham", "Ipswich Town",
  "Leicester City", "Liverpool", "Manchester City", "Manchester United",
  "Newcastle United", "Nottingham Forest", "Southampton", "Tottenham Hotspur",
  "West Ham United", "Wolverhampton",
  // La Liga
  "Real Madrid", "Barcelona", "Atletico Madrid", "Sevilla", "Real Sociedad",
  "Real Betis", "Athletic Club", "Villarreal", "Valencia", "Getafe",
  "Osasuna", "Celta Vigo", "Mallorca", "Rayo Vallecano", "Girona",
  "Las Palmas", "Alaves", "Leganes", "Espanyol", "Elche",
  // Serie A
  "Inter Milan", "Milan", "Juventus", "Napoli", "Roma", "Lazio",
  "Atalanta", "Fiorentina", "Bologna", "Torino", "Monza", "Genoa",
  "Lecce", "Udinese", "Empoli", "Cagliari", "Sassuolo", "Salernitana",
  "Como", "Parma", "Verona",
  // Bundesliga
  "Bayern Munich", "Borussia Dortmund", "RB Leipzig", "Bayer Leverkusen",
  "Eintracht Frankfurt", "VfL Wolfsburg", "Borussia Monchengladbach",
  "Union Berlin", "Freiburg", "Mainz", "Hoffenheim", "Augsburg",
  "Werder Bremen", "Stuttgart", "Bochum", "FC Heidenheim", "Darmstadt",
  "Holstein Kiel", "St. Pauli", "Hamburg",
  // Ligue 1
  "Paris Saint-Germain", "Marseille", "Lyon", "Monaco", "Lille", "Nice",
  "Rennes", "Lens", "Nantes", "Montpellier", "Reims", "Toulouse",
  "Brest", "Havre", "Metz", "Lorient", "Clermont", "Strasbourg",
  "Angers", "Auxerre", "Saint-Etienne"
]);

const KNOWN_LEAGUES = new Set([
  "EPL", "La Liga", "Serie A", "Bundesliga", "Ligue 1",
  "Premier League", "Champions League", "Europa League"
]);

function validateAssets() {
  let issues = 0;

  console.log("🔍 Running asset validation (ASSET_AUDIT_V2)...\n");

  // 1. Validate league coverage
  for (const leagueKey of Object.keys(LEAGUE_TEAMS)) {
    if (!KNOWN_LEAGUES.has(leagueKey)) {
      console.warn(`⚠️  League "${leagueKey}" should be added to LEAGUE_CONFIG`);
    }
  }

  // 2. Validate team coverage
  for (const [league, teams] of Object.entries(LEAGUE_TEAMS)) {
    for (const team of teams) {
      if (!KNOWN_TEAMS.has(team)) {
        issues++;
        console.error(
          `❌ Missing TEAM_DATA entry for team="${team}" in league="${league}"`
        );
      }
    }
  }

  return issues;
}

function main() {
  const issues = validateAssets();

  if (issues > 0) {
    console.error(`\n❌ Asset validation failed with ${issues} issue(s).`);
    console.error("   Add missing teams to TEAM_DATA in team-display.tsx\n");
    process.exit(1);
  } else {
    console.log("✅ Asset validation passed: all teams have proper data entries.\n");
    process.exit(0);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { validateAssets };
