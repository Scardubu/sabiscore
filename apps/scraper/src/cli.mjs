#!/usr/bin/env node
import { access } from "node:fs/promises";
import { defaultLeagues, manifestDir, processedDir, rawDir } from "./config.mjs";
import { PublicHttpClient } from "./http.mjs";
import { FootballDataAdapter } from "./adapters/football-data.mjs";
import { ensureStorage, readFixture, writeManifest } from "./storage.mjs";

const command = process.argv[2] ?? "validate";

function summarizeResults(results) {
  const rawFiles = [];
  const processedFiles = [];
  const payloadHashes = {};
  let recordCount = 0;
  const errors = [];

  for (const result of results) {
    if (result.artifacts?.raw) rawFiles.push(result.artifacts.raw);
    if (result.artifacts?.fixtures) processedFiles.push(result.artifacts.fixtures);
    if (result.artifacts?.team_form) processedFiles.push(result.artifacts.team_form);
    Object.assign(payloadHashes, result.payload_hashes ?? {});
    recordCount += Number(result.fixtures ?? result.rows ?? 0);
    if (result.skipped) errors.push({ league: result.league, reason: result.reason });
  }

  return { rawFiles, processedFiles, payloadHashes, recordCount, errors };
}

async function scrape({ adapterKind = "fixtures" } = {}) {
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
    if (adapterKind !== "fixtures") {
      results.push({ league, skipped: true, reason: `${adapterKind}_adapter_disabled`, zero_paid_api: true });
      continue;
    }
    results.push(await adapter.scrapeLeague({ league, leagueCode, seasonCode, fixtureText }));
  }

  const summary = summarizeResults(results);
  const manifestFile = await writeManifest({
    source_id: "football-data-csv",
    adapter_version: "1.0.0",
    schema_version: "1.0.0",
    status: summary.errors.length ? "PARTIAL" : "SUCCESS",
    command,
    sources: results,
    output_dir: processedDir,
    raw_files: summary.rawFiles,
    processed_files: summary.processedFiles,
    payload_hashes: summary.payloadHashes,
    record_count: summary.recordCount,
    errors: summary.errors,
    attribution: "football-data.co.uk",
    licence: {
      source_policy: "public CSV; operator must review current terms before live use"
    },
    source_policy: adapter.source
  });
  console.log(JSON.stringify({ ok: true, manifest: manifestFile, results }, null, 2));
}

async function validate() {
  await ensureStorage();
  await access(processedDir);
  const manifestFile = await writeManifest({
    source_id: "node-scraper",
    status: "SUCCESS",
    command: "validate",
    sources: [],
    output_dir: processedDir,
    validation: {
      storage_ready: true,
      paid_api_dependencies: false,
      public_source_allowlist: true,
      raw_dir: rawDir,
      processed_dir: processedDir,
      manifest_dir: manifestDir
    }
  });
  console.log(JSON.stringify({ ok: true, manifest: manifestFile }, null, 2));
}

async function doctor() {
  await ensureStorage();
  const payload = {
    ok: true,
    zero_paid_api: true,
    dynamic_scrapers_enabled: process.env.ENABLE_DYNAMIC_SCRAPERS === "true",
    user_agent_rotation: false,
    storage: { rawDir, processedDir, manifestDir },
  };
  const manifestFile = await writeManifest({
    source_id: "node-scraper",
    status: "SUCCESS",
    command: "doctor",
    record_count: 0,
    validation: payload,
  });
  console.log(JSON.stringify({ ...payload, manifest: manifestFile }, null, 2));
}

if (command === "scrape" || command === "scrape:fixtures") {
  await scrape({ adapterKind: "fixtures" });
} else if (command === "scrape:metrics") {
  await scrape({ adapterKind: "metrics" });
} else if (command === "scrape:results") {
  await scrape({ adapterKind: "results" });
} else if (command === "scrape:availability") {
  await scrape({ adapterKind: "availability" });
} else if (command === "scrape:markets") {
  await scrape({ adapterKind: "markets" });
} else if (command === "validate") {
  await validate();
} else if (command === "doctor") {
  await doctor();
} else {
  console.error(`Unknown command: ${command}`);
  process.exitCode = 1;
}
