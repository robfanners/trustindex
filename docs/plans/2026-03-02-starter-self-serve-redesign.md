# Starter Self-Serve Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure Starter tier around an AI Governance Setup Wizard that produces a downloadable Governance Pack (3 PDFs), plus monthly compliance reports and email delivery.

**Architecture:** New `/setup` wizard collects company data in 4 steps → wizard responses stored in `governance_wizard` table → on completion, LLM generates governance statement + gap analysis → jsPDF renders 3 branded PDFs server-side → stored in `governance_packs` table. Monthly report cron aggregates Copilot data into a summary PDF sent via Resend. Starter entitlements restructured: TrustOrg surveys removed, wizard + pack added.

**Tech Stack:** Next.js App Router, TypeScript, Supabase (Postgres + service role), Anthropic SDK (Claude Sonnet), jsPDF (server-side PDF), Resend (email), Stripe (existing).

**Design doc:** `docs/plans/2026-03-02-starter-self-serve-redesign-design.md`

---

## Phase 1: Database + Entitlements

### Task 1: Database Migration — Wizard, Packs, Reports Tables

**Files:**
- Create: `supabase/migrations/015_governance_wizard_schema.sql`

**Step 1: Write the migration**

```sql
-- 015_governance_wizard_schema.sql
-- Tables for AI Governance Setup Wizard, Governance Packs, and Monthly Reports

-- GOVERNANCE_WIZARD — stores wizard run responses
CREATE TABLE IF NOT EXISTS governance_wizard (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  version         integer NOT NULL DEFAULT 1,
  responses       jsonb NOT NULL DEFAULT '{}',
  completed_at    timestamptz,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_governance_wizard_org ON governance_wizard(organisation_id);
CREATE INDEX idx_governance_wizard_org_version ON governance_wizard(organisation_id, version DESC);

ALTER TABLE governance_wizard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org wizard runs"
  ON governance_wizard FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own org wizard runs"
  ON governance_wizard FOR INSERT
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );

-- GOVERNANCE_PACKS — stores generated pack metadata + content
CREATE TABLE IF NOT EXISTS governance_packs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  wizard_id       uuid NOT NULL REFERENCES governance_wizard(id) ON DELETE CASCADE,
  version         integer NOT NULL DEFAULT 1,
  statement_md    text,
  inventory_json  jsonb,
  gap_analysis_md text,
  status          text NOT NULL DEFAULT 'generating' CHECK (status IN ('generating', 'ready', 'failed')),
  generated_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_governance_packs_org ON governance_packs(organisation_id);
CREATE INDEX idx_governance_packs_wizard ON governance_packs(wizard_id);

ALTER TABLE governance_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org packs"
  ON governance_packs FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );

-- MONTHLY_REPORTS — stores generated monthly report metadata
CREATE TABLE IF NOT EXISTS monthly_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  report_month    text NOT NULL,
  report_data     jsonb NOT NULL DEFAULT '{}',
  sent_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_monthly_reports_org ON monthly_reports(organisation_id);
CREATE UNIQUE INDEX idx_monthly_reports_org_month ON monthly_reports(organisation_id, report_month);

ALTER TABLE monthly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org reports"
  ON monthly_reports FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM profiles WHERE id = auth.uid()
    )
  );
```

**Step 2: Apply migration to Supabase**

Run the migration against the Supabase project via the dashboard SQL editor or `supabase db push`. Verify tables exist:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('governance_wizard', 'governance_packs', 'monthly_reports');
```

**Step 3: Commit**

```bash
git add supabase/migrations/015_governance_wizard_schema.sql
git commit -m "feat: add governance_wizard, governance_packs, monthly_reports tables"
```

---

### Task 2: Update Entitlements — Starter Restructure

**Files:**
- Modify: `src/lib/entitlements.ts`

**Step 1: Update Starter survey limit and add wizard entitlements**

Changes to `src/lib/entitlements.ts`:

1. Change Starter `maxSurveys` from `3` to `0`:
```typescript
// In LIMITS constant:
starter: { maxSurveys: 0, maxSystems: 0, canExport: false },
```

2. Add new entitlement functions after the existing copilot functions:
```typescript
export function canAccessWizard(plan: string | null | undefined): boolean {
  return isPaidPlan(plan);
}

export function canGeneratePack(plan: string | null | undefined): boolean {
  return isPaidPlan(plan);
}

