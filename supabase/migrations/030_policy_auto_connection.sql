-- 030_policy_auto_connection.sql
-- Phase 2: Auto-Connection Engine — links policies to systems + immutable audit trail

-- system_policy_links: connects policies to systems
CREATE TABLE IF NOT EXISTS system_policy_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  system_id uuid NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  policy_id uuid NOT NULL REFERENCES ai_policies(id) ON DELETE CASCADE,
  link_type text NOT NULL DEFAULT 'applies_to' CHECK (link_type IN ('applies_to', 'references', 'supersedes')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(system_id, policy_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_spl_org ON system_policy_links(organisation_id);
CREATE INDEX IF NOT EXISTS idx_spl_policy ON system_policy_links(policy_id);
CREATE INDEX IF NOT EXISTS idx_spl_system ON system_policy_links(system_id);

ALTER TABLE system_policy_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_access" ON system_policy_links
  FOR ALL USING (
    organisation_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );

-- policy_events: immutable audit trail for every policy lifecycle event
CREATE TABLE IF NOT EXISTS policy_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  policy_id uuid NOT NULL REFERENCES ai_policies(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'created', 'updated', 'status_changed', 'approved', 'archived',
    'content_edited', 'system_linked', 'system_unlinked', 'action_created'
  )),
  version integer,
  performed_by uuid REFERENCES auth.users(id),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pe_org ON policy_events(organisation_id);
CREATE INDEX IF NOT EXISTS idx_pe_policy ON policy_events(policy_id);
CREATE INDEX IF NOT EXISTS idx_pe_type ON policy_events(event_type);

ALTER TABLE policy_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_access" ON policy_events
  FOR ALL USING (
    organisation_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );
