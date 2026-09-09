# Portfolio C — Weather: venue-location qualification (Gate G1)

**Date:** 2026-09-09
**Directive:** `docs/PRODUCTION_EXECUTIVE_DIRECTIVE.md` v5, Phase 2 / Gate R1, Gates G1–G6
**Ledger item:** `docs/DEBT.md` item 44, prerequisite (1)
**Decision:** **HOLD** — automated derivation resolves 68.9% of the corpus; the
remainder needs a human-reviewed place-name assertion that this study must not
invent.

---

## 1. The question this answers

`docs/DEBT.md` item 44 ships Open-Meteo acquisition, live-verifies it, and then
gates the feature work behind three prerequisites. The first is the blocker:

> A team → location mapping with a review step. Geocoding is derived, not
> invented, but it is still a guess for clubs whose name is not their city
> (Bayer Leverkusen, Hoffenheim, Atalanta). It needs the same
> `VERIFIED`/`REQUIRES_REVIEW` treatment as team identity, not silent
> acceptance.

Item 44 also rejected the obvious shortcut, and that rejection is the premise of
this study:

> Hand-entered or model-recalled coordinates are invented reference data, and
> wrong ones produce *confidently wrong* weather, which is worse than no
> weather.

So the question is narrow and measurable: **starting only from text the clubs
call themselves, how much of the training corpus can be located at all?**

This is Gate G1 (fixture coverage) and Gate G5 (prediction-time availability)
asked before any backfill, per Rule 2 — data acquisition is itself an
experiment, and a 12,765-row archive backfill is not something to start and then
discover is 31% empty.

---

## 2. Method

`backend/scripts/qualify_venue_locations.py`, run over the exact roster a
weather backfill would have to cover: every distinct club in
`backend/data/cache/fd_*.csv` — **160 clubs across 12,765 matches**, the corpus
the models actually train on.

For each club:

1. **Derive query terms.** The folded full name, then each of its own tokens of
   four characters or more. Nothing is recalled from memory. A wrong answer is
   therefore a wrong *derivation* an operator can audit, never an invented
   coordinate.
2. **Geocode each term, constrained to the league's own country** via
   Open-Meteo's keyless geocoding endpoint.
3. **Classify** onto the identity taxonomy `providers/reconciliation.py` already
   uses for team identity:

| Verdict | Rule |
| --- | --- |
| `VERIFIED` | Some resolved place's name appears verbatim in the club's own name, and all such places fall inside one weather grid cell (25 km). |
| `REQUIRES_REVIEW` | A place resolved, but the club's name does not name it — or two places the club *does* name disagree by more than one cell. |
| `UNKNOWN` | Nothing resolved inside the club's country. |

`VERIFIED` is a deliberately narrow claim: it means *the club's own name
contains a place that geocodes uniquely inside its own country*, not *the club
plays there*. Those coincide for most European clubs and not for all, which is
why the remaining step is a human review rather than an automatic promotion.

Classifier behaviour is pinned by `backend/tests/unit/test_venue_location_qualification.py`
(19 tests). Each guard was watched failing on a reverted rule before being
trusted.

---

## 3. Result

Full per-club evidence — every query attempted and every candidate returned —
is in `reports/research/portfolio-c-venue-location-manifest.json`.

**By club (n=160):**

| Verdict | Clubs | Share |
| --- | ---: | ---: |
| `VERIFIED` | 116 | 72.5% |
| `REQUIRES_REVIEW` | 17 | 10.6% |
| `UNKNOWN` | 27 | 16.9% |

**By match (n=12,765)** — the number that governs a backfill, since a match
needs only its *home* venue:

| Verdict | Matches | Share |
| --- | ---: | ---: |
| `VERIFIED` | 8,799 | **68.9%** |
| `REQUIRES_REVIEW` | 1,718 | 13.5% |
| `UNKNOWN` | 2,248 | 17.6% |

**By league — this is the finding that decides the verdict:**

| League | Matches | `VERIFIED` | `REQUIRES_REVIEW` | `UNKNOWN` |
| --- | ---: | ---: | ---: | ---: |
| Ligue 1 | 2,337 | 89.5% | 2.4% | 8.2% |
| EPL | 2,660 | 76.4% | 13.6% | 10.0% |
| Bundesliga | 2,142 | 73.8% | 26.2% | 0.0% |
| Eredivisie | 306 | 61.1% | 0.0% | 38.9% |
| Serie A | 2,660 | 55.7% | 12.1% | 32.1% |
| La Liga | 2,660 | 53.6% | 15.7% | 30.7% |

---

## 4. What the failures actually are

The classifier's refusals are the most informative part of the run, because
each one is a coordinate a naive top-hit geocoder would have accepted.

**`Wolves` → "Wolvesnewton" (51.69, −2.79).** A hamlet in Monmouthshire, Wales,
roughly 150 km from Wolverhampton. It resolved inside the correct country, it
was the top hit, and it is wrong. The name-match rule caught it only because
"Wolvesnewton" is not a token of "Wolves". **This single case is the study's
justification**: it is exactly the "confidently wrong weather" item 44 predicted,
produced on the first attempt, by the obvious implementation.

**`Monaco` → nothing.** AS Monaco plays in Ligue 1, so the country filter asked
for France; the club is in Monaco (`MC`). The filter correctly refused rather
than placing the fixture somewhere in France that merely shares the name. This
is the fail-closed direction working.

**`Torino` → "Turin", `Sevilla` → "Seville", `Napoli` → "Napoli-Nola".** The
geocoder answers with the English exonym, which cannot match the club's own
name, so all three go to review. Napoli-Nola is a genuinely different place ~25 km
from Naples, so this is not merely a spelling nuisance.

**`Inter`, `Juventus`, `Ajax`, `Chelsea`, `Atalanta`, `Arsenal` → nothing.**
Clubs whose names contain no place at all. Nothing in the corpus states where
they play. This is the honest answer, and it is the bulk of the 27 `UNKNOWN`.

**`Bayern Munich`, `Real Madrid`, `Werder Bremen`, `West Brom` → two cells
apart.** Both a region and a city resolve, and both are named in the club
("Bayern" is Bavaria's centroid, ~90 km from Munich). Neither can be dismissed
as noise, so the disagreement belongs to a human.

---

## 5. Gate assessment

| Gate | Verdict | Basis |
| --- | --- | --- |
| **G1 — fixture coverage** | **FAIL** | 68.9% of corpus matches have a derivable home venue. 31.1% do not. |
| **G2 — historical depth** | PASS | Open-Meteo's archive reaches 1940; the corpus starts 2019. |
| **G3 — cross-season stability** | PASS | Reanalysis is stable by construction; no in-season revision risk. |
| **G4 — cross-league portability** | **FAIL** | 89.5% (Ligue 1) to 53.6% (La Liga) is a 36-point spread. |
| **G5 — prediction-time availability** | PASS | 16-day forecast horizon covers every fixture in the sync window; `MatchWeather.source` distinguishes archive from forecast so the two can never be silently interchanged. |
| **G6 — default rate** | **FAIL** | A missing reading may not be default-filled (Rule 5), so 31.1% of rows would carry a data gap — and the gap is league-correlated, not random. |

G4 and G6 fail together, and they fail for the same reason: the missing 31% is
concentrated in Serie A and La Liga. A model trained on this would learn a
feature that is systematically present for French fixtures and systematically
absent for Spanish ones — a league artifact wearing a weather label. That is the
train/serve skew shape that forced the vΩ.46 retrain, arriving from a new
direction.

---

## 6. Decision — HOLD

**Not `REJECT`.** Nothing here says weather lacks predictive information. The
question was never asked, because the corpus cannot yet be located well enough
to ask it. Rejecting on this evidence would be recording a negative result the
study did not produce.

**Not `RESEARCH`.** The next step is not more analysis. It is a bounded data
assertion — 44 clubs — that this study is specifically forbidden from making on
its own.

**`HOLD`, with a precisely scoped unblock.** 44 clubs (17 `REQUIRES_REVIEW` +
27 `UNKNOWN`) need a reviewed place name. Every one is enumerated in the
manifest with the queries attempted and the candidates returned, so the review
is a confirmation task against real evidence rather than a recall exercise.

### The shape the unblock must take

The operator asserts a **place name**, never a coordinate — for example
`Inter → "Milano"`. The geocoder still derives the latitude and longitude from
that name, so no coordinate is ever hand-entered and every stored position stays
reproducible from an auditable input. This is the same structure
`team_identity._AUDITED_ALIASES` already uses for corpus spellings, and the same
reason it uses it.

No such table is created by this change. An empty table nothing populates is
scaffolding, and whether these 44 reviews are worth doing depends on a question
still unanswered: whether weather carries incremental information at all. That
is Stage 3, and it cannot run until G1 passes.

### Sequence once the 44 are reviewed

1. Re-run this script; confirm G1 and G4 pass at the reviewed roster.
2. Item 44 prerequisite (2) — backfill the corpus, persisted so training is
   reproducible rather than re-fetched.
3. Item 44 prerequisite (3) — the archive/forecast parity check.
4. Only then Stage 3: does weather improve out-of-sample RPS against the
   incumbent, per league, with the uncertainty Rule 9 requires.

Weather remains an **advisory** gap throughout, never critical: the trust tier
is `OPEN_DATA` and Open-Meteo is not a football source.

---

## 7. What this change does and does not touch

Read-only throughout. No feature vector, no schema version, no artifact, no
database, no serving path. `temperature` / `precipitation` / `wind_speed` /
`weather_impact_score` exist in `FeatureTransformer`'s legacy `FEATURE_DEFAULTS`
but appear in **none** of `CANONICAL_FEATURES_68`, `CANONICAL_FEATURES_58` or
`APEX_FEATURES_68` — verified directly this session. They are computed and
discarded before the feature vector, so no fabricated weather constant reaches a
model today. That is the same dead-legacy shape Portfolio B found in
`_add_injury_features`, and it is left exactly as it is.
