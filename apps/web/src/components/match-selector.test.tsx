import { describe, expect, it } from "vitest";
import { excludeSelectedTeam } from "./match-selector";

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
