-- ==========================================================================
-- Migration 032: Data Governance Capability
-- ==========================================================================
-- Adds data classification, residency tracking, and inventory for systems.
-- Supports capability #4 (Data Governance) — PII classification, retention.

-- 1. Add enum types for data classifications and residencies
CREATE TYPE data_classification AS ENUM (
  'none',
  'public',
  'internal',
  'confidential',
  'pii',
  'sensitive_pii',
  'phi',
  'financial'
);

CREATE TYPE data_residency AS ENUM (
  'uk',
  'eu',
  'us',
  'apac',
  'global',
  'unknown'
);

-- 2. Add columns to trustsys_assessments to track primary data governance state
ALTER TABLE trustsys_assessments ADD COLUMN IF NOT EXISTS primary_data_classification data_classification DEFAULT 'none';
ALTER TABLE trustsys_assessments ADD COLUMN IF NOT EXISTS primary_residency data_residency DEFAULT 'unknown';
ALTER TABLE trustsys_assessments ADD COLUMN IF NOT EXISTS processes_pii boolean DEFAULT false;

-- 3. Create system_data_inventory table
CREATE TABLE IF NOT EXISTS system_data_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES trustsys_assessments(id) ON DELETE CASCADE,
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  data_type text NOT NULL,
  classification data_classification NOT NULL DEFAULT 'none',
  residency data_residency NOT NULL DEFAULT 'unknown',
  volume_estimate text,
  retention_days integer,
  source_description text,
  processor text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_system_data_inventory_assessment ON system_data_inventory(assessment_id);
CREATE INDEX idx_system_data_inventory_org ON system_data_inventory(organisation_id);
CREATE INDEX idx_system_data_inventory_classification ON system_data_inventory(classification);

-- 4. Enable RLS on system_data_inventory
ALTER TABLE system_data_inventory ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can only see inventory for assessments in their org
CREATE POLICY "system_data_inventory_read" ON system_data_inventory
  FOR SELECT TO authenticated, anon
  USING (
    organisation_id IN (
      SELECT organisation_id FROM trustsys_assessments
      WHERE trustsys_assessments.id = system_data_inventory.assessment_id
        AND organisation_id IN (
          SELECT organisation_id FROM profiles WHERE id = auth.uid()
        )
    )
  );

CREATE POLICY "system_data_inventory_insert" ON system_data_inventory
  FOR INSERT TO authenticated
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "system_data_inventory_update" ON system_data_inventory
  FOR UPDATE TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "system_data_inventory_delete" ON system_data_inventory
  FOR DELETE TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );
