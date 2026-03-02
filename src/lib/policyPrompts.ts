// Structured prompts for AI governance policy generation.

export type PolicyType = "acceptable_use" | "data_handling" | "staff_guidelines";

export type PolicyQuestionnaire = {
  companyName: string;
  industry: string;
  companySize: string;
  aiToolsUsed: string[];
  dataSensitivity: string;
  jurisdiction: string;
  additionalContext?: string;
};

export const SYSTEM_PROMPT = `You are an AI governance policy specialist working for Verisum, a trust and governance technology company. You generate clear, professional, legally-informed governance policies for small and medium-sized businesses.

Your policies should be:
- Written in plain English (not legalese)
- Practically useful (not just compliance checkbox documents)
- Specific to the company's context (industry, size, tools, jurisdiction)
- Aligned with EU AI Act and UK AI governance frameworks
- Structured with clear headings, numbered sections, and actionable requirements

Output only the policy document in Markdown format. No preamble or commentary.`;

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
8. Review and update schedule`;

    case "data_handling":
      return `Generate an AI Data Handling Addendum for ${q.companyName}.

Context:
- Industry: ${q.industry}
- Company size: ${q.companySize} employees
- AI tools currently in use: ${toolsList}
- Data sensitivity level: ${q.dataSensitivity}
- Primary jurisdiction: ${q.jurisdiction}
${q.additionalContext ? `- Additional context: ${q.additionalContext}` : ""}

The addendum should cover:
1. Data classification for AI tool usage
2. Personal data restrictions
3. Client/customer data handling
4. Data retention and deletion
5. Third-party AI vendor data processing
6. Cross-border data transfer considerations
7. Breach notification procedures for AI-related incidents
8. Compliance with ${q.jurisdiction === "eu" ? "GDPR and EU AI Act" : q.jurisdiction === "uk" ? "UK GDPR and ICO guidance" : "applicable data protection regulations"}`;

    case "staff_guidelines":
      return `Generate AI Usage Staff Guidelines for ${q.companyName}.

Context:
- Industry: ${q.industry}
- Company size: ${q.companySize} employees
- AI tools currently in use: ${toolsList}
- Data sensitivity level: ${q.dataSensitivity}
- Primary jurisdiction: ${q.jurisdiction}
${q.additionalContext ? `- Additional context: ${q.additionalContext}` : ""}

The guidelines should be practical and readable by non-technical staff. Cover:
1. Quick-start: What AI tools are approved and how to access them
2. Dos and Don'ts (simple, clear list)
3. What data you can and cannot input
4. How to review AI-generated output before using it
5. When to escalate or ask for help
6. How to declare your AI usage (link to declaration portal)
7. Common scenarios and examples specific to ${q.industry}
8. Who to contact with questions`;
  }
}
