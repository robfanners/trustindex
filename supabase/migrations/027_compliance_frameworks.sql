-- 027_compliance_frameworks.sql
-- Tracks compliance framework coverage for the Control Centre dashboard

CREATE TABLE IF NOT EXISTS compliance_frameworks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  short_name text,
  coverage_pct integer NOT NULL DEFAULT 0 CHECK (coverage_pct BETWEEN 0 AND 100),
  status text NOT NULL DEFAULT 'on_track' CHECK (status IN ('on_track', 'at_risk', 'overdue', 'completed')),
  due_date date,
  notes text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique per org + name
CREATE UNIQUE INDEX idx_cf_org_name ON compliance_frameworks(organisation_id, name);
CREATE INDEX idx_cf_org_status ON compliance_frameworks(organisation_id, status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION tg_compliance_frameworks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_compliance_frameworks_updated_at
  BEFORE UPDATE ON compliance_frameworks
  FOR EACH ROW EXECUTE FUNCTION tg_compliance_frameworks_updated_at();

-- RLS
ALTER TABLE compliance_frameworks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org frameworks"
  ON compliance_frameworks FOR SELECT
  USING (organisation_id IN (
    SELECT organisation_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can manage own org frameworks"
  ON compliance_frameworks FOR ALL
  USING (organisation_id IN (
    SELECT organisation_id FROM profiles WHERE id = auth.uid()
  ));
