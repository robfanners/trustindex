import { z } from "zod";

// --- Prove schemas ---

export const createAttestationSchema = z.object({
  title: z.string().min(1, "title is required").max(500),
  statement: z.string().min(1, "statement is required").max(5000),
  posture_snapshot: z.record(z.string(), z.unknown()).optional(),
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

// --- Helper to extract first error message ---

export function firstZodError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}
