-- ==========================================================================
-- Migration 017: Prove Schema
-- ==========================================================================
-- Adds the "Prove" section tables for the Verisum Verify tier:
-- cryptographic proof and verification layer.
--   A) prove_approvals     -- human sign-off for high-risk AI actions
--   B) prove_attestations  -- signed governance attestation statements
--   C) prove_provenance    -- chain-of-custody records for AI outputs
--   D) Enable RLS on all Prove tables
--   E) Indexes for organisation_id and created_at
--   F) updated_at trigger for prove_approvals
-- ==========================================================================

-- --------------------------------------------------------------------------
-- A) prove_approvals
-- --------------------------------------------------------------------------
-- Approval requests requiring human sign-off for high-risk AI actions.

CREATE TABLE prove_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  risk_level text NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  requested_by uuid REFERENCES profiles(id),
  assigned_to uuid REFERENCES profiles(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  decision_note text,
  decided_at timestamptz,
  decided_by uuid REFERENCES profiles(id),
  event_hash text,
  chain_tx_hash text,
  chain_status text DEFAULT 'pending' CHECK (chain_status IN ('pending', 'anchored', 'failed', 'skipped')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------------
-- B) prove_attestations
-- --------------------------------------------------------------------------
-- Signed governance attestation statements.

CREATE TABLE prove_attestations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  title text NOT NULL,
  statement text NOT NULL,
  posture_snapshot jsonb,
  attested_by uuid NOT NULL REFERENCES profiles(id),
  attested_at timestamptz NOT NULL DEFAULT now(),
  verification_id text UNIQUE,
  event_hash text,
  chain_tx_hash text,
  chain_status text DEFAULT 'pending' CHECK (chain_status IN ('pending', 'anchored', 'failed', 'skipped')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------------
-- C) prove_provenance
-- --------------------------------------------------------------------------
-- Chain-of-custody records for AI outputs.

CREATE TABLE prove_provenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  title text NOT NULL,
  ai_system text,
  model_version text,
  output_description text,
  data_sources text[],
  reviewed_by uuid REFERENCES profiles(id),
  reviewed_at timestamptz,
  review_note text,
  verification_id text UNIQUE,
  event_hash text,
  chain_tx_hash text,
  chain_status text DEFAULT 'pending' CHECK (chain_status IN ('pending', 'anchored', 'failed', 'skipped')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------------
-- D) Enable RLS on all Prove tables
-- --------------------------------------------------------------------------
-- All Prove features are accessed via API routes using service role,
-- so RLS is enabled with default-deny (no permissive policies needed).

ALTER TABLE prove_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE prove_attestations ENABLE ROW LEVEL SECURITY;
ALTER TABLE prove_provenance ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- E) Indexes
-- --------------------------------------------------------------------------

CREATE INDEX idx_prove_approvals_org ON prove_approvals(organisation_id);
CREATE INDEX idx_prove_approvals_created ON prove_approvals(created_at DESC);

CREATE INDEX idx_prove_attestations_org ON prove_attestations(organisation_id);
CREATE INDEX idx_prove_attestations_created ON prove_attestations(created_at DESC);

CREATE INDEX idx_prove_provenance_org ON prove_provenance(organisation_id);
CREATE INDEX idx_prove_provenance_created ON prove_provenance(created_at DESC);

-- --------------------------------------------------------------------------
-- F) updated_at trigger for prove_approvals
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION tg_prove_approvals_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prove_approvals_updated_at
  BEFORE UPDATE ON prove_approvals
  FOR EACH ROW
  EXECUTE FUNCTION tg_prove_approvals_updated_at();
