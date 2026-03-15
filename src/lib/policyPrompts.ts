// Structured prompts for AI governance policy generation.

import type { IBGPolicyContext } from "@/lib/ibgTypes";

export type PolicyType = "acceptable_use" | "data_handling" | "staff_guidelines" | "ibg_policy";

export type PolicyQuestionnaire = {
  companyName: string;
  industry: string;
  companySize: string;
  aiToolsUsed: string[];
  dataSensitivity: string;
  jurisdiction: string;
  additionalContext?: string;
  // IBG context — injected when org has active IBG specs
  ibgSpecs?: IBGPolicyContext[];
  // For ibg_policy type only
  systemName?: string;
  systemType?: string;
  autonomyLevel?: number;
};

export const SYSTEM_PROMPT = `You are an AI governance policy specialist working for Verisum, a trust and governance technology company. You generate clear, professional, legally-informed governance policies for small and medium-sized businesses.

Your policies should be:
- Written in plain English (not legalese)
- Practically useful (not just compliance checkbox documents)
- Specific to the company's context (industry, size, tools, jurisdiction)
- Aligned with EU AI Act and UK AI governance frameworks
- Structured with clear headings, numbered sections, and actionable requirements

Output only the policy document in Markdown format. No preamble or commentary.`;

// ---------------------------------------------------------------------------
// IBG context builder — generates a section for policy prompts
// ---------------------------------------------------------------------------

function buildIBGSection(specs: IBGPolicyContext[] | undefined): string {
  if (!specs || specs.length === 0) return "";

  const lines = specs.map((s) => {
    const parts = [`   - **${s.systemName}** (${s.systemType})`];
    if (s.authorisedGoals.length > 0) {
      parts.push(`     Authorised for: ${s.authorisedGoals.join("; ")}`);
    }
    if (s.blastRadius.entityScope) {
      parts.push(`     Entity scope: ${s.blastRadius.entityScope}`);
    }
    if (s.blastRadius.financialScope) {
      parts.push(`     Financial scope: ${s.blastRadius.financialScope}`);
    }
    if (s.blastRadius.dataScope?.length) {
      parts.push(`     Data scope: ${s.blastRadius.dataScope.join(", ")}`);
    }
    if (s.blastRadius.temporalScope) {
      parts.push(`     Temporal scope: ${s.blastRadius.temporalScope}`);
    }
    return parts.join("\n");
  });

  return `

9. Intent-Based Governance\u2122 alignment
   The following AI systems have defined governance intents under the Intent-Based Governance\u2122 framework. Incorporate their authorised goals, decision authorities, and blast radius constraints into the policy requirements:
${lines.join("\n\n")}`;
}

