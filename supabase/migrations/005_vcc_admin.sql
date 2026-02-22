-- ---------------------------------------------------------------------------
-- Verisum Control Console (VCC) — Admin roles, audit log, org overrides
-- ---------------------------------------------------------------------------
-- Run this in the Supabase SQL Editor.
-- ---------------------------------------------------------------------------

-- admin_roles: who has admin access and what role
CREATE TABLE IF NOT EXISTS admin_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('SUPER_ADMIN', 'ORG_SUPPORT', 'BILLING_ADMIN', 'ANALYTICS_VIEWER')),
  granted_by uuid REFERENCES auth.users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_admin_roles_user_id ON admin_roles(user_id);

-- vcc_audit_log: immutable audit trail (INSERT only — never UPDATE or DELETE)
CREATE TABLE IF NOT EXISTS vcc_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES auth.users(id),
  admin_email text NOT NULL,
  admin_role text NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  reason text NOT NULL,
  before_snapshot jsonb,
  after_snapshot jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vcc_audit_admin ON vcc_audit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_vcc_audit_target ON vcc_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_vcc_audit_action ON vcc_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_vcc_audit_created ON vcc_audit_log(created_at);

-- org_overrides: temporary plan limit overrides set by admins
CREATE TABLE IF NOT EXISTS org_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  override_type text NOT NULL CHECK (override_type IN ('max_surveys', 'max_systems', 'can_export')),
  override_value text NOT NULL,
  reason text NOT NULL,
  expires_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_org_overrides_user ON org_overrides(user_id);

-- Add suspend columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS suspended_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS suspended_reason text;
