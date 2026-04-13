-- ==========================================================================
-- Migration 036: Control → Evidence Mapping (Compliance Frameworks)
-- ==========================================================================
-- Maps AI governance controls to evidence artifacts (documents, attestations,
-- system runs, policies, external links) to demonstrate compliance with
-- ISO 42001, EU AI Act, and other frameworks.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. Enum types
-- --------------------------------------------------------------------------

CREATE TYPE evidence_link_type AS ENUM (
  'attestation',
  'document',
  'system_run',
  'policy',
  'external_link'
);

-- --------------------------------------------------------------------------
-- 2. control_evidence_links table
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS control_evidence_links (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  framework_code      text NOT NULL,
  control_id          text NOT NULL,
  evidence_type       evidence_link_type NOT NULL,
  evidence_ref        text,
  evidence_url        text,
  linked_at           timestamptz NOT NULL DEFAULT now(),
  linked_by           uuid REFERENCES profiles(id) ON DELETE SET NULL,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_control_evidence_links_org ON control_evidence_links(org_id);
CREATE INDEX idx_control_evidence_links_framework ON control_evidence_links(framework_code);
CREATE INDEX idx_control_evidence_links_control ON control_evidence_links(control_id);
CREATE INDEX idx_control_evidence_links_evidence_type ON control_evidence_links(evidence_type);

-- --------------------------------------------------------------------------
-- 3. RLS Policies
-- --------------------------------------------------------------------------

ALTER TABLE control_evidence_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY control_evidence_links_select ON control_evidence_links
  FOR SELECT
  USING (
    org_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY control_evidence_links_insert ON control_evidence_links
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY control_evidence_links_update ON control_evidence_links
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

CREATE POLICY control_evidence_links_delete ON control_evidence_links
  FOR DELETE
  USING (
    org_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );
