import { describe, expect, it } from "vitest";
import {
  backendHealthIssues,
  deriveBackendReadiness,
  isHealthyBackendStatus,
  liveMetricLabel,
} from "./health-status";

describe("health status normalization", () => {
  it.each(["ok", "ready", "healthy", "OK"])(
    "accepts %s as healthy",
    (status) => {
      expect(isHealthyBackendStatus(status)).toBe(true);
    },
  );

  it.each(["degraded", "unavailable", "unknown", null])(
    "rejects %s as healthy",
    (status) => {
      expect(isHealthyBackendStatus(status)).toBe(false);
    },
  );

  it("does not emit a contradictory issue for the live backend ok state", () => {
    expect(backendHealthIssues("ok")).toEqual([]);
    expect(backendHealthIssues("degraded")).toEqual([
      "Backend status: degraded",
    ]);
  });
});

describe("backend readiness aggregation", () => {
  it("reports all four required infrastructure checks as ready", () => {
    expect(
      deriveBackendReadiness({
        backendStatus: "ok",
        backendChecks: {
          database: { status: "ready" },
          migrations: { status: "ready" },
          cache: { status: "ready" },
          models: { status: "ready" },
        },
      }),
    ).toEqual({ total: 4, ready: 4, unavailable: 0, score: 1, label: "Ready" });
  });

  it("does not infer readiness from a healthy aggregate when checks are absent", () => {
    expect(deriveBackendReadiness({ backendStatus: "ok" })).toEqual({
      total: 4,
      ready: 0,
      unavailable: 4,
      score: 0,
      label: "Degraded",
    });
  });
});

describe("live metric display", () => {
  it("withholds artifact numbers until enough labelled predictions exist", () => {
    expect(liveMetricLabel(false, "51.0%")).toBe("Pending");
    expect(liveMetricLabel(true, "51.0%")).toBe("51.0%");
  });
});
