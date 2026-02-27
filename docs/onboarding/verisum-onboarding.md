# Welcome to Verisum

## Who We Are

Verisum builds AI governance tools for small and medium-sized businesses. We help organisations assess, monitor, and demonstrate responsible AI usage — turning a compliance headache into a competitive advantage.

**Founded:** 2025 | **Founder:** Rob Fanshawe | **HQ:** UK

## Why We Exist

Most SMEs are using AI tools every day — ChatGPT, Copilot, Claude, Midjourney — but have zero governance around it. No policies, no oversight, no audit trail. When regulation catches up (and the EU AI Act already has), they're exposed.

Enterprise GRC platforms cost six figures and take months to implement. Consultants charge by the hour and leave you with a PDF. Neither works for a 20-person agency or a 50-person accountancy firm.

**Verisum fills the gap:** a lightweight, affordable SaaS that gets an SME from "we use AI but have no idea if we're compliant" to "we're covered" in 48 hours.

## What We Build

### TrustGraph (our platform)
- **TrustOrg:** Organisation-level AI governance assessments
- **TrustSys:** Individual AI system risk assessments
- **AI Governance Copilot:** Policy generator, staff declaration portal, vendor register, incident logging, regulatory feed, monthly compliance reports
- **Live at:** https://trustindex.verisum.org

### Three Revenue Streams
1. **SaaS subscriptions** (primary) — Explorer (free), Starter (£79/mo), Pro (£199/mo), Enterprise (custom)
2. **Consulting/advisory** — AI governance expertise for larger orgs
3. **Licensing/partnerships** — HAPP protocol and Human-HarmonAI framework IP

## Our Values