export function canAccessMonthlyReport(plan: string | null | undefined): boolean {
  return isPaidPlan(plan);
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Clean build. Any pages referencing Starter survey access may need updates (handled in Task 11).

**Step 3: Commit**

```bash
git add src/lib/entitlements.ts
git commit -m "feat: restructure Starter entitlements — remove TrustOrg, add wizard/pack access"
```

---

## Phase 2: Wizard Backend + Prompts

### Task 3: Wizard API Routes

**Files:**
- Create: `src/app/api/wizard/route.ts` — GET (load latest) + POST (save)
- Create: `src/app/api/wizard/complete/route.ts` — POST (mark complete, trigger pack generation)

**Step 1: Create wizard CRUD route**

Create `src/app/api/wizard/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getUserPlan, canAccessWizard } from "@/lib/entitlements";

export const runtime = "nodejs";

// GET — load latest wizard run for this org
export async function GET() {
  try {
    const authClient = await createSupabaseServerClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const plan = await getUserPlan(user.id);
    if (!canAccessWizard(plan)) {
      return NextResponse.json({ error: "Upgrade to access the governance wizard" }, { status: 403 });
    }

    const sb = supabaseServer();
    const { data: profile } = await sb
      .from("profiles")
      .select("organisation_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organisation_id) {
      return NextResponse.json({ error: "No organisation found" }, { status: 400 });
    }

    const { data: wizard } = await sb
      .from("governance_wizard")
      .select("*")
      .eq("organisation_id", profile.organisation_id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({ wizard });
  } catch (err: unknown) {
    console.error("[wizard] GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// POST — save wizard responses (create new version or update in-progress)
export async function POST(req: Request) {
  try {
    const authClient = await createSupabaseServerClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const plan = await getUserPlan(user.id);
    if (!canAccessWizard(plan)) {
      return NextResponse.json({ error: "Upgrade to access the governance wizard" }, { status: 403 });
    }

    const sb = supabaseServer();
    const { data: profile } = await sb
      .from("profiles")
      .select("organisation_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organisation_id) {
      return NextResponse.json({ error: "No organisation found" }, { status: 400 });
    }

    const body = await req.json();
    const { responses } = body;

    if (!responses || typeof responses !== "object") {
      return NextResponse.json({ error: "Missing responses" }, { status: 400 });
    }

    // Check for an in-progress wizard run (not yet completed)
    const { data: existing } = await sb
      .from("governance_wizard")
      .select("id, version")
      .eq("organisation_id", profile.organisation_id)
      .is("completed_at", null)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      // Update existing in-progress run
      const { data: wizard, error } = await sb
        .from("governance_wizard")
        .update({ responses })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        console.error("[wizard] Update error:", error);
        return NextResponse.json({ error: "Failed to save wizard" }, { status: 500 });
      }

      return NextResponse.json({ wizard });
    }

    // Create new wizard run
    const { count } = await sb
      .from("governance_wizard")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", profile.organisation_id);

    const version = (count ?? 0) + 1;

    const { data: wizard, error } = await sb
      .from("governance_wizard")
      .insert({
        organisation_id: profile.organisation_id,
        version,
        responses,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("[wizard] Insert error:", error);
      return NextResponse.json({ error: "Failed to save wizard" }, { status: 500 });
    }

    return NextResponse.json({ wizard });
  } catch (err: unknown) {
    console.error("[wizard] POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
```

**Step 2: Create wizard completion route**

Create `src/app/api/wizard/complete/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getUserPlan, canAccessWizard } from "@/lib/entitlements";

export const runtime = "nodejs";

// POST — mark wizard as complete, pre-populate vendor register
export async function POST(req: Request) {
  try {
    const authClient = await createSupabaseServerClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const plan = await getUserPlan(user.id);
    if (!canAccessWizard(plan)) {
      return NextResponse.json({ error: "Upgrade required" }, { status: 403 });
    }

    const sb = supabaseServer();
    const { data: profile } = await sb
      .from("profiles")
      .select("organisation_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organisation_id) {
      return NextResponse.json({ error: "No organisation found" }, { status: 400 });
    }

    const body = await req.json();
    const { wizardId } = body;

    if (!wizardId) {
      return NextResponse.json({ error: "Missing wizardId" }, { status: 400 });
    }

    // Mark wizard as complete
    const { data: wizard, error: wizErr } = await sb
      .from("governance_wizard")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", wizardId)
      .eq("organisation_id", profile.organisation_id)
      .select()
      .single();

    if (wizErr || !wizard) {
      return NextResponse.json({ error: "Failed to complete wizard" }, { status: 500 });
    }

    // Pre-populate vendor register from wizard tool inventory
    const responses = wizard.responses as Record<string, unknown>;
    const tools = (responses.tools ?? []) as Array<{
      name: string;
      purpose: string;
      dataClassification: string;
      departments: string;
    }>;

    for (const tool of tools) {
      // Check if vendor already exists by name
      const { data: existing } = await sb
        .from("ai_vendors")
        .select("id")
        .eq("organisation_id", profile.organisation_id)
        .ilike("vendor_name", tool.name)
        .maybeSingle();

      if (!existing) {
        await sb.from("ai_vendors").insert({
          organisation_id: profile.organisation_id,
          vendor_name: tool.name,
          data_types: [tool.dataClassification],
          risk_category: "unassessed",
          source: "integration",
          notes: `Purpose: ${tool.purpose}. Departments: ${tool.departments}. Added via governance wizard.`,
        });
      }
    }

    return NextResponse.json({ wizard });
  } catch (err: unknown) {
    console.error("[wizard] complete error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
```

**Step 3: Verify build**

Run: `npm run build`

**Step 4: Commit**

```bash
git add src/app/api/wizard/route.ts src/app/api/wizard/complete/route.ts
git commit -m "feat: add wizard API routes — save/load responses, complete + vendor pre-population"
```

---

### Task 4: Governance Pack Prompts

**Files:**
- Create: `src/lib/governancePrompts.ts`

**Step 1: Create the prompts module**

Create `src/lib/governancePrompts.ts`:

```typescript
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
    hasPolicy: string;           // yes | no | partial
    requiresApproval: string;    // yes | no | for_some
    humanReview: string;         // always | sometimes | never
    logsUsage: string;           // yes | no | partially
    staffTrained: string;        // yes | no | planned
    incidentProcess: string;     // yes | no | informal
    vendorAssessment: string;    // yes | no | sometimes
    namedResponsible: string;    // yes | no
  };
};

// --- Governance Statement ---

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

End with the version number and date.`;
}

// --- Gap Analysis ---

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

For each gap:
1. Name the gap (e.g., "No formal AI usage policy")
2. Classify as RED (critical), AMBER (important), or GREEN (adequate)
3. Explain the risk in 1-2 sentences
4. Provide a specific, practical recommendation achievable in 30 days
5. Note the relevant regulatory reference (EU AI Act article or UK framework section)

Format as a numbered list with clear headings. Include a summary table at the top showing area → status (RED/AMBER/GREEN).`;
}

// --- Helpers ---

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
  };
  return labels[key] ?? key;
}
```

**Step 2: Verify build**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/lib/governancePrompts.ts
git commit -m "feat: add governance statement and gap analysis LLM prompts"
```

---

## Phase 3: Wizard UI

### Task 5: Wizard Page — 4-Step Guided Flow

**Files:**
- Create: `src/app/setup/page.tsx`

This is a client component with 4 steps, auto-saving on each step transition. Step 4 triggers pack generation.

**Step 1: Create the wizard page**

Create `src/app/setup/page.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { canAccessWizard } from "@/lib/entitlements";
import AuthenticatedShell from "@/components/AuthenticatedShell";
import type { WizardResponses } from "@/lib/governancePrompts";

