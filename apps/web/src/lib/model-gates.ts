/**
 * Governed model-promotion thresholds — one owner, not a literal per surface.
 *
 * `0.21` was already written as a bare number in `api/health/route.ts` and as
 * prose on the homepage and docs page. The performance dashboard needed it a
 * fifth time to colour a real measured RPS against the gate, and this repository
 * has a documented history of exactly that shape drifting apart (duplicated
 * season tables, two divergent `completeness` formulas). Import it; don't retype it.
 *
 * Marketing prose on `page.tsx` / `docs/page.tsx` still spells the number inline —
 * that is copy, not computation, and interpolating a constant into a sentence
 * buys nothing. If the gate ever moves, grep for "0.21" as well as this symbol.
 */

/** Ranked probability score promotion threshold. Lower is better. */
export const RPS_PROMOTION_GATE = 0.21;

/** Uniform choice across a 3-outcome market — a property of the problem, not a
 *  measurement. The backend emits this alongside real series data; this constant
 *  exists only as the fallback when it has not answered yet. */
export const RANDOM_BASELINE_ACCURACY = 1 / 3;

/** True when a measured RPS meets the promotion gate. Returns null for an absent
 *  measurement so callers render "—" rather than treating unknown as a failure. */
export function meetsRpsGate(rps: number | null | undefined): boolean | null {
  return typeof rps === "number" && Number.isFinite(rps) ? rps <= RPS_PROMOTION_GATE : null;
}
