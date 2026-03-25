-- =============================================================================
-- Verisum — Baseline Schema (TG-32)
-- Reconstructed from live Supabase project on 2026-03-25.
-- This migration establishes the initial schema that pre-dates migrations 004+.
-- All statements are idempotent (IF NOT EXISTS / DO $$ ... END $$).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Custom ENUMs
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE tg_run_type AS ENUM ('org', 'sys');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tg_run_status AS ENUM ('not_started', 'in_progress', 'completed', 'stable', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tg_stability_status AS ENUM ('provisional', 'stable');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tg_survey_status AS ENUM ('active', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tg_escalation_severity AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tg_action_severity AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tg_action_status AS ENUM ('open', 'in_progress', 'blocked', 'done');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Core identity & billing tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS organisations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
  id uuid NOT NULL,
  email text NOT NULL,
  plan text NOT NULL DEFAULT 'explorer',
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  suspended_at timestamptz,
  suspended_reason text,
  organisation_id uuid,
  role text DEFAULT 'admin',
  full_name text,
  company_name text,
  company_size text
);

CREATE TABLE IF NOT EXISTS org_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  override_type text NOT NULL,
  override_value text NOT NULL,
  reason text NOT NULL,
  expires_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS admin_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL,
  granted_by uuid,
  granted_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  token text NOT NULL,
  team text,
  level text,
  location text,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);

CREATE TABLE IF NOT EXISTS api_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  created_by uuid NOT NULL,
  name text NOT NULL,
  key_hash text NOT NULL,
  key_prefix text NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY['outputs:write', 'decisions:write', 'decisions:read'],
  status text NOT NULL DEFAULT 'active',
  tier_at_creation text NOT NULL,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action_type text NOT NULL,
  performed_by uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vcc_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
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

-- ---------------------------------------------------------------------------
-- Org structure
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS subsidiaries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS functions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  subsidiary_id uuid,
  name text NOT NULL,
  is_project_type bool NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teams (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  function_id uuid NOT NULL,
  name text NOT NULL,
  is_adhoc bool NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- TrustOrg surveys
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS questions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  dimension text NOT NULL,
  prompt text NOT NULL,
  is_reverse_scored bool NOT NULL DEFAULT false,
  sort_order int4 NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS survey_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  opens_at timestamptz,
  closes_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  mode text NOT NULL DEFAULT 'org',
  owner_user_id uuid
);

CREATE TABLE IF NOT EXISTS responses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  invite_token text NOT NULL,
  question_id uuid NOT NULL,
  value int4 NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS run_admin_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trustorg_surveys (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  status tg_survey_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trustorg_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL,
  version_number int4 NOT NULL DEFAULT 1,
  status tg_run_status NOT NULL DEFAULT 'not_started',
  score numeric,
  dimension_scores jsonb,
  confidence_factor numeric,
  drift_from_previous numeric,
  stability_status tg_stability_status NOT NULL DEFAULT 'provisional',
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  legacy_survey_run_id uuid
);

CREATE TABLE IF NOT EXISTS tg_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  run_type tg_run_type NOT NULL,
  dimension_id uuid,
  question_id text,
  value numeric,
  answer jsonb,
  evidence jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dimensions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type tg_run_type NOT NULL,
  name text NOT NULL,
  weight numeric NOT NULL DEFAULT 1.0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- TrustSys system assessments
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS systems (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  version_label text NOT NULL DEFAULT '',
  archived bool NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  type text,
  environment text,
  ai_vendor_id uuid,
  risk_category text DEFAULT 'unassessed',
  owner_name text,
  owner_role text,
  compliance_tags text[] DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS system_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  system_id uuid NOT NULL,
  version_label text,
  status text NOT NULL DEFAULT 'draft',
  question_set_version text NOT NULL DEFAULT 'v1',
  overall_score int4,
  dimension_scores jsonb,
  risk_flags jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  model_snapshot jsonb
);

CREATE TABLE IF NOT EXISTS system_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  question_id text NOT NULL,
  answer jsonb NOT NULL,
  evidence jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS system_recommendations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  question_id text NOT NULL,
  dimension text NOT NULL,
  control text NOT NULL,
  priority text NOT NULL,
  recommendation text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS system_assessments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  system_id uuid NOT NULL,
  dimension_scores jsonb NOT NULL DEFAULT '{}',
  overall_score numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trustsys_assessments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  system_name text NOT NULL,
  version_label text,
  system_type text,
  environment text,
  autonomy_level numeric NOT NULL DEFAULT 1,
  criticality_level numeric NOT NULL DEFAULT 1,
  reassessment_frequency_days int4 DEFAULT 90,
  archived bool NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  happ_enforced bool,
  happ_proof_id text,
  legacy_system_id uuid
);

CREATE TABLE IF NOT EXISTS trustsys_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL,
  version_number int4 NOT NULL DEFAULT 1,
  status tg_run_status NOT NULL DEFAULT 'not_started',
  score numeric,
  dimension_scores jsonb,
  risk_flags jsonb,
  stability_status tg_stability_status NOT NULL DEFAULT 'provisional',
  variance_last_3 numeric,
  drift_flag bool NOT NULL DEFAULT false,
  drift_from_previous numeric,
  question_set_version text NOT NULL DEFAULT 'v1',
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  legacy_system_run_id uuid
);

