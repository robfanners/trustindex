# Staging environment on Hostinger

Goal: catch Next.js / dependency bumps and framework misbehaviour before they hit app.verisum.org.

After the 2026-04-15 Turbopack incident, a full production deploy was the first time 16.1.7 was exercised on Hostinger. A staging target would have caught it in ~5 minutes instead of the live-app crash loop we got.

## Architecture

```
feature branch ──PR──▶ main ──git push──▶ Hostinger (app.verisum.org, prod)
                        │
                        └──cherry-pick/merge──▶ staging ──git push──▶ Hostinger (staging.verisum.org)
```

- `staging` branch lives in the same `trustindex` GitHub repo.
- Hostinger runs **two Node.js sites** from the same repo, differentiated by branch and subdomain.
- Staging uses a **separate Supabase project** (not just a different DB — different project, different Auth, different Stripe test-mode keys). Blast radius = zero if something on staging wipes data.

## One-time setup (approx 45 minutes)

### 1. Create the staging branch

```bash
cd ~/path/to/trustindex
git checkout main
git pull
git checkout -b staging
git push -u origin staging
```

### 2. Create a staging Supabase project

1. In the Supabase dashboard, create a new project: `trustindex-staging` (free tier is fine).
2. Run all migrations in order from `supabase/migrations/` against it.
3. Note the project URL, anon key, and service role key.

### 3. Create a staging Stripe context

Use Stripe **test-mode** keys throughout. Create test-mode Price IDs for Starter and Pro tiers. The webhook secret will come from step 5.

### 4. Create the staging Hostinger site

1. Hostinger → Websites → **Create a new website**.
2. Type: Node.js app.
3. Connect to GitHub → select `robfanners/trustindex`.
4. Branch: `staging` (not `main`).
5. Node version: 22 (match prod).
6. Build command: `npm ci && npm run build` — `npm ci` enforces the lockfile, unlike `npm install`.
7. Start command: `npm run start`.
8. Domain: configure `staging.verisum.org` as a subdomain. DNS A record at the registrar points at Hostinger's staging host.

### 5. Configure staging environment variables in Hostinger

Mirror `.env.example`, but with:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` → staging Supabase project
- `STRIPE_SECRET_KEY` → Stripe test-mode secret (`sk_test_…`)
- `STRIPE_WEBHOOK_SECRET` → from a new Stripe test-mode webhook pointing at `https://staging.verisum.org/api/stripe/webhook`
- `STRIPE_STARTER_MONTHLY_PRICE_ID` / `STRIPE_PRO_MONTHLY_PRICE_ID` / yearly variants → Stripe test-mode prices
- `NEXT_PUBLIC_SITE_URL` → `https://staging.verisum.org`
- `RESEND_API_KEY` → either a dedicated staging key or reuse prod (Resend doesn't charge for low volume; emails will go to real addresses so be careful)
- `RESEND_FROM_EMAIL` → suggest `staging@notifications.verisum.org` so staging-origin emails are distinguishable in your inbox
- `ANTHROPIC_API_KEY` → can reuse prod or dedicate a staging key (monitor cost)
- `CRON_SECRET` → generate a new random string
- `SYSADMIN_CODE` / `VERISUM_ADMIN_CODE` → fresh random strings, not prod values
- `NEXT_DISABLE_TURBOPACK=1` → set explicitly in Hostinger env vars too (belt and braces; the script already sets it)

### 6. Configure Supabase auth callback URLs on staging project

Supabase → Authentication → URL Configuration:

- Site URL: `https://staging.verisum.org`
- Redirect URLs: `https://staging.verisum.org/auth/callback`, and for local dev `http://127.0.0.1:3000/auth/callback`

### 7. Test the staging deploy

1. In the terminal: `git push origin staging` (or just trigger Hostinger's auto-deploy).
2. Watch the build logs — confirm `npm ci` runs clean and `next build` with webpack (look for "Webpack" or absence of "Turbopack" in the output).
3. Visit https://staging.verisum.org — `/auth/login` should load, chunks should serve with `content-type: application/javascript`.
4. Create a test account, walk through Explorer (`/try`) and a full survey. Any 500/404 is a staging issue to fix before touching main.

## Daily workflow after setup

For any non-trivial change:

```bash
# 1. Feature work
git checkout -b feature/thing-i-am-doing
# ...hack hack hack...

# 2. Open PR to main
git push -u origin feature/thing-i-am-doing
gh pr create --base main --title "..."

# 3. Before merging main — merge to staging first
git checkout staging
git merge --no-ff feature/thing-i-am-doing
git push origin staging

# 4. Wait ~2 minutes for Hostinger staging build, then smoke-test
curl -fsS https://staging.verisum.org/api/keepalive
# Open in browser, click around anything relevant to the change

# 5. If clean → merge PR to main (Hostinger prod deploys)
gh pr merge --squash
```

For hotfixes on a live outage, you may skip staging and go direct to main, but this should be a conscious exception — not the default.

## What staging catches that prod wouldn't

- **Framework version bumps.** A Next.js or React patch that breaks on Hostinger's Node 22 fails here first.
- **Database migrations that reference columns not yet in prod.** If a migration is applied to staging Supabase and the code deploys to staging, any column mismatch surfaces in `supabase logs` before prod sees it.
- **Stripe webhook shape changes.** Test-mode Stripe events hit the staging endpoint first.
- **Build output differences.** If a dependency now outputs differently (as happened with Turbopack chunks), staging's chunk 404s will be visible in curl output before prod is touched.

## What staging does NOT catch

- Prod-scale performance issues (staging will be cold and low-traffic).
- Real-data edge cases (staging DB is test data).
- Real Stripe webhook retry behaviour beyond what test mode simulates.

## Costs

- Hostinger: one additional Node.js site. Depends on your current plan. If you're on the entry hosting tier this may require an upgrade (~£10-20/month).
- Supabase: free-tier project fine for staging (500MB DB, 50k MAU — you will not exceed this in staging traffic).
- Stripe: test mode is free.
- Resend: free tier (3k emails/month) is enough.
- Anthropic: if you reuse prod API key, monitor. If dedicated, budget £5-20/month based on how much you test copilot features.

Total marginal cost: ~£10-25/month. Compared to the revenue risk of a repeat outage during a demo, this is a rounding error.
