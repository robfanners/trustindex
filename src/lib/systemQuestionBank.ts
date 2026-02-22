// ---------------------------------------------------------------------------
// TrustSysGraph — Question Bank v1
// ---------------------------------------------------------------------------
// 25 control-based questions across 5 dimensions.
// Each question uses maturity enums or booleans, with per-question weights.
// Evidence is captured per question and caps the score.
// ---------------------------------------------------------------------------

// --- Types ---

export type SystemDimension =
  | "Transparency"
  | "Explainability"
  | "Human Oversight"
  | "Risk Controls"
  | "Accountability";

export type AnswerType = "enum_maturity" | "boolean";

export type MaturityLevel =
  | "none"
  | "ad_hoc"
  | "defined"
  | "enforced"
  | "automated";

export type EvidenceType =
  | "link"
  | "document_ref"
  | "ticket_ref"
  | "policy_ref"
  | "runbook_ref"
  | "log_ref";

export type Evidence = {
  type: EvidenceType;
  pointer: string;
  note?: string;
};

export type QuestionAnswer = {
  maturity?: MaturityLevel;
  boolean?: boolean;
  evidence?: Evidence;
};

export type SystemQuestion = {
  id: string;
  dimension: SystemDimension;
  control: string;
  prompt: string;
  answerType: AnswerType;
  weight: number;
};

// --- Constants ---

export const SYSTEM_DIMENSIONS: SystemDimension[] = [
  "Transparency",
  "Explainability",
  "Human Oversight",
  "Risk Controls",
  "Accountability",
];

export const MATURITY_LEVELS: { value: MaturityLevel; label: string }[] = [
  { value: "none", label: "None" },
  { value: "ad_hoc", label: "Ad-hoc" },
  { value: "defined", label: "Defined" },
  { value: "enforced", label: "Enforced" },
  { value: "automated", label: "Automated" },
];

export const EVIDENCE_TYPES: { value: EvidenceType; label: string }[] = [
  { value: "link", label: "Link / URL" },
  { value: "document_ref", label: "Document reference" },
  { value: "ticket_ref", label: "Ticket reference" },
  { value: "policy_ref", label: "Policy reference" },
  { value: "runbook_ref", label: "Runbook reference" },
  { value: "log_ref", label: "Log reference" },
];

// ---------------------------------------------------------------------------
// Question bank — 25 questions (5 per dimension)
// ---------------------------------------------------------------------------

