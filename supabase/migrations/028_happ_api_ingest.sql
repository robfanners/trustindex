-- 028_happ_api_ingest.sql
-- HAPP API Ingest: API keys, assurance grading, oversight modes, context

-- ---------------------------------------------------------------------------
-- Table: api_keys — org-scoped API keys for external system access
-- ---------------------------------------------------------------------------

CREATE TABLE api_keys (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id   uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_by        uuid NOT NULL REFERENCES profiles(id),
  name              text NOT NULL,
  key_hash          text NOT NULL UNIQUE,
  key_prefix        text NOT NULL,
  scopes            text[] NOT NULL DEFAULT ARRAY['outputs:write', 'decisions:write', 'decisions:read'],
  status            text NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'revoked', 'expired')),
  tier_at_creation  text NOT NULL,
  last_used_at      timestamptz,
  expires_at        timestamptz,
  revoked_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_keys_org       ON api_keys(organisation_id);
CREATE INDEX idx_api_keys_hash      ON api_keys(key_hash);
CREATE INDEX idx_api_keys_status    ON api_keys(organisation_id, status);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view API keys in their org"
  ON api_keys FOR SELECT TO authenticated
  USING (organisation_id IN (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert API keys in their org"
  ON api_keys FOR INSERT TO authenticated
  WITH CHECK (organisation_id IN (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update API keys in their org"
  ON api_keys FOR UPDATE TO authenticated
  USING (organisation_id IN (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete API keys in their org"
  ON api_keys FOR DELETE TO authenticated
  USING (organisation_id IN (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

-- ---------------------------------------------------------------------------
-- ALTER decision_records: add assurance grading + oversight + API key columns
-- ---------------------------------------------------------------------------

ALTER TABLE decision_records
  ADD COLUMN IF NOT EXISTS oversight_mode text
    CHECK (oversight_mode IN ('in_the_loop', 'on_the_loop')),
  ADD COLUMN IF NOT EXISTS assurance_grade text
    CHECK (assurance_grade IN ('gold', 'silver', 'bronze')),
  ADD COLUMN IF NOT EXISTS api_key_id uuid REFERENCES api_keys(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS external_reviewer_email text,
  ADD COLUMN IF NOT EXISTS external_reviewer_name text,
  ADD COLUMN IF NOT EXISTS external_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS identity_assurance_level text
    CHECK (identity_assurance_level IN ('ial_1', 'ial_2', 'ial_3')),
  ADD COLUMN IF NOT EXISTS identity_assurance_method text,
  ADD COLUMN IF NOT EXISTS action_binding_level text
    CHECK (action_binding_level IN ('ab_1', 'ab_2', 'ab_3')),
  ADD COLUMN IF NOT EXISTS action_binding_method text;

CREATE INDEX IF NOT EXISTS idx_decisions_grade ON decision_records(assurance_grade);
CREATE INDEX IF NOT EXISTS idx_decisions_oversight ON decision_records(oversight_mode);
CREATE INDEX IF NOT EXISTS idx_decisions_api_key ON decision_records(api_key_id);

-- ---------------------------------------------------------------------------
-- ALTER ai_outputs: add context + API key columns
-- ---------------------------------------------------------------------------

ALTER TABLE ai_outputs
  ADD COLUMN IF NOT EXISTS api_key_id uuid REFERENCES api_keys(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS context jsonb;

-- ---------------------------------------------------------------------------
-- Backfill existing records
-- ---------------------------------------------------------------------------

UPDATE decision_records
  SET oversight_mode = 'in_the_loop',
      assurance_grade = 'silver'
  WHERE oversight_mode IS NULL;
