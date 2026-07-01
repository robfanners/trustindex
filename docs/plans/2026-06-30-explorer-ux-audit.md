# Explorer UX Audit — Pre-Acquisition Push

**Date:** 2026-06-30
**Status:** Triage complete — fix sequencing in progress
**Source:** Live walkthrough by Rob (founder) of the Explorer (free tier) experience across all 11 reachable pages, dictated page-by-page with screenshots.
**Why now:** Rob's blocker for the next acquisition push is the support load that would land on him (solo founder) if signups hit a broken / confusing UX. This audit captures every issue worth fixing before driving traffic.

---

## Executive summary

11 pages walked. **~63 distinct issues** captured, grouped by 18 cross-cutting patterns. Severity profile:

| Severity | Count | Examples |
|---|---|---|
| Critical / Blocker | 8 | Security baseline gaps (no 2FA), fake seed data, dead-end 404s, missing essential form fields |
| High / Major | 35 | Upgrade redirects to pricing page (Pattern F), no first-time guidance (Pattern B), Explorer can't export own data (Pattern C) |
| Moderate / Minor | ~15 | Jargon undefined, copy improvements |
| Positive (keep + propagate) | 5 | Models page lock-state modal, Vendors upgrade CTA, Actions page works for Explorer |

**The single biggest theme:** Verisum gives free Explorer users a confusing tour of features they can't use, with broken paths back to pricing, while withholding control over data they *should* own. This is the opposite of a self-serve funnel — every interaction increases doubt rather than building intent to upgrade.

**The single most credibility-damaging finding:** Settings → Security has 2FA, active sessions, and security tokens all marked "Coming Soon." For a platform sold as AI governance, this is unacceptable table-stakes failure. Any prospect doing diligence will fail Verisum within 30 seconds.

---

## Pattern catalog (cross-cutting)

These are the recurring causes — fix at the pattern level wherever possible, not page-by-page.

| Pattern | Description | Worst offenders |
|---|---|---|
| **A** | Gated features show enabled-looking CTAs that lead to paywalls. Should be greyed/hidden + clearly labelled "Locked". | Control Centre, TrustGraph (View all), AI Registry |
| **B** | No first-time / empty-state guidance per page. Every section needs a "this does X — do Y to start". | Every page except Actions and Models |
| **C** | Free Explorer over-locked on their own data — can't export their single survey result. Free tier should give full control of own data; gate the *multi-user / advanced* features. | TrustGraph Manage, TrustGraph Results |
| **D** | Fake/seed data presented as if real. Erodes trust instantly. | Control Centre notification bell, Drift Detection chart |
| **E** | Recommended next-step CTAs buried in body text instead of prominent cards. | TrustGraph Results, Reports tabs |
| **F** | Upgrade prompts redirect to full pricing page instead of inline modal with context-specific value prop. Punitive UX. | Policies (AI Generate), Compliance, AI Registry |
| **G** | Forms missing essential fields. | Policies "New Policy" modal has no content field |
| **H** | Dropdowns lock to predefined list with no "Add new" escape hatch. | Policy Type dropdown |
| **I** | Jargon used without inline definition. | "References / Supersede", "Accept as Action", "Attestation", "Provenance" |
| **J** | Approval workflows exist in UI but don't require segregation of duties — single user can create, review, and approve own work. Feels fake. | Policies approval flow |
| **K** | Information architecture conflates distinct concepts. | "Register System" routes through TrustGraph assessment |
| **L** | Pages exist in left nav that have effectively no functionality for current plan. Strategic question: hide / grey / show-with-teaser? | AI Registry, Models, Vendors |
| **M** | Terminology collisions across menus. | "AI Registry" vs "AI Vendors" vs "AI Models" vs "System assessments" — overlapping nouns |
| **N** | Inconsistent lock-state UX across similar pages. | Models (good modal) vs AI Registry (broken redirect) vs Vendors (partial) |
| **O** | Dead links / dead-end routing. | Bell actions → 404, "All updates" → nothing, "Connect more feeds" → wrong settings page, docs.verisum.org → DNS failure |
| **P** | CTAs say "do X" but destination doesn't make X obvious or easy (handoff problem). | Reports → "add role" → Settings (Edit button hidden top-right) |
| **Q** ⚠️ | **CRITICAL.** Security baseline gaps unacceptable for a governance product. | Settings → Security (2FA, sessions, tokens all "Coming Soon") |
| **R** | Silent state changes after profile edits + rendering glitches. | Setting role unlocks Reports with no feedback; "MONITOR" nav label rendered as "View Bal" |

