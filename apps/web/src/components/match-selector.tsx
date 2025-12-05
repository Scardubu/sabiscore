/* eslint-disable jsx-a11y/aria-proptypes */
"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

import { TeamAutocomplete } from "./team-autocomplete";
import { getTeamsForLeague, LeagueId } from "../lib/team-data";
import { safeErrorMessage } from "@/lib/error-utils";
import { LEAGUE_CONFIG, TeamVsDisplay } from "./team-display";
import { MatchLoadingExperience } from "@/components/loading/match-loading-experience";
import { FeatureFlag, useFeatureFlag } from "@/lib/feature-flags";
import { hashMatchup } from "@/lib/interstitial-storage";
import { cn } from "@/lib/utils";

const LEAGUES = [
  { id: "EPL", name: "Premier League" },
  { id: "La Liga", name: "La Liga" },
  { id: "Serie A", name: "Serie A" },
  { id: "Bundesliga", name: "Bundesliga" },
  { id: "Ligue 1", name: "Ligue 1" }
] as const satisfies ReadonlyArray<{ id: LeagueId; name: string }>;

export function MatchSelector() {
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [league, setLeague] = useState<LeagueId>("EPL");
  const [loading, setLoading] = useState(false);
  const [showInterstitial, setShowInterstitial] = useState(false);
  const router = useRouter();
  const interstitialV2Enabled = useFeatureFlag(FeatureFlag.PREDICTION_INTERSTITIAL_V2);
  const premiumVisualsEnabled = useFeatureFlag(FeatureFlag.PREMIUM_VISUAL_HIERARCHY);
  const [pendingMatchup, setPendingMatchup] = useState<{
    home: string;
    away: string;
    league: LeagueId;
    key: string;
  } | null>(null);

  const STORAGE_KEY = "sabiscore.matchSelector.v1";

  // Restore persisted selector state on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.league) setLeague(parsed.league as LeagueId);
      if (parsed?.homeTeam) setHomeTeam(parsed.homeTeam);
      if (parsed?.awayTeam) setAwayTeam(parsed.awayTeam);
    } catch {
      // ignore parse errors
      // console.warn("Failed to restore match selector state", err);
    }
  }, []);

  // Persist selection when values change
  useEffect(() => {
    try {
      const payload = { league, homeTeam, awayTeam };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage errors
    }
  }, [league, homeTeam, awayTeam]);

  const leagueTeams = useMemo(() => getTeamsForLeague(league), [league]);

  const handleLeagueSelect = (nextLeague: LeagueId) => {
    if (nextLeague === league) {
      return;
    }

    setLeague(nextLeague);
    setHomeTeam("");
    setAwayTeam("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!homeTeam.trim() || !awayTeam.trim()) {
      toast.error("Please enter both teams");
      return;
    }

    const normalizedHome = homeTeam.trim();
    const normalizedAway = awayTeam.trim();
    const matchup = `${normalizedHome} vs ${normalizedAway}`;
    setLoading(true);
    if (interstitialV2Enabled) {
      const matchupKey = hashMatchup(normalizedHome, normalizedAway);
      setPendingMatchup({ home: normalizedHome, away: normalizedAway, league, key: matchupKey });
      setShowInterstitial(true);
    }

    try {
      // Navigate to match insights page
      const encodedMatchup = encodeURIComponent(matchup);
      router.push(`/match/${encodedMatchup}?league=${league}`);
    } catch (error) {
      setShowInterstitial(false);
      setPendingMatchup(null);
      const message = safeErrorMessage(error);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!showInterstitial) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [showInterstitial]);

  const hasTeamsSelected = Boolean(homeTeam.trim() && awayTeam.trim());

  return (
    <>
      <div
        className={cn(
          "glass-card relative overflow-hidden p-8",
          premiumVisualsEnabled &&
            "border-white/10 bg-slate-950/70 shadow-[0_15px_45px_rgba(8,14,35,0.55)]"
        )}
      >
        {premiumVisualsEnabled && (
          <div
            className="pointer-events-none absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_top,rgba(0,212,255,0.25),transparent_55%),radial-gradient(circle_at_20%_80%,rgba(123,47,247,0.15),transparent_45%)]"
            aria-hidden="true"
          />
        )}
        <div className="relative space-y-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold text-slate-100">Generate Match Insights</h2>
              {premiumVisualsEnabled && (
                <span className="rounded-full border border-white/10 bg-slate-900/60 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-300">
                  Premium visual mode
                </span>
              )}
            </div>
            <p className="text-slate-400">Enter teams to get AI-powered predictions and value bets</p>
          </div>

        {premiumVisualsEnabled && (
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            {hasTeamsSelected ? (
              <>
                <TeamVsDisplay
                  homeTeam={homeTeam}
                  awayTeam={awayTeam}
                  league={league}
                  size="lg"
                  showCountryFlags={false}
                  className="justify-between"
                />
                <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-slate-300">
                  <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1">
                    Recent form weighted ×3
                  </span>
                  <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1">
                    Monte Carlo (10,000 sims)
                  </span>
                  <span className="rounded-full border border-purple-300/30 bg-purple-300/10 px-3 py-1">
                    Ensemble vote locking
                  </span>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-400">
                Select both teams to preview the matchup and pipeline emphasis before generating insights.
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* League Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">League</label>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {LEAGUES.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => handleLeagueSelect(l.id)}
                  className={cn(
                    "rounded-xl border-2 p-3 transition-all",
                    premiumVisualsEnabled
                      ? league === l.id
                        ? "border-transparent bg-gradient-to-br from-cyan-400/30 to-indigo-500/30 text-white shadow-[0_10px_25px_rgba(15,23,42,0.55)]"
                        : "border-white/10 bg-slate-900/60 text-slate-300 hover:border-cyan-400/30"
                      : league === l.id
                      ? "border-indigo-500 bg-indigo-500/10 text-slate-100"
                      : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600"
                  )}
                >
                  <div className="mb-1 text-2xl">{LEAGUE_CONFIG[l.id]?.flag || "⚽"}</div>
                  <div className="text-xs font-medium">{l.name}</div>
                  {premiumVisualsEnabled && LEAGUE_CONFIG[l.id]?.country && (
                    <p className="text-[10px] text-slate-500">{LEAGUE_CONFIG[l.id]?.country}</p>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Team Inputs */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TeamAutocomplete
              label="Home Team"
              value={homeTeam}
              onChange={setHomeTeam}
              options={leagueTeams}
              league={league}
              placeholder="Search or type a team"
              disabled={loading}
            />

            <TeamAutocomplete
              label="Away Team"
              value={awayTeam}
              onChange={setAwayTeam}
              options={leagueTeams}
              league={league}
              placeholder="Search or type a team"
              disabled={loading}
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-4 font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all duration-200 hover:scale-[1.02] hover:bg-indigo-500 hover:shadow-indigo-500/40 disabled:cursor-not-allowed disabled:scale-100 disabled:bg-slate-700 disabled:shadow-none"
          >
            {loading ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
                Generating Insights...
              </>
            ) : (
              <>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Generate Insights
              </>
            )}
          </button>

          <div className="mt-2 text-center">
            <button
              type="button"
              onClick={() => {
                setHomeTeam("");
                setAwayTeam("");
                setLeague("EPL");
                try {
                  localStorage.removeItem(STORAGE_KEY);
                } catch {}
                toast.success("Selector reset");
              }}
              className="text-xs text-slate-400 transition-colors hover:text-slate-200"
            >
              Reset selection
            </button>
          </div>
        </form>

        <div className="pt-4 border-t border-slate-800/50">
          <p className="text-xs text-center text-slate-500">
            Powered by ensemble ML models • 73.7% accuracy • +18.4% ROI
          </p>
          <div className="mt-2 flex items-center justify-center gap-2 text-[10px] text-slate-600">
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500/60"></span>
              Live Data
            </span>
            <span>•</span>
            <span>8 Sources Integrated</span>
            <span>•</span>
            <span>Updated Every 5min</span>
          </div>
        </div>
        </div>
      </div>

      {interstitialV2Enabled && showInterstitial && pendingMatchup && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 px-4 py-8 backdrop-blur"
          role="dialog"
          aria-modal="true"
          aria-labelledby="match-loading-title"
          aria-describedby="match-loading-desc"
        >
          <div className="absolute inset-0" aria-hidden="true" />
          <div className="relative w-full max-w-xl">
            <MatchLoadingExperience
              homeTeam={pendingMatchup.home}
              awayTeam={pendingMatchup.away}
              league={pendingMatchup.league}
              matchupId={pendingMatchup.key}
            />
          </div>
        </div>
      )}
    </>
  );
}
