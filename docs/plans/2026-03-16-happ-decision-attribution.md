# HAPP Decision Attribution Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the HAPP Decision Attribution engine — policy versioning, AI output recording, and human-reviewed decision records with chain anchoring — so organisations can prove Article 14 human oversight compliance.

**Architecture:** Three new tables (`policy_versions`, `ai_outputs`, `decision_records`) plus FK additions to existing prove tables. Manual recording MVP with schema designed for future webhook ingest. All routes under `/api/happ/` namespace, tier-gated to Verify. UI as a Decision Ledger page under `/prove/decisions`.

**Tech Stack:** Next.js App Router, Supabase (Postgres + RLS), TypeScript, Zod validation, existing prove chain utilities (`hashPayload`, `generateVerificationId`, `anchorOnChain`)

---

## Task 1: Migration — `supabase/migrations/026_happ_decision_attribution.sql`

**Files:**
- Create: `supabase/migrations/026_happ_decision_attribution.sql`

**Step 1: Write the migration**

```sql
-- 026_happ_decision_attribution.sql
-- HAPP Decision Attribution: policy versioning, AI outputs, decision records

-- ---------------------------------------------------------------------------
-- Table: policy_versions — immutable versioned governance policies
-- ---------------------------------------------------------------------------

CREATE TABLE policy_versions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id   uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  policy_id         uuid NOT NULL REFERENCES ai_policies(id) ON DELETE CASCADE,
  version           integer NOT NULL,
  title             text NOT NULL,
  policy_hash       text NOT NULL,
  content_snapshot  jsonb NOT NULL,
  status            text NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'active', 'superseded', 'retired')),
  effective_from    timestamptz,
  effective_until   timestamptz,
  published_by      uuid REFERENCES profiles(id),
  published_at      timestamptz,
  superseded_by     uuid REFERENCES policy_versions(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(policy_id, version)
);

CREATE INDEX idx_policy_versions_org    ON policy_versions(organisation_id);
CREATE INDEX idx_policy_versions_policy ON policy_versions(policy_id, status);
CREATE INDEX idx_policy_versions_eff    ON policy_versions(effective_from);

ALTER TABLE policy_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view policy versions in their org"
  ON policy_versions FOR SELECT TO authenticated
  USING (organisation_id IN (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert policy versions in their org"
  ON policy_versions FOR INSERT TO authenticated
  WITH CHECK (organisation_id IN (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update policy versions in their org"
  ON policy_versions FOR UPDATE TO authenticated
  USING (organisation_id IN (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

CREATE OR REPLACE FUNCTION tg_policy_versions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_policy_versions_updated_at
  BEFORE UPDATE ON policy_versions FOR EACH ROW
  EXECUTE FUNCTION tg_policy_versions_updated_at();

-- ---------------------------------------------------------------------------
-- Table: ai_outputs — observed AI system outputs
-- ---------------------------------------------------------------------------

CREATE TABLE ai_outputs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id   uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  system_id         uuid NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  system_run_id     uuid REFERENCES system_runs(id) ON DELETE SET NULL,
  model_id          uuid REFERENCES model_registry(id) ON DELETE SET NULL,
  source_type       text NOT NULL DEFAULT 'manual'
                      CHECK (source_type IN ('manual', 'api')),
  external_event_id text,
  input_hash        text,
  output_hash       text NOT NULL,
  output_summary    text NOT NULL,
  output_type       text CHECK (output_type IN ('recommendation', 'classification', 'generated_text', 'action_request', 'score', 'other')),
  raw_output_ref    text,
  confidence_score  numeric CHECK (confidence_score >= 0 AND confidence_score <= 1),
  risk_signal       text CHECK (risk_signal IN ('low', 'medium', 'high', 'critical')),
  occurred_at       timestamptz NOT NULL,
  created_by        uuid REFERENCES profiles(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_outputs_system ON ai_outputs(system_id, occurred_at DESC);
CREATE INDEX idx_ai_outputs_org    ON ai_outputs(organisation_id);

ALTER TABLE ai_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view outputs in their org"
  ON ai_outputs FOR SELECT TO authenticated
  USING (organisation_id IN (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert outputs in their org"
  ON ai_outputs FOR INSERT TO authenticated
  WITH CHECK (organisation_id IN (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Table: decision_records — the core HAPP attribution record
-- ---------------------------------------------------------------------------

CREATE TABLE decision_records (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id     uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  system_id           uuid NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  system_run_id       uuid REFERENCES system_runs(id) ON DELETE SET NULL,
  ai_output_id        uuid NOT NULL REFERENCES ai_outputs(id) ON DELETE CASCADE,
  policy_version_id   uuid NOT NULL REFERENCES policy_versions(id),
  human_reviewer_id   uuid REFERENCES profiles(id),
  approval_id         uuid REFERENCES prove_approvals(id) ON DELETE SET NULL,
  provenance_id       uuid REFERENCES prove_provenance(id) ON DELETE SET NULL,
  source_type         text NOT NULL DEFAULT 'manual'
                        CHECK (source_type IN ('manual', 'api')),
  review_mode         text NOT NULL
                        CHECK (review_mode IN ('required', 'optional', 'auto_approved')),
  decision_status     text NOT NULL DEFAULT 'pending_review'
                        CHECK (decision_status IN ('pending_review', 'in_review', 'review_completed', 'anchoring_pending', 'anchored', 'failed')),
  human_decision      text CHECK (human_decision IN ('approved', 'rejected', 'escalated', 'modified')),
  human_rationale     text,
  reviewed_at         timestamptz,
  created_by          uuid REFERENCES profiles(id),
  verification_id     text UNIQUE,
  event_hash          text,
  chain_tx_hash       text,
  chain_status        text DEFAULT 'pending'
                        CHECK (chain_status IN ('pending', 'anchored', 'failed', 'skipped')),
  anchored_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_decisions_system   ON decision_records(system_id, reviewed_at DESC);
CREATE INDEX idx_decisions_reviewer ON decision_records(human_reviewer_id);
CREATE INDEX idx_decisions_status   ON decision_records(decision_status);
CREATE INDEX idx_decisions_org      ON decision_records(organisation_id);

ALTER TABLE decision_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view decisions in their org"
  ON decision_records FOR SELECT TO authenticated
  USING (organisation_id IN (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert decisions in their org"
  ON decision_records FOR INSERT TO authenticated
  WITH CHECK (organisation_id IN (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update decisions in their org"
  ON decision_records FOR UPDATE TO authenticated
  USING (organisation_id IN (SELECT organisation_id FROM profiles WHERE id = auth.uid()));

-- ---------------------------------------------------------------------------
-- ALTER existing prove tables: add system/policy linkage
-- ---------------------------------------------------------------------------

ALTER TABLE prove_approvals
  ADD COLUMN IF NOT EXISTS system_id uuid REFERENCES systems(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS policy_version_id uuid REFERENCES policy_versions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_prove_approvals_system ON prove_approvals(system_id);

ALTER TABLE prove_provenance
  ADD COLUMN IF NOT EXISTS system_id uuid REFERENCES systems(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_prove_provenance_system ON prove_provenance(system_id);
```

**Step 2: Apply migration via Supabase MCP**

Use `apply_migration` with project_id `ktwrztposaiyllhadqys`, name `026_happ_decision_attribution`.

**Step 3: Commit**

```bash
git add supabase/migrations/026_happ_decision_attribution.sql
git commit -m "feat: migration 026 — HAPP decision attribution tables"
```

---

## Task 2: Validation Schemas

**Files:**
- Modify: `src/lib/validations.ts`

**Step 1: Add HAPP schemas after the Model Registry schemas section**

```typescript
// --- HAPP Decision Attribution schemas ---

export const createPolicyVersionSchema = z.object({
  policy_id: z.string().uuid("Invalid policy ID"),
  title: z.string().min(1, "title is required").max(500),
  content_snapshot: z.record(z.string(), z.unknown()),
  effective_from: z.string().max(50).optional(),
  effective_until: z.string().max(50).optional(),
});

export const createAiOutputSchema = z.object({
  system_id: z.string().uuid("Invalid system ID"),
  model_id: z.string().uuid().optional(),
  output_summary: z.string().min(1, "output_summary is required").max(5000),
  output_hash: z.string().max(200).optional(),
  output_type: z.enum(["recommendation", "classification", "generated_text", "action_request", "score", "other"]).optional(),
  confidence_score: z.number().min(0).max(1).optional(),
  risk_signal: z.enum(["low", "medium", "high", "critical"]).optional(),
  occurred_at: z.string().min(1, "occurred_at is required"),
});

export const createDecisionRecordSchema = z.object({
  ai_output_id: z.string().uuid("Invalid output ID"),
  policy_version_id: z.string().uuid("Invalid policy version ID"),
  review_mode: z.enum(["required", "optional", "auto_approved"]),
  human_decision: z.enum(["approved", "rejected", "escalated", "modified"]),
  human_rationale: z.string().max(5000).optional(),
});

export const createDecisionWithOutputSchema = z.object({
  system_id: z.string().uuid("Invalid system ID"),
  model_id: z.string().uuid().optional(),
  output_summary: z.string().min(1, "output_summary is required").max(5000),
  output_hash: z.string().max(200).optional(),
  output_type: z.enum(["recommendation", "classification", "generated_text", "action_request", "score", "other"]).optional(),
  confidence_score: z.number().min(0).max(1).optional(),
  risk_signal: z.enum(["low", "medium", "high", "critical"]).optional(),
  occurred_at: z.string().min(1, "occurred_at is required"),
  policy_version_id: z.string().uuid("Invalid policy version ID"),
  review_mode: z.enum(["required", "optional", "auto_approved"]),
  human_decision: z.enum(["approved", "rejected", "escalated", "modified"]),
  human_rationale: z.string().max(5000).optional(),
});
```

**Step 2: Commit**

```bash
git add src/lib/validations.ts
git commit -m "feat: Zod schemas for HAPP decision attribution"
```

---

## Task 3: Policy Versions API

**Files:**
- Create: `src/app/api/happ/policy-versions/route.ts`
- Create: `src/app/api/happ/policy-versions/[versionId]/route.ts`

**Step 1: Create list + publish route**

`src/app/api/happ/policy-versions/route.ts`:

- GET: List policy versions for org. Filter by `policy_id`, `status`. Paginated.
- POST: Publish new version. Auto-increment `version` per `policy_id` (query max version, +1). Compute `policy_hash` via `hashPayload(content_snapshot)`. Set `published_at = now()`, `published_by = userId`. Mark previous active version for same `policy_id` as `superseded` with `superseded_by` pointing to new record. Validate `policy_id` belongs to org.

Pattern: Follow `src/app/api/prove/provenance/route.ts` — `requireTier("Verify")`, `supabaseServer()`, `writeAuditLog()`.

**Step 2: Create detail + update route**

`src/app/api/happ/policy-versions/[versionId]/route.ts`:

- GET: Single version with policy name join.
- PATCH: Only allow edits if `status = 'draft'`. Allow `title`, `content_snapshot`, `effective_from`, `effective_until` updates on draft. Allow lifecycle transitions: `active → superseded`, `active → retired`, `draft → active` (triggers publish). If status transitions to `active`, set `published_at`, compute `policy_hash`, supersede previous.

**Step 3: Commit**

```bash
git add src/app/api/happ/policy-versions/
git commit -m "feat: HAPP policy versions API — list, publish, detail, lifecycle"
```

---

## Task 4: AI Outputs API

**Files:**
- Create: `src/app/api/happ/outputs/route.ts`

**Step 1: Create list + record route**

- GET: List outputs for org. Filter by `system_id`, `source_type`, `date_from`/`date_to` (on `occurred_at`). Paginated. Join `systems(name)` for display.
- POST: Record output. Validate `system_id` belongs to org. If `model_id` provided, validate it belongs to org. If `output_hash` not provided, compute via `hashPayload({ output_summary, occurred_at })`. Set `source_type = 'manual'`, `created_by = userId`. Write audit log.

Pattern: Same as Task 3 — `requireTier("Verify")`, Zod validation with `createAiOutputSchema`.

**Step 2: Commit**

```bash
git add src/app/api/happ/outputs/
git commit -m "feat: HAPP AI outputs API — list and record"
```

---

## Task 5: Decision Records API — Core CRUD

**Files:**
- Create: `src/app/api/happ/decisions/route.ts`
- Create: `src/app/api/happ/decisions/[decisionId]/route.ts`

**Step 1: Create list + record route**

`src/app/api/happ/decisions/route.ts`:

- GET: List decisions for org. Filter by `system_id`, `reviewer_id` (maps to `human_reviewer_id`), `decision_status`, `human_decision`, `policy_version_id`, `date_from`/`date_to` (on `reviewed_at`). Paginated. Join `systems(name)`, `profiles(full_name)` for reviewer, `policy_versions(title, version)`.
- POST: Accepts body. Determine mode:
  - If body has `ai_output_id` → validate with `createDecisionRecordSchema`, fetch existing output, verify org match
  - Else → validate with `createDecisionWithOutputSchema`, create `ai_output` row first (same logic as Task 4 POST), use returned `id` as `ai_output_id`
  - Then create `decision_record`: derive `system_id` from output, set `human_reviewer_id = userId`, `created_by = userId`, `source_type = 'manual'`, `decision_status = 'review_completed'`, `reviewed_at = now()`. Generate `verification_id` via `generateVerificationId({ type: "decision", org, system_id, output_id, policy_version_id, reviewer: userId, reviewed_at })`. Do NOT chain-anchor on create (separate route). Set `chain_status = 'pending'`.
  - Validate `policy_version_id` belongs to org and has status `active`.
  - Validate org consistency across all referenced objects.
  - Write audit log with entity_type `"decision"`.
  - Return created decision record.

**Step 2: Create detail + update route**

`src/app/api/happ/decisions/[decisionId]/route.ts`:

- GET: Full chain join. Query decision_records joined with:
  - `ai_outputs(*)` for output details
  - `policy_versions(title, version, policy_hash, status)` for policy
  - `systems(name)` for system
  - `model_registry(model_name, model_version, provider)` via ai_outputs.model_id
  - `profiles(full_name, email)` for reviewer (human_reviewer_id)
  - `prove_approvals(title, status)` if approval_id set
  - `prove_provenance(title, verification_id)` if provenance_id set
  - Chain status block: verification_id, event_hash, chain_tx_hash, chain_status, anchored_at
  - Validate belongs to user's org.
- PATCH: Only allow updates if `chain_status != 'anchored'`. Allow: `decision_status`, `human_decision`, `human_rationale`, `approval_id`, `provenance_id`. Set `reviewed_at = now()` if `human_decision` changes. Write audit log.

**Step 3: Commit**

```bash
git add src/app/api/happ/decisions/
git commit -m "feat: HAPP decisions API — list, create (inline + existing output), detail, update"
```

---

## Task 6: Decision Anchoring API

**Files:**
- Create: `src/app/api/happ/decisions/[decisionId]/anchor/route.ts`

**Step 1: Create anchor route**

POST `/api/happ/decisions/[decisionId]/anchor`:

