# Competitive Differentiators Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the 4 highest-priority capabilities that differentiate Verisum from OneTrust — trust attestations, risk registry, scoring trends, and GitHub evidence engine.

**Architecture:** Each priority is a self-contained workstream touching database schema, API routes, and UI components. P1-P2 are mostly schema + API work. P3 adds time-series charts. P4 introduces a new integration pattern following the existing HiBob model.

**Tech Stack:** Next.js App Router, Supabase (Postgres + RLS), TypeScript, Zod validation, Recharts, jsPDF, Octokit (GitHub API)

---

## Priority 1: Trust Attestations Polish

**Current state:** `prove_attestations` table exists with chain anchoring, verification IDs, and a public verify endpoint. Missing: branded certificate PDF, expiry/validity, revocation.

---

### Task 1.1: Add expiry and revocation columns to prove_attestations

**Files:**
- Create: `supabase/migrations/023_attestation_expiry_revocation.sql`

**Step 1: Write the migration**

```sql
-- 023_attestation_expiry_revocation.sql

-- Add expiry and revocation support to attestations
ALTER TABLE prove_attestations
  ADD COLUMN valid_until timestamptz,
  ADD COLUMN revoked_at timestamptz,
  ADD COLUMN revoked_by uuid REFERENCES profiles(id),
  ADD COLUMN revocation_reason text;

-- Index for filtering active attestations
CREATE INDEX idx_prove_attestations_active
  ON prove_attestations (organisation_id)
  WHERE revoked_at IS NULL;

-- Add validity period to incident locks too
ALTER TABLE prove_incident_locks
  ADD COLUMN valid_until timestamptz,
  ADD COLUMN revoked_at timestamptz,
  ADD COLUMN revoked_by uuid REFERENCES profiles(id),
  ADD COLUMN revocation_reason text;
```

**Step 2: Apply the migration**

Run: `npx supabase db push` or apply via Supabase dashboard.

**Step 3: Commit**

```bash
git add supabase/migrations/023_attestation_expiry_revocation.sql
git commit -m "feat: add expiry and revocation columns to prove_attestations"
```

---

### Task 1.2: Update attestation creation to support validity period

**Files:**
- Modify: `src/lib/validations.ts` (lines 5-9)
- Modify: `src/app/api/prove/attestations/route.ts` (lines 30-97)

**Step 1: Update the Zod validation schema**

In `src/lib/validations.ts`, update `createAttestationSchema`:

```typescript
export const createAttestationSchema = z.object({
  title: z.string().min(1).max(500),
  statement: z.string().min(1).max(5000),
  posture_snapshot: z.record(z.unknown()).optional(),
  valid_days: z.number().int().min(1).max(365).optional(), // validity period in days
});
```

**Step 2: Update POST handler to compute valid_until**

In `src/app/api/prove/attestations/route.ts`, in the POST handler, after parsing the body, compute the expiry:

```typescript
const valid_until = body.valid_days
  ? new Date(Date.now() + body.valid_days * 86400000).toISOString()
  : null;
```

Add `valid_until` to the insert payload alongside the existing fields.

**Step 3: Update GET handler to return validity/revocation status**

Add computed field `is_valid` to the response:

```typescript
const enriched = data.map((a: Record<string, unknown>) => ({
  ...a,
  is_valid: !a.revoked_at && (!a.valid_until || new Date(a.valid_until as string) > new Date()),
}));
```

**Step 4: Commit**

```bash
git add src/lib/validations.ts src/app/api/prove/attestations/route.ts
git commit -m "feat: attestation creation supports validity period"
```

---

### Task 1.3: Add attestation revocation endpoint

**Files:**
- Create: `src/app/api/prove/attestations/[id]/revoke/route.ts`

**Step 1: Write the revocation endpoint**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOrgMembership } from "@/lib/requireOrgMembership";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

