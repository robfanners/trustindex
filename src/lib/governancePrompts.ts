export type WizardResponses = {
  company: {
    name: string;
    industry: string;
    headcount: string;
    jurisdiction: string;
  };
  tools: Array<{
    name: string;
    purpose: string;
    dataClassification: string;
    departments: string;
  }>;
  controls: {
    hasPolicy: string;
    requiresApproval: string;
    humanReview: string;
    logsUsage: string;
    staffTrained: string;
    incidentProcess: string;
    vendorAssessment: string;
    namedResponsible: string;
    hasDefinedIntents: string;
    definesBlastRadius: string;
  };
};

export const GOVERNANCE_STATEMENT_SYSTEM = `You are an AI governance specialist at Verisum, a trust technology company. You write clear, professional AI governance statements for small and medium-sized businesses.

Your statements should be:
- Written in plain, professional English (not legalese)
- Specific to the company's context (industry, size, tools, jurisdiction)
- Structured with clear numbered sections
- Honest about current gaps (frame as "planned improvements")
- Aligned with EU AI Act and UK AI governance frameworks
- Date-stamped and versioned

Output only the governance statement in Markdown format. No preamble or commentary.`;

export function buildGovernanceStatementPrompt(w: WizardResponses, version: number): string {
  const toolList = w.tools.map((t) =>
    `- ${t.name}: used for ${t.purpose} (${t.dataClassification} data, ${t.departments})`
  ).join("\n");

  const controlSummary = Object.entries(w.controls)
    .map(([key, val]) => `- ${formatControlKey(key)}: ${val}`)
    .join("\n");

  const today = new Date().toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

  return `Generate an AI Governance Statement for the following organisation:

Company: ${w.company.name}
Industry: ${w.company.industry}
Headcount: ${w.company.headcount}
Jurisdiction: ${w.company.jurisdiction}
Version: v${version}.0
Date: ${today}

AI Tools in Use:
${toolList || "- None declared"}

Current Control Posture:
${controlSummary}

The statement should include:
1. A governance commitment paragraph appropriate for ${w.company.industry}
2. Summary of AI tools and their purposes
3. Key controls currently in place (based on "yes" answers)
4. Planned improvements (based on "no" or "partial" answers — frame positively)
5. Named governance responsibility status
6. Regulatory alignment note (${w.company.jurisdiction} framework)
7. Intent-Based Governance\u2122 posture — whether authorised goals, decision authorities, and blast radius constraints have been defined for AI systems (based on: intents defined = ${w.controls.hasDefinedIntents || "not assessed"}, blast radius defined = ${w.controls.definesBlastRadius || "not assessed"})

End with the version number and date.`;
}

export const GAP_ANALYSIS_SYSTEM = `You are an AI governance risk analyst at Verisum. You identify governance gaps and provide practical, actionable recommendations for small businesses.

Your analysis should be:
- Practical and specific (not generic compliance advice)
- Prioritised by risk impact
- Each recommendation should be achievable within 30 days
- Reference relevant regulatory frameworks briefly
- Use red/amber/green classification for each area

Output in Markdown format with structured sections. No preamble.`;

export function buildGapAnalysisPrompt(w: WizardResponses): string {
  const controlSummary = Object.entries(w.controls)
    .map(([key, val]) => `- ${formatControlKey(key)}: ${val}`)
    .join("\n");

  const toolCount = w.tools.length;
  const hasHighRiskData = w.tools.some(
    (t) => t.dataClassification === "personal" || t.dataClassification === "sensitive"
  );

  return `Analyse the AI governance posture of the following organisation and identify the top 5 gaps with recommendations:

Company: ${w.company.name}
Industry: ${w.company.industry}
Headcount: ${w.company.headcount}
Jurisdiction: ${w.company.jurisdiction}
Number of AI tools: ${toolCount}
Handles personal/sensitive data: ${hasHighRiskData ? "Yes" : "No"}

Current Control Posture:
${controlSummary}

Additional context:
- Intent-Based Governance\u2122 defined: ${w.controls.hasDefinedIntents || "not assessed"}
- Blast radius constraints defined: ${w.controls.definesBlastRadius || "not assessed"}

For each gap:
1. Name the gap (e.g., "No formal AI usage policy")
2. Classify as RED (critical), AMBER (important), or GREEN (adequate)
3. Explain the risk in 1-2 sentences
4. Provide a specific, practical recommendation achievable in 30 days
5. Note the relevant regulatory reference (EU AI Act article or UK framework section)

Include an assessment of Intent-Based Governance\u2122 maturity:
- Flag as RED if no authorised goals or blast radius constraints are defined for any AI systems
- Flag as AMBER if partially defined (some systems covered, or only some IBG components defined)
- Flag as GREEN if all active AI systems have complete IBG specifications with authorised goals, decision authorities, and blast radius constraints
- Reference EU AI Act Article 9 (risk management) and Article 11 (technical documentation) as regulatory drivers for IBG

Format as a numbered list with clear headings. Include a summary table at the top showing area \u2192 status (RED/AMBER/GREEN).`;
}

function formatControlKey(key: string): string {
  const labels: Record<string, string> = {
    hasPolicy: "AI usage policy",
    requiresApproval: "Staff approval required",
    humanReview: "Human review of AI outputs",
    logsUsage: "AI usage logging",
    staffTrained: "Staff training on responsible AI",
    incidentProcess: "Incident response process",
    vendorAssessment: "Vendor assessment before adoption",
    namedResponsible: "Named person responsible for AI governance",
    hasDefinedIntents: "Intent-Based Governance\u2122 (authorised goals and boundaries defined)",
    definesBlastRadius: "Blast radius constraints defined for AI systems",
  };
  return labels[key] ?? key;
}