-- ---------------------------------------------------------------------------
-- TrustGraph: escalations, drift, reassessment
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS escalations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  linked_run_id uuid,
  linked_run_type tg_run_type,
  linked_action_id uuid,
  reason text NOT NULL,
  severity tg_escalation_severity NOT NULL DEFAULT 'medium',
  resolved bool NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  source_signal_id uuid,
  assigned_to uuid,
  assigned_at timestamptz,
  resolution_note text,
  status text NOT NULL DEFAULT 'open'
);

CREATE TABLE IF NOT EXISTS escalation_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  escalation_id uuid NOT NULL,
  author_id uuid NOT NULL,
  content text NOT NULL,
  note_type text NOT NULL DEFAULT 'comment',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS escalation_action_links (
  escalation_id uuid NOT NULL,
  action_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drift_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  run_type tg_run_type NOT NULL,
  delta_score numeric NOT NULL,
  dimension_id uuid,
  drift_flag bool NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reassessment_policies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  run_type tg_run_type NOT NULL,
  target_id uuid,
  frequency_days int4 NOT NULL DEFAULT 90,
  last_completed timestamptz,
  next_due timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trustgraph_recalc_queue (
  organisation_id uuid NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS runtime_signals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  system_name text NOT NULL,
  signal_type text NOT NULL,
  metric_name text NOT NULL,
  metric_value numeric NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  severity text NOT NULL DEFAULT 'info',
  context jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Actions / remediation tracking
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS actions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  severity text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  owner_id uuid,
  due_date timestamptz,
  linked_run_id uuid,
  linked_run_type text,
  dimension_id text,
  evidence jsonb,
  evidence_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  ticket_provider text,
  ticket_key text,
  ticket_url text,
  source_type text
);

CREATE TABLE IF NOT EXISTS action_updates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  action_id uuid NOT NULL,
  updated_by uuid,
  update_type text NOT NULL,
  previous_value jsonb,
  new_value jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- AI Governance Copilot
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ai_policies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  policy_type text NOT NULL,
  version int4 NOT NULL DEFAULT 1,
  content text NOT NULL,
  questionnaire jsonb,
  generated_by text NOT NULL DEFAULT 'claude-sonnet',
  is_edited bool NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  title text,
  approved_by uuid,
  approved_at timestamptz
);

CREATE TABLE IF NOT EXISTS policy_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  policy_id uuid NOT NULL,
  version int4 NOT NULL,
  title text NOT NULL,
  policy_hash text NOT NULL,
  content_snapshot jsonb NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  effective_from timestamptz,
  effective_until timestamptz,
  published_by uuid,
  published_at timestamptz,
  superseded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS policy_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  policy_id uuid NOT NULL,
  event_type text NOT NULL,
  version int4,
  performed_by uuid,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS declaration_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  label text,
  expires_at timestamptz,
  is_active bool NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS declaration_invites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL,
  email text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz
);

CREATE TABLE IF NOT EXISTS staff_declarations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  token_id uuid NOT NULL,
  staff_name text NOT NULL,
  staff_email text,
  department text,
  tools_declared jsonb NOT NULL DEFAULT '[]',
  additional_notes text,
  declared_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_vendors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  vendor_name text NOT NULL,
  vendor_url text,
  data_location text,
  data_types jsonb DEFAULT '[]',
  risk_category text,
  auto_scored bool NOT NULL DEFAULT false,
  manual_override bool NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'manual',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS incidents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  ai_vendor_id uuid,
  impact_level text NOT NULL DEFAULT 'low',
  resolution text,
  status text NOT NULL DEFAULT 'open',
  reported_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  edited_by uuid,
  source_escalation_id uuid,
  source_signal_id uuid,
  system_id uuid
);

