-- 012_actions_and_reports_fixes.sql
-- Adds ticket integration columns to actions, source_type for filtering,
-- and ensures action_updates table exists with correct schema.

-- 1. Add ticket integration columns to actions
ALTER TABLE actions ADD COLUMN IF NOT EXISTS ticket_provider TEXT;
ALTER TABLE actions ADD COLUMN IF NOT EXISTS ticket_key TEXT;
ALTER TABLE actions ADD COLUMN IF NOT EXISTS ticket_url TEXT;

-- 2. Add source_type for filtering actions by origin
ALTER TABLE actions ADD COLUMN IF NOT EXISTS source_type TEXT;
COMMENT ON COLUMN actions.source_type IS 'Origin: org_survey, system_assessment, or manual';

-- 3. Ensure action_updates table exists (may already exist from earlier migration)
CREATE TABLE IF NOT EXISTS action_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  update_type TEXT NOT NULL,
  previous_value JSONB,
  new_value JSONB,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_action_updates_action_id ON action_updates(action_id);
CREATE INDEX IF NOT EXISTS idx_actions_source_type ON actions(source_type);

-- RLS for action_updates (same org-scoped pattern as actions)
ALTER TABLE action_updates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'action_updates' AND policyname = 'action_updates_org_isolation'
  ) THEN
    CREATE POLICY action_updates_org_isolation ON action_updates
      FOR ALL
      USING (
        action_id IN (
          SELECT a.id FROM actions a
          JOIN profiles p ON p.organisation_id = a.organisation_id
          WHERE p.id = auth.uid()
        )
      );
  END IF;
END $$;