const INDUSTRIES = [
  "Technology", "Financial Services", "Healthcare", "Legal",
  "Education", "Retail / E-commerce", "Manufacturing",
  "Professional Services", "Media / Publishing", "Other",
];

const HEADCOUNT_RANGES = [
  "1-10", "11-50", "51-200", "201-500", "500+",
];

const JURISDICTIONS = [
  { value: "uk", label: "United Kingdom" },
  { value: "eu", label: "European Union" },
  { value: "uk_eu", label: "UK + EU" },
  { value: "other", label: "Other / Global" },
];

const COMMON_TOOLS = [
  "ChatGPT", "GitHub Copilot", "Claude", "Gemini",
  "Midjourney", "DALL-E", "Microsoft Copilot",
  "Jasper", "Grammarly AI", "Notion AI",
];

const PURPOSES = [
  "Content creation", "Code assistance", "Data analysis",
  "Customer-facing", "Internal operations", "Research",
];

const DATA_CLASSIFICATIONS = [
  { value: "public", label: "Public data only" },
  { value: "internal", label: "Internal / business data" },
  { value: "personal", label: "Personal data (names, emails, etc.)" },
  { value: "sensitive", label: "Sensitive data (financial, health, etc.)" },
];

type ToolEntry = {
  name: string;
  purpose: string;
  dataClassification: string;
  departments: string;
};

const STEPS = ["Company Profile", "AI Tool Inventory", "Control Posture", "Review & Generate"];

