-- ==========================================================================
-- Migration 008: TrustGraph 2.0 Core Schema
-- ==========================================================================
-- Creates the complete TrustGraph 2.0 data model per FILE 3 spec:
--   - trustorg_surveys, trustorg_runs (versioned org assessments)
--   - trustsys_assessments, trustsys_runs (versioned sys assessments)
--   - dimensions (shared across Org & Sys)
--   - actions, action_updates (Action Engine)
--   - drift_events, escalations
--   - reassessment_policies
--   - audit_logs (immutable)
--   - Data migration from legacy tables
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. Enum types
-- --------------------------------------------------------------------------

CREATE TYPE tg_run_status AS ENUM (
  'not_started', 'in_progress', 'completed', 'stable', 'expired'
);

CREATE TYPE tg_stability_status AS ENUM ('provisional', 'stable');

CREATE TYPE tg_run_type AS ENUM ('org', 'sys');

CREATE TYPE tg_action_severity AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TYPE tg_action_status AS ENUM ('open', 'in_progress', 'blocked', 'done');

CREATE TYPE tg_escalation_severity AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TYPE tg_survey_status AS ENUM ('active', 'archived');

-- --------------------------------------------------------------------------
-- 2. trustorg_surveys — survey template per organisation
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS trustorg_surveys (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  status        tg_survey_status NOT NULL DEFAULT 'active',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_trustorg_surveys_org ON trustorg_surveys(organisation_id);

-- --------------------------------------------------------------------------
-- 3. trustorg_runs — versioned org assessment runs
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS trustorg_runs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id           uuid NOT NULL REFERENCES trustorg_surveys(id) ON DELETE CASCADE,
  version_number      integer NOT NULL DEFAULT 1,
  status              tg_run_status NOT NULL DEFAULT 'not_started',
  score               numeric,
  dimension_scores    jsonb,
  confidence_factor   numeric,
  drift_from_previous numeric,
  stability_status    tg_stability_status NOT NULL DEFAULT 'provisional',
  started_at          timestamptz,
  completed_at        timestamptz,
  created_by          uuid REFERENCES auth.users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  -- Legacy reference for data migration traceability
  legacy_survey_run_id uuid
);

CREATE INDEX idx_trustorg_runs_survey    ON trustorg_runs(survey_id);
CREATE INDEX idx_trustorg_runs_status    ON trustorg_runs(status);
CREATE INDEX idx_trustorg_runs_created_by ON trustorg_runs(created_by);

-- --------------------------------------------------------------------------
-- 4. trustsys_assessments — system entity being assessed
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS trustsys_assessments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id   uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  system_name       text NOT NULL,
  version_label     text,
  system_type       text,
  environment       text,
  autonomy_level    numeric NOT NULL DEFAULT 1 CHECK (autonomy_level >= 1 AND autonomy_level <= 5),
  criticality_level numeric NOT NULL DEFAULT 1 CHECK (criticality_level >= 1 AND criticality_level <= 5),
  reassessment_frequency_days integer DEFAULT 90,
  archived          boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  -- HAPP integration hooks (nullable, future use)
  happ_enforced     boolean,
  happ_proof_id     text,

  -- Legacy reference for data migration traceability
  legacy_system_id  uuid
);

CREATE INDEX idx_trustsys_assessments_org ON trustsys_assessments(organisation_id);
CREATE INDEX idx_trustsys_assessments_archived ON trustsys_assessments(archived);

-- --------------------------------------------------------------------------
-- 5. trustsys_runs — versioned sys assessment runs
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS trustsys_runs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id       uuid NOT NULL REFERENCES trustsys_assessments(id) ON DELETE CASCADE,
  version_number      integer NOT NULL DEFAULT 1,
  status              tg_run_status NOT NULL DEFAULT 'not_started',
  score               numeric,
  dimension_scores    jsonb,
  risk_flags          jsonb,
  stability_status    tg_stability_status NOT NULL DEFAULT 'provisional',
  variance_last_3     numeric,
  drift_flag          boolean NOT NULL DEFAULT false,
  drift_from_previous numeric,
  question_set_version text NOT NULL DEFAULT 'v1',
  started_at          timestamptz,
  completed_at        timestamptz,
  created_by          uuid REFERENCES auth.users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  -- Legacy reference for data migration traceability
  legacy_system_run_id uuid
);

CREATE INDEX idx_trustsys_runs_assessment ON trustsys_runs(assessment_id);
CREATE INDEX idx_trustsys_runs_status     ON trustsys_runs(status);
CREATE INDEX idx_trustsys_runs_created_by ON trustsys_runs(created_by);

-- --------------------------------------------------------------------------
-- 6. dimensions — shared dimension definitions
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS dimensions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type       tg_run_type NOT NULL,
  name       text NOT NULL,
  weight     numeric NOT NULL DEFAULT 1.0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dimensions_type ON dimensions(type);

-- --------------------------------------------------------------------------
-- 7. tg_responses — normalised responses (unified org + sys)
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tg_responses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        uuid NOT NULL,
  run_type      tg_run_type NOT NULL,
  dimension_id  uuid REFERENCES dimensions(id),
  question_id   text,
  value         numeric,
  answer        jsonb,
  evidence      jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tg_responses_run ON tg_responses(run_id, run_type);

