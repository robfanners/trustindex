# AI Governance Copilot — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform TrustGraph into an SME-friendly AI Governance Copilot by adding a Starter tier, AI policy generation, staff declarations, vendor register, monthly compliance PDF, incident logging, and regulatory feed — then set up the business operating system (toolstack, automations, folder cleanup).

**Architecture:** Enhance the existing Next.js 16 + Supabase + Stripe codebase. New features are additive — new API routes, new Supabase tables, extended entitlements. LLM integration via Anthropic SDK with a provider-agnostic wrapper. No breaking changes to existing Explorer/Pro functionality.

**Tech Stack:** Next.js 16.1.6, React 19, Supabase (auth + DB + Edge Functions), Stripe 20.3.1, Anthropic SDK (new), Resend (new), jsPDF + html2canvas (existing), Tailwind CSS 4, TypeScript 5.

---

## Phase 1: Foundation (Starter Tier + Entitlements)

### Task 1: Add Starter Tier to Entitlements

**Files:**
- Modify: `src/lib/entitlements.ts`

**Step 1: Update PlanName type and LIMITS**

Add "starter" to the PlanName union and LIMITS record:

```typescript
export type PlanName = "explorer" | "starter" | "pro" | "enterprise";

const LIMITS: Record<PlanName, PlanLimits> = {
  explorer: { maxSurveys: 1, maxSystems: 0, canExport: false },
  starter:  { maxSurveys: 3, maxSystems: 0, canExport: false },
  pro:      { maxSurveys: 5, maxSystems: 2, canExport: true },
  enterprise: { maxSurveys: Infinity, maxSystems: Infinity, canExport: true },
};
```

**Step 2: Update hasBillingAccess to include starter**

```typescript
export function hasBillingAccess(plan: string | null | undefined): boolean {
  const p = plan ?? "explorer";
  return p === "starter" || p === "pro" || p === "enterprise";
}
```

**Step 3: Add new entitlement functions for Copilot features**

Add these below the existing functions (before the server-only section):

```typescript
/** Is this a paid plan? (Starter+) */
export function isPaidPlan(plan: string | null | undefined): boolean {
  const p = plan ?? "explorer";
  return p === "starter" || p === "pro" || p === "enterprise";
}

/** Max staff declarations allowed */
export function maxStaffDeclarations(plan: string | null | undefined): number {
  const p = plan ?? "explorer";
  if (p === "starter") return 25;
  if (p === "pro") return 100;
  if (p === "enterprise") return Infinity;
  return 0;
}

/** Max AI vendors allowed */
export function maxVendors(plan: string | null | undefined): number {
  const p = plan ?? "explorer";
  if (p === "starter") return 10;
  if (p === "pro") return Infinity;
  if (p === "enterprise") return Infinity;
  return 0;
}

/** Max incidents per month */
export function maxIncidentsPerMonth(plan: string | null | undefined): number {
  const p = plan ?? "explorer";
  if (p === "starter") return 5;
  if (p === "pro") return Infinity;
  if (p === "enterprise") return Infinity;
  return 0;
}

/** Can generate AI policies? */
export function canGeneratePolicy(plan: string | null | undefined): boolean {
  return isPaidPlan(plan);
}

/** Can edit generated AI policies? (Pro+) */
export function canEditPolicy(plan: string | null | undefined): boolean {
  const p = plan ?? "explorer";
  return p === "pro" || p === "enterprise";
}

/** Get compliance report level */
export function getReportLevel(plan: string | null | undefined): "none" | "basic" | "full" {
  const p = plan ?? "explorer";
  if (p === "starter") return "basic";
  if (p === "pro" || p === "enterprise") return "full";
  return "none";
}
```

**Step 4: Verify build**

Run: `cd ~/trustindex && npm run build`
Expected: Build succeeds with no type errors.

**Step 5: Commit**

```bash
cd ~/trustindex
git add src/lib/entitlements.ts
git commit -m "feat: add starter tier and copilot entitlement functions"
```

---

### Task 2: Add Stripe Starter Price + Update Checkout

**Files:**
- Modify: `.env.example`
- Modify: `src/app/api/stripe/checkout/route.ts`
- Modify: `src/app/api/stripe/webhook/route.ts`

**Step 1: Add Starter env vars to .env.example**

Add after the existing Stripe vars:

```
STRIPE_STARTER_MONTHLY_PRICE_ID=
STRIPE_STARTER_YEARLY_PRICE_ID=
```

**Step 2: Update checkout route to accept plan parameter**

Replace the checkout route to handle both starter and pro:

```typescript
import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { supabaseServer } from "@/lib/supabaseServer";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { getServerOrigin } from "@/lib/url";

export async function POST(req: Request) {
  try {
    const authClient = await createSupabaseServerClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const sb = supabaseServer();
    const { data: profile, error: profileErr } = await sb
      .from("profiles")
      .select("id, email, plan, stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json({ error: "Could not load profile" }, { status: 500 });
    }

    // Only explorer users can upgrade via checkout (existing paid users use portal)
    if (profile.plan !== "explorer") {
      return NextResponse.json({ error: "Already on a paid plan. Use billing portal to change." }, { status: 400 });
    }

    // Parse body for plan + interval
    let targetPlan: "starter" | "pro" = "pro";
    let interval: "monthly" | "yearly" = "monthly";
    try {
      const body = await req.json();
      if (body.plan === "starter") targetPlan = "starter";
      if (body.interval === "yearly") interval = "yearly";
    } catch {
      // defaults
    }

    // Resolve price ID
    let priceId: string | undefined;
    if (targetPlan === "starter") {
      priceId = interval === "yearly"
        ? process.env.STRIPE_STARTER_YEARLY_PRICE_ID
        : process.env.STRIPE_STARTER_MONTHLY_PRICE_ID;
    } else {
      priceId = interval === "yearly"
        ? process.env.STRIPE_PRO_YEARLY_PRICE_ID
        : process.env.STRIPE_PRO_MONTHLY_PRICE_ID;
    }

    if (!priceId) {
      return NextResponse.json({ error: "Stripe price not configured" }, { status: 500 });
    }

    // Get or create Stripe customer
    let customerId = profile.stripe_customer_id;
    if (!customerId) {
      const customer = await getStripe().customers.create({
        email: profile.email || user.email || undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await sb.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }

    // Create Checkout Session
    const origin = getServerOrigin(req);
    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/upgrade?success=true`,
      cancel_url: `${origin}/upgrade?cancelled=true`,
      metadata: { supabase_user_id: user.id, target_plan: targetPlan },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
```

**Step 3: Update webhook to resolve plan from price ID**

In the webhook's `checkout.session.completed` handler, replace the hardcoded `"pro"` with dynamic plan resolution:

```typescript
case "checkout.session.completed": {
  const session = event.data.object as Stripe.Checkout.Session;
  const userId = session.metadata?.supabase_user_id;
  const targetPlan = session.metadata?.target_plan ?? "pro";
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription as Stripe.Subscription | null)?.id ?? null;

  if (userId) {
    await sb
      .from("profiles")
      .update({
        plan: targetPlan,
        stripe_subscription_id: subscriptionId,
      })
      .eq("id", userId);

    console.log(`[stripe] User ${userId} upgraded to ${targetPlan} (sub: ${subscriptionId})`);
  }
  break;
}
```

**Step 4: Verify build**

Run: `cd ~/trustindex && npm run build`

**Step 5: Commit**

```bash
cd ~/trustindex
git add .env.example src/app/api/stripe/checkout/route.ts src/app/api/stripe/webhook/route.ts
git commit -m "feat: support starter tier in Stripe checkout and webhook"
```

---

### Task 3: Update Pricing Page with 4 Tiers + Greyed-Out Features

**Files:**
- Modify: `src/app/upgrade/page.tsx`

**Step 1: Rewrite the tiers array and feature matrix**

Replace the existing `tiers` and `featureMatrix` arrays with the new 4-tier data. Update `ctaFor()` to handle the starter tier. Add lock icons for greyed-out features visible to lower tiers.

The tiers array should now include:
- Explorer (Free) — unchanged features + greyed Copilot features visible
- Starter (£79/mo) — 3 surveys, AI policy (1), declarations (25 staff), vendor register (10), basic monthly PDF, 5 incidents/mo, UK/EU regulatory feed
- Pro (£199/mo) — 5 surveys, 2 systems, editable policies, 100 staff, unlimited vendors, full board report, unlimited incidents, sector-specific regulatory feed, CSV export
- Enterprise (Custom) — unlimited everything, SSO, custom branding, API access

The feature matrix should include all new Copilot features with lock/greyed styling for tiers where they're unavailable.

Add a `handleCheckout(plan)` function that passes the plan name to the checkout API.

**Step 2: Add greyed-out feature styling**

For Explorer tier, show Copilot features with a lock icon and "Upgrade" CTA instead of hiding them completely. This creates upgrade desire.

**Step 3: Verify locally**

Run: `cd ~/trustindex && npm run dev`
Check: Visit http://127.0.0.1:3000/upgrade — verify 4 tiers display correctly.

**Step 4: Commit**

```bash
cd ~/trustindex
git add src/app/upgrade/page.tsx
git commit -m "feat: 4-tier pricing page with greyed-out copilot features"
```

---

## Phase 2: Database Schema (Copilot Tables)

### Task 4: Create Migration 012 — Copilot Schema

**Files:**
- Create: `supabase/migrations/012_copilot_schema.sql`

**Step 1: Write the migration**

```sql
-- ==========================================================================
-- Migration 012: AI Governance Copilot Schema
-- ==========================================================================
-- New tables: ai_policies, staff_declarations, ai_vendors, incidents,
--             regulatory_updates, declaration_tokens
-- Supports: AI Policy Generator, Staff Declaration Portal, Vendor Register,
--           Incident Logging, Regulatory Feed

