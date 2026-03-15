# Verisum — Seed Investment Deck
## AI Governance SaaS | From Assessment to Cryptographic Proof

**Prepared by:** Verisum Ltd | Rob Fanshawe, Founder & CEO
**Date:** March 2026
**Status:** Confidential — Investment Discussion
**Round:** Seed | SEIS/EIS Eligible

---

## 1. The Opportunity in One Sentence

Every organisation deploying AI needs to prove it is governed — and no one has built the platform to do it.

**Verisum is live, deployed, and selling.** This is a seed round to accelerate go-to-market, not to build an MVP.

---

## 2. The Problem: AI Without Governance

### AI Adoption Has Outrun Governance

Every enterprise is deploying AI — ChatGPT, Copilot, Claude, Midjourney, custom ML models. But the governance infrastructure to ensure these systems are safe, accountable, and auditable does not exist.

- **EU AI Act** (enforced August 2025): Mandatory risk classification, documentation, human oversight, and audit trails for AI systems
- **ISO 42001** (AI Management Systems): Becoming a procurement gatekeeper for regulated sectors
- **Board-level liability**: Directors face personal liability for AI failures they cannot explain or evidence
- **Sector regulators**: FDA, MHRA, FCA, PRA all developing AI-specific governance requirements

### The Market Gap

| Approach | Why It Fails |
|----------|-------------|
| Enterprise GRC (ServiceNow, OneTrust, Archer) | £100K+ setup, 6-12 month deployment, not AI-specific |
| Manual spreadsheets | No scoring, no drift detection, no proof, no audit trail |
| AI-specific point tools (Credo AI, Holistic AI) | No workflow, no self-serve, no cryptographic proof, no copilot |
| Internal build | Diverts engineering, never maintained, no regulatory mapping |

**Result:** Most organisations — especially SMEs and mid-market — have zero structured AI governance. They know they need it, they cannot justify £100K+ to get it, and they do not know where to start.

---

## 3. The Solution: Verisum

### One Platform. Three Tiers. Assess → Monitor → Prove.

Verisum is a SaaS platform that takes organisations from "exposed" to "governed" in 48 hours — through self-serve onboarding, plain-English assessments, and an AI copilot that generates policies, tracks incidents, and produces board-ready reports.

### Tier Model

| Tier | What It Does | Price | Target |
|------|-------------|-------|--------|
| **Verisum Core** | Governance intelligence — assessments, scoring, policies, remediation tracking, board reports, AI copilot | £79/mo per unit | SMEs, startups, early governance |
| **Verisum Assure** | Continuous alignment — drift detection, escalation workflows, runtime monitoring, incident management | £199/mo per unit | Scaling companies, mid-market |
| **Verisum Verify** | Cryptographic proof — signed approvals, attestations, provenance certificates, forensic freeze, on-chain anchoring | Custom | Regulated enterprise, pharma, financial services |

### The Governance Lifecycle

```
GOVERN → MONITOR → PROVE → ACT → REPORT
```

- **Govern:** Assess organisational posture (TrustOrg), evaluate AI systems (TrustSys), register AI systems, generate policies
- **Monitor:** Detect drift from governance baseline, trigger escalations, capture incidents, manage staff declarations
- **Prove:** Cryptographically sign approvals, generate provenance certificates, create tamper-resistant audit bundles
- **Act:** Prioritise remediation, assign actions, track resolution
- **Report:** Board-ready PDFs, audit timelines, risk trends, exportable compliance evidence

---

## 4. Why Now

### Three Converging Forces

**1. Regulatory Enforcement (2025-2026)**
- EU AI Act enforcement began August 2025 — fines up to 7% of global revenue
- ISO 42001 certification becoming a procurement prerequisite
- Sector regulators (FDA, MHRA, FCA) publishing AI-specific governance requirements
- UK AI Safety Institute expanding scope beyond frontier models to enterprise AI

**2. Enterprise AI Adoption at Scale**
- 78% of enterprises now deploying AI in production (McKinsey, 2025)
- Average enterprise uses 12+ AI tools across departments
- AI spend projected to exceed $200B globally by 2027
- Every AI deployment creates a governance obligation — and currently, no tool addresses it

**3. Board & Director Liability**
- Directors face personal liability for AI failures under existing corporate governance law
- D&O insurers beginning to exclude AI-related claims without evidence of governance
- Board reporting on AI risk becoming mandatory in regulated sectors
- Governance evidence (not just policies) is the new standard

### The Window

AI governance is a **category-creation opportunity** — analogous to cybersecurity compliance (pre-SOC 2) or data privacy (pre-GDPR tooling). The market leader will be defined in the next 12-24 months. Verisum is the only platform that is:

1. **Live and selling** (not a whitepaper or pilot)
2. **Self-serve** (48-hour time-to-governance)
3. **Tiered** (SME to enterprise on one platform)
4. **Proof-capable** (cryptographic, not just documented)

---

## 5. Product: Live, Tested, Deployed

### This Is Not a Concept Deck

Verisum is a production-grade SaaS platform, deployed and operational:

| Capability | Status |
|-----------|--------|
| Organisational governance assessments (TrustOrg) | **Live** |
| AI system risk assessments (TrustSys) | **Live** |
| Governance health scoring & maturity levels | **Live** |
| AI system registry & vendor management | **Live** |
| Remediation actions engine | **Live** |
| AI Governance Copilot (policy gen, risk templates, regulatory feed) | **Live** |
| Staff declarations & incident logging | **Live** |
| Board-ready PDF reports | **Live** |
| Drift detection & escalation workflows | **Live** |
| Self-serve billing (Stripe) | **Live** |
| Role-based access (6 defined roles) | **Live** |
| 251 automated tests, CI/CD pipeline | **Live** |
| Zod input validation across all API endpoints | **Live** |
| Security headers (CSP, HSTS, X-Frame-Options) | **Live** |
| Rate limiting on public endpoints | **Live** |
| Cryptographic proof layer (Verify tier) | Architecture complete, build-ready |

### Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript 5 (strict mode), Tailwind CSS 4
- **Backend:** Supabase (Postgres + Row Level Security + Edge Functions), Node.js 22
- **Payments:** Stripe subscriptions + customer portal
- **Auth:** Supabase Auth (magic links, email/password, session cookies)
- **Testing:** Vitest, 251 automated tests (unit + integration), BDD+ methodology
- **Proof Layer:** ethers.js v6 (Base L2 anchoring) — modular, chain-agnostic
- **Infra:** Hostinger hosting, Vercel Analytics, PostHog

### What 251 Tests Means

This is not a hackathon prototype. The test suite covers:
- Core library logic (tier hierarchy, entitlements, navigation)
- All Zod validation schemas (40+ test cases)
- API route integration tests (auth enforcement, input validation, response shapes)
- Cryptographic functions (hash determinism, verification ID format)
- Rate limiting and environment validation

**One founder built this — solo, using AI-first development methodology.** The platform is enterprise-grade despite being pre-team. This is a demonstration of what AI-augmented development makes possible, and it is the same methodology Verisum teaches its customers.

---

## 6. Business Model

### SaaS Revenue

| Metric | Value |
|--------|-------|
| Pricing | £79/mo (Core), £199/mo (Assure), Custom (Verify) |
| Unit economics | Per business unit / AI system assessed |
| Gross margin target | 85%+ (SaaS, Supabase infrastructure) |
| Net revenue retention target | 130%+ (tier upgrades, unit expansion) |
| CAC payback target | < 6 months (self-serve Core), < 12 months (Assure/Verify) |

### Revenue Drivers

1. **Land with Core:** Self-serve sign-up, 48-hour time-to-governance, £79/mo entry point
2. **Expand to Assure:** As organisations scale AI, they need continuous monitoring — natural upgrade path
3. **Upsell to Verify:** Regulated sectors need cryptographic proof — highest ACV, longest contracts
4. **Multiply by units:** Each organisation has multiple business units and AI systems — revenue grows with governance scope

### Expansion Mechanics

- **Horizontal:** More business units assessed → more subscriptions
- **Vertical:** Core → Assure → Verify tier upgrades as governance maturity increases
- **Cross-org:** Verisum Verify Trust Exchange creates network effects — organisations sharing governance proof pull partners onto the platform

---

## 7. Market Opportunity

### Total Addressable Market

