"use client";

import { FeatureFlag, useFeatureFlag } from "@/lib/feature-flags";
import { UpcomingMatchesPanel } from "./upcoming-matches-panel";

export function UpcomingMatchesSection() {
  const enabled = useFeatureFlag(FeatureFlag.UPCOMING_PANEL);
  if (!enabled) return null;
  return <UpcomingMatchesPanel />;
}
