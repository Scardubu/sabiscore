---
name: sabiscore-portfolio-staking-architect
description: >
  Designs and audits SabiScore's portfolio-level staking strategy —
  exposure aggregation across concurrent open positions, correlated-fixture
  risk (same league/matchday), and bankroll drawdown limits, distinct from
  the single-bet Quarter-Kelly sizing already governed by
  sabiscore-betting-engine-auditor. Enforces that SPECULATIVE watchlist
  entries receive zero real stake by construction — paper/shadow only —
  matching the promotion ladder. Tracks closing line value (CLV) as the
  leading edge-quality indicator since settlement lags. Hard boundary:
  advisory sizing recommendations only, never automated bet execution —
  already explicitly rejected for this platform. Zero-fabrication on
  ROI/yield: never report a figure not derived from actual settled
  position history. Triggers: "portfolio staking", "bankroll allocation",
  "exposure cap", "correlated bets", "drawdown limit", "closing line
  value", "CLV tracking", "stake sizing across fixtures", "portfolio
  Kelly", "aggregate exposure", "automated bet execution".
argument-hint: "[target: exposure_cap | correlation | drawdown | clv_tracking | full_portfolio]"
allowed-tools: Read, Grep, Bash(grep -n:*), Bash(python -m pytest:*)
user-invocable: true
---

# SabiScore Portfolio & Staking Architect

## Purpose

`sabiscore-betting-engine-auditor` governs the size of a single bet
(Quarter-Kelly, EV formula, verdict gates). It does not govern what happens
when five `HIGH_CONVICTION` picks land on the same matchday, three of them in
the same league, and the naive per-bet sizing would happily stake all five at
full Quarter-Kelly as if they were independent. This skill owns the layer
above individual bet sizing: the portfolio.

Use this skill for anything about aggregate exposure, correlation between
open positions, drawdown response, or measuring edge quality before
settlement data exists (CLV). Defer to the betting-engine-auditor skill for
anything about a single bet's Kelly/EV calculation — don't reimplement that
here, compose with it.

## Hard boundary: advisory only, never execution

This skill produces staking *recommendations* — sizes, caps, pause signals.
It does not design, wire, or discuss automated bet placement/execution
against any sportsbook or exchange. That scope was explicitly rejected for
this platform already; if a request drifts toward "auto-place the bet when
the verdict clears," redirect back to advisory output and flag the drift
rather than scoping it in because it seems like a natural next step.

## Correlated exposure

Two positions are correlated, not independent, when they share any of:
same league same matchday, same team across different markets, or a common
upstream data dependency likely to fail together (e.g. both sourced from a
provider currently in `PARTIAL` status). Independent per-bet Kelly sizing
assumes independence; stacking correlated bets at full independent size
understates true portfolio risk.

Workflow for any staking recommendation touching more than one open
position:
1. **Group positions by correlation class** (league/matchday, shared team,
   shared provider dependency) before sizing anything.
2. **Apply a portfolio-level cap per correlation group**, distinct from and
   tighter than the sum of independent per-bet caps. Don't invent a specific
   multiplier — if one isn't already defined in the codebase or by the
   operator, say that explicitly and propose a starting point for the
   operator to set, rather than presenting an assumed number as established
   policy.
3. **Total portfolio exposure** (sum across all open positions, all
   correlation groups) respects a top-level bankroll cap. Same rule: if
   undefined, flag it as a gap, don't fabricate a percentage.

## Watchlist stake separation

`SPECULATIVE` watchlist entries get zero real stake — this is not a sizing
decision, it's a promotion-ladder consequence. A speculative pick has not
cleared the evidence bar that would justify risking capital on it (see
`sabiscore-settlement-calibration-architect` for what that bar requires).
Any staking logic that reads a `SPECULATIVE` verdict and produces a non-zero
stake is a defect, full stop, not a tuning parameter.

## Drawdown response

Define (or, if undefined, explicitly flag as missing) a drawdown threshold
that pauses new staking recommendations — this is a circuit breaker, not a
suggestion. Do not assume a specific percentage (e.g. "pause at -20%") without
it being an operator-set value; propose it as a decision to make, not a
default to silently apply. Once paused, resuming requires an explicit
operator action, not an automatic timeout — a drawdown circuit breaker that
resets itself on a timer defeats its own purpose.

## Closing line value (CLV)

Settlement outcomes lag (a fixture may be days away); CLV does not — it's
measurable at bet placement by comparing the price taken against the closing
price. Track CLV per position as the leading indicator of edge quality
alongside, not instead of, the lagging Brier-score/settlement metrics from
the calibration skill. A portfolio with strong average CLV but no settled
history yet is meaningfully different from one with neither — say so plainly
rather than treating "no settlement data" as "no signal at all."

## Zero-fabrication constraint

Never report a bankroll %, drawdown figure, CLV average, or exposure number
that isn't derived from actual position/settlement records. If the data to
compute one isn't available in-session, say so instead of estimating or
extrapolating from a persona brief, advisory doc, or general betting-market
convention.

## Output contract

A response from this skill states, per recommendation: (a) which positions
were grouped into which correlation class and why, (b) the exposure cap
applied and whether it's an established policy value or a gap being flagged
for the operator to set, (c) confirmation that no SPECULATIVE-tier position
received non-zero stake, and (d) CLV data included or explicitly marked
unavailable.
