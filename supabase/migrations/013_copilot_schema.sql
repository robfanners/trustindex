-- ==========================================================================
-- Migration 013: AI Governance Copilot Schema
-- ==========================================================================
-- New tables: ai_policies, declaration_tokens, staff_declarations,
--             ai_vendors, incidents, regulatory_updates
-- Supports: AI Policy Generator, Staff Declaration Portal, Vendor Register,
--           Incident Logging, Regulatory Feed

-- --------------------------------------------------------------------------
-- 1. ai_policies — LLM-generated governance documents
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_policies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  policy_type     text NOT NULL CHECK (policy_type IN ('acceptable_use', 'data_handling', 'staff_guidelines')),
  version         integer NOT NULL DEFAULT 1,
  content         text NOT NULL,
  questionnaire   jsonb,
  generated_by    text NOT NULL DEFAULT 'claude-sonnet',
  is_edited       boolean NOT NULL DEFAULT false,
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_policies_org ON ai_policies(organisation_id);
CREATE INDEX idx_ai_policies_type ON ai_policies(organisation_id, policy_type);

-- --------------------------------------------------------------------------
-- 2. declaration_tokens — shareable links for staff declarations
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS declaration_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  token           text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  label           text,
  expires_at      timestamptz,
  is_active       boolean NOT NULL DEFAULT true,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_declaration_tokens_token ON declaration_tokens(token);

-- --------------------------------------------------------------------------
-- 3. staff_declarations — individual staff AI usage declarations
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_declarations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  token_id        uuid NOT NULL REFERENCES declaration_tokens(id) ON DELETE CASCADE,
  staff_name      text NOT NULL,
  staff_email     text,
  department      text,
  tools_declared  jsonb NOT NULL DEFAULT '[]',
  additional_notes text,
  declared_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_staff_declarations_org ON staff_declarations(organisation_id);
CREATE INDEX idx_staff_declarations_token ON staff_declarations(token_id);

-- --------------------------------------------------------------------------
-- 4. ai_vendors — AI tool/vendor register
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_vendors (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  vendor_name     text NOT NULL,
  vendor_url      text,
  data_location   text,
  data_types      jsonb DEFAULT '[]',
  risk_category   text CHECK (risk_category IN ('minimal', 'limited', 'high', 'unacceptable', 'unassessed')),
  auto_scored     boolean NOT NULL DEFAULT false,
  manual_override boolean NOT NULL DEFAULT false,
  source          text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'declaration', 'integration')),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_vendors_org ON ai_vendors(organisation_id);

-- --------------------------------------------------------------------------
-- 5. incidents — AI-related incident logging
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS incidents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text,
  ai_vendor_id    uuid REFERENCES ai_vendors(id) ON DELETE SET NULL,
  impact_level    text NOT NULL DEFAULT 'low' CHECK (impact_level IN ('low', 'medium', 'high', 'critical')),
  resolution      text,
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
  reported_by     uuid REFERENCES auth.users(id),
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_incidents_org ON incidents(organisation_id);

-- --------------------------------------------------------------------------
-- 6. regulatory_updates — curated regulatory feed
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS regulatory_updates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  summary         text NOT NULL,
  source_url      text,
  jurisdiction    text NOT NULL DEFAULT 'uk' CHECK (jurisdiction IN ('uk', 'eu', 'us', 'global')),
  relevance_tags  jsonb DEFAULT '[]',
  sector_tags     jsonb DEFAULT '[]',
  published_at    timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_regulatory_updates_jurisdiction ON regulatory_updates(jurisdiction);

-- --------------------------------------------------------------------------
-- 7. RLS policies
-- --------------------------------------------------------------------------
ALTER TABLE ai_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE declaration_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_declarations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulatory_updates ENABLE ROW LEVEL SECURITY;

-- Org-scoped access for authenticated users
CREATE POLICY "Users can view own org ai_policies"
  ON ai_policies FOR SELECT TO authenticated
  USING (organisation_id = (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own org ai_policies"
  ON ai_policies FOR INSERT TO authenticated
  WITH CHECK (organisation_id = (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own org ai_policies"
  ON ai_policies FOR UPDATE TO authenticated
  USING (organisation_id = (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can view own org declaration_tokens"
  ON declaration_tokens FOR SELECT TO authenticated
  USING (organisation_id = (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage own org declaration_tokens"
  ON declaration_tokens FOR ALL TO authenticated
  USING (organisation_id = (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

-- Staff declarations: org users can read, anonymous insert handled via API with service role
CREATE POLICY "Users can view own org staff_declarations"
  ON staff_declarations FOR SELECT TO authenticated
  USING (organisation_id = (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can view own org ai_vendors"
  ON ai_vendors FOR SELECT TO authenticated
  USING (organisation_id = (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage own org ai_vendors"
  ON ai_vendors FOR ALL TO authenticated
  USING (organisation_id = (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can view own org incidents"
  ON incidents FOR SELECT TO authenticated
  USING (organisation_id = (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage own org incidents"
  ON incidents FOR ALL TO authenticated
  USING (organisation_id = (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

-- Regulatory updates: readable by all authenticated users (global content)
CREATE POLICY "All authenticated users can read regulatory_updates"
  ON regulatory_updates FOR SELECT TO authenticated
  USING (true);
