// ---------------------------------------------------------------------------
// Intent-Based Governance (IBG) — Shared Types
// ---------------------------------------------------------------------------
// The IBG framework comprises three interdependent components:
//   1. Authorised Goals — what the system is allowed to pursue
//   2. Decision Authorities & Action Spaces — what it may decide/do
//   3. Blast Radius Constraints — how far its effects can propagate
// ---------------------------------------------------------------------------

// --- Component 1: Authorised Goals ---

export type GoalCategory =
  | "operational"
  | "analytical"
  | "customer-facing"
  | "internal"
  | "compliance";

export type GoalPriority = "primary" | "secondary";

export type AuthorisedGoal = {
  goal: string;
  category: GoalCategory;
  priority: GoalPriority;
  rationale: string;
};

// --- Component 2: Decision Authorities & Action Spaces ---

export type DecisionAuthority = {
  authority: string;
  scope: string;
  constraints: string[];
  requires_human_approval: boolean;
  threshold_description: string;
};

export type ActionType =
  | "api_call"
  | "data_write"
  | "data_read"
  | "notification"
  | "financial_transaction"
  | "user_communication"
  | "system_config_change";

export type ActionSpace = {
  action_type: ActionType;
  permitted: boolean;
  conditions: string;
  api_scope: string;
};

// --- Component 3: Blast Radius Constraints ---

export type FinancialScope = {
  max_value: number | null;
  currency: string;
  period: "per_transaction" | "daily" | "monthly" | "annual";
};

export type BlastRadius = {
  entity_scope: string;
  financial_scope: FinancialScope;
  data_scope: string[]; // e.g. ["PII", "financial", "health", "internal", "public"]
  temporal_scope: string;
  cascade_scope: string;
  max_affected_users: number | null;
  geographic_scope: string[]; // e.g. ["UK", "EU", "US", "Global"]
};

// --- IBG Specification ---

export type IBGStatus = "draft" | "active" | "superseded" | "archived";

export type IBGSpecification = {
  id: string;
  assessment_id: string;
  organisation_id: string;
  version: number;
  status: IBGStatus;
  authorised_goals: AuthorisedGoal[];
  decision_authorities: DecisionAuthority[];
  action_spaces: ActionSpace[];
  blast_radius: BlastRadius;
  effective_from: string | null;
  effective_until: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// --- Summary for display in registry/badges ---

export type IBGAssessmentStatus = "none" | "draft" | "active";

// --- Completeness check ---

export type IBGCompleteness = {
  goals: boolean;
  authorities: boolean;
  blastRadius: boolean;
  overall: "complete" | "partial" | "empty";
};

export function checkIBGCompleteness(spec: IBGSpecification | null): IBGCompleteness {
  if (!spec) {
    return { goals: false, authorities: false, blastRadius: false, overall: "empty" };
  }

  const goals = spec.authorised_goals.length > 0;
  const authorities =
    spec.decision_authorities.length > 0 || spec.action_spaces.length > 0;
  const blastRadius = !!(
    spec.blast_radius.entity_scope ||
    spec.blast_radius.financial_scope?.max_value ||
    spec.blast_radius.data_scope?.length ||
    spec.blast_radius.temporal_scope
  );

  const filledCount = [goals, authorities, blastRadius].filter(Boolean).length;
  const overall =
    filledCount === 3 ? "complete" : filledCount > 0 ? "partial" : "empty";

  return { goals, authorities, blastRadius, overall };
}

// --- Defaults for new specs ---

export const EMPTY_BLAST_RADIUS: BlastRadius = {
  entity_scope: "",
  financial_scope: { max_value: null, currency: "GBP", period: "per_transaction" },
  data_scope: [],
  temporal_scope: "",
  cascade_scope: "",
  max_affected_users: null,
  geographic_scope: [],
};

// --- Constants ---

export const GOAL_CATEGORIES: { value: GoalCategory; label: string }[] = [
  { value: "operational", label: "Operational" },
  { value: "analytical", label: "Analytical" },
  { value: "customer-facing", label: "Customer-Facing" },
  { value: "internal", label: "Internal" },
  { value: "compliance", label: "Compliance" },
];

export const ACTION_TYPES: { value: ActionType; label: string }[] = [
  { value: "api_call", label: "API Call" },
  { value: "data_write", label: "Data Write" },
  { value: "data_read", label: "Data Read" },
  { value: "notification", label: "Notification" },
  { value: "financial_transaction", label: "Financial Transaction" },
  { value: "user_communication", label: "User Communication" },
  { value: "system_config_change", label: "System Config Change" },
];

export const DATA_SCOPE_OPTIONS = [
  "PII",
  "Financial",
  "Health",
  "Internal",
  "Public",
  "Credentials",
  "Legal",
  "Commercial",
];

export const GEOGRAPHIC_SCOPE_OPTIONS = [
  "UK",
  "EU",
  "US",
  "APAC",
  "Global",
  "Restricted",
];

export const FINANCIAL_PERIODS: { value: FinancialScope["period"]; label: string }[] = [
  { value: "per_transaction", label: "Per Transaction" },
  { value: "daily", label: "Daily" },
  { value: "monthly", label: "Monthly" },
  { value: "annual", label: "Annual" },
];

// --- IBG Context for policy generation ---

export type IBGPolicyContext = {
  systemName: string;
  systemType: string;
  authorisedGoals: string[];
  decisionAuthorities: string[];
  blastRadius: {
    entityScope?: string;
    financialScope?: string;
    dataScope?: string[];
    temporalScope?: string;
    cascadeScope?: string;
  };
};
