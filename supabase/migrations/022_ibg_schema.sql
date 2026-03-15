-- ---------------------------------------------------------------------------
-- 022 — Intent-Based Governance (IBG) Schema
-- ---------------------------------------------------------------------------
-- Adds first-class data model for IBG specifications:
--   Component 1: Authorised Goals
--   Component 2: Permitted Decision Authorities & Action Spaces
--   Component 3: Blast Radius Constraints
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. IBG Specifications table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ibg_specifications (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id        uuid NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  organisation_id      uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  version              integer NOT NULL DEFAULT 1,
  status               text NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft', 'active', 'superseded', 'archived')),

  -- Component 1: Authorised Goals
  -- Array of { goal: string, category: string, priority: "primary"|"secondary", rationale: string }
  authorised_goals     jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Component 2: Permitted Decision Authorities & Action Spaces
  -- Array of { authority: string, scope: string, constraints: string[], requires_human_approval: boolean, threshold_description: string }
  decision_authorities jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Array of { action_type: string, permitted: boolean, conditions: string, api_scope: string }
  action_spaces        jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Component 3: Blast Radius Constraints
  -- { entity_scope, financial_scope: { max_value, currency, period }, data_scope[], temporal_scope, cascade_scope, max_affected_users, geographic_scope[] }
  blast_radius         jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Lifecycle metadata
  effective_from       timestamptz,
  effective_until       timestamptz,
  approved_by          uuid REFERENCES auth.users(id),
  approved_at          timestamptz,
  created_by           uuid REFERENCES auth.users(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ibg_specs_assessment   ON ibg_specifications(assessment_id);
CREATE INDEX IF NOT EXISTS idx_ibg_specs_org           ON ibg_specifications(organisation_id);
CREATE INDEX IF NOT EXISTS idx_ibg_specs_status        ON ibg_specifications(status);

-- ---------------------------------------------------------------------------
-- 2. Enforce single active spec per assessment
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enforce_single_active_ibg()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' THEN
    UPDATE ibg_specifications
       SET status = 'superseded', updated_at = now()
     WHERE assessment_id = NEW.assessment_id
       AND status = 'active'
       AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_ibg_single_active
  BEFORE INSERT OR UPDATE ON ibg_specifications
  FOR EACH ROW EXECUTE FUNCTION enforce_single_active_ibg();

-- Auto-set updated_at
CREATE TRIGGER trg_ibg_specs_updated_at
  BEFORE UPDATE ON ibg_specifications
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Auto-increment version per assessment
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION ibg_auto_version()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT COALESCE(MAX(version), 0) + 1
      INTO NEW.version
      FROM ibg_specifications
     WHERE assessment_id = NEW.assessment_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_ibg_auto_version
  BEFORE INSERT ON ibg_specifications
  FOR EACH ROW EXECUTE FUNCTION ibg_auto_version();

-- ---------------------------------------------------------------------------
-- 4. IBG Change Log (immutable audit trail)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ibg_change_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ibg_spec_id     uuid NOT NULL REFERENCES ibg_specifications(id) ON DELETE CASCADE,
  change_type     text NOT NULL CHECK (change_type IN ('created', 'updated', 'activated', 'superseded', 'archived')),
  previous_value  jsonb,
  new_value       jsonb,
  changed_by      uuid REFERENCES auth.users(id),
  changed_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ibg_changelog_spec ON ibg_change_log(ibg_spec_id);

-- Immutability: prevent UPDATE/DELETE on change log
CREATE TRIGGER trg_ibg_changelog_no_update
  BEFORE UPDATE ON ibg_change_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_logs_mutation();

CREATE TRIGGER trg_ibg_changelog_no_delete
  BEFORE DELETE ON ibg_change_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_logs_mutation();

-- ---------------------------------------------------------------------------
-- 5. Auto-log IBG changes
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION ibg_log_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO ibg_change_log (ibg_spec_id, change_type, new_value, changed_by)
    VALUES (NEW.id, 'created', to_jsonb(NEW), NEW.created_by);
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO ibg_change_log (ibg_spec_id, change_type, previous_value, new_value, changed_by)
    VALUES (
      NEW.id,
      CASE
        WHEN NEW.status = 'active' AND OLD.status != 'active' THEN 'activated'
        WHEN NEW.status = 'superseded' AND OLD.status = 'active' THEN 'superseded'
        WHEN NEW.status = 'archived' THEN 'archived'
        ELSE 'updated'
      END,
      to_jsonb(OLD),
      to_jsonb(NEW),
      NEW.created_by
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_ibg_log_change
  AFTER INSERT OR UPDATE ON ibg_specifications
  FOR EACH ROW EXECUTE FUNCTION ibg_log_change();

-- ---------------------------------------------------------------------------
-- 6. IBG status is computed at query time from ibg_specifications table
-- (no denormalized column needed — the API routes query ibg_specifications directly)
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 7. Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE ibg_specifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ibg_change_log ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read IBG specs for their org
CREATE POLICY ibg_specs_select ON ibg_specifications
  FOR SELECT TO authenticated
  USING (organisation_id IN (
    SELECT organisation_id FROM profiles WHERE id = auth.uid()
  ));

-- Authenticated users can insert/update IBG specs for their org
CREATE POLICY ibg_specs_insert ON ibg_specifications
  FOR INSERT TO authenticated
  WITH CHECK (organisation_id IN (
    SELECT organisation_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY ibg_specs_update ON ibg_specifications
  FOR UPDATE TO authenticated
  USING (organisation_id IN (
    SELECT organisation_id FROM profiles WHERE id = auth.uid()
  ));

-- Service role bypass
CREATE POLICY ibg_specs_service ON ibg_specifications
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Change log: read-only for authenticated users in same org
CREATE POLICY ibg_changelog_select ON ibg_change_log
  FOR SELECT TO authenticated
  USING (ibg_spec_id IN (
    SELECT id FROM ibg_specifications WHERE organisation_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  ));

CREATE POLICY ibg_changelog_service ON ibg_change_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);
