import { afterEach, describe, expect, it, vi } from "vitest";
import { APIError, getFullAnalysis } from "./api";

function errorResponse(status: number, error: string) {
  return {
    ok: false,
    status,
    json: vi.fn().mockResolvedValue({ error, detail: error }),
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getFullAnalysis retry budget", () => {
  it("performs exactly one bounded retry for retryable infrastructure responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(503, "upstream_unavailable"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getFullAnalysis("A vs B", "EPL")).rejects.toMatchObject({
      code: "UPSTREAM_UNAVAILABLE",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry an HTTP 500 internal backend error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(500, "backend_internal_error"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getFullAnalysis("A vs B", "EPL")).rejects.toBeInstanceOf(APIError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects an invalid successful response without retrying", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ verdict: "ACTIONABLE" }),
    } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    await expect(getFullAnalysis("A vs B", "EPL")).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
