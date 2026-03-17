import { z } from "zod";

// --- Prove schemas ---

export const createAttestationSchema = z.object({
  title: z.string().min(1, "title is required").max(500),
  statement: z.string().min(1, "statement is required").max(5000),
  posture_snapshot: z.record(z.string(), z.unknown()).optional(),
  valid_days: z.number().int().min(1).max(365).optional(),
});

export const createProvenanceSchema = z.object({
  title: z.string().min(1, "title is required").max(500),
  ai_system: z.string().max(200).optional(),
  model_version: z.string().max(200).optional(),
  output_description: z.string().max(2000).optional(),
  data_sources: z.union([z.string(), z.array(z.string())]).optional(),
  review_note: z.string().max(2000).optional(),
});

export const createApprovalSchema = z.object({
  title: z.string().min(1, "title is required").max(500),
  description: z.string().max(2000).optional(),
  risk_level: z.enum(["low", "medium", "high", "critical"]).optional(),
  assigned_to: z.string().uuid().optional(),
});

export const approvalDecisionSchema = z.object({
  approval_id: z.string().uuid("Invalid approval ID"),
  decision: z.enum(["approved", "rejected"], { message: "decision must be approved or rejected" }),
  decision_note: z.string().max(2000).optional(),
});

export const createIncidentLockSchema = z.object({
  incident_id: z.string().uuid("Invalid incident ID"),
  lock_reason: z.string().min(1, "lock_reason is required").max(2000),
});

export const createExchangeSchema = z.object({
  proof_type: z.enum(["attestation", "provenance", "incident_lock"]),
  proof_id: z.string().uuid("Invalid proof ID"),
  shared_with_name: z.string().min(1, "shared_with_name is required").max(500),
  shared_with_email: z.string().email("Invalid email").optional().or(z.literal("")),
  note: z.string().max(2000).optional(),
});

// --- Model Registry schemas ---

export const createModelSchema = z.object({
  model_name: z.string().min(1, "model_name is required").max(200),
  model_version: z.string().min(1, "model_version is required").max(200),
  provider: z.string().max(200).optional(),
  model_type: z.enum(["foundation", "fine_tuned", "custom", "rag", "agent", "other"]).optional(),
  capabilities: z.array(z.string().max(100)).max(20).optional(),
  training_data_sources: z.array(z.string().max(200)).max(20).optional(),
  deployment_date: z.string().max(20).optional(),
  status: z.enum(["active", "retired", "evaluating"]).optional(),
  parent_model_id: z.string().uuid().optional(),
  model_card_url: z.string().max(500).optional().or(z.literal("")),
  notes: z.string().max(2000).optional(),
});

export const updateModelSchema = createModelSchema.partial();

export const linkModelToSystemSchema = z.object({
  system_id: z.string().uuid("Invalid system ID"),
  model_id: z.string().uuid("Invalid model ID"),
  role: z.enum(["primary", "fallback", "evaluation", "component"]).optional(),
});

// --- HAPP Decision Attribution schemas ---

export const createPolicyVersionSchema = z.object({
  policy_id: z.string().uuid("Invalid policy ID"),
  title: z.string().min(1, "title is required").max(500),
  content_snapshot: z.record(z.string(), z.unknown()),
  effective_from: z.string().max(50).optional(),
  effective_until: z.string().max(50).optional(),
});

export const createAiOutputSchema = z.object({
  system_id: z.string().uuid("Invalid system ID"),
  model_id: z.string().uuid().optional(),
  output_summary: z.string().min(1, "output_summary is required").max(5000),
  output_hash: z.string().max(200).optional(),
  output_type: z.enum(["recommendation", "classification", "generated_text", "action_request", "score", "other"]).optional(),
  confidence_score: z.number().min(0).max(1).optional(),
  risk_signal: z.enum(["low", "medium", "high", "critical"]).optional(),
  occurred_at: z.string().min(1, "occurred_at is required"),
});

export const createDecisionRecordSchema = z.object({
  ai_output_id: z.string().uuid("Invalid output ID"),
  policy_version_id: z.string().uuid("Invalid policy version ID"),
  review_mode: z.enum(["required", "optional", "auto_approved"]),
  human_decision: z.enum(["approved", "rejected", "escalated", "modified"]),
  human_rationale: z.string().max(5000).optional(),
});

export const createDecisionWithOutputSchema = z.object({
  system_id: z.string().uuid("Invalid system ID"),
  model_id: z.string().uuid().optional(),
  output_summary: z.string().min(1, "output_summary is required").max(5000),
  output_hash: z.string().max(200).optional(),
  output_type: z.enum(["recommendation", "classification", "generated_text", "action_request", "score", "other"]).optional(),
  confidence_score: z.number().min(0).max(1).optional(),
  risk_signal: z.enum(["low", "medium", "high", "critical"]).optional(),
  occurred_at: z.string().min(1, "occurred_at is required"),
  policy_version_id: z.string().uuid("Invalid policy version ID"),
  review_mode: z.enum(["required", "optional", "auto_approved"]),
  human_decision: z.enum(["approved", "rejected", "escalated", "modified"]),
  human_rationale: z.string().max(5000).optional(),
});

// --- Monitor schemas ---

export const createSignalSchema = z.object({
  system_name: z.string().min(1, "system_name is required").max(200),
  signal_type: z.enum(["performance", "accuracy", "fairness", "safety", "availability", "compliance", "custom"]),
  metric_name: z.string().min(1, "metric_name is required").max(200),
  metric_value: z.number({ message: "metric_value must be a number" }),
  severity: z.enum(["info", "warning", "critical"]).optional(),
  source: z.enum(["manual", "webhook", "integration"]).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});

// --- Compliance Framework schemas ---

export const createComplianceFrameworkSchema = z.object({
  name: z.string().min(1).max(200),
  short_name: z.string().max(20).optional(),
  coverage_pct: z.number().int().min(0).max(100).default(0),
  status: z.enum(["on_track", "at_risk", "overdue", "completed"]).default("on_track"),
  due_date: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

export const updateComplianceFrameworkSchema = z.object({
  id: z.string().uuid(),
  coverage_pct: z.number().int().min(0).max(100).optional(),
  status: z.enum(["on_track", "at_risk", "overdue", "completed"]).optional(),
  due_date: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

// --- Helper to extract first error message ---

export function firstZodError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}