CREATE TABLE IF NOT EXISTS regulatory_updates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  summary text NOT NULL,
  source_url text,
  jurisdictions text[] NOT NULL DEFAULT '{}',
  sector_tags text[] DEFAULT '{}',
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS monthly_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  report_month text NOT NULL,
  report_data jsonb NOT NULL DEFAULT '{}',
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Governance Wizard & Packs
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS governance_wizard (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  version int4 NOT NULL DEFAULT 1,
  responses jsonb NOT NULL DEFAULT '{}',
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS governance_packs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  wizard_id uuid NOT NULL,
  version int4 NOT NULL DEFAULT 1,
  statement_md text,
  inventory_json jsonb,
  gap_analysis_md text,
  status text NOT NULL DEFAULT 'generating',
  generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Compliance frameworks
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS compliance_frameworks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  name text NOT NULL,
  short_name text,
  coverage_pct int4 NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'on_track',
  due_date date,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS compliance_requirements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  title text NOT NULL,
  description text,
  jurisdiction text NOT NULL,
  framework text NOT NULL,
  risk_categories text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS system_compliance_map (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  system_id uuid NOT NULL,
  requirement_id uuid NOT NULL,
  status text DEFAULT 'not_assessed',
  notes text,
  assessed_at timestamptz,
  assessed_by uuid,
  created_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Model registry & IBG (Intelligent Behaviour Governance)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS model_registry (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  model_name text NOT NULL,
  model_version text NOT NULL,
  provider text,
  model_type text,
  capabilities text[],
  training_data_sources text[],
  deployment_date date,
  retired_date date,
  status text NOT NULL DEFAULT 'active',
  parent_model_id uuid,
  model_card_url text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS system_model_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  system_id uuid NOT NULL,
  model_id uuid NOT NULL,
  role text DEFAULT 'primary',
  added_at timestamptz NOT NULL DEFAULT now(),
  added_by uuid
);

CREATE TABLE IF NOT EXISTS system_policy_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  system_id uuid NOT NULL,
  policy_id uuid NOT NULL,
  link_type text NOT NULL DEFAULT 'applies_to',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ibg_specifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL,
  organisation_id uuid NOT NULL,
  version int4 NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft',
  authorised_goals jsonb NOT NULL DEFAULT '[]',
  decision_authorities jsonb NOT NULL DEFAULT '[]',
  action_spaces jsonb NOT NULL DEFAULT '[]',
  blast_radius jsonb NOT NULL DEFAULT '{}',
  effective_from timestamptz,
  effective_until timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ibg_change_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ibg_spec_id uuid NOT NULL,
  change_type text NOT NULL,
  previous_value jsonb,
  new_value jsonb,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- AI Outputs, Decision Records, Prove module
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ai_outputs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  system_id uuid NOT NULL,
  system_run_id uuid,
  model_id uuid,
  source_type text NOT NULL DEFAULT 'manual',
  external_event_id text,
  input_hash text,
  output_hash text NOT NULL,
  output_summary text NOT NULL,
  output_type text,
  raw_output_ref text,
  confidence_score numeric,
  risk_signal text,
  occurred_at timestamptz NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  api_key_id uuid,
  context jsonb
);

CREATE TABLE IF NOT EXISTS decision_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  system_id uuid NOT NULL,
  system_run_id uuid,
  ai_output_id uuid NOT NULL,
  policy_version_id uuid NOT NULL,
  human_reviewer_id uuid,
  approval_id uuid,
  provenance_id uuid,
  source_type text NOT NULL DEFAULT 'manual',
  review_mode text NOT NULL,
  decision_status text NOT NULL DEFAULT 'pending_review',
  human_decision text,
  human_rationale text,
  reviewed_at timestamptz,
  created_by uuid,
  verification_id text,
  event_hash text,
  chain_tx_hash text,
  chain_status text DEFAULT 'pending',
  anchored_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  oversight_mode text,
  assurance_grade text,
  api_key_id uuid,
  external_reviewer_email text,
  external_reviewer_name text,
  external_reviewed_at timestamptz,
  identity_assurance_level text,
  identity_assurance_method text,
  action_binding_level text,
  action_binding_method text
);

CREATE TABLE IF NOT EXISTS prove_attestations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  title text NOT NULL,
  statement text NOT NULL,
  posture_snapshot jsonb,
  attested_by uuid NOT NULL,
  attested_at timestamptz NOT NULL DEFAULT now(),
  verification_id text,
  event_hash text,
  chain_tx_hash text,
  chain_status text DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  revoked_at timestamptz,
  revoked_by uuid,
  revocation_reason text
);

CREATE TABLE IF NOT EXISTS prove_approvals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  risk_level text NOT NULL DEFAULT 'medium',
  requested_by uuid,
  assigned_to uuid,
  status text NOT NULL DEFAULT 'pending',
  decision_note text,
  decided_at timestamptz,
  decided_by uuid,
  event_hash text,
  chain_tx_hash text,
  chain_status text DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  system_id uuid,
  policy_version_id uuid
);

CREATE TABLE IF NOT EXISTS prove_provenance (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  title text NOT NULL,
  ai_system text,
  model_version text,
  output_description text,
  data_sources text[],
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  verification_id text,
  event_hash text,
  chain_tx_hash text,
  chain_status text DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  model_id uuid,
  system_id uuid
);

CREATE TABLE IF NOT EXISTS prove_exchanges (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  proof_type text NOT NULL,
  proof_id uuid NOT NULL,
  verification_id text NOT NULL,
  shared_with_name text NOT NULL,
  shared_with_email text,
  note text,
  shared_by uuid,
  shared_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prove_incident_locks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  incident_id uuid NOT NULL,
  lock_reason text,
  snapshot jsonb NOT NULL DEFAULT '{}',
  locked_by uuid,
  locked_at timestamptz NOT NULL DEFAULT now(),
  verification_id text,
  event_hash text,
  chain_tx_hash text,
  chain_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  revoked_at timestamptz,
  revoked_by uuid,
  revocation_reason text
);

-- ---------------------------------------------------------------------------
-- Integrations
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS integration_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'disconnected',
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  last_synced_at timestamptz,
  sync_config jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
