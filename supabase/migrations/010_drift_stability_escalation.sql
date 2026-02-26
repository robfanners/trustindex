-- ==========================================================================
-- Migration 010: Drift Detection, Stability Update & Escalation Automation
-- ==========================================================================
-- Phase 5 of the TrustGraph 2.0 structural fix.
-- Adds server-side automation that fires on run completion:
--   A) tg_detect_drift_sys()   — auto-detect drift on TrustSys run completion
--   B) tg_detect_drift_org()   — auto-detect drift on TrustOrg run completion
--   C) tg_update_stability()   — auto-update stability_status on run completion
--   D) tg_auto_escalate_on_run()  — auto-create escalations on risky conditions
--   E) tg_auto_escalate_on_drift()— auto-escalate on significant drift events
--   F) tg_check_and_expire()   — check reassessment cadence + mark expired
--   G) tg_auto_create_reassessment_policy() — auto-create policy on first run
-- ==========================================================================

-- --------------------------------------------------------------------------
-- Tunables (match assessmentLifecycle.ts constants)
-- --------------------------------------------------------------------------
-- DRIFT_THRESHOLD = 10        (score delta to flag drift)
-- STABILITY_TOLERANCE = 25    (variance threshold for stability)
-- STABILITY_MIN_RUNS = 3      (min completed runs for stability)
-- ESCALATION_SCORE_THRESHOLD = 50  (scores below this trigger escalation)
-- SIGNIFICANT_DRIFT = 15      (drift delta above this auto-escalates)

-- --------------------------------------------------------------------------
-- A) Auto-detect drift on TrustSys run completion
-- --------------------------------------------------------------------------
-- Fires AFTER UPDATE on trustsys_runs when status changes to 'completed'.
-- Computes overall score drift vs previous completed run.
-- Inserts into drift_events and sets drift_flag/drift_from_previous on the run.

CREATE OR REPLACE FUNCTION tg_detect_drift_sys()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_drift_threshold numeric := 10;
  v_prev_score numeric;
  v_prev_run_id uuid;
  v_delta numeric;
  v_has_drift boolean;
BEGIN
  -- Only fire when status transitions to completed
  IF NEW.status <> 'completed' THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'completed' THEN
    RETURN NEW;  -- already completed, skip
  END IF;
  IF NEW.score IS NULL THEN
    RETURN NEW;  -- no score to compare
  END IF;

  -- Find previous completed run for this assessment
  SELECT r.score, r.id
  INTO v_prev_score, v_prev_run_id
  FROM trustsys_runs r
  WHERE r.assessment_id = NEW.assessment_id
    AND r.status = 'completed'
    AND r.id <> NEW.id
  ORDER BY r.completed_at DESC NULLS LAST, r.created_at DESC
  LIMIT 1;

  IF v_prev_score IS NOT NULL THEN
    v_delta := NEW.score - v_prev_score;
    v_has_drift := abs(v_delta) > v_drift_threshold;

    -- Update the run with drift info
    NEW.drift_from_previous := v_delta;
    NEW.drift_flag := v_has_drift;

    -- Insert drift event if drift detected
    IF v_has_drift THEN
      INSERT INTO drift_events (run_id, run_type, delta_score, drift_flag)
      VALUES (NEW.id, 'sys', v_delta, true);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_trustsys_runs_detect_drift
  BEFORE UPDATE OF status ON trustsys_runs
  FOR EACH ROW
  EXECUTE FUNCTION tg_detect_drift_sys();

-- --------------------------------------------------------------------------
-- B) Auto-detect drift on TrustOrg run completion
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION tg_detect_drift_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_drift_threshold numeric := 10;
  v_prev_score numeric;
  v_delta numeric;
  v_has_drift boolean;
BEGIN
  IF NEW.status <> 'completed' THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;
  IF NEW.score IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find previous completed run for this survey
  SELECT r.score
  INTO v_prev_score
  FROM trustorg_runs r
  WHERE r.survey_id = NEW.survey_id
    AND r.status = 'completed'
    AND r.id <> NEW.id
  ORDER BY r.completed_at DESC NULLS LAST, r.created_at DESC
  LIMIT 1;

  IF v_prev_score IS NOT NULL THEN
    v_delta := NEW.score - v_prev_score;
    v_has_drift := abs(v_delta) > v_drift_threshold;

    NEW.drift_from_previous := v_delta;

    IF v_has_drift THEN
      INSERT INTO drift_events (run_id, run_type, delta_score, drift_flag)
      VALUES (NEW.id, 'org', v_delta, true);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_trustorg_runs_detect_drift
  BEFORE UPDATE OF status ON trustorg_runs
  FOR EACH ROW
  EXECUTE FUNCTION tg_detect_drift_org();

-- --------------------------------------------------------------------------
-- C) Auto-update stability on TrustSys run completion
-- --------------------------------------------------------------------------
-- After a run completes, check if the assessment has reached stability:
--   - ≥3 completed runs AND variance of last 3 scores < tolerance

CREATE OR REPLACE FUNCTION tg_update_stability_sys()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_min_runs int := 3;
  v_tolerance numeric := 25;
  v_count int;
  v_variance numeric;
  v_is_stable boolean;
BEGIN
  IF NEW.status <> 'completed' THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  -- Count completed runs for this assessment
  SELECT count(*)
  INTO v_count
  FROM trustsys_runs
  WHERE assessment_id = NEW.assessment_id
    AND status = 'completed';

  -- Include the current run being completed
  v_count := v_count + 1;

  IF v_count >= v_min_runs THEN
    -- Compute variance of last 3 completed scores (including this one)
    SELECT variance(s.score)
    INTO v_variance
    FROM (
      SELECT score FROM trustsys_runs
      WHERE assessment_id = NEW.assessment_id
        AND status = 'completed'
        AND id <> NEW.id
      ORDER BY completed_at DESC NULLS LAST, created_at DESC
      LIMIT 2
    ) s
    CROSS JOIN (SELECT NEW.score AS score) cur
    CROSS JOIN LATERAL (VALUES (s.score), (cur.score)) AS combined(score);

    -- Simpler: collect scores manually
    v_variance := NULL;
    WITH recent_scores AS (
      (
        SELECT score FROM trustsys_runs
        WHERE assessment_id = NEW.assessment_id
          AND status = 'completed'
          AND id <> NEW.id
        ORDER BY completed_at DESC NULLS LAST, created_at DESC
        LIMIT 2
      )
      UNION ALL
      SELECT NEW.score
    )
    SELECT var_pop(score) INTO v_variance FROM recent_scores;

    NEW.variance_last_3 := v_variance;

    v_is_stable := (v_variance IS NOT NULL AND v_variance < v_tolerance);
    IF v_is_stable THEN
      NEW.stability_status := 'stable';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_trustsys_runs_update_stability
  BEFORE UPDATE OF status ON trustsys_runs
  FOR EACH ROW
  EXECUTE FUNCTION tg_update_stability_sys();

-- --------------------------------------------------------------------------
-- D) Auto-escalate on run completion (low score)
-- --------------------------------------------------------------------------
-- After a run is marked completed, if the score is below threshold,
-- create an escalation record.

CREATE OR REPLACE FUNCTION tg_auto_escalate_on_run()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_score_threshold numeric := 50;
  v_org_id uuid;
  v_run_type tg_run_type;
  v_reason text;
  v_sev tg_escalation_severity;
BEGIN
  -- Only on completion
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NULL;
  END IF;

  IF NEW.score IS NULL OR NEW.score >= v_score_threshold THEN
    RETURN NULL;
  END IF;

  -- Determine org_id and run type based on trigger table
  IF TG_TABLE_NAME = 'trustsys_runs' THEN
    SELECT organisation_id INTO v_org_id
    FROM trustsys_assessments WHERE id = NEW.assessment_id;
    v_run_type := 'sys';
    v_reason := 'TrustSys assessment score below threshold (' || round(NEW.score, 1) || ' < ' || v_score_threshold || ')';
  ELSIF TG_TABLE_NAME = 'trustorg_runs' THEN
    SELECT s.organisation_id INTO v_org_id
    FROM trustorg_surveys s WHERE s.id = NEW.survey_id;
    v_run_type := 'org';
    v_reason := 'TrustOrg survey score below threshold (' || round(NEW.score, 1) || ' < ' || v_score_threshold || ')';
  END IF;

  IF v_org_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Severity based on score
  IF NEW.score < 30 THEN
    v_sev := 'critical';
  ELSIF NEW.score < 40 THEN
    v_sev := 'high';
  ELSE
    v_sev := 'medium';
  END IF;

  INSERT INTO escalations (organisation_id, linked_run_id, linked_run_type, reason, severity)
  VALUES (v_org_id, NEW.id, v_run_type, v_reason, v_sev);

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_trustsys_runs_auto_escalate
  AFTER UPDATE OF status ON trustsys_runs
  FOR EACH ROW
  EXECUTE FUNCTION tg_auto_escalate_on_run();

