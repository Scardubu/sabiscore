import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const workspaceRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
export const rawDir = resolve(workspaceRoot, "data/raw/node-scraper");
export const processedDir = resolve(workspaceRoot, "data/processed/node-scraper");
export const manifestDir = resolve(workspaceRoot, "data/manifests/node-scraper");

export const scraperUserAgent =
  process.env.SCRAPER_USER_AGENT ??
  "SabiScoreDataResearch/1.0 (+https://sabiscore.local; contact: data@sabiscore.local)";

export const sourceAllowlist = {
  footballData: {
    id: "football-data-csv",
    baseUrl: "https://www.football-data.co.uk",
    type: "csv",
    enabled: true,
    transport: "static",
    allowedDomains: ["www.football-data.co.uk"],
    allowedUrlPatterns: ["/mmz4281/"],
    termsReviewStatus: "reviewed_public_csv",
    robotsPolicy: "check_before_fetch",
    permittedFrequency: "daily",
    concurrency: 1,
    timeoutMs: 20000,
    collectedFields: ["fixtures", "results", "closing_1x2_odds", "team_form"],
    parserVersion: "1.0.0",
    schemaVersion: "1.0.0",
    enabledEnvironments: ["development", "staging"],
    owner: "data-engineering",
    killSwitchEnv: "DISABLE_FOOTBALL_DATA_CSV",
    attribution: "football-data.co.uk"
  },
  clubElo: {
    id: "clubelo-public",
    baseUrl: "http://api.clubelo.com",
    type: "csv",
    enabled: false,
    transport: "static",
    allowedDomains: ["api.clubelo.com"],
    allowedUrlPatterns: ["/"],
    termsReviewStatus: "disabled_pending_review",
    robotsPolicy: "disabled_until_reviewed",
    permittedFrequency: "manual",
    concurrency: 1,
    timeoutMs: 20000,
    collectedFields: ["elo_ratings"],
    parserVersion: "1.0.0",
    schemaVersion: "1.0.0",
    enabledEnvironments: [],
    owner: "data-engineering",
    killSwitchEnv: "DISABLE_CLUBELO_PUBLIC",
    attribution: "clubelo.com"
  }
};

export const defaultLeagues = {
  EPL: "E0",
  LA_LIGA: "SP1",
  SERIE_A: "I1",
  BUNDESLIGA: "D1",
  LIGUE_1: "F1"
};
