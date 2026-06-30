import { describe, expect, it } from "vitest";
import {
  getVerdictPresentation,
  VERDICT_PRESENTATION,
  VERDICT_SEQUENCE,
} from "./verdict-presentation";

describe("production verdict presentation", () => {
  it("preserves the six-level contract order", () => {
    expect(VERDICT_SEQUENCE).toEqual([
      "PARTIAL",
      "NO_BET",
      "HOLD",
      "SPECULATIVE",
      "ACTIONABLE",
      "HIGH_CONVICTION",
    ]);
  });

  it("defines one user-facing presentation for every verdict", () => {
    expect(Object.keys(VERDICT_PRESENTATION).sort()).toEqual([...VERDICT_SEQUENCE].sort());
    for (const verdict of VERDICT_SEQUENCE) {
      expect(VERDICT_PRESENTATION[verdict].label.length).toBeGreaterThan(0);
      expect(VERDICT_PRESENTATION[verdict].summary.length).toBeGreaterThan(0);
    }
  });

  it("fails closed for unknown values", () => {
    expect(getVerdictPresentation("UNKNOWN")).toBe(VERDICT_PRESENTATION.PARTIAL);
    expect(getVerdictPresentation(null)).toBe(VERDICT_PRESENTATION.PARTIAL);
  });
});
