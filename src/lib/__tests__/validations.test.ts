import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  createAttestationSchema,
  createProvenanceSchema,
  createApprovalSchema,
  approvalDecisionSchema,
  createIncidentLockSchema,
  createExchangeSchema,
  createSignalSchema,
  firstZodError,
} from "@/lib/validations";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

// ---------------------------------------------------------------------------
// createAttestationSchema
// ---------------------------------------------------------------------------
describe("createAttestationSchema", () => {
  it("accepts valid minimal input", () => {
    const result = createAttestationSchema.safeParse({
      title: "Bias audit complete",
      statement: "We certify the model was audited.",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid full input with posture_snapshot", () => {
    const result = createAttestationSchema.safeParse({
      title: "Bias audit complete",
      statement: "We certify the model was audited.",
      posture_snapshot: { score: 85, status: "healthy" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing title", () => {
    const result = createAttestationSchema.safeParse({
      statement: "We certify the model was audited.",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing statement", () => {
    const result = createAttestationSchema.safeParse({
      title: "Bias audit complete",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty title", () => {
    const result = createAttestationSchema.safeParse({
      title: "",
      statement: "Valid statement",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(firstZodError(result.error)).toBe("title is required");
    }
  });

  it("rejects empty statement", () => {
    const result = createAttestationSchema.safeParse({
      title: "Valid title",
      statement: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(firstZodError(result.error)).toBe("statement is required");
    }
  });

  it("rejects title exceeding 500 characters", () => {
    const result = createAttestationSchema.safeParse({
      title: "x".repeat(501),
      statement: "Valid statement",
    });
    expect(result.success).toBe(false);
  });

  it("rejects statement exceeding 5000 characters", () => {
    const result = createAttestationSchema.safeParse({
      title: "Valid title",
      statement: "x".repeat(5001),
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createProvenanceSchema
// ---------------------------------------------------------------------------
describe("createProvenanceSchema", () => {
  it("accepts valid minimal input", () => {
    const result = createProvenanceSchema.safeParse({
      title: "GPT-4 output provenance",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid full input", () => {
    const result = createProvenanceSchema.safeParse({
      title: "GPT-4 output provenance",
      ai_system: "OpenAI GPT-4",
      model_version: "gpt-4-turbo-2025-04-09",
      output_description: "Summary of contract terms",
      data_sources: ["internal-db", "vendor-api"],
      review_note: "Reviewed by legal team",
    });
    expect(result.success).toBe(true);
  });

  it("accepts data_sources as a single string", () => {
    const result = createProvenanceSchema.safeParse({
      title: "Provenance record",
      data_sources: "single-source",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing title", () => {
    const result = createProvenanceSchema.safeParse({
      ai_system: "OpenAI GPT-4",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty title", () => {
    const result = createProvenanceSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(firstZodError(result.error)).toBe("title is required");
    }
  });

  it("rejects ai_system exceeding 200 characters", () => {
    const result = createProvenanceSchema.safeParse({
      title: "Valid",
      ai_system: "x".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("rejects review_note exceeding 2000 characters", () => {
    const result = createProvenanceSchema.safeParse({
      title: "Valid",
      review_note: "x".repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createApprovalSchema
// ---------------------------------------------------------------------------
describe("createApprovalSchema", () => {
  it("accepts valid minimal input", () => {
    const result = createApprovalSchema.safeParse({
      title: "Deploy to production",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid full input", () => {
    const result = createApprovalSchema.safeParse({
      title: "Deploy to production",
      description: "Production deployment for v2.1",
      risk_level: "high",
      assigned_to: VALID_UUID,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    const result = createApprovalSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid risk_level enum value", () => {
    const result = createApprovalSchema.safeParse({
      title: "Deploy",
      risk_level: "extreme",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid UUID for assigned_to", () => {
    const result = createApprovalSchema.safeParse({
      title: "Deploy",
      assigned_to: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects description exceeding 2000 characters", () => {
    const result = createApprovalSchema.safeParse({
      title: "Deploy",
      description: "x".repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// approvalDecisionSchema
// ---------------------------------------------------------------------------
describe("approvalDecisionSchema", () => {
  it("accepts valid approved decision", () => {
    const result = approvalDecisionSchema.safeParse({
      approval_id: VALID_UUID,
      decision: "approved",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid rejected decision with note", () => {
    const result = approvalDecisionSchema.safeParse({
      approval_id: VALID_UUID,
      decision: "rejected",
      decision_note: "Risk too high",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing approval_id", () => {
    const result = approvalDecisionSchema.safeParse({
      decision: "approved",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid UUID for approval_id", () => {
    const result = approvalDecisionSchema.safeParse({
      approval_id: "bad-id",
      decision: "approved",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(firstZodError(result.error)).toBe("Invalid approval ID");
    }
  });

  it("rejects invalid decision enum value", () => {
    const result = approvalDecisionSchema.safeParse({
      approval_id: VALID_UUID,
      decision: "pending",
    });
    expect(result.success).toBe(false);
  });

  it("rejects decision_note exceeding 2000 characters", () => {
    const result = approvalDecisionSchema.safeParse({
      approval_id: VALID_UUID,
      decision: "rejected",
      decision_note: "x".repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createIncidentLockSchema
// ---------------------------------------------------------------------------
describe("createIncidentLockSchema", () => {
  it("accepts valid input", () => {
    const result = createIncidentLockSchema.safeParse({
      incident_id: VALID_UUID,
      lock_reason: "Critical vulnerability discovered",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing incident_id", () => {
    const result = createIncidentLockSchema.safeParse({
      lock_reason: "Critical vulnerability discovered",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid UUID for incident_id", () => {
    const result = createIncidentLockSchema.safeParse({
      incident_id: "nope",
      lock_reason: "Reason",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(firstZodError(result.error)).toBe("Invalid incident ID");
    }
  });

  it("rejects empty lock_reason", () => {
    const result = createIncidentLockSchema.safeParse({
      incident_id: VALID_UUID,
      lock_reason: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(firstZodError(result.error)).toBe("lock_reason is required");
    }
  });

  it("rejects lock_reason exceeding 2000 characters", () => {
    const result = createIncidentLockSchema.safeParse({
      incident_id: VALID_UUID,
      lock_reason: "x".repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createExchangeSchema
// ---------------------------------------------------------------------------
describe("createExchangeSchema", () => {
  it("accepts valid minimal input", () => {
    const result = createExchangeSchema.safeParse({
      proof_type: "attestation",
      proof_id: VALID_UUID,
      shared_with_name: "Acme Corp",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid full input", () => {
    const result = createExchangeSchema.safeParse({
      proof_type: "provenance",
      proof_id: VALID_UUID,
      shared_with_name: "Acme Corp",
      shared_with_email: "legal@acme.com",
      note: "Shared for due diligence review",
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty string for shared_with_email", () => {
    const result = createExchangeSchema.safeParse({
      proof_type: "incident_lock",
      proof_id: VALID_UUID,
      shared_with_name: "Acme Corp",
      shared_with_email: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid proof_type enum", () => {
    const result = createExchangeSchema.safeParse({
      proof_type: "approval",
      proof_id: VALID_UUID,
      shared_with_name: "Acme Corp",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid UUID for proof_id", () => {
    const result = createExchangeSchema.safeParse({
      proof_type: "attestation",
      proof_id: "xyz",
      shared_with_name: "Acme Corp",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(firstZodError(result.error)).toBe("Invalid proof ID");
    }
  });

  it("rejects empty shared_with_name", () => {
    const result = createExchangeSchema.safeParse({
      proof_type: "attestation",
      proof_id: VALID_UUID,
      shared_with_name: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email format for shared_with_email", () => {
    const result = createExchangeSchema.safeParse({
      proof_type: "attestation",
      proof_id: VALID_UUID,
      shared_with_name: "Acme Corp",
      shared_with_email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejects note exceeding 2000 characters", () => {
    const result = createExchangeSchema.safeParse({
      proof_type: "attestation",
      proof_id: VALID_UUID,
      shared_with_name: "Acme Corp",
      note: "x".repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createSignalSchema
// ---------------------------------------------------------------------------
describe("createSignalSchema", () => {
  it("accepts valid minimal input", () => {
    const result = createSignalSchema.safeParse({
      system_name: "Fraud Detector",
      signal_type: "accuracy",
      metric_name: "f1_score",
      metric_value: 0.94,
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid full input", () => {
    const result = createSignalSchema.safeParse({
      system_name: "Fraud Detector",
      signal_type: "fairness",
      metric_name: "demographic_parity",
      metric_value: 0.03,
      severity: "warning",
      source: "webhook",
      context: { region: "eu-west", dataset: "q1-2026" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts all seven signal_type values", () => {
    const types = [
      "performance",
      "accuracy",
      "fairness",
      "safety",
      "availability",
      "compliance",
      "custom",
    ] as const;
    for (const t of types) {
      const result = createSignalSchema.safeParse({
        system_name: "sys",
        signal_type: t,
        metric_name: "m",
        metric_value: 1,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects missing required fields", () => {
    const result = createSignalSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("rejects empty system_name", () => {
    const result = createSignalSchema.safeParse({
      system_name: "",
      signal_type: "safety",
      metric_name: "uptime",
      metric_value: 99.9,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(firstZodError(result.error)).toBe("system_name is required");
    }
  });

  it("rejects invalid signal_type enum", () => {
    const result = createSignalSchema.safeParse({
      system_name: "sys",
      signal_type: "unknown",
      metric_name: "m",
      metric_value: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects string passed as metric_value", () => {
    const result = createSignalSchema.safeParse({
      system_name: "sys",
      signal_type: "performance",
      metric_name: "latency",
      metric_value: "fast",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(firstZodError(result.error)).toBe(
        "metric_value must be a number"
      );
    }
  });

  it("rejects system_name exceeding 200 characters", () => {
    const result = createSignalSchema.safeParse({
      system_name: "x".repeat(201),
      signal_type: "custom",
      metric_name: "m",
      metric_value: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid severity enum", () => {
    const result = createSignalSchema.safeParse({
      system_name: "sys",
      signal_type: "safety",
      metric_name: "m",
      metric_value: 1,
      severity: "extreme",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// firstZodError helper
// ---------------------------------------------------------------------------
describe("firstZodError", () => {
  it("returns the first issue message from a ZodError", () => {
    const result = createAttestationSchema.safeParse({
      title: "",
      statement: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(firstZodError(result.error)).toBe("title is required");
    }
  });

  it('returns "Invalid input" when issues array is empty', () => {
    const emptyError = new z.ZodError([]);
    expect(firstZodError(emptyError)).toBe("Invalid input");
  });
});
