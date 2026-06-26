import test from "node:test";
import assert from "node:assert/strict";
import { buildTeamForm, normalizeFootballDataRows, parseCsv } from "../src/parsers.mjs";
import { parseRobotsAllow } from "../src/safety.mjs";

test("parses football-data CSV and normalizes fixtures", () => {
  const csv = [
    "Date,HomeTeam,AwayTeam,FTHG,FTAG,FTR,B365H,B365D,B365A",
    "16/08/2024,Man United,Fulham,1,0,H,1.65,4.20,5.50",
    "17/08/2024,Arsenal,Wolves,2,0,H,1.30,5.80,10.00"
  ].join("\n");

  const rows = parseCsv(csv);
  const fixtures = normalizeFootballDataRows(rows, "EPL");
  assert.equal(fixtures.length, 2);
  assert.equal(fixtures[0].home_team, "Man United");
  assert.equal(fixtures[0].market.home_odds, 1.65);
});

test("builds rolling team form from normalized fixtures", () => {
  const fixtures = [
    { match_date: "2024-08-16", home_team: "A", away_team: "B", home_goals: 2, away_goals: 1 },
    { match_date: "2024-08-23", home_team: "C", away_team: "A", home_goals: 1, away_goals: 1 }
  ];
  const form = buildTeamForm(fixtures);
  const teamA = form.find((entry) => entry.team === "A");
  assert.equal(teamA.matches_sampled, 2);
  assert.equal(teamA.ppg, 2);
});

test("robots parser honors longest allow/disallow rule", () => {
  const robots = [
    "User-agent: *",
    "Disallow: /private",
    "Allow: /private/public"
  ].join("\n");
  assert.equal(parseRobotsAllow(robots, "/private/report"), false);
  assert.equal(parseRobotsAllow(robots, "/private/public/table"), true);
});