export default function SetupPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [wizardId, setWizardId] = useState<string | null>(null);

  // Step 1: Company profile
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [headcount, setHeadcount] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");

  // Step 2: Tools
  const [tools, setTools] = useState<ToolEntry[]>([]);
  const [showToolForm, setShowToolForm] = useState(false);
  const [newTool, setNewTool] = useState<ToolEntry>({
    name: "", purpose: "", dataClassification: "", departments: "",
  });

  // Step 3: Controls
  const [controls, setControls] = useState({
    hasPolicy: "",
    requiresApproval: "",
    humanReview: "",
    logsUsage: "",
    staffTrained: "",
    incidentProcess: "",
    vendorAssessment: "",
    namedResponsible: "",
  });

  // Load existing wizard data on mount
  useEffect(() => {
    if (!user || loading) return;
    async function load() {
      try {
        const res = await fetch("/api/wizard");
        if (res.ok) {
          const data = await res.json();
          if (data.wizard?.responses) {
            const r = data.wizard.responses as WizardResponses;
            setWizardId(data.wizard.id);
            if (r.company) {
              setCompanyName(r.company.name ?? "");
              setIndustry(r.company.industry ?? "");
              setHeadcount(r.company.headcount ?? "");
              setJurisdiction(r.company.jurisdiction ?? "");
            }
            if (r.tools) setTools(r.tools);
            if (r.controls) setControls((prev) => ({ ...prev, ...r.controls }));
            // If wizard was already completed, allow re-run from start
            if (data.wizard.completed_at) {
              setWizardId(null); // Will create a new version
            }
          }
        }
      } catch {
        // silent — first time user
      }
    }
    load();
  }, [user, loading]);

  // Pre-fill company name from profile
  useEffect(() => {
    if (profile?.company_name && !companyName) {
      setCompanyName(profile.company_name);
    }
  }, [profile, companyName]);

  if (loading) {
    return (
      <AuthenticatedShell>
        <div className="max-w-2xl mx-auto p-8 text-center text-muted-foreground">Loading...</div>
      </AuthenticatedShell>
    );
  }

  if (!user || !profile) {
    router.push("/auth/login");
    return null;
  }

  if (!canAccessWizard(profile.plan)) {
    router.push("/upgrade");
    return null;
  }

  function buildResponses(): WizardResponses {
    return {
      company: { name: companyName, industry, headcount, jurisdiction },
      tools,
      controls,
    };
  }

  async function saveProgress() {
    setSaving(true);
    try {
      const res = await fetch("/api/wizard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses: buildResponses() }),
      });
      if (res.ok) {
        const data = await res.json();
        setWizardId(data.wizard.id);
      }
    } catch {
      // silent save failure
    } finally {
      setSaving(false);
    }
  }

  async function handleNext() {
    await saveProgress();
    setStep((s) => Math.min(s + 1, 3));
  }

  function handleBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function addTool() {
    if (!newTool.name) return;
    setTools((prev) => [...prev, { ...newTool }]);
    setNewTool({ name: "", purpose: "", dataClassification: "", departments: "" });
    setShowToolForm(false);
  }

  function removeTool(index: number) {
    setTools((prev) => prev.filter((_, i) => i !== index));
  }

  function addCommonTool(name: string) {
    if (tools.some((t) => t.name === name)) return;
    setTools((prev) => [...prev, { name, purpose: "", dataClassification: "", departments: "" }]);
  }

  async function handleGenerate() {
    if (!wizardId) {
      await saveProgress();
    }
    setGenerating(true);
    try {
      // Complete the wizard
      const completeRes = await fetch("/api/wizard/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wizardId }),
      });
      if (!completeRes.ok) {
        alert("Failed to complete wizard. Please try again.");
        return;
      }

      // Trigger pack generation
      const packRes = await fetch("/api/governance-pack/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wizardId }),
      });
      if (packRes.ok) {
        router.push("/dashboard#copilot");
      } else {
        const err = await packRes.json();
        alert(err.error || "Pack generation failed. Please try again.");
      }
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <AuthenticatedShell>
      <div className="max-w-2xl mx-auto p-6 md:p-8">
        <h1 className="text-2xl font-bold mb-2">AI Governance Setup</h1>
        <p className="text-muted-foreground mb-6">
          Answer a few questions about your AI usage and controls. We&apos;ll generate your governance pack.
        </p>

        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex-1">
              <div
                className={`h-1.5 rounded-full ${
                  i <= step ? "bg-brand" : "bg-muted"
                }`}
              />
              <p className={`text-xs mt-1 ${i === step ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* Step 1: Company Profile */}
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Company name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                placeholder="Acme Ltd"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Industry</label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">Select industry...</option>
                {INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind}>{ind}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Headcount</label>
              <select
                value={headcount}
                onChange={(e) => setHeadcount(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">Select range...</option>
                {HEADCOUNT_RANGES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Primary jurisdiction</label>
              <select
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">Select jurisdiction...</option>
                {JURISDICTIONS.map((j) => (
                  <option key={j.value} value={j.value}>{j.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Step 2: AI Tool Inventory */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Click common tools to add them, or add custom tools below.
            </p>

            {/* Quick-add common tools */}
            <div className="flex flex-wrap gap-2">
              {COMMON_TOOLS.map((name) => {
                const added = tools.some((t) => t.name === name);
                return (
                  <button
                    key={name}
                    onClick={() => addCommonTool(name)}
                    disabled={added}
                    className={`text-xs px-3 py-1.5 rounded-full border ${
                      added
                        ? "bg-brand/10 border-brand text-brand"
                        : "border-border hover:border-brand hover:text-brand"
                    }`}
                  >
                    {added ? `✓ ${name}` : `+ ${name}`}
                  </button>
                );
              })}
            </div>

            {/* Added tools list */}
            {tools.length > 0 && (
              <div className="space-y-2">
                {tools.map((tool, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-sm">{tool.name}</span>
                      <button
                        onClick={() => removeTool(i)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={tool.purpose}
                        onChange={(e) => {
                          const updated = [...tools];
                          updated[i] = { ...updated[i], purpose: e.target.value };
                          setTools(updated);
                        }}
                        className="text-xs rounded border border-border bg-background px-2 py-1"
                      >
                        <option value="">Purpose...</option>
                        {PURPOSES.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                      <select
                        value={tool.dataClassification}
                        onChange={(e) => {
                          const updated = [...tools];
                          updated[i] = { ...updated[i], dataClassification: e.target.value };
                          setTools(updated);
                        }}
                        className="text-xs rounded border border-border bg-background px-2 py-1"
                      >
                        <option value="">Data type...</option>
                        {DATA_CLASSIFICATIONS.map((d) => (
                          <option key={d.value} value={d.value}>{d.label}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={tool.departments}
                        onChange={(e) => {
                          const updated = [...tools];
                          updated[i] = { ...updated[i], departments: e.target.value };
                          setTools(updated);
                        }}
                        placeholder="Departments..."
                        className="text-xs rounded border border-border bg-background px-2 py-1"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add custom tool */}
            {showToolForm ? (
              <div className="border border-dashed rounded-lg p-3 space-y-2">
                <input
                  type="text"
                  value={newTool.name}
                  onChange={(e) => setNewTool((t) => ({ ...t, name: e.target.value }))}
                  placeholder="Tool name"
                  className="w-full text-sm rounded border border-border bg-background px-3 py-1.5"
                />
                <div className="flex gap-2">
                  <button
                    onClick={addTool}
                    disabled={!newTool.name}
                    className="text-xs px-3 py-1.5 rounded bg-brand text-white disabled:opacity-50"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setShowToolForm(false)}
                    className="text-xs px-3 py-1.5 rounded border border-border"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowToolForm(true)}
                className="text-sm text-brand hover:underline"
              >
                + Add custom tool
              </button>
            )}
          </div>
        )}

        {/* Step 3: Control Posture */}
        {step === 2 && (
          <div className="space-y-5">
            {CONTROL_QUESTIONS.map((q) => (
              <div key={q.key}>
                <p className="text-sm font-medium mb-2">{q.question}</p>
                <div className="flex flex-wrap gap-2">
                  {q.options.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setControls((c) => ({ ...c, [q.key]: opt.value }))}
                      className={`text-xs px-3 py-1.5 rounded-full border ${
                        controls[q.key as keyof typeof controls] === opt.value
                          ? "bg-brand text-white border-brand"
                          : "border-border hover:border-brand"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Step 4: Review & Generate */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-medium">Company</h3>
              <p className="text-sm text-muted-foreground">
                {companyName} &middot; {industry} &middot; {headcount} employees &middot; {jurisdiction}
              </p>
            </div>
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-medium">AI Tools ({tools.length})</h3>
              {tools.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tools declared</p>
              ) : (
                <ul className="text-sm text-muted-foreground space-y-1">
                  {tools.map((t, i) => (
                    <li key={i}>{t.name}{t.purpose ? ` — ${t.purpose}` : ""}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-medium">Control Posture</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                {Object.entries(controls).map(([key, val]) => {
                  const q = CONTROL_QUESTIONS.find((cq) => cq.key === key);
                  return (
                    <li key={key}>
                      <span className={val === "yes" || val === "always" ? "text-green-600" : val === "no" || val === "never" ? "text-red-500" : "text-amber-500"}>
                        {val || "—"}
                      </span>
                      {" "}{q?.shortLabel ?? key}
                    </li>
                  );
                })}
              </ul>
            </div>

            {generating && (
              <div className="text-center py-8 space-y-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand mx-auto" />
                <p className="text-sm text-muted-foreground">Generating your governance pack...</p>
                <p className="text-xs text-muted-foreground">This may take 30-60 seconds</p>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8 pt-4 border-t">
          {step > 0 ? (
            <button
              onClick={handleBack}
              className="text-sm px-4 py-2 rounded-lg border border-border hover:bg-muted"
            >
              Back
            </button>
          ) : (
            <div />
          )}
          {step < 3 ? (
            <button
              onClick={handleNext}
              disabled={saving}
              className="text-sm px-4 py-2 rounded-lg bg-brand text-white hover:bg-brand/90 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Continue"}
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="text-sm px-5 py-2.5 rounded-lg bg-brand text-white hover:bg-brand/90 disabled:opacity-50 font-medium"
            >
              {generating ? "Generating..." : "Generate Governance Pack"}
            </button>
          )}
        </div>
      </div>
    </AuthenticatedShell>
  );
}

// --- Control questions config ---

const CONTROL_QUESTIONS = [
  {
    key: "hasPolicy",
    question: "Do you have an AI usage policy?",
    shortLabel: "AI usage policy",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
      { value: "partial", label: "Partial / Draft" },
    ],
  },
  {
    key: "requiresApproval",
    question: "Do staff need approval before using AI tools?",
    shortLabel: "Staff approval required",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
      { value: "for_some", label: "For some tools" },
    ],
  },
  {
    key: "humanReview",
    question: "Are AI outputs reviewed by a human before use?",
    shortLabel: "Human review of outputs",
    options: [
      { value: "always", label: "Always" },
      { value: "sometimes", label: "Sometimes" },
      { value: "never", label: "Never" },
    ],
  },
  {
    key: "logsUsage",
    question: "Do you log which AI tools are used and for what?",
    shortLabel: "Usage logging",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
      { value: "partially", label: "Partially" },
    ],
  },
  {
    key: "staffTrained",
    question: "Have staff been trained on responsible AI use?",
    shortLabel: "Staff training",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
      { value: "planned", label: "Planned" },
    ],
  },
  {
    key: "incidentProcess",
    question: "Do you have a process for handling AI-related incidents?",
    shortLabel: "Incident process",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
      { value: "informal", label: "Informal" },
    ],
  },
  {
    key: "vendorAssessment",
    question: "Do you assess vendors before adopting new AI tools?",
    shortLabel: "Vendor assessment",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
      { value: "sometimes", label: "Sometimes" },
    ],
  },
  {
    key: "namedResponsible",
    question: "Is there a named person responsible for AI governance?",
    shortLabel: "Named responsible person",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  },
];
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Clean build. The `/setup` route should be accessible.

**Step 3: Commit**

```bash
git add src/app/setup/page.tsx
git commit -m "feat: add AI Governance Setup Wizard — 4-step guided flow"
```

---

## Phase 4: Governance Pack Generation

### Task 6: Governance Pack API — Generate Pack

**Files:**
- Create: `src/app/api/governance-pack/generate/route.ts`

**Step 1: Create the pack generation endpoint**

Create `src/app/api/governance-pack/generate/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getUserPlan, canGeneratePack } from "@/lib/entitlements";
import { generateText } from "@/lib/llm";
import {
  GOVERNANCE_STATEMENT_SYSTEM,
  buildGovernanceStatementPrompt,
  GAP_ANALYSIS_SYSTEM,
  buildGapAnalysisPrompt,
} from "@/lib/governancePrompts";
import type { WizardResponses } from "@/lib/governancePrompts";

export const runtime = "nodejs";
export const maxDuration = 120; // LLM calls can take time

export async function POST(req: Request) {
  try {
    const authClient = await createSupabaseServerClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const plan = await getUserPlan(user.id);
    if (!canGeneratePack(plan)) {
      return NextResponse.json({ error: "Upgrade to generate governance packs" }, { status: 403 });
    }

    const sb = supabaseServer();
    const { data: profile } = await sb
      .from("profiles")
      .select("organisation_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organisation_id) {
      return NextResponse.json({ error: "No organisation found" }, { status: 400 });
    }

    const body = await req.json();
    const { wizardId } = body;

    if (!wizardId) {
      return NextResponse.json({ error: "Missing wizardId" }, { status: 400 });
    }

    // Load wizard responses
    const { data: wizard } = await sb
      .from("governance_wizard")
      .select("*")
      .eq("id", wizardId)
      .eq("organisation_id", profile.organisation_id)
      .single();

    if (!wizard) {
      return NextResponse.json({ error: "Wizard run not found" }, { status: 404 });
    }

    const responses = wizard.responses as WizardResponses;

    // Get version number
    const { count } = await sb
      .from("governance_packs")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", profile.organisation_id);

    const version = (count ?? 0) + 1;

    // Create pack record in "generating" status
    const { data: pack, error: insertErr } = await sb
      .from("governance_packs")
      .insert({
        organisation_id: profile.organisation_id,
        wizard_id: wizardId,
        version,
        status: "generating",
      })
      .select()
      .single();

    if (insertErr || !pack) {
      console.error("[pack] Insert error:", insertErr);
      return NextResponse.json({ error: "Failed to create pack" }, { status: 500 });
    }

    try {
      // Generate governance statement (LLM)
      const statementPrompt = buildGovernanceStatementPrompt(responses, version);
      const statementMd = await generateText(
        GOVERNANCE_STATEMENT_SYSTEM,
        [{ role: "user", content: statementPrompt }],
        { maxTokens: 4096, temperature: 0.3 }
      );

      // Build usage inventory (structured data, no LLM needed)
      const inventoryJson = {
        generatedAt: new Date().toISOString(),
        company: responses.company,
        tools: responses.tools,
        // Also include vendors from the register
        additionalVendors: [] as Array<{ vendor_name: string; risk_category: string }>,
      };

      // Fetch vendor register data
      const { data: vendors } = await sb
        .from("ai_vendors")
        .select("vendor_name, risk_category, data_types, source")
        .eq("organisation_id", profile.organisation_id);

      if (vendors) {
        inventoryJson.additionalVendors = vendors;
      }

      // Generate gap analysis (LLM)
      const gapPrompt = buildGapAnalysisPrompt(responses);
      const gapMd = await generateText(
        GAP_ANALYSIS_SYSTEM,
        [{ role: "user", content: gapPrompt }],
        { maxTokens: 4096, temperature: 0.3 }
      );

      // Update pack with generated content
      const { data: updatedPack, error: updateErr } = await sb
        .from("governance_packs")
        .update({
          statement_md: statementMd,
          inventory_json: inventoryJson,
          gap_analysis_md: gapMd,
          status: "ready",
          generated_at: new Date().toISOString(),
        })
        .eq("id", pack.id)
        .select()
        .single();

      if (updateErr) {
        console.error("[pack] Update error:", updateErr);
        return NextResponse.json({ error: "Failed to save pack" }, { status: 500 });
      }

      return NextResponse.json({ pack: updatedPack });
    } catch (genErr: unknown) {
      // Mark pack as failed
      await sb
        .from("governance_packs")
        .update({ status: "failed" })
        .eq("id", pack.id);

      console.error("[pack] Generation error:", genErr);
      return NextResponse.json(
        { error: genErr instanceof Error ? genErr.message : "Pack generation failed" },
        { status: 500 }
      );
    }
  } catch (err: unknown) {
    console.error("[pack] generate error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify build**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/app/api/governance-pack/generate/route.ts
git commit -m "feat: add governance pack generation API — statement + inventory + gap analysis"
```