1. `requireTier("Verify")`, fetch decision record, validate org.
2. If `chain_status = 'anchored'`, return existing anchor details (idempotent): `{ event_hash, chain_tx_hash, chain_status, anchored_at }`.
3. Fetch linked `ai_outputs` row (for `output_hash`) and `policy_versions` row (for `policy_hash`).
4. Build canonical hash payload:
   ```typescript
   const payload = {
     decision_id: decision.id,
     organisation_id: decision.organisation_id,
     system_id: decision.system_id,
     ai_output_id: decision.ai_output_id,
     output_hash: output.output_hash,
     policy_version_id: decision.policy_version_id,
     policy_hash: policyVersion.policy_hash,
     human_reviewer_id: decision.human_reviewer_id,
     review_mode: decision.review_mode,
     human_decision: decision.human_decision,
     human_rationale_hash: decision.human_rationale ? hashPayload({ text: decision.human_rationale }) : null,
     reviewed_at: decision.reviewed_at,
     created_at: decision.created_at,
   };
   ```
5. `const eventHash = hashPayload(payload);`
6. `const chainResult = await anchorOnChain(eventHash);`
7. Update decision record: `event_hash`, `chain_tx_hash = chainResult.txHash`, `chain_status = chainResult.status`, `anchored_at = now()` if status is `anchored`.
8. Update `decision_status` to `anchored` if chain succeeded, `failed` if chain failed.
9. Write audit log with actionType `"anchored"`.
10. Return `{ event_hash, chain_tx_hash, chain_status, anchored_at }`.

**Step 2: Commit**

```bash
git add "src/app/api/happ/decisions/[decisionId]/anchor/"
git commit -m "feat: HAPP decision chain anchoring — idempotent with canonical hash"
```

---

## Task 7: System Decisions API

**Files:**
- Create: `src/app/api/happ/systems/[systemId]/decisions/route.ts`

**Step 1: Create system-scoped decisions list**

GET: Paginated decisions for a specific system. Validate system belongs to user's org (join `systems → profiles → organisation_id`). Join same fields as decisions list (reviewer name, policy version, output summary). Filter params: `decision_status`, `human_decision`, `date_from`, `date_to`.

This is used by the Risk Registry detail panel's "Decisions" tab.

**Step 2: Commit**

```bash
git add "src/app/api/happ/systems/[systemId]/decisions/"
git commit -m "feat: HAPP system-scoped decisions endpoint for risk registry"
```

---

## Task 8: Decision Ledger UI — `/prove/decisions`

**Files:**
- Create: `src/app/prove/decisions/page.tsx`

**Step 1: Build the Decision Ledger page**

Follow `src/app/govern/models/page.tsx` pattern:

- `"use client"`, imports: `useState`, `useEffect`, `useCallback`, `useMemo`, `DetailPanel`, `TierGate`, `PageHeader`
- `TierGate requiredTier="Verify"` wrapper
- PageHeader: title "Decision Ledger", subtitle "Human-reviewed AI decisions under policy"
- State: decisions list, loading, error, filters (system, status, decision, date range), pagination, selected decision for detail panel
- Fetch from `/api/happ/decisions` with filter params
- Summary stats row: Total, Pending, Approved, Rejected, Anchored (computed from fetched data or separate counts)
- Filter bar: system dropdown (fetch from `/api/risk-registry` for system list), decision_status, human_decision
- Table columns: System | Output Summary | Reviewer | Decision | Policy | Status | Reviewed
- Click row → DetailPanel with 2 tabs:
  - **Decision tab**: output summary, output type badge, confidence score, risk signal, human decision badge (green approved / red rejected / amber escalated / blue modified), rationale, policy version (title + vN), review mode
  - **Chain tab**: verification_id (monospace), event_hash, chain status badge (green anchored / amber pending / red failed), chain_tx_hash if present, anchored_at, "Anchor" button if status is pending (calls POST `/api/happ/decisions/[id]/anchor`)
- "Record Decision" button → inline form or expand panel:
  1. System select (dropdown)
  2. Model select (optional, filtered by system's linked models via `/api/model-registry?system_id=X`)
  3. Output details: summary (textarea), type (select), confidence (number 0-1), risk signal (select)
  4. Policy version select (dropdown, fetch active versions via `/api/happ/policy-versions?status=active`)
  5. Review mode (radio: required / optional)
  6. Decision (radio: approved / rejected / escalated / modified)
  7. Rationale (optional textarea)
  8. Submit → POST `/api/happ/decisions` with inline output fields

**Step 2: Commit**

```bash
git add src/app/prove/decisions/
git commit -m "feat: Decision Ledger UI — list, detail, record decision form"
```

---

## Task 9: Navigation + Path Matching

**Files:**
- Modify: `src/lib/navigation.ts`
- Modify: `src/components/AuthenticatedShell.tsx`

**Step 1: Add Decisions nav item**

In `src/lib/navigation.ts`, add to the `prove` section items array (after Provenance, before Incident Lock):

```typescript
{ label: "Decisions", href: "/prove/decisions", icon: "file-text", exists: true },
```

Note: Use `file-text` icon (already exists in NavIcon) rather than `file-check` (would need new icon). The text icon is appropriate for decision records.

**Step 2: Verify path matching**

In `src/components/AuthenticatedShell.tsx`, the existing `if (pathname.startsWith("/prove")) return pathname;` already handles `/prove/decisions` correctly. No change needed.

**Step 3: Commit**

```bash
git add src/lib/navigation.ts
git commit -m "feat: add Decisions nav item to PROVE section"
```

---

## Task 10: Risk Registry — Decisions Tab

**Files:**
- Modify: `src/app/govern/registry/page.tsx`

**Step 1: Add decision state and tab**

Add type for decisions list item. Add `decisions` state array, reset on system select, add "Decisions" tab button alongside existing Compliance/Evidence/Models, fetch from `/api/happ/systems/[systemId]/decisions` in the `Promise.allSettled` block.

Decision tab content: list of recent decisions showing output summary (truncated), reviewer name, human_decision badge (colour-coded), policy version reference, reviewed_at date. If empty, show "No decisions recorded" with link to `/prove/decisions`.

**Step 2: Commit**

```bash
git add src/app/govern/registry/page.tsx
git commit -m "feat: Decisions tab in Risk Registry detail panel"
```

---

## Task 11: Build Verification

**Step 1: Run build**

```bash
npm run build
```

Expected: Clean pass, no TypeScript errors.

**Step 2: Fix any issues**

If build fails, fix TypeScript errors, missing imports, or type mismatches.

**Step 3: Commit fixes if needed**

---

## Task 12: Apply Migration

**Step 1: Apply via Supabase MCP**

Use `apply_migration` tool with:
- project_id: `ktwrztposaiyllhadqys`
- name: `026_happ_decision_attribution`
- query: contents of `supabase/migrations/026_happ_decision_attribution.sql`

**Step 2: Verify tables exist**

Use `execute_sql` to run: `SELECT table_name FROM information_schema.tables WHERE table_name IN ('policy_versions', 'ai_outputs', 'decision_records');`

---

## Task 13: Final Push

**Step 1: Push to main**

```bash
git push origin main
```

---

## Verification Checklist

1. `npm run build` passes clean
2. Migration 026 applied to Supabase
3. POST `/api/happ/policy-versions` — creates version with auto-increment and hash
4. POST `/api/happ/decisions` (inline) — creates output + decision atomically
5. GET `/api/happ/decisions/[id]` — returns full chain join
6. POST `/api/happ/decisions/[id]/anchor` — hashes and anchors, idempotent on retry
7. UI at `/prove/decisions` — list, create, detail panel with chain tab
8. "Decisions" nav item appears in PROVE sidebar section
9. Risk Registry detail panel shows Decisions tab
10. Existing prove pages unaffected (backward-compatible FK additions)
