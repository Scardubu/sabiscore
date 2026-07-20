export const BACKEND_READINESS_CHECKS = [
  "database",
  "migrations",
  "cache",
  "models",
] as const;

const READY_STATUSES = new Set(["ok", "ready", "healthy"]);

export interface BackendReadinessCheck {
  status?: unknown;
}

export interface BackendHealthPayload {
  backendStatus?: unknown;
  backendChecks?: Record<string, BackendReadinessCheck | unknown>;
}

export interface BackendReadinessStats {
  total: number;
  ready: number;
  unavailable: number;
  score: number;
  label: "Ready" | "Partial" | "Degraded";
}

export function isHealthyBackendStatus(status: unknown): boolean {
  return typeof status === "string" && READY_STATUSES.has(status.toLowerCase());
}

export function backendHealthIssues(status: unknown): string[] {
  return isHealthyBackendStatus(status)
    ? []
    : [`Backend status: ${String(status)}`];
}

export function deriveBackendReadiness(
  payload: BackendHealthPayload,
): BackendReadinessStats {
  const checks = payload.backendChecks ?? {};
  const ready = BACKEND_READINESS_CHECKS.filter((name) => {
    const check = checks[name];
    if (!check || typeof check !== "object") return false;
    return isHealthyBackendStatus((check as BackendReadinessCheck).status);
  }).length;
  const total = BACKEND_READINESS_CHECKS.length;
  const score = ready / total;
  const backendHealthy = isHealthyBackendStatus(payload.backendStatus);
  const label =
    backendHealthy && ready === total
      ? "Ready"
      : ready > 0
        ? "Partial"
        : "Degraded";

  return { total, ready, unavailable: total - ready, score, label };
}

export function liveMetricLabel(
  hasSufficientData: boolean,
  formattedValue: string,
): string {
  return hasSufficientData ? formattedValue : "Pending";
}