CREATE TRIGGER trg_trustorg_runs_auto_escalate
  AFTER UPDATE OF status ON trustorg_runs
  FOR EACH ROW
  EXECUTE FUNCTION tg_auto_escalate_on_run();

-- --------------------------------------------------------------------------
-- E) Auto-escalate on significant drift
-- --------------------------------------------------------------------------
-- When a drift_event is inserted with |delta| > 15, create an escalation.

CREATE OR REPLACE FUNCTION tg_auto_escalate_on_drift()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_significant_drift numeric := 15;
  v_org_id uuid;
  v_reason text;
  v_sev tg_escalation_severity;
  v_direction text;
BEGIN
  IF abs(NEW.delta_score) <= v_significant_drift THEN
    RETURN NULL;
  END IF;

  -- Resolve org_id from the run
  IF NEW.run_type = 'sys' THEN
    SELECT a.organisation_id INTO v_org_id
    FROM trustsys_runs r
    JOIN trustsys_assessments a ON a.id = r.assessment_id
    WHERE r.id = NEW.run_id;
  ELSIF NEW.run_type = 'org' THEN
    SELECT s.organisation_id INTO v_org_id
    FROM trustorg_runs r
    JOIN trustorg_surveys s ON s.id = r.survey_id
    WHERE r.id = NEW.run_id;
  END IF;

  IF v_org_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_direction := CASE WHEN NEW.delta_score < 0 THEN 'declined' ELSE 'improved' END;
  v_reason := 'Significant drift detected: score ' || v_direction
    || ' by ' || round(abs(NEW.delta_score), 1)
    || ' points (threshold: ' || v_significant_drift || ')';

  IF abs(NEW.delta_score) > 25 THEN
    v_sev := 'critical';
  ELSIF abs(NEW.delta_score) > 20 THEN
    v_sev := 'high';
  ELSE
    v_sev := 'medium';
  END IF;

  INSERT INTO escalations (organisation_id, linked_run_id, linked_run_type, reason, severity)
  VALUES (v_org_id, NEW.run_id, NEW.run_type, v_reason, v_sev);

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_drift_events_auto_escalate
  AFTER INSERT ON drift_events
  FOR EACH ROW
  EXECUTE FUNCTION tg_auto_escalate_on_drift();

-- --------------------------------------------------------------------------
-- F) Check and expire assessments past reassessment cadence
-- --------------------------------------------------------------------------
-- Callable function: checks reassessment_policies where next_due < now().
-- Marks the latest run as 'expired' and creates an escalation.
-- Call from cron or API endpoint.

CREATE OR REPLACE FUNCTION tg_check_and_expire()
RETURNS TABLE (expired_count int, escalation_count int)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_expired int := 0;
  v_escalated int := 0;
  policy RECORD;
  v_latest_run_id uuid;
  v_latest_status text;
BEGIN
  FOR policy IN
    SELECT rp.*
    FROM reassessment_policies rp
    WHERE rp.next_due IS NOT NULL
      AND rp.next_due < now()
  LOOP
    IF policy.run_type = 'sys' THEN
      -- Find latest completed run for this assessment
      SELECT r.id, r.status::text INTO v_latest_run_id, v_latest_status
      FROM trustsys_runs r
      WHERE r.assessment_id = policy.target_id
        AND r.status IN ('completed', 'stable')
      ORDER BY r.completed_at DESC NULLS LAST, r.created_at DESC
      LIMIT 1;

      IF v_latest_run_id IS NOT NULL AND v_latest_status <> 'expired' THEN
        UPDATE trustsys_runs SET status = 'expired' WHERE id = v_latest_run_id;
        v_expired := v_expired + 1;

        INSERT INTO escalations (organisation_id, linked_run_id, linked_run_type, reason, severity)
        VALUES (
          policy.organisation_id, v_latest_run_id, 'sys',
          'TrustSys assessment overdue for reassessment (policy: every '
            || policy.frequency_days || ' days)',
          'high'
        );
        v_escalated := v_escalated + 1;
      END IF;

    ELSIF policy.run_type = 'org' THEN
      SELECT r.id, r.status::text INTO v_latest_run_id, v_latest_status
      FROM trustorg_runs r
      WHERE r.survey_id = policy.target_id
        AND r.status IN ('completed', 'stable')
      ORDER BY r.completed_at DESC NULLS LAST, r.created_at DESC
      LIMIT 1;

      IF v_latest_run_id IS NOT NULL AND v_latest_status <> 'expired' THEN
        UPDATE trustorg_runs SET status = 'expired' WHERE id = v_latest_run_id;
        v_expired := v_expired + 1;

        INSERT INTO escalations (organisation_id, linked_run_id, linked_run_type, reason, severity)
        VALUES (
          policy.organisation_id, v_latest_run_id, 'org',
          'TrustOrg survey overdue for reassessment (policy: every '
            || policy.frequency_days || ' days)',
          'high'
        );
        v_escalated := v_escalated + 1;
      END IF;
    END IF;
  END LOOP;

  expired_count := v_expired;
  escalation_count := v_escalated;
  RETURN NEXT;
