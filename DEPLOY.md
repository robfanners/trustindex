# Verisum Deployment Guide

> **This is the single source of truth for deploying Verisum.**
> All AI assistants (Claude, Copilot, etc.) MUST read and follow this document before making any deployment-related changes.

---

## Two Sites, Two Methods

| Property | app.verisum.org (This Repo) | Marketing Site |
|---|---|---|
| **Type** | Next.js application | Static HTML/CSS |
| **Deploy method** | Git push to `main` → Hostinger auto-builds | Zip upload via Hostinger dashboard |
| **Repo** | `robfanners/trustindex` | Separate (not this repo) |
| **Build command** | `npm run build` (runs `next build`) | N/A |
| **Runtime** | Node.js 22 on Hostinger | Static hosting |

**CRITICAL: Never zip this repo for deployment. Never disconnect the Hostinger ↔ GitHub integration. These are fundamentally different sites with different deploy methods.**

---

## app.verisum.org — Deployment Procedure

### Prerequisites
- You are on the `main` branch
- All feature work has been merged via PR
- You have run the pre-deploy checks (automated via `npm run predeploy`)

### Step-by-Step

```
1. Ensure you're on main and up to date
   git checkout main
   git pull origin main

2. Run pre-deploy checks (this is mandatory)
   npm run predeploy

   This runs:
   ✓ TypeScript compilation check
   ✓ ESLint
   ✓ Full production build (next build)
   ✓ Tests (vitest run)

3. If all checks pass, push to deploy
   git push origin main

4. Hostinger automatically:
   - Detects the push
   - Runs npm install
   - Runs npm run build
   - Starts the app with npm run start

5. Verify the deploy
   - Visit https://app.verisum.org
   - Check auth flow (login/logout)
   - Check dashboard loads
   - Check one survey flow
   - Check Stripe checkout (use test mode if available)
```

### Rollback

```
# If something breaks after deploy:
git revert HEAD          # revert the last commit
git push origin main     # auto-deploys the revert
```

For multi-commit rollback:
```
git log --oneline -10    # find the last good commit
git revert HEAD~N..HEAD  # revert N commits
git push origin main
```

---

## What NOT to Do

These are **hard rules** that apply to all humans and AI assistants:

1. **Never zip this repo and upload it to Hostinger** — this is a git-deployed Next.js app
2. **Never disconnect the GitHub ↔ Hostinger integration** — it is the deploy pipeline
3. **Never push directly to main without running `npm run predeploy`** — the hook will block you anyway
4. **Never deploy database migrations separately** — run them via Supabase CLI/dashboard first, then deploy the code that uses them
5. **Never modify `.env` files on Hostinger directly** — use the Hostinger environment variables panel
6. **Never force-push to main** — use revert commits instead

---

## Database Migration Sequence

When a deploy includes database changes:

```
1. Apply migration to Supabase FIRST
   - Via Supabase dashboard SQL editor, or
   - Via supabase db push (if using CLI)

2. Verify migration succeeded
   - Check table/column exists
   - Check RLS policies applied

3. THEN deploy the code
   - npm run predeploy
   - git push origin main

4. Never deploy code before its migration
   (the app will crash on missing columns/tables)
```

---

## Environment Variables

Managed in **Hostinger dashboard → Environment Variables**. Never committed to git.

Required variables (see `.env.example` for full list):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `ANTHROPIC_API_KEY`
- `RESEND_API_KEY`
- `CRON_SECRET`
- `NEXT_PUBLIC_SITE_URL`

If adding a new env var:
1. Add it to Hostinger environment variables panel
2. Add a placeholder to `.env.example` in the repo
3. Deploy the code that uses it

---

## Feature Branch Workflow

```
main (production) ← feature branches merge here via PR

1. Create feature branch
   git checkout -b feat/my-feature

2. Develop and commit locally

3. Push feature branch
   git push -u origin feat/my-feature

4. Create PR on GitHub
   - Get review if applicable
   - Ensure build passes

5. Merge to main
   - Squash merge preferred for clean history

6. main auto-deploys to Hostinger
```

---

## Marketing Site (Separate)

The marketing site at verisum.org (non-app pages) is a **completely separate project**:
- Static HTML/CSS/JS
- Deployed by zipping files and uploading to Hostinger
- Has its own domain config
- **Do not confuse with this repo**

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| Deploy stuck on Hostinger | Build failing | Check Hostinger build logs, fix the error, push again |
| 500 errors after deploy | Missing env var or DB migration | Check Hostinger env vars, check Supabase |
| Old version still showing | CDN/browser cache | Hard refresh, wait 2-3 min for Hostinger |
| Blank page | Build error in a component | Check browser console, check Hostinger build logs |
