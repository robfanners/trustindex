# TrustGraph — Developer README

TrustGraph is Verisum's AI governance platform. It helps organizations govern, monitor, and prove the responsible use of AI systems across their enterprise.

**Core Pillars:**
- **Govern** — Design policies, assessments, and controls for AI systems (TrustSys, TrustOrg)
- **Monitor** — Track vendor risk, staff declarations, incidents, and compliance drift (Monitor module)
- **Prove** — Generate governance packs, attestations, and proof artifacts for auditors and regulators (Prove module)

---

## Prerequisites

- **Node.js:** 22.x (see `.github/workflows/ci.yml`)
- **npm:** 10.x or higher
- **Supabase account** — for auth, database, and RLS
- **Stripe account** — for billing (Checkout, Portal, Webhooks)
- **Resend account** — for transactional email
- **Anthropic API key** — for AI policy generation
- **GitHub account** — for deployment to Hostinger via Actions

---

## Local Setup

### 1. Clone the Repository
```bash
git clone https://github.com/verisum/trustindex.git
cd trustindex
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Set Up Environment Variables
Copy the example file and fill in your credentials:
```bash
cp .env.example .env.local
```

See **Environment Variables** section below for details.

### 4. Run Development Server
```bash
npm run dev
```

The app will be available at `http://127.0.0.1:3000`.

**Alternative port:**
```bash
npm run dev:3001  # runs on port 3001
```

---

## Environment Variables

Required environment variables (set in `.env.local`):

### Supabase
- `NEXT_PUBLIC_SUPABASE_URL` — Project URL from Supabase dashboard
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Public anon key (exposed to browser)
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (server-only, never exposed to client)

### Site Configuration
- `NEXT_PUBLIC_SITE_URL` — Canonical app URL (e.g., `http://127.0.0.1:3000` locally, `https://app.verisum.org` in prod). Used for auth redirects and Stripe return URLs.

### Stripe
- `STRIPE_SECRET_KEY` — Secret key from Stripe dashboard
- `STRIPE_WEBHOOK_SECRET` — Webhook signing secret (for validating webhook payloads)
- `STRIPE_STARTER_MONTHLY_PRICE_ID` — Starter plan monthly price ID
- `STRIPE_STARTER_YEARLY_PRICE_ID` — Starter plan yearly price ID
- `STRIPE_PRO_MONTHLY_PRICE_ID` — Pro plan monthly price ID
- `STRIPE_PRO_YEARLY_PRICE_ID` — Pro plan yearly price ID

### AI & Email
- `ANTHROPIC_API_KEY` — API key for Claude (used in policy generation)
- `RESEND_API_KEY` — API key for Resend email service
- `RESEND_FROM_EMAIL` — Default sender email (e.g., `noreply@verisum.org`)

### Internal Secrets
- `CRON_SECRET` — Used to authenticate scheduled jobs (e.g., monthly reports via Make.com)
- `KEEPALIVE_SECRET` — Used to authenticate the keepalive cron endpoint
- `SYSADMIN_CODE` — Admin code for system administration
- `VERISUM_ADMIN_CODE` — Verisum team admin code

---

## Architecture Summary

### Tech Stack
- **Framework:** Next.js 16+ (App Router)
- **Auth:** Supabase Auth (session via secure HTTP-only cookies)
- **Database:** PostgreSQL (Supabase) with Row-Level Security (RLS)
- **Billing:** Stripe (checkout, customer portal, webhooks)
- **Email:** Resend (transactional)
- **UI:** React 19, Tailwind CSS, Recharts (charts)
- **Testing:** Vitest + React Testing Library
- **Deployment:** GitHub Actions → Hostinger (manual git push to main)

### Key Modules

```
src/
├── app/                          # Next.js app router
│   ├── dashboard/                # Main user dashboard (surveys, systems, settings)
│   ├── prove/                    # Prove module (attestations, governance packs)
│   ├── monitor/                  # Monitor module (vendors, incidents, signals, drift)
│   ├── copilot/                  # AI policy generation
│   ├── trustsys/                 # TrustSystem assessments
│   ├── trustorg/                 # TrustOrg (subsidiary/team management)
│   ├── auth/                     # Auth flows (login, callback)
│   ├── api/                      # API routes (REST endpoints)
│   └── verisum-admin/            # Internal admin panel
│
├── lib/
│   ├── apiHelpers.ts             # Shared API route helpers (requireAuth, apiError, apiOk)
│   ├── entitlements.ts           # Plan tiers & feature gates
│   ├── supabaseServer.ts         # Service role client (server-only, bypasses RLS)
│   ├── supabase-auth-server.ts   # SSR auth client (respects user RLS)
│   ├── supabase-auth-browser.ts  # Browser client
│   ├── supabase-auth-middleware.ts  # Middleware auth client
│   └── ...
│
├── components/                   # Reusable React components
├── context/                      # React context (AuthContext, etc.)
├── middleware.ts                 # Route middleware (auth, redirects)
└── ...
```

