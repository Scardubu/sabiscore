-- Migration 004: Add competition_stage to matches table
-- Phase 8 Sprint 4 — Phase 1 (UCL knockout-stage importance scoring)
--
-- competition_stage stores the UCL round for UCL matches so that
-- compute_match_context() can apply the correct importance multiplier
-- from UCL_STAGE_IMPORTANCE: qualifying, group, r16, qf, sf, final.
-- NULL for all domestic league matches (field is ignored by the context model).

ALTER TABLE matches
    ADD COLUMN IF NOT EXISTS competition_stage VARCHAR(20) DEFAULT NULL;

-- Index to support fast filtering of UCL matches by stage when needed
-- (e.g. bulk canary queries, dashboards showing active UCL fixtures).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matches_competition_stage
    ON matches (competition_stage)
    WHERE competition_stage IS NOT NULL;