| Segment | Sizing Logic | TAM |
|---------|-------------|-----|
| AI governance software | 500K+ enterprises deploying AI globally × £10K-£500K ACV | £50B+ |
| Regulated sectors (financial services, pharma, healthcare, defence) | 50K+ regulated enterprises × £100K-£1M ACV | £20B+ |
| GRC adjacency | AI governance as extension of £15B GRC market | £5B+ (AI-specific share) |

### Serviceable Addressable Market (Year 1-3)

| Segment | SAM |
|---------|-----|
| UK & EU mid-market (50-5000 employees, deploying AI) | £500M |
| UK & EU regulated enterprise (financial services, pharma, healthcare) | £1B |
| **Combined SAM** | **£1.5B** |

### Why SAM Is Accessible

- EU AI Act creates **mandatory** demand (not optional spend)
- Self-serve model captures SME/mid-market without enterprise sales cycles
- Partner channel (Atos, Avenga, Big 4) unlocks enterprise without direct sales team
- UK-based, SEIS/EIS eligible — aligned with UK investor base

---

## 8. Go-To-Market Strategy

### Phase 1: Self-Serve Foundation (Now — Month 6)

**Objective:** Build organic pipeline and prove self-serve conversion

- Content-led SEO: AI governance guides, EU AI Act compliance checklists, ISO 42001 readiness assessments
- Product-led growth: Free Explorer tier → Core conversion at £79/mo
- Community: AI governance newsletter, LinkedIn thought leadership, podcast appearances
- Direct outreach: Warm introductions to 20-30 target accounts in regulated sectors
- **Target:** 50 paying Core customers, 10 Assure customers

### Phase 2: Partner Channel Activation (Month 3-9)

**Objective:** Activate enterprise distribution through strategic partners

- **Enterprise IT partners:** Atos, Avenga — embed Verisum into AI transformation engagements
- **Consulting partners:** Big 4, boutique AI consultancies — Verisum as the product behind advisory
- **Pharma partners:** J&J, AstraZeneca — co-develop pharma-specific governance templates
- Partner models: Reseller (20-30% margin), Co-Development (joint IP), Managed Service (70/30 split)
- **Target:** 3-5 active partners, 20+ enterprise pipeline from partner channel

### Phase 3: Verify & Enterprise Scale (Month 6-12)

**Objective:** Launch Verify tier, close enterprise contracts

- Deploy Verisum Verify: Cryptographic proof layer for regulated enterprise
- First enterprise contracts: £50K-£500K ACV through partner channel
- Industry-specific packages: "AI Governance for Financial Services", "AI Governance for Pharma"
- Conference appearances: DIA, ISPE, AI Summit, GovTech
- **Target:** 5 enterprise contracts (Verify tier), 200+ total paying customers

### Phase 4: Category Leadership (Month 12-24)

**Objective:** Establish Verisum as the category-defining AI governance platform

- International expansion: US market entry (FDA-driven demand)
- Platform ecosystem: API marketplace, third-party integrations (ServiceNow, Jira, Slack)
- Verify network effects: Cross-Org Trust Exchange creates switching costs
- Strategic acquisitions: Complementary tooling (AI monitoring, model registry)
- **Target:** £2M+ ARR, 500+ paying customers, Series A readiness

---

## 9. Competitive Landscape

### Direct Competitors

| Player | What They Do | What They Lack |
|--------|-------------|----------------|
| Credo AI | AI governance assessments | No self-serve, no cryptographic proof, no copilot, enterprise pricing |
| Holistic AI | AI risk management & auditing | Point solution, no workflow engine, no continuous monitoring |
| IBM OpenPages | Enterprise GRC (AI module) | Massive, expensive, 6+ month deploy, not AI-native |
| OneTrust | Privacy & GRC (AI module) | Retrofitted from privacy, not AI-specific, £100K+ |
| Fairly AI | AI fairness & bias monitoring | Narrow scope, no governance workflow, no proof layer |

### Adjacent Competitors

| Player | Overlap | Differentiation |
|--------|---------|----------------|
| ServiceNow GRC | Enterprise compliance workflows | Not AI-specific, enterprise pricing, long deployment |
| Dataiku / MLflow | ML model management | Model ops, not governance — complementary, not competitive |
| Azure AI Content Safety | AI safety tooling | Microsoft-locked, narrow scope, no governance workflow |

### Verisum's Competitive Moat

