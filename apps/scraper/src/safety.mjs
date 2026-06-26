import { setTimeout as delay } from "node:timers/promises";
import { userAgents } from "./config.mjs";

export class RateLimiter {
  constructor({ minDelayMs = 2500, jitterMs = 750 } = {}) {
    this.minDelayMs = minDelayMs;
    this.jitterMs = jitterMs;
    this.lastRequestAt = 0;
  }

  async wait() {
    const elapsed = Date.now() - this.lastRequestAt;
    const jitter = Math.floor(Math.random() * this.jitterMs);
    const waitMs = Math.max(0, this.minDelayMs - elapsed) + jitter;
    if (waitMs > 0) {
      await delay(waitMs);
    }
    this.lastRequestAt = Date.now();
  }
}

export class CircuitBreaker {
  constructor({ failureThreshold = 4, coolDownMs = 60_000 } = {}) {
    this.failureThreshold = failureThreshold;
    this.coolDownMs = coolDownMs;
    this.failures = 0;
    this.openedAt = 0;
  }

  canAttempt() {
    if (this.failures < this.failureThreshold) return true;
    return Date.now() - this.openedAt > this.coolDownMs;
  }

  success() {
    this.failures = 0;
    this.openedAt = 0;
  }

  failure() {
    this.failures += 1;
    if (this.failures >= this.failureThreshold) {
      this.openedAt = Date.now();
    }
  }
}

export function rotateUserAgent() {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

export async function isAllowedByRobots(targetUrl, userAgent = "*") {
  const url = new URL(targetUrl);
  const robotsUrl = `${url.protocol}//${url.host}/robots.txt`;
  try {
    const res = await fetch(robotsUrl, {
      headers: { "User-Agent": userAgent },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return false;
    const text = await res.text();
    return parseRobotsAllow(text, url.pathname, userAgent);
  } catch {
    return false;
  }
}

export function parseRobotsAllow(robotsText, path, userAgent = "*") {
  const lines = robotsText.split(/\r?\n/);
  let active = false;
  const disallows = [];
  const allows = [];

  for (const rawLine of lines) {
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;
    const [keyRaw, ...valueParts] = line.split(":");
    const key = keyRaw.trim().toLowerCase();
    const value = valueParts.join(":").trim();

    if (key === "user-agent") {
      const agent = value.toLowerCase();
      active = agent === "*" || userAgent.toLowerCase().includes(agent);
      continue;
    }
    if (!active) continue;
    if (key === "disallow" && value) disallows.push(value);
    if (key === "allow" && value) allows.push(value);
  }

  const longestAllow = allows.filter((rule) => path.startsWith(rule)).sort((a, b) => b.length - a.length)[0];
  const longestDisallow = disallows.filter((rule) => path.startsWith(rule)).sort((a, b) => b.length - a.length)[0];
  if (!longestDisallow) return true;
  if (!longestAllow) return false;
  return longestAllow.length >= longestDisallow.length;
}
