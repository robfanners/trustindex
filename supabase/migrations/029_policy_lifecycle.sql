-- 029_policy_lifecycle.sql
-- Extends ai_policies for full lifecycle management (Phase 1 of Policies Module Upgrade)

-- Add title column (human-readable name, e.g. "AI Acceptable Use Policy v2")
ALTER TABLE ai_policies ADD COLUMN IF NOT EXISTS title text;

-- Expand policy_type to all 10 curated types
ALTER TABLE ai_policies DROP CONSTRAINT IF EXISTS ai_policies_policy_type_check;
ALTER TABLE ai_policies ADD CONSTRAINT ai_policies_policy_type_check
  CHECK (policy_type IN (
    'acceptable_use', 'data_handling', 'staff_guidelines',
    'risk_assessment', 'transparency', 'bias_monitoring',
    'vendor_management', 'incident_response', 'human_oversight',
    'model_lifecycle'
  ));

-- Extend status to support review workflow: draft → under_review → active → archived
-- Existing values (draft, active, archived) remain valid.
ALTER TABLE ai_policies DROP CONSTRAINT IF EXISTS ai_policies_status_check;
ALTER TABLE ai_policies ADD CONSTRAINT ai_policies_status_check
  CHECK (status IN ('draft', 'under_review', 'active', 'archived'));

-- Approval tracking
ALTER TABLE ai_policies ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id);
ALTER TABLE ai_policies ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Backfill: set title from policy_type for existing rows that lack one
UPDATE ai_policies SET title = CASE policy_type
  WHEN 'acceptable_use'    THEN 'AI Acceptable Use Policy'
  WHEN 'data_handling'     THEN 'AI Data Handling & Privacy'
  WHEN 'staff_guidelines'  THEN 'Staff Guidelines & Training'
  WHEN 'risk_assessment'   THEN 'AI Risk Assessment Policy'
  WHEN 'transparency'      THEN 'Transparency & Explainability'
  WHEN 'bias_monitoring'   THEN 'Bias Detection & Mitigation'
  WHEN 'vendor_management' THEN 'AI Vendor Management'
  WHEN 'incident_response' THEN 'AI Incident Response'
  WHEN 'human_oversight'   THEN 'Human Oversight & Escalation'
  WHEN 'model_lifecycle'   THEN 'Model Lifecycle Governance'
  ELSE initcap(replace(policy_type, '_', ' '))
END
WHERE title IS NULL;