END;
$$;

-- --------------------------------------------------------------------------
-- G) Auto-create reassessment policy on first completed run
-- --------------------------------------------------------------------------
-- When a TrustSys run completes, if no policy exists for this assessment,
-- create one using the assessment's reassessment_frequency_days.

CREATE OR REPLACE FUNCTION tg_auto_create_reassessment_policy()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_freq int;
  v_exists boolean;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NULL;
  END IF;

  IF TG_TABLE_NAME = 'trustsys_runs' THEN
    SELECT a.organisation_id, a.reassessment_frequency_days
    INTO v_org_id, v_freq
    FROM trustsys_assessments a WHERE a.id = NEW.assessment_id;

    SELECT EXISTS (
      SELECT 1 FROM reassessment_policies
      WHERE target_id = NEW.assessment_id AND run_type = 'sys'
    ) INTO v_exists;

    IF NOT v_exists AND v_freq IS NOT NULL AND v_freq > 0 THEN
      INSERT INTO reassessment_policies (
        organisation_id, run_type, target_id, frequency_days,
        last_completed, next_due
      ) VALUES (
        v_org_id, 'sys', NEW.assessment_id, v_freq,
        COALESCE(NEW.completed_at, now()),
        COALESCE(NEW.completed_at, now()) + (v_freq || ' days')::interval
      );
    ELSIF v_exists THEN
      -- Update existing policy
      UPDATE reassessment_policies
      SET last_completed = COALESCE(NEW.completed_at, now()),
          next_due = COALESCE(NEW.completed_at, now()) + (frequency_days || ' days')::interval
      WHERE target_id = NEW.assessment_id AND run_type = 'sys';
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_trustsys_runs_auto_policy
  AFTER UPDATE OF status ON trustsys_runs
  FOR EACH ROW
  EXECUTE FUNCTION tg_auto_create_reassessment_policy();

-- --------------------------------------------------------------------------
-- H) Auto-escalate on critical overdue actions
-- --------------------------------------------------------------------------
-- Function to check for critical overdue actions and create escalations.
-- Callable from cron or API.

CREATE OR REPLACE FUNCTION tg_escalate_overdue_actions()
RETURNS TABLE (escalated_count int)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  v_action RECORD;
BEGIN
  FOR v_action IN
    SELECT a.id, a.organisation_id, a.title, a.severity::text, a.due_date,
           a.linked_run_id, a.linked_run_type
    FROM actions a
    WHERE a.status IN ('open', 'in_progress', 'blocked')
      AND a.severity = 'critical'
      AND a.due_date IS NOT NULL
      AND a.due_date < now()
      -- Only escalate if not already escalated for this action
      AND NOT EXISTS (
        SELECT 1 FROM escalations e
        WHERE e.linked_action_id = a.id
          AND e.resolved = false
      )
  LOOP
    INSERT INTO escalations (
      organisation_id, linked_run_id, linked_run_type,
      linked_action_id, reason, severity
    ) VALUES (
      v_action.organisation_id,
      v_action.linked_run_id,
      v_action.linked_run_type,
      v_action.id,
      'Critical action overdue: "' || v_action.title || '" (due '
        || to_char(v_action.due_date, 'DD Mon YYYY') || ')',
      'critical'
    );
    v_count := v_count + 1;
  END LOOP;

  escalated_count := v_count;
  RETURN NEXT;
END;
$$;
