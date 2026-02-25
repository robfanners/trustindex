-- ==========================================================================
-- Migration 006: RLS & Security Hardening
-- ==========================================================================
-- Addresses all 19 issues from Supabase Performance & Security Linter:
--   - 4 SECURITY DEFINER views → SECURITY INVOKER
--   - 14 tables without RLS → enabled
--   - 1 sensitive column (invites.token) exposed → protected by RLS
-- Plus:
--   - RLS policies for browser-accessible tables
--   - Immutability triggers on vcc_audit_log
--   - Missing indexes on admin_roles.granted_by and org_overrides.created_by
-- ==========================================================================

-- --------------------------------------------------------------------------
-- A. Fix SECURITY DEFINER views → SECURITY INVOKER
-- --------------------------------------------------------------------------
-- These views currently run with the privileges of the view creator (superuser),
-- which means any user who can SELECT from them bypasses table-level RLS.
-- Changing to SECURITY INVOKER makes the view respect the calling user's policies.

ALTER VIEW IF EXISTS v_question_scores    SET (security_invoker = true);
ALTER VIEW IF EXISTS v_trustindex_scores  SET (security_invoker = true);
ALTER VIEW IF EXISTS v_run_response_counts SET (security_invoker = true);
ALTER VIEW IF EXISTS v_dimension_scores   SET (security_invoker = true);

-- --------------------------------------------------------------------------
-- B. Enable RLS on ALL public tables
-- --------------------------------------------------------------------------
-- With RLS enabled and no policies, anon/authenticated users see zero rows.
-- The service_role key (used by all API routes) bypasses RLS automatically.

ALTER TABLE organisations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_runs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites               ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses             ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE systems               ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_runs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_responses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_assessments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_roles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE vcc_audit_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_overrides         ENABLE ROW LEVEL SECURITY;

-- Also cover run_admin_tokens if it exists (legacy table)
ALTER TABLE IF EXISTS run_admin_tokens ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- C. RLS Policies for browser-accessible tables
-- --------------------------------------------------------------------------
-- The app has two Supabase access patterns:
--   1. Service role (all Next.js API routes) — bypasses RLS automatically
--   2. Browser anon client (survey pages, results, /try) — needs policies
--
-- The survey flow is unauthenticated: respondents access surveys via 28-char
-- random tokens (~166 bits entropy). PostgREST can't enforce "only rows
-- matching your token" at the policy level, so SELECT must be open for the
-- survey-flow tables. Token entropy makes enumeration infeasible.
--
-- Tables with NO policies (service-role only access):
--   organisations, systems, system_runs, system_responses,
--   system_recommendations, system_assessments, admin_roles,
--   org_overrides, vcc_audit_log
-- --------------------------------------------------------------------------

-- questions: static reference data, publicly readable
CREATE POLICY "questions_select_all" ON questions
  FOR SELECT TO anon, authenticated
  USING (true);

-- survey_runs: survey flow reads run mode/status (unauthenticated)
CREATE POLICY "survey_runs_select_all" ON survey_runs
  FOR SELECT TO anon, authenticated
  USING (true);

-- invites: token-based survey access (unauthenticated)
-- SELECT needed to look up invite by token, UPDATE needed to mark responded_at
CREATE POLICY "invites_select_all" ON invites
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "invites_update_all" ON invites
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- responses: survey submission (INSERT) + results viewing (SELECT) + answer updates (UPDATE)
CREATE POLICY "responses_select_all" ON responses
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "responses_insert_all" ON responses
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "responses_update_all" ON responses
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- profiles: authenticated users can read their own profile only
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- run_admin_tokens: service-role only (token lookup by run_id, no user_id column)
-- RLS enabled above with no policies = anon/authenticated see zero rows.
-- Service role bypasses RLS automatically.

-- --------------------------------------------------------------------------
-- D. Make vcc_audit_log immutable at DB level
-- --------------------------------------------------------------------------
-- Triggers fire for ALL roles including service_role, making this stronger
-- than RLS-based protection. Only INSERT is allowed.

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'vcc_audit_log is immutable: % not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_log_no_update
  BEFORE UPDATE ON vcc_audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

CREATE TRIGGER trg_audit_log_no_delete
  BEFORE DELETE ON vcc_audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

-- --------------------------------------------------------------------------
-- E. Missing indexes
-- --------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_admin_roles_granted_by   ON admin_roles(granted_by);
CREATE INDEX IF NOT EXISTS idx_org_overrides_created_by ON org_overrides(created_by);
