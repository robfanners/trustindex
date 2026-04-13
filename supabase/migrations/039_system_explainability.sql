-- ==========================================================================
-- Migration 039: System Explainability & Interpretability
-- ==========================================================================
-- Records AI model explainability methods (SHAP, LIME, feature importance,
-- rule-based, counterfactual, model card) with documentation and coverage.
-- Supports explainability scoring and model card integration.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. Enum types
-- --------------------------------------------------------------------------

CREATE TYPE explainability_method AS ENUM (
  'none',
  'feature_importance',
  'shap',
  'lime',
  'rule_based',
  'counterfactual',
  'model_card'
);

-- --------------------------------------------------------------------------
-- 2. system_explainability table
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS system_explainability (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id           uuid NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  org_id              uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  method              explainability_method NOT NULL DEFAULT 'none',
  documentation_url   text,
  last_reviewed_at    timestamptz,
  reviewer_notes      text,
  coverage_percent    numeric DEFAULT 0 CHECK (coverage_percent >= 0 AND coverage_percent <= 100),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE(system_id)
);

CREATE INDEX idx_system_explainability_system ON system_explainability(system_id);
CREATE INDEX idx_system_explainability_org ON system_explainability(org_id);
CREATE INDEX idx_system_explainability_method ON system_explainability(method);
CREATE INDEX idx_system_explainability_last_reviewed ON system_explainability(last_reviewed_at DESC);

-- --------------------------------------------------------------------------
-- 3. RLS Policies
-- --------------------------------------------------------------------------

ALTER TABLE system_explainability ENABLE ROW LEVEL SECURITY;

CREATE POLICY system_explainability_select ON system_explainability
  FOR SELECT
  USING (
    org_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY system_explainability_insert ON system_explainability
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY system_explainability_update ON system_explainability
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

CREATE POLICY system_explainability_delete ON system_explainability
  FOR DELETE
  USING (
    org_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );
