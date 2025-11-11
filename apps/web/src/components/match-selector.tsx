"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

import { TeamAutocomplete } from "./team-autocomplete";
import { getTeamsForLeague, LeagueId } from "../lib/team-data";

const LEAGUES = [
  { id: "EPL", name: "Premier League", flag: "�🇧" },
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
  const router = useRouter();

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
      toast.error("Failed to load match insights");
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
          <label className="text-sm font-medium text-slate-300">League</label>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {LEAGUES.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => handleLeagueSelect(l.id)}
                className={`p-3 rounded-lg border-2 transition-all ${
                  league === l.id
                    ? "border-indigo-500 bg-indigo-500/10 text-slate-100"
                    : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600"
                }`}
              >
                <div className="text-2xl mb-1">{l.flag}</div>
                <div className="text-xs font-medium">{l.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Team Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] disabled:scale-100 disabled:shadow-none flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              Generating Insights...
            </>
          ) : (
            <>
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              Generate Insights
            </>
          )}
        </button>
      </form>

      <div className="pt-4 border-t border-slate-800/50">
        <p className="text-xs text-slate-500 text-center">
          Powered by ensemble ML models • 73.7% accuracy • +18.4% ROI
        </p>
      </div>
    </div>
  );
}
