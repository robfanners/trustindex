# Verisum — CLAUDE.md

## Project Overview

AI governance platform. Helps organisations measure, monitor, and prove responsible AI usage. Built by Verisum Ltd (solo founder: Rob Fanshawe).

**Live URL:** https://app.verisum.org
**Repo:** github.com/robfanners/trustindex

## Tech Stack

- **Framework:** Next.js 16.1.6 (App Router, Node.js runtime, Turbopack disabled)
- **Language:** TypeScript 5 (strict mode)
- **UI:** React 19, Tailwind CSS 4
- **Database:** Supabase (Postgres + RLS + Edge Functions)
- **Auth:** Supabase Auth (magic links, email/password, cookie-based sessions)
- **Payments:** Stripe 20.3.1 (checkout sessions, webhooks, subscriptions)
- **PDF Export:** jsPDF 4.2.0 + html2canvas 1.4.1
- **Charts:** Recharts 3.6.0
- **Hosting:** Hostinger (Next.js via git deploy, Node 22)

## Commands

```bash
npm run dev          # Dev server at 127.0.0.1:3000
npm run dev:3001     # Parallel dev server at port 3001
npm run build        # Production build (use to verify changes)
npm run start        # Start production server
npm run lint         # ESLint
```

## Project Structure

```
src/
  app/                      # Next.js App Router
    api/                    # API routes (~50+ endpoints)
      stripe/               # checkout, webhook, portal
      trustgraph/           # health, drift, escalations, reassessment (internal engine name)
      trustsys/             # system assessments
      copilot/              # policies, monthly-report
      declarations/         # staff declaration tokens + submissions
      incidents/            # AI incident logging
      regulatory/           # regulatory feed CRUD
      vendors/              # AI vendor register
      reports/              # summary, history, analytics
      verisum-admin/        # admin dashboard, org management, audit
      org/                  # teams, subsidiaries, functions
      integrations/         # HiBob OAuth + sync
    auth/                   # Login, callback, complete
    dashboard/              # Main hub (Overview, TrustOrg, TrustSys tabs)
    trustorg/               # Org-level survey module
    trustsys/               # System assessment module
    actions/                # Remediation tracking
    reports/                # Report views
    upgrade/                # Pricing page
    verisum-admin/          # Admin dashboard
    try/                    # Public explorer mode (no auth)
  components/
    header/                 # ModuleSwitcher, GlobalSearch, NotificationBell, UserMenu, QuickCreate
    copilot/                # CopilotDashboard, VendorRegister, IncidentLog, RegulatoryFeed
    vcc/                    # Admin components (VCCShell, MetricCard, ConfirmDialog)
    AppShell.tsx            # Public page shell
    AuthenticatedShell.tsx  # Authenticated shell with sidebar
    AccessGate.tsx          # Role/permission gate
    RequireAuth.tsx         # Auth requirement wrapper
  context/
    AuthContext.tsx          # useAuth() hook: user, profile, loading, signOut
    VCCAuthContext.tsx       # Admin auth context
  lib/
    entitlements.ts         # Plan limits + feature checks (pure + server)
    stripe.ts               # Stripe singleton (getStripe())
    supabaseServer.ts       # Service role client (bypasses RLS)
    supabase-auth-server.ts # Auth client for API routes
    supabase-auth-browser.ts# Anon client for browser
    supabase-auth-middleware.ts # Middleware session refresh
    trustGraphTiers.ts      # Score → tier classification (Trusted/Stable/Elevated/Critical)
    systemScoring.ts        # Assessment scoring engine
    pdfExport.ts            # PDF generation pipeline
    email.ts                # Resend wrapper with graceful fallback
    emailTemplates.ts       # Welcome, monthly report, declaration reminder, policy ready
    url.ts                  # Safe origin resolution (server + client)
supabase/
  migrations/               # SQL migrations (004–014)
```

## Key Patterns

### API Routes
```typescript
// Standard pattern: auth → DB query → response
const authClient = await createSupabaseServerClient();
const { data: { user } } = await authClient.auth.getUser();
if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

const db = supabaseServer(); // service role, bypasses RLS
const { data, error } = await db.from("table").select("*").eq("user_id", user.id);
return NextResponse.json({ data });
```

### Supabase Clients (3 types — use the right one)
| Client | File | Use When |
|--------|------|----------|
| `createSupabaseServerClient()` | `supabase-auth-server.ts` | API routes needing user auth (respects RLS) |
| `supabaseServer()` | `supabaseServer.ts` | Server-only operations needing full DB access |
| `createSupabaseBrowserClient()` | `supabase-auth-browser.ts` | Client components |

### Entitlements
Pure functions for client+server: `canCreateSurvey()`, `canExportResults()`, `hasBillingAccess()`.
Server-only DB queries: `getUserPlan()`, `getUserSurveyCount()`.

### Auth Flow
- Middleware refreshes Supabase session on every request
- `<RequireAuth>` wrapper for protected pages
- `<RoleGate>` / `<AccessGate>` for permission-based access
- API routes manually check `auth.getUser()`

### URL Safety
- `getServerOrigin(req)` for server-side origin detection
- `getClientOrigin()` for browser
- `safeRedirectPath()` prevents open redirect attacks

## Current Pricing Tiers

| Tier | Price | Surveys | Systems | Copilot | Export |
|------|-------|---------|---------|---------|--------|
| Explorer | Free | 1 | 0 | No | No |
| Starter | £79/mo | 3 | 1 | Basic | Yes |
| Pro | £199/mo | 5 | 2 | Full | Yes |
| Enterprise | Custom | Unlimited | Unlimited | Full | Yes |

## Database

**Supabase project:** ktwrztposaiyllhadqys.supabase.co
**Migrations:** `supabase/migrations/` (004–014)

Key tables: `profiles`, `organisations`, `survey_runs`, `systems`, `system_runs`, `trustgraph_health_mv` (materialized view), `escalations`, `reassessment_policies`, `actions`, `ai_policies`, `declaration_tokens`, `staff_declarations`, `ai_vendors`, `incidents`, `regulatory_updates`.

RLS enabled on all tables. Service role client used for cross-org admin queries.

## Environment Variables

See `.env.example` for full list. Critical ones:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase connection
- `SUPABASE_SERVICE_ROLE_KEY` — Server-only DB access
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` — Stripe billing
- `STRIPE_STARTER_MONTHLY_PRICE_ID` / `STRIPE_STARTER_YEARLY_PRICE_ID` — Starter tier prices
- `STRIPE_PRO_MONTHLY_PRICE_ID` / `STRIPE_PRO_YEARLY_PRICE_ID` — Pro tier prices
- `ANTHROPIC_API_KEY` — Claude API for AI policy generation
- `RESEND_API_KEY` / `RESEND_FROM_EMAIL` — Transactional email via Resend
- `CRON_SECRET` — Authenticates scheduled jobs (monthly report via Make.com)
- `NEXT_PUBLIC_SITE_URL` — Canonical site URL
- `SYSADMIN_CODE` / `VERISUM_ADMIN_CODE` — Admin access codes

## Modules

- **TrustOrg:** Org-level trust readiness surveys across governance dimensions
- **TrustSys:** Individual AI system assessments with scoring engine
- **AI Governance Copilot:** Policy generator, staff declarations, vendor register, incidents, regulatory feed, monthly reports
- **Actions:** Remediation tracking from recommendations
- **Reports:** PDF export, dimension-level insights, charts
- **VCC (Verisum Control Centre):** Internal admin dashboard

## Conventions

- App Router (no Pages Router)
- Client components use `"use client"` directive
- Hash-based tab navigation on dashboard (`useHashTab()`)
- Stripe metadata stores `supabase_user_id` for webhook matching
- Token-based public access for surveys (no auth required for respondents)
- Materialized views for performance-critical health score queries
- All API errors return `{ error: string }` with appropriate HTTP status

## Deployment — MANDATORY RULES

**Read `DEPLOY.md` for full details. These rules are non-negotiable:**

1. **app.verisum.org deploys via git push to `main`** — Hostinger auto-builds from GitHub. NEVER zip this repo. NEVER disconnect the GitHub ↔ Hostinger integration.
2. **The marketing site (verisum.org) is a SEPARATE project** — it uses static zip upload to Hostinger. Do not confuse the two.
3. **Always run `npm run predeploy` before pushing to main** — this runs TypeScript checks, lint, build, and tests. The git pre-push hook enforces this automatically.
4. **Database migrations go to Supabase FIRST, then deploy code** — never deploy code that references columns/tables that don't exist yet.
5. **Environment variables are set in the Hostinger dashboard** — never commit secrets to git, never modify env vars on the server directly.
6. **Never force-push to main** — use `git revert` for rollbacks.
7. **Feature branches merge to main via PR** — squash merge preferred for clean history.

## In Progress

See `docs/plans/` for implementation plans:
- AI Governance Copilot features (policy generator, staff declarations, vendor register, incidents, regulatory feed)
- Starter tier (£79/mo) addition
- Email integration (Resend)
- Business ops toolstack (Notion, Linear, Make.com)
