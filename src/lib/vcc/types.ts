// ---------------------------------------------------------------------------
// VCC — Shared types for API responses and data models
// ---------------------------------------------------------------------------

import type { AdminRole } from "./permissions";

/** Admin user identity returned by /api/verisum-admin/me */
export type AdminIdentity = {
  id: string;
  email: string;
  roles: AdminRole[];
};

/** Platform-wide dashboard metrics */
export type DashboardMetrics = {
  totalUsers: number;
  planCounts: {
    explorer: number;
    pro: number;
    enterprise: number;
  };
  activeSystems: number;
  totalSystemRuns: number;
  suspendedCount: number;
  riskFlagCount: number;
  totalSurveys: number;
};

/** Organisation/user list item */
export type OrgListItem = {
  id: string;
  email: string;
  plan: string;
  created_at: string;
  suspended_at: string | null;
  survey_count: number;
  system_count: number;
};

/** Organisation detail */
export type OrgDetail = {
  id: string;
  email: string;
  plan: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  suspended_at: string | null;
  suspended_reason: string | null;
  surveys: OrgSurvey[];
  systems: OrgSystem[];
  overrides: OrgOverride[];
};

export type OrgSurvey = {
  id: string;
  title: string;
  mode: string;
  created_at: string;
  respondent_count: number;
};

export type OrgSystem = {
  id: string;
  name: string;
  version_label: string | null;
  type: string | null;
  environment: string | null;
  created_at: string;
  latest_score: number | null;
  run_count: number;
};

export type OrgOverride = {
  id: string;
  override_type: string;
  override_value: string;
  reason: string;
  expires_at: string | null;
  created_at: string;
  revoked_at: string | null;
};

// ---------------------------------------------------------------------------
// Phase 2: Survey Control types
// ---------------------------------------------------------------------------

/** Row in the cross-org survey list */
export type SurveyListItem = {
  id: string;
  title: string;
  mode: string;
  status: string;
  respondent_count: number;
  created_at: string;
  owner_email: string | null;
};

/** Full survey detail for the VCC detail page */
export type SurveyDetail = {
  id: string;
  title: string;
  mode: string;
  status: string;
  respondent_count: number;
  opens_at: string | null;
  created_at: string;
  owner_user_id: string | null;
  owner_email: string | null;
  organisation_id: string | null;
  invites: SurveyInvite[];
};

export type SurveyInvite = {
  id: string;
  token: string;
  team: string | null;
  level: string | null;
  location: string | null;
};

// ---------------------------------------------------------------------------
// Phase 2: System Control types
// ---------------------------------------------------------------------------

/** Row in the cross-org system list */
export type SystemListItem = {
  id: string;
  name: string;
  type: string | null;
  environment: string | null;
  archived: boolean;
  created_at: string;
  owner_email: string | null;
  latest_score: number | null;
  run_count: number;
};

/** Full system detail for the VCC detail page */
export type SystemDetail = {
  id: string;
  name: string;
  version_label: string | null;
  type: string | null;
  environment: string | null;
  archived: boolean;
  created_at: string;
  owner_id: string;
  owner_email: string | null;
  runs: SystemRunSummary[];
};

export type SystemRunSummary = {
  id: string;
  version_label: string | null;
  status: "draft" | "submitted";
  overall_score: number | null;
  dimension_scores: Record<string, number> | null;
  risk_flags: RiskFlagItem[];
  created_at: string;
  submitted_at: string | null;
};

export type RiskFlagItem = {
  code: string;
  label: string;
  description: string;
  source?: "computed" | "admin";
};

// ---------------------------------------------------------------------------
// Phase 2: Risk Monitor types
// ---------------------------------------------------------------------------

/** Row in the risk monitor list */
export type RiskRunItem = {
  run_id: string;
  run_created_at: string;
  run_submitted_at: string | null;
  overall_score: number | null;
  risk_flags: RiskFlagItem[];
  system_id: string;
  system_name: string;
  owner_email: string | null;
};

// ---------------------------------------------------------------------------
// Phase 1: Audit types
// ---------------------------------------------------------------------------

/** Audit log entry */
export type AuditLogEntry = {
  id: string;
  admin_user_id: string;
  admin_email: string;
  admin_role: string;
  action: string;
  target_type: string;
  target_id: string;
  reason: string;
  before_snapshot: Record<string, unknown> | null;
  after_snapshot: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};
