"use client";

import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  fetchPlatformHealth,
  PLATFORM_HEALTH_QUERY_KEY,
  type BackendHealthPayload,
} from "@/lib/health-status";

export const BackendStatusBanner = memo(function BackendStatusBanner() {
  const { data } = useQuery<BackendHealthPayload>({
    queryKey: PLATFORM_HEALTH_QUERY_KEY,
    queryFn: fetchPlatformHealth,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  if (!data || data.backendStatus !== "unavailable") return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-950/40 px-4 py-2 text-xs text-amber-200 sm:px-6"
    >
      <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden="true" />
      <span>Analysis backend unavailable — live readiness and provider status cannot be verified.</span>
    </div>
  );
});
