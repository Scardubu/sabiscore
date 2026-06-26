#!/usr/bin/env node
import { access } from "node:fs/promises";
import { defaultLeagues, processedDir } from "./config.mjs";
import { PublicHttpClient } from "./http.mjs";
import { FootballDataAdapter } from "./adapters/football-data.mjs";
import { ensureStorage, readFixture, writeManifest } from "./storage.mjs";

const command = process.argv[2] ?? "validate";

async function scrape({ metricsOnly = false } = {}) {
  await ensureStorage();
  const client = new PublicHttpClient({
    minDelayMs: Number(process.env.SABISCORE_SCRAPER_DELAY_MS ?? 2500),
    respectRobots: process.env.SABISCORE_SCRAPER_RESPECT_ROBOTS !== "false"
  });
  const adapter = new FootballDataAdapter(client);
  const seasonCode = process.env.SABISCORE_SEASON_CODE ?? "2425";
  const fixturePath = process.env.SABISCORE_SCRAPER_FIXTURE;
  const fixtureText = fixturePath ? await readFixture(fixturePath) : null;

  const selected = (process.env.SABISCORE_LEAGUES ?? Object.keys(defaultLeagues).join(","))
    .split(",")
    .map((league) => league.trim())
    .filter(Boolean);

  const results = [];
  for (const league of selected) {
    const leagueCode = defaultLeagues[league];
    if (!leagueCode) {
      results.push({ league, skipped: true, reason: "unsupported_league" });
      continue;
    }
    if (metricsOnly) {
      results.push({ league, skipped: true, reason: "metrics_adapter_pending", zero_paid_api: true });
      continue;
    }
    results.push(await adapter.scrapeLeague({ league, leagueCode, seasonCode, fixtureText }));
  }

  const manifestFile = await writeManifest({
    command,
    sources: results,
    output_dir: processedDir
  });
  console.log(JSON.stringify({ ok: true, manifest: manifestFile, results }, null, 2));
}

async function validate() {
  await ensureStorage();
  await access(processedDir);
  const manifestFile = await writeManifest({
    command: "validate",
    sources: [],
    output_dir: processedDir,
    validation: {
      storage_ready: true,
      paid_api_dependencies: false,
      public_source_allowlist: true
    }
  });
  console.log(JSON.stringify({ ok: true, manifest: manifestFile }, null, 2));
}

if (command === "scrape" || command === "scrape:fixtures") {
  await scrape();
} else if (command === "scrape:metrics") {
  await scrape({ metricsOnly: true });
} else if (command === "validate") {
  await validate();
} else {
  console.error(`Unknown command: ${command}`);
  process.exitCode = 1;
}
