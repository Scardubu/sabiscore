export function parseCsv(text) {
  const rows = [];
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return rows;
  const headers = splitCsvLine(lines[0]);
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cells = splitCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

function splitCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

export function normalizeFootballDataRows(rows, league) {
  return rows
    .filter((row) => row.Date && row.HomeTeam && row.AwayTeam)
    .map((row) => ({
      source: "football-data-csv",
      league,
      match_date: row.Date,
      home_team: row.HomeTeam,
      away_team: row.AwayTeam,
      home_goals: numberOrNull(row.FTHG),
      away_goals: numberOrNull(row.FTAG),
      full_time_result: row.FTR || null,
      market: {
        home_odds: numberOrNull(row.B365H ?? row.PSH),
        draw_odds: numberOrNull(row.B365D ?? row.PSD),
        away_odds: numberOrNull(row.B365A ?? row.PSA)
      }
    }));
}

export function buildTeamForm(fixtures, windowSize = 10) {
  const teams = new Map();
  for (const match of fixtures) {
    addTeamMatch(teams, match.home_team, {
      date: match.match_date,
      opponent: match.away_team,
      home_or_away: "home",
      goals_for: match.home_goals,
      goals_against: match.away_goals,
      result: resultFor(match.home_goals, match.away_goals)
    });
    addTeamMatch(teams, match.away_team, {
      date: match.match_date,
      opponent: match.home_team,
      home_or_away: "away",
      goals_for: match.away_goals,
      goals_against: match.home_goals,
      result: resultFor(match.away_goals, match.home_goals)
    });
  }

  return [...teams.entries()].map(([team, matches]) => {
    const recent = matches.slice(-windowSize);
    const points = recent.reduce((sum, match) => sum + pointsFor(match.result), 0);
    const goalsFor = recent.reduce((sum, match) => sum + (match.goals_for ?? 0), 0);
    const goalsAgainst = recent.reduce((sum, match) => sum + (match.goals_against ?? 0), 0);
    return {
      team,
      matches_sampled: recent.length,
      ppg: recent.length ? points / recent.length : null,
      goals_for_avg: recent.length ? goalsFor / recent.length : null,
      goals_against_avg: recent.length ? goalsAgainst / recent.length : null,
      recent
    };
  });
}

function addTeamMatch(teams, team, match) {
  if (!teams.has(team)) teams.set(team, []);
  teams.get(team).push(match);
}

function resultFor(goalsFor, goalsAgainst) {
  if (goalsFor === null || goalsAgainst === null) return null;
  if (goalsFor > goalsAgainst) return "W";
  if (goalsFor < goalsAgainst) return "L";
  return "D";
}

function pointsFor(result) {
  if (result === "W") return 3;
  if (result === "D") return 1;
  return 0;
}

function numberOrNull(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}