const revokeSchema = z.object({
  reason: z.string().min(1).max(2000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const check = await requireOrgMembership(user.id);
  if ("error" in check) return NextResponse.json(check, { status: 403 });

  const body = revokeSchema.parse(await req.json());
  const db = supabaseServer();

  // Verify attestation belongs to this org and isn't already revoked
  const { data: existing } = await db
    .from("prove_attestations")
    .select("id, revoked_at, verification_id")
    .eq("id", id)
    .eq("organisation_id", check.orgId)
    .single();

  if (!existing) return NextResponse.json({ error: "Attestation not found" }, { status: 404 });
  if (existing.revoked_at) return NextResponse.json({ error: "Already revoked" }, { status: 409 });

  const { data, error } = await db
    .from("prove_attestations")
    .update({
      revoked_at: new Date().toISOString(),
      revoked_by: user.id,
      revocation_reason: body.reason,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog({
    organisationId: check.orgId,
    entityType: "attestation",
    entityId: id,
    actionType: "revoked",
    performedBy: user.id,
    metadata: { verification_id: existing.verification_id, reason: body.reason },
  });

  return NextResponse.json({ data });
}
```

**Step 2: Commit**

```bash
git add src/app/api/prove/attestations/\[id\]/revoke/route.ts
git commit -m "feat: add attestation revocation endpoint"
```

---

### Task 1.4: Update verify endpoint to show validity and revocation status

**Files:**
- Modify: `src/app/api/prove/verify/route.ts`

**Step 1: Enrich verification response**

In the verify endpoint, after fetching the attestation, add validity fields to the response:

```typescript
const is_valid = !record.revoked_at
  && (!record.valid_until || new Date(record.valid_until) > new Date());

return NextResponse.json({
  ...record,
  is_valid,
  validity_status: record.revoked_at
    ? "revoked"
    : record.valid_until && new Date(record.valid_until) <= new Date()
      ? "expired"
      : "active",
});
```

**Step 2: Commit**

```bash
git add src/app/api/prove/verify/route.ts
git commit -m "feat: verify endpoint returns validity and revocation status"
```

---

### Task 1.5: Build branded Trust Certificate PDF export

**Files:**
- Create: `src/lib/prove/certificatePdf.ts`

**Step 1: Write the certificate generator**

This uses jsPDF directly (already a dependency) for a clean, branded certificate layout:

```typescript
import { jsPDF } from "jspdf";

type CertificateData = {
  title: string;
  statement: string;
  verificationId: string;
  orgName: string;
  attestedBy: string;
  attestedAt: string;
  validUntil: string | null;
  trustScore: number | null;
  chainTxHash: string | null;
  chainStatus: string;
};

export function generateTrustCertificate(data: CertificateData): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  // Border
  doc.setDrawColor(22, 163, 106); // Verisum green
  doc.setLineWidth(1.5);
  doc.rect(10, 10, w - 20, h - 20);
  doc.setLineWidth(0.5);
  doc.rect(13, 13, w - 26, h - 26);

  // Header
  doc.setFontSize(14);
  doc.setTextColor(100, 100, 100);
  doc.text("VERISUM", w / 2, 28, { align: "center" });

  doc.setFontSize(24);
  doc.setTextColor(30, 30, 30);
  doc.text("AI Governance Trust Certificate", w / 2, 42, { align: "center" });

  // Divider line
  doc.setDrawColor(22, 163, 106);
  doc.setLineWidth(0.8);
  doc.line(w / 2 - 40, 48, w / 2 + 40, 48);

  // Organisation
  doc.setFontSize(18);
  doc.setTextColor(30, 30, 30);
  doc.text(data.orgName, w / 2, 62, { align: "center" });

  // Title
  doc.setFontSize(13);
  doc.setTextColor(80, 80, 80);
  doc.text(data.title, w / 2, 72, { align: "center" });

  // Statement (wrapped)
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  const lines = doc.splitTextToSize(data.statement, w - 80);
  doc.text(lines, w / 2, 84, { align: "center", maxWidth: w - 80 });

  // Trust Score badge (if available)
  const metaY = 120;
  if (data.trustScore !== null) {
    doc.setFontSize(11);
    doc.setTextColor(22, 163, 106);
    doc.text(`Trust Score: ${data.trustScore}/100`, w / 2, metaY, { align: "center" });
  }

  // Metadata grid
  const gridY = metaY + 14;
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);

  const leftCol = w / 2 - 60;
  const rightCol = w / 2 + 10;

  doc.text("Verification ID:", leftCol, gridY);
  doc.setTextColor(30, 30, 30);
  doc.text(data.verificationId, leftCol, gridY + 5);

  doc.setTextColor(120, 120, 120);
  doc.text("Attested by:", rightCol, gridY);
  doc.setTextColor(30, 30, 30);
  doc.text(data.attestedBy, rightCol, gridY + 5);

  doc.setTextColor(120, 120, 120);
  doc.text("Date:", leftCol, gridY + 14);
  doc.setTextColor(30, 30, 30);
  doc.text(new Date(data.attestedAt).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric"
  }), leftCol, gridY + 19);

  if (data.validUntil) {
    doc.setTextColor(120, 120, 120);
    doc.text("Valid until:", rightCol, gridY + 14);
    doc.setTextColor(30, 30, 30);
    doc.text(new Date(data.validUntil).toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric"
    }), rightCol, gridY + 19);
  }

  // Chain anchoring status
  if (data.chainStatus === "anchored" && data.chainTxHash) {
    doc.setFontSize(8);
    doc.setTextColor(22, 163, 106);
    doc.text(`Blockchain anchored: ${data.chainTxHash.slice(0, 18)}...`, w / 2, gridY + 32, { align: "center" });
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Verify at app.verisum.org/verify/${data.verificationId}`,
    w / 2, h - 20, { align: "center" }
  );

  return doc;
}
```

**Step 2: Commit**

```bash
git add src/lib/prove/certificatePdf.ts
git commit -m "feat: branded Trust Certificate PDF generator"
```

---

### Task 1.6: Add certificate download API endpoint

**Files:**
- Create: `src/app/api/prove/attestations/[id]/certificate/route.ts`

**Step 1: Write the certificate endpoint**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOrgMembership } from "@/lib/requireOrgMembership";
import { generateTrustCertificate } from "@/lib/prove/certificatePdf";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const check = await requireOrgMembership(user.id);
  if ("error" in check) return NextResponse.json(check, { status: 403 });

  const db = supabaseServer();

  // Fetch attestation with org name and attester profile
  const { data: attestation, error } = await db
    .from("prove_attestations")
    .select("*, organisations(name), profiles!attested_by(full_name, email)")
    .eq("id", id)
    .eq("organisation_id", check.orgId)
    .single();

  if (error || !attestation) {
    return NextResponse.json({ error: "Attestation not found" }, { status: 404 });
  }

  if (attestation.revoked_at) {
    return NextResponse.json({ error: "Cannot generate certificate for revoked attestation" }, { status: 409 });
  }

  // Get latest health score for the org (optional enrichment)
  const { data: health } = await db
    .from("trustgraph_health_mv")
    .select("health_score")
    .eq("organisation_id", check.orgId)
    .single();

  const doc = generateTrustCertificate({
    title: attestation.title,
    statement: attestation.statement,
    verificationId: attestation.verification_id,
    orgName: attestation.organisations?.name ?? "Organisation",
    attestedBy: attestation.profiles?.full_name ?? attestation.profiles?.email ?? "Unknown",
    attestedAt: attestation.attested_at,
    validUntil: attestation.valid_until,
    trustScore: health?.health_score ?? null,
    chainTxHash: attestation.chain_tx_hash,
    chainStatus: attestation.chain_status,
  });

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="verisum-certificate-${attestation.verification_id}.pdf"`,
    },
  });
}
```

**Step 2: Commit**

```bash
git add src/app/api/prove/attestations/\[id\]/certificate/route.ts
git commit -m "feat: trust certificate PDF download endpoint"
```

---

## Priority 2: AI Risk Registry Completion

**Current state:** `systems`, `ai_vendors`, and `incidents` tables exist independently. Missing: cross-table foreign keys, risk taxonomy, compliance mapping, unified registry view.

---

### Task 2.1: Link systems to vendors and add risk taxonomy

**Files:**
- Create: `supabase/migrations/024_risk_registry_links.sql`

**Step 1: Write the migration**

```sql
-- 024_risk_registry_links.sql

-- Link systems to vendors (many systems can use one vendor)
ALTER TABLE systems
  ADD COLUMN ai_vendor_id uuid REFERENCES ai_vendors(id) ON DELETE SET NULL,
  ADD COLUMN risk_category text DEFAULT 'unassessed'
    CHECK (risk_category IN ('minimal', 'limited', 'high', 'unacceptable', 'unassessed')),
  ADD COLUMN owner_name text,
  ADD COLUMN owner_role text,
  ADD COLUMN compliance_tags text[] DEFAULT '{}';

CREATE INDEX idx_systems_vendor ON systems(ai_vendor_id);
CREATE INDEX idx_systems_risk ON systems(risk_category);

-- Link incidents to systems (which system caused the incident)
ALTER TABLE incidents
  ADD COLUMN system_id uuid REFERENCES systems(id) ON DELETE SET NULL;

CREATE INDEX idx_incidents_system ON incidents(system_id);

-- Compliance requirements reference table
CREATE TABLE compliance_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,                              -- e.g. 'EU_AI_ACT_ART6', 'GDPR_ART22'
  title text NOT NULL,
  description text,
  jurisdiction text NOT NULL,                      -- e.g. 'EU', 'UK', 'US'
  framework text NOT NULL,                         -- e.g. 'EU AI Act', 'GDPR', 'ISO 42001'
  risk_categories text[] DEFAULT '{}',             -- which risk categories it applies to
  created_at timestamptz DEFAULT now()
);

-- Map systems to compliance requirements
CREATE TABLE system_compliance_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id uuid NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  requirement_id uuid NOT NULL REFERENCES compliance_requirements(id) ON DELETE CASCADE,
  status text DEFAULT 'not_assessed'
    CHECK (status IN ('not_assessed', 'compliant', 'partially_compliant', 'non_compliant', 'not_applicable')),
  notes text,
  assessed_at timestamptz,
  assessed_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(system_id, requirement_id)
);

CREATE INDEX idx_system_compliance_system ON system_compliance_map(system_id);

-- Seed core EU AI Act requirements
INSERT INTO compliance_requirements (code, title, description, jurisdiction, framework, risk_categories) VALUES
  ('EU_AI_ACT_ART6', 'High-risk AI system classification', 'Systems must be classified by risk level per Annex III', 'EU', 'EU AI Act', '{"high","unacceptable"}'),
  ('EU_AI_ACT_ART9', 'Risk management system', 'Continuous risk management throughout AI system lifecycle', 'EU', 'EU AI Act', '{"high"}'),
  ('EU_AI_ACT_ART10', 'Data governance', 'Training, validation and testing data must meet quality criteria', 'EU', 'EU AI Act', '{"high"}'),
  ('EU_AI_ACT_ART11', 'Technical documentation', 'Documentation demonstrating compliance before placement on market', 'EU', 'EU AI Act', '{"high"}'),
  ('EU_AI_ACT_ART12', 'Record-keeping', 'Automatic logging of events during operation', 'EU', 'EU AI Act', '{"high"}'),
  ('EU_AI_ACT_ART13', 'Transparency', 'Sufficient transparency for deployers to interpret output', 'EU', 'EU AI Act', '{"high","limited"}'),
  ('EU_AI_ACT_ART14', 'Human oversight', 'Designed to allow effective human oversight during use', 'EU', 'EU AI Act', '{"high"}'),
  ('EU_AI_ACT_ART15', 'Accuracy, robustness and cybersecurity', 'Appropriate levels throughout lifecycle', 'EU', 'EU AI Act', '{"high"}'),
  ('EU_AI_ACT_ART50', 'Transparency for AI-generated content', 'Users must be informed when interacting with AI', 'EU', 'EU AI Act', '{"limited","high"}'),
  ('EU_AI_ACT_ART52', 'Registration in EU database', 'High-risk systems registered before market placement', 'EU', 'EU AI Act', '{"high"}'),
  ('GDPR_ART22', 'Automated decision-making', 'Right not to be subject to solely automated decisions with legal effects', 'EU', 'GDPR', '{"high"}'),
  ('GDPR_ART35', 'Data protection impact assessment', 'DPIA required for high-risk processing', 'EU', 'GDPR', '{"high"}'),
  ('ISO42001_4', 'Context of the organisation', 'Understanding org context for AI management system', 'International', 'ISO 42001', '{"minimal","limited","high"}'),
  ('ISO42001_6', 'Planning for AI management', 'Risk assessment and objectives for AI management', 'International', 'ISO 42001', '{"minimal","limited","high"}'),
  ('ISO42001_8', 'AI system lifecycle operation', 'Operational planning and control for AI systems', 'International', 'ISO 42001', '{"minimal","limited","high"}');

-- Enable RLS
ALTER TABLE compliance_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_compliance_map ENABLE ROW LEVEL SECURITY;

-- All authenticated can read compliance requirements (reference data)
CREATE POLICY "compliance_requirements_read" ON compliance_requirements
  FOR SELECT TO authenticated USING (true);

-- System compliance map: org-scoped via systems table
CREATE POLICY "system_compliance_map_org" ON system_compliance_map
  FOR ALL TO authenticated
  USING (
    system_id IN (
      SELECT s.id FROM systems s
      JOIN profiles p ON s.owner_id = p.id
      WHERE p.organisation_id = (
        SELECT organisation_id FROM profiles WHERE id = auth.uid()
      )
    )
  );
```

**Step 2: Apply migration**

**Step 3: Commit**

```bash
git add supabase/migrations/024_risk_registry_links.sql
git commit -m "feat: link systems/vendors/incidents + compliance requirements schema"
```

---

### Task 2.2: Create unified AI Risk Registry API endpoint

**Files:**
- Create: `src/app/api/risk-registry/route.ts`

**Step 1: Write the registry endpoint**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOrgMembership } from "@/lib/requireOrgMembership";

export async function GET(req: NextRequest) {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const check = await requireOrgMembership(user.id);
  if ("error" in check) return NextResponse.json(check, { status: 403 });

  const db = supabaseServer();

  // Get all systems with their latest scores, vendor info, and incident counts
  const { data: orgUsers } = await db
    .from("profiles")
    .select("id")
    .eq("organisation_id", check.orgId);

  const userIds = (orgUsers ?? []).map((u: { id: string }) => u.id);

  const { data: systems, error: sysErr } = await db
    .from("systems")
    .select(`
      id, name, version_label, type, environment,
      risk_category, owner_name, owner_role, compliance_tags,
      ai_vendor_id, ai_vendors(vendor_name, risk_category),
      created_at, archived
    `)
    .in("owner_id", userIds)
    .eq("archived", false)
    .order("created_at", { ascending: false });

  if (sysErr) return NextResponse.json({ error: sysErr.message }, { status: 500 });

  // Get latest scores for each system
  const systemIds = (systems ?? []).map((s: { id: string }) => s.id);
  const { data: latestRuns } = await db
    .from("trustsys_runs")
    .select("assessment_id, score, risk_flags, completed_at")
    .in("assessment_id", systemIds)
    .eq("status", "submitted")
    .order("completed_at", { ascending: false });

  // Deduplicate to latest run per system
  const latestBySystem = new Map<string, { score: number; risk_flags: string[]; completed_at: string }>();
  for (const run of latestRuns ?? []) {
    if (!latestBySystem.has(run.assessment_id)) {
      latestBySystem.set(run.assessment_id, run);
    }
  }

  // Get incident counts per system
  const { data: incidentCounts } = await db
    .from("incidents")
    .select("system_id, id")
    .in("system_id", systemIds)
    .in("status", ["open", "investigating"]);

  const incidentsBySystem = new Map<string, number>();
  for (const inc of incidentCounts ?? []) {
    if (inc.system_id) {
      incidentsBySystem.set(inc.system_id, (incidentsBySystem.get(inc.system_id) ?? 0) + 1);
    }
  }

  // Enrich systems
  const registry = (systems ?? []).map((sys: Record<string, unknown>) => {
    const latest = latestBySystem.get(sys.id as string);
    return {
      ...sys,
      trust_score: latest?.score ?? null,
      risk_flags: latest?.risk_flags ?? [],
      last_assessed: latest?.completed_at ?? null,
      open_incidents: incidentsBySystem.get(sys.id as string) ?? 0,
    };
  });

  return NextResponse.json({ data: registry });
}
```

**Step 2: Commit**

```bash
git add src/app/api/risk-registry/route.ts
git commit -m "feat: unified AI risk registry API endpoint"
```

---

### Task 2.3: Add compliance status endpoint for individual systems

**Files:**
- Create: `src/app/api/risk-registry/[systemId]/compliance/route.ts`

**Step 1: Write the compliance endpoint**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOrgMembership } from "@/lib/requireOrgMembership";
import { z } from "zod";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ systemId: string }> }
) {
  const { systemId } = await params;
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const check = await requireOrgMembership(user.id);
  if ("error" in check) return NextResponse.json(check, { status: 403 });

  const db = supabaseServer();

  // Get system's risk category to filter relevant requirements
  const { data: system } = await db
    .from("systems")
    .select("id, risk_category")
    .eq("id", systemId)
    .single();

  if (!system) return NextResponse.json({ error: "System not found" }, { status: 404 });

  // Get all requirements relevant to this risk category
  const { data: requirements } = await db
    .from("compliance_requirements")
    .select("*")
    .contains("risk_categories", [system.risk_category]);

  // Get existing compliance mappings
  const { data: mappings } = await db
    .from("system_compliance_map")
    .select("*")
    .eq("system_id", systemId);

  const mappingByReq = new Map(
    (mappings ?? []).map((m: Record<string, unknown>) => [m.requirement_id, m])
  );

  // Combine: all relevant requirements with their compliance status
  const compliance = (requirements ?? []).map((req: Record<string, unknown>) => ({
    ...req,
    compliance_status: mappingByReq.get(req.id)
      ?? { status: "not_assessed", notes: null, assessed_at: null },
  }));

  return NextResponse.json({ data: compliance });
}

const updateComplianceSchema = z.object({
  requirement_id: z.string().uuid(),
  status: z.enum(["not_assessed", "compliant", "partially_compliant", "non_compliant", "not_applicable"]),
  notes: z.string().max(2000).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ systemId: string }> }
) {
  const { systemId } = await params;
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const check = await requireOrgMembership(user.id);
  if ("error" in check) return NextResponse.json(check, { status: 403 });

  const body = updateComplianceSchema.parse(await req.json());
  const db = supabaseServer();

  const { data, error } = await db
    .from("system_compliance_map")
    .upsert({
      system_id: systemId,
      requirement_id: body.requirement_id,
      status: body.status,
      notes: body.notes ?? null,
      assessed_at: new Date().toISOString(),
      assessed_by: user.id,
    }, { onConflict: "system_id,requirement_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}
```

**Step 2: Commit**

```bash
git add src/app/api/risk-registry/\[systemId\]/compliance/route.ts
git commit -m "feat: system compliance status endpoint with EU AI Act requirements"
```

---

### Task 2.4: Update systems and incidents endpoints to support new fields

**Files:**
- Modify: `src/app/api/trustsys/assessments/route.ts` (POST handler)
- Modify: `src/app/api/incidents/route.ts` (POST handler)

**Step 1: Update system creation to accept new fields**

In `src/app/api/trustsys/assessments/route.ts` POST handler, add support for:

```typescript
// In the insert payload, add:
ai_vendor_id: body.aiVendorId ?? null,
risk_category: body.riskCategory ?? "unassessed",
owner_name: body.ownerName ?? null,
owner_role: body.ownerRole ?? null,
compliance_tags: body.complianceTags ?? [],
```

**Step 2: Update incident creation to accept system_id**

In `src/app/api/incidents/route.ts` POST handler, add:

```typescript
// In the insert payload, add:
system_id: body.systemId ?? null,
```

**Step 3: Commit**

```bash
git add src/app/api/trustsys/assessments/route.ts src/app/api/incidents/route.ts
git commit -m "feat: systems accept vendor/risk/compliance fields, incidents accept system_id"
```

---

## Priority 3: Trust Scoring Trends

**Current state:** Scores are computed per run. `trustsys_runs` and `trustorg_runs` store historical data. `drift_events` tracks score changes. Missing: time-series API and chart component.

