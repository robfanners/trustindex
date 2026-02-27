-- ==========================================================================
-- Migration 011: Org Hierarchy + Integration Connections
-- ==========================================================================
-- New tables: subsidiaries, functions, teams, survey_scope, integration_connections
-- Auto-seeds a "Project" function for every existing organisation

-- --------------------------------------------------------------------------
-- 1. subsidiaries
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subsidiaries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_subsidiaries_org ON subsidiaries(organisation_id);

-- --------------------------------------------------------------------------
-- 2. functions
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS functions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  subsidiary_id   uuid REFERENCES subsidiaries(id) ON DELETE SET NULL,
  name            text NOT NULL,
  is_project_type boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_functions_org ON functions(organisation_id);
CREATE INDEX idx_functions_subsidiary ON functions(subsidiary_id);

-- --------------------------------------------------------------------------
-- 3. teams
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teams (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  function_id     uuid NOT NULL REFERENCES functions(id) ON DELETE CASCADE,
  name            text NOT NULL,
  is_adhoc        boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_teams_org ON teams(organisation_id);
CREATE INDEX idx_teams_function ON teams(function_id);

-- --------------------------------------------------------------------------
-- 4. survey_scope — junction: survey run <-> hierarchy selections
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS survey_scope (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_run_id uuid NOT NULL REFERENCES survey_runs(id) ON DELETE CASCADE,
  subsidiary_id uuid REFERENCES subsidiaries(id) ON DELETE SET NULL,
  function_id   uuid REFERENCES functions(id) ON DELETE SET NULL,
  team_id       uuid REFERENCES teams(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_survey_scope_run ON survey_scope(survey_run_id);

-- --------------------------------------------------------------------------
-- 5. integration_connections — OAuth token storage
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS integration_connections (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  provider         text NOT NULL,
  status           text NOT NULL DEFAULT 'disconnected',
  access_token     text,
  refresh_token    text,
  token_expires_at timestamptz,
  last_synced_at   timestamptz,
  sync_config      jsonb DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT integration_connections_provider_org_unique
    UNIQUE (organisation_id, provider)
);

CREATE INDEX idx_integration_connections_org ON integration_connections(organisation_id);

-- --------------------------------------------------------------------------
-- 6. updated_at triggers
-- --------------------------------------------------------------------------
CREATE TRIGGER trg_subsidiaries_updated_at BEFORE UPDATE ON subsidiaries
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER trg_functions_updated_at BEFORE UPDATE ON functions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER trg_teams_updated_at BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER trg_integration_connections_updated_at BEFORE UPDATE ON integration_connections
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- --------------------------------------------------------------------------
-- 7. RLS
-- --------------------------------------------------------------------------
ALTER TABLE subsidiaries             ENABLE ROW LEVEL SECURITY;
ALTER TABLE functions                ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_scope             ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_connections  ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS. For future authenticated access:
-- org-scoped read for any org member
CREATE POLICY "subsidiaries_org_read" ON subsidiaries
  FOR SELECT TO authenticated
  USING (organisation_id IN (
    SELECT organisation_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "functions_org_read" ON functions
  FOR SELECT TO authenticated
  USING (organisation_id IN (
    SELECT organisation_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "teams_org_read" ON teams
  FOR SELECT TO authenticated
  USING (organisation_id IN (
    SELECT organisation_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "survey_scope_org_read" ON survey_scope
  FOR SELECT TO authenticated
  USING (true);  -- scoped via survey_run join

CREATE POLICY "integration_connections_org_read" ON integration_connections
  FOR SELECT TO authenticated
  USING (organisation_id IN (
    SELECT organisation_id FROM profiles WHERE id = auth.uid()
  ));

-- --------------------------------------------------------------------------
-- 8. Auto-seed "Project" function for every existing organisation
-- --------------------------------------------------------------------------
INSERT INTO functions (organisation_id, name, is_project_type)
SELECT id, 'Project', true
FROM organisations
WHERE id IS NOT NULL;
