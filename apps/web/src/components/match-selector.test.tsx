import { describe, expect, it } from "vitest";
import {
  excludeSelectedTeam,
  resolveCarouselMatchId,
  resolveTopEdgeId,
} from "./match-selector";
import type { LeagueId } from "../lib/team-data";

// Both Home and Away TeamAutocomplete fields used to receive the identical,
// unfiltered team list, so a team already picked on one side still appeared
// as a selectable suggestion on the other — only rejected after submit via
// a toast. This pins that the dropdown itself excludes it up front.
describe("excludeSelectedTeam", () => {
  const teams = ["Arsenal", "Aston Villa", "Brighton"];

  it("removes the selected team from the option list", () => {
    expect(excludeSelectedTeam(teams, "Arsenal")).toEqual(["Aston Villa", "Brighton"]);
  });

  it("is case- and whitespace-insensitive, matching the submit-time guard", () => {
    expect(excludeSelectedTeam(teams, "  arsenal  ")).toEqual(["Aston Villa", "Brighton"]);
  });

  it("returns the full list unchanged when nothing is selected yet", () => {
    expect(excludeSelectedTeam(teams, "")).toEqual(teams);
  });

  it("returns the full list unchanged when the selection isn't in this league", () => {
    expect(excludeSelectedTeam(teams, "Chelsea")).toEqual(teams);
  });
});

// A carousel click only pre-fills the manual-entry form — the user can still
// edit the fields before submitting. resolveCarouselMatchId decides whether
// it's still safe to route by the carousel's real match_id, or whether the
// submission must fall back to the unverified "Home vs Away" string route.
describe("resolveCarouselMatchId", () => {
  const fixture = { matchId: "482", home: "Arsenal", away: "Chelsea", league: "EPL" as LeagueId };

  it("returns the stored match_id when home/away/league all still match", () => {
    expect(resolveCarouselMatchId(fixture, "Arsenal", "Chelsea", "EPL")).toBe("482");
  });

  it("is case- and whitespace-insensitive on team names", () => {
    expect(resolveCarouselMatchId(fixture, "  arsenal  ", "CHELSEA", "EPL")).toBe("482");
  });

  it("returns null when the home team was edited after picking from the carousel", () => {
    expect(resolveCarouselMatchId(fixture, "Aston Villa", "Chelsea", "EPL")).toBeNull();
  });

  it("returns null when the league changed after picking from the carousel", () => {
    expect(resolveCarouselMatchId(fixture, "Arsenal", "Chelsea", "La Liga" as LeagueId)).toBeNull();
  });

  it("returns null when no carousel selection was made (manual entry)", () => {
    expect(resolveCarouselMatchId(null, "Arsenal", "Chelsea", "EPL")).toBeNull();
  });
});

// Every live fixture currently scores edge_quality_score: null (no publishable
// prediction), so the carousel's sort is a no-op and the first fixture was being
// badged "🔥 Top Edge Today" purely for being first in the list.
describe("resolveTopEdgeId", () => {
  it("returns undefined when no fixture has a measured edge score", () => {
    expect(
      resolveTopEdgeId([
        { match_id: "fd-1", edge_quality_score: null },
        { match_id: "fd-2", edge_quality_score: null },
      ]),
    ).toBeUndefined();
  });

  it("returns the leader's id when it has a measured edge score", () => {
    expect(
      resolveTopEdgeId([
        { match_id: "fd-1", edge_quality_score: 0.62 },
        { match_id: "fd-2", edge_quality_score: 0.41 },
      ]),
    ).toBe("fd-1");
  });

  it("treats a genuine zero score as measured, not missing", () => {
    expect(resolveTopEdgeId([{ match_id: "fd-1", edge_quality_score: 0 }])).toBe("fd-1");
  });

  it("returns undefined for an empty fixture list", () => {
    expect(resolveTopEdgeId([])).toBeUndefined();
  });
});