### Auth Flow

1. **Middleware** (`src/middleware.ts`) — Runs on every request:
   - Refreshes Supabase auth session (keeps cookies fresh)
   - Redirects unauthenticated users to `/auth/login`
   - Whitelists public paths (`/auth`, `/survey`, `/api/public`, `/api/keepalive`, etc.)
   - Handles route redirects (legacy `/admin` → `/dashboard`)

2. **Browser Client** (`src/lib/supabase-auth-browser.ts`) — Used in client components:
   - Initialized with anon key
   - Safe for browser (never exposes service role)

3. **Server Client** (`src/lib/supabase-auth-server.ts`) — Used in server components & API routes:
   - Created from request cookies (SSR pattern)
   - Respects user's RLS policies
   - Used with `requireAuth()` in API routes

4. **Service Role Client** (`src/lib/supabaseServer.ts`) — Admin operations only:
   - Uses service role key
   - **Bypasses all RLS policies**
   - Server-side only (never exposed to client)
   - Used in: plan upgrades, usage tracking, admin operations

### Supabase Client Selection

| Client | Key Type | RLS? | Use Case |
|--------|----------|------|----------|
| Browser | Anon | ✓ | Client components, form submissions |
| Server (SSR) | Anon | ✓ | Server components, middleware |
| Service Role | Service | ✗ | Admin operations, trusted server code |

**Rule:** Always use the least privileged client. Only use service role when you explicitly need to bypass RLS.

---

## Key Patterns

### API Route Authentication

All API routes use the `requireAuth()` helper for consistent auth + org resolution:

```typescript
// src/app/api/example/route.ts
import { requireAuth, apiError, apiOk, parseBody } from "@/lib/apiHelpers";

export async function POST(req: Request) {
  const auth = await requireAuth({ withPlan: true });
  if (auth.error) return auth.error;

  const { user, orgId, plan, db } = auth;

  // Parse & validate request body
  const parsed = await parseBody(req, mySchema);
  if (parsed.error) return parsed.error;

  // Your logic here
  return apiOk({ message: "success" });
}
```

**Options:**
- `orgOptional: true` — Allow routes without an organization (default: false)
- `withPlan: true` — Fetch user's plan (default: false)

**Returns:**
- Success: `{ user, orgId, plan, db }` (SupabaseClient)
- Failure: `{ error: NextResponse }` — early return this

### Standardised API Responses

```typescript
import { apiOk, apiError } from "@/lib/apiHelpers";

// Success
return apiOk({ data: "..." }, 201);  // JSON + status

// Error
return apiError("Invalid input", 400);  // { error: string }
```

### Plan-Based Feature Gates

From `src/lib/entitlements.ts`:

```typescript
import { canCreateSurvey, canExportResults, isPaidPlan, PLAN_LIMITS } from "@/lib/entitlements";

// Check feature availability
if (\!canCreateSurvey(userPlan, currentCount)) {
  return <button disabled>Upgrade to create more surveys</button>;
}

// Get plan limits
const limits = PLAN_LIMITS[plan];  // { maxVendors, maxIncidentsPerMonth, ... }

// Plan-specific UI
{isPaidPlan(plan) && <PremiumFeature />}
```

**Plan Tiers:**
- `explorer` — Trial (no features)
- `starter` — Paid tier 1
- `pro` — Paid tier 2
- `enterprise` — Custom

---

## Testing

### Run Tests
```bash
npm run test          # Run once
npm run test:watch   # Watch mode
npm run test:coverage # Generate coverage report
```

### Test Configuration

Tests use **Vitest** + **React Testing Library**:
- Environment: jsdom
- Setup file: `vitest.setup.ts`
- Coverage threshold: 30% lines/functions, 25% branches
- Excludes: Next.js pages, React components, type definitions (tested via E2E instead)

**Test files:** `src/**/*.test.{ts,tsx}`

### Test Examples

```typescript
// src/lib/__tests__/entitlements.test.ts
import { canCreateSurvey, PLAN_LIMITS } from "@/lib/entitlements";

describe("entitlements", () => {
  it("should allow pro users to create multiple surveys", () => {
    expect(canCreateSurvey("pro", 5)).toBe(true);
  });

  it("should block explorer users", () => {
    expect(canCreateSurvey("explorer", 0)).toBe(false);
  });
});
```

