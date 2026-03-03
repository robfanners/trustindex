# Phase 7: Verify Build (HAPP Integration) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Prove section — four functional pages (Approvals, Attestations, Provenance, Verification) backed by real database tables and API routes, with optional on-chain anchoring via the HAPP Protocol.

**Architecture:** New Supabase migration (017) creates prove_* tables. Each Prove page follows the established Monitor pattern (TierGate wrapper, fetch from API, table with filters/pagination). A chain client library (ported from HAPP) provides optional keccak256 hashing and Base L2 anchoring behind env vars. All Prove API routes enforce `requireTier("Verify")`.

**Tech Stack:** Next.js App Router, React 19, Supabase (Postgres), ethers.js v6 (optional chain anchoring), Tailwind CSS 4

**Key references:**
- Monitor page pattern: `src/app/monitor/drift/page.tsx`, `src/app/monitor/escalations/page.tsx`
- API route pattern: `src/app/api/trustgraph/drift/route.ts` (uses `requireTier()`)
- Tier gate: `src/components/TierGate.tsx` (client), `src/lib/requireTier.ts` (server)
- HAPP chain client: `~/happ/happ/business-app/lib/chain/client.ts`
- HAPP registry ABI: `~/happ/happ/business-app/lib/chain/config.ts`
- Navigation config: `src/lib/navigation.ts`
- Current highest migration: `016_copilot_ux_improvements.sql`

---

## Task 1: Database Migration — Prove Schema

**Files:**
- Create: `supabase/migrations/017_prove_schema.sql`

Create the following tables, all org-scoped with RLS enabled:

### `prove_approvals`
Approval requests that require human sign-off before a high-risk AI action proceeds.

```sql
CREATE TABLE prove_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  risk_level text NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  requested_by uuid REFERENCES profiles(id),
  assigned_to uuid REFERENCES profiles(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  decision_note text,
  decided_at timestamptz,
  decided_by uuid REFERENCES profiles(id),
  -- Chain anchoring (populated after approval is signed)
  event_hash text,
  chain_tx_hash text,
  chain_status text DEFAULT 'pending' CHECK (chain_status IN ('pending', 'anchored', 'failed', 'skipped')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### `prove_attestations`
Signed governance attestation statements — exportable, verifiable.

```sql
CREATE TABLE prove_attestations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  title text NOT NULL,
  statement text NOT NULL,
  -- Snapshot of posture data at attestation time
  posture_snapshot jsonb,
  attested_by uuid NOT NULL REFERENCES profiles(id),
  attested_at timestamptz NOT NULL DEFAULT now(),
  -- Verification
  verification_id text UNIQUE,  -- short public ID for external lookup
  event_hash text,
  chain_tx_hash text,
  chain_status text DEFAULT 'pending' CHECK (chain_status IN ('pending', 'anchored', 'failed', 'skipped')),
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### `prove_provenance`
Chain-of-custody records for AI outputs — binds model, data, reviewer.

```sql
CREATE TABLE prove_provenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  title text NOT NULL,
  -- What is being certified
  ai_system text,
  model_version text,
  output_description text,
  data_sources text[],
  -- Human review
  reviewed_by uuid REFERENCES profiles(id),
  reviewed_at timestamptz,
  review_note text,
  -- Verification
  verification_id text UNIQUE,
  event_hash text,
  chain_tx_hash text,
  chain_status text DEFAULT 'pending' CHECK (chain_status IN ('pending', 'anchored', 'failed', 'skipped')),
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Also add:
- RLS policies: `ENABLE ROW LEVEL SECURITY` on each table, org-scoped SELECT/INSERT/UPDATE policies using `auth.uid()` → `profiles.organisation_id` join pattern (match existing migration 006 style).
- Indexes on `organisation_id` and `created_at` for each table.
- `updated_at` trigger on `prove_approvals` (reuse pattern from existing migrations).

**Step 1:** Write the migration file with all three tables, RLS, and indexes.

**Step 2:** Verify the SQL is syntactically valid (read it back, check for typos).

**Step 3:** Commit:
```bash
git add supabase/migrations/017_prove_schema.sql
git commit -m "feat: add prove schema migration (approvals, attestations, provenance)"
```

---

## Task 2: Chain Client Library

Port the chain hashing utility from HAPP into the Verisum codebase. Chain anchoring is **optional** — if `CHAIN_RPC_URL` is not set, all chain operations return `skipped` status.

**Files:**
- Create: `src/lib/prove/chain.ts`

**Implementation:**

```typescript
// src/lib/prove/chain.ts
//
// Optional chain anchoring for Prove features.
// If CHAIN_RPC_URL is not configured, all operations are no-ops returning "skipped".

import { createHash } from "crypto";

/** Whether chain anchoring is enabled (env vars present) */
export function isChainEnabled(): boolean {
  return !!(process.env.CHAIN_RPC_URL && process.env.HAPP_REGISTRY_ADDRESS && process.env.CHAIN_RELAYER_PRIVATE_KEY);
}

