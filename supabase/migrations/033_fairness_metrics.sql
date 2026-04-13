-- ==========================================================================
-- Migration 033: Fairness & Bias Monitoring
-- ==========================================================================
-- Adds fairness metric types, fairness_metrics table, and fairness_assessments.
-- Supports demographic parity, equal opportunity, equalised odds, predictive
-- parity, and disparate impact ratio calculations.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. Enum type for fairness metric types
-- --------------------------------------------------------------------------

CREATE TYPE fairness_metric_type AS ENUM (
  'demographic_parity',
  'equal_opportunity',
  'equalised_odds',
  'predictive_parity',
  'disparate_impact'
);

-- --------------------------------------------------------------------------
-- 2. fairness_metrics — individual fairness metric records
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS fairness_metrics (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id           uuid NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  org_id              uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  metric_type         fairness_metric_type NOT NULL,
  protected_attribute text NOT NULL,
  group_a             text NOT NULL,
  group_b             text NOT NULL,
  value               numeric NOT NULL,
  threshold           numeric NOT NULL,
  passed              boolean NOT NULL,
  sampled_at          timestamptz NOT NULL,
  sample_size         integer,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fairness_metrics_system ON fairness_metrics(system_id);
CREATE INDEX idx_fairness_metrics_org ON fairness_metrics(org_id);
CREATE INDEX idx_fairness_metrics_metric_type ON fairness_metrics(metric_type);
CREATE INDEX idx_fairness_metrics_sampled_at ON fairness_metrics(sampled_at DESC);

-- --------------------------------------------------------------------------
-- 3. fairness_assessments — overall fairness assessment per system
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS fairness_assessments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id           uuid NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  org_id              uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  summary             text,
  overall_status      text NOT NULL DEFAULT 'draft',
  last_assessed_at    timestamptz,
  assessed_by         uuid REFERENCES auth.users(id),
  metric_count        integer DEFAULT 0,
  pass_count          integer DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE(system_id)
);

CREATE INDEX idx_fairness_assessments_system ON fairness_assessments(system_id);
CREATE INDEX idx_fairness_assessments_org ON fairness_assessments(org_id);
CREATE INDEX idx_fairness_assessments_overall_status ON fairness_assessments(overall_status);

-- --------------------------------------------------------------------------
-- 4. RLS Policies
-- --------------------------------------------------------------------------

-- fairness_metrics RLS
ALTER TABLE fairness_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY fairness_metrics_select ON fairness_metrics
  FOR SELECT
  USING (
    org_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY fairness_metrics_insert ON fairness_metrics
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY fairness_metrics_update ON fairness_metrics
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

CREATE POLICY fairness_metrics_delete ON fairness_metrics
  FOR DELETE
  USING (
    org_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );

-- fairness_assessments RLS
ALTER TABLE fairness_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY fairness_assessments_select ON fairness_assessments
  FOR SELECT
  USING (
    org_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY fairness_assessments_insert ON fairness_assessments
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY fairness_assessments_update ON fairness_assessments
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
