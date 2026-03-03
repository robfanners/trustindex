# Verisum Unification: TrustGraph + HAPP → Verisum

## Context

The current Verisum product suite has three conceptual layers — IBG (governance philosophy), TrustGraph (intelligence engine), and HAPP (cryptographic proof) — but they exist as separate, disconnected products. TrustGraph (`~/trustindex`, trustindex.verisum.org) is well-built with assessments, scoring, actions, copilot, and reporting. HAPP (`~/happ/happ`, happ.verisum.org) is a confused product that mixes TrustGraph concepts with proof-layer concepts, has mostly placeholder screens, and no real users.

**Decision:** Extend TrustGraph into Verisum — a single unified product. HAPP becomes the proof engine behind the "Verify" tier. IBG becomes the governance philosophy embedded throughout. Customers buy Verisum, not individual engines.

---

## Product Architecture

### Internal Engines (not user-facing)

| Engine | Role | Powers |
|--------|------|--------|
| IBG | Governance philosophy & control logic | Framework embedded throughout |
| TrustGraph | Intelligence & relational scoring | Core + Assure capabilities |
| HAPP Protocol | Cryptographic proof & provenance | Verify capabilities |

Engine names are **not shown publicly** (no "Powered by" footer). Exception: Verify documentation may reference "HAPP Protocol" for technical credibility.

### Tier Model

**Verisum Core** (Governance Intelligence Foundation)
- Target: AI-native startups, SMEs, early-stage regulated firms
- TrustOrg assessments (organisational governance posture)
- TrustSys assessments (AI system evaluation & scoring)
- Governance health score & maturity levels
- AI system registry & vendor register
- Gap prioritisation & remediation tracking (Action Engine)
- Board-ready reports, assessment history
- AI Copilot (policy generation, risk templates)
- Manual reassessment only
- **No** runtime monitoring, **no** escalation automation, **no** cryptographic anchoring

*Core answers: "Do we have structured governance, and how strong is it?"*

**Verisum Assure** (Continuous Alignment & Runtime Governance)
- Target: Scaling AI companies, FinTech, HealthTech, mid-market
- Everything in Core, plus:
- Drift detection & alerts
- Escalation workflows (auto-triggered, human-in-the-loop thresholds)
- Runtime monitoring (telemetry integrations)
- Incident capture & staff declarations
- Reassessment policies & scheduling
- Advanced reporting (escalation reports, risk trends, full audit timeline)
- Approvals and escalations are **logged but NOT cryptographically signed**

*Assure answers: "Is reality still aligned with our declared governance intent?"*

**Verisum Verify** (Cryptographic Proof & Trust Portability)
- Target: Regulated enterprise, financial institutions, pharma, public sector
- Everything in Assure, plus:
- Human-Verified Approvals (approval inbox, strong-auth sign-off, cryptographically signed)
- Attestation Engine (governance attestation builder, portable verification IDs)
- Provenance Certificates (AI output chain-of-custody, model version binding)
- Incident Lock & Forensic Freeze (cryptographic snapshots, tamper-resistant audit)
- Cross-Org Trust Exchange (external proof validation, partner verification)
- On-Chain Anchoring (Base L2, public verifiability)

*Verify answers: "Can we prove, externally and cryptographically, that governance occurred as declared?"*

### Hard Boundary: Logged vs Signed

| Assure | Verify |
|--------|--------|
| Approval logged | Approval cryptographically signed |
| Escalation recorded | Escalation cryptographically bound |
| Incident tracked | Incident frozen immutably |
| Audit timeline | Tamper-resistant forensic bundle |

---

## Navigation: Workflow-Based, Tier-Gated

Navigation follows the governance lifecycle: **Govern → Monitor → Prove → Act → Report**

Locked higher-tier sections are **visible but gated** — showing preview metrics to create pull, not friction.

```
SIDEBAR

Overview
  Dashboard (trust posture, alerts, key stats)

GOVERN [Core]
  TrustOrg
  TrustSys
  Policies & Risk Rules
  AI Registry
  Vendors
  Actions (remediation)

MONITOR [Assure — locked for Core]
  Drift Detection
  Escalations
  Runtime Signals
  Incidents
  Staff Declarations

PROVE [Verify — locked for Core + Assure]
  Approval Inbox
  Attestations
  Provenance Certificates
  Incident Lock
  Trust Exchange
  Verification Portal

REPORT
  Board Reports
  Audit Timeline
  Risk Trends
  Export

SETTINGS
  Team
  Integrations
  Plan & Billing
```

### Role-Based UI Behaviour

| Role | Sees | Does not see |
|------|------|-------------|
| Admin / Owner | Everything (tier-gated) | — |
| Risk Officer | Govern, Monitor, Report | — |
| Engineer / Assessor | Govern (assessments), Act | Monitor details, Prove |
| Board Viewer | Overview, Report, Prove (read-only) | Govern config, Monitor |
| Signatory | Prove (Approval Inbox only) | Everything else |
| Auditor | All sections (read-only) | Configuration/edit capabilities |

---

## Branding & Domains

- **Product name**: Verisum
- **Engine names**: TrustGraph, HAPP Protocol (internal only)
- **Tier names**: Core, Assure, Verify
- **Domains**:
  - `verisum.org` → marketing site
  - `app.verisum.org` → product
  - `verify.verisum.org` → public verification portal (Verify tier)
  - `happ.verisum.org` → redirect to verisum.org

---

## HAPP Codebase Disposition

| Component | Decision | Notes |
|-----------|----------|-------|
| HAPP business app | **Retire** | No users, weaker codebase |
| HAPP demo hub | **Park** | Cherry-pick best demos later |
| HAPP smart contracts | **Preserve as separate protocol module** | Future licensing/open-source |
| HAPP Supabase schema | **Rebuild** | New migrations in Verisum DB |

Preserve HAPP as a standalone protocol boundary for future licensing, open-source, or ecosystem integration.

---

## Implementation Phases

1. **Navigation Restructure** — Workflow-based nav in TrustGraph codebase
2. **Tier Gating System** — Feature-to-tier mapping, locked previews, upgrade modals
3. **Role-Based UI** — Role definitions, nav filtering, route middleware
4. **Billing Integration** — Stripe mapping to Core/Assure/Verify
5. **Rebrand to Verisum** — UI text, logo, domains, emails
6. **Assure Polish** — Surface drift/escalation in Monitor section
7. **Verify Build** — Approval inbox, attestations, provenance, on-chain anchoring
8. **Public Verification Portal** — verify.verisum.org

---

*Design date: 2026-03-03*
*Status: Approved*