---

### Task 3.1: Create score history API endpoint

**Files:**
- Create: `src/app/api/trustgraph/trends/route.ts`

**Step 1: Write the trends endpoint**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOrgMembership } from "@/lib/requireOrgMembership";

export async function GET(req: NextRequest) {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const check = await requireOrgMembership(user.id);
  if ("error" in check) return NextResponse.json(check, { status: 403 });

  const db = supabaseServer();
  const { searchParams } = new URL(req.url);
  const days = Math.min(parseInt(searchParams.get("days") ?? "90"), 365);
  const since = new Date(Date.now() - days * 86400000).toISOString();

  // Get org users
  const { data: orgUsers } = await db
    .from("profiles")
    .select("id")
    .eq("organisation_id", check.orgId);

  const userIds = (orgUsers ?? []).map((u: { id: string }) => u.id);

  // TrustOrg score history
  const { data: orgRuns } = await db
    .from("trustorg_runs")
    .select("id, score, dimension_scores, completed_at, stability_status")
    .in("created_by", userIds)
    .eq("status", "submitted")
    .gte("completed_at", since)
    .order("completed_at", { ascending: true });

  // TrustSys score history (all systems)
  const { data: sysRuns } = await db
    .from("trustsys_runs")
    .select("id, assessment_id, score, dimension_scores, risk_flags, completed_at, stability_status, systems(name)")
    .eq("status", "submitted")
    .gte("completed_at", since)
    .order("completed_at", { ascending: true });

  // Filter to org systems
  const { data: orgSystems } = await db
    .from("systems")
    .select("id, name")
    .in("owner_id", userIds);

  const orgSystemIds = new Set((orgSystems ?? []).map((s: { id: string }) => s.id));
  const filteredSysRuns = (sysRuns ?? []).filter(
    (r: { assessment_id: string }) => orgSystemIds.has(r.assessment_id)
  );

  // Health score history from drift events (proxy for health over time)
  const { data: driftEvents } = await db
    .from("drift_events")
    .select("id, run_type, delta_score, dimension_id, drift_flag, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  // Compute composite timeline points
  // Each point: date, org_score, avg_sys_score, health_estimate
  const timeline: Array<{
    date: string;
    org_score: number | null;
    sys_scores: Record<string, number>;
    avg_sys_score: number | null;
    drift_events_count: number;
  }> = [];

  // Group by week for cleaner charts
  const weekMap = new Map<string, {
    org_score: number | null;
    sys_scores: Map<string, number>;
    drift_count: number;
  }>();

  const toWeekKey = (dateStr: string) => {
    const d = new Date(dateStr);
    const start = new Date(d);
    start.setDate(d.getDate() - d.getDay());
    return start.toISOString().split("T")[0];
  };

  for (const run of orgRuns ?? []) {
    const week = toWeekKey(run.completed_at);
    const entry = weekMap.get(week) ?? { org_score: null, sys_scores: new Map(), drift_count: 0 };
    entry.org_score = run.score;
    weekMap.set(week, entry);
  }

  for (const run of filteredSysRuns) {
    const week = toWeekKey(run.completed_at);
    const entry = weekMap.get(week) ?? { org_score: null, sys_scores: new Map(), drift_count: 0 };
    const sysName = (run.systems as { name: string } | null)?.name ?? run.assessment_id;
    entry.sys_scores.set(sysName, run.score);
    weekMap.set(week, entry);
  }

  for (const event of driftEvents ?? []) {
    const week = toWeekKey(event.created_at);
    const entry = weekMap.get(week) ?? { org_score: null, sys_scores: new Map(), drift_count: 0 };
    entry.drift_count += 1;
    weekMap.set(week, entry);
  }

  // Build sorted timeline
  const sortedWeeks = [...weekMap.keys()].sort();
  let lastOrgScore: number | null = null;

  for (const week of sortedWeeks) {
    const entry = weekMap.get(week)!;
    if (entry.org_score !== null) lastOrgScore = entry.org_score;

    const sysScoreValues = [...entry.sys_scores.values()];
    const avgSys = sysScoreValues.length > 0
      ? Math.round(sysScoreValues.reduce((a, b) => a + b, 0) / sysScoreValues.length)
      : null;

    timeline.push({
      date: week,
      org_score: entry.org_score ?? lastOrgScore,
      sys_scores: Object.fromEntries(entry.sys_scores),
      avg_sys_score: avgSys,
      drift_events_count: entry.drift_count,
    });
  }

  return NextResponse.json({
    data: {
      timeline,
      org_runs: orgRuns ?? [],
      sys_runs: filteredSysRuns,
      drift_events: driftEvents ?? [],
      period_days: days,
    },
  });
}
```

**Step 2: Commit**

```bash
git add src/app/api/trustgraph/trends/route.ts
git commit -m "feat: trust scoring trends API with weekly time-series"
```

---

### Task 3.2: Build TrustTrends chart component

**Files:**
- Create: `src/components/trustgraph/TrustTrends.tsx`

**Step 1: Write the chart component**

```tsx
"use client";

import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";

type TimelinePoint = {
  date: string;
  org_score: number | null;
  avg_sys_score: number | null;
  drift_events_count: number;
};

type TrendsData = {
  timeline: TimelinePoint[];
  period_days: number;
};

export default function TrustTrends({ days = 90 }: { days?: number }) {
  const [data, setData] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/trustgraph/trends?days=${days}`)
      .then((r) => r.json())
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) {
    return (
      <div className="animate-pulse h-64 bg-muted/30 rounded-lg flex items-center justify-center text-muted-foreground text-sm">
        Loading trends...
      </div>
    );
  }

  if (!data || data.timeline.length === 0) {
    return (
      <div className="h-64 rounded-lg border border-dashed flex items-center justify-center text-muted-foreground text-sm">
        No score history yet. Complete assessments to see trends.
      </div>
    );
  }

  const chartData = data.timeline.map((point) => ({
    ...point,
    date: new Date(point.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
  }));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Trust Score Trends</h3>
        <span className="text-xs text-muted-foreground">Last {days} days</span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
              fontSize: "12px",
            }}
          />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          {/* Tier threshold lines */}
          <ReferenceLine y={80} stroke="#16a34a" strokeDasharray="3 3" strokeOpacity={0.5} />
          <ReferenceLine y={65} stroke="#2563eb" strokeDasharray="3 3" strokeOpacity={0.5} />
          <ReferenceLine y={50} stroke="#d97706" strokeDasharray="3 3" strokeOpacity={0.5} />
          <Line
            type="monotone"
            dataKey="org_score"
            name="Org Score"
            stroke="#2563eb"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="avg_sys_score"
            name="Avg System Score"
            stroke="#16a34a"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/trustgraph/TrustTrends.tsx
git commit -m "feat: TrustTrends chart component with tier reference lines"
```

---

### Task 3.3: Integrate TrustTrends into the dashboard

**Files:**
- Modify: `src/app/dashboard/page.tsx`

**Step 1: Import and add the component**

Add to the dashboard's Overview tab, below the existing health summary:

```tsx
import TrustTrends from "@/components/trustgraph/TrustTrends";
```

Place the `<TrustTrends />` component in the appropriate section of the Overview tab content, after the health score card section.

**Step 2: Verify it builds**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: add trust score trends chart to dashboard overview"
```

---

## Priority 4: Evidence Engine MVP (GitHub Integration)

**Current state:** HiBob integration exists as the only external connector. `integration_connections` table supports multiple providers. `runtime_signals` accepts webhook data. Missing: GitHub connector for automated evidence collection.

---

### Task 4.1: Install Octokit and create GitHub client library

**Files:**
- Create: `src/lib/github.ts`

**Step 1: Install Octokit**

Run: `npm install octokit`

**Step 2: Write the GitHub client**

```typescript
import { Octokit } from "octokit";

export type GitHubRepo = {
  owner: string;
  repo: string;
};

export type GitHubEvidence = {
  type: "security_scan" | "pr_review" | "ci_status" | "codeowners" | "dependabot";
  title: string;
  url: string;
  status: "pass" | "fail" | "warning" | "info";
  metadata: Record<string, unknown>;
  collected_at: string;
};

export function createGitHubClient(accessToken: string): Octokit {
  return new Octokit({ auth: accessToken });
}

export async function validateGitHubToken(token: string): Promise<boolean> {
  try {
    const client = createGitHubClient(token);
    await client.rest.users.getAuthenticated();
    return true;
  } catch {
    return false;
  }
}

/** Fetch recent merged PRs with review status */
export async function fetchPRReviews(
  client: Octokit,
  repo: GitHubRepo,
  since: string
): Promise<GitHubEvidence[]> {
  const { data: pulls } = await client.rest.pulls.list({
    ...repo,
    state: "closed",
    sort: "updated",
    direction: "desc",
    per_page: 50,
  });

  const recentPRs = pulls.filter(
    (pr) => pr.merged_at && new Date(pr.merged_at) >= new Date(since)
  );

  const evidence: GitHubEvidence[] = [];

  for (const pr of recentPRs) {
    const { data: reviews } = await client.rest.pulls.listReviews({
      ...repo,
      pull_number: pr.number,
    });

    const approved = reviews.some((r) => r.state === "APPROVED");
    const changesRequested = reviews.some((r) => r.state === "CHANGES_REQUESTED");

    evidence.push({
      type: "pr_review",
      title: `PR #${pr.number}: ${pr.title}`,
      url: pr.html_url,
      status: approved ? "pass" : changesRequested ? "warning" : "info",
      metadata: {
        number: pr.number,
        author: pr.user?.login,
        reviewers: reviews.map((r) => r.user?.login),
        approved,
        merged_at: pr.merged_at,
      },
      collected_at: new Date().toISOString(),
    });
  }

  return evidence;
}

/** Check CODEOWNERS file existence */
export async function fetchCodeowners(
  client: Octokit,
  repo: GitHubRepo
): Promise<GitHubEvidence | null> {
  const paths = [".github/CODEOWNERS", "CODEOWNERS", "docs/CODEOWNERS"];

  for (const path of paths) {
    try {
      const { data } = await client.rest.repos.getContent({ ...repo, path });
      if ("content" in data) {
        return {
          type: "codeowners",
          title: "CODEOWNERS file present",
          url: `https://github.com/${repo.owner}/${repo.repo}/blob/main/${path}`,
          status: "pass",
          metadata: { path, size: data.size },
          collected_at: new Date().toISOString(),
        };
      }
    } catch {
      continue;
    }
  }

  return {
    type: "codeowners",
    title: "No CODEOWNERS file found",
    url: `https://github.com/${repo.owner}/${repo.repo}`,
    status: "warning",
    metadata: { searched: paths },
    collected_at: new Date().toISOString(),
  };
}

/** Fetch Dependabot alerts (security vulnerabilities) */
export async function fetchDependabotAlerts(
  client: Octokit,
  repo: GitHubRepo
): Promise<GitHubEvidence[]> {
  try {
    const { data: alerts } = await client.rest.dependabot.listAlertsForRepo({
      ...repo,
      state: "open",
      per_page: 50,
    });

    return alerts.map((alert) => ({
      type: "dependabot" as const,
      title: `${alert.security_advisory.summary}`,
      url: alert.html_url,
      status: alert.security_advisory.severity === "critical" || alert.security_advisory.severity === "high"
        ? "fail" as const
        : "warning" as const,
      metadata: {
        severity: alert.security_advisory.severity,
        package: alert.dependency.package.name,
        ecosystem: alert.dependency.package.ecosystem,
        cve: alert.security_advisory.cve_id,
      },
      collected_at: new Date().toISOString(),
    }));
  } catch {
    // Dependabot may not be enabled
    return [];
  }
}

/** Fetch latest CI workflow runs */
export async function fetchCIStatus(
  client: Octokit,
  repo: GitHubRepo
): Promise<GitHubEvidence[]> {
  const { data: workflows } = await client.rest.actions.listRepoWorkflows({
    ...repo,
    per_page: 10,
  });

  const evidence: GitHubEvidence[] = [];

  for (const workflow of workflows.workflows.slice(0, 5)) {
    const { data: runs } = await client.rest.actions.listWorkflowRuns({
      ...repo,
      workflow_id: workflow.id,
      per_page: 1,
    });

    const latestRun = runs.workflow_runs[0];
    if (!latestRun) continue;

    evidence.push({
      type: "ci_status",
      title: `${workflow.name}: ${latestRun.conclusion ?? latestRun.status}`,
      url: latestRun.html_url,
      status: latestRun.conclusion === "success" ? "pass"
        : latestRun.conclusion === "failure" ? "fail"
        : "warning",
      metadata: {
        workflow_name: workflow.name,
        run_number: latestRun.run_number,
        conclusion: latestRun.conclusion,
        started_at: latestRun.run_started_at,
        head_sha: latestRun.head_sha?.slice(0, 8),
      },
      collected_at: new Date().toISOString(),
    });
  }

  return evidence;
}
```

**Step 3: Commit**

```bash
git add src/lib/github.ts package.json package-lock.json
git commit -m "feat: GitHub client library for evidence collection"
```

---

### Task 4.2: Create GitHub integration connect/disconnect endpoints

**Files:**
- Create: `src/app/api/integrations/github/connect/route.ts`
- Create: `src/app/api/integrations/github/status/route.ts`

**Step 1: Write the connect endpoint**

```typescript
// src/app/api/integrations/github/connect/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOrgMembership } from "@/lib/requireOrgMembership";
import { writeAuditLog } from "@/lib/audit";
import { validateGitHubToken } from "@/lib/github";
import { z } from "zod";

const connectSchema = z.object({
  token: z.string().min(1).max(500),
  repos: z.array(z.object({
    owner: z.string().min(1),
    repo: z.string().min(1),
  })).min(1).max(20),
});

export async function POST(req: NextRequest) {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const check = await requireOrgMembership(user.id);
  if ("error" in check) return NextResponse.json(check, { status: 403 });

  const body = connectSchema.parse(await req.json());

  // Validate the token works
  const valid = await validateGitHubToken(body.token);
  if (!valid) {
    return NextResponse.json({ error: "Invalid GitHub token" }, { status: 400 });
  }

  const db = supabaseServer();

  const { data, error } = await db
    .from("integration_connections")
    .upsert({
      organisation_id: check.orgId,
      provider: "github",
      status: "connected",
      access_token: body.token,
      sync_config: { repos: body.repos },
    }, { onConflict: "organisation_id,provider" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog({
    organisationId: check.orgId,
    entityType: "integration",
    entityId: data.id,
    actionType: "connected",
    performedBy: user.id,
    metadata: { provider: "github", repos: body.repos.length },
  });

  return NextResponse.json({ data: { status: "connected", repos: body.repos } });
}

// Disconnect
export async function DELETE(req: NextRequest) {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const check = await requireOrgMembership(user.id);
  if ("error" in check) return NextResponse.json(check, { status: 403 });

  const db = supabaseServer();

  await db
    .from("integration_connections")
    .update({ status: "disconnected", access_token: null })
    .eq("organisation_id", check.orgId)
    .eq("provider", "github");

  await writeAuditLog({
    organisationId: check.orgId,
    entityType: "integration",
    entityId: "github",
    actionType: "disconnected",
    performedBy: user.id,
    metadata: { provider: "github" },
  });

  return NextResponse.json({ data: { status: "disconnected" } });
}
```

**Step 2: Write the status endpoint**

```typescript
// src/app/api/integrations/github/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOrgMembership } from "@/lib/requireOrgMembership";

export async function GET(req: NextRequest) {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const check = await requireOrgMembership(user.id);
  if ("error" in check) return NextResponse.json(check, { status: 403 });

  const db = supabaseServer();

  const { data } = await db
    .from("integration_connections")
    .select("status, last_synced_at, sync_config")
    .eq("organisation_id", check.orgId)
    .eq("provider", "github")
    .single();

  return NextResponse.json({
    data: {
      connected: data?.status === "connected",
      last_synced_at: data?.last_synced_at ?? null,
      repos: (data?.sync_config as { repos?: unknown[] })?.repos ?? [],
    },
  });
}
```

**Step 3: Commit**

```bash
git add src/app/api/integrations/github/connect/route.ts src/app/api/integrations/github/status/route.ts
git commit -m "feat: GitHub integration connect/disconnect/status endpoints"
```

---

### Task 4.3: Create GitHub evidence sync endpoint

**Files:**
- Create: `src/app/api/integrations/github/sync/route.ts`

**Step 1: Write the sync endpoint**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOrgMembership } from "@/lib/requireOrgMembership";
import { writeAuditLog } from "@/lib/audit";
import {
  createGitHubClient,
  fetchPRReviews,
  fetchCodeowners,
  fetchDependabotAlerts,
  fetchCIStatus,
  GitHubEvidence,
  GitHubRepo,
} from "@/lib/github";

export async function POST(req: NextRequest) {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const check = await requireOrgMembership(user.id);
  if ("error" in check) return NextResponse.json(check, { status: 403 });

  const db = supabaseServer();

  // Get GitHub connection
  const { data: connection } = await db
    .from("integration_connections")
    .select("access_token, sync_config")
    .eq("organisation_id", check.orgId)
    .eq("provider", "github")
    .eq("status", "connected")
    .single();

  if (!connection?.access_token) {
    return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });
  }

  const client = createGitHubClient(connection.access_token);
  const repos = ((connection.sync_config as { repos?: GitHubRepo[] })?.repos) ?? [];
  const since = new Date(Date.now() - 30 * 86400000).toISOString(); // Last 30 days

  const allEvidence: GitHubEvidence[] = [];
  const errors: string[] = [];

  for (const repo of repos) {
    try {
      const [prReviews, codeowners, dependabot, ciStatus] = await Promise.all([
        fetchPRReviews(client, repo, since),
        fetchCodeowners(client, repo),
        fetchDependabotAlerts(client, repo),
        fetchCIStatus(client, repo),
      ]);

      allEvidence.push(...prReviews);
      if (codeowners) allEvidence.push(codeowners);
      allEvidence.push(...dependabot);
      allEvidence.push(...ciStatus);
    } catch (err) {
      errors.push(`${repo.owner}/${repo.repo}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  // Store as runtime signals for integration with existing monitoring
  const signals = allEvidence.map((ev) => ({
    organisation_id: check.orgId,
    system_name: `github`,
    signal_type: "compliance" as const,
    metric_name: ev.type,
    metric_value: ev.status === "pass" ? 1 : ev.status === "fail" ? 0 : 0.5,
    source: "integration" as const,
    severity: ev.status === "fail" ? "critical" as const : ev.status === "warning" ? "warning" as const : "info" as const,
    context: {
      evidence_type: ev.type,
      title: ev.title,
      url: ev.url,
      metadata: ev.metadata,
      collected_at: ev.collected_at,
    },
  }));

  if (signals.length > 0) {
    await db.from("runtime_signals").insert(signals);
  }

  // Update last synced
  await db
    .from("integration_connections")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("organisation_id", check.orgId)
    .eq("provider", "github");

  await writeAuditLog({
    organisationId: check.orgId,
    entityType: "integration",
    entityId: "github",
    actionType: "synced",
    performedBy: user.id,
    metadata: {
      evidence_count: allEvidence.length,
      repos_synced: repos.length,
      errors: errors.length > 0 ? errors : undefined,
    },
  });

  return NextResponse.json({
    data: {
      evidence_collected: allEvidence.length,
      signals_created: signals.length,
      repos_synced: repos.length,
      errors,
      summary: {
        pr_reviews: allEvidence.filter((e) => e.type === "pr_review").length,
        ci_checks: allEvidence.filter((e) => e.type === "ci_status").length,
        security_alerts: allEvidence.filter((e) => e.type === "dependabot").length,
        codeowners: allEvidence.filter((e) => e.type === "codeowners").length,
      },
    },
  });
}
```

**Step 2: Commit**

```bash
git add src/app/api/integrations/github/sync/route.ts
git commit -m "feat: GitHub evidence sync — PR reviews, CI status, Dependabot, CODEOWNERS"
```

---

### Task 4.4: Create evidence summary API for systems

**Files:**
- Create: `src/app/api/risk-registry/[systemId]/evidence/route.ts`

**Step 1: Write the evidence summary endpoint**

This aggregates evidence from runtime_signals (including GitHub sync) for a specific system:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOrgMembership } from "@/lib/requireOrgMembership";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ systemId: string }> }
) {
  const { systemId } = await params;
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const check = await requireOrgMembership(user.id);
  if ("error" in check) return NextResponse.json(check, { status: 403 });

  const db = supabaseServer();
  const { searchParams } = new URL(req.url);
  const days = Math.min(parseInt(searchParams.get("days") ?? "30"), 90);
  const since = new Date(Date.now() - days * 86400000).toISOString();

  // Get system name for signal matching
  const { data: system } = await db
    .from("systems")
    .select("name")
    .eq("id", systemId)
    .single();

  if (!system) return NextResponse.json({ error: "System not found" }, { status: 404 });

  // Get signals from both system-specific and github sources
  const { data: signals } = await db
    .from("runtime_signals")
    .select("*")
    .eq("organisation_id", check.orgId)
    .gte("created_at", since)
    .in("system_name", [system.name, "github"])
    .order("created_at", { ascending: false });

  // Categorize evidence
  const categories = {
    governance: { pass: 0, fail: 0, warning: 0, total: 0, items: [] as unknown[] },
    security: { pass: 0, fail: 0, warning: 0, total: 0, items: [] as unknown[] },
    operations: { pass: 0, fail: 0, warning: 0, total: 0, items: [] as unknown[] },
  };

  for (const signal of signals ?? []) {
    const ctx = signal.context as Record<string, unknown> | null;
    const evidenceType = ctx?.evidence_type as string ?? signal.metric_name;
    const status = signal.metric_value === 1 ? "pass" : signal.metric_value === 0 ? "fail" : "warning";

    let category: keyof typeof categories = "operations";
    if (["dependabot", "security_scan"].includes(evidenceType)) category = "security";
    if (["codeowners", "pr_review"].includes(evidenceType)) category = "governance";
    if (["ci_status"].includes(evidenceType)) category = "operations";

    categories[category][status]++;
    categories[category].total++;
    categories[category].items.push({
      type: evidenceType,
      title: ctx?.title ?? signal.metric_name,
      url: ctx?.url ?? null,
      status,
      collected_at: signal.created_at,
    });
  }

  // Compute evidence completeness score (0-100)
  const totalChecks = Object.values(categories).reduce((a, c) => a + c.total, 0);
  const passedChecks = Object.values(categories).reduce((a, c) => a + c.pass, 0);
  const completeness = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;

  return NextResponse.json({
    data: {
      system_id: systemId,
      system_name: system.name,
      period_days: days,
      completeness_score: completeness,
      total_evidence: totalChecks,
      categories,
    },
  });
}
```

**Step 2: Commit**

```bash
git add src/app/api/risk-registry/\[systemId\]/evidence/route.ts
git commit -m "feat: system evidence summary endpoint with completeness scoring"
```

---

### Task 4.5: Verify build

**Step 1: Run the build**

Run: `npm run build`

Expected: Build succeeds with no type errors.

**Step 2: Fix any type errors if present**

**Step 3: Final commit if fixes needed**

```bash
git commit -m "fix: resolve build errors from new endpoints"
```

---

## Summary: What This Plan Delivers

| Priority | Deliverables | New Files | Modified Files |
|----------|-------------|-----------|----------------|
| **P1: Attestations** | Expiry/validity, revocation, branded PDF certificate, verify status | 4 new files, 1 migration | 2 modified |
| **P2: Risk Registry** | System↔vendor↔incident links, compliance requirements, unified registry API | 3 new files, 1 migration | 2 modified |
| **P3: Scoring Trends** | Weekly time-series API, Recharts trend component, dashboard integration | 2 new files | 1 modified |
| **P4: Evidence Engine** | GitHub client, connect/disconnect, sync (PRs, CI, Dependabot, CODEOWNERS), evidence summary | 6 new files | 0 modified |

**Total: 15 new files, 2 migrations, 5 modified files, ~18 commits**
