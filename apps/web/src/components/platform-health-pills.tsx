"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, BarChart3, Database, type LucideIcon } from "lucide-react";
import {
  derivePlatformHealth,
  fetchPlatformHealth,
  PLATFORM_HEALTH_QUERY_KEY,
} from "@/lib/health-status";

function HealthPill({
  icon: Icon,
  label,
  value,
  ready,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  ready: boolean;
}) {
  return (
    <div className="flex min-h-11 items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2">
      <Icon className={ready ? "h-4 w-4 text-emerald-300" : "h-4 w-4 text-amber-300"} aria-hidden="true" />
      <span>
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
        <span className="block text-xs text-slate-300">{value}</span>
      </span>
    </div>
  );
}

export function PlatformHealthPills() {
  const { data } = useQuery({
    queryKey: PLATFORM_HEALTH_QUERY_KEY,
    queryFn: fetchPlatformHealth,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
  const health = data ? derivePlatformHealth(data) : null;
  const checks = data?.backendChecks ?? {};
  const databaseReady = Boolean(
    checks.database && typeof checks.database === "object" &&
      ["ok", "ready", "healthy"].includes(
        String((checks.database as { status?: unknown }).status).toLowerCase(),
      )
  );

  return (
    <>
      <HealthPill
        icon={Database}
        label="Postgres"
        value={health ? (databaseReady ? "Ready" : "Unavailable") : "Checking"}
        ready={databaseReady}
      />
      <HealthPill
        icon={Activity}
        label="Providers"
        value={health ? `${health.live}/${health.enabled} live · ${health.configured} configured` : "Checking"}
        ready={Boolean(health && health.enabled > 0 && health.live === health.enabled)}
      />
      <HealthPill
        icon={BarChart3}
        label="Models"
        value={health ? (health.modelsReady ? "Ready" : "Unavailable") : "Checking"}
        ready={Boolean(health?.modelsReady)}
      />
    </>
  );
}
