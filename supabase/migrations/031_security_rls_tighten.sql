-- Migration 031: Security RLS tightening (TG-39, TG-40, TG-47)
-- Applied to production on 2026-04-13
-- This migration records the security fixes already applied via Supabase MCP

-- TG-39: Tighten responses table RLS
DROP POLICY IF EXISTS responses_insert_all ON responses;
DROP POLICY IF EXISTS responses_update_all ON responses;

CREATE POLICY "responses_insert_via_invite" ON responses
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM invites
      WHERE invites.run_id = responses.run_id
        AND invites.used_at IS NULL
    )
  );

CREATE POLICY "responses_update_via_invite" ON responses
  FOR UPDATE TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invites
      WHERE invites.run_id = responses.run_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM invites
      WHERE invites.run_id = responses.run_id
    )
  );

-- TG-40: Tighten invites table UPDATE RLS
DROP POLICY IF EXISTS invites_update_all ON invites;

CREATE POLICY "invites_update_respond" ON invites
  FOR UPDATE TO anon, authenticated
  USING (used_at IS NULL)
  WITH CHECK (used_at IS NOT NULL);

-- TG-47: Security P2 fixes
ALTER FUNCTION tg_bounded_penalty SET search_path = '';
ALTER FUNCTION tg_confidence_factor SET search_path = '';
ALTER FUNCTION tg_compliance_frameworks_updated_at SET search_path = '';

REVOKE SELECT ON trustgraph_health_mv FROM anon, authenticated;

ALTER TABLE trustgraph_recalc_queue ENABLE ROW LEVEL SECURITY;
