-- ==========================================================================
-- Migration 035: AI Tool Sightings & Shadow AI Inventory
-- ==========================================================================
-- Tracks detected AI tools used across the organization with detection method,
-- status (unreviewed/approved/blocked/investigating), assignment, and notes.
-- Seed with 6 common AI tools.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. Enum types
-- --------------------------------------------------------------------------

CREATE TYPE ai_sighting_detection_method AS ENUM (
  'manual',
  'email',
  'browser_extension',
  'integration'
);

CREATE TYPE ai_sighting_status AS ENUM (
  'unreviewed',
  'approved',
  'blocked',
  'investigating'
);

-- --------------------------------------------------------------------------
-- 2. ai_tool_sightings table
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ai_tool_sightings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  tool_name           text NOT NULL,
  domain              text,
  detected_via        ai_sighting_detection_method NOT NULL DEFAULT 'manual',
  first_seen          timestamptz NOT NULL DEFAULT now(),
  last_seen           timestamptz NOT NULL DEFAULT now(),
  status              ai_sighting_status NOT NULL DEFAULT 'unreviewed',
  assigned_to         uuid REFERENCES profiles(id) ON DELETE SET NULL,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_tool_sightings_org ON ai_tool_sightings(org_id);
CREATE INDEX idx_ai_tool_sightings_status ON ai_tool_sightings(status);
CREATE INDEX idx_ai_tool_sightings_assigned_to ON ai_tool_sightings(assigned_to);
CREATE INDEX idx_ai_tool_sightings_first_seen ON ai_tool_sightings(first_seen DESC);

-- --------------------------------------------------------------------------
-- 3. RLS Policies
-- --------------------------------------------------------------------------

ALTER TABLE ai_tool_sightings ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_tool_sightings_select ON ai_tool_sightings
  FOR SELECT
  USING (
    org_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY ai_tool_sightings_insert ON ai_tool_sightings
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY ai_tool_sightings_update ON ai_tool_sightings
  FOR UPDATE
  USING (
    org_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY ai_tool_sightings_delete ON ai_tool_sightings
  FOR DELETE
  USING (
    org_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );

-- --------------------------------------------------------------------------
-- 4. Seed 6 common AI tools
-- --------------------------------------------------------------------------

-- Get a sample org ID for seeding (first org in system)
-- Note: These are templates; real sightings are org-specific
-- This seed is informational; actual sightings come from user input

INSERT INTO ai_tool_sightings (org_id, tool_name, domain, detected_via, status, notes)
SELECT
  o.id,
  tool,
  domain,
  'manual'::ai_sighting_detection_method,
  'unreviewed'::ai_sighting_status,
  description
FROM organisations o, (
  VALUES
    ('ChatGPT', 'chat.openai.com', 'Popular conversational AI, widely used in teams'),
    ('Claude', 'claude.ai', 'Anthropic AI assistant, advanced reasoning'),
    ('GitHub Copilot', 'github.com', 'Code generation via IDE integration'),
    ('Google Gemini', 'gemini.google.com', 'Google multimodal AI assistant'),
    ('Perplexity AI', 'perplexity.ai', 'AI research and analysis tool'),
    ('Midjourney', 'midjourney.com', 'Image generation via Discord')
) AS tools(tool, domain, description)
LIMIT 1;
