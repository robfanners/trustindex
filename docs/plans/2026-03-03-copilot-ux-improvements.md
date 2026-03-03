# Copilot UX Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 5 Copilot UX issues: policy generation error handling + rate limits, staff declaration email sharing + tracking, incident log editability with audit trail, vendor-incident dropdown sync, and helper tooltips across all sections.

**Architecture:** All changes are within the existing Copilot module. One new migration adds `declaration_invites` table and `edited_at`/`edited_by` columns to `incidents`. New `maxPolicyGenerations()` entitlement function. New `/api/declarations/invite` API route for email sharing. Existing `<Tooltip>` component reused for all help icons.

**Tech Stack:** Next.js App Router, Supabase Postgres, Resend email, TypeScript, Tailwind CSS

---

### Task 1: Database Migration — declaration_invites + incident audit columns

**Files:**
- Create: `supabase/migrations/016_copilot_ux_improvements.sql`

**Step 1: Write the migration**

```sql
-- ==========================================================================
-- Migration 016: Copilot UX Improvements
-- ==========================================================================
-- 1. declaration_invites — track email invitations for declaration campaigns
-- 2. incidents — add edited_at/edited_by for audit trail

-- --------------------------------------------------------------------------
-- 1. declaration_invites
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS declaration_invites (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id        uuid NOT NULL REFERENCES declaration_tokens(id) ON DELETE CASCADE,
  email           text NOT NULL,
  sent_at         timestamptz NOT NULL DEFAULT now(),
  submitted_at    timestamptz
);

CREATE INDEX idx_declaration_invites_token ON declaration_invites(token_id);
CREATE INDEX idx_declaration_invites_email ON declaration_invites(email);

ALTER TABLE declaration_invites ENABLE ROW LEVEL SECURITY;

-- Invites are org-scoped through token ownership — use service role for writes
CREATE POLICY "Users can view invites for own org tokens"
  ON declaration_invites FOR SELECT TO authenticated
  USING (token_id IN (
    SELECT id FROM declaration_tokens
    WHERE organisation_id = (SELECT organisation_id FROM profiles WHERE id = auth.uid())
  ));

-- --------------------------------------------------------------------------
-- 2. Incident audit columns
-- --------------------------------------------------------------------------
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS edited_by uuid REFERENCES auth.users(id);
```

**Step 2: Apply migration via Supabase MCP**

Run: `apply_migration` with project_id `ktwrztposaiyllhadqys`, name `copilot_ux_improvements`, and the SQL above.

**Step 3: Commit**

```bash
git add supabase/migrations/016_copilot_ux_improvements.sql
git commit -m "feat: add declaration_invites table and incident audit columns"
```

---

### Task 2: Entitlements — maxPolicyGenerations

**Files:**
- Modify: `src/lib/entitlements.ts` (add after `maxIncidentsPerMonth` at ~line 111)

**Step 1: Add the function**

Add after `maxIncidentsPerMonth`:

```typescript
/** Max AI policy generations per month */
export function maxPolicyGenerations(plan: string | null | undefined): number {
  const p = plan ?? "explorer";
  if (p === "starter") return 3;
  if (p === "pro") return 10;
  if (p === "enterprise") return 50;
  return 0;
}
```

**Step 2: Build to verify**

Run: `npm run build`
Expected: Clean build, no errors.

**Step 3: Commit**

```bash
git add src/lib/entitlements.ts
git commit -m "feat: add maxPolicyGenerations entitlement (3/10/50 by tier)"
```

---

### Task 3: Generate Policy API — Rate Limiting + Error Handling

**Files:**
- Modify: `src/app/api/copilot/generate-policy/route.ts`

**Step 1: Update the POST handler**

Replace the entire route file. Key changes:
- Import `maxPolicyGenerations` from entitlements
- After plan check, count `ai_policies` for the org this month
- If at limit, return 403 with friendly message and `{ remaining: 0 }`
- Wrap `generateText()` in try/catch — if Anthropic API error, log server-side, return 503 with generic message
- On success, return `{ policy, remaining }` where remaining = limit - (count + 1)

```typescript
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getUserPlan, canGeneratePolicy, maxPolicyGenerations } from "@/lib/entitlements";
import { generateText } from "@/lib/llm";
import { SYSTEM_PROMPT, buildPolicyPrompt } from "@/lib/policyPrompts";
import type { PolicyType, PolicyQuestionnaire } from "@/lib/policyPrompts";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    // Auth
    const authClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Plan check
    const plan = await getUserPlan(user.id);
    if (!canGeneratePolicy(plan)) {
      return NextResponse.json(
        { error: "Upgrade to generate AI policies" },
        { status: 403 }
      );
    }

    // Get org
    const sb = supabaseServer();
    const { data: profile } = await sb
      .from("profiles")
      .select("organisation_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organisation_id) {
      return NextResponse.json(
        { error: "No organisation found" },
        { status: 400 }
      );
    }

    // Rate limit check
    const limit = maxPolicyGenerations(plan);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count: monthlyCount } = await sb
      .from("ai_policies")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", profile.organisation_id)
      .gte("created_at", startOfMonth.toISOString());

    const used = monthlyCount ?? 0;
    if (used >= limit) {
      return NextResponse.json(
        {
          error: `You've used all ${limit} policy generation${limit !== 1 ? "s" : ""} this month. Upgrade for more.`,
          remaining: 0,
          limit,
        },
        { status: 403 }
      );
    }

    // Parse request
    const body = await req.json();
    const policyType = body.policyType as PolicyType;
    const questionnaire = body.questionnaire as PolicyQuestionnaire;

    if (!policyType || !questionnaire?.companyName) {
      return NextResponse.json(
        { error: "Missing policyType or questionnaire" },
        { status: 400 }
      );
    }

    // Generate policy via LLM
    let content: string;
    try {
      const prompt = buildPolicyPrompt(policyType, questionnaire);
      content = await generateText(SYSTEM_PROMPT, [
        { role: "user", content: prompt },
      ]);
    } catch (llmErr: unknown) {
      console.error("[copilot] LLM generation failed:", llmErr);
      return NextResponse.json(
        { error: "Policy generation is temporarily unavailable. Please try again in a few minutes." },
        { status: 503 }
      );
    }

    // Get current version number
    const { count: versionCount } = await sb
      .from("ai_policies")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", profile.organisation_id)
      .eq("policy_type", policyType);

    const version = (versionCount ?? 0) + 1;

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
      return NextResponse.json(
        { error: "Failed to save policy" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      policy,
      remaining: limit - (used + 1),
      limit,
    });
  } catch (err: unknown) {
    console.error("[copilot] generate-policy error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
```

**Step 2: Build to verify**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/app/api/copilot/generate-policy/route.ts
git commit -m "feat: add rate limiting and error handling to policy generation API"
```

---

### Task 4: Generate Policy Page — AI Disclosure + Friendly Errors

**Files:**
- Modify: `src/app/copilot/generate-policy/page.tsx`

**Step 1: Add AI disclosure banner and remaining count display**

At the top of the form (after the heading), add:

```tsx
<div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
  <span className="shrink-0 mt-0.5">&#9432;</span>
  <p>
    Policies are generated using AI and tailored to your organisation&apos;s context.
    Always review generated content before adopting.
  </p>
</div>
```

Add state for remaining count — pass it through from the API response. Show "X of Y generations remaining this month" below the Generate button.

If the API returns 403 (rate limit), show a styled upgrade prompt instead of a raw error. If the API returns 503 (LLM unavailable), show a friendly retry message. Never show raw JSON.

**Step 2: Build to verify**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/app/copilot/generate-policy/page.tsx
git commit -m "feat: add AI disclosure banner and friendly error messages to policy generator"
```

---

### Task 5: Helper Tooltips on CopilotDashboard

**Files:**
- Modify: `src/components/copilot/CopilotDashboard.tsx`

**Step 1: Import Tooltip and add to Section component**

Import `Tooltip` from `@/components/Tooltip`. Modify the `Section` component to accept an optional `tooltip` prop. When provided, render a (?) icon with Tooltip next to the title.

```tsx
import Tooltip from "@/components/Tooltip";

function Section({
  title,
  description,
  tooltip,
  locked,
  lockLabel,
  children,
}: {
  title: string;
  description?: string;
  tooltip?: string;
  locked?: boolean;
  lockLabel?: string;
  children: React.ReactNode;
}) {
  const content = (
    <div className="border border-border rounded-xl p-6 space-y-4">
      <div>
        <div className="flex items-center gap-1.5">
          <h3 className="font-semibold text-foreground">{title}</h3>
          {tooltip && (
            <Tooltip content={tooltip}>
              <span className="text-muted-foreground hover:text-foreground cursor-help text-sm">&#9432;</span>
            </Tooltip>
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
  // ... rest unchanged
```

**Step 2: Add tooltip props to all Section usages**

Add `tooltip="..."` to each Section in the dashboard JSX:

| Section | tooltip |
|---------|---------|
| Governance Setup | "Complete the setup wizard to generate your AI governance framework — policies, inventory, and gap analysis." |
| Governance Pack | "Download your generated governance documents. Re-run the wizard to generate updated versions." |
| Monthly Compliance Report | "Automated monthly summary of your AI governance posture, emailed on the 1st of each month." |
| AI Policies | "Generate tailored AI governance policies using AI. Policies are customised to your organisation's context." |
| Staff Declarations | "Collect AI usage declarations from staff. Create a campaign link, invite your team, and track responses." |
| AI Vendor Register | "Track and assess all AI tools used across your organisation. Vendors are auto-added from staff declarations." |
| Incident Log | "Record AI-related incidents and near-misses. Maintain an audit trail for governance compliance." |
| Regulatory Updates | "Stay current with AI governance regulations and guidance relevant to your jurisdiction." |

**Step 3: Build to verify**

Run: `npm run build`

**Step 4: Commit**

```bash
git add src/components/copilot/CopilotDashboard.tsx
git commit -m "feat: add helper tooltips to all Copilot dashboard sections"
```

---

### Task 6: Staff Declarations — Better Labels + Date Stamps

**Files:**
- Modify: `src/components/copilot/CopilotDashboard.tsx` (DeclarationSection)

**Step 1: Update the DeclarationSection**

Changes to make in the DeclarationSection function:

1. Change the label input placeholder from `"Label (optional)"` to `"e.g. Q1 2026 AI Usage Declaration"`
2. Add helper text below the input: `"Give this campaign a clear name so you can identify it later"`
3. In the token list, show `created_at` as a readable date next to each token label, right-aligned
4. Format: `"Created 3 Mar 2026"` using `toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })`

**Step 2: Build to verify**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/components/copilot/CopilotDashboard.tsx
git commit -m "feat: improve staff declaration labels, placeholders, and date stamps"
```

---

### Task 7: Staff Declarations — Email Invite API

**Files:**
- Create: `src/app/api/declarations/invite/route.ts`
- Modify: `src/lib/emailTemplates.ts` (add `declarationInviteEmail` template)

**Step 1: Add the email template**

Add to `src/lib/emailTemplates.ts`:

```typescript
/**
 * Declaration invite — sent to staff asking them to complete AI usage declaration.
 */
export function declarationInviteEmail(params: {
  orgName: string;
  campaignLabel: string;
  declarationUrl: string;
  senderName?: string;
}): { subject: string; html: string } {
  const { orgName, campaignLabel, declarationUrl, senderName } = params;

  return {
    subject: `AI Usage Declaration — ${orgName}`,
    html: layout(
      `AI Usage Declaration`,
      `
      <p style="font-size:14px;color:#374151;line-height:1.6;">
        ${senderName ? `${senderName} from ` : ""}${orgName} is asking you to complete a brief AI usage declaration
        ${campaignLabel ? ` as part of <strong>${campaignLabel}</strong>` : ""}.
      </p>
      <p style="font-size:14px;color:#374151;line-height:1.6;">
        This helps your organisation understand how AI tools are being used and ensure responsible AI governance.
        It takes about <strong>2–3 minutes</strong> to complete.
      </p>
      ${button("Complete Declaration", declarationUrl)}
      <p style="font-size:14px;color:#374151;line-height:1.6;margin-top:16px;">
        <strong>What you'll be asked:</strong>
      </p>
      <ul style="font-size:14px;color:#374151;line-height:1.8;padding-left:20px;">
        <li>Which AI tools you use (e.g. ChatGPT, Copilot, Claude)</li>
        <li>What you use them for</li>
        <li>What types of data you input</li>
      </ul>
      <p style="font-size:13px;color:${MUTED_COLOR};margin-top:16px;">
        Your responses help build a clear picture of AI usage across ${orgName}. If you have questions, contact your line manager or IT team.
      </p>
      `
    ),
  };
}
```

**Step 2: Create the invite API route**

Create `src/app/api/declarations/invite/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import { isPaidPlan } from "@/lib/entitlements";
import { sendEmail } from "@/lib/email";
import { declarationInviteEmail } from "@/lib/emailTemplates";
import { getServerOrigin } from "@/lib/url";

export async function POST(req: Request) {
  try {
    const authClient = await createSupabaseServerClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const sb = supabaseServer();
    const { data: profile } = await sb
      .from("profiles")
      .select("organisation_id, plan, full_name")
      .eq("id", user.id)
      .single();

    if (!profile?.organisation_id || !isPaidPlan(profile.plan)) {
      return NextResponse.json({ error: "Not available" }, { status: 403 });
    }

    const body = await req.json();
    const { tokenId, emails } = body as { tokenId: string; emails: string[] };

    if (!tokenId || !emails?.length) {
      return NextResponse.json({ error: "tokenId and emails required" }, { status: 400 });
    }

    // Validate token belongs to org
    const { data: token } = await sb
      .from("declaration_tokens")
      .select("id, token, label, organisation_id")
      .eq("id", tokenId)
      .eq("organisation_id", profile.organisation_id)
      .single();

    if (!token) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }

    // Get org name
    const { data: org } = await sb
      .from("organisations")
      .select("name")
      .eq("id", profile.organisation_id)
      .single();

    const origin = getServerOrigin(req);
    const declarationUrl = `${origin}/declare/${token.token}`;
    const orgName = org?.name ?? "Your organisation";

    // Build email
    const { subject, html } = declarationInviteEmail({
      orgName,
      campaignLabel: token.label ?? "",
      declarationUrl,
      senderName: profile.full_name ?? undefined,
    });

    // Send emails and create invite records
    const validEmails = emails
      .map((e: string) => e.trim().toLowerCase())
      .filter((e: string) => e.includes("@"));

    let sentCount = 0;
    for (const email of validEmails) {
      try {
        await sendEmail({ to: email, subject, html });

        await sb.from("declaration_invites").insert({
          token_id: tokenId,
          email,
        });

        sentCount++;
      } catch (emailErr) {
        console.error(`[declarations] Failed to send invite to ${email}:`, emailErr);
      }
    }

    return NextResponse.json({ sent: sentCount, total: validEmails.length });
  } catch (err: unknown) {
    console.error("[declarations] invite error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
```

**Step 3: Build to verify**

Run: `npm run build`

**Step 4: Commit**

```bash
git add src/lib/emailTemplates.ts src/app/api/declarations/invite/route.ts
git commit -m "feat: add declaration email invite API and email template"
```

---

### Task 8: Staff Declarations — Email Sharing UI + Tracking

**Files:**
- Modify: `src/components/copilot/CopilotDashboard.tsx` (DeclarationSection)

**Step 1: Add Share via Email button + modal to DeclarationSection**

After each token's "Copy link" button, add a "Share via email" button. When clicked, show an inline form with:
- Textarea for comma-separated emails (placeholder: "Enter email addresses, separated by commas")
- Send button that calls `POST /api/declarations/invite` with `{ tokenId, emails }`
- Show success: "Sent to X recipients"

**Step 2: Add invite tracking stats**

Fetch invite counts from a new API or inline with existing declarations fetch. For each token, show: "Sent: X / Submitted: Y" below the token label. This requires modifying `GET /api/declarations` to also return invite counts per token.

Modify `src/app/api/declarations/route.ts` — in the GET handler, after fetching tokens, for each token query `declaration_invites` for counts:

```typescript
// After fetching tokens, get invite stats per token
const tokenIds = tokens.map((t: { id: string }) => t.id);
const { data: inviteStats } = await sb
  .from("declaration_invites")
  .select("token_id, submitted_at")
  .in("token_id", tokenIds);

const inviteMap: Record<string, { sent: number; submitted: number }> = {};
for (const inv of inviteStats ?? []) {
  if (!inviteMap[inv.token_id]) inviteMap[inv.token_id] = { sent: 0, submitted: 0 };
  inviteMap[inv.token_id].sent++;
  if (inv.submitted_at) inviteMap[inv.token_id].submitted++;
}
```

Return `inviteStats` alongside tokens in the response. Update DeclarationSection to display these stats.

**Step 3: Build to verify**

Run: `npm run build`

**Step 4: Commit**

```bash
git add src/components/copilot/CopilotDashboard.tsx src/app/api/declarations/route.ts
git commit -m "feat: add email sharing UI and invite tracking to staff declarations"
```

---

### Task 9: Incident Log — Editable Incidents with Audit Trail

**Files:**
- Modify: `src/components/copilot/IncidentLog.tsx`
- Modify: `src/app/api/incidents/route.ts`

**Step 1: Update PATCH API to set audit fields**

In `src/app/api/incidents/route.ts`, update the PATCH handler. Add `edited_at` and `edited_by` to every update:

```typescript
const updates: Record<string, unknown> = {
  updated_at: new Date().toISOString(),
  edited_at: new Date().toISOString(),
  edited_by: user.id,
};
```

Also expand PATCH to accept `title`, `description`, `aiVendorId` updates:

```typescript
if (body.title !== undefined) updates.title = body.title;
if (body.description !== undefined) updates.description = body.description;
if (body.aiVendorId !== undefined) updates.ai_vendor_id = body.aiVendorId || null;
if (newStatus) updates.status = newStatus;
if (resolution !== undefined) updates.resolution = resolution;
if (impactLevel) updates.impact_level = impactLevel;
```

Update the return select to include `edited_at, edited_by`.

**Step 2: Add Edit button and inline edit form to IncidentLog.tsx**

Add state: `editingId` (string | null), `editTitle`, `editDesc`, `editVendor`, `editImpact`, `editResolution`.

On each incident card (except status === "closed"), add an "Edit" button. When clicked, set `editingId` and populate edit fields from the incident data.

Show an inline edit form (same layout as create form) when `editingId` matches. Save calls PATCH with all fields.

Add "Edited" badge: if `inc.edited_at` exists, show a small badge next to the timestamp with a tooltip: "Last edited [date]".

Update the `Incident` type to include `edited_at: string | null` and `edited_by: string | null`.

**Step 3: Build to verify**

Run: `npm run build`

**Step 4: Commit**

```bash
git add src/components/copilot/IncidentLog.tsx src/app/api/incidents/route.ts
git commit -m "feat: make incidents editable with simple audit trail"
```

---

### Task 10: Vendor → Incident Dropdown Sync

**Files:**
- Modify: `src/components/copilot/IncidentLog.tsx`

**Step 1: Refetch vendors when form opens**

Move the vendor fetch into a standalone function and call it when `showAdd` becomes true:

```typescript
async function fetchVendors() {
  try {
    const res = await fetch("/api/vendors");
    const data = await res.json();
    if (data.vendors) setVendors(data.vendors);
  } catch {
    // silent
  }
}

// Call on mount AND when form opens
useEffect(() => {
  fetchIncidents();
  fetchVendors();
}, [fetchIncidents]);

useEffect(() => {
  if (showAdd) fetchVendors();
}, [showAdd]);
```

This is already partially done — just need to add the `showAdd` effect.

**Step 2: Build to verify**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/components/copilot/IncidentLog.tsx
git commit -m "fix: refetch vendors when incident form opens for fresh dropdown"
```

---

### Task 11: Final Build Verification + Lint

**Step 1: Full build**

Run: `npm run build`
Expected: Clean build, no new errors.

**Step 2: Lint check**

Run: `npm run lint`
Expected: No new errors from our changed files.

**Step 3: Fix any issues found**

If lint or build errors appear in our files, fix them.

**Step 4: Final commit if needed**

```bash
git add -A && git commit -m "chore: fix lint issues from Copilot UX improvements"
```

**Step 5: Push and create PR**

```bash
git push origin feat/starter-self-serve-redesign
```
