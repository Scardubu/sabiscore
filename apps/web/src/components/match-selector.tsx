"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

import { TeamAutocomplete } from "./team-autocomplete";
import { TeamAutocompleteApi } from "./team-autocomplete-api";
import { getTeamsForLeague, LeagueId } from "../lib/team-data";
import { safeErrorMessage } from "@/lib/error-utils";

const LEAGUES = [
  { id: "EPL", name: "Premier League", flag: "🇬🇧" },
  { id: "La Liga", name: "La Liga", flag: "🇪🇸" },
  { id: "Serie A", name: "Serie A", flag: "🇮🇹" },
  { id: "Bundesliga", name: "Bundesliga", flag: "🇩🇪" },
  { id: "Ligue 1", name: "Ligue 1", flag: "🇫🇷" }
] as const satisfies ReadonlyArray<{ id: LeagueId; name: string; flag: string }>;

export function MatchSelector() {
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [league, setLeague] = useState<LeagueId>("EPL");
  const [loading, setLoading] = useState(false);
  const useApiAutocomplete =
    process.env.NEXT_PUBLIC_USE_API_AUTOCOMPLETE !== "false";
  const router = useRouter();

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

    const matchup = `${homeTeam.trim()} vs ${awayTeam.trim()}`;
    setLoading(true);

    try {
      // Navigate to match insights page
      const encodedMatchup = encodeURIComponent(matchup);
      router.push(`/match/${encodedMatchup}?league=${league}`);
    } catch (error) {
      const message = safeErrorMessage(error);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card p-8 space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-slate-100">
          Generate Match Insights
        </h2>
        <p className="text-slate-400">
          Enter teams to get AI-powered predictions and value bets
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* League Selector */}
        <div className="space-y-2">
          <label 
            id="league-selector-label" 
            className="text-sm font-medium text-slate-300"
          >
            League
          </label>
          <div 
            className="grid grid-cols-2 md:grid-cols-5 gap-3" 
            role="group" 
            aria-labelledby="league-selector-label"
          >
            {LEAGUES.map((l, idx) => {
              const animationDelayClass = [
                "delay-0",
                "delay-75",
                "delay-150",
                "delay-225",
                "delay-300",
              ][idx] ?? "delay-0";

              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => handleLeagueSelect(l.id)}
                  aria-label={`Select ${l.name}`}
                  className={`p-3 rounded-lg border-2 transition-all duration-300 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 animate-in fade-in slide-in-from-bottom-3 ${animationDelayClass} ${
                    league === l.id
                      ? "border-indigo-500 bg-indigo-500/10 text-slate-100 shadow-lg shadow-indigo-500/30 ring-2 ring-indigo-500/20"
                      : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:bg-slate-800 hover:shadow-md"
                  }`}
                >
                  <div
                    className={`text-2xl mb-1 transition-transform ${
                      league === l.id ? "animate-pulse" : ""
                    }`}
                    aria-hidden="true"
                  >
                    {l.flag}
                  </div>
                  <div className="text-xs font-medium">{l.name}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Team Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {useApiAutocomplete ? (
            <>
              <TeamAutocompleteApi
                label="Home Team"
                value={homeTeam}
                onChange={setHomeTeam}
                league={league}
                placeholder="Search or type a team"
                disabled={loading}
              />

              <TeamAutocompleteApi
                label="Away Team"
                value={awayTeam}
                onChange={setAwayTeam}
                league={league}
                placeholder="Search or type a team"
                disabled={loading}
              />
            </>
          ) : (
            <>
              <TeamAutocomplete
                label="Home Team"
                value={homeTeam}
                onChange={setHomeTeam}
                options={leagueTeams}
                placeholder="Search or type a team"
                disabled={loading}
              />

              <TeamAutocomplete
                label="Away Team"
                value={awayTeam}
                onChange={setAwayTeam}
                options={leagueTeams}
                placeholder="Search or type a team"
                disabled={loading}
              />
            </>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || !homeTeam.trim() || !awayTeam.trim()}
          aria-live="polite"
          className="w-full py-4 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:bg-slate-700 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/50 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] disabled:scale-100 disabled:shadow-none flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 group"
        >
          {loading ? (
            <>
              <div 
                className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" 
                role="status"
                aria-label="Loading"
              ></div>
              <span>Generating Insights...</span>
            </>
          ) : (
            <>
              <svg
                className="h-5 w-5 transition-transform group-hover:scale-110"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              <span>Generate Insights</span>
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
            aria-label="Reset match selector"
            className="text-xs text-slate-400 hover:text-slate-200 transition-all duration-150 hover:underline focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:ring-offset-1 focus:ring-offset-slate-900 rounded px-2 py-1"
          >
            Reset selection
          </button>
        </div>
      </form>

      <footer className="pt-4 border-t border-slate-800/50" aria-label="Model statistics">
        <p className="text-xs text-slate-500 text-center">
          <span className="inline-flex items-center gap-1">
            <span aria-label="Powered by">⚡</span>
            <span>SOTA Ensemble ML</span>
          </span>
          <span className="mx-2" aria-hidden="true">•</span>
          <span aria-label="Model accuracy">73.7% accuracy</span>
          <span className="mx-2" aria-hidden="true">•</span>
          <span aria-label="Return on investment">+18.4% ROI</span>
        </p>
      </footer>
    </div>
  );
}
