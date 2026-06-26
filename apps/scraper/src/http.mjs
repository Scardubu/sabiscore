import { CircuitBreaker, RateLimiter, isAllowedByRobots, rotateUserAgent } from "./safety.mjs";

export class PublicHttpClient {
  constructor({ minDelayMs = 2500, retries = 2, respectRobots = true } = {}) {
    this.limiter = new RateLimiter({ minDelayMs });
    this.breaker = new CircuitBreaker();
    this.retries = retries;
    this.respectRobots = respectRobots;
  }

  async getText(url) {
    if (!this.breaker.canAttempt()) {
      throw new Error(`Circuit breaker open for ${url}`);
    }

    const userAgent = rotateUserAgent();
    if (this.respectRobots) {
      const allowed = await isAllowedByRobots(url, userAgent);
      if (!allowed) {
        throw new Error(`Blocked by robots.txt: ${url}`);
      }
    }

    let lastError;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      try {
        await this.limiter.wait();
        const res = await fetch(url, {
          headers: {
            "User-Agent": userAgent,
            Accept: "text/html,application/xhtml+xml,text/csv,application/json;q=0.9,*/*;q=0.8"
          },
          signal: AbortSignal.timeout(20_000)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        this.breaker.success();
        return text;
      } catch (err) {
        lastError = err;
        this.breaker.failure();
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
      }
    }
    throw lastError;
  }
}
