"use client";

import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Copy,
  LineChart,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CertifiedMatchAnalysis, CertifiedMarketEvaluation } from "@/lib/api";

const OUTCOME_COLORS: Record<string, string> = {
  HOME_ML: "#34d399",
  DRAW_ML: "#fbbf24",
  AWAY_ML: "#60a5fa",
};

const VERDICT_TONE: Record<CertifiedMatchAnalysis["verdict"], string> = {
  HIGH_CONVICTION: "border-emerald-400/50 bg-emerald-400/10 text-emerald-100",
  ACTIONABLE: "border-emerald-400/50 bg-emerald-400/10 text-emerald-100",
  SPECULATIVE: "border-amber-300/50 bg-amber-300/10 text-amber-100",
  HOLD: "border-sky-300/50 bg-sky-300/10 text-sky-100",
  PARTIAL: "border-violet-300/50 bg-violet-300/10 text-violet-100",
  NO_BET: "border-rose-300/50 bg-rose-300/10 text-rose-100",
};

function pct(value?: number | null, digits = 1) {
  return value == null || !Number.isFinite(value) ? "Unavailable" : `${(value * 100).toFixed(digits)}%`;
}

function pp(value?: number | null) {
  return value == null || !Number.isFinite(value) ? "Unavailable" : `${value > 0 ? "+" : ""}${value.toFixed(2)}pp`;
}

function odds(value?: number | null) {
  return value == null || !Number.isFinite(value) ? "Unavailable" : value.toFixed(2);
}

