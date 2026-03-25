# Verisum — TrustIndex

AI governance platform. Helps organisations measure, monitor, and prove responsible AI usage.

**Live:** https://app.verisum.org · **Stack:** Next.js 16 · TypeScript 5 · React 19 · Supabase · Stripe · Tailwind CSS 4

---

## Prerequisites

- Node.js 22+
- npm 10+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for local DB work)

---

## Quick Start

```bash
git clone https://github.com/robfanners/trustindex
cd trustindex
cp .env.example .env.local   # fill in values — see table below
npm install
npm run dev                  # http://127.0.0.1:3000
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Server-only service role key |
| `STRIPE_SECRET_KEY` | ✅ | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | ✅ | Stripe webhook signing secret |
| `STRIPE_STARTER_MONTHLY_PRICE_ID` | ✅ | Stripe price ID for Starter monthly |
| `STRIPE_STARTER_YEARLY_PRICE_ID` | ✅ | Stripe price ID for Starter yearly |
| `STRIPE_PRO_MONTHLY_PRICE_ID` | ✅ | Stripe price ID for Pro monthly |
| `STRIPE_PRO_YEARLY_PRICE_ID` | ✅ | Stripe price ID for Pro yearly |
| `ANTHROPIC_API_KEY` | ✅ | Claude API key for policy generation |
| `RESEND_API_KEY` | ✅ | Resend transactional email |
| `RESEND_FROM_EMAIL` | ✅ | From address for outgoing email |
| `CRON_SECRET` | ✅ | Authenticates scheduled jobs (Make.com) |
| `NEXT_PUBLIC_SITE_URL` | ✅ | Canonical site URL (e.g. https://app.verisum.org) |
| `SYSADMIN_CODE` | ✅ | Access code for sysadmin routes |
| `VERISUM_ADMIN_CODE` | ✅ | Access code for VCC admin dashboard |

See `.env.example` for the complete list.

---

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Dev server at http://127.0.0.1:3000 |
| `npm run dev:3001` | Parallel dev server at port 3001 |
| `npm run build` | Production build (run before deploying) |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |

---

## Testing

```bash
npx vitest run              # run all tests once
npx vitest                  # watch mode
npx vitest run --coverage   # with coverage report (requires @vitest/coverage-v8)
```

Coverage thresholds: **30% lines · 30% functions · 25% branches** — enforced by CI on every PR.

Test files live in `src/lib/__tests__/`. Core unit tests cover `systemScoring`, `entitlements`, `trustGraphTiers`, and `apiHelpers`.

---

## Architecture

Built on the Next.js App Router (Node.js runtime, Hostinger). Auth and database are Supabase (Postgres + RLS + Auth). Payments via Stripe subscriptions. Transactional email via Resend. AI policy generation via Anthropic API (Claude Sonnet). Charts via Recharts; PDF export via jsPDF + html2canvas.

All API routes live in `src/app/api/` and follow a standard pattern using `requireAuth()` from `src/lib/apiHelpers.ts`. See `CLAUDE.md` for full architectural detail.

---

## Modules

| Module | Path | Description |
|---|---|---|
| **TrustOrg** | `/trustorg` | Org-level trust readiness surveys |
| **TrustSys** | `/trustsys` | Individual AI system assessments |
| **Copilot** | `/govern` | Policy generator, vendor register, incidents, regulatory feed |
| **Actions** | `/actions` | Remediation tracking from recommendations |
| **Reports** | `/reports` | PDF export, dimension insights, charts |
| **VCC** | `/verisum-admin` | Internal Verisum admin dashboard |

---

## Pricing Tiers

| Tier | Price | Surveys | Systems | Copilot | Export |
|---|---|---|---|---|---|
| Explorer | Free | 1 | 0 | No | No |
| Starter | £79/mo | 3 | 1 | Basic | Yes |
| Pro | £199/mo | 5 | 2 | Full | Yes |
| Enterprise | Custom | Unlimited | Unlimited | Full | Yes |

Tier limits are the single source of truth in `src/lib/entitlements.ts` (`PLAN_CONSTANTS`).

---

## Key Patterns

### API Authentication
Every protected route uses `requireAuth()`:
```typescript
import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { user, orgId, db } = auth;
  // ...
  return apiOk({ data });
}
```

### Supabase Clients

| Client | File | Use When |
|---|---|---|
| `createSupabaseServerClient()` | `supabase-auth-server.ts` | Auth-aware API routes |
| `supabaseServer()` | `supabaseServer.ts` | Server operations needing full DB access |
| `createSupabaseBrowserClient()` | `supabase-auth-browser.ts` | Client components |

### Entitlements
```typescript
import { canCreateSurvey, PLAN_CONSTANTS } from "@/lib/entitlements";
```

---

## Database Migrations

Migrations live in `supabase/migrations/`. The baseline schema (`00000000000000_initial_schema.sql`) covers all tables. Subsequent numbered migrations apply incremental changes.

```bash
supabase db reset   # reset a local dev database
```

Never modify production directly — always write a migration and deploy code first.

---

## Deployment

See `DEPLOY.md` for full rules. Key points:

- `app.verisum.org` deploys via `git push` to `main` — Hostinger auto-builds from GitHub
- Always run `npm run build` locally before pushing (pre-push hook enforces this)
- Database migrations go to Supabase **before** code deployment
- Env vars are set in the Hostinger dashboard — never commit secrets
- Never force-push to `main` — use `git revert` for rollbacks