export const SYSTEM_QUESTIONS: SystemQuestion[] = [
  // -------------------------------------------------------------------------
  // Transparency (5)
  // -------------------------------------------------------------------------
  {
    id: "TXS_TRAN_01",
    dimension: "Transparency",
    control: "System purpose documented",
    prompt: "System purpose documented?",
    answerType: "enum_maturity",
    weight: 0.20,
  },
  {
    id: "TXS_TRAN_02",
    dimension: "Transparency",
    control: "Data sources documented",
    prompt: "Data sources documented (inputs, datasets, RAG corpora)?",
    answerType: "enum_maturity",
    weight: 0.20,
  },
  {
    id: "TXS_TRAN_03",
    dimension: "Transparency",
    control: "Known limitations documented",
    prompt: "Known limitations documented (failure modes, edge cases)?",
    answerType: "enum_maturity",
    weight: 0.20,
  },
  {
    id: "TXS_TRAN_04",
    dimension: "Transparency",
    control: "User disclosures exist",
    prompt:
      "User disclosures exist (what it is, what it isn\u2019t, when to trust it)?",
    answerType: "enum_maturity",
    weight: 0.20,
  },
  {
    id: "TXS_TRAN_05",
    dimension: "Transparency",
    control: "Change log exists",
    prompt: "Change log exists for model/prompt/data updates?",
    answerType: "enum_maturity",
    weight: 0.20,
  },

  // -------------------------------------------------------------------------
  // Explainability (5)
  // -------------------------------------------------------------------------
  {
    id: "TXS_EXPL_01",
    dimension: "Explainability",
    control: "Traceable reasoning artifacts",
    prompt:
      "Produces traceable reasoning artifacts (citations, sources, rationale) where applicable?",
    answerType: "enum_maturity",
    weight: 0.20,
  },
  {
    id: "TXS_EXPL_02",
    dimension: "Explainability",
    control: "RAG grounding implemented",
    prompt:
      "RAG grounding implemented (citations required, fallback when missing)?",
    answerType: "boolean",
    weight: 0.20,
  },
  {
    id: "TXS_EXPL_03",
    dimension: "Explainability",
    control: "Output confidence signal",
    prompt:
      "Output confidence/uncertainty signal present (e.g., confidence score, \u201Cinsufficient info\u201D)?",
    answerType: "enum_maturity",
    weight: 0.20,
  },
  {
    id: "TXS_EXPL_04",
    dimension: "Explainability",
    control: "Evaluation suite exists",
    prompt:
      "Evaluation suite exists (golden set / regression tests) for accuracy/grounding?",
    answerType: "enum_maturity",
    weight: 0.20,
  },
  {
    id: "TXS_EXPL_05",
    dimension: "Explainability",
    control: "Explainability accessible to users",
    prompt: "Explainability accessible to target users (not just engineers)?",
    answerType: "enum_maturity",
    weight: 0.20,
  },

  // -------------------------------------------------------------------------
  // Human Oversight (5)
  // -------------------------------------------------------------------------
  {
    id: "TXS_HO_01",
    dimension: "Human Oversight",
    control: "Human-in-the-loop for high-risk",
    prompt: "Human-in-the-loop required for high-risk actions?",
    answerType: "enum_maturity",
    weight: 0.25,
  },
  {
    id: "TXS_HO_02",
    dimension: "Human Oversight",
    control: "Escalation path exists",
    prompt:
      "Clear escalation path exists (when uncertain / policy violation / risk)?",
    answerType: "enum_maturity",
    weight: 0.20,
  },
  {
    id: "TXS_HO_03",
    dimension: "Human Oversight",
    control: "Pause/kill-switch capability",
    prompt: "Ability to pause/kill-switch system quickly?",
    answerType: "boolean",
    weight: 0.20,
  },
  {
    id: "TXS_HO_04",
    dimension: "Human Oversight",
    control: "Access control exists",
    prompt:
      "Access control exists (who can run/admin/change prompts/tools)?",
    answerType: "enum_maturity",
    weight: 0.20,
  },
  {
    id: "TXS_HO_05",
    dimension: "Human Oversight",
    control: "Monitoring supports intervention",
    prompt: "Monitoring supports operator intervention (alerts, dashboards)?",
    answerType: "enum_maturity",
    weight: 0.15,
  },

  // -------------------------------------------------------------------------
  // Risk Controls (5)
  // -------------------------------------------------------------------------
  {
    id: "TXS_RISK_01",
    dimension: "Risk Controls",
    control: "Threat model / risk assessment",
    prompt: "Threat model or risk assessment exists (documented)?",
    answerType: "enum_maturity",
    weight: 0.20,
  },
  {
    id: "TXS_RISK_02",
    dimension: "Risk Controls",
    control: "Data protection controls",
    prompt:
      "Data protection controls (PII filtering, retention, encryption) implemented?",
    answerType: "enum_maturity",
    weight: 0.20,
  },
  {
    id: "TXS_RISK_03",
    dimension: "Risk Controls",
    control: "Tool/action sandboxing",
    prompt:
      "Tool/action sandboxing (least privilege, scoped credentials) implemented?",
    answerType: "enum_maturity",
    weight: 0.20,
  },
  {
    id: "TXS_RISK_04",
    dimension: "Risk Controls",
    control: "Abuse prevention",
    prompt:
      "Abuse prevention (prompt injection defense, jailbreak checks, policy filters)?",
    answerType: "enum_maturity",
    weight: 0.20,
  },
  {
    id: "TXS_RISK_05",
    dimension: "Risk Controls",
    control: "Incident response playbook",
    prompt: "Incident response playbook for model/system failures?",
    answerType: "enum_maturity",
    weight: 0.20,
  },

  // -------------------------------------------------------------------------
  // Accountability (5)
  // -------------------------------------------------------------------------
  {
    id: "TXS_ACC_01",
    dimension: "Accountability",
    control: "System owner named",
    prompt:
      "System owner named (role/person/team) + responsibilities documented?",
    answerType: "enum_maturity",
    weight: 0.20,
  },
  {
    id: "TXS_ACC_02",
    dimension: "Accountability",
    control: "Audit logging enabled",
    prompt:
      "Audit logging enabled for inputs/outputs/actions (where permissible)?",
    answerType: "enum_maturity",
    weight: 0.25,
  },
  {
    id: "TXS_ACC_03",
    dimension: "Accountability",
    control: "Versioning with rollback",
    prompt: "Versioning of prompts/models/tools with rollback path?",
    answerType: "enum_maturity",
    weight: 0.20,
  },
  {
    id: "TXS_ACC_04",
    dimension: "Accountability",
    control: "Third-party dependency inventory",
    prompt:
      "Third-party dependency inventory (models, APIs, plugins) maintained?",
    answerType: "enum_maturity",
    weight: 0.15,
  },
  {
    id: "TXS_ACC_05",
    dimension: "Accountability",
    control: "Compliance mapping",
    prompt:
      "Compliance mapping done (AI Act / ISO / SOC2 / sector rules) where relevant?",
    answerType: "enum_maturity",
    weight: 0.20,
  },
];

// Helper: get questions for a specific dimension
export function questionsForDimension(
  dim: SystemDimension
): SystemQuestion[] {
  return SYSTEM_QUESTIONS.filter((q) => q.dimension === dim);
}
