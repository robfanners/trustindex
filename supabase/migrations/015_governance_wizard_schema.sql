-- 015_governance_wizard_schema.sql
-- Tables for AI Governance Setup Wizard, Governance Packs, and Monthly Reports

-- GOVERNANCE_WIZARD — stores wizard run responses
CREATE TABLE IF NOT EXISTS governance_wizard (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  version         integer NOT NULL DEFAULT 1,
  responses       jsonb NOT NULL DEFAULT '{}',
  completed_at    timestamptz,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_governance_wizard_org ON governance_wizard(organisation_id);
CREATE INDEX idx_governance_wizard_org_version ON governance_wizard(organisation_id, version DESC);

ALTER TABLE governance_wizard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org wizard runs"
  ON governance_wizard FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own org wizard runs"
  ON governance_wizard FOR INSERT
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );

-- GOVERNANCE_PACKS — stores generated pack metadata + content
CREATE TABLE IF NOT EXISTS governance_packs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  wizard_id       uuid NOT NULL REFERENCES governance_wizard(id) ON DELETE CASCADE,
  version         integer NOT NULL DEFAULT 1,
  statement_md    text,
  inventory_json  jsonb,
  gap_analysis_md text,
  status          text NOT NULL DEFAULT 'generating' CHECK (status IN ('generating', 'ready', 'failed')),
  generated_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_governance_packs_org ON governance_packs(organisation_id);
CREATE INDEX idx_governance_packs_wizard ON governance_packs(wizard_id);

ALTER TABLE governance_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org packs"
  ON governance_packs FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );

-- MONTHLY_REPORTS — stores generated monthly report metadata
CREATE TABLE IF NOT EXISTS monthly_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  report_month    text NOT NULL,
  report_data     jsonb NOT NULL DEFAULT '{}',
  sent_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_monthly_reports_org ON monthly_reports(organisation_id);
CREATE UNIQUE INDEX idx_monthly_reports_org_month ON monthly_reports(organisation_id, report_month);

ALTER TABLE monthly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org reports"
  ON monthly_reports FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );
