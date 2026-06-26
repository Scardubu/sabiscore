import { sourceAllowlist } from "../config.mjs";
import { parseCsv, normalizeFootballDataRows, buildTeamForm } from "../parsers.mjs";
import { writeJson, writeRaw } from "../storage.mjs";

export class FootballDataAdapter {
  constructor(client) {
    this.client = client;
    this.source = sourceAllowlist.footballData;
  }

  buildUrl(seasonCode, leagueCode) {
    return `${this.source.baseUrl}/mmz4281/${seasonCode}/${leagueCode}.csv`;
  }

  async scrapeLeague({ league, leagueCode, seasonCode = "2425", fixtureText = null }) {
    const url = this.buildUrl(seasonCode, leagueCode);
    const raw = fixtureText ?? await this.client.getText(url);
    await writeRaw(`football-data-${league}-${seasonCode}.csv`, raw);

    const rows = parseCsv(raw);
    const fixtures = normalizeFootballDataRows(rows, league);
    const teamForm = buildTeamForm(fixtures);

    const fixturesFile = await writeJson("fixtures", `${league}-${seasonCode}`, fixtures);
    const formFile = await writeJson("team-form", `${league}-${seasonCode}`, teamForm);
    return {
      source_id: this.source.id,
      url,
      league,
      season_code: seasonCode,
      rows: rows.length,
      fixtures: fixtures.length,
      artifacts: { fixtures: fixturesFile, team_form: formFile }
    };
  }
}