**✅ Canonical good pattern — propagate everywhere:** **Models page lock-state.** Clear "Available on Verisum Assure" message → "Learn more" opens **inline modal** with value prop ("Drift detection, Escalation workflows, Runtime monitoring, Incident capture, Advanced reporting") → dual CTA ("View Plans & Pricing" / "Maybe later"). This is the template all other locked features should match.

---

## Critical (P0) — fix before any acquisition push

Single-page summary of must-fix items. Everything else triages off these.

| # | Issue | Pattern | Source |
|---|---|---|---|
| P0.1 | **No 2FA, no session management, no security tokens** — all "Coming Soon" on a security/governance product. Ship for all tiers, including Explorer. | Q | Page 9.4 |
| P0.2 | **Fake seed data on Control Centre** — Drift Detection chart shows old "System Assessments 109d/114d ago" + notification bell shows 5 fake "overdue actions". Remove or empty-state. | D | Page 1.2, 1.4 |
| P0.3 | **Bell action clicks → 404**. Fix the routing or remove the actions. | O | Page 1.3 |
| P0.4 | **Policy "New Policy" modal has no content field** — can't actually create a policy. | G | Page 3.3 |
| P0.5 | **docs.verisum.org has no DNS** — Help "?" → Documentation → Safari can't find server. Provision a basic docs site or remove the link. | O | Page 11.1 |
| P0.6 | **"All updates" link in Regulatory Feed → dead** | O | Page 7.3 |
| P0.7 | **"Connect more feeds" button → wrong page (settings/integrations has no regulatory feed options)** | O | Page 7.4 |
| P0.8 | **15 dep CVEs (1 Critical, 5 High)** — RESOLVED 2026-06-30 via PR #20 (vitest RCE, Next.js middleware bypass, undici TLS bypass, etc.) | Q-adjacent | Hostinger scan |

---

## Page-by-page findings

### Page 1 — Control Centre

| # | Issue | Severity | Pattern |
|---|---|---|---|
| 1.1 | No clear "what to do" primary action when free user lands here | High | B |
| 1.2 | Notification bell has 5 fake "overdue actions" ("Establish quarterly review board", etc.) | **Blocker** | D |
| 1.3 | Clicking any bell action → 404 | **Blocker** | O |
| 1.4 | Drift Detection shows 8 results from 109d/114d ago for a brand new account — fake seed data | **Blocker** | D |
| 1.5 | "Start setup wizard" CTA → routes free user to upgrade page (misleading, looks like the wizard) | High | F + A |
| 1.6 | Quick Actions (Escalate Incident, New Assessment, etc.) — unclear if they work for free user or paywall | High | A |
| 1.7 | Verisum Score shows 0/100 — no context for what it means or how to improve | Minor | E + I |

### Page 2 — TrustGraph (Overview / TrustOrg / Manage / Results)

| # | Issue | Severity | Pattern |
|---|---|---|---|
| 2.1 | No "what to do" guidance for users who land before doing Explorer assessment | High | B |
| 2.2 | TrustSys card "View all" link visible despite being Core+ gated | High | A |
| 2.3 | No "Take your free survey" prompt for users who signed up without doing Explorer first | High | B |
| 2.4 | Survey detail (Manage): CSV download blocked for Explorer — but it's their OWN single result | High | C |
| 2.5 | Results page: "Recommended next step" buried in body text | High | E |
| 2.6 | "Run organisational survey" button confusing for Explorer (is effectively an upgrade flow) | Minor | A |
| 2.7 | Results page: Explorer blocked from Export & Share — but it's their own data | High | C |
| 2.8 | Dimensions and Actions section: no explanation of what "Accept as Action" does | High | B + I |
| 2.9 | General: every page needs a "what is this" intro on first visit | **Blocker** (cross-cutting) | B |