1. **Self-serve + Enterprise on one platform:** No competitor spans free tier to regulated enterprise. Verisum scales with customers.
2. **Cryptographic proof (Verify tier):** No competitor offers signed, verifiable governance decisions. This is unique IP.
3. **AI Copilot:** Policy generation, incident templates, regulatory guidance — built in, not bolted on.
4. **48-hour time-to-governance:** From sign-up to governance score in hours, not months.
5. **AI-native architecture:** Built specifically for AI governance, not retrofitted from generic GRC.
6. **Network effects:** Cross-Org Trust Exchange (Verify tier) creates switching costs and platform pull.

---

## 10. The Proof Layer: Unique IP

### Why Cryptographic Proof Matters

Governance today is **documented** — policies exist in PDFs, approvals exist in email threads, audit trails exist in databases. All of these can be:
- Retrospectively modified
- Selectively presented
- Disputed in regulatory proceedings
- Fabricated after the fact

Verisum Verify makes governance **provable** — cryptographically signed, tamper-resistant, independently verifiable.

### Verify Capabilities

| Capability | What It Does |
|-----------|-------------|
| **Human-Verified Approvals** | Cryptographically signed approval decisions — not just logged, but signed with strong authentication |
| **Governance Attestations** | Exportable, signed governance statements with unique verification IDs |
| **Provenance Certificates** | AI output chain-of-custody: which model, which version, which data, who validated, when |
| **Incident Lock** | Forensic freeze — cryptographic snapshots making incidents tamper-resistant |
| **Cross-Org Trust Exchange** | Share governance proof with partners, regulators, auditors — portable trust |
| **On-Chain Anchoring** | Base L2 public verifiability of critical governance events — immutable, timestamped |

### The Hard Boundary: Logged vs Signed

| Verisum Assure (£199/mo) | Verisum Verify (Custom) |
|--------------------------|------------------------|
| Approval logged in database | Approval cryptographically signed |
| Escalation recorded | Escalation cryptographically bound |
| Incident tracked | Incident frozen immutably |
| Audit timeline | Tamper-resistant forensic bundle |

This boundary is the core of Verisum's pricing power. Regulated enterprises will pay premium pricing for proof that governance occurred — not just documentation that it was intended.

### Underlying Protocol: HAPP

The Verify tier is powered by the **HAPP Protocol** (Human-Anchored Provenance Protocol) — a modular cryptographic trust layer designed for human-AI accountability. HAPP is preserved as standalone protocol IP within Verisum, with potential for:
- Open-source community adoption
- Protocol licensing to other governance platforms
- Ecosystem integration (identity providers, AI platforms, regulatory bodies)

---

## 11. Traction & Validation

### Product Milestones

| Milestone | Status |
|-----------|--------|
| Full product architecture (11 phases) | Complete |
| Self-serve onboarding & Stripe billing | Live |
| 251 automated tests passing | Live |
| AI Governance Copilot deployed | Live |
| Board-ready PDF report generation | Live |
| Drift detection & escalation engine | Live |
| Security hardening (Zod validation, headers, rate limiting) | Live |
| Domain & infrastructure (app.verisum.org) | Deployed |
| Verify tier architecture | Complete, build-ready |

### Market Validation

- **EU AI Act** creates mandatory compliance demand — not discretionary spend
- **Partnership discussions** with Atos (enterprise IT), Avenga (AI consultancy), pharma enterprises
- **Co-development interest** from regulated sectors (financial services, pharmaceutical, healthcare)
- **Founder network** in regulated technology (ex-Fnality, 15 global bank relationships)
- **AI-first build methodology** validated — solo founder, enterprise-grade product, < 6 months

### Comparable Transactions

| Company | Stage | Raise | Valuation | Relevance |
|---------|-------|-------|-----------|-----------|
| Credo AI | Series A (2022) | $12.8M | ~$60M | AI governance — no self-serve, no proof layer |
| Holistic AI | Series A (2023) | $5.5M | ~$25M | AI risk — point solution, narrower scope |
| OneTrust | Seed (2016) | $2M | ~$10M | Privacy compliance SaaS — category-creation parallel |
| Drata | Seed (2020) | $3.2M | ~$15M | SOC 2 automation — compliance SaaS parallel |

---

## 12. Founder

