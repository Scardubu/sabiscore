import type { UpcomingMatch } from "@/lib/api";
import { canonicalLeagueId, type CanonicalLeague } from "@/lib/league";
import type { LeagueId } from "@/lib/team-data";

const SELECTOR_LEAGUE_BY_CANONICAL: Record<CanonicalLeague, LeagueId> = {
  EPL: "EPL",
  LA_LIGA: "La Liga",
  BUNDESLIGA: "Bundesliga",
  SERIE_A: "Serie A",
  LIGUE_1: "Ligue 1",
  EREDIVISIE: "Eredivisie",
  UCL: "UCL",
};

export interface SelectedFixture {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  league: LeagueId;
}

export function selectorLeagueId(input: string): LeagueId | null {
  const canonical = canonicalLeagueId(input);
  return canonical ? SELECTOR_LEAGUE_BY_CANONICAL[canonical] : null;
}

export function getTopEdgeFixtureId(fixtures: readonly UpcomingMatch[]): string | null {
  const eligible = fixtures
    .filter(
      (match) =>
        typeof match.edge_quality_score === "number" &&
        Number.isFinite(match.edge_quality_score) &&
        match.edge_quality_score > 0 &&
        match.predictions !== null,
    )
    .sort((a, b) => (b.edge_quality_score ?? 0) - (a.edge_quality_score ?? 0));

  return eligible[0]?.match_id ?? null;
}

export function buildMatchInsightsHref({
  selectedFixture,
  homeTeam,
  awayTeam,
  league,
}: {
  selectedFixture: SelectedFixture | null;
  homeTeam: string;
  awayTeam: string;
  league: LeagueId;
}): string {
  const normalizedHome = homeTeam.trim();
  const normalizedAway = awayTeam.trim();
  const leagueParam = canonicalLeagueId(league) ?? "EPL";
  const selectedStillMatches =
    selectedFixture !== null &&
    selectedFixture.homeTeam.trim().toLowerCase() === normalizedHome.toLowerCase() &&
    selectedFixture.awayTeam.trim().toLowerCase() === normalizedAway.toLowerCase() &&
    canonicalLeagueId(selectedFixture.league) === leagueParam;

  const identity = selectedStillMatches
    ? selectedFixture.matchId
    : `${normalizedHome} vs ${normalizedAway}`;

  return `/match/${encodeURIComponent(identity)}?league=${leagueParam}`;
}
