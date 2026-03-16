# HAPP Decision Attribution — Design Document

> **Status:** Approved
> **Date:** 2026-03-16
> **Approach:** #2 — Full Schema (decision_records + policy_versions + ai_outputs), manual recording first, webhook ingest later

## Context

EU AI Act Articles 12 and 14 require organisations to prove human oversight of AI decisions under governing policy. Verisum's existing prove infrastructure (attestations, provenance, approvals, incident locks) captures governance artifacts but lacks the central linkage: **which human reviewed which AI output under which policy at what time.**

This feature adds HAPP Decision Attribution — the canonical decision record that connects system → model → AI output → human reviewer → policy version → timestamp into an attestable, chain-anchorable audit trail.

## Architecture: Three-Layer Decision Lifecycle

| Layer | Purpose | Table | Maps to |
|-------|---------|-------|---------|
| System Approval | Deployment governance | `prove_approvals` (enhanced) | AI Act conformity |
| Decision Attribution | Human oversight of outputs | `decision_records` + `ai_outputs` | Article 14 compliance |
| Continuous Audit | Operational traceability | `audit_logs` + chain anchoring | Article 12 record-keeping |

The canonical chain: `system → model → ai_output → decision_record → policy_version → human_reviewer`

## Section 1: Database Schema

### New Table: `policy_versions`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organisation_id | uuid FK organisations | |
| policy_id | uuid FK ai_policies | Links to existing copilot-generated policies |
| version | integer | Auto-incremented per policy_id |
| title | text NOT NULL | |
| policy_hash | text | SHA-256 of content_snapshot at publish time |
| content_snapshot | jsonb | Immutable copy of policy content — published = frozen |
| status | text | draft, active, superseded, retired |
| effective_from | timestamptz | |
| effective_until | timestamptz | |
| published_by | uuid FK profiles | |
| published_at | timestamptz | Distinct from effective_from |
| superseded_by | uuid FK policy_versions nullable | Points to replacement version |
| created_at | timestamptz | |
| updated_at | timestamptz | Auto-trigger |
| UNIQUE | (policy_id, version) | |

**Indexes:** organisation_id, (policy_id, status), effective_from

**Immutability rule:** Once status = active (published), content_snapshot and policy_hash are immutable. Only lifecycle transitions (supersede, retire) are allowed.

### New Table: `ai_outputs`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organisation_id | uuid FK organisations | |
| system_id | uuid FK systems | |
| system_run_id | uuid FK system_runs nullable | |
| model_id | uuid FK model_registry nullable | |
| source_type | text NOT NULL | manual, api |
| external_event_id | text nullable | For webhook ingest later |
| input_hash | text nullable | SHA-256 of input data |
| output_hash | text NOT NULL | SHA-256 of output content |
| output_summary | text NOT NULL | Human-readable description |
| output_type | text nullable | recommendation, classification, generated_text, action_request, score, other |
| raw_output_ref | text nullable | External payload storage reference |
| confidence_score | numeric nullable | 0-1 scale |
| risk_signal | text nullable | low, medium, high, critical |
| occurred_at | timestamptz NOT NULL | When AI produced the output |
| created_by | uuid FK profiles nullable | Null for API-ingested |
| created_at | timestamptz | |

**Indexes:** (system_id, occurred_at DESC), organisation_id

### New Table: `decision_records`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organisation_id | uuid FK organisations | |
| system_id | uuid FK systems | Denormalized for query convenience |
| system_run_id | uuid FK system_runs nullable | Denormalized |
| ai_output_id | uuid FK ai_outputs NOT NULL | |
| policy_version_id | uuid FK policy_versions NOT NULL | |
| human_reviewer_id | uuid FK profiles nullable | Nullable for future API-created pending records |
| approval_id | uuid FK prove_approvals nullable | Optional link to deployment approval |
| provenance_id | uuid FK prove_provenance nullable | Optional link to provenance record |
| source_type | text NOT NULL | manual, api |
| review_mode | text NOT NULL | required, optional, auto_approved |
| decision_status | text NOT NULL | Workflow state: pending_review, in_review, review_completed, anchoring_pending, anchored, failed |
| human_decision | text nullable | Reviewer outcome: approved, rejected, escalated, modified |
| human_rationale | text nullable | |
| reviewed_at | timestamptz nullable | Null until review completed |
| created_by | uuid FK profiles nullable | May differ from reviewer |
| verification_id | text UNIQUE | VER-XXXXXXXX format |
| event_hash | text nullable | SHA-256 of canonical decision payload |
| chain_tx_hash | text nullable | |
| chain_status | text | pending, anchored, failed, skipped |
| anchored_at | timestamptz nullable | |
| created_at | timestamptz | |

**Indexes:** (system_id, reviewed_at DESC), (human_reviewer_id), (decision_status), organisation_id

**Status semantics:**
- `decision_status` = process/workflow state (where is this record in its lifecycle?)
- `human_decision` = reviewer outcome (what did the human decide?)

### Existing Table Modifications

**`prove_approvals`:** Add `system_id uuid FK systems`, `policy_version_id uuid FK policy_versions`

**`prove_provenance`:** Add `system_id uuid FK systems` (already has `model_id` from migration 025)

All new FKs are nullable — existing records are backward-compatible.

### Organisation Consistency

All three new tables carry `organisation_id`. The service layer must enforce cross-table org consistency: decision_records.organisation_id must match linked ai_outputs, systems, policy_versions, approvals, and provenance records.

## Section 2: API Routes & Validation

### Zod Schemas (`src/lib/validations.ts`)

**`createPolicyVersionSchema`**: policy_id (uuid), title (string), content_snapshot (record), effective_from (optional), effective_until (optional)

**`createAiOutputSchema`**: system_id (uuid), model_id (uuid optional), output_summary (string), output_hash (optional — auto-computed if not provided), output_type (optional), confidence_score (optional), risk_signal (optional), occurred_at (string)

**`createDecisionRecordSchema`**: ai_output_id (uuid), policy_version_id (uuid), review_mode (enum), human_decision (enum), human_rationale (optional)

**`createDecisionWithOutputSchema`**: Discriminated union — inline output fields + decision fields in one submission. Server creates ai_output then decision_record atomically.

POST `/api/happ/decisions` validates exactly one of: existing `ai_output_id` OR inline output payload. Not both, not neither.

### API Routes

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/happ/policy-versions` | GET, POST | List (filter: policy_id, status, effective_on), publish new version |
| `/api/happ/policy-versions/[versionId]` | GET, PATCH | Detail, update draft / retire. Published versions are content-immutable. |
| `/api/happ/outputs` | GET, POST | List AI outputs (filter: system_id, source_type, date range), record output |
| `/api/happ/decisions` | GET, POST | List decisions (filter: system_id, reviewer, status, decision, date range), record decision |
| `/api/happ/decisions/[decisionId]` | GET, PATCH | Full-chain detail (joins output + policy + system + model + reviewer), update pre-anchor status |
| `/api/happ/decisions/[decisionId]/anchor` | POST | Hash canonical payload, chain-anchor, idempotent (skip if already anchored, retry on failed) |
| `/api/happ/systems/[systemId]/decisions` | GET | Decisions for a system, paginated — used by risk registry detail panel |

**All routes:** `requireTier("Verify")` + `writeAuditLog()`

### Key Behaviors

**POST `/api/happ/decisions` (inline):**
- Server derives `human_reviewer_id` and `created_by` from authenticated session
- Creates `ai_output` row first, then `decision_record` pointing to it
- Sets `decision_status = review_completed`, `reviewed_at = now()`, `source_type = manual`
- Generates `verification_id` via `generateVerificationId()`

**POST `/api/happ/policy-versions`:**
- Auto-computes `policy_hash` via `hashPayload(content_snapshot)`
- Auto-increments `version` per `policy_id` (transaction-safe)
- Sets `published_at = now()`
- Marks previous active version as `superseded` with `superseded_by` FK

**POST `/api/happ/decisions/[id]/anchor`:**
- Canonical hash payload includes: decision_id, organisation_id, system_id, ai_output_id, output_hash, policy_version_id, policy_hash, human_reviewer_id, review_mode, human_decision, human_rationale hash, reviewed_at, created_at
- If chain_status = anchored: return existing anchor details (idempotent)
- If chain_status = failed: allow retry with audit entry
- Calls `anchorOnChain()` from existing chain utilities

**PATCH mutability rules:**
- Policy versions: draft edits allowed, published content is immutable
- Decision records: editable before anchoring, immutable after anchoring

**GET `/api/happ/decisions/[id]`:**
Returns joined: decision + output + policy version + system + model + reviewer profile + approval/provenance references + chain status block

## Section 3: UI & Navigation

### New Page: `/prove/decisions` — Decision Ledger

- `TierGate requiredTier="Verify"`
- PageHeader: "Decision Ledger" / "Human-reviewed AI decisions under policy"
- Summary stats: Total Decisions, Pending Review, Approved, Rejected, Anchored
- Filters: system, reviewer, decision_status, human_decision, date range
- Table: System | Output Summary | Reviewer | Decision | Policy Version | Status | Reviewed At
- Click row → DetailPanel with 2 tabs:
  - **Decision**: output summary, confidence, risk signal, human decision, rationale, policy version, review mode
  - **Chain**: verification_id, event_hash, chain anchor status/tx, linked approval/provenance

**"Record Decision" form** (inline/modal):
1. Select system → 2. Select model (optional) → 3. AI output details (summary, type, confidence, risk) → 4. Select policy version → 5. Review mode → 6. Human decision + rationale → 7. Submit

### New Page: `/prove/policy-versions` — Policy Version History

- List versions grouped by policy (version number, status, effective dates, published by/at)
- "Publish Version" button: select policy, auto-snapshot, increment
- Detail panel: content snapshot, hash, effective period

### Navigation

Add to `prove` section in `navigation.ts`:
```
{ label: "Decisions", href: "/prove/decisions", icon: "file-check", exists: true }
```

No separate nav for policy versions — accessible from decisions page or policies page.

### Risk Registry Integration

Add "Decisions" tab to detail panel in `src/app/govern/registry/page.tsx` alongside Compliance, Evidence, Models. Fetches from `/api/happ/systems/[systemId]/decisions`.

### Existing Pages

No modifications needed. FK additions to prove tables are backward-compatible (nullable).

## Deferred (Approach 3 follow-ups)

- Auto-create `prove_provenance` records when decisions are recorded
- PDF decision attestation certificates
- Visual "Decision Trace" component (full chain visualization)
- Webhook/API ingest path for continuous audit (enterprise tier)