---

### Task 7: Governance Pack PDF Download

**Files:**
- Create: `src/app/api/governance-pack/route.ts` — GET (list packs)
- Create: `src/app/api/governance-pack/[id]/pdf/route.ts` — GET (download PDF)
- Create: `src/lib/governancePdf.ts` — PDF rendering logic

**Step 1: Create the PDF renderer**

Create `src/lib/governancePdf.ts`:

```typescript
import jsPDF from "jspdf";

const BRAND_COLOR: [number, number, number] = [37, 99, 235]; // #2563eb
const TEXT_COLOR: [number, number, number] = [17, 24, 39];
const MUTED_COLOR: [number, number, number] = [107, 114, 128];
const RED: [number, number, number] = [220, 38, 38];
const AMBER: [number, number, number] = [217, 119, 6];
const GREEN: [number, number, number] = [22, 163, 74];

const MARGIN = 20;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function addHeader(doc: jsPDF, title: string, orgName: string, version: string, date: string) {
  let y = MARGIN;

  // Brand header
  doc.setFontSize(10);
  doc.setTextColor(...BRAND_COLOR);
  doc.text("VERISUM", MARGIN, y);
  doc.setTextColor(...MUTED_COLOR);
  doc.text("AI Governance", MARGIN + 22, y);

  y += 12;
  doc.setFontSize(18);
  doc.setTextColor(...TEXT_COLOR);
  doc.setFont("helvetica", "bold");
  doc.text(title, MARGIN, y);

  y += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED_COLOR);
  doc.text(`${orgName}  |  ${version}  |  ${date}`, MARGIN, y);

  y += 4;
  doc.setDrawColor(...BRAND_COLOR);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);

  return y + 8;
}

function addWrappedText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  const lines = doc.splitTextToSize(text, maxWidth);
  for (const line of lines) {
    if (y > 270) {
      doc.addPage();
      y = MARGIN;
    }
    doc.text(line, x, y);
    y += lineHeight;
  }
  return y;
}

function renderMarkdownSimple(doc: jsPDF, md: string, startY: number): number {
  let y = startY;
  const lines = md.split("\n");

  for (const line of lines) {
    if (y > 270) {
      doc.addPage();
      y = MARGIN;
    }

    const trimmed = line.trim();

    if (trimmed.startsWith("# ")) {
      y += 4;
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...TEXT_COLOR);
      y = addWrappedText(doc, trimmed.slice(2), MARGIN, y, CONTENT_WIDTH, 7);
      y += 2;
    } else if (trimmed.startsWith("## ")) {
      y += 3;
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...TEXT_COLOR);
      y = addWrappedText(doc, trimmed.slice(3), MARGIN, y, CONTENT_WIDTH, 6);
      y += 2;
    } else if (trimmed.startsWith("### ")) {
      y += 2;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...TEXT_COLOR);
      y = addWrappedText(doc, trimmed.slice(4), MARGIN, y, CONTENT_WIDTH, 5.5);
      y += 1;
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...TEXT_COLOR);
      doc.text("•", MARGIN + 2, y);
      y = addWrappedText(doc, trimmed.slice(2), MARGIN + 8, y, CONTENT_WIDTH - 8, 5);
    } else if (/^\d+\.\s/.test(trimmed)) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...TEXT_COLOR);
      const num = trimmed.match(/^(\d+\.)\s/)?.[1] ?? "";
      doc.text(num, MARGIN + 2, y);
      y = addWrappedText(doc, trimmed.replace(/^\d+\.\s/, ""), MARGIN + 10, y, CONTENT_WIDTH - 10, 5);
    } else if (trimmed === "") {
      y += 3;
    } else {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...TEXT_COLOR);
      y = addWrappedText(doc, trimmed, MARGIN, y, CONTENT_WIDTH, 5);
    }
  }

  return y;
}

export function generateGovernanceStatementPdf(
  statementMd: string,
  orgName: string,
  version: number,
): Uint8Array {
  const doc = new jsPDF("p", "mm", "a4");
  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  let y = addHeader(doc, "AI Governance Statement", orgName, `v${version}.0`, date);
  y = renderMarkdownSimple(doc, statementMd, y);

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED_COLOR);
    doc.text(`Generated by Verisum AI Governance  |  Page ${i} of ${pageCount}`, MARGIN, 287);
  }

  return new Uint8Array(doc.output("arraybuffer"));
}

export function generateUsageInventoryPdf(
  inventoryJson: {
    company: { name: string; industry: string; headcount: string; jurisdiction: string };
    tools: Array<{ name: string; purpose: string; dataClassification: string; departments: string }>;
    additionalVendors: Array<{ vendor_name: string; risk_category: string }>;
  },
  orgName: string,
  version: number,
): Uint8Array {
  const doc = new jsPDF("p", "mm", "a4");
  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  let y = addHeader(doc, "AI Usage Inventory", orgName, `v${version}.0`, date);

  // Company info
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_COLOR);
  doc.text("Organisation Details", MARGIN, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const details = [
    `Company: ${inventoryJson.company.name}`,
    `Industry: ${inventoryJson.company.industry}`,
    `Headcount: ${inventoryJson.company.headcount}`,
    `Jurisdiction: ${inventoryJson.company.jurisdiction}`,
  ];
  for (const d of details) {
    doc.text(d, MARGIN, y);
    y += 4.5;
  }
  y += 4;

  // Tools table
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("AI Tools in Use", MARGIN, y);
  y += 6;

  // Table header
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setFillColor(245, 245, 245);
  doc.rect(MARGIN, y - 3, CONTENT_WIDTH, 6, "F");
  doc.text("Tool", MARGIN + 2, y);
  doc.text("Purpose", MARGIN + 42, y);
  doc.text("Data Classification", MARGIN + 92, y);
  doc.text("Departments", MARGIN + 135, y);
  y += 5;

  // Table rows
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT_COLOR);
  for (const tool of inventoryJson.tools) {
    if (y > 270) { doc.addPage(); y = MARGIN; }
    doc.text(tool.name || "—", MARGIN + 2, y);
    doc.text(tool.purpose || "—", MARGIN + 42, y);
    doc.text(tool.dataClassification || "—", MARGIN + 92, y);
    doc.text(tool.departments || "—", MARGIN + 135, y);
    y += 5;
    doc.setDrawColor(230, 230, 230);
    doc.line(MARGIN, y - 2, PAGE_WIDTH - MARGIN, y - 2);
  }

  // Additional vendors from register
  if (inventoryJson.additionalVendors.length > 0) {
    y += 6;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Vendor Register Summary", MARGIN, y);
    y += 6;

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(245, 245, 245);
    doc.rect(MARGIN, y - 3, CONTENT_WIDTH, 6, "F");
    doc.text("Vendor", MARGIN + 2, y);
    doc.text("Risk Category", MARGIN + 80, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    for (const v of inventoryJson.additionalVendors) {
      if (y > 270) { doc.addPage(); y = MARGIN; }
      doc.text(v.vendor_name, MARGIN + 2, y);

      const risk = v.risk_category || "unassessed";
      const color = risk === "minimal" || risk === "limited" ? GREEN : risk === "high" ? AMBER : risk === "unacceptable" ? RED : MUTED_COLOR;
      doc.setTextColor(...color);
      doc.text(risk, MARGIN + 80, y);
      doc.setTextColor(...TEXT_COLOR);
      y += 5;
    }
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED_COLOR);
    doc.text(`Generated by Verisum AI Governance  |  Page ${i} of ${pageCount}`, MARGIN, 287);
  }

  return new Uint8Array(doc.output("arraybuffer"));
}

export function generateGapAnalysisPdf(
  gapMd: string,
  orgName: string,
  version: number,
): Uint8Array {
  const doc = new jsPDF("p", "mm", "a4");
  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  let y = addHeader(doc, "Risk & Gap Summary", orgName, `v${version}.0`, date);
  y = renderMarkdownSimple(doc, gapMd, y);

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED_COLOR);
    doc.text(`Generated by Verisum AI Governance  |  Page ${i} of ${pageCount}`, MARGIN, 287);
  }

  return new Uint8Array(doc.output("arraybuffer"));
}
```

