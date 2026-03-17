// src/lib/assuranceGrade.ts
// Pure function for computing assurance grade from identity + action binding evidence.
// Used by decision creation routes and review submission.

export type IdentityAssuranceLevel = "ial_1" | "ial_2" | "ial_3";
export type ActionBindingLevel = "ab_1" | "ab_2" | "ab_3";
export type AssuranceGrade = "gold" | "silver" | "bronze";
export type OversightMode = "in_the_loop" | "on_the_loop";

export type AssuranceInput = {
  source_type: "manual" | "api";
  review_mode: "required" | "optional" | "auto_approved";
  identity_assurance_level?: IdentityAssuranceLevel;
  action_binding_level?: ActionBindingLevel;
  external_reviewer_email?: string;
  external_reviewed_at?: string;
};

/**
 * Compute the assurance grade based on identity assurance and action binding.
 * Gold = IAL-3 + AB-3 (or higher), Silver = IAL-2 + AB-2, Bronze = everything else.
 * Grade matrix: min(IAL, AB) determines the grade.
 *
 * UI-created decisions default to Silver (IAL-2 via Supabase Auth, AB-2 via session).
 * Auto-approved decisions are always Bronze regardless of identity.
 */
export function computeAssuranceGrade(input: AssuranceInput): AssuranceGrade {
  // UI-created decisions: IAL-2 (Supabase Auth) x AB-2 (session) = Silver
  if (input.source_type === "manual") return "silver";

  // Auto-approved: always Bronze regardless of identity strength
  if (input.review_mode === "auto_approved") return "bronze";

  // API with explicit IAL/AB levels — use the grade matrix
  const ial = input.identity_assurance_level;
  const ab = input.action_binding_level;

  if (ial && ab) {
    const ialNum = parseInt(ial.split("_")[1]);
    const abNum = parseInt(ab.split("_")[1]);
    const min = Math.min(ialNum, abNum);
    if (min >= 3) return "gold";
    if (min >= 2) return "silver";
    return "bronze";
  }

  // API with reviewer evidence but no explicit levels: infer Silver
  if (input.external_reviewer_email && input.external_reviewed_at) return "silver";

  // No evidence: Bronze
  return "bronze";
}

/** Human-readable label for assurance grade */
export function gradeLabel(grade: AssuranceGrade): string {
  switch (grade) {
    case "gold": return "Gold — Verified Identity";
    case "silver": return "Silver — Attested External";
    case "bronze": return "Bronze — System-Asserted";
  }
}

/** Human-readable label for oversight mode */
export function oversightLabel(mode: OversightMode): string {
  switch (mode) {
    case "in_the_loop": return "Human-in-the-Loop";
    case "on_the_loop": return "Human-on-the-Loop";
  }
}
