"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { MatchLoadingInterstitial, MatchLoadingInterstitialSkeleton } from "@/components/match-loading-interstitial";
import { MatchLoadingExperience, MatchLoadingExperienceSkeleton } from "@/components/loading/match-loading-experience";
import { FeatureFlag, useFeatureFlag } from "@/lib/feature-flags";
import { hashMatchup } from "@/lib/interstitial-storage";

function MatchLoadingContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const league = searchParams?.get("league") || "EPL";
  const interstitialV2Enabled = useFeatureFlag(FeatureFlag.PREDICTION_INTERSTITIAL_V2);
  
  // Prefer query params (always present for canonical fixture IDs like fd-558217).
  // Fall back to splitting the path id on " vs " for legacy hypothetical matchup URLs.
  const homeParam = searchParams?.get("home");
  const awayParam = searchParams?.get("away");

  let homeTeam = homeParam?.trim() || "Home Team";
  let awayTeam = awayParam?.trim() || "Away Team";

  if ((!homeParam || !awayParam) && params?.id) {
    try {
      const matchup = decodeURIComponent(params.id as string);
      const teams = matchup.split(" vs ");
      if (teams.length === 2) {
        if (!homeParam) homeTeam = teams[0].trim();
        if (!awayParam) awayTeam = teams[1].trim();
      }
    } catch {
      // Use defaults
    }
  }

  const matchupId = hashMatchup(homeTeam, awayTeam);

  if (interstitialV2Enabled) {
    return (
      <MatchLoadingExperience
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        league={league}
        matchupId={matchupId}
      />
    );
  }

  return (
    <MatchLoadingInterstitial
      homeTeam={homeTeam}
      awayTeam={awayTeam}
      league={league}
    />
  );
}

export default function MatchInsightsLoading() {
  const LoadingFallback = () => {
    const interstitialV2Enabled = useFeatureFlag(FeatureFlag.PREDICTION_INTERSTITIAL_V2);
    return interstitialV2Enabled ? (
      <MatchLoadingExperienceSkeleton />
    ) : (
      <MatchLoadingInterstitialSkeleton />
    );
  };

  return (
    <Suspense fallback={<LoadingFallback />}>
      <MatchLoadingContent />
    </Suspense>
  );
}
