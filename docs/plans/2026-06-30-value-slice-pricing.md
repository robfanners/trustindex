# Value-Slice Pricing — Verisum Commercial Model

**Date:** 2026-06-30
**Status:** Decision made — execution plan in progress
**Supersedes:** Task #11 (Core add-on pricing), #13 (Core teasers), and parts of #12 (feature gating). All rolled into this plan.
**Related:** [`2026-06-30-explorer-ux-audit.md`](./2026-06-30-explorer-ux-audit.md) — Pattern L was the trigger for this rethink

---

## The shift, in one sentence

**From module-bundle pricing** (Core = Govern, Assure = adds Monitor, Verify = adds Prove) **to value-slice pricing** (every tier gets *some* value in *every* module; chain-anchoring is the Verify moat; Verification receive-only is the Explorer viral hook).

## Why now

- The Explorer UX audit (2026-06-30) surfaced Pattern L: whole locked modules in the sidebar are noisy and don't drive upgrades.
- Verisum's `entitlements.ts` already supports per-feature gates that cross module boundaries (IBG view/manage, Reports basic/full, Team). Only the sidebar's `minTier` was doing bundle-level gating. The internal model was ready.
- No paid customers to migrate — this is the ideal moment.
- Chain-anchoring is a genuine defensible moat; module-bundle pricing was hiding it inside "Verify = the whole Prove tab" rather than surfacing it as a specific capability worth paying for.

## The value-slice model

### GOVERN — understand & document

| Feature | Explorer | Core (£129/mo) | Assure (£499/mo) | Verify (custom) |
|---|---|---|---|---|
| TrustGraph self-survey | 1 | Unlimited | Unlimited | Unlimited |
| **CSV export of own results** | **✅ *(new — free tier control of own data)*** | ✅ | ✅ | ✅ |
| Multi-user org survey | — | ✅ (2) | ✅ (6) | Unlimited |
| Policies — view + upload | ✅ | ✅ | ✅ | ✅ |
| Policies — AI generate | — | 3 /mo | 10 /mo | 50 /mo |
| Policies — edit generated | — | — | ✅ | ✅ |
| AI Registry / Vendors / Systems | — | 2 systems, 10 vendors | 6 systems, ∞ vendors | ∞ |
| Models registry | — | — | ✅ | ✅ |
| Compliance frameworks | View 1 | Major frameworks | Full + custom | Full + custom |
| Actions | ✅ | ✅ | ✅ | ✅ |

### MONITOR — watch for drift

| Feature | Explorer | Core (£129/mo) | Assure (£499/mo) | Verify (custom) |
|---|---|---|---|---|
| **Drift & Alerts on own systems** | — | **✅ Basic — 2 systems *(new teaser)*** | Full — 6 systems + config | Unlimited + custom rules |
| Escalation workflows | — | — | ✅ | ✅ + custom routing |
| **Incident logging** | — | **✅ Basic — 3 /mo *(new teaser)*** | Unlimited | Unlimited + integrations |
| Staff Declarations | — | 50 /mo | 250 /mo | Unlimited |
| Signals (external feeds) | View 1 default | View 4 defaults | Full + integrations | Full + custom sources |

### PROVE — cryptographically demonstrate

| Feature | Explorer | Core (£129/mo) | Assure (£499/mo) | Verify (custom) |
|---|---|---|---|---|
| **Verification** (verify a proof someone sent you) | **✅ *(new — VIRAL HOOK, no-auth)*** | ✅ | ✅ | ✅ |
| Decision Ledger — non-chain (own records) | — | **✅ Basic *(new)*** | Full | Full |
| Attestations — issue proofs to others | — | — | ✅ Basic | ✅ Unlimited |
| Incident Lock — non-chain | — | **✅ Basic *(new)*** | ✅ | ✅ |
| Trust Exchange | — | — | Limited | Unlimited |
| **On-chain anchoring** (attestations, incidents, provenance) | — | — | — | **✅ THE MOAT** |
| Approvals workflow | — | — | ✅ | ✅ |
| Provenance graph | — | — | View own | Full cross-org |

## Strategic moves embedded in this model

1. **Verification for Explorer, no auth required.** Every attestation a Verify customer issues becomes a signup funnel. Auditor receives proof → verifies it → sees Verisum → signs up to look around.
2. **Non-chain versions of Prove features for Core.** Real audit-grade record-keeping without cryptographic anchoring. Creates lock-in (their history lives in Verisum). Chain-anchoring is the upgrade trigger to Verify.
3. **Basic Drift + basic Incidents on Core.** Activates the Monitor tab; drives Assure upgrade when they hit 3 systems or want escalation workflows.
4. **Chain-anchoring reserved for Verify.** Competitors can build governance dashboards. They can't easily build cryptographic anchoring. Turn the moat into pricing.
5. **CSV export of own data goes to Explorer.** Free tier should give full control of own data (Pattern C from UX audit). Don't gate the customer's own results.

## Execution plan

### Phase 1 — Foundations (this sprint)
1. Refactor `navigation.ts` to remove section-level `minTier` — replace with per-item gating
2. Add new entitlement functions in `entitlements.ts`:
   - `canAccessBasicDrift(plan)`, `getMaxDriftSystems(plan)`
   - `canLogIncidents(plan)`, `getMaxIncidentsPerMonth(plan)` (already exists — extend to Core)
   - `canUseNonChainLedger(plan)`, `canUseChainAnchoring(plan)`
   - `canVerifyExternalProofs()` (returns true for all, including no-auth)
   - `canIssueAttestations(plan)`, `canExportOwnData(plan)` (Explorer = true)
3. Build reusable `<UpgradeModal>` component (based on Models page pattern) with per-feature value prop
4. Update sidebar rendering: every section always visible for the user's role; individual items lock based on per-feature entitlements

### Phase 2 — First upgrade hook: Basic Drift on Core
- Chosen as the first activation lever
- Scope: 2 systems (matches Core system limit), read-only drift alerts, no escalation, no signals
- Upgrade prompt when: user tries to add a 3rd system, or hits an Escalation workflow feature, or wants Signals
- Ship as a single PR

### Phase 3 — Explorer viral hook: Public Verification
- New route `/verify/[proofId]` — no auth required
- Verifies a signed attestation, shows the metadata, links to signup
- Ship as a single PR once we have real attestations to verify

### Phase 4 — Non-chain Prove for Core
- Decision Ledger — non-chain: existing on-chain code path guarded so Core gets in-memory/DB version
- Incident Lock — non-chain: same pattern
- Attestations for Assure (basic — non-chain), for Verify (full — on-chain)

### Phase 5 — Marketing alignment
- **verisum.org/product/** landing page: reframe as three pillars (Govern, Monitor, Prove) with per-tier value cards
- **verisum.org/product/core/**: emphasise "start here" — Govern in full + tastes of Monitor + Prove
- **verisum.org/product/assure/**: emphasise workflow completeness (escalations, unlimited incidents, attestation issuing)
- **verisum.org/product/verify/**: lead with chain-anchoring as the moat
- **verisum.org/pricing/**: feature comparison matrix, not tier cards

## Grandfathering

**Not required.** No paid customers at time of decision (2026-06-30). New signups get value-slice from day one.

## Risks

- **Marketing complexity.** Feature-matrix pricing is harder to explain than tier-bundle. Mitigate: clean per-pillar landing pages so buyers can self-select before hitting the matrix.
- **Product debt.** Non-chain versions of Ledger + Incident Lock need building; if the on-chain code path is tightly coupled, this could take longer than expected. Spike first before committing to Phase 4 timeline.
- **Value dilution at Verify.** If Assure gets too much (e.g., basic attestations), what's the Verify upsell? Answer: chain-anchoring + unlimited + cross-org Trust Exchange + custom integrations. Guard these carefully.

## Success criteria

- Explorer users encounter Verification within 24h of signup (either through marketing or product tour)
- Core users hit at least one Monitor upgrade prompt within 7 days of activation
- 20%+ of Assure signups mention chain-anchoring as their driver
- Pricing page conversion rate ≥ current (bundle model) after 30 days
