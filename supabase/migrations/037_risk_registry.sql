-- ==========================================================================
-- Migration 037: Risk Registry with Full Lifecycle Management
-- ==========================================================================
-- Creates or extends risk_registry table with likelihood, impact,
-- inherent/residual scores, treatment plan, owner, and review schedule.
-- Supports 5x5 heatmap visualization (inherent + residual).
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. Enum types
-- --------------------------------------------------------------------------

CREATE TYPE risk_likelihood AS ENUM (
  'rare',
  'unlikely',
  'possible',
  'likely',
  'almost_certain'
);

CREATE TYPE risk_impact AS ENUM (
  'insignificant',
  'minor',
  'moderate',
  'major',
  'catastrophic'
);

CREATE TYPE risk_treatment AS ENUM (
  'accept',
  'mitigate',
  'transfer',
  'avoid'
);

CREATE TYPE risk_status AS ENUM (
  'open',
  'mitigated',
  'accepted',
  'closed'
);

-- --------------------------------------------------------------------------
-- 2. risk_registry table (create if not exists)
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS risk_registry (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  system_id           uuid REFERENCES systems(id) ON DELETE SET NULL,
  title               text NOT NULL,
  description         text,
  likelihood          risk_likelihood NOT NULL DEFAULT 'possible',
  impact              risk_impact NOT NULL DEFAULT 'moderate',
  inherent_score      integer GENERATED ALWAYS AS (
    CASE
      WHEN likelihood = 'rare' AND impact = 'insignificant' THEN 1
      WHEN likelihood = 'rare' AND impact = 'minor' THEN 2
      WHEN likelihood = 'rare' AND impact = 'moderate' THEN 3
      WHEN likelihood = 'rare' AND impact = 'major' THEN 4
      WHEN likelihood = 'rare' AND impact = 'catastrophic' THEN 5
      WHEN likelihood = 'unlikely' AND impact = 'insignificant' THEN 2
      WHEN likelihood = 'unlikely' AND impact = 'minor' THEN 4
      WHEN likelihood = 'unlikely' AND impact = 'moderate' THEN 6
      WHEN likelihood = 'unlikely' AND impact = 'major' THEN 8
      WHEN likelihood = 'unlikely' AND impact = 'catastrophic' THEN 10
      WHEN likelihood = 'possible' AND impact = 'insignificant' THEN 3
      WHEN likelihood = 'possible' AND impact = 'minor' THEN 6
      WHEN likelihood = 'possible' AND impact = 'moderate' THEN 9
      WHEN likelihood = 'possible' AND impact = 'major' THEN 12
      WHEN likelihood = 'possible' AND impact = 'catastrophic' THEN 15
      WHEN likelihood = 'likely' AND impact = 'insignificant' THEN 4
      WHEN likelihood = 'likely' AND impact = 'minor' THEN 8
      WHEN likelihood = 'likely' AND impact = 'moderate' THEN 12
      WHEN likelihood = 'likely' AND impact = 'major' THEN 16
      WHEN likelihood = 'likely' AND impact = 'catastrophic' THEN 20
      WHEN likelihood = 'almost_certain' AND impact = 'insignificant' THEN 5
      WHEN likelihood = 'almost_certain' AND impact = 'minor' THEN 10
      WHEN likelihood = 'almost_certain' AND impact = 'moderate' THEN 15
      WHEN likelihood = 'almost_certain' AND impact = 'major' THEN 20
      WHEN likelihood = 'almost_certain' AND impact = 'catastrophic' THEN 25
      ELSE 0
    END
  ) STORED,
  residual_score      integer,
  treatment           risk_treatment NOT NULL DEFAULT 'mitigate',
  owner_user_id       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  review_due_date     date,
  status              risk_status NOT NULL DEFAULT 'open',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_risk_registry_org ON risk_registry(org_id);
CREATE INDEX idx_risk_registry_system ON risk_registry(system_id);
CREATE INDEX idx_risk_registry_status ON risk_registry(status);
CREATE INDEX idx_risk_registry_owner ON risk_registry(owner_user_id);
CREATE INDEX idx_risk_registry_inherent_score ON risk_registry(inherent_score);
CREATE INDEX idx_risk_registry_review_due ON risk_registry(review_due_date);

-- --------------------------------------------------------------------------
-- 3. RLS Policies
-- --------------------------------------------------------------------------

ALTER TABLE risk_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY risk_registry_select ON risk_registry
  FOR SELECT
  USING (
    org_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY risk_registry_insert ON risk_registry
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY risk_registry_update ON risk_registry
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

CREATE POLICY risk_registry_delete ON risk_registry
  FOR DELETE
  USING (
    org_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );
