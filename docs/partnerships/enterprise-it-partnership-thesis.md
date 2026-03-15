# Verisum x Enterprise IT Partners — Partnership Thesis
## Co-Development Opportunity: Atos & Avenga

**Prepared by:** Verisum Ltd | Rob Fanshawe, Founder & CEO
**Date:** March 2026
**Status:** Confidential — Partnership Discussion

---

## 1. Executive Summary

Verisum is a **live, production-ready AI governance SaaS platform** that helps organisations measure, monitor, and cryptographically prove responsible AI usage. Unlike GRC platforms that cost six figures and take months to deploy, Verisum gets an organisation from "exposed" to "governed" in 48 hours — through self-serve onboarding, plain-English assessments, and an AI copilot that generates policies, tracks incidents, and produces board-ready reports.

The platform is built around three tiers:
- **Verisum Core** — Governance intelligence (assessments, scoring, policies, reporting)
- **Verisum Assure** — Continuous alignment (drift detection, escalations, runtime monitoring)
- **Verisum Verify** — Cryptographic proof (signed approvals, attestations, provenance, on-chain anchoring)

**What has changed since our earlier conversations:** Verisum is no longer a whitepaper or concept deck. It is a fully architected, tested, and deployed product — 251 automated tests, self-serve Stripe billing, role-based access, AI copilot, and a complete governance workflow (Govern → Monitor → Prove → Act → Report).

Enterprise IT partners like **Atos** and **Avenga** are ideally positioned to co-develop and distribute Verisum to their regulated client base — turning an urgent compliance gap into a recurring revenue stream for both parties.

---

## 2. The Market Problem Partners' Clients Face

### The AI Governance Gap

Every enterprise is deploying AI — ChatGPT, Copilot, Claude, Midjourney, custom ML models. But governance has not kept pace:

- **EU AI Act** (enforced from August 2025) mandates risk classification, documentation, human oversight, and audit trails for AI systems
- **ISO 42001** (AI Management Systems) is becoming a procurement requirement for regulated sectors
- **Board-level anxiety** is rising — directors face personal liability for AI failures they cannot explain or evidence

### Why Existing Tools Fail

| Approach | Problem |
|----------|---------|
| Enterprise GRC (ServiceNow, Archer, OneTrust) | £100K+ setup, 6-12 month deployment, requires consultants |
| Manual spreadsheets | No scoring, no drift detection, no proof, no audit trail |
| AI-specific tools (Credo AI, Holistic AI) | Point solutions — no workflow, no self-serve, no cryptographic proof |
| Internal build | Diverts engineering from core product; never maintained |

### The Result

Most organisations — especially SMEs and mid-market — have **zero structured AI governance**. They know they need it, they do not know where to start, and they cannot justify £100K+ for a GRC platform. This is the gap Verisum fills.

---

## 3. What Verisum Is Today (Product Reality)

### Live Platform — Not a Concept

| Capability | Status |
|-----------|--------|
| Organisational governance assessments (TrustOrg) | Live |
| AI system risk assessments (TrustSys) | Live |
| Governance health scoring & maturity levels | Live |
| AI system registry & vendor management | Live |
| Remediation actions engine | Live |
| AI Governance Copilot (policy gen, risk templates, regulatory feed) | Live |
| Staff declarations & incident logging | Live |
| Board-ready PDF reports | Live |
| Drift detection & escalation workflows | Live |
| Self-serve billing (Stripe) | Live |
| Role-based access (Admin, Risk Officer, Board Viewer, Auditor, Signatory) | Live |
| 251 automated tests, CI/CD pipeline | Live |
| Cryptographic proof layer (Verify tier) | Architecture complete, build ready |

### Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript 5 (strict), Tailwind CSS 4
- **Backend:** Supabase (Postgres + RLS + Edge Functions), Node.js 22
- **Payments:** Stripe subscriptions + customer portal
- **Auth:** Supabase Auth (magic links, email/password, session cookies)
- **Infra:** Hostinger hosting, Vercel Analytics, PostHog
- **Proof Layer:** ethers.js v6 (Base L2 anchoring) — modular, optional

### Pricing

| Tier | Price | Target |
|------|-------|--------|
| Explorer (free) | £0/mo | Try before you buy |
| Starter (Core) | £79/mo | SMEs, early governance |
| Pro (Assure) | £199/mo | Scaling companies, mid-market |
| Enterprise (Verify) | Custom | Regulated enterprise, pharma, financial services |

---

## 4. Partnership Thesis: Why Atos

### Atos Profile

Atos is a global leader in digital transformation with deep presence in:
- **Cybersecurity & managed security services** — SOC operations, threat management
- **Regulated industries** — financial services, healthcare, public sector, defence
- **Digital workplace & cloud** — enterprise infrastructure, hybrid cloud
- **Decarbonisation & ESG** — sustainability reporting, compliance frameworks

### Strategic Alignment

| Atos Strength | Verisum Complement |
|--------------|-------------------|
| Security-first architecture (Zero Trust, SOC) | AI governance as the next security layer — "who approved this AI action?" |
| Regulated client base (finance, health, gov) | Verisum Verify provides cryptographic proof of governance — audit-ready |
| Large enterprise contracts (£500K-£5M+) | Verisum is a high-margin software add-on within existing engagements |
| Digital transformation consulting | AI governance is a mandatory workstream in every AI transformation |
| ESG & compliance expertise | AI governance maps directly to ESG reporting frameworks |

### What Atos Gets

1. **New revenue stream:** Verisum as a premium add-on to AI/digital transformation contracts — £50K-£500K+ per enterprise engagement
2. **Competitive differentiation:** Only systems integrator offering embedded, production-ready AI governance with cryptographic proof
3. **Customer stickiness:** Governance becomes compliance infrastructure — switching costs increase over time
4. **Margin profile:** High-margin SaaS resale (70%+ gross margin) on top of services revenue
5. **EU AI Act readiness:** Immediate answer to clients asking "how do we comply?"

### What Verisum Gets

1. **Enterprise distribution:** Access to Atos' regulated client base across Europe and globally
2. **Enterprise requirements:** Real-world feedback to harden the Enterprise tier
3. **Credibility:** Atos brand association validates Verisum for enterprise buyers
4. **Revenue:** Recurring SaaS revenue from enterprise contracts
5. **Co-development:** Joint IP on industry-specific governance templates (finance, health, defence)

---

## 5. Partnership Thesis: Why Avenga

### Avenga Profile

Avenga is a technology consultancy specialising in:
- **AI & GenAI advisory** — AI assistants, agents, copilots for enterprise
- **Regulated industries** — banking, automotive, life sciences, telecom
- **CTO/CISO advisory** — technical leadership for complex transformations
- **Custom software development** — enterprise-grade application builds

### Strategic Alignment

| Avenga Strength | Verisum Complement |
|----------------|-------------------|
| GenAI deployment advisory | Every AI deployment needs governance — Verisum is the product that delivers it |
| CISO & compliance focus | Verisum extends the security stack with human-intent verification |
| Industry reach (banking, pharma, automotive) | All high-TAM Verisum sectors |
| Proven ability to scale solutions into enterprise | Go-to-market capability for Verisum Enterprise |

### What Avenga Gets

1. **Productised offering:** Move from pure advisory to advisory + product — recurring revenue, not just project fees
2. **AI governance practice:** Build an AI governance practice around Verisum, not from scratch
3. **Client retention:** Ongoing governance management creates multi-year engagements
4. **Differentiation:** Only consultancy offering embedded cryptographic proof for AI governance
5. **EU AI Act delivery:** Ready-made compliance product for clients asking "make us compliant"

### What Verisum Gets

1. **Implementation partner:** Avenga delivers Verisum Enterprise implementations for complex clients
2. **Industry templates:** Co-develop governance templates for banking, automotive, life sciences
3. **Technical credibility:** Avenga CTO validation of architecture and security posture
4. **Pipeline:** Avenga's existing AI consulting engagements become Verisum opportunities
5. **Reference architectures:** Joint reference designs for regulated AI governance

---

## 6. Partnership Models

### Model A: Embedded Capability (Reseller)

Atos/Avenga recommends and provisions Verisum as part of AI transformation engagements.

- **Pricing:** Partner margin of 20-30% on SaaS subscription
- **Effort:** Minimal — configure, onboard, support
- **Revenue:** Recurring SaaS commissions
- **Best for:** Quick time-to-revenue, low integration effort

### Model B: Co-Developed Solutions (Joint IP)

Joint development of industry-specific governance packages:

- **"AI Governance for Financial Services"** — pre-configured risk frameworks, regulatory mappings, board report templates
- **"AI Governance for Healthcare"** — clinical AI risk matrices, patient safety escalations, MHRA/FDA compliance templates
- **"Human-Verified Infrastructure"** — Verisum Verify integrated into data centre operations, proving human intent behind critical changes

- **Pricing:** Premium pricing for vertical packages; shared IP ownership
- **Effort:** Moderate — 4-8 weeks per vertical
- **Revenue:** Higher ACV, defensible positioning
- **Best for:** Differentiation, competitive moat

### Model C: Managed AI Governance Service

Partner operates Verisum as a managed service for enterprise clients:

- **Pricing:** Monthly managed service fee (£5K-£50K/mo) including Verisum subscription + ongoing advisory
- **Effort:** Significant — requires trained governance analysts
- **Revenue:** Highest per-client revenue, longest contracts
- **Best for:** Large enterprise accounts, regulated sectors

---

## 7. Go-To-Market Approach

### Phase 1: Pilot (Month 1-3)

- Select 1-2 existing client accounts per partner
- Deploy Verisum Core + Assure tiers
- Run governance assessment, generate first board report
- Collect feedback, iterate on enterprise requirements
- Define joint value proposition and sales collateral

### Phase 2: Productise (Month 3-6)

- Co-develop 1-2 vertical governance packages (e.g., financial services, healthcare)
- Create partner-branded onboarding flows
- Build sales enablement kit (demo scripts, objection handling, ROI calculator)
- Train partner delivery teams on Verisum platform
- Launch joint press release / case study from pilot

### Phase 3: Scale (Month 6-12)

- Roll out across partner's client base
- Add Verisum Verify tier for regulated accounts requiring cryptographic proof
- Develop API integrations with partner's existing tooling (ServiceNow, Jira, etc.)
- Expand to additional verticals
- Joint conference appearances and thought leadership

---

## 8. Commercial Terms (Indicative)

| Element | Terms |
|---------|-------|
| Partner discount | 20-30% off list price on SaaS subscription |
| Minimum commitment | 3 pilot accounts in first 6 months |
| Revenue share on managed services | 70% partner / 30% Verisum |
| Co-developed IP | Shared ownership; both parties may use |
| Exclusivity | Non-exclusive (negotiable for specific verticals) |
| Contract term | 12-month initial partnership, annual renewal |

---

## 9. The Proof Layer Advantage (Verisum Verify)

This is the capability no competitor offers and no partner can build in-house. The Verify tier provides:

### What It Does
- **Human-Verified Approvals:** Cryptographically signed approval decisions (not just logged)
- **Governance Attestations:** Exportable, signed governance statements with verification IDs
- **Provenance Certificates:** AI output chain-of-custody (model version, data sources, reviewer)
- **Incident Lock:** Forensic freeze — cryptographic snapshots making incidents tamper-resistant
- **Cross-Org Trust Exchange:** External proof validation between partners, regulators, auditors
- **On-Chain Anchoring:** Base L2 public verifiability of critical governance events

### Why It Matters for Enterprise
- **Regulators:** Can independently verify that governance occurred — not just that documentation exists
- **Boards:** Non-repudiable evidence that approval processes were followed
- **Auditors:** Tamper-resistant audit trail that cannot be retrospectively modified
- **Partners/Customers:** Portable trust — governance proof travels with AI outputs across organisations

### The Hard Boundary: Logged vs Signed

| Verisum Assure | Verisum Verify |
|----------------|----------------|
| Approval logged in database | Approval cryptographically signed |
| Escalation recorded | Escalation cryptographically bound |
| Incident tracked | Incident frozen immutably |
| Audit timeline | Tamper-resistant forensic bundle |

This is derived from the HAPP Protocol (Human-Anchored Provenance Protocol) — a cryptographic trust layer preserved as modular IP within Verisum. It is the only production-ready governance proof engine in the market.

---

## 10. Founder & Team

### Rob Fanshawe — Founder & CEO

- **Ex-COO, Fnality International** — scaled regulated blockchain infrastructure from concept to £100M+ Series C readiness
- Deep expertise in blockchain, fintech, agile systems, and governance design
- Built Verisum solo using AI-first development methodology (Claude Code as AI co-founder)
- 251 automated tests, 11-phase architecture, production-deployed — demonstrating that one founder with the right tools can build enterprise-grade software

### Development Methodology

Verisum was built using an AI-first development process:
- **Claude Code** as AI pair programmer / architect
- **BDD+ Continuous Testing** methodology (Given/When/Then, shift-left, shift-right)
- Full TypeScript strict mode, ESLint, automated CI/CD
- This methodology itself is a demonstration of how AI governance works in practice — the product governs AI, and AI built the product

---

## 11. Competitive Landscape

| Player | What They Do | What They Lack |
|--------|-------------|----------------|
| OneTrust | Privacy & GRC | No AI-specific governance, enterprise pricing, 6+ month deploy |
| Credo AI | AI governance assessments | No self-serve, no cryptographic proof, no copilot |
| Holistic AI | AI risk management | Point solution, no workflow, no continuous monitoring |
| IBM OpenPages | Enterprise GRC | Massive, expensive, not AI-specific |
| **Verisum** | **AI governance SaaS (assess → monitor → prove → act → report)** | **Live, self-serve, £79-£199/mo, cryptographic proof layer** |

### Why No One Else Has This

1. **Self-serve + Enterprise:** Other tools are either too simple (checklists) or too heavy (GRC platforms). Verisum scales from free tier to enterprise with the same codebase.
2. **Cryptographic Proof:** No competitor offers signed, verifiable governance decisions. Verisum Verify is unique.
3. **AI Copilot:** Policy generation, incident logging, regulatory feed, monthly compliance reports — built in, not bolted on.
4. **Speed:** 48-hour time-to-governance for SMEs; weeks (not months) for enterprise.

---

## 12. Call to Action

### Proposed Next Steps

1. **60-minute technical deep-dive** — Architecture walkthrough, live product demo, security posture review
2. **Pilot scope definition** — Identify 1-2 client accounts, agree success criteria
3. **Commercial terms** — Partnership agreement, pricing, revenue share
4. **Go-live** — Deploy pilot within 4 weeks of agreement

### Contact

**Rob Fanshawe**
Founder & CEO, Verisum Ltd
Email: rob@verisum.org
Web: https://verisum.org
Product: https://app.verisum.org

---

*Verisum: One platform. Three tiers. One narrative. From compliance panic to cryptographic proof.*