- **Plain English over legalese** — If a non-technical office manager can't understand it, we've failed
- **Practical over theoretical** — Every feature should help someone do something, not just tick a box
- **Automate the gathering, human-approve the action** — AI assists, humans decide
- **Ship fast, iterate faster** — Solo founder stage means speed matters, but never at the cost of trust (we're a trust company)

---

# Toolstack

## Why These Tools

Every tool was chosen for a solo-founder context: free or cheap to start, scales when needed, minimal admin overhead, and integrates with the others. No tool exists in isolation — they form a system.

## The Stack

| Function | Tool | Why This One | Cost |
|----------|------|-------------|------|
| **Code** | GitHub | Industry standard, CI/CD, Claude Code integration | Free |
| **Dev Environment** | Claude Code + CLAUDE.md | AI co-founder with persistent project memory | Within plan |
| **Database & Auth** | Supabase | Postgres + auth + RLS + edge functions in one | Free tier → £25/mo |
| **Hosting** | Vercel | Next.js native, instant deploys, cron jobs | Free tier → £20/mo |
| **Payments** | Stripe | Subscriptions, invoicing, webhooks, metrics | Transaction fees only |
| **CRM & Sales** | Apollo.io | LinkedIn-native prospecting, enrichment, sequences | Current plan |
| **Project Management** | Linear | Fast, keyboard-driven, developer-friendly | Free |
| **Knowledge Base** | Notion | Single source for business docs, SOPs, onboarding | Free → £8/mo |
| **Transactional Email** | Resend | Welcome emails, reports, reminders | Free (3k/mo) |
| **Automation** | Make.com | Connects everything: Stripe → Slack → Notion → Apollo | Free → £9/mo |
| **Comms & Alerts** | Slack | Notification hub, webhook target, async comms | Free |
| **Analytics** | PostHog / Vercel Analytics | Product usage understanding | Free |

**Total monthly cost at launch: ~£0.** Scales to ~£60/mo past free tiers.

---

# Ways of Working

## How We Ship Code

1. **Plan** — Write a design doc or implementation plan in `~/trustindex/docs/plans/`
2. **Branch** — Work in a feature branch or git worktree
3. **Build** — Claude Code assists, CLAUDE.md provides project context
4. **Verify** — `npm run build` must pass, test locally at 127.0.0.1:3000
5. **Commit** — Descriptive commit messages, one logical change per commit
6. **Deploy** — Push to main → Vercel auto-deploys to production
7. **Track** — Linear issues for anything non-trivial

## How We Make Decisions

- **Product decisions:** Design doc → review → approve → build
- **Tech decisions:** Smallest change that solves the problem. No over-engineering.
- **Business decisions:** Data where available, judgement where not. Move fast, course-correct often.

## Communication Principles

- **Async by default** — Write it down, don't schedule a meeting
- **Slack for alerts** — Automated notifications, quick questions
- **Notion for knowledge** — If it needs to persist, it goes in Notion
- **Linear for tasks** — If it needs doing, it goes in Linear

## Weekly Rhythm

| Day | Activity |
|-----|----------|
| **Monday** | Review weekly digest (automated via Make.com), set priorities in Linear |
| **Tue–Thu** | Build, ship, sell |
| **Friday** | Review metrics, update Notion docs, plan next week |

---

# Key Repos

| Repo | Purpose | Local Path |
|------|---------|-----------|
| **trustindex** | TrustGraph platform (primary product) | `~/trustindex` |
| **verisum-org** | Marketing website | `~/verisum.org` |
| **happ** | HAPP protocol (separate product, future merge planned) | `~/happ` |

All repos on GitHub under `robfanners`.

---

# Notion Workspace Structure

| Section | What Goes Here |
|---------|---------------|
| **Strategy** | Business plan, investor materials, board docs |
| **Product** | PRDs, roadmaps, backlogs (linked to Linear for execution) |
| **Technology** | Architecture docs, dev guidelines (linked to GitHub) |
| **Operations** | This onboarding doc, playbooks, SOPs |
| **Finance** | Models, projections, pricing strategy |
| **Partnerships** | GTM strategy, partner profiles, deal tracking |
| **Legal** | IP, trademarks, compliance docs |
| **Human-HarmonAI** | Framework, white papers, implementation guides |
| **Marketing** | Brand guidelines, content calendar, campaigns |
| **CRM** | Contact database (synced from Apollo via Make.com) |

---

# Automation Flows

## Flow 1: Lead Capture → CRM → Outreach
```
LinkedIn / website / Explorer signup
  → Apollo enrichment (auto)
  → Apollo sequence (auto)
  → Slack: "New lead: [name] at [company]"
  → Rob reviews + personalises if needed
```

## Flow 2: Signup → Onboarding → Activation
```
User signs up (Explorer or paid)
  → Supabase profile + org created
  → Resend welcome email + quickstart
  → Stripe webhook upgrades plan (if paid)
  → Make.com → Notion CRM + Slack alert
  → Day 3: "Run your first assessment?" email
  → Day 7: "Your AI policy is waiting" email (Starter+)
```

## Flow 3: Monthly Compliance Report
```
1st of month (Vercel cron)
  → For each Starter/Pro org:
    → Pull health + actions + declarations + vendors + incidents
    → Generate PDF
    → Email via Resend
    → Slack: "X reports generated"
```

## Flow 4: Weekly Business Digest
```
Every Monday (Make.com)
  → Pull: Stripe MRR, signups, active users
  → Pull: Apollo pipeline
  → Pull: Linear completed/open
  → Slack: "Weekly Pulse"
```

---

# Access & Accounts

When onboarding a new team member, they'll need access to:

- [ ] GitHub (`robfanners` org) — appropriate repo access
- [ ] Supabase — project access (read-only for most roles)
- [ ] Vercel — deployment dashboard
- [ ] Stripe — dashboard access (read-only unless billing role)
- [ ] Apollo.io — CRM access
- [ ] Linear — project board access
- [ ] Notion — workspace member
- [ ] Slack — workspace invite
- [ ] Make.com — scenario viewer (admin only edits)

---

# Getting Started Checklist (New Joiner)

- [ ] Read this onboarding document fully
- [ ] Get access to all tools listed above
- [ ] Clone the `trustindex` repo and run `npm install && npm run dev`
- [ ] Read `~/trustindex/CLAUDE.md` to understand the codebase
- [ ] Read the latest design doc in `~/trustindex/docs/plans/`
- [ ] Set up Claude Code with the project
- [ ] Join the Slack workspace
- [ ] Review the current Linear sprint
- [ ] Ship something small in your first week