### Page 3 — Policies

| # | Issue | Severity | Pattern |
|---|---|---|---|
| 3.1 | "AI Generate" button for Explorer → redirects to pricing page | High | F |
| 3.2 | Pattern: every upgrade prompt redirects to pricing page rather than inline modal | High (cross-cutting) | F |
| 3.3 | New Policy modal only has Title + Type — **no actual content field** | **Blocker** | G |
| 3.4 | Policy Type dropdown has no "Add new" option | High | H |
| 3.5 | Linked Systems "References / Supersede" dropdown — no explanation of meaning | High | I |
| 3.6 | When no systems exist (Explorer), Linked Systems shows "No systems found" instead of upgrade prompt | High | A + F |
| 3.7 | Explorer / single user can create + review + approve own policy — no segregation of duties | High | J |
| 3.8 | No onboarding intro for Policies page | High | B |

**Rob quote:** *"you click on AI generate and it takes you to the pricing page overall that's an issue we have with all the upgrade functions… I think there's two step processes a lot better because it's annoying. Keep landing on the pricing page."*

### Page 4 — AI Registry

| # | Issue | Severity | Pattern |
|---|---|---|---|
| 4.1 | Nothing actionable for Explorer — empty state with "Register System" CTA routing to upgrade | High | A + B |
| 4.2 | "Register System" routes through TrustGraph (TrustSys assessment) — conflates "register" and "assess" | High | K |
| 4.3 | If must route via TrustGraph, button copy should explain ("Assess to register a system") | Minor | I |
| 4.4 | Upgrade prompt redirects to pricing page | High | F |
| 4.5 | **STRATEGIC:** Should pages like AI Registry, Models, Vendors appear in left nav for Explorer at all? Options: (a) hidden, (b) greyed/locked, (c) shown with sample data preview | Strategic | L |

### Page 5 — Vendors

| # | Issue | Severity | Pattern |
|---|---|---|---|
| 5.1 | ✅ Better than other pages — explicit "Upgrade to add vendors" CTA | Positive | — |
| 5.2 | But "Register your first vendor" button does nothing when clicked | High | O |
| 5.3 | "Register your first vendor" wording collides with "AI Registry" | High | M |
| 5.4 | Cross-cutting: "System assessments", "AI Registry", "AI Vendors", "AI Models" — taxonomy needs rework | Strategic | M |
| 5.5 | Whatever IA principle lands for AI Registry should apply here | Strategic | L |

### Page 6 — Models ⭐

| # | Issue | Severity | Pattern |
|---|---|---|---|
| 6.1 | ✅ **BEST PATTERN.** Clear "Available on Verisum Assure" + "Learn more" → inline modal with value prop + dual CTA | **Positive (template)** | ✅ |
| 6.2 | Inconsistent with AI Registry + Vendors — three similar pages, three different lock UX | High | N |
| 6.3 | Strategic: should Assure-only features appear in Core/Explorer nav at all? | Strategic | L |
| 6.4 | Modal lacks contextual "what is a Model Registry and why do I want one" copy — features listed are generic | Minor | I |

**Rob quote:** *"this one does have the best practice of Learn more takes you to a model for upgrade rather than stretch the pricing page and does give you some information of what you do get if you did upgrade… vendors light registry should be treated in a consistent way."*

### Page 7 — Regulation & Compliance

| # | Issue | Severity | Pattern |
|---|---|---|---|
| 7.1 | Compliance Frameworks: "Start setup wizard" + "Configure" both redirect to pricing | High | F |
| 7.2 | ✅ Regulatory Feed tab has free content for Explorer (4 default feeds) | Positive | — |
| 7.3 | "All updates" link top-right → dead | **Blocker** | O |
| 7.4 | "Manage regulatory feed integrations" + "Connect more feeds" → settings/integrations (which has no regulatory feed options) | High | O |
| 7.5 | Pick one: build feed integration UI OR open upgrade modal explaining "Connect more feeds is Core/Assure". Don't leave dead-ends. | High | O |

### Page 8 — Actions

