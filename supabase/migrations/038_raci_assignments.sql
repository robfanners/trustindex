-- ==========================================================================
-- Migration 038: RACI (Responsible/Accountable/Consulted/Informed)
-- ==========================================================================
-- Assigns accountability roles (RACI) to org entities (systems, controls,
-- risks, policies, incidents) for distributed governance.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. Enum types
-- --------------------------------------------------------------------------

CREATE TYPE raci_entity_type AS ENUM (
  'system',
  'control',
  'risk',
  'policy',
  'incident'
);

CREATE TYPE raci_role AS ENUM (
  'responsible',
  'accountable',
  'consulted',
  'informed'
);

-- --------------------------------------------------------------------------
-- 2. raci_assignments table
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS raci_assignments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  entity_type         raci_entity_type NOT NULL,
  entity_id           uuid NOT NULL,
  user_id             uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role                raci_role NOT NULL,
  assigned_at         timestamptz NOT NULL DEFAULT now(),
  assigned_by         uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE(entity_type, entity_id, user_id, role)
);

CREATE INDEX idx_raci_assignments_org ON raci_assignments(org_id);
CREATE INDEX idx_raci_assignments_entity ON raci_assignments(entity_type, entity_id);
CREATE INDEX idx_raci_assignments_user ON raci_assignments(user_id);
CREATE INDEX idx_raci_assignments_role ON raci_assignments(role);

-- --------------------------------------------------------------------------
-- 3. RLS Policies
-- --------------------------------------------------------------------------

ALTER TABLE raci_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY raci_assignments_select ON raci_assignments
  FOR SELECT
  USING (
    org_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY raci_assignments_insert ON raci_assignments
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY raci_assignments_update ON raci_assignments
  FOR UPDATE
  USING (
    org_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY raci_assignments_delete ON raci_assignments
  FOR DELETE
  USING (
    org_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );
