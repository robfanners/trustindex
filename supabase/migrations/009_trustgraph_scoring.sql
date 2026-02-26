-- ==========================================================================
-- Migration 009: TrustGraph Health Scoring Engine
-- ==========================================================================
-- Implements the relational scoring model from the maths specification:
--   A) tg_confidence_factor — stability/confidence weighting
--   B) tg_bounded_penalty   — saturating penalty (1 - exp(-x))
--   C) tg_compute_health    — main composite health score function
--   D) trustgraph_health_mv — materialized view for fast dashboard reads
--   E) Recalc queue + triggers for refresh
-- ==========================================================================

-- --------------------------------------------------------------------------
-- A) Helper: stability/confidence factor
-- --------------------------------------------------------------------------
-- Returns 1.0 for 'stable', 0.7 for provisional/other.
-- Immutable: safe for use inside views.

CREATE OR REPLACE FUNCTION tg_confidence_factor(stability_status text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN stability_status = 'stable' THEN 1.0
    ELSE 0.7
  END;
$$;

-- --------------------------------------------------------------------------
-- B) Helper: bounded penalty function
-- --------------------------------------------------------------------------
-- Maps any non-negative input to [0, 1) via 1 - exp(-x).
-- Gives diminishing returns (doesn't explode, doesn't go below zero).

CREATE OR REPLACE FUNCTION tg_bounded_penalty(x numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 1 - exp(-greatest(x, 0));
$$;

-- --------------------------------------------------------------------------
-- C) Main: compute TrustGraph Health for one organisation
-- --------------------------------------------------------------------------
-- Returns:
--   health_score (0..100), base_health, org_base, sys_base,
--   p_rel, p_act, p_drift, p_exp (penalty drivers for explainability),
--   open_actions, overdue_actions, critical_overdue_actions
--
-- Formula: H = H_base * (1 - w1*P_rel) * (1 - w2*P_act) * (1 - w3*P_drift) * (1 - w4*P_exp)
-- Where H_base = mu * B_org + (1-mu) * B_sys
-- B_sys uses softmax weighting over autonomy x criticality

CREATE OR REPLACE FUNCTION tg_compute_health(p_org_id uuid)
RETURNS TABLE (
  organisation_id uuid,
  health_score numeric,
  base_health numeric,
  org_base numeric,
  sys_base numeric,
  p_rel numeric,
  p_act numeric,
  p_drift numeric,
  p_exp numeric,
  open_actions int,
  overdue_actions int,
  critical_overdue_actions int
)
LANGUAGE plpgsql
AS $$
DECLARE
  -- ======================================================================
  -- Tunables (calibrate with pilot data)
  -- ======================================================================
  mu numeric := 0.5;        -- org/sys blend (0.5 = equal weighting)
  v_alpha numeric := 1.0;   -- autonomy weight in softmax
  v_beta numeric := 1.0;    -- criticality weight in softmax
  v_lambda numeric := 2.0;  -- softmax sharpness (2.0 = clear prioritisation)
  v_gamma numeric := 3.0;   -- relational mismatch sensitivity

  -- Penalty weights (how much each penalty can reduce the score)
  w1 numeric := 0.35;  -- relational mismatch (core differentiation)
  w2 numeric := 0.30;  -- actions (operational reality)
  w3 numeric := 0.20;  -- drift (trust in motion)
  w4 numeric := 0.25;  -- expiry (trust expires)

  -- Action backlog weights
  eta1 numeric := 0.05;  -- open
  eta2 numeric := 0.15;  -- overdue
  eta3 numeric := 0.35;  -- critical overdue

  -- Drift / expiry blend ratios
  rho numeric := 0.4;   -- org drift contribution (0.4 = sys drift matters more)
  xi numeric := 0.5;    -- org expiry contribution

  -- ======================================================================
  -- Working variables
  -- ======================================================================
  org_score numeric := 0;
  org_kappa numeric := 1.0;
  org_status text := null;

  o_drift numeric := 0;
  s_drift numeric := 0;

  org_exp numeric := 0;
  v_sys_exp numeric := 0;

  bO numeric := 0;
  bS numeric := 0;

  rel_mismatch numeric := 0;
  rel_pen numeric := 0;

  act_pen numeric := 0;
  drift_pen numeric := 0;
  exp_pen numeric := 0;

  baseH numeric := 0;
  finalH numeric := 0;

  n_open int := 0;
  n_over int := 0;
  n_crit_over int := 0;
BEGIN
  -- -------------------------------------------------------------------
  -- 1) Latest TrustOrg run for this org
  -- -------------------------------------------------------------------
  SELECT
    coalesce(r.score, 0),
    tg_confidence_factor(r.stability_status::text),
    r.status::text
  INTO org_score, org_kappa, org_status
  FROM trustorg_runs r
  JOIN trustorg_surveys s ON s.id = r.survey_id
  WHERE s.organisation_id = p_org_id
  ORDER BY r.completed_at DESC NULLS LAST, r.created_at DESC
  LIMIT 1;

  bO := (coalesce(org_score, 0) / 100.0) * coalesce(org_kappa, 1.0);
  org_exp := CASE WHEN org_status = 'expired' THEN 1 ELSE 0 END;

  -- -------------------------------------------------------------------
  -- 2) Action counts (open / overdue / critical overdue)
  -- -------------------------------------------------------------------
  SELECT
    count(*) FILTER (WHERE a.status IN ('open','in_progress','blocked')),
    count(*) FILTER (
      WHERE a.status IN ('open','in_progress','blocked')
        AND a.due_date IS NOT NULL
        AND a.due_date < now()
    ),
    count(*) FILTER (
      WHERE a.status IN ('open','in_progress','blocked')
        AND a.due_date IS NOT NULL
        AND a.due_date < now()
        AND a.severity = 'critical'
    )
  INTO n_open, n_over, n_crit_over
  FROM actions a
  WHERE a.organisation_id = p_org_id;

  act_pen := tg_bounded_penalty(eta1 * n_open + eta2 * n_over + eta3 * n_crit_over);

  -- -------------------------------------------------------------------
  -- 3) Latest TrustSys runs per system + softmax weights
  --    Computes: sys base, relational mismatch, sys expiry
  -- -------------------------------------------------------------------
  WITH latest_sys AS (
    SELECT DISTINCT ON (a.id)
      a.id AS assessment_id,
      a.organisation_id,
      a.autonomy_level::numeric AS autonomy,
      a.criticality_level::numeric AS criticality,
      coalesce(r.score, 0)::numeric AS score,
      tg_confidence_factor(r.stability_status::text) AS kappa,
      r.status::text AS run_status,
      r.completed_at
    FROM trustsys_assessments a
    JOIN trustsys_runs r ON r.assessment_id = a.id
    WHERE a.organisation_id = p_org_id
      AND a.archived = false
    ORDER BY a.id, r.completed_at DESC NULLS LAST, r.created_at DESC
  ),
  logits AS (
    SELECT
      *,
      exp(v_lambda * (v_alpha * (autonomy / 5.0) + v_beta * (criticality / 5.0))) AS logit
    FROM latest_sys
  ),
  weights AS (
    SELECT
      *,
      CASE
        WHEN sum(logit) OVER () = 0 THEN 0
        ELSE logit / sum(logit) OVER ()
      END AS w
    FROM logits
  )
  SELECT
    coalesce(sum(w * ((score / 100.0) * kappa)), 0),
    coalesce(sum(w * ((autonomy / 5.0) * (criticality / 5.0) * greatest(0, (score / 100.0) - bO))), 0),
    coalesce(sum(w * CASE WHEN run_status = 'expired' THEN 1 ELSE 0 END), 0)
  INTO bS, rel_mismatch, v_sys_exp
  FROM weights;

  rel_pen := 1 - exp(-v_gamma * rel_mismatch);
  exp_pen := (xi * org_exp) + ((1 - xi) * v_sys_exp);

  -- -------------------------------------------------------------------
  -- 4) Drift penalties (using drift_events from last 90 days)
  -- -------------------------------------------------------------------
  -- Org drift
  SELECT
    coalesce(avg(CASE WHEN d.drift_flag THEN 1 ELSE 0 END), 0)
  INTO o_drift
  FROM drift_events d
  WHERE d.run_type = 'org'
    AND d.created_at > now() - interval '90 days'
    AND d.run_id IN (
      SELECT r.id
      FROM trustorg_runs r
      JOIN trustorg_surveys s ON s.id = r.survey_id
      WHERE s.organisation_id = p_org_id
      ORDER BY r.completed_at DESC NULLS LAST, r.created_at DESC
      LIMIT 5
    );

  -- Sys drift
  SELECT
    coalesce(avg(CASE WHEN d.drift_flag THEN 1 ELSE 0 END), 0)
  INTO s_drift
  FROM drift_events d
  WHERE d.run_type = 'sys'
    AND d.created_at > now() - interval '90 days'
    AND d.run_id IN (
      SELECT r.id
      FROM trustsys_runs r
      JOIN trustsys_assessments a ON a.id = r.assessment_id
      WHERE a.organisation_id = p_org_id
      ORDER BY r.completed_at DESC NULLS LAST, r.created_at DESC
      LIMIT 10
    );

  drift_pen := (rho * o_drift) + ((1 - rho) * s_drift);

  -- -------------------------------------------------------------------
  -- 5) Compose health score
  -- -------------------------------------------------------------------
  baseH := (mu * bO) + ((1 - mu) * bS);

  finalH :=
    baseH
    * (1 - w1 * rel_pen)
    * (1 - w2 * act_pen)
    * (1 - w3 * drift_pen)
    * (1 - w4 * exp_pen);

  finalH := greatest(0, least(1, finalH));

  -- -------------------------------------------------------------------
  -- 6) Return results
  -- -------------------------------------------------------------------
  organisation_id := p_org_id;
  health_score := round(100.0 * finalH, 1);
  base_health := round(100.0 * baseH, 1);
  org_base := round(100.0 * bO, 1);
  sys_base := round(100.0 * bS, 1);
  p_rel := round(rel_pen, 4);
  p_act := round(act_pen, 4);
  p_drift := round(drift_pen, 4);
  p_exp := round(exp_pen, 4);
  open_actions := n_open;
  overdue_actions := n_over;
  critical_overdue_actions := n_crit_over;

  RETURN NEXT;
END;
$$;

-- --------------------------------------------------------------------------
-- D) Materialized view for fast dashboard reads
-- --------------------------------------------------------------------------
-- Use materialized view for performance — refresh on triggers / cron.

CREATE MATERIALIZED VIEW IF NOT EXISTS trustgraph_health_mv AS
SELECT
  o.id AS organisation_id,
  h.health_score,
  h.base_health,
  h.org_base,
  h.sys_base,
  h.p_rel,
  h.p_act,
  h.p_drift,
  h.p_exp,
  h.open_actions,
  h.overdue_actions,
  h.critical_overdue_actions,
  now() AS computed_at
FROM organisations o
CROSS JOIN LATERAL tg_compute_health(o.id) h;

-- Unique index required for REFRESH CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_tg_health_mv_org
  ON trustgraph_health_mv(organisation_id);

-- --------------------------------------------------------------------------
-- E) Recalc queue + trigger for incremental refresh
-- --------------------------------------------------------------------------
-- Lightweight queue: on data changes, queue the org for recalc.
-- A scheduled job or application code processes the queue.

CREATE TABLE IF NOT EXISTS trustgraph_recalc_queue (
  organisation_id uuid PRIMARY KEY REFERENCES organisations(id) ON DELETE CASCADE,
  requested_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION tg_queue_recalc()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO trustgraph_recalc_queue(organisation_id)
  VALUES (NEW.organisation_id)
  ON CONFLICT (organisation_id) DO UPDATE SET requested_at = now();
  RETURN NEW;
END;
$$;

-- Queue recalc on action changes
CREATE TRIGGER trg_actions_queue_recalc
  AFTER INSERT OR UPDATE OF status, due_date, severity ON actions
  FOR EACH ROW EXECUTE FUNCTION tg_queue_recalc();

-- Queue recalc on TrustSys run completion
CREATE OR REPLACE FUNCTION tg_queue_recalc_trustsys_run()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT organisation_id INTO v_org_id
  FROM trustsys_assessments
  WHERE id = NEW.assessment_id;

  IF v_org_id IS NOT NULL THEN
    INSERT INTO trustgraph_recalc_queue(organisation_id)
    VALUES (v_org_id)
    ON CONFLICT (organisation_id) DO UPDATE SET requested_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_trustsys_runs_queue_recalc
  AFTER INSERT OR UPDATE OF status ON trustsys_runs
  FOR EACH ROW EXECUTE FUNCTION tg_queue_recalc_trustsys_run();

-- Queue recalc on TrustOrg run completion
CREATE OR REPLACE FUNCTION tg_queue_recalc_trustorg_run()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT s.organisation_id INTO v_org_id
  FROM trustorg_surveys s
  WHERE s.id = NEW.survey_id;

  IF v_org_id IS NOT NULL THEN
    INSERT INTO trustgraph_recalc_queue(organisation_id)
    VALUES (v_org_id)
    ON CONFLICT (organisation_id) DO UPDATE SET requested_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_trustorg_runs_queue_recalc
  AFTER INSERT OR UPDATE OF status ON trustorg_runs
  FOR EACH ROW EXECUTE FUNCTION tg_queue_recalc_trustorg_run();

-- --------------------------------------------------------------------------
-- F) Helper function to process the recalc queue
-- --------------------------------------------------------------------------
-- Call this from a cron job or after key operations.
-- Refreshes the materialized view for all queued orgs.
-- For MVP, we do a full concurrent refresh (fast enough for <100 orgs).

CREATE OR REPLACE FUNCTION tg_process_recalc_queue()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Full concurrent refresh (requires unique index)
  REFRESH MATERIALIZED VIEW CONCURRENTLY trustgraph_health_mv;

  -- Clear the queue
  DELETE FROM trustgraph_recalc_queue;
END;
$$;
