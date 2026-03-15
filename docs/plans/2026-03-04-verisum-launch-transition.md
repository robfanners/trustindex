# Verisum Launch Transition Plan

> **Date:** 2026-03-04
> **Status:** Ready to execute
> **Goal:** Deploy Verisum to `app.verisum.org`, deprecate old subdomains, update marketing

---

## Domain Architecture (Final State)

| Domain | Purpose | Type |
|--------|---------|------|
| `verisum.org` | Marketing website | Static HTML (~/verisum.org) |
| `app.verisum.org` | Product application | Next.js (~/trustindex) |
| `verify.verisum.org` | Public verification portal | Redirect to app.verisum.org/verify/* |
| `happ.verisum.org` | Legacy — redirect | 301 → verisum.org |
| `trustindex.verisum.org` | Legacy — redirect | 301 → app.verisum.org (3 months, then remove) |

---

## Phase A: Deploy to `app.verisum.org`

### A1. Create subdomain (DNS)

**Where:** Your DNS provider (wherever verisum.org DNS is managed)

1. Create A record or CNAME for `app.verisum.org`
   - If Hostinger: Point to the same hosting as trustindex.verisum.org
   - If Vercel: Add CNAME → `cname.vercel-dns.com`

### A2. Add domain in hosting

**Where:** Hostinger hPanel (or Vercel dashboard)

1. Go to the hosting account for the trustindex project
2. Add `app.verisum.org` as an additional domain / alias
3. The same deployment serves both domains during transition

### A3. Update environment variable

**Where:** Hosting environment variables panel

```
NEXT_PUBLIC_SITE_URL=https://app.verisum.org
```

> **Note:** This only affects the build-time fallback. The app dynamically reads `Host` headers at runtime via `getServerOrigin()`, so it works on any domain. But set it correctly for SSR/prerender and email links.

### A4. Update Supabase auth

**Where:** Supabase Dashboard → Authentication → URL Configuration

1. **Site URL:** Change from `https://trustindex.verisum.org` to `https://app.verisum.org`
2. **Redirect URLs:** Add `https://app.verisum.org/**` to allowed list
3. Keep `https://trustindex.verisum.org/**` in the list temporarily (for transition period)

### A5. Update Stripe

**Where:** Stripe Dashboard

1. **Webhook endpoint:** Add `https://app.verisum.org/api/stripe/webhook`
2. Keep the old `trustindex.verisum.org` webhook active during transition
3. Once confirmed working, disable the old webhook
4. **Customer portal return URL:** Handled dynamically via `getServerOrigin()` — no change needed

### A6. Deploy & smoke test

```bash
# 1. Push to trigger deployment
git push origin main

# 2. Smoke tests on app.verisum.org
curl -s -o /dev/null -w "%{http_code}" https://app.verisum.org
# Should return 200

# 3. Test auth flow
# Navigate to https://app.verisum.org/auth/login — magic link should work

# 4. Test verification
# Navigate to https://app.verisum.org/verify/VER-TESTID — should load

# 5. Test API
curl -s https://app.verisum.org/api/public/verify?id=VER-00000000
# Should return { "found": false, ... }

# 6. Check security headers
curl -sI https://app.verisum.org | grep -E "X-Frame|Strict-Transport|X-Content-Type"
```

### A7. Verify cron jobs

**Where:** vercel.json / hosting cron config

The cron jobs hit relative paths (`/api/keepalive`, `/api/copilot/monthly-report`) so they work on any domain. Just verify they're firing after the domain change.

---

## Phase B: Set Up `verify.verisum.org`

### B1. Create DNS record

Create CNAME or A record for `verify.verisum.org` pointing to same hosting.

### B2. Configure redirect

Option 1 — **DNS-level redirect** (simplest):
- Set up URL forwarding: `verify.verisum.org/*` → `app.verisum.org/verify/*` (301 redirect)

Option 2 — **Hosting-level redirect** (if DNS forwarding not supported):
- Add `verify.verisum.org` as a domain
- Configure redirect rule in hosting panel

> **Future:** Phase 8 from the original design doc planned a standalone public verification portal at this domain. For now, a redirect is sufficient.

---

## Phase C: Deprecate Old Subdomains

### C1. `happ.verisum.org` → 301 to `verisum.org`

**Where:** DNS/hosting for happ.verisum.org

1. Remove the old HAPP application deployment
2. Set up 301 redirect: `happ.verisum.org` → `https://verisum.org`
3. This can be done immediately — no users depend on it

### C2. `trustindex.verisum.org` → 301 to `app.verisum.org`

**Where:** DNS/hosting for trustindex.verisum.org

1. **Do NOT remove immediately** — existing users/bookmarks may reference this URL
2. Set up 301 redirect: `trustindex.verisum.org/*` → `https://app.verisum.org/*`
3. Keep for **3 months** minimum (until June 2026)
4. After 3 months: remove the redirect and the DNS record

### C3. Clean up Supabase

**Where:** Supabase Dashboard → Authentication → URL Configuration

After 3-month transition period:
1. Remove `https://trustindex.verisum.org/**` from redirect URLs
2. Ensure Site URL is `https://app.verisum.org`

### C4. Clean up Stripe

1. Delete the old `trustindex.verisum.org` webhook endpoint
2. Verify only the `app.verisum.org` webhook is active

---

## Phase D: Update Marketing Site (`verisum.org`)

### Current State
- Static HTML site at `~/verisum.org`
- Messaging talks about TrustOS, TrustGraph, TrustProtocols (outdated)
- CTAs link to `trustindex.verisum.org` (needs updating)

### Required Changes

#### D1. Quick fixes (do first)
Update all CTAs from `trustindex.verisum.org` to `app.verisum.org`:

**Files to update:**
- `index.html` — "Get Started" and "Check Your Trust Score" links
- `trustos.html` — CTA links
- `trustgraph.html` — CTA links
- `trust-protocols.html` — Remove `happ.verisum.org` reference
- `products-ai-performance.html` — CTA links
- All pages with `trustindex.verisum.org` in `<a href="...">` tags

#### D2. Messaging overhaul (next session)
Replace the three-product model with the unified Verisum story:

| Page | Current | New |
|------|---------|-----|
| Homepage | TrustOS + TrustGraph + TrustProtocols | Verisum: One platform, three tiers |
| Products | Three separate product pages | Core / Assure / Verify tier pages |
| Pricing | Not present | Three tiers with feature comparison |
| Trust Protocols | HAPP references | Verify tier: cryptographic proof |

**Key messaging:**
- "Verisum — AI Governance Intelligence" (not "Trust Architecture")
- Three tiers: Core (Govern + Report), Assure (Monitor + Act), Verify (Prove)
- Single product, not three products
- No mention of TrustOS, TrustGraph, TrustProtocols, HAPP, IBG as product names

#### D3. Deploy marketing site
Push updated `~/verisum.org` to GitHub → triggers deploy on hosting

---

## Phase E: Final Cleanup

- [ ] Confirm `app.verisum.org` serving correctly (auth, Stripe, API, cron)
- [ ] Confirm `verify.verisum.org` redirects to `app.verisum.org/verify/*`
- [ ] Confirm `happ.verisum.org` 301s to `verisum.org`
- [ ] Confirm `trustindex.verisum.org` 301s to `app.verisum.org`
- [ ] Marketing site CTAs all point to `app.verisum.org`
- [ ] Old Stripe webhook removed
- [ ] Old Supabase redirect URLs removed (after 3 months)
- [ ] Google Search Console: submit `app.verisum.org` sitemap, mark old domain as moved

---

## Execution Order

```
Phase A (deploy)     → 1-2 hours (you + Claude Code)
Phase B (verify)     → 15 minutes
Phase C (deprecate)  → 30 minutes
Phase D1 (CTA fix)   → 30 minutes
Phase D2 (messaging) → Separate session
Phase E (cleanup)    → Ongoing over 3 months
```

**Critical path:** A → smoke test → C → D1 → B

The product is fully functional before any old URL stops working. Marketing refresh (D2) is cosmetic and can happen on its own timeline.

---

## Codebase Changes Already Made

These changes prepare the codebase for the domain switch:

| File | Change |
|------|--------|
| `.env.example` | Comment updated: `trustindex.verisum.org` → `app.verisum.org` |
| `src/app/globals.css` | Removed `happ.verisum.org` references from comments |
| `CLAUDE.md` | Cleaned up "currently deployed at trustindex" note |
| `docs/onboarding/verisum-onboarding.md` | Live URL updated to `app.verisum.org` |

### References intentionally NOT changed

| Reference | Why kept |
|-----------|---------|
| `/api/trustgraph/*` routes | Internal engine name — not public-facing (design doc: "engine names not shown publicly") |
| `v_trustindex_scores` DB view | Supabase schema name — renaming requires migration + downtime |
| `TrustIndexScores@verisum.org` | Email address — works regardless of app domain |
| `docs/plans/*.md` | Historical documents — shouldn't be retroactively edited |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Auth redirect fails on new domain | Low | High | Add both domains to Supabase allowed URLs |
| Stripe webhook fails | Low | High | Run both webhooks in parallel during transition |
| SEO ranking drop | Low | Low | 301 redirects preserve SEO equity |
| Existing users can't find app | Medium | Medium | 301 redirect from old URL catches everyone |
| Cron jobs break | Very low | Medium | Relative paths — domain-agnostic |
