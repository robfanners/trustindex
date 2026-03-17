# HAPP API Ingest & Assurance Grading — Design Document

**Date:** 2026-03-17
**Author:** Rob Fanshawe + Claude
**Status:** Approved

---

## Goal

Enable external systems to push AI decision records into Verisum via API key authentication, with a protocol-aligned assurance grading model that measures the strength of human-to-action binding. This is the foundation for HAPP's multi-vertical commercial model — enterprise governance teams use the UI, while pharma pipelines, ecommerce platforms, and MLOps systems push via API. Same product, different entry points.

## Strategic Context

Verisum is the governance cockpit (UI-first, enterprise CISOs). HAPP is the protocol (API-first, any system). The API ingest bridges them — any system can push attestations in, and Verisum provides the management layer: assurance grading, review queues, compliance reports, chain anchoring.

This enables the land-and-expand motion: a pharma company lands on domain AI provenance (API ingest) and expands to enterprise AI governance (UI), or vice versa. Same org, same tier, same invoice.

---

## 1. API Key Model

### Table: `api_keys`

| Column | Type | Purpose |
|---|---|---|
| id | uuid PK | |
| organisation_id | uuid FK → organisations | Scoped to org |
| created_by | uuid FK → profiles | Who generated it |
| name | text | Human label ("Production Pipeline") |
| key_hash | text UNIQUE | SHA-256 of the actual key |
| key_prefix | text | First 8 chars for display ("vsk_a1b2...") |
| scopes | text[] | `['decisions:write', 'outputs:write', 'decisions:read', 'keys:read']` |
| status | text | `active` / `revoked` / `expired` |
| tier_at_creation | text | Org tier snapshot |
| last_used_at | timestamptz | Activity tracking |
| expires_at | timestamptz | Optional expiry |
| revoked_at | timestamptz | |
| created_at | timestamptz | |

**Key format:** `vsk_` + 40 random chars. Shown once on creation, stored as SHA-256 hash only.

**Tier gating:**

| Tier | API Keys |
|---|---|
| Explorer / Starter | 0 (not available) |
| Pro | 3 keys |
| Enterprise | Unlimited |

### Scopes

| Scope | Allows |
|---|---|
| `outputs:write` | POST to /outputs |
| `decisions:write` | POST to /decisions, POST to /anchor |
| `decisions:read` | GET on /decisions |
| `keys:read` | GET on /api-keys |

Default new key: `['outputs:write', 'decisions:write', 'decisions:read']`.

---

## 2. Assurance Grading Model

Aligned to the HAPP white paper's PoH layer architecture and Issuer Quality Variance concept. The grade measures the strength of human-to-action binding across two dimensions.

### Dimension 1: Identity Assurance Level (IAL)

| Level | Method | Examples |
|---|---|---|
| IAL-1 | Basic digital identity | OAuth, email/password, social login |
| IAL-2 | Strong authentication | Passkeys, hardware MFA, corporate SSO with MFA |
| IAL-3 | Verified identity / PoH | Government ID, biometric, BrightID, Worldcoin, regulated KYC |

### Dimension 2: Action Binding (AB)

| Level | Method | Examples |
|---|---|---|
| AB-1 | System-asserted | "Our system says user X did this" |
| AB-2 | Session-bound | Authenticated session, timestamped, audit logged |
| AB-3 | Cryptographically bound | Signed intent, per-action credential, on-chain provenance |

### Grade Matrix (minimum of both dimensions)

| | AB-1 | AB-2 | AB-3 |
|---|---|---|---|
| IAL-1 | Bronze | Bronze | Bronze |
| IAL-2 | Bronze | Silver | Silver |
| IAL-3 | Bronze | Silver | Gold |

### Computation

```typescript
function computeAssuranceGrade(input: {
  source_type: 'manual' | 'api';
  review_mode: 'required' | 'optional' | 'auto_approved';
  identity_assurance_level?: 'ial_1' | 'ial_2' | 'ial_3';
  action_binding_level?: 'ab_1' | 'ab_2' | 'ab_3';
  external_reviewer_email?: string;
  external_reviewed_at?: string;
}): 'gold' | 'silver' | 'bronze' {
  // UI-created decisions: IAL-2 (Supabase Auth) × AB-2 (session) = Silver
  if (input.source_type === 'manual') return 'silver';

  // Auto-approved: always Bronze regardless of identity
  if (input.review_mode === 'auto_approved') return 'bronze';

  // API with explicit IAL/AB levels
  const ial = input.identity_assurance_level;
  const ab = input.action_binding_level;

  if (ial && ab) {
    const ialNum = parseInt(ial.split('_')[1]);
    const abNum = parseInt(ab.split('_')[1]);
    const min = Math.min(ialNum, abNum);
    if (min >= 3) return 'gold';
    if (min >= 2) return 'silver';
    return 'bronze';
  }

  // API with reviewer evidence but no explicit levels: infer Silver
  if (input.external_reviewer_email && input.external_reviewed_at) return 'silver';

  // No evidence: Bronze
  return 'bronze';
}
```

**Grade is immutable once set.** Cannot be upgraded — create a new decision record with proper evidence instead.

### Oversight Mode

Stored per decision, independent of assurance grade:

| Mode | Definition |
|---|---|
| `in_the_loop` | Human reviews and approves before the AI output is acted on |
| `on_the_loop` | AI acts autonomously, human monitors and can intervene |

---

## 3. API Authentication

### Middleware: `authenticateApiKey()`

```
Request: Authorization: Bearer vsk_a1b2c3d4...
  → SHA-256 hash the key
  → Look up key_hash in api_keys
  → Check status = 'active', not expired
  → Resolve organisation_id
  → Check org tier ≥ required tier
  → Check required scope ∈ key scopes
  → Update last_used_at
  → Return { organisationId, apiKeyId, scopes }
```

### Dual-auth pattern

Existing HAPP routes accept EITHER session auth OR API key auth. No separate endpoints.

```typescript
// Pseudo-pattern for route handlers
const auth = await resolveAuth(req); // tries session first, then API key
if (!auth) return 401;
// auth.type = 'session' | 'api_key'
// auth.organisationId, auth.userId (null for API key), auth.apiKeyId (null for session)
```

---

## 4. API Ingest Request Shape

### POST `/api/happ/decisions` (API key auth)

```json
{
  "system_id": "uuid",
  "policy_version_id": "uuid",
  "oversight_mode": "in_the_loop | on_the_loop",

  "output": {
    "output_summary": "Model recommended dose adjustment for Cohort B",
    "output_type": "recommendation",
    "output_hash": "optional",
    "confidence_score": 0.87,
    "risk_signal": "medium",
    "occurred_at": "2026-03-17T14:30:00Z",
    "model_id": "uuid (optional)",
    "external_event_id": "trial-247-run-891 (optional)"
  },

  "context": {
    "input_summary": "Patient Cohort B, n=340, Phase 2 trial data",
    "full_output_ref": "https://internal-mlops.pfizer.com/runs/891/output",
    "supporting_evidence": [
      { "label": "Model card", "url": "https://..." },
      { "label": "Input dataset", "url": "s3://..." }
    ],
    "notes": "Flagged potential interaction with compound X"
  },

  "review": {
    "review_mode": "required | optional | auto_approved",
    "human_decision": "approved | rejected | escalated | modified (optional)",
    "human_rationale": "optional"
  },

  "identity_assurance": {
    "level": "ial_1 | ial_2 | ial_3",
    "method": "oauth | passkey | corporate_sso_mfa | govt_id | poh_brightid | poh_worldcoin",
    "reviewer_email": "dr.smith@pfizer.com",
    "reviewer_name": "Dr. Sarah Smith",
    "reviewer_external_id": "optional"
  },

  "action_binding": {
    "level": "ab_1 | ab_2 | ab_3",
    "method": "system_asserted | authenticated_session | signed_intent",
    "reviewed_at": "2026-03-17T14:32:00Z",
    "session_id": "optional",
    "signature": "optional"
  }
}
```

### Response

```json
{
  "id": "uuid",
  "verification_id": "vrf_abc123...",
  "assurance_grade": "silver",
  "decision_status": "review_completed | pending_review",
  "chain_status": "pending",
  "oversight_mode": "in_the_loop",
  "created_at": "2026-03-17T14:32:01Z"
}
```

### Behaviour Matrix

| Scenario | decision_status | assurance_grade |
|---|---|---|
| API + human_decision + reviewer evidence | review_completed | Silver or Gold |
| API + human_decision + no reviewer evidence | review_completed | Bronze |
| API + auto_approved | review_completed | Bronze |
| API + no human_decision (review queue) | pending_review | Computed on review |
| UI + logged-in user | review_completed | Silver |

---

## 5. Review Queue