-- --------------------------------------------------------------------------
-- 1. ai_policies — LLM-generated governance documents
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_policies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  policy_type     text NOT NULL CHECK (policy_type IN ('acceptable_use', 'data_handling', 'staff_guidelines')),
  version         integer NOT NULL DEFAULT 1,
  content         text NOT NULL,
  questionnaire   jsonb,            -- the answers that generated this policy
  generated_by    text NOT NULL DEFAULT 'claude-sonnet',
  is_edited       boolean NOT NULL DEFAULT false,
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_policies_org ON ai_policies(organisation_id);
CREATE INDEX idx_ai_policies_type ON ai_policies(organisation_id, policy_type);

-- --------------------------------------------------------------------------
-- 2. declaration_tokens — shareable links for staff declarations
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS declaration_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  token           text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  label           text,              -- e.g. "Q1 2026 Declaration"
  expires_at      timestamptz,
  is_active       boolean NOT NULL DEFAULT true,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_declaration_tokens_token ON declaration_tokens(token);

-- --------------------------------------------------------------------------
-- 3. staff_declarations — individual staff AI usage declarations
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_declarations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  token_id        uuid NOT NULL REFERENCES declaration_tokens(id) ON DELETE CASCADE,
  staff_name      text NOT NULL,
  staff_email     text,
  department      text,
  tools_declared  jsonb NOT NULL DEFAULT '[]',  -- [{name, purpose, frequency, data_types}]
  additional_notes text,
  declared_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_staff_declarations_org ON staff_declarations(organisation_id);
CREATE INDEX idx_staff_declarations_token ON staff_declarations(token_id);

-- --------------------------------------------------------------------------
-- 4. ai_vendors — AI tool/vendor register
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_vendors (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  vendor_name     text NOT NULL,
  vendor_url      text,
  data_location   text,             -- e.g. "US", "EU", "Unknown"
  data_types      jsonb DEFAULT '[]',  -- ["personal", "financial", "health", etc.]
  risk_category   text CHECK (risk_category IN ('minimal', 'limited', 'high', 'unacceptable', 'unassessed')),
  auto_scored     boolean NOT NULL DEFAULT false,
  manual_override boolean NOT NULL DEFAULT false,
  source          text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'declaration', 'integration')),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_vendors_org ON ai_vendors(organisation_id);

-- --------------------------------------------------------------------------
-- 5. incidents — AI-related incident logging
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS incidents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text,
  ai_vendor_id    uuid REFERENCES ai_vendors(id) ON DELETE SET NULL,
  impact_level    text NOT NULL DEFAULT 'low' CHECK (impact_level IN ('low', 'medium', 'high', 'critical')),
  resolution      text,
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
  reported_by     uuid REFERENCES auth.users(id),
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_incidents_org ON incidents(organisation_id);

-- --------------------------------------------------------------------------
-- 6. regulatory_updates — curated regulatory feed
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS regulatory_updates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  summary         text NOT NULL,
  source_url      text,
  jurisdiction    text NOT NULL DEFAULT 'uk' CHECK (jurisdiction IN ('uk', 'eu', 'us', 'global')),
  relevance_tags  jsonb DEFAULT '[]',  -- ["ai_act", "ico", "data_protection"]
  sector_tags     jsonb DEFAULT '[]',  -- ["financial", "healthcare", "general"]
  published_at    timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_regulatory_updates_jurisdiction ON regulatory_updates(jurisdiction);

-- --------------------------------------------------------------------------
-- 7. RLS policies
-- --------------------------------------------------------------------------
ALTER TABLE ai_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE declaration_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_declarations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulatory_updates ENABLE ROW LEVEL SECURITY;

-- Org-scoped access for authenticated users
CREATE POLICY "Users can view own org ai_policies"
  ON ai_policies FOR SELECT TO authenticated
  USING (organisation_id = (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own org ai_policies"
  ON ai_policies FOR INSERT TO authenticated
  WITH CHECK (organisation_id = (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own org ai_policies"
  ON ai_policies FOR UPDATE TO authenticated
  USING (organisation_id = (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can view own org declaration_tokens"
  ON declaration_tokens FOR SELECT TO authenticated
  USING (organisation_id = (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage own org declaration_tokens"
  ON declaration_tokens FOR ALL TO authenticated
  USING (organisation_id = (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

-- Staff declarations: org users can read, anonymous can insert via token
CREATE POLICY "Users can view own org staff_declarations"
  ON staff_declarations FOR SELECT TO authenticated
  USING (organisation_id = (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

-- Anonymous insert handled via API route with service role (token validation server-side)

CREATE POLICY "Users can view own org ai_vendors"
  ON ai_vendors FOR SELECT TO authenticated
  USING (organisation_id = (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage own org ai_vendors"
  ON ai_vendors FOR ALL TO authenticated
  USING (organisation_id = (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can view own org incidents"
  ON incidents FOR SELECT TO authenticated
  USING (organisation_id = (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage own org incidents"
  ON incidents FOR ALL TO authenticated
  USING (organisation_id = (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

-- Regulatory updates: readable by all authenticated users (global content)
CREATE POLICY "All authenticated users can read regulatory_updates"
  ON regulatory_updates FOR SELECT TO authenticated
  USING (true);
```

**Step 2: Apply migration to Supabase**

Run: Apply via Supabase dashboard SQL editor or `supabase db push` if using CLI.

**Step 3: Commit**

```bash
cd ~/trustindex
git add supabase/migrations/012_copilot_schema.sql
git commit -m "feat: add copilot schema — policies, declarations, vendors, incidents, regulatory"
```

---

## Phase 3: LLM Integration

### Task 5: Install Anthropic SDK + Create LLM Wrapper

**Files:**
- Create: `src/lib/llm.ts`

**Step 1: Install dependency**

Run: `cd ~/trustindex && npm install @anthropic-ai/sdk`

**Step 2: Add env var**

Add to `.env.example`:
```
# --- Anthropic (AI Policy Generation) ---
ANTHROPIC_API_KEY=
```

**Step 3: Create provider-agnostic LLM wrapper**

```typescript
// src/lib/llm.ts
// Provider-agnostic LLM wrapper. Currently uses Anthropic Claude.
// Switch provider by changing the implementation — callers stay the same.

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export type LLMMessage = { role: "user" | "assistant"; content: string };

export async function generateText(
  systemPrompt: string,
  messages: LLMMessage[],
  options?: { maxTokens?: number; temperature?: number }
): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: options?.maxTokens ?? 4096,
    temperature: options?.temperature ?? 0.3,
    system: systemPrompt,
    messages,
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock?.text ?? "";
}
```

**Step 4: Verify build**

Run: `cd ~/trustindex && npm run build`

**Step 5: Commit**

```bash
cd ~/trustindex
git add src/lib/llm.ts package.json package-lock.json .env.example
git commit -m "feat: add Anthropic SDK with provider-agnostic LLM wrapper"
```

---

### Task 6: AI Policy Generator — API Route + Prompts

**Files:**
- Create: `src/lib/policyPrompts.ts`
- Create: `src/app/api/copilot/generate-policy/route.ts`

**Step 1: Create policy prompt templates**

```typescript
// src/lib/policyPrompts.ts
// Structured prompts for AI governance policy generation.

export type PolicyType = "acceptable_use" | "data_handling" | "staff_guidelines";

export type PolicyQuestionnaire = {
  companyName: string;
  industry: string;
  companySize: string;      // "1-10" | "11-50" | "51-200" | "201-500" | "500+"
  aiToolsUsed: string[];    // ["ChatGPT", "Claude", "Copilot", ...]
  dataSensitivity: string;  // "low" | "medium" | "high"
  jurisdiction: string;     // "uk" | "eu" | "us" | "global"
  additionalContext?: string;
};

const SYSTEM_PROMPT = `You are an AI governance policy specialist working for Verisum, a trust and governance technology company. You generate clear, professional, legally-informed governance policies for small and medium-sized businesses.

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

export { SYSTEM_PROMPT };
```

**Step 2: Create the API route**

```typescript
// src/app/api/copilot/generate-policy/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getUserPlan } from "@/lib/entitlements";
import { canGeneratePolicy } from "@/lib/entitlements";
import { generateText } from "@/lib/llm";
import { SYSTEM_PROMPT, buildPolicyPrompt } from "@/lib/policyPrompts";
import type { PolicyType, PolicyQuestionnaire } from "@/lib/policyPrompts";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    // Auth
    const authClient = await createSupabaseServerClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Plan check
    const plan = await getUserPlan(user.id);
    if (!canGeneratePolicy(plan)) {
      return NextResponse.json({ error: "Upgrade to generate AI policies" }, { status: 403 });
    }

    // Parse request
    const body = await req.json();
    const policyType = body.policyType as PolicyType;
    const questionnaire = body.questionnaire as PolicyQuestionnaire;

    if (!policyType || !questionnaire?.companyName) {
      return NextResponse.json({ error: "Missing policyType or questionnaire" }, { status: 400 });
    }

    // Get org
    const sb = supabaseServer();
    const { data: profile } = await sb
      .from("profiles")
      .select("organisation_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organisation_id) {
      return NextResponse.json({ error: "No organisation found" }, { status: 400 });
    }

    // Generate policy via LLM
    const prompt = buildPolicyPrompt(policyType, questionnaire);
    const content = await generateText(SYSTEM_PROMPT, [{ role: "user", content: prompt }]);

    // Get current version number
    const { count } = await sb
      .from("ai_policies")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", profile.organisation_id)
      .eq("policy_type", policyType);

    const version = (count ?? 0) + 1;

    // Save to DB
    const { data: policy, error } = await sb
      .from("ai_policies")
      .insert({
        organisation_id: profile.organisation_id,
        policy_type: policyType,
        version,
        content,
        questionnaire,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("[copilot] Error saving policy:", error);
      return NextResponse.json({ error: "Failed to save policy" }, { status: 500 });
    }

    return NextResponse.json({ policy });
  } catch (err: any) {
    console.error("[copilot] generate-policy error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
```

**Step 3: Verify build**

Run: `cd ~/trustindex && npm run build`

**Step 4: Commit**

```bash
cd ~/trustindex
git add src/lib/policyPrompts.ts src/app/api/copilot/generate-policy/route.ts
git commit -m "feat: AI policy generator — prompts and API route"
```

---

## Phase 4: Staff Declaration Portal

### Task 7: Declaration Token + Public Submission API

**Files:**
- Create: `src/app/api/declarations/create-token/route.ts`
- Create: `src/app/api/declarations/[token]/route.ts`

**Step 1: Create token generation endpoint (authenticated)**

The create-token route should:
- Authenticate the user
- Check they have a paid plan (Starter+)
- Look up their organisation_id
- Insert a new row into declaration_tokens
- Return the token and a shareable URL

**Step 2: Create public declaration submission endpoint**

The `[token]` route should handle:
- `GET` — validate token, return org name + token status (for the public form)
- `POST` — accept staff declaration (name, email, department, tools_declared), validate token is active and not expired, check declaration count against plan limits, insert into staff_declarations, auto-populate ai_vendors from tools_declared

This route uses the service role client (no auth required for staff submitting).

**Step 3: Commit**

```bash
cd ~/trustindex
git add src/app/api/declarations/
git commit -m "feat: declaration token creation and public submission API"
```

---

### Task 8: Staff Declaration Public Form Page

**Files:**
- Create: `src/app/declare/[token]/page.tsx`

**Step 1: Build the public declaration form**

A simple, clean, public-facing form (no login required). Should:
- Fetch token validity via GET `/api/declarations/[token]`
- Show org name and a friendly explanation
- Collect: staff name, email (optional), department (optional), AI tools used (multi-add), data types for each tool, frequency
- Submit via POST `/api/declarations/[token]`
- Show success confirmation with "You can close this page" message
- Handle expired/invalid tokens gracefully

**Step 2: Test locally**

Verify the form renders at `http://127.0.0.1:3000/declare/[token]`.

**Step 3: Commit**

```bash
cd ~/trustindex
git add src/app/declare/
git commit -m "feat: public staff AI usage declaration form"
```

---

## Phase 5: AI Vendor Register + Incident Logging

### Task 9: Vendor Register API + Dashboard Component

**Files:**
- Create: `src/app/api/vendors/route.ts` (CRUD)
- Create: `src/components/copilot/VendorRegister.tsx`

**Step 1: Vendor CRUD API**

- `GET` — list vendors for org (with count against plan limit)
- `POST` — add vendor (manual or from declaration)
- `PATCH` — update vendor (risk override, notes)
- `DELETE` — remove vendor

**Step 2: Dashboard component**

Table view showing: vendor name, data location, data types, risk category (colour-coded), source (manual/declaration), edit/delete actions.

"Add vendor" button respects plan limits. Risk categories map to EU AI Act levels with colour coding: minimal (green), limited (amber), high (red), unacceptable (dark red).

**Step 3: Commit**

```bash
cd ~/trustindex
git add src/app/api/vendors/ src/components/copilot/VendorRegister.tsx
git commit -m "feat: AI vendor register — API and dashboard component"
```

---

### Task 10: Incident Logging API + Dashboard Component

**Files:**
- Create: `src/app/api/incidents/route.ts` (CRUD)
- Create: `src/components/copilot/IncidentLog.tsx`

**Step 1: Incident CRUD API**

- `GET` — list incidents for org (filterable by status, with monthly count for limit check)
- `POST` — create incident (respects monthly limit for Starter)
- `PATCH` — update incident (status, resolution)

**Step 2: Dashboard component**

List/card view showing: title, AI tool involved, impact level (colour-coded severity), status, date. "Log incident" button respects monthly plan limits. Filter by status (open/investigating/resolved/closed).

**Step 3: Commit**

```bash
cd ~/trustindex
git add src/app/api/incidents/ src/components/copilot/IncidentLog.tsx
git commit -m "feat: incident logging — API and dashboard component"
```

---

## Phase 6: Copilot Dashboard Integration

### Task 11: Add Copilot Tab to Dashboard

**Files:**
- Modify: `src/app/dashboard/page.tsx` (add Copilot tab)
- Create: `src/components/copilot/CopilotDashboard.tsx`

**Step 1: Create the Copilot dashboard layout**

A new tab alongside the existing Overview / TrustOrg / TrustSys tabs. Contains:
- **AI Policy section** — status of generated policies, generate/regenerate button, view/edit
- **Declaration Portal section** — active tokens, declaration compliance rate (% staff declared), create new token link
- **Vendor Register section** — embedded VendorRegister component
- **Incident Log section** — embedded IncidentLog component
- **Regulatory Feed section** — latest updates timeline

For Explorer users: show the full layout but with lock overlays and "Upgrade to Starter" CTAs on each section.

**Step 2: Wire into dashboard tabs**

Add the Copilot tab to the dashboard's tab navigation.

**Step 3: Verify locally**

Run dev server, log in as Explorer → see greyed/locked features. Log in as paid user → see full access.

**Step 4: Commit**

```bash
cd ~/trustindex
git add src/app/dashboard/page.tsx src/components/copilot/
git commit -m "feat: copilot dashboard tab with policy, declarations, vendors, incidents, regulatory"
```

---

## Phase 7: Monthly Compliance Report

### Task 12: Report Generation API + Cron

**Files:**
- Create: `src/app/api/copilot/monthly-report/route.ts`
- Modify: `vercel.json` (add cron)

**Step 1: Create monthly report endpoint**

The endpoint should:
- Query all Starter/Pro orgs
- For each org: pull health score (from trustgraph_health_mv), actions status, declaration count + compliance %, vendor count + risk summary, incident count + severity breakdown
- Generate a PDF using the existing jsPDF pipeline
- Store the PDF (either as base64 in Supabase storage or as a downloadable link)
- Basic report (Starter) = 1-page summary; Full report (Pro) = multi-page board-ready document

**Step 2: Add Vercel cron**

Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/copilot/monthly-report",
      "schedule": "0 6 1 * *"
    }
  ]
}
```

This runs at 6am UTC on the 1st of each month.

**Step 3: Commit**

```bash
cd ~/trustindex
git add src/app/api/copilot/monthly-report/ vercel.json
git commit -m "feat: monthly compliance report generation with Vercel cron"
```

---

## Phase 8: Regulatory Feed

### Task 13: Regulatory Feed — Seed Data + Display Component

**Files:**
- Create: `src/components/copilot/RegulatoryFeed.tsx`
- Create: `src/app/api/regulatory/route.ts`

**Step 1: Create feed API**

- `GET` — list regulatory updates, filterable by jurisdiction and sector tags
- `POST` — admin-only: add new update (protected by admin code)

**Step 2: Create feed component**

Timeline/card view showing: title, summary, jurisdiction badge, date, source link. Filterable by UK/EU. Sector-specific items shown only to Pro+ users.

**Step 3: Seed initial content**

Create 5-10 initial regulatory updates covering:
- EU AI Act key dates and requirements
- UK ICO AI governance guidance
- Key compliance deadlines for 2026

**Step 4: Commit**

```bash
cd ~/trustindex
git add src/components/copilot/RegulatoryFeed.tsx src/app/api/regulatory/
git commit -m "feat: regulatory feed component and API with seed data"
```

---

## Phase 9: Email Integration (Resend)

### Task 14: Install Resend + Transactional Emails

**Files:**
- Create: `src/lib/email.ts`
- Create: `src/lib/emailTemplates.ts`

**Step 1: Install Resend**

Run: `cd ~/trustindex && npm install resend`

Add to `.env.example`:
```
# --- Resend (Transactional Email) ---
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@verisum.org
```

**Step 2: Create email utility**

```typescript
// src/lib/email.ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail(to: string, subject: string, html: string) {
  return resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || "noreply@verisum.org",
    to,
    subject,
    html,
  });
}
```

**Step 3: Create email templates**

Templates for: welcome email, monthly report delivery, declaration reminder (day 3), policy ready notification (day 7).

**Step 4: Commit**

```bash
cd ~/trustindex
git add src/lib/email.ts src/lib/emailTemplates.ts package.json package-lock.json .env.example
git commit -m "feat: Resend email integration with transactional templates"
```

---

## Phase 10: Business Operating System Setup

### Task 15: Create CLAUDE.md for TrustIndex Repo

**Files:**
- Create: `~/trustindex/CLAUDE.md`

**Step 1: Write CLAUDE.md**

Document the project structure, conventions, key file locations, tech stack, common commands, and development guidelines. This becomes the AI co-founder's project memory.

**Step 2: Commit**

```bash
cd ~/trustindex
git add CLAUDE.md
git commit -m "docs: add CLAUDE.md for AI-assisted development"
```

---

### Task 16: Archive OneDrive Verisum Folder

**Files:**
- Archive: `OneDrive/Work/Verisum/` → `Verisum_Archive_2026-02-27.zip`

**Step 1: Create archive**

```bash
cd "/Users/robfanshawe/Library/CloudStorage/OneDrive-Personal/Work"
zip -r "Verisum_Archive_2026-02-27.zip" Verisum/ -x "*/node_modules/*" "*/.git/*"
```

**Step 2: Verify archive**

```bash
unzip -l "Verisum_Archive_2026-02-27.zip" | tail -1
```

Confirm file count and size are reasonable.

**Step 3: Do NOT delete originals yet**

Keep originals until Notion migration is complete. The archive is the safety net.

---

### Task 17: Set Up Notion Workspace Structure

**Manual task — Rob does this with guidance.**

Create Notion workspace "Verisum" with these top-level pages/databases:

1. **Strategy** — Business plan, investor materials, board docs
2. **Product** — PRDs, roadmaps, backlogs (link to Linear for execution)
3. **Technology** — Architecture docs, dev guidelines (link to GitHub)
4. **Operations** — Playbooks, SOPs, onboarding guides
5. **Finance** — Models, projections, pricing
6. **Partnerships** — GTM strategy, partner profiles
7. **Legal** — IP, trademarks, compliance
8. **Human-HarmonAI** — Framework, white papers, implementation
9. **Marketing** — Brand, content calendar, campaigns
10. **CRM** — Database: Name, Company, Source, Status, Notes, Last Contact

Migrate the most critical current documents first:
- HAPP/Strategy: latest white paper, board summary, operating plan
- Operations: COO playbook, sprint playbook, day zero runbook
- Product: PRDs, roadmap, backlog
- Human-HarmonAI: final white paper, implementation playbook

---

### Task 18: Set Up Linear Project

**Manual task — Rob does this with guidance.**

1. Create Linear workspace "Verisum"
2. Create project: "AI Governance Copilot"
3. Create labels: `product`, `engineering`, `ops`, `marketing`, `consulting`
4. Import this implementation plan as issues (one per Task)
5. Set up cycle (2-week sprints)

---

### Task 19: Set Up Make.com Automation Skeleton

**Manual task — Rob does this with guidance.**

Create Make.com account and set up these scenarios (initially inactive, activate as integrations come online):

1. **New Stripe Payment → Slack** — Webhook on Stripe payment_intent.succeeded → post to Slack #revenue channel
2. **Weekly Digest** — Scheduled (Monday 8am) → Stripe API (MRR) + Supabase API (user count) → Slack #business
3. **New Explorer Signup → Notion CRM** — Supabase webhook on profiles insert → add row to Notion CRM database

---

## Phase 11: Future Roadmap Items (Not in This Plan)

These are tracked in the design doc and should be added to Linear as future backlog items:

- [ ] HAPP + TrustGraph merge strategy (Rob has approach — to be designed separately)
- [ ] Enterprise tier: SSO, white-label, API access
- [ ] Copilot v2: chat interface, inline suggestions, agentic workflows
- [ ] PostHog analytics integration
- [ ] Advanced onboarding email sequences (day 3, 7, 14, 30)
- [ ] Regulatory feed LLM auto-summarisation
- [ ] Human-HarmonAI licensing package

---

## Execution Order Summary

| Phase | Tasks | Focus | Est. Effort |
|-------|-------|-------|-------------|
| 1 | 1-3 | Starter tier + pricing | 1-2 days |
| 2 | 4 | Database schema | 0.5 day |
| 3 | 5-6 | LLM + policy generator | 1-2 days |
| 4 | 7-8 | Staff declarations | 1-2 days |
| 5 | 9-10 | Vendor register + incidents | 1-2 days |
| 6 | 11 | Dashboard integration | 1 day |
| 7 | 12 | Monthly compliance report | 1 day |
| 8 | 13 | Regulatory feed | 0.5 day |
| 9 | 14 | Email (Resend) | 0.5 day |
| 10 | 15-19 | Business ops setup | 2-3 days |

**Total estimated: ~3-4 weeks** (solo founder, with Claude Code assistance)
