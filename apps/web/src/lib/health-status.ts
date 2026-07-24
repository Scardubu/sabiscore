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
  timestamp?: unknown;
  backendChecks?: Record<string, BackendReadinessCheck | unknown>;
  providers?: Array<{
    provider?: unknown;
    display_name?: unknown;
    configured?: unknown;
    enabled?: unknown;
    status?: unknown;
  }>;
}

export const PLATFORM_HEALTH_QUERY_KEY = ["platform-health"] as const;

export async function fetchPlatformHealth(): Promise<BackendHealthPayload> {
  const response = await fetch("/api/health", { cache: "no-store" });
  if (!response.ok) return { backendStatus: "unavailable", providers: [] };
  return response.json() as Promise<BackendHealthPayload>;
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

export function derivePlatformHealth(payload: BackendHealthPayload) {
  const readiness = deriveBackendReadiness(payload);
  const providers = payload.providers ?? [];
  const configured = providers.filter((provider) => provider.configured === true).length;
  const enabled = providers.filter((provider) => provider.enabled === true).length;
  const live = providers.filter((provider) =>
    provider.enabled === true && String(provider.status).toUpperCase() === "VERIFIED"
  ).length;
  const models = payload.backendChecks?.models;
  const modelsReady = Boolean(
    models && typeof models === "object" &&
      isHealthyBackendStatus((models as BackendReadinessCheck).status)
  );
  return { readiness, providers, configured, enabled, live, modelsReady };
}

export function liveMetricLabel(
  hasSufficientData: boolean,
  formattedValue: string,
): string {
  return hasSufficientData ? formattedValue : "Pending";
}
