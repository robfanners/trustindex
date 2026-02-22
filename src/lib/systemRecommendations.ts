// ---------------------------------------------------------------------------
// TrustSysGraph — Rule-Based Recommendations Engine
// ---------------------------------------------------------------------------
// For each question where effective score < 0.5, generates a recommendation
// with priority (high / med) and actionable text.
// ---------------------------------------------------------------------------

import type { QuestionAnswer, SystemQuestion } from "./systemQuestionBank";
import { SYSTEM_QUESTIONS } from "./systemQuestionBank";
import { questionScore } from "./systemScoring";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Recommendation = {
  questionId: string;
  dimension: string;
  control: string;
  priority: "high" | "med";
  recommendation: string;
};

// ---------------------------------------------------------------------------
// Static recommendation text per question
// ---------------------------------------------------------------------------

const RECOMMENDATION_MAP: Record<string, string> = {
  // Transparency
  TXS_TRAN_01:
    "Document the system's purpose, intended use cases, and target users. Publish internally and make accessible to all stakeholders.",
  TXS_TRAN_02:
    "Create and maintain a data inventory listing all inputs, datasets, and RAG corpora. Include data freshness and update cadence.",
  TXS_TRAN_03:
    "Document known failure modes, edge cases, and limitations. Make this available to users alongside the system's outputs.",
  TXS_TRAN_04:
    "Add user-facing disclosures explaining what the system does, what it doesn't do, and when outputs should be independently verified.",
  TXS_TRAN_05:
    "Establish a change log tracking model, prompt, and data updates. Include dates, authors, and impact assessments for each change.",

  // Explainability
  TXS_EXPL_01:
    "Ensure the system produces traceable reasoning artifacts (citations, source references, rationale chains) for its outputs. Add citation requirements to prompt templates.",
  TXS_EXPL_02:
    "Implement RAG grounding with required citations. Add fallback behaviour when source material is insufficient or missing.",
  TXS_EXPL_03:
    "Add a confidence or uncertainty signal to outputs (e.g., confidence score, 'insufficient information' flags). Calibrate thresholds against evaluation data.",
  TXS_EXPL_04:
    "Build an evaluation suite with golden-set test cases and regression tests. Run regularly and track accuracy, grounding, and hallucination rates.",
  TXS_EXPL_05:
    "Make explainability accessible to non-technical users. Translate technical explanations into plain language and provide them alongside outputs.",

  // Human Oversight
  TXS_HO_01:
    "Define which actions are high-risk and require human-in-the-loop approval. Implement approval gates in the workflow before these actions execute.",
  TXS_HO_02:
    "Create a clear escalation path for uncertain, contested, or policy-violating outputs. Document triggers, escalation contacts, and response SLAs.",
  TXS_HO_03:
    "Implement a kill-switch or pause mechanism that can halt the system quickly. Test it regularly and document the procedure for operators.",
  TXS_HO_04:
    "Implement role-based access control for system administration, prompt editing, and tool configuration. Audit access logs regularly.",
  TXS_HO_05:
    "Set up monitoring dashboards and alerting for anomalous behaviour, error rates, and latency. Ensure operators can intervene based on alerts.",

  // Risk Controls
  TXS_RISK_01:
    "Conduct a threat model or risk assessment covering adversarial inputs, data poisoning, privilege escalation, and unintended behaviour. Document and review periodically.",
  TXS_RISK_02:
    "Implement data protection controls: PII filtering on inputs/outputs, data retention policies, encryption at rest and in transit.",
  TXS_RISK_03:
    "Implement least-privilege tool credentials and sandbox agent actions to scoped resources. Add separate service accounts and explicit allowlists.",
  TXS_RISK_04:
    "Deploy prompt injection defenses, jailbreak detection, and policy filters. Test regularly with adversarial inputs and red-team exercises.",
  TXS_RISK_05:
    "Create an incident response playbook for model/system failures. Include detection criteria, communication templates, rollback procedures, and post-incident review.",

  // Accountability
  TXS_ACC_01:
    "Name a system owner (role, person, or team) with documented responsibilities for the system's behaviour, performance, and compliance.",
  TXS_ACC_02:
    "Enable audit logging for all system inputs, outputs, and actions where legally permissible. Ensure logs are immutable and retained per policy.",
  TXS_ACC_03:
    "Implement version control for prompts, models, and tools. Ensure a rollback path exists and has been tested for each component.",
  TXS_ACC_04:
    "Maintain a dependency inventory listing all third-party models, APIs, and plugins. Track versions, licences, and security advisories.",
  TXS_ACC_05:
    "Map the system against applicable regulatory frameworks (EU AI Act, ISO 42001, SOC2, sector-specific rules). Document gaps and remediation plans.",
};

// ---------------------------------------------------------------------------
// Generate recommendations
// ---------------------------------------------------------------------------

export function generateRecommendations(
  answers: Record<string, QuestionAnswer>
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  for (const q of SYSTEM_QUESTIONS) {
    const answer = answers[q.id];
    if (!answer) continue;

    const score = questionScore(answer, q.answerType);
    if (score >= 0.5) continue;

    const recommendation = RECOMMENDATION_MAP[q.id];
    if (!recommendation) continue;

    recommendations.push({
      questionId: q.id,
      dimension: q.dimension,
      control: q.control,
      priority: score < 0.25 ? "high" : "med",
      recommendation,
    });
  }

  // Sort: high priority first, then by question ID
  recommendations.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority === "high" ? -1 : 1;
    return a.questionId.localeCompare(b.questionId);
  });

  return recommendations;
}
