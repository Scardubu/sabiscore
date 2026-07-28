import { afterEach, describe, expect, it, vi } from "vitest";
import { getOffseasonStatus } from "./api";

const REAL_FIELD_NAMES = [
  "historical_data",
  "live_odds",
  "live_standings",
  "live_form",
  "pi_ratings",
  "berrar_ratings",
  "market_drift",
  "match_context",
] as const;

afterEach(() => {
  vi.unstubAllGlobals();
});

// The live backend (backend/src/api/endpoints/offseason.py `_data_availability()`)
// returns historical_data/live_odds/live_standings/live_form/pi_ratings/
// berrar_ratings/market_drift/match_context. The frontend type and both fallback
// literals previously used five unrelated field names (historical_results/
// elo_ratings/market_odds/form_stats/team_metadata) that never matched anything
// backend-side — silent, since no caller reads data_availability today.
describe("getOffseasonStatus data_availability fallback shape", () => {
  it("falls back to the real backend field names, all false, on a non-ok response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    const result = await getOffseasonStatus("EPL");

    expect(Object.keys(result.data_availability).sort()).toEqual([...REAL_FIELD_NAMES].sort());
    for (const field of REAL_FIELD_NAMES) {
      expect(result.data_availability[field]).toBe(false);
    }
  });

  it("falls back to the real backend field names, all false, on a network error", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getOffseasonStatus("EPL");

    expect(Object.keys(result.data_availability).sort()).toEqual([...REAL_FIELD_NAMES].sort());
    for (const field of REAL_FIELD_NAMES) {
      expect(result.data_availability[field]).toBe(false);
    }
  });
});
