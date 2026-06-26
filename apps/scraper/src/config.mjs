import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const workspaceRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
export const rawDir = resolve(workspaceRoot, "data/raw/node-scraper");
export const processedDir = resolve(workspaceRoot, "data/processed/node-scraper");

export const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36"
];

export const sourceAllowlist = {
  footballData: {
    id: "football-data-csv",
    baseUrl: "https://www.football-data.co.uk",
    type: "csv",
    enabled: true
  },
  clubElo: {
    id: "clubelo-public",
    baseUrl: "http://api.clubelo.com",
    type: "csv",
    enabled: true
  }
};

export const defaultLeagues = {
  EPL: "E0",
  LA_LIGA: "SP1",
  SERIE_A: "I1",
  BUNDESLIGA: "D1",
  LIGUE_1: "F1"
};
