"use client";

import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

export const BackendStatusBanner = memo(function BackendStatusBanner() {
  const { data } = useQuery<{ backendStatus: string; status: string }>({
    queryKey: ["backend-health-banner"],
    queryFn: async () => {
      const res = await fetch("/api/health");
      return res.json();
    },
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
      <span>
        Prediction engine warming up — reconnecting automatically (30–60s after idle). No action needed.
      </span>
    </div>
  );
});