**Step 2: Create the pack list endpoint**

Create `src/app/api/governance-pack/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function GET() {
  try {
    const authClient = await createSupabaseServerClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const sb = supabaseServer();
    const { data: profile } = await sb
      .from("profiles")
      .select("organisation_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organisation_id) {
      return NextResponse.json({ error: "No organisation found" }, { status: 400 });
    }

    const { data: packs } = await sb
      .from("governance_packs")
      .select("id, version, status, generated_at, created_at")
      .eq("organisation_id", profile.organisation_id)
      .order("version", { ascending: false });

    return NextResponse.json({ packs: packs ?? [] });
  } catch (err: unknown) {
    console.error("[pack] list error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
```

**Step 3: Create the PDF download endpoint**

Create `src/app/api/governance-pack/[id]/pdf/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  generateGovernanceStatementPdf,
  generateUsageInventoryPdf,
  generateGapAnalysisPdf,
} from "@/lib/governancePdf";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const docType = searchParams.get("type") ?? "statement"; // statement | inventory | gap

    const authClient = await createSupabaseServerClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const sb = supabaseServer();
    const { data: profile } = await sb
      .from("profiles")
      .select("organisation_id, company_name")
      .eq("id", user.id)
      .single();

    if (!profile?.organisation_id) {
      return NextResponse.json({ error: "No organisation found" }, { status: 400 });
    }

    const { data: pack } = await sb
      .from("governance_packs")
      .select("*")
      .eq("id", id)
      .eq("organisation_id", profile.organisation_id)
      .single();

    if (!pack) {
      return NextResponse.json({ error: "Pack not found" }, { status: 404 });
    }

    if (pack.status !== "ready") {
      return NextResponse.json({ error: "Pack is not ready yet" }, { status: 400 });
    }

    const orgName = profile.company_name ?? "Organisation";
    let pdfBytes: Uint8Array;
    let filename: string;

    switch (docType) {
      case "inventory":
        pdfBytes = generateUsageInventoryPdf(
          pack.inventory_json,
          orgName,
          pack.version,
        );
        filename = `AI-Usage-Inventory-v${pack.version}.pdf`;
        break;
      case "gap":
        pdfBytes = generateGapAnalysisPdf(
          pack.gap_analysis_md,
          orgName,
          pack.version,
        );
        filename = `Risk-Gap-Summary-v${pack.version}.pdf`;
        break;
      default:
        pdfBytes = generateGovernanceStatementPdf(
          pack.statement_md,
          orgName,
          pack.version,
        );
        filename = `AI-Governance-Statement-v${pack.version}.pdf`;
    }

    return new NextResponse(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: unknown) {
    console.error("[pack] pdf error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
```

**Step 4: Verify build**

Run: `npm run build`

**Step 5: Commit**

```bash
git add src/lib/governancePdf.ts src/app/api/governance-pack/route.ts src/app/api/governance-pack/\[id\]/pdf/route.ts
git commit -m "feat: add governance pack PDF renderer + list/download API routes"
```

---

## Phase 5: Monthly Report

### Task 8: Monthly Compliance Report Generation

**Files:**
- Modify: `src/app/api/copilot/monthly-report/route.ts` (replace stub)

**Step 1: Implement the monthly report endpoint**

Replace the existing stub in `src/app/api/copilot/monthly-report/route.ts` with a full implementation. The route should:

1. Authenticate via `CRON_SECRET` Bearer token (pattern already exists in stub)
2. Fetch all orgs with active Starter+ plans
3. For each org, aggregate: vendor count + risk breakdown, incident count + severity, declaration count, latest governance pack status
4. Generate a basic PDF per org using jsPDF (reuse patterns from `governancePdf.ts`)
5. Store report data in `monthly_reports` table
6. Send via Resend using the `monthlyReportEmail` template

Key data aggregation queries:
```typescript
const [vendorRes, incidentRes, declarationRes, packRes] = await Promise.all([
  sb.from("ai_vendors").select("id, risk_category").eq("organisation_id", orgId),
  sb.from("incidents").select("id, impact_level, status")
    .eq("organisation_id", orgId)
    .gte("created_at", startOfMonth),
  sb.from("staff_declarations").select("id").eq("organisation_id", orgId),
  sb.from("governance_packs").select("id, version, status, generated_at")
    .eq("organisation_id", orgId)
    .eq("status", "ready")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle(),
]);
```

The report data should be stored as JSONB in `monthly_reports.report_data` for dashboard display, and the email should link to the dashboard Copilot tab.

**Step 2: Verify build**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/app/api/copilot/monthly-report/route.ts
git commit -m "feat: implement monthly compliance report generation + email delivery"
```

---

## Phase 6: Dashboard + Upgrade Page Updates

### Task 9: Update CopilotDashboard — Wizard CTA + Pack Status

**Files:**
- Modify: `src/components/copilot/CopilotDashboard.tsx`

**Step 1: Add wizard and pack sections**

Add to the top of the CopilotDashboard:

1. **Wizard CTA section** — if no completed wizard exists for the org, show a prominent "Set up your AI governance" card with a link to `/setup`. If a wizard is completed, show "Last completed: [date]" with a "Re-run wizard" link.

2. **Governance Pack section** — if packs exist, show the latest pack with download buttons for each of the 3 PDFs. If no pack exists, show "Complete the setup wizard to generate your governance pack."

3. **Monthly Report section** — show latest monthly report summary (from `monthly_reports` table). If no report exists, show "Your first monthly report will be generated on the 1st of next month."

Fetch from: `GET /api/wizard` (latest wizard), `GET /api/governance-pack` (packs list).

Pattern for download buttons:
```typescript
<a
  href={`/api/governance-pack/${pack.id}/pdf?type=statement`}
  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-border hover:bg-muted"
>
  📄 Governance Statement
</a>
```

**Step 2: Verify build**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/components/copilot/CopilotDashboard.tsx
git commit -m "feat: add wizard CTA, pack downloads, and monthly report to Copilot dashboard"
```

---

### Task 10: Update Upgrade Page — New Starter Value Prop

**Files:**
- Modify: `src/app/upgrade/page.tsx`

**Step 1: Rewrite Starter tier content**

Update the Starter tier definition in the `tiers` array:

```typescript
{
  name: "Starter",
  slug: "starter",
  price: "£79",
  period: "/month",
  description: "Get your AI governance sorted in 30 minutes. Guided setup, instant governance pack, ongoing compliance tools.",
  features: [
    "AI Governance Setup Wizard",
    "Governance Pack (3 PDF documents)",
    "Instant gap analysis & recommendations",
  ],
  copilotFeatures: [
    { label: "AI Policy Generator", available: true },
    { label: "Staff Declaration Portal (25 staff)", available: true },
    { label: "AI Vendor Register (10 vendors)", available: true },
    { label: "Monthly Compliance PDF", available: true },
    { label: "Incident Logging (5/month)", available: true },
    { label: "Regulatory Feed (UK/EU)", available: true },
  ],
  highlighted: true,
  cta: "Get started",
  ctaStyle: "primary",
}
```

Also update the feature matrix to remove TrustOrg survey count from Starter (change "3" to "—" or "0") and add "Governance Wizard" row.

**Step 2: Verify build**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/app/upgrade/page.tsx
git commit -m "feat: update upgrade page — new Starter value prop with wizard + governance pack"
```

---

### Task 11: Update Entitlements Enforcement in TrustOrg

**Files:**
- Modify: `src/app/trustorg/page.tsx` — update messaging for Starter users who now have 0 surveys

**Step 1: Update TrustOrg page**

Since Starter now has 0 surveys (`maxSurveys: 0`), the TrustOrg page needs to show an appropriate message for Starter users: "TrustOrg assessments are available on Pro and above. Use the AI Governance Setup Wizard for your governance assessment." with a link to `/setup`.

The existing `canCreateSurvey` check should handle this — Starter users will see surveys disabled. Just update the copy.

**Step 2: Verify build**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/app/trustorg/page.tsx
git commit -m "feat: update TrustOrg page — direct Starter users to wizard instead of surveys"
```

---

### Task 12: Final Build Verification + Cleanup

**Step 1: Full build**

Run: `npm run build`
Fix any TypeScript or build errors.

**Step 2: Lint**

Run: `npm run lint`
Fix any lint errors.

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "chore: fix build/lint issues from Starter redesign"
```

---

## Summary of Files

**New files (10):**
- `supabase/migrations/015_governance_wizard_schema.sql`
- `src/lib/governancePrompts.ts`
- `src/lib/governancePdf.ts`
- `src/app/setup/page.tsx`
- `src/app/api/wizard/route.ts`
- `src/app/api/wizard/complete/route.ts`
- `src/app/api/governance-pack/generate/route.ts`
- `src/app/api/governance-pack/route.ts`
- `src/app/api/governance-pack/[id]/pdf/route.ts`

**Modified files (5):**
- `src/lib/entitlements.ts`
- `src/app/api/copilot/monthly-report/route.ts`
- `src/components/copilot/CopilotDashboard.tsx`
- `src/app/upgrade/page.tsx`
- `src/app/trustorg/page.tsx`

**Commits: 12** (one per task, plus cleanup)
