"use client";

/**
 * SabiScore Betting Intelligence Dashboard
 * A distinctive, production-grade UI for displaying betting intelligence analysis.
 *
 * Design philosophy: "Terminal Meets Stadium"
 * - Dark, data-dense aesthetic with monospaced data displays
 * - Sharp electric accents (lime green for value, amber for warning, crimson for no-bet)
 * - Condensed gothic typography for headers, mono for numbers
 * - Animated data reveals with deliberate pacing
 * - No hype copy - every string is conditional on verified evidence
 *
 * Integrates with the strict $SABISCORE_CORE_ENGINE contract v1.1.0
 * Consumers must handle: NO_BET, PARTIAL, HOLD, SPECULATIVE, ACTIONABLE, HIGH_CONVICTION
 * All nullable fields are treated as DATA_GAP, never shown as zero.
 */

import { memo, useState, useCallback, useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import type {
  Verdict,
  MatchAnalysisResult,
  MarketEvaluation,
  MatchAnalysisRequest,
  Competition,
} from "@/lib/betting-intelligence-api";

// --- Design tokens ------------------------------------------------------------

const VERDICT_CONFIG: Record<
  Verdict,
  {
    label: string;
    color: string;
    bg: string;
    border: string;
    accent: string;
    glow: string;
    dot: string;
    action: string;
    desc: string;
  }
> = {
  HIGH_CONVICTION: {
    label: "HIGH CONVICTION",
    color: "#00ff88",
    bg: "rgba(0,255,136,0.06)",
    border: "rgba(0,255,136,0.35)",
    accent: "#00ff88",
    glow: "0 0 24px rgba(0,255,136,0.25)",
    dot: "#00ff88",
    action: "EXECUTE",
    desc: "All gates satisfied. Edge, EV, calibration, freshness, and causal support verified.",
  },
  ACTIONABLE: {
    label: "ACTIONABLE",
    color: "#00d4ff",
    bg: "rgba(0,212,255,0.06)",
    border: "rgba(0,212,255,0.35)",
    accent: "#00d4ff",
    glow: "0 0 20px rgba(0,212,255,0.20)",
    dot: "#00d4ff",
    action: "EXECUTE",
    desc: "Positive de-vigged edge and EV. Execute at or above minimum acceptable odds.",
  },
  SPECULATIVE: {
    label: "SPECULATIVE",
    color: "#ffaa00",
    bg: "rgba(255,170,0,0.06)",
    border: "rgba(255,170,0,0.30)",
    accent: "#ffaa00",
    glow: "0 0 16px rgba(255,170,0,0.18)",
    dot: "#ffaa00",
    action: "MICRO-STAKE",
    desc: "Sub-threshold edge. Positive value exists but variance is high. Size down.",
  },
  HOLD: {
    label: "HOLD",
    color: "#8899aa",
    bg: "rgba(136,153,170,0.05)",
    border: "rgba(136,153,170,0.25)",
    accent: "#8899aa",
    glow: "none",
    dot: "#8899aa",
    action: "HOLD",
    desc: "Evidence quality or execution conditions insufficient. Monitor and refresh data.",
  },
  PARTIAL: {
    label: "PARTIAL DATA",
    color: "#cc44ff",
    bg: "rgba(204,68,255,0.06)",
    border: "rgba(204,68,255,0.25)",
    accent: "#cc44ff",
    glow: "0 0 16px rgba(204,68,255,0.15)",
    dot: "#cc44ff",
    action: "NO ACTION",
    desc: "Critical inputs unavailable. Resolve data gaps before execution.",
  },
  NO_BET: {
    label: "NO BET",
    color: "#ff4455",
    bg: "rgba(255,68,85,0.05)",
    border: "rgba(255,68,85,0.25)",
    accent: "#ff4455",
    glow: "none",
    dot: "#ff4455",
    action: "PASS",
    desc: "Verified evidence. No supported market offers a positive expected value.",
  },
};

const FRESHNESS_CONFIG = {
  FRESH: { label: "LIVE", color: "#00ff88" },
  RECENT: { label: "RECENT", color: "#ffaa00" },
  STALE: { label: "STALE", color: "#ff4455" },
  DATA_GAP: { label: "UNKNOWN", color: "#8899aa" },
  CONFLICTING: { label: "CONFLICT", color: "#ff4455" },
  UNKNOWN: { label: "UNKNOWN", color: "#8899aa" },
};

// --- Shared helpers -----------------------------------------------------------

const pct = (v: number | null | undefined, decimals = 1): string =>
  v == null ? "-" : `${(v * 100).toFixed(decimals)}%`;

const pp = (v: number | null | undefined, decimals = 2): string =>
  v == null ? "-" : `${v > 0 ? "+" : ""}${(v * 100).toFixed(decimals)}pp`;

const _dec = (v: number | null | undefined, decimals = 3): string =>
  v == null ? "-" : v.toFixed(decimals);

const odds = (v: number | null | undefined): string =>
  v == null ? "-" : v.toFixed(2);

const ev = (v: number | null | undefined): string =>
  v == null ? "-" : `${v > 0 ? "+" : ""}${v.toFixed(4)}u`;

const stake = (fraction: number, stakeStr: string): string => {
  if (stakeStr === "pass" || fraction === 0) return "PASS";
  return stakeStr;
};

function timeUntil(isoDate?: string | null): string {
  if (!isoDate) return "-";
  const diff = new Date(isoDate).getTime() - Date.now();
  if (diff < 0) return "KICKED OFF";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// --- Sub-components -----------------------------------------------------------

const DataTag = ({
  label,
  value,
  accent,
  mono = false,
}: {
  label: string;
  value: string;
  accent?: string;
  mono?: boolean;
}) => (
  <div className="ss-data-tag">
    <span className="ss-data-label">{label}</span>
    <span
      className="ss-data-value"
      style={{
        color: accent,
        fontFamily: mono ? "'JetBrains Mono', 'Fira Code', monospace" : undefined,
      }}
    >
      {value}
    </span>
  </div>
);

const GapBadge = ({ gap }: { gap: string }) => (
  <span className="ss-gap-badge">{gap.replace(/^DATA_GAP: /, "").replace(/_/g, " ")}</span>
);

const ProbBar = ({
  label,
  prob,
  fairProb,
  accent,
  isBest,
}: {
  label: string;
  prob: number | null;
  fairProb?: number | null;
  accent: string;
  isBest?: boolean;
}) => {
  const p = prob ?? 0;
  return (
    <div className="ss-prob-row" style={{ opacity: p === 0 && prob == null ? 0.4 : 1 }}>
      <div className="ss-prob-label" style={{ color: isBest ? accent : undefined }}>
        {label}
        {isBest && <span className="ss-best-tag">BEST</span>}
      </div>
      <div className="ss-prob-track">
        <div
          className="ss-prob-fill"
          style={{
            width: `${Math.round(p * 100)}%`,
            background: isBest ? accent : "rgba(255,255,255,0.15)",
            boxShadow: isBest ? `0 0 10px ${accent}55` : undefined,
          }}
        />
        {fairProb != null && (
          <div
            className="ss-prob-fair-marker"
            style={{ left: `${Math.round(fairProb * 100)}%` }}
            title={`Fair market: ${(fairProb * 100).toFixed(1)}%`}
          />
        )}
      </div>
      <div className="ss-prob-pct" style={{ color: isBest ? accent : undefined }}>
        {prob == null ? "-" : `${(p * 100).toFixed(1)}%`}
      </div>
    </div>
  );
};

const OutcomeTable = ({
  evaluations,
  accent,
}: {
  evaluations: MarketEvaluation[];
  accent: string;
}) => {
  const sorted = [...evaluations].sort((a, b) => b.confidence_adjusted_value - a.confidence_adjusted_value);
  return (
    <div className="ss-outcome-table">
      <div className="ss-outcome-header">
        <span>MARKET</span>
        <span>ODDS</span>
        <span>FAIR P</span>
        <span>EDGE</span>
        <span>EV</span>
        <span>STAKE</span>
      </div>
      {sorted.map((e, i) => {
        const isBest = i === 0 && e.confidence_adjusted_value > 0;
        return (
          <div
            key={e.outcome}
            className="ss-outcome-row"
            style={{
              borderLeft: isBest ? `2px solid ${accent}` : "2px solid transparent",
              background: isBest ? `${accent}08` : undefined,
            }}
          >
            <span
              className="ss-outcome-market"
              style={{ color: isBest ? accent : undefined }}
            >
              {e.market_label.replace("_ML", "")}
              {isBest && <span className="ss-micro-badge" aria-hidden="true" />}
            </span>
            <span className="ss-mono">{odds(e.market_odds)}</span>
            <span className="ss-mono">{pct(e.fair_market_probability)}</span>
            <span
              className="ss-mono"
              style={{
                color: e.edge > 0 ? "#00ff88" : "#ff4455",
              }}
            >
              {pp(e.edge)}
            </span>
            <span
              className="ss-mono"
              style={{
                color: e.expected_value > 0 ? "#00ff88" : "#ff4455",
              }}
            >
              {ev(e.expected_value)}
            </span>
            <span
              className="ss-mono"
              style={{
                color: e.stake_fraction > 0 ? "#ffaa00" : "#666",
              }}
            >
              {e.stake_fraction > 0
                ? `${(e.stake_fraction * 100).toFixed(2)}%`
                : "-"}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// --- Match input form ---------------------------------------------------------

interface MatchFormState {
  homeTeam: string;
  awayTeam: string;
  competition: string;
  homeOdds: string;
  drawOdds: string;
  awayOdds: string;
  homeProb: string;
  drawProb: string;
  awayProb: string;
  modelVersion: string;
  calibrationValidated: boolean;
}

type FormTextKey = keyof Pick<
  MatchFormState,
  "homeOdds" | "drawOdds" | "awayOdds" | "homeProb" | "drawProb" | "awayProb"
>;

const DEFAULT_FORM: MatchFormState = {
  homeTeam: "",
  awayTeam: "",
  competition: "EPL",
  homeOdds: "",
  drawOdds: "",
  awayOdds: "",
  homeProb: "",
  drawProb: "",
  awayProb: "",
  modelVersion: "sabiscore-v3.1",
  calibrationValidated: true,
};

// --- Main dashboard -----------------------------------------------------------

export function BettingIntelligenceDashboard() {
  const [form, setForm] = useState<MatchFormState>(DEFAULT_FORM);
  const [result, setResult] = useState<MatchAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [policy, setPolicy] = useState<{
    min_actionable_edge_pp: number;
    kelly_fraction: number;
    max_kelly_cap: number;
  } | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    // Try to load policy (non-blocking)
    fetch("/api/betting-intelligence/policy")
      .then((r) => r.json())
      .then((d) => {
        setPolicy(d.policy);
      })
      .catch(() => undefined);
  }, []);

  const buildRequest = useCallback((): MatchAnalysisRequest | null => {
    const homeOdds = parseFloat(form.homeOdds);
    const drawOdds = parseFloat(form.drawOdds);
    const awayOdds = parseFloat(form.awayOdds);
    const homeProb = parseFloat(form.homeProb) / 100;
    const drawProb = parseFloat(form.drawProb) / 100;
    const awayProb = parseFloat(form.awayProb) / 100;

    if (!form.homeTeam || !form.awayTeam) return null;

    const hasOdds = homeOdds > 1 && drawOdds > 1 && awayOdds > 1;
    const hasProbs = !isNaN(homeProb) && !isNaN(drawProb) && !isNaN(awayProb);
    const probSum = homeProb + drawProb + awayProb;
    const hasValidModel = hasProbs && Math.abs(probSum - 1) < 0.01;

    return {
      match_id: `${form.homeTeam}-vs-${form.awayTeam}-${Date.now()}`,
      home_team: form.homeTeam,
      away_team: form.awayTeam,
      competition: form.competition as Competition,
      kickoff_utc: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      model: hasValidModel
        ? {
            home_probability: homeProb,
            draw_probability: drawProb,
            away_probability: awayProb,
            model_version: form.modelVersion || "manual-entry",
            calibration_method: "manual",
            calibration_validated: form.calibrationValidated,
            epistemic_uncertainty: 0.12,
            aleatoric_uncertainty: 0.10,
            confidence_tier: "OK",
          }
        : undefined,
      market: hasOdds
        ? {
            bookmaker: "User Input",
            market_type: "1X2",
            home_odds: homeOdds,
            draw_odds: drawOdds,
            away_odds: awayOdds,
            captured_at: new Date().toISOString(),
          }
        : undefined,
      freshness: {
        market_seconds: 60,
        model_features_seconds: 3600,
      },
      source_status: {
        model: hasValidModel ? "VERIFIED" : "DATA_GAP",
        market: hasOdds ? "VERIFIED" : "DATA_GAP",
        team_metrics: "DATA_GAP",
        availability: "DATA_GAP",
      },
      data_gaps: [],
    };
  }, [form]);

  const handleAnalyze = useCallback(async () => {
    const request = buildRequest();
    if (!request) {
      setError("Enter team names to analyze.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/betting-intelligence/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail?.message ?? `Request failed (${res.status})`);
      }
      const data = (await res.json()) as MatchAnalysisResult;
      setResult(data);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Analysis failed. Check backend connection.");
    } finally {
      setLoading(false);
    }
  }, [buildRequest]);

  const cfg = result ? VERDICT_CONFIG[result.verdict] : null;

  return (
    <>
      <style>{`

        :root {
          --ss-bg: #070c14;
          --ss-surface: #0d1520;
          --ss-surface-2: #111d2c;
          --ss-border: rgba(255,255,255,0.06);
          --ss-border-mid: rgba(255,255,255,0.10);
          --ss-text: #d4dde8;
          --ss-text-dim: #5a6a7a;
          --ss-text-mid: #8899aa;
          --ss-mono: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
          --ss-display: 'Arial Narrow', 'Roboto Condensed', Impact, sans-serif;
          --ss-radius: 6px;
        }

        .ss-root {
          background: var(--ss-bg);
          color: var(--ss-text);
          font-family: var(--ss-mono);
          min-height: 100vh;
          padding: 0;
        }

        .ss-header {
          background: var(--ss-surface);
          border-bottom: 1px solid var(--ss-border);
          padding: 16px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .ss-logo {
          font-family: var(--ss-display);
          font-size: 22px;
          font-weight: 900;
          letter-spacing: 0.04em;
          color: #fff;
          text-transform: uppercase;
        }

        .ss-logo span {
          color: #00ff88;
        }

        .ss-header-meta {
          font-size: 10px;
          color: var(--ss-text-dim);
          text-align: right;
          line-height: 1.5;
        }

        .ss-engine-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: rgba(0,255,136,0.08);
          border: 1px solid rgba(0,255,136,0.2);
          color: #00ff88;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.08em;
          padding: 3px 8px;
          border-radius: 3px;
        }

        .ss-engine-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #00ff88;
          animation: ss-pulse 2s ease-in-out infinite;
        }

        @keyframes ss-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        .ss-main {
          max-width: 1120px;
          margin: 0 auto;
          padding: 24px 20px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        /* -- Form -- */
        .ss-form-card {
          background: var(--ss-surface);
          border: 1px solid var(--ss-border-mid);
          border-radius: var(--ss-radius);
          padding: 20px;
        }

        .ss-form-title {
          font-family: var(--ss-display);
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.12em;
          color: var(--ss-text-dim);
          text-transform: uppercase;
          margin-bottom: 16px;
        }

        .ss-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .ss-grid-3 {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 12px;
        }

        .ss-grid-4 {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr 1fr;
          gap: 12px;
        }

        .ss-field {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .ss-label {
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.12em;
          color: var(--ss-text-dim);
          text-transform: uppercase;
        }

        .ss-input {
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--ss-border);
          border-radius: 4px;
          color: var(--ss-text);
          font-family: var(--ss-mono);
          font-size: 13px;
          padding: 8px 10px;
          width: 100%;
          outline: none;
          transition: border-color 0.15s;
        }

        .ss-input:focus {
          border-color: rgba(0,212,255,0.4);
          background: rgba(0,212,255,0.04);
        }

        .ss-input::placeholder {
          color: var(--ss-text-dim);
        }

        .ss-select {
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--ss-border);
          border-radius: 4px;
          color: var(--ss-text);
          font-family: var(--ss-mono);
          font-size: 13px;
          padding: 8px 10px;
          width: 100%;
          outline: none;
          cursor: pointer;
        }

        .ss-divider {
          height: 1px;
          background: var(--ss-border);
          margin: 16px 0;
        }

        .ss-section-label {
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.12em;
          color: var(--ss-text-dim);
          text-transform: uppercase;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .ss-section-label::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--ss-border);
        }

        .ss-checkbox-row {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 12px;
          color: var(--ss-text-mid);
        }

        .ss-checkbox-row input {
          accent-color: #00d4ff;
          width: 14px;
          height: 14px;
          cursor: pointer;
        }

        .ss-analyze-btn {
          width: 100%;
          margin-top: 16px;
          padding: 13px;
          background: #00d4ff;
          color: #070c14;
          border: none;
          border-radius: var(--ss-radius);
          font-family: var(--ss-display);
          font-size: 16px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          cursor: pointer;
          transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
        }

        .ss-analyze-btn:hover {
          background: #22e0ff;
          box-shadow: 0 0 20px rgba(0,212,255,0.35);
        }

        .ss-analyze-btn:active { transform: scale(0.99); }

        .ss-analyze-btn:disabled {
          background: var(--ss-surface-2);
          color: var(--ss-text-dim);
          cursor: not-allowed;
          box-shadow: none;
        }

        .ss-error {
          background: rgba(255,68,85,0.08);
          border: 1px solid rgba(255,68,85,0.25);
          border-radius: 4px;
          color: #ff4455;
          font-size: 12px;
          padding: 10px 14px;
          margin-top: 10px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .ss-error-icon {
          width: 15px;
          height: 15px;
          flex-shrink: 0;
        }

        /* -- Loading -- */
        .ss-loading {
          background: var(--ss-surface);
          border: 1px solid var(--ss-border-mid);
          border-radius: var(--ss-radius);
          padding: 40px;
          text-align: center;
        }

        .ss-spinner {
          width: 40px;
          height: 40px;
          border: 2px solid var(--ss-border);
          border-top-color: #00d4ff;
          border-radius: 50%;
          animation: ss-spin 0.8s linear infinite;
          margin: 0 auto 16px;
        }

        @keyframes ss-spin {
          to { transform: rotate(360deg); }
        }

        .ss-loading-text {
          font-size: 11px;
          color: var(--ss-text-dim);
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        /* -- Result -- */
        .ss-result {
          animation: ss-fadein 0.4s ease;
        }

        @keyframes ss-fadein {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Verdict hero */
        .ss-verdict-card {
          border-radius: var(--ss-radius);
          padding: 24px;
          position: relative;
          overflow: hidden;
        }

        .ss-verdict-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--ss-verdict-accent);
        }

        .ss-verdict-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .ss-verdict-label-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .ss-match-name {
          font-family: var(--ss-display);
          font-size: 28px;
          font-weight: 900;
          color: #fff;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          line-height: 1;
        }

        .ss-match-meta {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .ss-comp-badge {
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.12em;
          color: var(--ss-text-mid);
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--ss-border);
          padding: 3px 7px;
          border-radius: 3px;
          text-transform: uppercase;
        }

        .ss-kickoff {
          font-size: 10px;
          color: var(--ss-text-dim);
        }

        .ss-verdict-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 8px;
        }

        .ss-verdict-chip {
          font-family: var(--ss-display);
          font-size: 28px;
          font-weight: 900;
          letter-spacing: 0.08em;
          padding: 8px 16px;
          border-radius: 4px;
          text-transform: uppercase;
          line-height: 1;
        }

        .ss-action-chip {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.15em;
          padding: 5px 12px;
          border-radius: 3px;
          text-transform: uppercase;
          border-width: 1px;
          border-style: solid;
        }

        .ss-verdict-desc {
          font-size: 11px;
          color: var(--ss-text-mid);
          line-height: 1.5;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid var(--ss-border);
          max-width: 680px;
        }

        /* Data grid */
        .ss-data-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 1px;
          background: var(--ss-border);
          border-radius: var(--ss-radius);
          overflow: hidden;
          margin-top: 16px;
        }

        .ss-data-tag {
          background: var(--ss-surface-2);
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .ss-data-label {
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.12em;
          color: var(--ss-text-dim);
          text-transform: uppercase;
        }

        .ss-data-value {
          font-family: var(--ss-mono);
          font-size: 16px;
          font-weight: 600;
          color: var(--ss-text);
          line-height: 1.2;
        }

        /* Probability bars */
        .ss-panel {
          background: var(--ss-surface);
          border: 1px solid var(--ss-border-mid);
          border-radius: var(--ss-radius);
          padding: 18px;
        }

        .ss-panel-title {
          font-family: var(--ss-display);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          color: var(--ss-text-dim);
          text-transform: uppercase;
          margin-bottom: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .ss-panel-title-accent {
          width: 8px;
          height: 8px;
          border-radius: 1px;
          background: var(--ss-verdict-accent);
          flex-shrink: 0;
        }

        .ss-prob-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 5px 0;
        }

        .ss-prob-label {
          font-family: var(--ss-display);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--ss-text-mid);
          width: 52px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .ss-best-tag {
          font-size: 8px;
          background: var(--ss-verdict-accent);
          color: #070c14;
          padding: 1px 4px;
          border-radius: 2px;
          font-weight: 700;
          letter-spacing: 0.05em;
        }

        .ss-prob-track {
          flex: 1;
          height: 8px;
          background: rgba(255,255,255,0.05);
          border-radius: 2px;
          position: relative;
          overflow: visible;
        }

        .ss-prob-fill {
          height: 100%;
          border-radius: 2px;
          transition: width 0.8s cubic-bezier(0.25, 1, 0.5, 1);
        }

        .ss-prob-fair-marker {
          position: absolute;
          top: -3px;
          width: 2px;
          height: 14px;
          background: rgba(255,255,255,0.35);
          border-radius: 1px;
          transform: translateX(-50%);
          z-index: 2;
        }

        .ss-prob-pct {
          font-family: var(--ss-mono);
          font-size: 12px;
          font-weight: 600;
          width: 42px;
          text-align: right;
          flex-shrink: 0;
        }

        /* Fair market note */
        .ss-fair-note {
          font-size: 9px;
          color: var(--ss-text-dim);
          margin-top: 8px;
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .ss-fair-note::before {
          content: '';
          display: inline-block;
          width: 8px;
          height: 2px;
          background: rgba(255,255,255,0.35);
          flex-shrink: 0;
        }

        /* Outcome table */
        .ss-outcome-table {
          width: 100%;
          font-family: var(--ss-mono);
          font-size: 11px;
        }

        .ss-outcome-header {
          display: grid;
          grid-template-columns: 80px 1fr 1fr 1fr 1fr 1fr;
          gap: 4px;
          padding: 6px 10px;
          background: rgba(255,255,255,0.03);
          border-radius: 4px 4px 0 0;
          color: var(--ss-text-dim);
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-bottom: 1px;
        }

        .ss-outcome-row {
          display: grid;
          grid-template-columns: 80px 1fr 1fr 1fr 1fr 1fr;
          gap: 4px;
          padding: 9px 10px;
          background: rgba(255,255,255,0.02);
          border-radius: 2px;
          transition: background 0.15s;
          margin-bottom: 1px;
        }

        .ss-outcome-market {
          font-weight: 600;
          letter-spacing: 0.05em;
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .ss-micro-badge {
          display: inline-block;
          width: 7px;
          height: 7px;
          margin-left: 6px;
          border-radius: 999px;
          background: currentColor;
          box-shadow: 0 0 10px currentColor;
          vertical-align: middle;
        }

        .ss-mono {
          font-family: var(--ss-mono);
          font-size: 11px;
        }

        /* Evidence lists */
        .ss-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .ss-list-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          font-size: 11px;
          color: var(--ss-text-mid);
          line-height: 1.45;
        }

        .ss-list-bullet {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          flex-shrink: 0;
          margin-top: 4px;
        }

        /* Data gaps */
        .ss-gaps {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .ss-gap-badge {
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.08em;
          color: #cc44ff;
          background: rgba(204,68,255,0.08);
          border: 1px solid rgba(204,68,255,0.2);
          padding: 3px 7px;
          border-radius: 3px;
          text-transform: uppercase;
        }

        /* Audit */
        .ss-audit-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 1px;
          background: var(--ss-border);
          border-radius: 4px;
          overflow: hidden;
        }

        .ss-audit-cell {
          background: var(--ss-surface-2);
          padding: 10px 12px;
        }

        .ss-audit-label {
          font-size: 8px;
          font-weight: 600;
          letter-spacing: 0.1em;
          color: var(--ss-text-dim);
          text-transform: uppercase;
          margin-bottom: 3px;
        }

        .ss-audit-value {
          font-family: var(--ss-mono);
          font-size: 12px;
          color: var(--ss-text);
        }

        /* Narrative */
        .ss-narrative {
          background: rgba(255,255,255,0.02);
          border-left: 2px solid var(--ss-verdict-accent);
          padding: 12px 14px;
          border-radius: 0 4px 4px 0;
          font-size: 11px;
          color: var(--ss-text-mid);
          line-height: 1.6;
        }

        /* Explanation */
        .ss-explanation {
          background: rgba(255,255,255,0.02);
          border-radius: 4px;
          padding: 12px 14px;
          font-size: 11px;
          color: var(--ss-text-mid);
          line-height: 1.6;
        }

        /* Responsible gambling */
        .ss-rg-banner {
          background: rgba(255,170,0,0.04);
          border: 1px solid rgba(255,170,0,0.15);
          border-radius: 4px;
          padding: 12px 14px;
          font-size: 10px;
          color: var(--ss-text-dim);
          line-height: 1.6;
          display: flex;
          gap: 10px;
          align-items: flex-start;
        }

        .ss-rg-icon {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
          margin-top: 1px;
        }

        .ss-rg-icon svg {
          width: 16px;
          height: 16px;
        }

        /* Layout */
        .ss-two-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .ss-three-col {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 16px;
        }

        @media (max-width: 640px) {
          .ss-grid-2, .ss-grid-3, .ss-grid-4,
          .ss-two-col, .ss-three-col {
            grid-template-columns: 1fr;
          }
          .ss-match-name { font-size: 20px; }
          .ss-verdict-chip { font-size: 20px; }
          .ss-outcome-header, .ss-outcome-row {
            grid-template-columns: 60px 1fr 1fr 1fr;
          }
          .ss-outcome-header span:nth-child(5),
          .ss-outcome-header span:nth-child(6),
          .ss-outcome-row span:nth-child(5),
          .ss-outcome-row span:nth-child(6) {
            display: none;
          }
        }
      `}</style>

      <div className="ss-root">
        {/* Header */}
        <header className="ss-header">
          <div className="ss-logo">
            Sabi<span>Score</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <span className="ss-engine-badge">
              <span className="ss-engine-dot" />
              CORE ENGINE v1.1.0
            </span>
            <span className="ss-header-meta">
              Zero-fabrication - Fail-closed - De-vigged edge
            </span>
          </div>
        </header>

        <main className="ss-main">

          {/* Input Form */}
          <div className="ss-form-card">
            <div className="ss-form-title">Match Analysis Input</div>

            <div className="ss-section-label">Teams & Competition</div>
            <div className="ss-grid-3" style={{ marginBottom: 12 }}>
              <div className="ss-field">
                <label className="ss-label">Home Team</label>
                <input
                  className="ss-input"
                  placeholder="Arsenal"
                  value={form.homeTeam}
                  onChange={(e) => setForm((f) => ({ ...f, homeTeam: e.target.value }))}
                />
              </div>
              <div className="ss-field">
                <label className="ss-label">Away Team</label>
                <input
                  className="ss-input"
                  placeholder="Chelsea"
                  value={form.awayTeam}
                  onChange={(e) => setForm((f) => ({ ...f, awayTeam: e.target.value }))}
                />
              </div>
              <div className="ss-field">
                <label className="ss-label">Competition</label>
                <select
                  className="ss-select"
                  value={form.competition}
                  onChange={(e) => setForm((f) => ({ ...f, competition: e.target.value }))}
                >
                  {["EPL","LA_LIGA","SERIE_A","BUNDESLIGA","LIGUE_1","EREDIVISIE","UCL"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="ss-section-label">Market Odds (decimal)</div>
            <div className="ss-grid-3" style={{ marginBottom: 12 }}>
              {([
                { key: "homeOdds", label: "Home Win" },
                { key: "drawOdds", label: "Draw" },
                { key: "awayOdds", label: "Away Win" },
              ] as Array<{ key: FormTextKey; label: string }>).map(({ key, label }) => (
                <div key={key} className="ss-field">
                  <label className="ss-label">{label}</label>
                  <input
                    className="ss-input"
                    type="number"
                    min="1.01"
                    step="0.01"
                    placeholder="e.g. 1.87"
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>

            <div className="ss-section-label">Model Probabilities (%)</div>
            <div className="ss-grid-4" style={{ marginBottom: 12 }}>
              {([
                { key: "homeProb", label: "Home Win" },
                { key: "drawProb", label: "Draw" },
                { key: "awayProb", label: "Away Win" },
              ] as Array<{ key: FormTextKey; label: string }>).map(({ key, label }) => (
                <div key={key} className="ss-field">
                  <label className="ss-label">{label}</label>
                  <input
                    className="ss-input"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder="e.g. 54.0"
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="ss-field">
                <label className="ss-label">Model Version</label>
                <input
                  className="ss-input"
                  placeholder="sabiscore-v3.1"
                  value={form.modelVersion}
                  onChange={(e) => setForm((f) => ({ ...f, modelVersion: e.target.value }))}
                />
              </div>
            </div>

            <label className="ss-checkbox-row">
              <input
                type="checkbox"
                checked={form.calibrationValidated}
                onChange={(e) => setForm((f) => ({ ...f, calibrationValidated: e.target.checked }))}
              />
              Calibration validated
            </label>

            {policy && (
              <div style={{ marginTop: 10, fontSize: 9, color: "var(--ss-text-dim)", display: "flex", gap: 14, flexWrap: "wrap" }}>
                <span>MIN EDGE: {policy.min_actionable_edge_pp.toFixed(1)}pp</span>
                <span>KELLY: {(policy.kelly_fraction * 100).toFixed(0)}%</span>
                <span>MAX STAKE: {(policy.max_kelly_cap * 100).toFixed(1)}%</span>
              </div>
            )}

            <button
              className="ss-analyze-btn"
              onClick={handleAnalyze}
              disabled={loading || !form.homeTeam || !form.awayTeam}
            >
              {loading ? "ANALYZING..." : "ANALYZE MATCH"}
            </button>

            {error && (
              <div className="ss-error">
                <AlertTriangle aria-hidden="true" className="ss-error-icon" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Loading */}
          {loading && (
            <div className="ss-loading">
              <div className="ss-spinner" />
              <div className="ss-loading-text">Running engine - validating evidence - computing de-vigged edge</div>
            </div>
          )}

          {/* Result */}
          {result && cfg && mounted && (
            <div
              ref={resultRef}
              className="ss-result"
              style={
                {
                  "--ss-verdict-accent": cfg.color,
                } as React.CSSProperties
              }
            >
              {/* Verdict hero */}
              <div
                className="ss-verdict-card"
                style={{
                  background: cfg.bg,
                  border: `1px solid ${cfg.border}`,
                  boxShadow: cfg.glow,
                }}
              >
                <div className="ss-verdict-top">
                  <div className="ss-verdict-label-group">
                    <div className="ss-match-name">
                      {result.match_identifier}
                    </div>
                    <div className="ss-match-meta">
                      <span className="ss-comp-badge">{result.competition}</span>
                      {result.kickoff_utc && (
                        <span className="ss-kickoff">
                          KO in {timeUntil(result.kickoff_utc)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="ss-verdict-right">
                    <div
                      className="ss-verdict-chip"
                      style={{
                        color: cfg.color,
                        background: `${cfg.color}18`,
                        border: `1px solid ${cfg.border}`,
                      }}
                    >
                      {cfg.label}
                    </div>
                    <div
                      className="ss-action-chip"
                      style={{
                        color: cfg.color,
                        borderColor: cfg.border,
                        background: `${cfg.color}10`,
                      }}
                    >
                      {cfg.action}
                    </div>
                  </div>
                </div>
                <div className="ss-verdict-desc">{cfg.desc}</div>

                {/* Key metrics grid */}
                <div className="ss-data-grid">
                  <DataTag
                    label="Edge (de-vigged)"
                    value={result.edge_percentage_points != null
                      ? pp(result.edge_percentage_points / 100)
                      : "-"}
                    accent={result.edge != null && result.edge > 0 ? "#00ff88" : "#ff4455"}
                    mono
                  />
                  <DataTag
                    label="Expected Value"
                    value={ev(result.expected_value)}
                    accent={result.expected_value != null && result.expected_value > 0 ? "#00ff88" : "#ff4455"}
                    mono
                  />
                  <DataTag
                    label="Best Market"
                    value={result.best_market?.replace("_ML", "") ?? "-"}
                    accent={cfg.color}
                    mono
                  />
                  <DataTag
                    label="Market Odds"
                    value={odds(result.market_odds)}
                    mono
                  />
                  <DataTag
                    label="Min Acceptable Odds"
                    value={odds(result.minimum_acceptable_odds)}
                    accent={result.minimum_acceptable_odds ? "#ffaa00" : undefined}
                    mono
                  />
                  <DataTag
                    label="Stake Fraction"
                    value={stake(result.stake_fraction, result.stake)}
                    accent={result.stake_fraction > 0 ? cfg.color : "#ff4455"}
                    mono
                  />
                  <DataTag
                    label="Confidence"
                    value={result.confidence ?? "-"}
                    accent={
                      result.confidence === "HIGH" ? "#00ff88"
                        : result.confidence === "MEDIUM" ? "#ffaa00"
                        : "#ff4455"
                    }
                  />
                  <DataTag
                    label="Freshness"
                    value={result.data_freshness?.status ?? "-"}
                    accent={
                      FRESHNESS_CONFIG[
                        result.data_freshness?.status ?? "DATA_GAP"
                      ]?.color
                    }
                  />
                </div>
              </div>

              {/* Explanation */}
              {result.explanation && (
                <div className="ss-panel">
                  <div className="ss-panel-title">
                    <div className="ss-panel-title-accent" />
                    Engine Explanation
                  </div>
                  <div className="ss-explanation">{result.explanation}</div>
                </div>
              )}

              {/* Probability + outcome tables */}
              <div className="ss-two-col">
                {/* Prob bars */}
                <div className="ss-panel">
                  <div className="ss-panel-title">
                    <div className="ss-panel-title-accent" />
                    Probability Distribution
                  </div>
                  {result.probabilities ? (
                    <>
                      {[
                        {
                          label: "HOME",
                          prob: result.probabilities.home,
                          fairProb: result.calculation_audit?.fair_market_home,
                          isBest: result.best_market === "HOME_ML",
                        },
                        {
                          label: "DRAW",
                          prob: result.probabilities.draw,
                          fairProb: result.calculation_audit?.fair_market_draw,
                          isBest: result.best_market === "DRAW_ML",
                        },
                        {
                          label: "AWAY",
                          prob: result.probabilities.away,
                          fairProb: result.calculation_audit?.fair_market_away,
                          isBest: result.best_market === "AWAY_ML",
                        },
                      ].map((row) => (
                        <ProbBar
                          key={row.label}
                          label={row.label}
                          prob={row.prob}
                          fairProb={row.fairProb}
                          accent={cfg.color}
                          isBest={row.isBest}
                        />
                      ))}
                      <div className="ss-fair-note">
                        White bar = de-vigged fair market probability
                      </div>
                      {result.calculation_audit?.market_overround != null && (
                        <div style={{ fontSize: 9, color: "var(--ss-text-dim)", marginTop: 8 }}>
                          Market overround: {(result.calculation_audit.market_overround * 100 - 100).toFixed(2)}%
                          - Bookmaker: {result.calculation_audit.bookmaker ?? "-"}
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ color: "var(--ss-text-dim)", fontSize: 11 }}>
                      Model probabilities unavailable (DATA_GAP)
                    </div>
                  )}
                </div>

                {/* All outcomes */}
                {result.all_market_evaluations && result.all_market_evaluations.length > 0 ? (
                  <div className="ss-panel">
                    <div className="ss-panel-title">
                      <div className="ss-panel-title-accent" />
                      All Outcome Evaluations
                    </div>
                    <OutcomeTable
                      evaluations={result.all_market_evaluations}
                      accent={cfg.color}
                    />
                    <div style={{ fontSize: 9, color: "var(--ss-text-dim)", marginTop: 8 }}>
                      Edge = model probability - de-vigged fair market probability
                    </div>
                  </div>
                ) : (
                  <div className="ss-panel">
                    <div className="ss-panel-title">
                      <div className="ss-panel-title-accent" />
                      Market Unavailable
                    </div>
                    <div style={{ color: "var(--ss-text-dim)", fontSize: 11 }}>
                      No valid market snapshot. Provide real decimal odds from one bookmaker snapshot.
                    </div>
                  </div>
                )}
              </div>

              {/* Evidence and risks */}
              <div className="ss-two-col">
                <div className="ss-panel">
                  <div className="ss-panel-title">
                    <div className="ss-panel-title-accent" style={{ background: "#00ff88" }} />
                    Signal Drivers
                  </div>
                  {result.drivers.length > 0 ? (
                    <ul className="ss-list">
                      {result.drivers.map((d, i) => (
                        <li key={i} className="ss-list-item">
                          <span className="ss-list-bullet" style={{ background: "#00ff88" }} />
                          {d}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div style={{ color: "var(--ss-text-dim)", fontSize: 11 }}>No active drivers verified.</div>
                  )}
                </div>

                <div className="ss-panel">
                  <div className="ss-panel-title">
                    <div className="ss-panel-title-accent" style={{ background: "#ffaa00" }} />
                    Risks
                  </div>
                  {result.risks.length > 0 ? (
                    <ul className="ss-list">
                      {result.risks.map((r, i) => (
                        <li key={i} className="ss-list-item">
                          <span className="ss-list-bullet" style={{ background: "#ffaa00" }} />
                          {r}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div style={{ color: "var(--ss-text-dim)", fontSize: 11 }}>No known risks specified.</div>
                  )}
                </div>
              </div>

              {/* Invalidation conditions */}
              {result.invalidation_conditions.length > 0 && (
                <div className="ss-panel">
                  <div className="ss-panel-title">
                    <div className="ss-panel-title-accent" style={{ background: "#ff4455" }} />
                    Invalidation Conditions
                  </div>
                  <ul className="ss-list">
                    {result.invalidation_conditions.map((c, i) => (
                      <li key={i} className="ss-list-item">
                        <span className="ss-list-bullet" style={{ background: "#ff4455" }} />
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Data gaps */}
              {result.data_gaps.length > 0 && (
                <div className="ss-panel">
                  <div className="ss-panel-title">
                    <div className="ss-panel-title-accent" style={{ background: "#cc44ff" }} />
                    Data Gaps ({result.data_gaps.length})
                  </div>
                  <div className="ss-gaps">
                    {result.data_gaps.map((g, i) => (
                      <GapBadge key={i} gap={g} />
                    ))}
                  </div>
                </div>
              )}

              {/* Calculation audit */}
              {result.calculation_audit && (
                <div className="ss-panel">
                  <div className="ss-panel-title">
                    <div className="ss-panel-title-accent" />
                    Calculation Audit
                  </div>
                  <div className="ss-audit-grid">
                    <div className="ss-audit-cell">
                      <div className="ss-audit-label">Calibration</div>
                      <div className="ss-audit-value">{result.calculation_audit.calibration_method ?? "-"}</div>
                    </div>
                    <div className="ss-audit-cell">
                      <div className="ss-audit-label">Model Version</div>
                      <div className="ss-audit-value">{result.calculation_audit.model_version ?? "-"}</div>
                    </div>
                    <div className="ss-audit-cell">
                      <div className="ss-audit-label">Kelly Fraction</div>
                      <div className="ss-audit-value">{(result.calculation_audit.kelly_fraction * 100).toFixed(0)}% (1/{Math.round(1/result.calculation_audit.kelly_fraction)})</div>
                    </div>
                    <div className="ss-audit-cell">
                      <div className="ss-audit-label">Max Stake Cap</div>
                      <div className="ss-audit-value">{(result.calculation_audit.kelly_cap * 100).toFixed(1)}%</div>
                    </div>
                    <div className="ss-audit-cell">
                      <div className="ss-audit-label">Overround</div>
                      <div className="ss-audit-value">
                        {result.calculation_audit.market_overround != null
                          ? `${(result.calculation_audit.market_overround * 100).toFixed(2)}%`
                          : "-"}
                      </div>
                    </div>
                    <div className="ss-audit-cell">
                      <div className="ss-audit-label">Bookmaker</div>
                      <div className="ss-audit-value">{result.calculation_audit.bookmaker ?? "-"}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Responsible gambling */}
              <div className="ss-rg-banner">
                <span className="ss-rg-icon" aria-hidden="true">
                  <AlertTriangle />
                </span>
                <span>
                  <strong>Betting involves risk of financial loss.</strong>{" "}
                  This tool provides statistical analysis only - not financial advice or guaranteed returns.
                  Never bet more than you can afford to lose. Edge calculations are estimates based on model inputs
                  and are subject to error. If gambling is affecting you negatively, contact{" "}
                  <strong>GamCare: 0808 8020 133</strong> or{" "}
                  <strong>BeGambleAware.org</strong>.
                </span>
              </div>

            </div>
          )}
        </main>
      </div>
    </>
  );
}

export default memo(BettingIntelligenceDashboard);
