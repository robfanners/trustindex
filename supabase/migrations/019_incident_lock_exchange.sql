-- Migration 019: Incident Lock & Trust Exchange
-- Completes the Verify tier Prove features

-- ============================================================
-- prove_incident_locks — cryptographic snapshots of incidents
-- ============================================================

CREATE TABLE IF NOT EXISTS prove_incident_locks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  incident_id     uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  lock_reason     text,
  snapshot        jsonb NOT NULL DEFAULT '{}'::jsonb,
  locked_by       uuid REFERENCES profiles(id),
  locked_at       timestamptz NOT NULL DEFAULT now(),
  verification_id text UNIQUE,
  event_hash      text,
  chain_tx_hash   text,
  chain_status    text NOT NULL DEFAULT 'pending' CHECK (chain_status IN ('pending', 'anchored', 'failed', 'skipped')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_prove_incident_locks_org ON prove_incident_locks(organisation_id);
CREATE INDEX idx_prove_incident_locks_incident ON prove_incident_locks(incident_id);
CREATE INDEX idx_prove_incident_locks_created ON prove_incident_locks(created_at DESC);

ALTER TABLE prove_incident_locks ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- prove_exchanges — tracked proof sharing with external parties
-- ============================================================

CREATE TABLE IF NOT EXISTS prove_exchanges (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  proof_type      text NOT NULL CHECK (proof_type IN ('attestation', 'provenance', 'incident_lock')),
  proof_id        uuid NOT NULL,
  verification_id text NOT NULL,
  shared_with_name text NOT NULL,
  shared_with_email text,
  note            text,
  shared_by       uuid REFERENCES profiles(id),
  shared_at       timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_prove_exchanges_org ON prove_exchanges(organisation_id);
CREATE INDEX idx_prove_exchanges_type ON prove_exchanges(proof_type);
CREATE INDEX idx_prove_exchanges_created ON prove_exchanges(created_at DESC);

ALTER TABLE prove_exchanges ENABLE ROW LEVEL SECURITY;