---

## Deployment

### Hosting
- **Platform:** Hostinger (VPS)
- **Trigger:** `git push origin main`
- **Process:** GitHub Actions runs build, test, lint; then deploys to Hostinger

### Deployment Pipeline

1. **Push to main**
   ```bash
   git push origin main
   ```

2. **GitHub Actions** (`.github/workflows/ci.yml`):
   - Lint check (`npm run lint`)
   - Unit tests (`npm run test`)
   - Build (`npm run build`)
   - Predeploy hook (`bash scripts/predeploy.sh`)
   - Deploy to Hostinger (via configured secrets/SSH)

3. **Monitor Deployment**
   - Check GitHub Actions tab for build status
   - Once green, changes are live on Hostinger

### Build Commands

```bash
npm run build       # Create Next.js production build
npm run start       # Start production server locally
npm run predeploy   # Clean build artifacts (runs automatically)
```

### Environment in Production

Secrets are stored in GitHub Actions secrets (not in `.env.local`). The CI/CD pipeline injects them during build.

---

## Project Structure

```
trustindex/
├── .github/
│   └── workflows/ci.yml          # GitHub Actions CI/CD pipeline
├── src/
│   ├── app/                      # Next.js app router (pages & API routes)
│   ├── components/               # Reusable React components
│   ├── context/                  # React context providers
│   ├── lib/                      # Shared utilities
│   │   ├── apiHelpers.ts         # API route helpers
│   │   ├── entitlements.ts       # Plan gates & limits
│   │   ├── supabaseServer.ts     # Service role client
│   │   ├── supabase-auth-*.ts    # Auth client factories
│   │   └── ...
│   ├── middleware.ts             # Route middleware
│   └── ...
├── .env.example                  # Environment template
├── package.json                  # Dependencies & scripts
├── vitest.config.ts              # Test configuration
├── tsconfig.json                 # TypeScript config
└── README.md                     # This file
```

---

## Common Tasks

### Add a New API Endpoint

1. Create file: `src/app/api/my-feature/route.ts`
2. Use `requireAuth()` for auth + org resolution
3. Use `parseBody()` for validation
4. Return `apiOk()` or `apiError()`

```typescript
import { requireAuth, parseBody, apiError, apiOk } from "@/lib/apiHelpers";
import { z } from "zod";

const schema = z.object({ name: z.string() });

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const parsed = await parseBody(req, schema);
  if (parsed.error) return parsed.error;

  // Your logic
  return apiOk({ created: true });
}
```

### Add a Feature Gate

1. Define limit in `src/lib/entitlements.ts` (PLAN_LIMITS)
2. Export a check function (e.g., `canCreateSurvey()`)
3. Use in components:
   ```typescript
   import { canCreateSurvey } from "@/lib/entitlements";
   
   {canCreateSurvey(plan, count) && <CreateButton />}
   ```

### Debug Auth Issues

- Check Supabase dashboard: Auth → Users (verify user exists)
- Check RLS policies: Database → Tables → [table] → RLS Policies
- Browser console: Look for 401/403 errors
- Middleware: `/src/middleware.ts` logs user lookup

### Run Tests Before Push

```bash
npm run lint
npm run test
npm run build
```

This mirrors the CI pipeline locally.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Not authenticated" (401) | Ensure NEXT_PUBLIC_SUPABASE_URL/ANON_KEY are set; check auth cookies in browser |
| "No organisation linked" (400) | User's profile missing organisation_id; sign up again or contact admin |
| Stripe webhook fails | Verify STRIPE_WEBHOOK_SECRET matches Stripe dashboard; check endpoint configuration |
| Service role client throws error | Ensure SUPABASE_SERVICE_ROLE_KEY is set (server-only, not exposed to browser) |
| Port 3000 already in use | Use `npm run dev:3001` to run on port 3001 |
| Tests fail locally but pass in CI | Clear node_modules & reinstall: `rm -rf node_modules && npm install` |

---

## Support

- **Questions?** Start in `/src/lib/apiHelpers.ts` — it's the entry point for most backend logic
- **Auth issues?** Check `/src/middleware.ts` and `/src/lib/supabase-auth-*.ts`
- **Feature gates?** See `/src/lib/entitlements.ts`
- **API routes?** Look at `/src/app/api/**/route.ts` for examples

---

**Last Updated:** April 2026
**Ticket:** TG-33