| # | Issue | Severity | Pattern |
|---|---|---|---|
| 8.1 | Empty state needs clearer guidance: "Create actions from your assessment results — they'll appear here for tracking" | Minor | B |
| 8.2 | ✅ Page works fine for Explorer — actions appear, can manage/complete | Positive | — |
| 8.3 | ✅ Right-side detail panel works well (notes, status, activity log) | Positive | — |
| 8.4 | "Backlog: Connect your backlog via the Integrations page" — verify Integrations page actually has backlog support, else Pattern O | Minor | O (TBD) |

### Page 9 — Settings (Account / Organisation / Security / Integrations)

| # | Issue | Severity | Pattern |
|---|---|---|---|
| 9.1 | Reports tells user "add a role" → Settings → role isn't inline-editable. Have to find small "Edit" button top-right of Account box. Deep-link should auto-open edit mode. | High | P |
| 9.2 | Organisation tab: three empty cards with no add buttons, just a link to Integrations. Either Explorer-locked (then say so + upgrade modal) or missing add buttons | High | C + L |
| 9.3 | Integrations tab: HiBob shows "Connect" + GitHub has working form — Explorer shouldn't be able to use these. No lock state, no plan indication. Grey + upgrade modal (Models pattern) | High | F + N |
| 9.4 | ⚠️ **CRITICAL.** Security tab: 2FA, Active Sessions, Security Tokens all "Coming Soon." Unacceptable for a security platform. Must ship for ALL tiers, especially Explorer. | **CRITICAL** | Q |
| 9.5 | After setting role to "Chief Risk Officer", Reports + Monitor opened up — but no feedback to user. ("MONITOR" label appearing as "View Bal" was a dictation transcription error — string doesn't exist in code; investigated 2026-06-30, see task #39.) Real bug is silent sidebar mutation + the strategic question of whether locked sections should appear at all for lower plans (see Page 4.5 / 6.3 / Pattern L). | High | R + L |
| 9.6 | "0 of 0" Systems framing looks like an error. Should say "0 of 0 — upgrade to assess systems" | Minor | E |
| 9.7 | Whole Account Information section needs Edit affordance to be more discoverable (button not link, or per-field inline edit) | Minor | P |

### Page 10 — Reports

| # | Issue | Severity | Pattern |
|---|---|---|---|
| 10.1 | ✅ Reports works for Explorer (after role added) | Positive | — |
| 10.2 | Assessment History says "No completed assessments" — but user HAS a completed Explorer self-assessment. Fix query filter, or link it directly. | High | C (query bug) |
| 10.3 | No persistent upgrade callout on each Report tab — should show "Upgrade to produce a board report" (Models modal pattern) | High | E + F |
| 10.4 | Board Summary shows Trust Health 0.0 / TrustOrg 0.0 / TrustSys 0.0 — zero-state framed as real data. Should say "Complete an assessment to see your scores" | High | D |

### Page 11 — Top-right header

| # | Issue | Severity | Pattern |
|---|---|---|---|
| 11.1 | "?" → Documentation → `docs.verisum.org` → DNS failure ("Safari can't find server") | **Blocker** | O |
| 11.2 | "?" → Contact Support — verify it works | TBD | — |
| 11.3 | "?" → What's New — verify it works | TBD | — |
| 11.4 | Bell icon — already logged (Page 1.3) as 404s | **Blocker** | O |
| 11.5 | "+" Quick Create — verify Explorer behaviour (likely 403s) | TBD | A |
| 11.6 | Sparkle icon (between + and bell) — unclear purpose, no tooltip | Minor | I |

---

## Recommended fix sequencing

Working backwards from the goal ("Rob can drive signups without drowning in support"), here's the order:

### Sprint 1 — Trust & Credibility (1 week)
Stop the bleeding. These are the issues that fail a 30-second prospect review.

1. **P0.1** Ship 2FA (passkeys via Supabase Auth) — task #36
2. **P0.5** Fix docs.verisum.org dead link (provision basic Mintlify/GitBook OR remove link) — task #37
3. **P0.2** Remove fake seed data from Control Centre (Drift chart + bell)
4. **P0.3, P0.6, P0.7** Wire up or remove all dead links (bell actions, "All updates", "Connect more feeds")
5. **P0.4** Add content field to Policy creation modal
6. **9.5** Fix "View Bal" rendering glitch — task #39

### Sprint 2 — Propagate the Models Pattern (1 week)
One template, applied everywhere.

7. Replace every Pattern F upgrade-redirect with an inline modal modelled on the Models page
8. Apply consistent lock-state UX across Models / AI Registry / Vendors / Policies (Pattern N → Models template)
9. Replace fake "no data" empty states with "this section does X, do Y to start" guidance (Pattern B)

### Sprint 3 — Free Tier Done Right (1 week)
Give Explorer users full control of their own data so they trust the platform.

10. Unlock CSV export for own survey result (Pattern C)
11. Unlock Export & Share on Results page for own data
12. Fix Assessment History query filter so Explorer assessment shows up (Page 10.2)
13. Add persistent upgrade callouts on Report tabs (Models modal pattern)
14. Fix zero-state framing on Board Summary (replace "0.0" with "Complete an assessment to see your scores")

### Sprint 4 — Information Architecture (1-2 weeks)
The strategic pieces — likely needs design pass before build.

15. Decide IA: should Assure-only pages appear in Explorer nav? (3 options listed at Page 4.5 / 6.3)
16. Resolve terminology collisions (Page 5.4) — "Registry / Register / Vendor / Model / Assessment / System"
17. Decide "Register System" routing — keep current TrustGraph route but explain, OR separate flows
18. Fix Reports → Settings handoff (Page 9.1) — deep-link to edit mode

### Sprint 5 — Polish & Onboarding (ongoing)
19. Define every piece of jargon inline on first encounter (Pattern I)
20. Add tooltips to header icons (Sparkle, Quick Create)
21. Decide approval-workflow story (Pattern J) — labelled sandbox OR multi-user only

---

## First batch — what to ship next

Three things, ranked by impact / effort:

**1. The "View Bal" nav glitch** (task #39, ~30 min)
Quick win. Investigate and fix today. Currently the sidebar is rendering garbage to anyone who edits their role — a known visible defect.

**2. The Models-pattern upgrade modal as a reusable component** (~1 day)
Build one `<UpgradeModal feature="..." plan="..." valueProps={...} />` component. Then a series of small PRs swapping out every Pattern F page redirect for this modal. Each swap is ~15 minutes. Pays off across Sprint 2.

**3. Remove fake seed data + dead links** (P0.2, P0.3, P0.6, P0.7, ~2-4 hours)
Trust-killer items. Can ship in a single small PR. Bell actions cleared, Drift chart guarded, "All updates" + "Connect more feeds" disabled or wired up.

After these three, the platform passes the 30-second smell test, and Sprint 1's bigger items (2FA, docs site) become the credibility moat.

---

## Related work

- **Security baseline:** [project_security_baseline_gap memory] — must ship before acquisition push
- **Dep CVE fix:** [PR #20 — 2026-06-30] — 15 CVEs → 0, deployed clean
- **Pricing/feature alignment:** task #21 — partially overlaps with Sprint 3 here
- **Pre-existing UX harmonisation plan:** `docs/plans/2026-02-27-ux-fixes-and-harmonisation.md` — worth cross-referencing

---

## Appendix — pattern frequency

How often each pattern appeared across the 11 pages (rough count):

| Pattern | Pages affected | Count |
|---|---|---|
| F (upgrade → pricing redirect) | 1, 3, 4, 7, 9, 10 | 7+ |
| B (no first-time guidance) | 1, 2, 3, 4, 6, 7, 8, 9 | 8+ |
| O (dead links) | 1, 7, 8, 9, 11 | 6+ |
| A (gated CTAs look enabled) | 1, 2, 4, 9, 11 | 5+ |
| D (fake seed data) | 1, 10 | 3 |
| C (Explorer over-locked on own data) | 2, 9, 10 | 3 |
| L (nav shows non-functional pages) | 4, 6 | strategic |
| N (inconsistent lock UX) | 4, 5, 6, 9 | 4 |
| Q (security baseline) | 9 | **1 — CRITICAL** |

**Implication:** Patterns F, B, and O together account for the bulk of the issues. Fixing those three patterns once at the framework level resolves >50% of the audit findings.
