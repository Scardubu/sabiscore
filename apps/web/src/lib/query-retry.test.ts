import { describe, it, expect } from "vitest";
import { isBackendUnavailable, shouldRetryQuery, queryRetryDelay } from "./query-retry";

describe("query-retry policy", () => {
  it("never retries permanent 4xx client errors", () => {
    expect(shouldRetryQuery(0, { status: 400, code: "BACKEND_ERROR" })).toBe(false);
    expect(shouldRetryQuery(0, { status: 404 })).toBe(false);
    expect(shouldRetryQuery(0, { status: 422 })).toBe(false);
  });

  it("retries cold-start / 5xx / network up to 3 times then stops", () => {
    const coldStart = { status: 503, code: "COLD_START" };
    expect(shouldRetryQuery(0, coldStart)).toBe(true);
    expect(shouldRetryQuery(2, coldStart)).toBe(true);
    expect(shouldRetryQuery(3, coldStart)).toBe(false);
  });

  it("treats 408 timeout as a retryable cold-start stall", () => {
    expect(shouldRetryQuery(0, { status: 408, code: "TIMEOUT" })).toBe(true);
  });

  it("flags backend-unavailable errors for calm outage UI", () => {
    expect(isBackendUnavailable({ status: 503 })).toBe(true);
    expect(isBackendUnavailable({ code: "NETWORK_ERROR" })).toBe(true);
    expect(isBackendUnavailable({ status: 0 })).toBe(true);
    expect(isBackendUnavailable({ status: 404 })).toBe(false);
    expect(isBackendUnavailable(new Error("boom"))).toBe(false);
  });

  it("uses capped exponential backoff (2s, 4s, 8s, capped 12s)", () => {
    expect(queryRetryDelay(0)).toBe(2000);
    expect(queryRetryDelay(1)).toBe(4000);
    expect(queryRetryDelay(2)).toBe(8000);
    expect(queryRetryDelay(9)).toBe(12000);
  });
});
