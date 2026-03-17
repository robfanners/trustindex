# HAPP API Ingest & Assurance Grading Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable external systems to push AI decision records into Verisum via org-scoped API keys, with protocol-aligned assurance grading (Gold/Silver/Bronze) based on identity assurance and action binding strength.

**Architecture:** New `api_keys` table for org-scoped key management. Existing HAPP decision/output routes extended with dual-auth (session OR API key). New `assurance_grade`, `oversight_mode`, and identity/action binding columns on `decision_records`. New `context` JSONB on `ai_outputs`. Developer nav section + API Key management page. Review queue UX for pending API-ingested decisions.

**Tech Stack:** Next.js App Router, Supabase (Postgres + RLS), TypeScript, Zod validation, existing prove chain utilities (`hashPayload`, `generateVerificationId`), crypto for key hashing

---

## Task 1: Migration — `supabase/migrations/028_happ_api_ingest.sql`

**Files:**
- Create: `supabase/migrations/028_happ_api_ingest.sql`

**Step 1: Write the migration**

```sql
-- 028_happ_api_ingest.sql
-- HAPP API Ingest: API keys, assurance grading, oversight modes, context

-- ---------------------------------------------------------------------------
-- Table: api_keys — org-scoped API keys for external system access
-- ---------------------------------------------------------------------------

CREATE TABLE api_keys (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id   uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_by        uuid NOT NULL REFERENCES profiles(id),
  name              text NOT NULL,
  key_hash          text NOT NULL UNIQUE,
  key_prefix        text NOT NULL,
  scopes            text[] NOT NULL DEFAULT ARRAY['outputs:write', 'decisions:write', 'decisions:read'],
  status            text NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'revoked', 'expired')),
  tier_at_creation  text NOT NULL,
  last_used_at      timestamptz,
  expires_at        timestamptz,
  revoked_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_keys_org       ON api_keys(organisation_id);
CREATE INDEX idx_api_keys_hash      ON api_keys(key_hash);
CREATE INDEX idx_api_keys_status    ON api_keys(organisation_id, status);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view API keys in their org"
  ON api_keys FOR SELECT TO authenticated
  USING (organisation_id IN (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert API keys in their org"
  ON api_keys FOR INSERT TO authenticated
  WITH CHECK (organisation_id IN (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update API keys in their org"
  ON api_keys FOR UPDATE TO authenticated
  USING (organisation_id IN (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete API keys in their org"
  ON api_keys FOR DELETE TO authenticated
  USING (organisation_id IN (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

-- ---------------------------------------------------------------------------
-- ALTER decision_records: add assurance grading + oversight + API key columns
-- ---------------------------------------------------------------------------

ALTER TABLE decision_records
  ADD COLUMN IF NOT EXISTS oversight_mode text
    CHECK (oversight_mode IN ('in_the_loop', 'on_the_loop')),
  ADD COLUMN IF NOT EXISTS assurance_grade text
    CHECK (assurance_grade IN ('gold', 'silver', 'bronze')),
  ADD COLUMN IF NOT EXISTS api_key_id uuid REFERENCES api_keys(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS external_reviewer_email text,
  ADD COLUMN IF NOT EXISTS external_reviewer_name text,
  ADD COLUMN IF NOT EXISTS external_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS identity_assurance_level text
    CHECK (identity_assurance_level IN ('ial_1', 'ial_2', 'ial_3')),
  ADD COLUMN IF NOT EXISTS identity_assurance_method text,
  ADD COLUMN IF NOT EXISTS action_binding_level text
    CHECK (action_binding_level IN ('ab_1', 'ab_2', 'ab_3')),
  ADD COLUMN IF NOT EXISTS action_binding_method text;

CREATE INDEX IF NOT EXISTS idx_decisions_grade ON decision_records(assurance_grade);
CREATE INDEX IF NOT EXISTS idx_decisions_oversight ON decision_records(oversight_mode);
CREATE INDEX IF NOT EXISTS idx_decisions_api_key ON decision_records(api_key_id);

-- ---------------------------------------------------------------------------
-- ALTER ai_outputs: add context + API key columns
-- ---------------------------------------------------------------------------

ALTER TABLE ai_outputs
  ADD COLUMN IF NOT EXISTS api_key_id uuid REFERENCES api_keys(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS context jsonb;

-- ---------------------------------------------------------------------------
-- Backfill existing records
-- ---------------------------------------------------------------------------

UPDATE decision_records
  SET oversight_mode = 'in_the_loop',
      assurance_grade = 'silver'
  WHERE oversight_mode IS NULL;
```

**Step 2: Apply migration via Supabase MCP**

Use `apply_migration` with project_id `ktwrztposaiyllhadqys`, name `028_happ_api_ingest`.

**Step 3: Verify tables exist**

Use `execute_sql`: `SELECT column_name FROM information_schema.columns WHERE table_name = 'api_keys' ORDER BY ordinal_position;`

**Step 4: Commit**

```bash
git add supabase/migrations/028_happ_api_ingest.sql
git commit -m "feat: migration 028 — API keys table, assurance grading columns, context JSONB"
```

---

## Task 2: Assurance Grade Utility — `src/lib/assuranceGrade.ts`

**Files:**
- Create: `src/lib/assuranceGrade.ts`

**Step 1: Create the pure utility**

```typescript
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
```

**Step 2: Commit**

```bash
git add src/lib/assuranceGrade.ts
git commit -m "feat: assurance grade computation — IAL x AB matrix, Gold/Silver/Bronze"
```

---

## Task 3: API Key Auth Middleware — `src/lib/apiKeyAuth.ts`

**Files:**
- Create: `src/lib/apiKeyAuth.ts`

**Step 1: Create the API key authentication utility**

```typescript
// src/lib/apiKeyAuth.ts
// Authenticates API key from Authorization header.
// Used alongside requireTier() for dual-auth on HAPP routes.

import { createHash, randomBytes } from "crypto";
import { supabaseServer } from "@/lib/supabaseServer";
import { hasTierAccess, type VersiumTier } from "@/lib/tiers";
import { planToTier } from "@/lib/tiers";

export type ApiKeyAuthResult = {
  organisationId: string;
  apiKeyId: string;
  scopes: string[];
  tier: string;
};

/** Hash an API key for storage/lookup */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** Generate a new API key: vsk_ + 40 random hex chars */
export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const random = randomBytes(20).toString("hex"); // 40 hex chars
  const key = `vsk_${random}`;
  const prefix = key.slice(0, 12); // "vsk_" + first 8 of random
  const hash = hashApiKey(key);
  return { key, prefix, hash };
}

/**
 * Authenticate an API key from the Authorization header.
 * Returns org info if valid, or null if invalid/missing.
 *
 * Usage:
 * ```ts
 * const apiAuth = await authenticateApiKey(req, "Verify", "decisions:write");
 * if (!apiAuth) return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
 * ```
 */
export async function authenticateApiKey(
  req: Request,
  requiredTier: VersiumTier,
  requiredScope: string
): Promise<ApiKeyAuthResult | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer vsk_")) return null;

  const key = authHeader.slice(7); // strip "Bearer "
  const keyHash = hashApiKey(key);

  const db = supabaseServer();
  const { data: apiKey, error } = await db
    .from("api_keys")
    .select("id, organisation_id, scopes, status, tier_at_creation, expires_at")
    .eq("key_hash", keyHash)
    .single();

  if (error || !apiKey) return null;

  // Check key is active
  if (apiKey.status !== "active") return null;

  // Check not expired
  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
    // Mark as expired
    await db.from("api_keys").update({ status: "expired" }).eq("id", apiKey.id);
    return null;
  }

  // Check scope
  if (!apiKey.scopes.includes(requiredScope)) return null;

  // Check org tier — look up current org plan, not tier_at_creation
  const { data: orgProfiles } = await db
    .from("profiles")
    .select("plan")
    .eq("organisation_id", apiKey.organisation_id)
    .limit(1);

  const orgPlan = orgProfiles?.[0]?.plan ?? "explorer";
  if (!hasTierAccess(orgPlan, requiredTier)) return null;

  // Update last_used_at (fire-and-forget)
  db.from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", apiKey.id)
    .then(() => {});

  return {
    organisationId: apiKey.organisation_id,
    apiKeyId: apiKey.id,
    scopes: apiKey.scopes,
    tier: planToTier(orgPlan),
  };
}
```

**Step 2: Commit**

```bash
git add src/lib/apiKeyAuth.ts
git commit -m "feat: API key auth middleware — generate, hash, authenticate with scope + tier checks"
```

---

## Task 4: Dual-Auth Resolver — `src/lib/resolveAuth.ts`

**Files:**
- Create: `src/lib/resolveAuth.ts`

**Step 1: Create the dual-auth resolver**

This utility tries session auth first, then API key auth. Returns a unified auth result.

```typescript
// src/lib/resolveAuth.ts
// Dual-auth resolver: tries session auth (requireTier) first, then API key.
// Provides a unified auth result for routes that accept both auth methods.

import { NextRequest, NextResponse } from "next/server";
import { requireTier } from "@/lib/requireTier";
import { authenticateApiKey } from "@/lib/apiKeyAuth";
import type { VersiumTier } from "@/lib/tiers";

export type AuthSource = "session" | "api_key";

export type ResolvedAuth =
  | {
      authorized: true;
      source: AuthSource;
      organisationId: string;
      userId: string | null; // null for API key auth
      apiKeyId: string | null; // null for session auth
    }
  | {
      authorized: false;
      response: NextResponse;
    };

/**
 * Resolve authentication from either session or API key.
 * Tries session first (fast path for UI), falls back to API key.
 *
 * Usage:
 * ```ts
 * const auth = await resolveAuth(req, "Verify", "decisions:write");
 * if (!auth.authorized) return auth.response;
 * // auth.source, auth.organisationId, auth.userId, auth.apiKeyId
 * ```
 */
export async function resolveAuth(
  req: NextRequest,
  requiredTier: VersiumTier,
  requiredScope: string
): Promise<ResolvedAuth> {
  // Try session auth first
  const sessionCheck = await requireTier(requiredTier);
  if (sessionCheck.authorized) {
    if (!sessionCheck.orgId) {
      return {
        authorized: false,
        response: NextResponse.json({ error: "No organisation linked" }, { status: 400 }),
      };
    }
    return {
      authorized: true,
      source: "session",
      organisationId: sessionCheck.orgId,
      userId: sessionCheck.userId,
      apiKeyId: null,
    };
  }

  // Try API key auth
  const apiKeyAuth = await authenticateApiKey(req, requiredTier, requiredScope);
  if (apiKeyAuth) {
    return {
      authorized: true,
      source: "api_key",
      organisationId: apiKeyAuth.organisationId,
      userId: null,
      apiKeyId: apiKeyAuth.apiKeyId,
    };
  }

  // Neither auth method succeeded
  return {
    authorized: false,
    response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
  };
}
```

**Step 2: Commit**

```bash
git add src/lib/resolveAuth.ts
git commit -m "feat: dual-auth resolver — session OR API key with unified result"
```

---

## Task 5: Validation Schemas — API Ingest

**Files:**
- Modify: `src/lib/validations.ts`

**Step 1: Add API ingest schemas after the existing HAPP schemas**

```typescript
// --- HAPP API Ingest schemas ---

export const identityAssuranceSchema = z.object({
  level: z.enum(["ial_1", "ial_2", "ial_3"]),
  method: z.string().max(100),
  reviewer_email: z.string().email().max(320).optional(),
  reviewer_name: z.string().max(200).optional(),
  reviewer_external_id: z.string().max(200).optional(),
});

export const actionBindingSchema = z.object({
  level: z.enum(["ab_1", "ab_2", "ab_3"]),
  method: z.string().max(100),
  reviewed_at: z.string().min(1, "reviewed_at is required"),
  session_id: z.string().max(500).optional(),
  signature: z.string().max(2000).optional(),
});

export const outputContextSchema = z.object({
  input_summary: z.string().max(5000).optional(),
  full_output_ref: z.string().url().max(2000).optional(),
  supporting_evidence: z.array(z.object({
    label: z.string().max(200),
    url: z.string().url().max(2000),
  })).max(20).optional(),
  notes: z.string().max(5000).optional(),
});

export const apiIngestDecisionSchema = z.object({
  system_id: z.string().uuid("Invalid system ID"),
  policy_version_id: z.string().uuid("Invalid policy version ID"),
  oversight_mode: z.enum(["in_the_loop", "on_the_loop"]),

  // Output fields (inline creation)
  output_summary: z.string().min(1, "output_summary is required").max(5000),
  output_hash: z.string().max(200).optional(),
  output_type: z.enum(["recommendation", "classification", "generated_text", "action_request", "score", "other"]).optional(),
  confidence_score: z.number().min(0).max(1).optional(),
  risk_signal: z.enum(["low", "medium", "high", "critical"]).optional(),
  occurred_at: z.string().min(1, "occurred_at is required"),
  model_id: z.string().uuid().optional(),
  external_event_id: z.string().max(500).optional(),

  // Context (links, notes, evidence)
  context: outputContextSchema.optional(),

  // Review (optional — if omitted, decision enters pending_review queue)
  review_mode: z.enum(["required", "optional", "auto_approved"]),
  human_decision: z.enum(["approved", "rejected", "escalated", "modified"]).optional(),
  human_rationale: z.string().max(5000).optional(),

  // Identity assurance (optional — affects grade)
  identity_assurance: identityAssuranceSchema.optional(),

  // Action binding (optional — affects grade)
  action_binding: actionBindingSchema.optional(),
});

export const createApiKeySchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  scopes: z.array(z.enum(["outputs:write", "decisions:write", "decisions:read", "keys:read"])).min(1, "At least one scope is required"),
  expires_at: z.string().max(50).optional(),
});
```

**Step 2: Commit**

```bash
git add src/lib/validations.ts
git commit -m "feat: Zod schemas for API ingest — identity assurance, action binding, context, API keys"
```

---

## Task 6: API Keys CRUD Routes

**Files:**
- Create: `src/app/api/happ/api-keys/route.ts`
- Create: `src/app/api/happ/api-keys/[keyId]/route.ts`

**Step 1: Create list + generate route**

`src/app/api/happ/api-keys/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireTier } from "@/lib/requireTier";
import { supabaseServer } from "@/lib/supabaseServer";
import { generateApiKey } from "@/lib/apiKeyAuth";
import { createApiKeySchema, firstZodError } from "@/lib/validations";
import { writeAuditLog } from "@/lib/audit";
import { planToTier } from "@/lib/tiers";

export async function GET(req: NextRequest) {
  const check = await requireTier("Assure");
  if (!check.authorized) return check.response;
  if (!check.orgId) return NextResponse.json({ error: "No organisation linked" }, { status: 400 });

  const db = supabaseServer();
  const { data, error } = await db
    .from("api_keys")
    .select("id, name, key_prefix, scopes, status, tier_at_creation, last_used_at, expires_at, revoked_at, created_at, profiles!api_keys_created_by_fkey(full_name)")
    .eq("organisation_id", check.orgId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ keys: data ?? [] });
}

export async function POST(req: NextRequest) {
  const check = await requireTier("Assure");
  if (!check.authorized) return check.response;
  if (!check.orgId) return NextResponse.json({ error: "No organisation linked" }, { status: 400 });

  const body = await req.json();
  const parsed = createApiKeySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
  }

  // Check key limit based on plan
  const db = supabaseServer();
  const { count } = await db
    .from("api_keys")
    .select("id", { count: "exact", head: true })
    .eq("organisation_id", check.orgId)
    .eq("status", "active");

  const maxKeys = check.plan === "enterprise" ? Infinity : 3;
  if ((count ?? 0) >= maxKeys) {
    return NextResponse.json({ error: `Maximum ${maxKeys} active API keys allowed on your plan` }, { status: 403 });
  }

  const { key, prefix, hash } = generateApiKey();

  const { data: apiKey, error } = await db
    .from("api_keys")
    .insert({
      organisation_id: check.orgId,
      created_by: check.userId,
      name: parsed.data.name,
      key_hash: hash,
      key_prefix: prefix,
      scopes: parsed.data.scopes,
      tier_at_creation: planToTier(check.plan),
      expires_at: parsed.data.expires_at || null,
    })
    .select("id, name, key_prefix, scopes, status, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog({
    organisationId: check.orgId,
    entityType: "api_key",
    entityId: apiKey.id,
    actionType: "created",
    performedBy: check.userId,
    metadata: { name: parsed.data.name, scopes: parsed.data.scopes },
  });

  // Return the plaintext key ONCE — never stored or retrievable again
  return NextResponse.json({ ...apiKey, key }, { status: 201 });
}
```

**Step 2: Create detail + revoke route**

`src/app/api/happ/api-keys/[keyId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireTier } from "@/lib/requireTier";
import { supabaseServer } from "@/lib/supabaseServer";
import { writeAuditLog } from "@/lib/audit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ keyId: string }> }
) {
  const check = await requireTier("Assure");
  if (!check.authorized) return check.response;
  if (!check.orgId) return NextResponse.json({ error: "No organisation linked" }, { status: 400 });

  const { keyId } = await params;
  const db = supabaseServer();
  const { data, error } = await db
    .from("api_keys")
    .select("id, name, key_prefix, scopes, status, tier_at_creation, last_used_at, expires_at, revoked_at, created_at, profiles!api_keys_created_by_fkey(full_name, email)")
    .eq("id", keyId)
    .eq("organisation_id", check.orgId)
    .single();

  if (error || !data) return NextResponse.json({ error: "API key not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ keyId: string }> }
) {
  const check = await requireTier("Assure");
  if (!check.authorized) return check.response;
  if (!check.orgId) return NextResponse.json({ error: "No organisation linked" }, { status: 400 });

  const { keyId } = await params;
  const body = await req.json();
  const db = supabaseServer();

  // Fetch existing key
  const { data: existing, error: fetchErr } = await db
    .from("api_keys")
    .select("id, status")
    .eq("id", keyId)
    .eq("organisation_id", check.orgId)
    .single();

  if (fetchErr || !existing) return NextResponse.json({ error: "API key not found" }, { status: 404 });

  const updates: Record<string, unknown> = {};

  // Allow name update
  if (body.name !== undefined) updates.name = body.name;

  // Allow scope update (only if active)
  if (body.scopes !== undefined && existing.status === "active") updates.scopes = body.scopes;

  // Allow revocation
  if (body.status === "revoked" && existing.status === "active") {
    updates.status = "revoked";
    updates.revoked_at = new Date().toISOString();
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid updates" }, { status: 400 });
  }

  const { data, error } = await db
    .from("api_keys")
    .update(updates)
    .eq("id", keyId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog({
    organisationId: check.orgId,
    entityType: "api_key",
    entityId: keyId,
    actionType: updates.status === "revoked" ? "revoked" : "updated",
    performedBy: check.userId,
    metadata: updates,
  });

  return NextResponse.json(data);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ keyId: string }> }
) {
  const check = await requireTier("Assure");
  if (!check.authorized) return check.response;
  if (!check.orgId) return NextResponse.json({ error: "No organisation linked" }, { status: 400 });

  const { keyId } = await params;
  const db = supabaseServer();

  // Only allow deletion of revoked keys
  const { data: existing } = await db
    .from("api_keys")
    .select("id, status")
    .eq("id", keyId)
    .eq("organisation_id", check.orgId)
    .single();

  if (!existing) return NextResponse.json({ error: "API key not found" }, { status: 404 });
  if (existing.status !== "revoked") {
    return NextResponse.json({ error: "Only revoked keys can be deleted. Revoke the key first." }, { status: 400 });
  }

  const { error } = await db.from("api_keys").delete().eq("id", keyId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog({
    organisationId: check.orgId,
    entityType: "api_key",
    entityId: keyId,
    actionType: "deleted",
    performedBy: check.userId,
    metadata: {},
  });

  return NextResponse.json({ success: true });
}
```

**Step 3: Commit**

```bash
git add src/app/api/happ/api-keys/
git commit -m "feat: API keys CRUD — generate (plaintext once), list, revoke, delete"
```

---

## Task 7: Extend Decisions Route — Dual-Auth + API Ingest

**Files:**
- Modify: `src/app/api/happ/decisions/route.ts`

**Step 1: Refactor POST to use dual-auth and support API ingest**

Replace the existing POST handler. The GET handler also needs dual-auth and new filters.

Key changes:
- Import `resolveAuth` instead of `requireTier` for POST and GET
- Add new import for `apiIngestDecisionSchema`
- Add import for `computeAssuranceGrade`
- POST: detect auth source, branch on `session` vs `api_key` for creation mode
- Session auth: existing behaviour (unchanged), add `oversight_mode = 'in_the_loop'`, `assurance_grade = 'silver'`
- API key auth: validate with `apiIngestDecisionSchema`, create output with context, compute assurance grade, handle review queue (no `human_decision` → `pending_review`)
- GET: add filters for `source_type`, `assurance_grade`, `oversight_mode`
- GET: add `assurance_grade`, `oversight_mode`, `source_type` to select fields

The full replacement for `src/app/api/happ/decisions/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireTier } from "@/lib/requireTier";
import { resolveAuth } from "@/lib/resolveAuth";
import { supabaseServer } from "@/lib/supabaseServer";
import { hashPayload, generateVerificationId } from "@/lib/prove/chain";
import {
  createDecisionRecordSchema,
  createDecisionWithOutputSchema,
  apiIngestDecisionSchema,
  firstZodError,
} from "@/lib/validations";
import { writeAuditLog } from "@/lib/audit";
import { computeAssuranceGrade } from "@/lib/assuranceGrade";

export async function GET(req: NextRequest) {
  const auth = await resolveAuth(req, "Verify", "decisions:read");
  if (!auth.authorized) return auth.response;

  const params = req.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page") || 1));
  const perPage = Math.min(100, Math.max(1, Number(params.get("per_page") || 20)));
  const offset = (page - 1) * perPage;

  const systemId = params.get("system_id");
  const reviewerId = params.get("reviewer_id");
  const decisionStatus = params.get("decision_status");
  const humanDecision = params.get("human_decision");
  const policyVersionId = params.get("policy_version_id");
  const dateFrom = params.get("date_from");
  const dateTo = params.get("date_to");
  const sourceType = params.get("source_type");
  const assuranceGrade = params.get("assurance_grade");
  const oversightMode = params.get("oversight_mode");

  const db = supabaseServer();
  let query = db
    .from("decision_records")
    .select(
      "*, systems(name), profiles!decision_records_human_reviewer_id_fkey(full_name), policy_versions(title, version), ai_outputs(output_summary, output_type)",
      { count: "exact" }
    )
    .eq("organisation_id", auth.organisationId)
    .order("created_at", { ascending: false })
    .range(offset, offset + perPage - 1);

  if (systemId) query = query.eq("system_id", systemId);
  if (reviewerId) query = query.eq("human_reviewer_id", reviewerId);
  if (decisionStatus) query = query.eq("decision_status", decisionStatus);
  if (humanDecision) query = query.eq("human_decision", humanDecision);
  if (policyVersionId) query = query.eq("policy_version_id", policyVersionId);
  if (dateFrom) query = query.gte("reviewed_at", dateFrom);
  if (dateTo) query = query.lte("reviewed_at", dateTo);
  if (sourceType) query = query.eq("source_type", sourceType);
  if (assuranceGrade) query = query.eq("assurance_grade", assuranceGrade);
  if (oversightMode) query = query.eq("oversight_mode", oversightMode);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ records: data ?? [], total: count ?? 0 });
}

export async function POST(req: NextRequest) {
  const auth = await resolveAuth(req, "Verify", "decisions:write");
  if (!auth.authorized) return auth.response;

  const body = await req.json();
  const db = supabaseServer();
  const now = new Date().toISOString();

  // ── API Key auth path ──────────────────────────────────────────────
  if (auth.source === "api_key") {
    const parsed = apiIngestDecisionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
    }
    const d = parsed.data;

    // Validate system belongs to org
    const { data: system, error: sysErr } = await db
      .from("systems")
      .select("id")
      .eq("id", d.system_id)
      .eq("organisation_id", auth.organisationId)
      .single();
    if (sysErr || !system) {
      return NextResponse.json({ error: "System not found in your organisation" }, { status: 404 });
    }

    // Validate model if provided
    if (d.model_id) {
      const { data: model, error: modErr } = await db
        .from("model_registry")
        .select("id")
        .eq("id", d.model_id)
        .eq("organisation_id", auth.organisationId)
        .single();
      if (modErr || !model) {
        return NextResponse.json({ error: "Model not found in your organisation" }, { status: 404 });
      }
    }

    // Validate policy version
    const { data: pv, error: pvErr } = await db
      .from("policy_versions")
      .select("id, status")
      .eq("id", d.policy_version_id)
      .eq("organisation_id", auth.organisationId)
      .single();
    if (pvErr || !pv) {
      return NextResponse.json({ error: "Policy version not found in your organisation" }, { status: 404 });
    }
    if (pv.status !== "active") {
      return NextResponse.json({ error: "Policy version must be active" }, { status: 400 });
    }

    // Create AI output
    const outputHash = d.output_hash || hashPayload({ output_summary: d.output_summary, occurred_at: d.occurred_at });

    const { data: output, error: outErr } = await db
      .from("ai_outputs")
      .insert({
        organisation_id: auth.organisationId,
        system_id: d.system_id,
        model_id: d.model_id || null,
        source_type: "api",
        external_event_id: d.external_event_id || null,
        output_hash: outputHash,
        output_summary: d.output_summary,
        output_type: d.output_type || null,
        confidence_score: d.confidence_score ?? null,
        risk_signal: d.risk_signal || null,
        occurred_at: d.occurred_at,
        created_by: null,
        api_key_id: auth.apiKeyId,
        context: d.context || null,
      })
      .select()
      .single();

    if (outErr || !output) {
      return NextResponse.json({ error: outErr?.message || "Failed to create output" }, { status: 500 });
    }

    // Compute assurance grade
    const assuranceGrade = d.human_decision
      ? computeAssuranceGrade({
          source_type: "api",
          review_mode: d.review_mode,
          identity_assurance_level: d.identity_assurance?.level,
          action_binding_level: d.action_binding?.level,
          external_reviewer_email: d.identity_assurance?.reviewer_email,
          external_reviewed_at: d.action_binding?.reviewed_at,
        })
      : null; // Grade computed on review if pending

    // Determine status
    const isPendingReview = !d.human_decision;
    const decisionStatus = isPendingReview ? "pending_review" : "review_completed";
    const reviewedAt = isPendingReview ? null : (d.action_binding?.reviewed_at || now);

    const verificationId = generateVerificationId({
      type: "decision",
      org: auth.organisationId,
      system_id: d.system_id,
      output_id: output.id,
      policy_version_id: d.policy_version_id,
      reviewer: d.identity_assurance?.reviewer_email || "api",
      reviewed_at: reviewedAt || now,
    });

    const { data: decision, error: decErr } = await db
      .from("decision_records")
      .insert({
        organisation_id: auth.organisationId,
        system_id: d.system_id,
        ai_output_id: output.id,
        policy_version_id: d.policy_version_id,
        human_reviewer_id: null,
        created_by: null,
        source_type: "api",
        review_mode: d.review_mode,
        decision_status: decisionStatus,
        human_decision: d.human_decision || null,
        human_rationale: d.human_rationale || null,
        reviewed_at: reviewedAt,
        verification_id: verificationId,
        chain_status: "pending",
        oversight_mode: d.oversight_mode,
        assurance_grade: assuranceGrade,
        api_key_id: auth.apiKeyId,
        external_reviewer_email: d.identity_assurance?.reviewer_email || null,
        external_reviewer_name: d.identity_assurance?.reviewer_name || null,
        external_reviewed_at: d.action_binding?.reviewed_at || null,
        identity_assurance_level: d.identity_assurance?.level || null,
        identity_assurance_method: d.identity_assurance?.method || null,
        action_binding_level: d.action_binding?.level || null,
        action_binding_method: d.action_binding?.method || null,
      })
      .select()
      .single();

    if (decErr) return NextResponse.json({ error: decErr.message }, { status: 500 });

    await writeAuditLog({
      organisationId: auth.organisationId,
      entityType: "decision",
      entityId: decision.id,
      actionType: "created",
      performedBy: auth.apiKeyId!,
      metadata: {
        source: "api",
        system_id: d.system_id,
        human_decision: d.human_decision || null,
        assurance_grade: assuranceGrade,
        oversight_mode: d.oversight_mode,
        verification_id: verificationId,
      },
    });

    return NextResponse.json({
      id: decision.id,
      verification_id: verificationId,
      assurance_grade: assuranceGrade,
      decision_status: decisionStatus,
      chain_status: "pending",
      oversight_mode: d.oversight_mode,
      created_at: decision.created_at,
    }, { status: 201 });
  }

  // ── Session auth path (existing behaviour, extended) ───────────────
  let aiOutputId: string;
  let systemId: string;

  if (body.ai_output_id) {
    // Mode 1: existing output
    const parsed = createDecisionRecordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
    }
    aiOutputId = parsed.data.ai_output_id;

    const { data: output, error: outErr } = await db
      .from("ai_outputs")
      .select("id, system_id, organisation_id")
      .eq("id", aiOutputId)
      .single();
    if (outErr || !output) {
      return NextResponse.json({ error: "AI output not found" }, { status: 404 });
    }
    if (output.organisation_id !== auth.organisationId) {
      return NextResponse.json({ error: "AI output does not belong to your organisation" }, { status: 403 });
    }
    systemId = output.system_id;
  } else {
    // Mode 2: inline output creation
    const parsed = createDecisionWithOutputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
    }
    const d = parsed.data;

    const { data: system, error: sysErr } = await db
      .from("systems")
      .select("id")
      .eq("id", d.system_id)
      .eq("organisation_id", auth.organisationId)
      .single();
    if (sysErr || !system) {
      return NextResponse.json({ error: "System not found in your organisation" }, { status: 404 });
    }

    if (d.model_id) {
      const { data: model, error: modErr } = await db
        .from("model_registry")
        .select("id")
        .eq("id", d.model_id)
        .eq("organisation_id", auth.organisationId)
        .single();
      if (modErr || !model) {
        return NextResponse.json({ error: "Model not found in your organisation" }, { status: 404 });
      }
    }

    const outputHash = d.output_hash || hashPayload({ output_summary: d.output_summary, occurred_at: d.occurred_at });

    const { data: output, error: outErr } = await db
      .from("ai_outputs")
      .insert({
        organisation_id: auth.organisationId,
        system_id: d.system_id,
        model_id: d.model_id || null,
        source_type: "manual",
        output_hash: outputHash,
        output_summary: d.output_summary,
        output_type: d.output_type || null,
        confidence_score: d.confidence_score ?? null,
        risk_signal: d.risk_signal || null,
        occurred_at: d.occurred_at,
        created_by: auth.userId,
      })
      .select()
      .single();

    if (outErr || !output) {
      return NextResponse.json({ error: outErr?.message || "Failed to create output" }, { status: 500 });
    }
    aiOutputId = output.id;
    systemId = d.system_id;
  }

  // Validate policy version
  const policyVersionId = body.policy_version_id;
  const { data: pv, error: pvErr } = await db
    .from("policy_versions")
    .select("id, status")
    .eq("id", policyVersionId)
    .eq("organisation_id", auth.organisationId)
    .single();
  if (pvErr || !pv) {
    return NextResponse.json({ error: "Policy version not found in your organisation" }, { status: 404 });
  }
  if (pv.status !== "active") {
    return NextResponse.json({ error: "Policy version must be active" }, { status: 400 });
  }

  const verificationId = generateVerificationId({
    type: "decision",
    org: auth.organisationId,
    system_id: systemId,
    output_id: aiOutputId,
    policy_version_id: policyVersionId,
    reviewer: auth.userId,
    reviewed_at: now,
  });

  const { data: decision, error: decErr } = await db
    .from("decision_records")
    .insert({
      organisation_id: auth.organisationId,
      system_id: systemId,
      ai_output_id: aiOutputId,
      policy_version_id: policyVersionId,
      human_reviewer_id: auth.userId,
      created_by: auth.userId,
      source_type: "manual",
      review_mode: body.review_mode,
      decision_status: "review_completed",
      human_decision: body.human_decision,
      human_rationale: body.human_rationale || null,
      reviewed_at: now,
      verification_id: verificationId,
      chain_status: "pending",
      oversight_mode: body.oversight_mode || "in_the_loop",
      assurance_grade: "silver",
    })
    .select()
    .single();

  if (decErr) return NextResponse.json({ error: decErr.message }, { status: 500 });

  await writeAuditLog({
    organisationId: auth.organisationId,
    entityType: "decision",
    entityId: decision.id,
    actionType: "created",
    performedBy: auth.userId!,
    metadata: { source: "manual", system_id: systemId, human_decision: body.human_decision, verification_id: verificationId },
  });

  return NextResponse.json(decision, { status: 201 });
}
```

**Step 2: Commit**

```bash
git add src/app/api/happ/decisions/route.ts
git commit -m "feat: decisions route — dual-auth, API ingest with assurance grading, review queue"
```

---

## Task 8: Extend Decision Detail + Anchor Routes for Dual-Auth

**Files:**
- Modify: `src/app/api/happ/decisions/[decisionId]/route.ts`
- Modify: `src/app/api/happ/decisions/[decisionId]/anchor/route.ts`
- Modify: `src/app/api/happ/outputs/route.ts`

**Step 1: Update decision detail route**

In `src/app/api/happ/decisions/[decisionId]/route.ts`:

- Replace `requireTier` with `resolveAuth` for both GET and PATCH
- GET: add new columns to select (`oversight_mode`, `assurance_grade`, `source_type`, `external_reviewer_email`, `external_reviewer_name`, `identity_assurance_level`, `action_binding_level`). Also join `ai_outputs(*, context)` to include context in detail view.
- PATCH: when reviewing a pending decision (setting `human_decision` on a `pending_review` record), compute and set `assurance_grade` as Silver (IAL-2 via Verisum session x AB-2), set `human_reviewer_id` to session user, set `reviewed_at` to now, set `decision_status` to `review_completed`.

**Step 2: Update anchor route**

In `src/app/api/happ/decisions/[decisionId]/anchor/route.ts`:

- Replace `requireTier` with `resolveAuth(req, "Verify", "decisions:write")`
- Include `assurance_grade` and `oversight_mode` in the canonical hash payload

**Step 3: Update outputs route**

In `src/app/api/happ/outputs/route.ts`:

- Replace `requireTier` with `resolveAuth` for both GET and POST
- POST: if API key auth, set `source_type = 'api'`, `api_key_id`, `context` from body
- GET: include `context` in select, add `source_type` filter

**Step 4: Commit**

```bash
git add src/app/api/happ/decisions/ src/app/api/happ/outputs/
git commit -m "feat: extend decision detail, anchor, outputs routes for dual-auth + assurance grading"
```

---

## Task 9: Navigation — Developer Section

**Files:**
- Modify: `src/lib/navigation.ts`

**Step 1: Add Developer nav section**

Add before the `settings` section in `navSections`:

```typescript
  {
    id: "developer",
    label: "DEVELOPER",
    minTier: "pro",
    tierBadge: "Assure",
    items: [
      { label: "API Keys", href: "/developer/api-keys", icon: "key", exists: true },
    ],
  },
```

**Step 2: Commit**

```bash
git add src/lib/navigation.ts
git commit -m "feat: Developer nav section with API Keys item"
```

---

## Task 10: API Keys Management UI

**Files:**
- Create: `src/app/developer/api-keys/page.tsx`

**Step 1: Build the API Keys page**

Follow `src/app/prove/decisions/page.tsx` pattern:

- `"use client"`, `<TierGate requiredTier="Assure">`
- PageHeader: "API Keys", subtitle "Manage API keys for external system integration"
- State: keys list, loading, selected key for detail, showCreateModal
- Fetch from `/api/happ/api-keys`
- Table: Name | Prefix | Scopes | Status | Last Used | Created
- Click row → detail panel: name (editable), scopes (checkboxes), status, created by, last used, created at. Revoke button (confirmation dialog). Delete button (only for revoked, confirmation dialog).
- "Generate New Key" button → modal:
  - Name input
  - Scope checkboxes (outputs:write, decisions:write, decisions:read, keys:read)
  - Optional expiry date
  - On submit → POST `/api/happ/api-keys` → show plaintext key in copy-to-clipboard box with warning "Copy this key now. It won't be shown again." → dismiss → refresh list
- Status badges: green "Active", red "Revoked", amber "Expired"
- Revoked keys shown greyed out at bottom of list

**Step 2: Commit**

```bash
git add src/app/developer/api-keys/
git commit -m "feat: API Keys management page — generate, list, revoke, delete"
```

---

## Task 11: Decision Ledger UI — Review Queue + Grade Badges

**Files:**
- Modify: `src/app/prove/decisions/page.tsx`

**Step 1: Add review queue banner**

At top of the decisions list, compute pending count from fetched data (or separate count query). Show banner when pending > 0:
- "N decisions awaiting review" with risk breakdown
- "Review now" button filters to `decision_status=pending_review`

**Step 2: Add new table columns and filters**

- Add "Source" column with badge: "Manual" (grey) / "API" (blue)
- Add "Grade" column with badge: "Gold" (amber/gold), "Silver" (grey), "Bronze" (brown/copper)
- Add filter dropdowns: Source Type, Assurance Grade, Oversight Mode
- Add "Pending Review" preset button

**Step 3: Add Context section to detail panel**

In the detail panel Decision tab, after the AI Output section, add a Context section:
- Only show if `ai_outputs.context` exists
- Display: input_summary, notes, supporting_evidence as clickable links, full_output_ref as link
- Label "Supporting Evidence" with link icon

**Step 4: Add review form for pending decisions**

When viewing a `pending_review` decision:
- Show the review form (decision radio, rationale textarea) directly in the detail panel
- On submit: PATCH `/api/happ/decisions/[id]` with `human_decision`, `human_rationale`
- Refresh the decision detail to show updated grade (Silver)

**Step 5: Add grade and oversight badges to detail panel**

- Show assurance grade badge in the detail panel header area
- Show oversight mode badge: "In-the-Loop" / "On-the-Loop"
- Tooltip on grade badge explaining what the grade means

**Step 6: Commit**

```bash
git add src/app/prove/decisions/
git commit -m "feat: Decision Ledger — review queue, grade badges, context section, pending review form"
```

---

## Task 12: Build Verification

**Step 1: Run build**

```bash
npm run build
```

Expected: Clean pass, no TypeScript errors.

**Step 2: Fix any issues**

If build fails, fix TypeScript errors, missing imports, or type mismatches.

**Step 3: Commit fixes if needed**

---

## Task 13: Apply Migration

**Step 1: Apply via Supabase MCP**

Use `apply_migration` tool with:
- project_id: `ktwrztposaiyllhadqys`
- name: `028_happ_api_ingest`
- query: contents of `supabase/migrations/028_happ_api_ingest.sql`

**Step 2: Verify**

Use `execute_sql`:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'api_keys'
ORDER BY ordinal_position;
```

And:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'decision_records' AND column_name IN ('assurance_grade', 'oversight_mode', 'api_key_id', 'identity_assurance_level', 'action_binding_level')
ORDER BY ordinal_position;
```

---

## Task 14: Final Push

**Step 1: Push to main**

```bash
git push origin main
```

---

## Verification Checklist

1. `npm run build` passes clean
2. Migration 028 applied to Supabase
3. POST `/api/happ/api-keys` — generates key, returns plaintext once, stores hash
4. GET `/api/happ/api-keys` — lists keys with masked prefixes
5. PATCH `/api/happ/api-keys/[id]` — revokes key
6. POST `/api/happ/decisions` with `Authorization: Bearer vsk_...` — creates decision via API key
7. POST `/api/happ/decisions` with API key, no `human_decision` — creates `pending_review` decision
8. PATCH `/api/happ/decisions/[id]` — reviewing a pending decision sets grade to Silver
9. POST `/api/happ/decisions/[id]/anchor` with API key — works with dual-auth
10. GET `/api/happ/decisions?assurance_grade=silver` — new filters work
11. "Developer" section appears in sidebar for Pro+ users
12. API Keys page at `/developer/api-keys` — generate, list, revoke, delete
13. Decision Ledger shows review queue banner, grade/source badges, context section
14. Pending review detail panel shows review form
15. Existing UI-created decisions show as Silver grade, in-the-loop