-- --------------------------------------------------------------------------
-- 8. actions — Action Engine
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS actions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  linked_run_id   uuid,
  linked_run_type tg_run_type,
  dimension_id    uuid REFERENCES dimensions(id),
  title           text NOT NULL,
  description     text,
  severity        tg_action_severity NOT NULL DEFAULT 'medium',
  owner_id        uuid REFERENCES auth.users(id),
  due_date        timestamptz,
  status          tg_action_status NOT NULL DEFAULT 'open',
  evidence_url    text,
  evidence        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- HAPP integration hooks (nullable, future use)
  enforcement_available boolean,
  enforcement_type text CHECK (enforcement_type IS NULL OR enforcement_type IN ('policy', 'provenance', 'runtime'))
);

CREATE INDEX idx_actions_org     ON actions(organisation_id);
CREATE INDEX idx_actions_status  ON actions(status);
CREATE INDEX idx_actions_owner   ON actions(owner_id);
CREATE INDEX idx_actions_run     ON actions(linked_run_id);
CREATE INDEX idx_actions_due     ON actions(due_date) WHERE status IN ('open', 'in_progress');

-- --------------------------------------------------------------------------
-- 9. action_updates — immutable change tracking
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS action_updates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id      uuid NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  update_type    text NOT NULL,
  previous_value jsonb,
  new_value      jsonb,
  updated_by     uuid REFERENCES auth.users(id),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_action_updates_action ON action_updates(action_id);

-- --------------------------------------------------------------------------
-- 10. drift_events — per-run drift detection
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS drift_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id       uuid NOT NULL,
  run_type     tg_run_type NOT NULL,
  delta_score  numeric NOT NULL,
  dimension_id uuid REFERENCES dimensions(id),
  drift_flag   boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_drift_events_run ON drift_events(run_id, run_type);

-- --------------------------------------------------------------------------
-- 11. escalations
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS escalations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  linked_run_id   uuid,
  linked_run_type tg_run_type,
  linked_action_id uuid REFERENCES actions(id),
  reason          text NOT NULL,
  severity        tg_escalation_severity NOT NULL DEFAULT 'medium',
  resolved        boolean NOT NULL DEFAULT false,
  resolved_at     timestamptz,
  resolved_by     uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_escalations_org      ON escalations(organisation_id);
CREATE INDEX idx_escalations_resolved ON escalations(resolved) WHERE resolved = false;

-- --------------------------------------------------------------------------
-- 12. reassessment_policies
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS reassessment_policies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  run_type        tg_run_type NOT NULL,
  target_id       uuid,  -- survey_id or assessment_id
  frequency_days  integer NOT NULL DEFAULT 90,
  last_completed  timestamptz,
  next_due        timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reassessment_policies_org ON reassessment_policies(organisation_id);
CREATE INDEX idx_reassessment_policies_due ON reassessment_policies(next_due);