export function buildPolicyPrompt(type: PolicyType, q: PolicyQuestionnaire): string {
  const toolsList = q.aiToolsUsed.join(", ") || "various AI tools";

  switch (type) {
    case "acceptable_use":
      return `Generate an AI Acceptable Use Policy for ${q.companyName}.

Context:
- Industry: ${q.industry}
- Company size: ${q.companySize} employees
- AI tools currently in use: ${toolsList}
- Data sensitivity level: ${q.dataSensitivity}
- Primary jurisdiction: ${q.jurisdiction}
${q.additionalContext ? `- Additional context: ${q.additionalContext}` : ""}

The policy should cover:
1. Purpose and scope
2. Approved AI tools and use cases
3. Prohibited uses
4. Data input restrictions (what data can/cannot be entered into AI tools)
5. Output review and verification requirements
6. Intellectual property considerations
7. Reporting and escalation procedures
8. Review and update schedule${buildIBGSection(q.ibgSpecs)}`;

    case "data_handling":
      return `Generate an AI Data Handling Addendum for ${q.companyName}.

Context:
- Industry: ${q.industry}
- Company size: ${q.companySize} employees
- AI tools currently in use: ${toolsList}
- Data sensitivity level: ${q.dataSensitivity}
- Primary jurisdiction: ${q.jurisdiction}
${q.additionalContext ? `- Additional context: ${q.additionalContext}` : ""}
${q.ibgSpecs?.length ? `
Intent-Based Governance\u2122 data scope constraints:
${q.ibgSpecs.map((s) => `- ${s.systemName}: data scope limited to ${s.blastRadius.dataScope?.join(", ") || "not specified"}`).join("\n")}
` : ""}
The addendum should cover:
1. Data classification for AI tool usage
2. Personal data restrictions
3. Client/customer data handling
4. Data retention and deletion
5. Third-party AI vendor data processing
6. Cross-border data transfer considerations
7. Breach notification procedures for AI-related incidents
8. Compliance with ${q.jurisdiction === "eu" ? "GDPR and EU AI Act" : q.jurisdiction === "uk" ? "UK GDPR and ICO guidance" : "applicable data protection regulations"}
${q.ibgSpecs?.length ? "9. Intent-Based Governance\u2122 data scope alignment — how data handling aligns with defined blast radius constraints per system" : ""}`;

    case "staff_guidelines":
      return `Generate AI Usage Staff Guidelines for ${q.companyName}.

Context:
- Industry: ${q.industry}
- Company size: ${q.companySize} employees
- AI tools currently in use: ${toolsList}
- Data sensitivity level: ${q.dataSensitivity}
- Primary jurisdiction: ${q.jurisdiction}
${q.additionalContext ? `- Additional context: ${q.additionalContext}` : ""}
${q.ibgSpecs?.length ? `
Intent-Based Governance\u2122 context:
${q.ibgSpecs.map((s) => `- ${s.systemName}: authorised for ${s.authorisedGoals.join("; ") || "see governance documentation"}. Decision authorities: ${s.decisionAuthorities.join("; ") || "see governance documentation"}`).join("\n")}
` : ""}
The guidelines should be practical and readable by non-technical staff. Cover:
1. Quick-start: What AI tools are approved and how to access them
2. Dos and Don'ts (simple, clear list)
3. What data you can and cannot input
4. How to review AI-generated output before using it
5. When to escalate or ask for help
6. How to declare your AI usage (link to declaration portal)
7. Common scenarios and examples specific to ${q.industry}
8. Who to contact with questions${q.ibgSpecs?.length ? "\n9. Intent-Based Governance\u2122 boundaries — what each system is authorised to do, what decisions require human approval, and when to escalate" : ""}`;

    case "ibg_policy": {
      const ibg = q.ibgSpecs?.[0];
      return `Generate an Intent-Based Governance\u2122 Policy Document for the AI system "${q.systemName}" at ${q.companyName}.

Context:
- Industry: ${q.industry}
- Primary jurisdiction: ${q.jurisdiction}
- System type: ${q.systemType || "AI System"}
- Autonomy level: ${q.autonomyLevel || "not specified"}/5

${ibg ? `Authorised Goals:
${ibg.authorisedGoals.map((g, i) => `${i + 1}. ${g}`).join("\n")}

Permitted Decision Authorities:
${ibg.decisionAuthorities.map((d, i) => `${i + 1}. ${d}`).join("\n")}

Blast Radius Constraints:
- Entity scope: ${ibg.blastRadius.entityScope || "Not defined"}
- Financial scope: ${ibg.blastRadius.financialScope || "Not defined"}
- Data scope: ${ibg.blastRadius.dataScope?.join(", ") || "Not defined"}
- Temporal scope: ${ibg.blastRadius.temporalScope || "Not defined"}
- Cascade scope: ${ibg.blastRadius.cascadeScope || "Not defined"}` : "No IBG specification available — generate a template with placeholders."}

Generate a formal policy document with the header: "Intent-Based Governance\u2122 Specification \u2014 ${q.systemName || "[System Name]"}"

The document should include:
1. System identification and purpose statement
2. Authorised goals (what this system is permitted to pursue)
3. Prohibited goals (what this system must NOT pursue — infer from authorised goals)
4. Permitted decision authorities and action spaces
5. Blast radius constraints table (entity, financial, data, temporal, cascade scope)
6. Escalation procedures when boundaries are approached or breached
7. Human oversight requirements (which decisions require human approval)
8. Monitoring and compliance requirements
9. Review cadence and change control procedures
10. Regulatory alignment (EU AI Act articles 9, 11, 13, 14)
11. Version, effective date, and approval signature block`;
    }
  }
}
