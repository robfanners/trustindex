-- ---------------------------------------------------------------------------
-- TrustSysGraph — system_runs, system_responses, system_recommendations
-- ---------------------------------------------------------------------------
-- Run this in the Supabase SQL Editor.
-- ---------------------------------------------------------------------------

-- Add type/environment columns to systems (optional metadata)
ALTER TABLE systems ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE systems ADD COLUMN IF NOT EXISTS environment text;

-- system_runs — one row per assessment run (draft → submitted)
CREATE TABLE IF NOT EXISTS system_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id uuid NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  version_label text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  question_set_version text NOT NULL DEFAULT 'v1',
  overall_score int,
  dimension_scores jsonb,
  risk_flags jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_system_runs_system_id ON system_runs(system_id);
CREATE INDEX IF NOT EXISTS idx_system_runs_status ON system_runs(status);

-- system_responses — one row per question per run
CREATE TABLE IF NOT EXISTS system_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES system_runs(id) ON DELETE CASCADE,
  question_id text NOT NULL,
  answer jsonb NOT NULL,
  evidence jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_system_responses_run_id ON system_responses(run_id);

-- system_recommendations — generated on submit
CREATE TABLE IF NOT EXISTS system_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES system_runs(id) ON DELETE CASCADE,
  question_id text NOT NULL,
  dimension text NOT NULL,
  control text NOT NULL,
  priority text NOT NULL CHECK (priority IN ('high', 'med')),
  recommendation text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_recommendations_run_id ON system_recommendations(run_id);
