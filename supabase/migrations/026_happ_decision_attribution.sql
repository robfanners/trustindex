-- 026_happ_decision_attribution.sql
-- HAPP Decision Attribution: policy versioning, AI outputs, decision records

-- ---------------------------------------------------------------------------
-- Table: policy_versions — immutable versioned governance policies
-- ---------------------------------------------------------------------------

CREATE TABLE policy_versions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id   uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  policy_id         uuid NOT NULL REFERENCES ai_policies(id) ON DELETE CASCADE,
  version           integer NOT NULL,
  title             text NOT NULL,
  policy_hash       text NOT NULL,
  content_snapshot  jsonb NOT NULL,
  status            text NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'active', 'superseded', 'retired')),
  effective_from    timestamptz,
  effective_until   timestamptz,
  published_by      uuid REFERENCES profiles(id),
  published_at      timestamptz,
  superseded_by     uuid REFERENCES policy_versions(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(policy_id, version)
);

CREATE INDEX idx_policy_versions_org    ON policy_versions(organisation_id);
CREATE INDEX idx_policy_versions_policy ON policy_versions(policy_id, status);
CREATE INDEX idx_policy_versions_eff    ON policy_versions(effective_from);

ALTER TABLE policy_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view policy versions in their org"
  ON policy_versions FOR SELECT TO authenticated
  USING (organisation_id IN (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert policy versions in their org"
  ON policy_versions FOR INSERT TO authenticated
  WITH CHECK (organisation_id IN (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update policy versions in their org"
  ON policy_versions FOR UPDATE TO authenticated
  USING (organisation_id IN (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

CREATE OR REPLACE FUNCTION tg_policy_versions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_policy_versions_updated_at
  BEFORE UPDATE ON policy_versions FOR EACH ROW
  EXECUTE FUNCTION tg_policy_versions_updated_at();

-- ---------------------------------------------------------------------------
-- Table: ai_outputs — observed AI system outputs
-- ---------------------------------------------------------------------------

CREATE TABLE ai_outputs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id   uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  system_id         uuid NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  system_run_id     uuid REFERENCES system_runs(id) ON DELETE SET NULL,
  model_id          uuid REFERENCES model_registry(id) ON DELETE SET NULL,
  source_type       text NOT NULL DEFAULT 'manual'
                      CHECK (source_type IN ('manual', 'api')),
  external_event_id text,
  input_hash        text,
  output_hash       text NOT NULL,
  output_summary    text NOT NULL,
  output_type       text CHECK (output_type IN ('recommendation', 'classification', 'generated_text', 'action_request', 'score', 'other')),
  raw_output_ref    text,
  confidence_score  numeric CHECK (confidence_score >= 0 AND confidence_score <= 1),
  risk_signal       text CHECK (risk_signal IN ('low', 'medium', 'high', 'critical')),
  occurred_at       timestamptz NOT NULL,
  created_by        uuid REFERENCES profiles(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_outputs_system ON ai_outputs(system_id, occurred_at DESC);
CREATE INDEX idx_ai_outputs_org    ON ai_outputs(organisation_id);

ALTER TABLE ai_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view outputs in their org"
  ON ai_outputs FOR SELECT TO authenticated
  USING (organisation_id IN (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert outputs in their org"
  ON ai_outputs FOR INSERT TO authenticated
  WITH CHECK (organisation_id IN (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Table: decision_records — the core HAPP attribution record
-- ---------------------------------------------------------------------------

CREATE TABLE decision_records (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id     uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  system_id           uuid NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  system_run_id       uuid REFERENCES system_runs(id) ON DELETE SET NULL,
  ai_output_id        uuid NOT NULL REFERENCES ai_outputs(id) ON DELETE CASCADE,
  policy_version_id   uuid NOT NULL REFERENCES policy_versions(id),
  human_reviewer_id   uuid REFERENCES profiles(id),
  approval_id         uuid REFERENCES prove_approvals(id) ON DELETE SET NULL,
  provenance_id       uuid REFERENCES prove_provenance(id) ON DELETE SET NULL,
  source_type         text NOT NULL DEFAULT 'manual'
                        CHECK (source_type IN ('manual', 'api')),
  review_mode         text NOT NULL
                        CHECK (review_mode IN ('required', 'optional', 'auto_approved')),
  decision_status     text NOT NULL DEFAULT 'pending_review'
                        CHECK (decision_status IN ('pending_review', 'in_review', 'review_completed', 'anchoring_pending', 'anchored', 'failed')),
  human_decision      text CHECK (human_decision IN ('approved', 'rejected', 'escalated', 'modified')),
  human_rationale     text,
  reviewed_at         timestamptz,
  created_by          uuid REFERENCES profiles(id),
  verification_id     text UNIQUE,
  event_hash          text,
  chain_tx_hash       text,
  chain_status        text DEFAULT 'pending'
                        CHECK (chain_status IN ('pending', 'anchored', 'failed', 'skipped')),
  anchored_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_decisions_system   ON decision_records(system_id, reviewed_at DESC);
CREATE INDEX idx_decisions_reviewer ON decision_records(human_reviewer_id);
CREATE INDEX idx_decisions_status   ON decision_records(decision_status);
CREATE INDEX idx_decisions_org      ON decision_records(organisation_id);

ALTER TABLE decision_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view decisions in their org"
  ON decision_records FOR SELECT TO authenticated
  USING (organisation_id IN (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert decisions in their org"
  ON decision_records FOR INSERT TO authenticated
  WITH CHECK (organisation_id IN (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update decisions in their org"
  ON decision_records FOR UPDATE TO authenticated
  USING (organisation_id IN (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

-- ---------------------------------------------------------------------------
-- ALTER existing prove tables: add system/policy linkage
-- ---------------------------------------------------------------------------

ALTER TABLE prove_approvals
  ADD COLUMN IF NOT EXISTS system_id uuid REFERENCES systems(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS policy_version_id uuid REFERENCES policy_versions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_prove_approvals_system ON prove_approvals(system_id);

ALTER TABLE prove_provenance
  ADD COLUMN IF NOT EXISTS system_id uuid REFERENCES systems(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_prove_provenance_system ON prove_provenance(system_id);