### Rob Fanshawe — Founder & CEO

**Background:**
- **Ex-COO, Fnality International** — Scaled regulated blockchain infrastructure (wholesale settlement network for 15 global banks including Barclays, HSBC, UBS, Santander) from concept to £100M+ Series C readiness
- Led operations, compliance, and governance design for a system handling central bank money
- Direct experience navigating financial regulation (FCA, PRA, ECB, SNB, BOJ, MAS)
- Deep expertise in cryptographic systems, institutional trust, and enterprise governance

**Why This Founder for This Problem:**
1. **Regulated technology experience:** Built and scaled infrastructure under regulatory scrutiny — knows how governance works in practice, not just theory
2. **Enterprise credibility:** Operated at C-suite level with 15 of the world's largest banks — can sell to enterprise buyers and boards
3. **Cryptographic expertise:** Deep understanding of proof systems, provenance, and verifiable trust — this is the core IP behind Verisum Verify
4. **AI-augmented builder:** Built Verisum solo using AI-first development methodology (Claude Code as AI co-founder) — 251 tests, 11-phase architecture, production-deployed in < 6 months
5. **Capital-efficient operator:** Proven ability to build enterprise-grade software with minimal burn — seed capital goes to GTM, not to building a product that already exists

### Development Methodology

Verisum was built using an AI-first development process that is itself a proof point for the product's thesis:
- **Claude Code** as AI pair programmer and architect
- **BDD+ Continuous Testing** methodology (Given/When/Then, shift-left, shift-right)
- Full TypeScript strict mode, 251 automated tests, CI/CD pipeline
- The product that governs AI was built by AI — demonstrating responsible, governed AI development in practice

---

## 13. The Ask

### Seed Round: £1.5M — £2.5M

| Use of Funds | Allocation | What It Delivers |
|-------------|------------|-----------------|
| **Engineering** (40%) | £600K-£1M | Build Verify tier, API integrations, enterprise features, hire 2-3 engineers |
| **Go-to-Market** (35%) | £525K-£875K | Partner activation, content marketing, sales team (1-2 enterprise AEs), conferences |
| **Operations** (15%) | £225K-£375K | Legal, compliance, infrastructure, insurance |
| **Reserve** (10%) | £150K-£250K | Working capital, contingency |

### Terms

| Element | Detail |
|---------|--------|
| Round | Seed |
| Size | £1.5M — £2.5M |
| Structure | Priced equity round or SAFE/ASA |
| Tax relief | SEIS (first £250K) + EIS eligible |
| Valuation | £8M — £12M pre-money (negotiable) |
| Use of funds | GTM acceleration, Verify build, team hire |
| Board | Founder + 1 investor seat + 1 independent |
| Runway | 18-24 months to Series A metrics |

### SEIS/EIS Eligibility

Verisum Ltd is structured to maximise tax-advantaged investment for UK investors:

| Relief | Benefit to Investor |
|--------|-------------------|
| **SEIS** (first £250K) | 50% income tax relief, CGT exemption on gains, loss relief |
| **EIS** (remainder) | 30% income tax relief, CGT deferral, loss relief |
| **Qualifying criteria** | < 2 years old, < 25 employees, < £350K gross assets (SEIS) / < £15M (EIS), UK-based |

### Why Invest Now

1. **Product exists:** This is not a pre-product raise. Verisum is live, tested, and deployed.
2. **Market timing:** EU AI Act enforcement creates immediate, mandatory demand. First movers define the category.
3. **Capital efficiency:** Solo founder built enterprise-grade product in < 6 months. Seed capital goes to GTM and team, not MVP.
4. **Regulatory tailwind:** Every new AI regulation is a growth driver. The regulatory surface area is expanding, not contracting.
5. **SEIS/EIS tax advantage:** Up to 50% income tax relief + CGT exemption — de-risks downside for UK investors.
6. **Category creation:** AI governance is where cybersecurity compliance was pre-SOC 2 and data privacy was pre-GDPR tooling. The category leader will capture outsized value.

---

## 14. Financial Projections (Illustrative)

### Revenue Trajectory