-- --------------------------------------------------------------------------
-- 13. audit_logs — immutable general audit trail
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  entity_type     text NOT NULL,
  entity_id       uuid NOT NULL,
  action_type     text NOT NULL,
  performed_by    uuid REFERENCES auth.users(id),
  metadata        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_org    ON audit_logs(organisation_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- Immutability triggers (same pattern as vcc_audit_log)
CREATE OR REPLACE FUNCTION public.prevent_audit_logs_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is immutable: % not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_audit_logs_no_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_logs_mutation();

CREATE TRIGGER trg_audit_logs_no_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_logs_mutation();

-- Immutability for action_updates (never delete change history)
CREATE TRIGGER trg_action_updates_no_update
  BEFORE UPDATE ON action_updates
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_logs_mutation();

CREATE TRIGGER trg_action_updates_no_delete
  BEFORE DELETE ON action_updates
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_logs_mutation();

-- Immutability for drift_events
CREATE TRIGGER trg_drift_events_no_update
  BEFORE UPDATE ON drift_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_logs_mutation();

CREATE TRIGGER trg_drift_events_no_delete
  BEFORE DELETE ON drift_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_logs_mutation();

-- --------------------------------------------------------------------------
-- 14. updated_at auto-trigger
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_trustorg_surveys_updated_at BEFORE UPDATE ON trustorg_surveys
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER trg_trustorg_runs_updated_at BEFORE UPDATE ON trustorg_runs
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER trg_trustsys_assessments_updated_at BEFORE UPDATE ON trustsys_assessments
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER trg_trustsys_runs_updated_at BEFORE UPDATE ON trustsys_runs
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER trg_actions_updated_at BEFORE UPDATE ON actions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER trg_reassessment_policies_updated_at BEFORE UPDATE ON reassessment_policies
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- --------------------------------------------------------------------------
-- 15. Enable RLS on all new tables
-- --------------------------------------------------------------------------

ALTER TABLE trustorg_surveys      ENABLE ROW LEVEL SECURITY;
ALTER TABLE trustorg_runs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE trustsys_assessments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE trustsys_runs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE dimensions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tg_responses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_updates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE drift_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE reassessment_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs            ENABLE ROW LEVEL SECURITY;

-- RLS policies: service_role bypasses RLS automatically.
-- For authenticated browser access (future), org-scoped policies:

-- dimensions: static reference data, publicly readable
CREATE POLICY "dimensions_select_all" ON dimensions
  FOR SELECT TO anon, authenticated
  USING (true);

-- --------------------------------------------------------------------------
-- 16. Seed default dimensions
-- --------------------------------------------------------------------------

-- TrustSys dimensions (matching existing systemScoring.ts)
INSERT INTO dimensions (type, name, weight) VALUES
  ('sys', 'Governance & Accountability', 0.20),
  ('sys', 'Data Integrity & Privacy', 0.20),
  ('sys', 'Technical Robustness', 0.20),
  ('sys', 'Human Oversight & Control', 0.20),
  ('sys', 'Transparency & Explainability', 0.20);

-- TrustOrg dimensions (placeholder weights — tune during calibration)
INSERT INTO dimensions (type, name, weight) VALUES
  ('org', 'Leadership & Strategy', 0.20),
  ('org', 'Culture & Awareness', 0.20),
  ('org', 'Policy & Compliance', 0.20),
  ('org', 'Operations & Process', 0.20),
  ('org', 'Stakeholder Engagement', 0.20);

-- --------------------------------------------------------------------------
-- 17. Data migration: systems → trustsys_assessments
-- --------------------------------------------------------------------------
-- Maps existing systems to new trustsys_assessments.
-- Uses the profile's organisation_id to scope to org.
-- Sets default autonomy_level=3, criticality_level=3 (mid-range).

INSERT INTO trustsys_assessments (
  id, organisation_id, system_name, version_label, system_type, environment,
  autonomy_level, criticality_level, archived, created_at, legacy_system_id
)
SELECT
  gen_random_uuid(),
  COALESCE(p.organisation_id, (SELECT id FROM organisations LIMIT 1)),
  s.name,
  s.version_label,
  s.type,
  s.environment,
  3,  -- default autonomy
  3,  -- default criticality
  COALESCE(s.archived, false),
  s.created_at,
  s.id
FROM systems s
LEFT JOIN profiles p ON p.id = s.owner_id
WHERE s.id IS NOT NULL;

-- --------------------------------------------------------------------------
-- 18. Data migration: system_runs → trustsys_runs
-- --------------------------------------------------------------------------

INSERT INTO trustsys_runs (
  id, assessment_id, version_number, status, score, dimension_scores,
  risk_flags, question_set_version, started_at, completed_at,
  created_at, legacy_system_run_id
)
SELECT
  gen_random_uuid(),
  ta.id,
  ROW_NUMBER() OVER (PARTITION BY ta.id ORDER BY sr.created_at),
  CASE
    WHEN sr.status = 'submitted' THEN 'completed'::tg_run_status
    WHEN sr.status = 'draft' THEN 'in_progress'::tg_run_status
    ELSE 'not_started'::tg_run_status
  END,
  sr.overall_score,
  sr.dimension_scores,
  sr.risk_flags,
  sr.question_set_version,
  sr.created_at,                   -- started_at = created_at
  sr.submitted_at,                 -- completed_at = submitted_at
  sr.created_at,
  sr.id
FROM system_runs sr
JOIN trustsys_assessments ta ON ta.legacy_system_id = sr.system_id
WHERE sr.id IS NOT NULL;

-- --------------------------------------------------------------------------
-- 19. Data migration: survey_runs → trustorg_surveys + trustorg_runs
-- --------------------------------------------------------------------------
-- Each existing survey_run with an organisation_id gets a trustorg_survey
-- and a corresponding trustorg_run.

-- First, create one trustorg_survey per org that has survey_runs
INSERT INTO trustorg_surveys (id, organisation_id, status, created_at)
SELECT DISTINCT ON (organisation_id)
  gen_random_uuid(),
  organisation_id,
  'active'::tg_survey_status,
  MIN(created_at)
FROM survey_runs
WHERE organisation_id IS NOT NULL
GROUP BY organisation_id;

-- Then create trustorg_runs for each survey_run
INSERT INTO trustorg_runs (
  id, survey_id, version_number, status, started_at, completed_at,
  created_at, legacy_survey_run_id
)
SELECT
  gen_random_uuid(),
  ts.id,
  ROW_NUMBER() OVER (PARTITION BY ts.id ORDER BY sr.created_at),
  CASE
    WHEN sr.status = 'closed' THEN 'completed'::tg_run_status
    WHEN sr.status = 'open' THEN 'in_progress'::tg_run_status
    ELSE 'not_started'::tg_run_status
  END,
  sr.created_at,
  CASE WHEN sr.status = 'closed' THEN sr.created_at ELSE NULL END,
  sr.created_at,
  sr.id
FROM survey_runs sr
JOIN trustorg_surveys ts ON ts.organisation_id = sr.organisation_id
WHERE sr.organisation_id IS NOT NULL;