/**
 * Deterministic hash of a payload object.
 * Uses keccak256 via ethers.js if available, falls back to sha256.
 * Keys are sorted for determinism.
 */
export function hashPayload(data: Record<string, unknown>): string {
  const json = JSON.stringify(data, Object.keys(data).sort());
  return "0x" + createHash("sha256").update(json).digest("hex");
}

/**
 * Generate a short verification ID for external lookups.
 * Format: VER-XXXXXXXX (8 hex chars from hash)
 */
export function generateVerificationId(data: Record<string, unknown>): string {
  const hash = hashPayload(data);
  return "VER-" + hash.slice(2, 10).toUpperCase();
}

/**
 * Anchor an event hash on-chain. Returns tx hash or null if chain not enabled.
 * This is a server-only function.
 */
export async function anchorOnChain(
  eventHash: string
): Promise<{ txHash: string | null; status: "anchored" | "failed" | "skipped" }> {
  if (!isChainEnabled()) {
    return { txHash: null, status: "skipped" };
  }

  try {
    // Dynamic import ethers only when chain is enabled
    const { ethers } = await import("ethers");
    const provider = new ethers.JsonRpcProvider(process.env.CHAIN_RPC_URL);
    const signer = new ethers.Wallet(process.env.CHAIN_RELAYER_PRIVATE_KEY!, provider);

    // Minimal ABI for registerEvent
    const abi = [
      "function registerEvent(bytes32 eventHash, uint8 verificationType, bytes32 verificationRef) external",
    ];
    const registry = new ethers.Contract(process.env.HAPP_REGISTRY_ADDRESS!, abi, signer);

    const tx = await registry.registerEvent(
      eventHash,
      0, // UNVERIFIED type for now
      ethers.ZeroHash // no verification ref
    );
    const receipt = await tx.wait();
    return { txHash: receipt.hash, status: "anchored" };
  } catch (error) {
    console.error("[prove/chain] Anchor failed:", error);
    return { txHash: null, status: "failed" };
  }
}
```

**Step 1:** Create the file with the implementation above.

**Step 2:** Commit:
```bash
git add src/lib/prove/chain.ts
git commit -m "feat: add chain client library for prove anchoring"
```

---

## Task 3: Approvals API + Page

Build the Approval Inbox — the flagship Verify feature.

**Files:**
- Create: `src/app/api/prove/approvals/route.ts`
- Modify: `src/app/prove/approvals/page.tsx`

### API Route (`src/app/api/prove/approvals/route.ts`)

**GET** — List approvals for the org, with filters:
- Query params: `status` (pending/approved/rejected/expired), `risk_level`, `page`, `per_page`
- Uses `requireTier("Verify")`
- Returns `{ approvals: [...], total: number }`

**POST** — Create a new approval request:
- Body: `{ title, description, risk_level, assigned_to? }`
- Sets `requested_by` from auth user
- Returns the created approval

**PATCH** — Decide on an approval (approve/reject):
- Body: `{ approval_id, decision: "approved"|"rejected", decision_note? }`
- Sets `decided_by`, `decided_at`
- Computes `event_hash` via `hashPayload()`
- Optionally anchors on-chain via `anchorOnChain()`
- Returns the updated approval

Pattern: Follow `src/app/api/trustgraph/escalations/route.ts` for structure.

### Page (`src/app/prove/approvals/page.tsx`)

Replace TierPlaceholder with a full client component. Follow drift/escalations pattern:

1. `"use client"` + TierGate wrapper with `requiredTier="Verify"` and `featureLabel="Approval Inbox"`
2. State: `approvals[]`, `total`, `loading`, `status` filter, `riskLevel` filter, `page`
3. Header with icon (reuse existing SVG from placeholder) + "Approval Inbox" + subtitle
4. Filter row: status dropdown (All/Pending/Approved/Rejected), risk level dropdown
5. Table: Date, Title, Risk Level (badge), Status (badge), Decided By, Actions
   - Pending rows show "Approve" and "Reject" buttons
   - Clicking opens a simple inline form for decision note, then PATCHes
6. Pagination

Status badge colors:
- pending: `bg-amber-100 text-amber-800`
- approved: `bg-green-100 text-green-800`
- rejected: `bg-red-100 text-red-800`
- expired: `bg-gray-100 text-gray-800`

Risk level badge colors:
- low: `bg-blue-100 text-blue-800`
- medium: `bg-amber-100 text-amber-800`
- high: `bg-red-100 text-red-800`
- critical: `bg-red-200 text-red-900`

**Step 1:** Create the API route file.
**Step 2:** Replace the placeholder page with the full implementation.
**Step 3:** Commit:
```bash
git add src/app/api/prove/approvals/route.ts src/app/prove/approvals/page.tsx
git commit -m "feat: add approvals API and inbox page (Verify tier)"
```

---

## Task 4: Attestations API + Page

**Files:**
- Create: `src/app/api/prove/attestations/route.ts`
- Modify: `src/app/prove/attestations/page.tsx`

### API Route

**GET** — List attestations for the org:
- Query params: `page`, `per_page`
- Returns `{ attestations: [...], total: number }`

**POST** — Create a new attestation:
- Body: `{ title, statement, posture_snapshot? }`
- Sets `attested_by` from auth user, `attested_at` to now()
- Generates `verification_id` via `generateVerificationId()`
- Computes `event_hash` via `hashPayload()`
- Optionally anchors on-chain
- Returns the created attestation with verification_id

### Page

Replace TierPlaceholder. Pattern:

1. TierGate wrapper, `requiredTier="Verify"`, `featureLabel="Attestations"`
2. Table: Date, Title, Attested By, Verification ID, Chain Status
3. "New Attestation" button opens inline form: title, statement textarea
4. Each row shows the verification ID as a copyable badge
5. Chain status badge: anchored (green), pending (amber), skipped (gray), failed (red)

**Step 1:** Create the API route.
**Step 2:** Replace the placeholder page.
**Step 3:** Commit:
```bash
git add src/app/api/prove/attestations/route.ts src/app/prove/attestations/page.tsx
git commit -m "feat: add attestations API and page (Verify tier)"
```

---

## Task 5: Provenance API + Page

**Files:**
- Create: `src/app/api/prove/provenance/route.ts`
- Modify: `src/app/prove/provenance/page.tsx`

### API Route

**GET** — List provenance records:
- Query params: `page`, `per_page`
- Returns `{ records: [...], total: number }`

**POST** — Create a provenance certificate:
- Body: `{ title, ai_system, model_version?, output_description, data_sources?, review_note? }`
- Sets `reviewed_by` from auth user, `reviewed_at` to now()
- Generates `verification_id` and `event_hash`
- Optionally anchors on-chain
- Returns the created record

### Page

Replace TierPlaceholder. Pattern:

1. TierGate wrapper, `requiredTier="Verify"`, `featureLabel="Provenance Certificates"`
2. Table: Date, Title, AI System, Model Version, Verification ID, Chain Status
3. "New Certificate" button opens inline form: title, AI system, model version, output description, data sources (comma-separated), review note
4. Verification ID and chain status badges (same colors as attestations)

**Step 1:** Create the API route.
**Step 2:** Replace the placeholder page.
**Step 3:** Commit:
```bash
git add src/app/api/prove/provenance/route.ts src/app/prove/provenance/page.tsx
git commit -m "feat: add provenance API and page (Verify tier)"
```

---

## Task 6: Verification Page (Internal Lookup)

**Files:**
- Modify: `src/app/prove/verification/page.tsx`
- Create: `src/app/api/prove/verify/route.ts`

### API Route

**GET** — Look up a proof by verification ID:
- Query param: `id` (e.g., "VER-A1B2C3D4")
- Searches both `prove_attestations` and `prove_provenance` tables by `verification_id`
- Returns the record with type ("attestation" or "provenance"), org name, chain status, timestamps
- **Does NOT require tier check** — this is a lookup endpoint (but does require auth)

### Page

Replace TierPlaceholder with a verification lookup UI:

1. TierGate wrapper, `requiredTier="Verify"`, `featureLabel="Verification Portal"`
2. Header with search icon + "Verification Portal" + subtitle
3. Search input: "Enter verification ID (e.g., VER-A1B2C3D4)"
4. On search, call API and display result card:
   - Type badge (Attestation / Provenance)
   - Title, organisation
   - Created/attested date
   - Chain status with visual indicator
   - Event hash (truncated, copyable)
5. Not found state: "No proof found for this verification ID"

This is the **internal** verification page. Phase 8 will build the public portal at `verify.verisum.org`.

**Step 1:** Create the API route.
**Step 2:** Replace the placeholder page.
**Step 3:** Commit:
```bash
git add src/app/api/prove/verify/route.ts src/app/prove/verification/page.tsx
git commit -m "feat: add verification lookup API and page (Verify tier)"
```

---

## Task 7: Navigation Update + Build Verification

**Files:**
- Modify: `src/lib/navigation.ts`

**Step 1:** Change all 4 Prove nav items from `exists: false` to `exists: true`:
```typescript
{ label: "Approvals", href: "/prove/approvals", icon: "shield-check", exists: true },
{ label: "Attestations", href: "/prove/attestations", icon: "stamp", exists: true },
{ label: "Provenance", href: "/prove/provenance", icon: "link", exists: true },
{ label: "Verification", href: "/prove/verification", icon: "search", exists: true },
```

**Step 2:** Run `npx tsc --noEmit` — must pass clean.

**Step 3:** Run `npm run build` — must pass clean.

**Step 4:** Commit:
```bash
git add src/lib/navigation.ts
git commit -m "feat: mark prove pages as live in navigation"
```

---

## Environment Variables (for reference, not a task)

The following env vars enable optional chain anchoring. Without them, all prove features work normally but chain_status will be "skipped":

```
CHAIN_RPC_URL=https://mainnet.base.org        # or testnet: https://sepolia.base.org
HAPP_REGISTRY_ADDRESS=0x...                     # deployed HAPPRegistry proxy address
CHAIN_RELAYER_PRIVATE_KEY=0x...                  # relayer wallet private key
```