When API-ingested decisions arrive without `human_decision`, they land as `pending_review` in the Decision Ledger.

### Priority banner

Shown at the top of the Decision Ledger when pending reviews exist:
- Count of pending decisions, broken down by risk signal
- One-click "Review now" to filter to queue

### Review flow

1. Reviewer clicks pending decision in Decision Ledger
2. Detail panel shows: AI output summary, context (links, notes, input summary), policy version
3. Reviewer records: decision (approve/reject/escalate/modify), rationale
4. On submit: `human_reviewer_id` = logged-in user, `decision_status` = `review_completed`, `reviewed_at` = now, assurance grade computed (output via API + review via Verisum = Silver)

### New filters

- Source type: Manual / API
- Assurance grade: Gold / Silver / Bronze
- Oversight mode: In-the-loop / On-the-loop
- Preset: "Pending Review"

### New table columns

- **Source** — badge: Manual / API
- **Grade** — badge: Gold / Silver / Bronze (colour-coded)

---

## 6. API Key Management UI

### Location

New "Developer" section in the sidebar navigation. Scales to future SDK docs, webhooks, usage metrics.

### Page: API Keys

- List of org's API keys: name, prefix, scope count, last used, status
- "Generate New Key" button → modal with name + scope selection
- Key shown once in copy-to-clipboard box on creation
- Click row → detail panel: edit name/scopes, revoke, delete (revoked only)

### Tier gating

API key management page gated to Pro+ tier. Explorer/Starter users see an upgrade prompt.

---

## 7. Schema Changes

### New table: `api_keys`

As described in Section 1.

### New columns on `decision_records`

| Column | Type |
|---|---|
| oversight_mode | text CHECK (in_the_loop, on_the_loop) |
| assurance_grade | text CHECK (gold, silver, bronze) |
| api_key_id | uuid FK → api_keys |
| external_reviewer_email | text |
| external_reviewer_name | text |
| external_reviewed_at | timestamptz |
| identity_assurance_level | text CHECK (ial_1, ial_2, ial_3) |
| identity_assurance_method | text |
| action_binding_level | text CHECK (ab_1, ab_2, ab_3) |
| action_binding_method | text |

### New columns on `ai_outputs`

| Column | Type |
|---|---|
| api_key_id | uuid FK → api_keys |
| context | jsonb |

### Backfill

- Existing decision_records: `oversight_mode = 'in_the_loop'`, `assurance_grade = 'silver'`
- Existing ai_outputs: `context = null`, `api_key_id = null`
- All new columns nullable, non-destructive

---

## 8. Endpoints Summary

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| /api/happ/api-keys | GET | Session | List org's keys |
| /api/happ/api-keys | POST | Session | Generate new key |
| /api/happ/api-keys/[keyId] | PATCH | Session | Revoke, rename, update scopes |
| /api/happ/api-keys/[keyId] | DELETE | Session | Delete (revoked only) |
| /api/happ/decisions | POST | Session OR API key | Create decision (extended) |
| /api/happ/outputs | POST | Session OR API key | Record output (extended) |
| /api/happ/decisions | GET | Session OR API key | List decisions (extended) |
| /api/happ/decisions/[id] | GET | Session OR API key | Decision detail |
| /api/happ/decisions/[id]/anchor | POST | Session OR API key | Chain anchor |

---

## 9. Forward Compatibility

| Future Feature | How This Design Supports It |
|---|---|
| TrustSys scoring integration | `assurance_grade` per decision → new scoring dimension "Human Oversight Evidence" |
| TrustOrg identity dimension | IAL levels stored → future "Workforce Identity Assurance" dimension |
| MCP server | Same API key infrastructure, different transport |
| PoH credential verification | IAL-3 claims stored with method → future on-chain verification of BrightID/Worldcoin credentials |
| Rate limiting | `api_keys` schema supports adding rate_limit_per_minute column |
| Webhook configuration | Developer nav section scales to webhook management |
| Non-GitHub connectors | API ingest is connector-agnostic — any system can push |

---

## 10. Non-Goals (This Sprint)

- MCP server (future, uses same key infra)
- Rate limiting (schema-ready, not implemented)
- On-chain verification of IAL-3 claims (trust the caller for now)
- TrustSys/TrustOrg scoring integration (schema-ready)
- Per-action cryptographic signing in Verisum UI (would upgrade UI from Silver to Gold)
- SDK packages (npm/pip — future, API-first for now)
