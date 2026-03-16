-- 023_attestation_expiry_revocation.sql

ALTER TABLE prove_attestations
  ADD COLUMN valid_until timestamptz,
  ADD COLUMN revoked_at timestamptz,
  ADD COLUMN revoked_by uuid REFERENCES profiles(id),
  ADD COLUMN revocation_reason text;

CREATE INDEX idx_prove_attestations_active
  ON prove_attestations (organisation_id)
  WHERE revoked_at IS NULL;

ALTER TABLE prove_incident_locks
  ADD COLUMN valid_until timestamptz,
  ADD COLUMN revoked_at timestamptz,
  ADD COLUMN revoked_by uuid REFERENCES profiles(id),
  ADD COLUMN revocation_reason text;
