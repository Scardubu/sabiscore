import { describe, expect, it } from "vitest";
import type { UpcomingMatch } from "@/lib/api";
import { excludeSelectedTeam } from "./match-selector";
import {
  buildMatchInsightsHref,
  getTopEdgeFixtureId,
  selectorLeagueId,
  type SelectedFixture,
} from "@/lib/match-selection";

describe("excludeSelectedTeam", () => {
  const teams = ["Arsenal", "Aston Villa", "Brighton"];

  it("removes the selected team from the option list", () => {
    expect(excludeSelectedTeam(teams, "Arsenal")).toEqual(["Aston Villa", "Brighton"]);
  });

  it("is case- and whitespace-insensitive", () => {
    expect(excludeSelectedTeam(teams, "  arsenal  ")).toEqual(["Aston Villa", "Brighton"]);
  });

  it("returns the full list when no valid selection exists", () => {
    expect(excludeSelectedTeam(teams, "")).toEqual(teams);
    expect(excludeSelectedTeam(teams, "Chelsea")).toEqual(teams);
  });
});


describe("selector league normalization", () => {
  it("maps canonical API vocabulary to the selector vocabulary", () => {
    expect(selectorLeagueId("LA_LIGA")).toBe("La Liga");
    expect(selectorLeagueId("SERIE_A")).toBe("Serie A");
    expect(selectorLeagueId("LIGUE_1")).toBe("Ligue 1");
  });

  it("fails closed for an unsupported competition", () => {
    expect(selectorLeagueId("SCOTTISH_PREMIERSHIP")).toBeNull();
  });
});

describe("canonical fixture navigation", () => {
  const selectedFixture: SelectedFixture = {
    matchId: "fixture-123",
    homeTeam: "Arsenal",
    awayTeam: "Bournemouth",
    league: "EPL",
  };

  it("preserves the real fixture id when the selection is unchanged", () => {
    expect(
      buildMatchInsightsHref({
        selectedFixture,
        homeTeam: "Arsenal",
        awayTeam: "Bournemouth",
        league: "EPL",
      }),
    ).toBe("/match/fixture-123?league=EPL&home=Arsenal&away=Bournemouth");
  });

  // The id is opaque: the Phase-7 insights call takes a matchup string with no
  // id variant, and the hero card parses team names off the route segment.
  // Without these params both fall back to rendering the raw id.
  it("carries team names alongside the canonical id", () => {
    const href = buildMatchInsightsHref({
      selectedFixture,
      homeTeam: "Arsenal",
      awayTeam: "Bournemouth",
      league: "EPL",
    });
    const params = new URL(href, "https://example.test").searchParams;
    expect(params.get("home")).toBe("Arsenal");
    expect(params.get("away")).toBe("Bournemouth");
  });

  it("falls back to the explicit matchup path after a manual edit", () => {
    expect(
      buildMatchInsightsHref({
        selectedFixture,
        homeTeam: "Arsenal",
        awayTeam: "Chelsea",
        league: "EPL",
      }),
    ).toBe("/match/Arsenal%20vs%20Chelsea?league=EPL");
  });
});

describe("top-edge labelling", () => {
  const base = {
    home_team: "A",
    away_team: "B",
    league: "EPL",
    match_date: "2026-08-08T12:00:00Z",
    venue: null,
    status: "scheduled",
    value_bets: [],
    has_value: false,
    best_value_bet: null,
    data_gaps: [],
    staleness_seconds: 0,
    source: "test",
    clv_pct: null,
  } satisfies Omit<UpcomingMatch, "match_id" | "predictions" | "edge_quality_score">;

  it("does not fabricate a top edge from null or zero scores", () => {
    const fixtures: UpcomingMatch[] = [
      { ...base, match_id: "a", predictions: null, edge_quality_score: null },
      { ...base, match_id: "b", predictions: null, edge_quality_score: 0 },
    ];
    expect(getTopEdgeFixtureId(fixtures)).toBeNull();
  });

  it("selects the highest positive scored fixture with a prediction", () => {
    const prediction = {
      home_win: 0.5,
      draw: 0.25,
      away_win: 0.25,
      confidence: 0.5,
      model_version: "test",
    };
    const fixtures: UpcomingMatch[] = [
      { ...base, match_id: "a", predictions: prediction, edge_quality_score: 0.2 },
      { ...base, match_id: "b", predictions: prediction, edge_quality_score: 0.6 },
    ];
    expect(getTopEdgeFixtureId(fixtures)).toBe("b");
  });
});
