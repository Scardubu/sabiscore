#!/usr/bin/env python3
"""Align the evidence meter with the certified provider registry."""

from pathlib import Path

root = Path(__file__).resolve().parents[1]
path = root / "apps/web/src/components/betting-intelligence-dashboard.tsx"
text = path.read_text(encoding="utf-8")

old_block = '''const EVIDENCE_PROVIDERS = ["ESPN", "FBRef", "SofaScore", "Understat", "Transfermarkt"] as const;

function ProviderEvidenceMeter({ evidence }: { evidence: FixtureEvidenceResponse | null }) {
  const rows = evidence?.retrieval_timeline ?? [];
  const findProvider = (provider: string) => rows.find((row) => {
    const source = String(row.source ?? row.provider ?? "").toLowerCase();
    return source.includes(provider.toLowerCase());
  });
'''
new_block = '''const EVIDENCE_PROVIDERS = [
  { key: "FOOTBALL_DATA_ORG", label: "football-data.org" },
  { key: "API_FOOTBALL", label: "API-Football" },
  { key: "SPORTMONKS", label: "Sportmonks" },
  { key: "THE_ODDS_API", label: "The Odds API" },
  { key: "ESPN", label: "ESPN · supplementary" },
] as const;

function ProviderEvidenceMeter({ evidence }: { evidence: FixtureEvidenceResponse | null }) {
  const rows = evidence?.provider_evidence ?? evidence?.retrieval_timeline ?? [];
  const findProvider = (providerKey: string) => rows.find((row) => {
    const source = String(row.source ?? row.provider ?? "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_");
    return source.includes(providerKey);
  });
'''
if text.count(old_block) != 1:
    raise RuntimeError(f"provider meter header: expected one match, found {text.count(old_block)}")
text = text.replace(old_block, new_block, 1)

old_map = '''        {EVIDENCE_PROVIDERS.map((provider) => {
          const row = findProvider(provider);
          const status = String(row?.status ?? "UNAVAILABLE").toUpperCase();
          const timestamp = typeof row?.timestamp === "string" ? row.timestamp : null;
          return (
            <div className="bi-provider" key={provider}>
              <span className={`bi-dot ${status.toLowerCase()}`} aria-hidden="true" />
              <div>
                <strong>{provider}</strong>
                <small>{status.replaceAll("_", " ")}{timestamp ? ` · ${fmtDate(timestamp)}` : ""}</small>
              </div>
            </div>
          );
        })}
'''
new_map = '''        {EVIDENCE_PROVIDERS.map(({ key, label }) => {
          const row = findProvider(key);
          const status = String(row?.status ?? "UNAVAILABLE").toUpperCase();
          const timestamp = typeof row?.timestamp === "string" ? row.timestamp : null;
          return (
            <div className="bi-provider" key={key}>
              <span className={`bi-dot ${status.toLowerCase()}`} aria-hidden="true" />
              <div>
                <strong>{label}</strong>
                <small>{status.replaceAll("_", " ")}{timestamp ? ` · ${fmtDate(timestamp)}` : ""}</small>
              </div>
            </div>
          );
        })}
'''
if text.count(old_map) != 1:
    raise RuntimeError(f"provider meter map: expected one match, found {text.count(old_map)}")
text = text.replace(old_map, new_map, 1)
path.write_text(text, encoding="utf-8")
Path(__file__).unlink(missing_ok=True)