| Period | Core Customers | Assure Customers | Verify Contracts | MRR | ARR |
|--------|---------------|-----------------|------------------|-----|-----|
| Month 6 | 50 | 10 | 0 | £5,950 | £71K |
| Month 12 | 150 | 40 | 5 | £24,800+ | £298K+ |
| Month 18 | 300 | 100 | 15 | £53,500+ | £642K+ |
| Month 24 | 500 | 200 | 30 | £100K+ | £1.2M+ |

*Verify pricing assumed at £2K/mo average. Actual enterprise contracts likely higher.*

### Key Assumptions

- Self-serve conversion rate: 5-10% of free → Core
- Core → Assure upgrade rate: 20-30% within 12 months
- Assure → Verify upgrade rate: 10-15% (regulated sectors)
- Monthly churn: < 3% (Core), < 1% (Assure/Verify)
- Partner channel contribution: 30-40% of enterprise pipeline from Month 6
- No international revenue assumed until Month 18+

### Path to Series A (Month 18-24)

| Metric | Series A Target |
|--------|----------------|
| ARR | £1M+ |
| Paying customers | 400+ |
| Enterprise contracts (Verify) | 15+ |
| Net revenue retention | 130%+ |
| Partner channel active | 5+ partners |
| Gross margin | 85%+ |

---

## 15. Risk & Mitigation

| Risk | Severity | Mitigation |
|------|----------|-----------|
| **Regulatory slowdown** — EU AI Act enforcement delayed or weakened | Medium | Multiple regulatory drivers (ISO 42001, sector regulators, board liability); AI governance demand is regulatory-agnostic |
| **Enterprise sales cycles** — Longer than projected | Medium | Self-serve Core tier generates revenue while enterprise deals close; partner channel accelerates enterprise access |
| **Competitor funding** — Credo AI or new entrant raises large round | Medium | Verisum's moat is proof layer (unique IP) + self-serve (unique GTM); competitors cannot replicate both quickly |
| **Key person risk** — Solo founder | High | First hires include CTO/senior engineer; product architecture is documented and testable (251 tests); AI-augmented methodology reduces bus factor |
| **Platform risk** — Supabase/infrastructure dependency | Low | Standard SaaS infrastructure; no proprietary lock-in; portable to any Postgres + Next.js deployment |
| **Pricing pressure** — Race to bottom in AI governance | Low | Verify tier is defensible on IP; Core tier is already aggressively priced; proof layer creates pricing power |

---

## 16. Vision: The Trust Layer for AI

### Near Term (12-24 months)
Verisum becomes the default AI governance platform for UK and EU mid-market and regulated enterprise — the "Drata for AI governance."

### Medium Term (2-4 years)
Verisum Verify becomes the trust standard — organisations share governance proof across supply chains, regulators accept Verisum attestations as compliance evidence, the Cross-Org Trust Exchange creates network-effect defensibility.

### Long Term (5+ years)
Verisum is the **trust layer for AI** — every AI decision of consequence flows through governance infrastructure that Verisum provides. From a startup deploying its first chatbot to a pharmaceutical company releasing an AI-designed drug, governance proof is as fundamental as encryption.

The HAPP Protocol, preserved as modular IP, becomes an open standard for human-AI accountability — adopted by platforms, embedded in regulations, and required by insurers.

---

## 17. Call to Action

### Investment Process

1. **This deck** — Review and initial interest
2. **Product demo (60 min)** — Live walkthrough of Verisum platform with governance scenarios
3. **Technical deep-dive (60 min)** — Architecture, security posture, test suite, Verify design
4. **Commercial discussion** — Terms, valuation, board structure
5. **Due diligence** — Financials, legal, technical (2-4 weeks)
6. **Close** — SEIS/EIS advance assurance, subscription agreement, funds deployed

### What We're Looking For in Investors

- **Domain expertise:** Regulated technology, SaaS, compliance, AI — investors who understand the market
- **Network:** Introductions to enterprise buyers, partner channels, follow-on investors
- **Patience:** Category creation takes time — we want partners aligned with building a category-defining company
- **SEIS/EIS-aware:** Understanding of UK tax-advantaged investment structures

### Contact

**Rob Fanshawe**
Founder & CEO, Verisum Ltd
Email: rob@verisum.org
Web: https://verisum.org
Product: https://app.verisum.org

---

*Verisum: Govern AI. Monitor Drift. Prove Compliance. The governance platform the AI era demands.*
