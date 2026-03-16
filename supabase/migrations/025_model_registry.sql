-- 025_model_registry.sql
-- Model Registry: structured model cards, lineage, and system linkage

-- ---------------------------------------------------------------------------
-- Table: model_registry — the model card catalog
-- ---------------------------------------------------------------------------

CREATE TABLE model_registry (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id      uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  model_name           text NOT NULL,
  model_version        text NOT NULL,
  provider             text,
  model_type           text CHECK (model_type IN ('foundation', 'fine_tuned', 'custom', 'rag', 'agent', 'other')),
  capabilities         text[],
  training_data_sources text[],
  deployment_date      date,
  retired_date         date,
  status               text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired', 'evaluating')),
  parent_model_id      uuid REFERENCES model_registry(id) ON DELETE SET NULL,
  model_card_url       text,
  notes                text,
  created_by           uuid REFERENCES profiles(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organisation_id, model_name, model_version)
);

CREATE INDEX idx_model_registry_org    ON model_registry(organisation_id);
CREATE INDEX idx_model_registry_status ON model_registry(status);
CREATE INDEX idx_model_registry_parent ON model_registry(parent_model_id);

ALTER TABLE model_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view models in their org"
  ON model_registry FOR SELECT TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert models in their org"
  ON model_registry FOR INSERT TO authenticated
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update models in their org"
  ON model_registry FOR UPDATE TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION tg_model_registry_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_model_registry_updated_at
  BEFORE UPDATE ON model_registry FOR EACH ROW
  EXECUTE FUNCTION tg_model_registry_updated_at();

-- ---------------------------------------------------------------------------
-- Table: system_model_links — many-to-many system ↔ model
-- ---------------------------------------------------------------------------

CREATE TABLE system_model_links (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id  uuid NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  model_id   uuid NOT NULL REFERENCES model_registry(id) ON DELETE CASCADE,
  role       text DEFAULT 'primary' CHECK (role IN ('primary', 'fallback', 'evaluation', 'component')),
  added_at   timestamptz NOT NULL DEFAULT now(),
  added_by   uuid REFERENCES profiles(id),
  UNIQUE(system_id, model_id)
);

CREATE INDEX idx_system_model_links_system ON system_model_links(system_id);
CREATE INDEX idx_system_model_links_model  ON system_model_links(model_id);

ALTER TABLE system_model_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view model links for their systems"
  ON system_model_links FOR SELECT TO authenticated
  USING (
    system_id IN (
      SELECT s.id FROM systems s
      JOIN profiles p ON p.id = s.owner_id
      WHERE p.organisation_id IN (
        SELECT organisation_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert model links for their systems"
  ON system_model_links FOR INSERT TO authenticated
  WITH CHECK (
    system_id IN (
      SELECT s.id FROM systems s
      JOIN profiles p ON p.id = s.owner_id
      WHERE p.organisation_id IN (
        SELECT organisation_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete model links for their systems"
  ON system_model_links FOR DELETE TO authenticated
  USING (
    system_id IN (
      SELECT s.id FROM systems s
      JOIN profiles p ON p.id = s.owner_id
      WHERE p.organisation_id IN (
        SELECT organisation_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- ALTER system_runs: add model_snapshot for assessment-time proof
-- ---------------------------------------------------------------------------

ALTER TABLE system_runs
  ADD COLUMN IF NOT EXISTS model_snapshot jsonb;

COMMENT ON COLUMN system_runs.model_snapshot IS
  'Immutable snapshot of linked models at assessment submission time: [{model_id, model_name, model_version, provider, role}]';

-- ---------------------------------------------------------------------------
-- ALTER prove_provenance: optional structured model link
-- ---------------------------------------------------------------------------

ALTER TABLE prove_provenance
  ADD COLUMN IF NOT EXISTS model_id uuid REFERENCES model_registry(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_prove_provenance_model ON prove_provenance(model_id);
