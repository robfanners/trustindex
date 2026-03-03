-- ==========================================================================
-- Migration 016: Copilot UX Improvements
-- ==========================================================================
-- 1. declaration_invites — track email invitations for declaration campaigns
-- 2. incidents — add edited_at/edited_by for audit trail

-- --------------------------------------------------------------------------
-- 1. declaration_invites
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS declaration_invites (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id        uuid NOT NULL REFERENCES declaration_tokens(id) ON DELETE CASCADE,
  email           text NOT NULL,
  sent_at         timestamptz NOT NULL DEFAULT now(),
  submitted_at    timestamptz
);

CREATE INDEX idx_declaration_invites_token ON declaration_invites(token_id);
CREATE INDEX idx_declaration_invites_email ON declaration_invites(email);

ALTER TABLE declaration_invites ENABLE ROW LEVEL SECURITY;

-- Invites are org-scoped through token ownership — use service role for writes
CREATE POLICY "Users can view invites for own org tokens"
  ON declaration_invites FOR SELECT TO authenticated
  USING (token_id IN (
    SELECT id FROM declaration_tokens
    WHERE organisation_id = (SELECT organisation_id FROM profiles WHERE id = auth.uid())
  ));

-- --------------------------------------------------------------------------
-- 2. Incident audit columns
-- --------------------------------------------------------------------------
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS edited_by uuid REFERENCES auth.users(id);