export function MatchDashboard({
  analysis,
  loading = false,
  error,
  onRefresh,
}: {
  analysis?: CertifiedMatchAnalysis | null;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}) {
  const [copiedDecisionId, setCopiedDecisionId] = useState(false);
  const probabilityRows = useMemo(() => {
    if (!analysis?.probabilities) return [];
    return [
      { label: "Home", market: "HOME_ML", probability: analysis.probabilities.home ?? 0 },
      { label: "Draw", market: "DRAW_ML", probability: analysis.probabilities.draw ?? 0 },
      { label: "Away", market: "AWAY_ML", probability: analysis.probabilities.away ?? 0 },
    ];
  }, [analysis]);

  const backendGaps = useMemo(() => {
    if (!analysis) {
      return { critical: [], advisory: [], risk: [] };
    }

    return {
      critical: [...(analysis.critical_gaps ?? []), ...(analysis.conflicts ?? [])],
      advisory: analysis.advisory_gaps ?? [],
      risk: [...analysis.risks, ...analysis.invalidation_conditions, ...analysis.data_gaps],
    };
  }, [analysis]);

  async function copyDecisionId() {
    if (!analysis?.decision_id) return;
    try {
      await navigator.clipboard.writeText(analysis.decision_id);
      setCopiedDecisionId(true);
      window.setTimeout(() => setCopiedDecisionId(false), 1600);
    } catch {
      setCopiedDecisionId(false);
    }
  }

  if (loading) {
    return (
      <section className="grid gap-4" aria-busy="true" aria-label="Loading match dashboard">
        <div className="h-32 rounded-md border border-white/10 bg-white/[0.03]" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="h-28 rounded-md border border-white/10 bg-white/[0.03]" />
          <div className="h-28 rounded-md border border-white/10 bg-white/[0.03]" />
          <div className="h-28 rounded-md border border-white/10 bg-white/[0.03]" />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-md border border-rose-300/30 bg-rose-400/10 p-4 text-rose-100" role="alert">
        <div className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          Dashboard unavailable
        </div>
        <p className="mt-2 text-sm text-rose-100/80">{error}</p>
      </section>
    );
  }

  if (!analysis) {
    return (
      <section className="rounded-md border border-white/10 bg-white/[0.03] p-6">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
          <ShieldCheck className="h-5 w-5 text-emerald-300" aria-hidden="true" />
          Awaiting certified analysis
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
          Select a fixture and request backend analysis to populate probabilities, de-vigged market value,
          expected value, and Kelly sizing. The browser does not calculate official decisions.
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-4" aria-label={`Analysis dashboard for ${analysis.match_identifier}`}>
      <div className={`rounded-md border p-4 ${VERDICT_TONE[analysis.verdict]}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Decision</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">{analysis.verdict.replace(/_/g, " ")}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 opacity-90">{analysis.explanation}</p>
          </div>
          <div className="grid min-w-[220px] gap-2 text-sm">
            <Metric label="Match" value={analysis.match_identifier} />
            <Metric label="Stake" value={analysis.stake} />
            <Metric
              label="Decision ID"
              value={analysis.decision_id ?? "Unavailable"}
              action={
                analysis.decision_id ? (
                  <button
                    type="button"
                    onClick={copyDecisionId}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 text-slate-300 transition hover:border-emerald-300/50 hover:text-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    aria-label="Copy decision ID"
                    title="Copy decision ID"
                  >
                    {copiedDecisionId ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                    ) : (
                      <Copy className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                ) : null
              }
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <Panel title="Model Probabilities" icon={BarChart3}>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={probabilityRows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} tickFormatter={(value) => `${Math.round(Number(value) * 100)}%`} />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  formatter={(value) => pct(Number(value))}
                  contentStyle={{
                    background: "#0b1714",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 6,
                    color: "#f8fafc",
                  }}
                />
                <Bar dataKey="probability" radius={[4, 4, 0, 0]}>
                  {probabilityRows.map((row) => (
                    <Cell key={row.market} fill={OUTCOME_COLORS[row.market]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Recommended Market" icon={WalletCards}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label="Best market" value={analysis.best_market?.replace("_ML", "") ?? "Pass"} />
            <Metric label="Bookmaker odds" value={odds(analysis.market_odds)} />
            <Metric label="Fair market probability" value={pct(analysis.fair_market_probability)} />
            <Metric label="Edge" value={pp(analysis.edge_percentage_points)} />
            <Metric label="Expected value" value={analysis.expected_value == null ? "Unavailable" : analysis.expected_value.toFixed(4)} />
            <Metric label="Kelly stake" value={pct(analysis.stake_fraction)} />
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel title="All Outcome Audit" icon={LineChart}>
          <OutcomeTable rows={analysis.all_market_evaluations ?? []} />
        </Panel>

        <Panel title="Price Window" icon={CheckCircle2}>
          <div className="grid gap-3">
            <Metric label="Minimum acceptable" value={odds(analysis.minimum_acceptable_odds)} />
            <Metric label="Breakeven" value={odds(analysis.calculation_audit?.breakeven_odds)} />
            <Metric label="Target EV odds" value={odds(analysis.calculation_audit?.minimum_odds_for_target_ev)} />
            <Metric label="Edge preserving" value={odds(analysis.calculation_audit?.edge_preserving_minimum_odds)} />
            <Metric label="Market freshness" value={analysis.data_freshness?.status ?? "Unavailable"} />
          </div>
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              className="mt-4 min-h-11 rounded-md bg-emerald-400 px-4 text-sm font-semibold text-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            >
              Refresh backend analysis
            </button>
          ) : null}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <EvidenceList title="Drivers" items={analysis.drivers} empty="No verified drivers returned." />
        <EvidenceList
          title="Critical gaps"
          items={backendGaps.critical}
          empty="No blocking provider conflicts returned."
          tone="critical"
        />
        <EvidenceList
          title="Advisory gaps"
          items={backendGaps.advisory}
          empty="No advisory data gaps returned."
          tone="warning"
        />
        <EvidenceList
          title="Risks and invalidation"
          items={backendGaps.risk}
          empty="No risk or gap metadata returned."
          tone="warning"
        />
      </div>
    </section>
  );
}

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-white/10 bg-[#0b1714] p-4">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
        <Icon className="h-4 w-4 text-emerald-300" aria-hidden="true" />
        {title}
      </div>
      {children}
    </div>
  );
}

function Metric({ label, value, action }: { label: string; value: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 flex min-w-0 items-center gap-2">
        <p className="min-w-0 flex-1 break-words text-sm font-semibold text-slate-100">{value}</p>
        {action}
      </div>
    </div>
  );
}

function OutcomeTable({ rows }: { rows: CertifiedMarketEvaluation[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-400">No coherent market snapshot has been analyzed.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[720px] w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-slate-500">
          <tr className="border-b border-white/10">
            <th className="py-2 pr-3">Outcome</th>
            <th className="py-2 pr-3">Model</th>
            <th className="py-2 pr-3">Fair market</th>
            <th className="py-2 pr-3">Odds</th>
            <th className="py-2 pr-3">Edge</th>
            <th className="py-2 pr-3">EV</th>
            <th className="py-2 pr-3">Kelly</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.market_label} className="border-b border-white/5 text-slate-200">
              <td className="py-3 pr-3 font-semibold">{row.market_label.replace("_ML", "")}</td>
              <td className="py-3 pr-3">{pct(row.model_probability)}</td>
              <td className="py-3 pr-3">{pct(row.fair_market_probability)}</td>
              <td className="py-3 pr-3">{odds(row.market_odds)}</td>
              <td className="py-3 pr-3">{pp(row.edge_pct)}</td>
              <td className="py-3 pr-3">{row.expected_value.toFixed(4)}</td>
              <td className="py-3 pr-3">{pct(row.stake_fraction)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EvidenceList({
  title,
  items,
  empty,
  tone = "positive",
}: {
  title: string;
  items: string[];
  empty: string;
  tone?: "positive" | "warning" | "critical";
}) {
  const toneClass = {
    positive: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
    warning: "border-amber-300/20 bg-amber-300/10 text-amber-100",
    critical: "border-rose-300/25 bg-rose-300/10 text-rose-100",
  }[tone];

  return (
    <div className="rounded-md border border-white/10 bg-[#0b1714] p-4">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      {items.length > 0 ? (
        <ul className="mt-3 grid gap-2">
          {items.map((item) => (
            <li
              key={item}
              className={`rounded-md border px-3 py-2 text-sm ${toneClass}`}
            >
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-400">{empty}</p>
      )}
    </div>
  );
}
