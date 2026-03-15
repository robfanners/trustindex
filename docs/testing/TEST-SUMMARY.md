# Verisum Test Summary

> **Notion Location:** Technology > Testing
> **Last Updated:** 2026-03-04
> **Status:** Active | 251 tests | 13 files | All passing

---

## Overview

| Metric | Value |
|--------|-------|
| **Framework** | Vitest 4.0.18 + jsdom |
| **Total Tests** | 251 |
| **Test Files** | 13 |
| **Pass Rate** | 100% |
| **Run Time** | ~2.5s |
| **Methodology** | AI-Driven BDD+ Continuous Testing |

### Commands

```bash
npm run test           # Single run (CI)
npm run test:watch     # Watch mode (development)
npm run test:coverage  # Coverage report
```

---

## Test Suite Breakdown

### 1. Core Library Tests (98 tests) + BDD Example (13 tests)

#### `src/lib/__tests__/tiers.test.ts` — 22 tests
Validates the tier system that underpins Verisum's 3-tier product model.

| Describe Block | Tests | Covers |
|---------------|-------|--------|
| `planToTier` | 7 | Maps plan names (explorer/starter/pro/enterprise) to tiers (Core/Assure/Verify); null/undefined defaults |
| `hasTierAccess` | 9 | Tier hierarchy enforcement — lower tiers cannot access higher features |
| `getTierInfo` | 3 | Returns tier metadata (name, tagline, highlights) |
| `TIERS structure` | 3 | Structural validation of tier config records |

#### `src/lib/__tests__/entitlements.test.ts` — 53 tests
Validates all plan-based feature gates and numeric limits.

| Describe Block | Tests | Covers |
|---------------|-------|--------|
| `getPlanLimits` | 6 | Returns correct limits object per plan; null/undefined defaults |
| `canCreateSurvey` | 3 | Survey creation caps per plan |
| `canCreateSystem` | 5 | System creation limits (0 for explorer, 2 for pro, unlimited for enterprise) |
| `canExportResults` | 4 | Export gating (pro+ only) |
| `isPaidPlan` | 6 | Free vs paid plan detection |
| `maxVendors` | 4 | Vendor limit per plan (0/10/Infinity/Infinity) |
| `maxIncidentsPerMonth` | 4 | Monthly incident cap |
| `maxPolicyGenerations` | 4 | Policy generation limits |
| `maxTeamMembers` | 4 | Team size limits |
| `canManageTeam` | 4 | Team management access (pro+ only) |
| `canAccessWizard` | 4 | Setup wizard access (starter+ only) |
| `getReportLevel` | 5 | Report level per plan (none/basic/full) |

#### `src/lib/prove/__tests__/chain.test.ts` — 9 tests
Validates the cryptographic proof engine (chain anchoring).

| Describe Block | Tests | Covers |
|---------------|-------|--------|
| `hashPayload` | 5 | SHA-256 hashing — determinism, 0x prefix, key-order independence, uniqueness |
| `generateVerificationId` | 3 | VER-XXXXXXXX format, determinism, uniqueness |
| `isChainEnabled` | 1 | Env-var gate for on-chain features |

#### `src/lib/__tests__/navigation.test.ts` — 14 tests
Validates the navigation system and tier-based section visibility.

| Describe Block | Tests | Covers |
|---------------|-------|--------|
| `meetsMinTier` | 5 | Tier threshold checks for nav sections |
| `getTierName` | 5 | Plan-to-tier display name mapping |
| `navSections` | 4 | Section structure, tier requirements, item completeness |

### 1b. BDD+ Methodology Example (13 tests)

#### `src/lib/__tests__/bdd-example.test.ts` — 13 tests
Demonstrates the AI-Driven BDD+ testing pattern using Feature/Scenario/Given/When/Then helpers.

| Scenario | Tests | Covers |
|----------|-------|--------|
| A free-tier user exploring the platform | 4 | Core access, Assure/Verify denied |
| A pro user managing AI governance | 4 | Core+Assure access, Verify denied |
| An enterprise user with full access | 2 | All three tiers accessible |
| Handling unknown or missing plan data | 3 | null/undefined/unknown defaults to Core |

### 2. Validation Schema Tests (51 tests)

#### `src/lib/__tests__/validations.test.ts` — 51 tests
Tests all Zod schemas used for API input validation.

| Schema | Tests | Validates |
|--------|-------|-----------|
| `createAttestationSchema` | 8 | title (1-500 chars), statement (1-5000 chars), optional posture_snapshot |
| `createProvenanceSchema` | 7 | title required, optional ai_system/model_version/output_description/data_sources/review_note |
| `createApprovalSchema` | 6 | title required, risk_level enum, assigned_to UUID, description cap |
| `approvalDecisionSchema` | 6 | approval_id UUID, decision enum (approved/rejected), note cap |
| `createIncidentLockSchema` | 5 | incident_id UUID, lock_reason (1-2000 chars) |
| `createExchangeSchema` | 9 | proof_type enum, proof_id UUID, shared_with_name, email validation |
| `createSignalSchema` | 8 | system_name, 7-value signal_type enum, metric_value (number), severity/source enums |
| `firstZodError` | 2 | Error message extraction helper |

### 3. API Route Integration Tests (71 tests)

All API route tests use mocked Supabase client and `requireTier` auth. Each test file validates: auth enforcement (401/403), input validation (400), success paths (200/201), error propagation (500).

#### `src/app/api/prove/attestations/__tests__/route.test.ts` — 15 tests

| Describe Block | Tests | Covers |
|---------------|-------|--------|
| `POST /api/prove/attestations` | 10 | Auth, org check, validation (missing/empty title & statement), success with/without posture_snapshot, Supabase error |
| `GET /api/prove/attestations` | 5 | Auth, org check, success, empty array, Supabase error |

#### `src/app/api/prove/incident-locks/__tests__/route.test.ts` — 13 tests

| Describe Block | Tests | Covers |
|---------------|-------|--------|
| `POST /api/prove/incident-locks` | 10 | Auth, org check, validation (missing/empty incident_id & lock_reason, invalid UUID), 404 on missing incident, success, Supabase error |
| `GET /api/prove/incident-locks` | 3 | Auth, success, incident_id filter |

#### `src/app/api/prove/exchanges/__tests__/route.test.ts` — 17 tests

| Describe Block | Tests | Covers |
|---------------|-------|--------|
| `POST /api/prove/exchanges` | 14 | Auth, org check, validation (invalid proof_type, missing/empty shared_with_name, invalid proof_id UUID, invalid email), 404 per proof type, success with verify_url, Supabase error |
| `GET /api/prove/exchanges` | 3 | Auth, success, proof_type filter |

#### `src/app/api/monitor/signals/__tests__/route.test.ts` — 13 tests

| Describe Block | Tests | Covers |
|---------------|-------|--------|
| `POST /api/monitor/signals` | 10 | Auth, org check, validation (missing/empty system_name, non-number metric_value, invalid signal_type, missing metric_name), success with/without optional fields, Supabase error |
| `GET /api/monitor/signals` | 3 | Auth, org check, success |

#### `src/app/api/public/verify/__tests__/route.test.ts` — 13 tests

| Describe Block | Tests | Covers |
|---------------|-------|--------|
| `GET /api/public/verify` | 13 | Missing/empty id param, format validation (invalid string, no prefix, too short/long), rate limiting (429), found attestation/provenance/incident_lock, not found, unknown org fallback, case-insensitive ID |

### 4. Infrastructure Tests (18 tests)

#### `src/lib/__tests__/rateLimit.test.ts` — 13 tests

| Describe Block | Tests | Covers |
|---------------|-------|--------|
| `checkRateLimit` | 8 | First request allowed, maxRequests enforcement, rejection with retryAfterMs, independent key tracking, window expiry reset, custom params, defaults |
| `getClientIp` | 4 | x-forwarded-for extraction, comma-separated first IP, x-real-ip fallback, "unknown" default |
| `_resetStore` | 1 | Store cleanup for test isolation |

#### `src/lib/__tests__/env.test.ts` — 5 tests

| Describe Block | Tests | Covers |
|---------------|-------|--------|
| `env validation` | 5 | Missing SUPABASE_URL throws, missing SERVICE_ROLE_KEY throws, error message format, all-present succeeds, optional var warnings |

---

## Test Infrastructure

### Configuration

| Component | File | Notes |
|-----------|------|-------|
| Vitest config | `vitest.config.ts` | React plugin, jsdom, `@/` alias, ethers mock |
| Setup file | `vitest.setup.ts` | `@testing-library/jest-dom/vitest` |
| Test helpers | `src/lib/__tests__/test-helpers.ts` | Mock factories for NextRequest, Supabase, requireTier |
| BDD helpers | `src/lib/__tests__/bdd-helpers.ts` | Feature/Scenario/Given/When/Then + assertion helpers |
| Ethers mock | `src/__mocks__/ethers.ts` | Stub for optional chain dependency |

### Dependencies

```json
{
  "devDependencies": {
    "vitest": "^4.0.18",
    "@vitejs/plugin-react": "^4.5.2",
    "@testing-library/react": "^16.3.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/user-event": "^14.6.1"
  }
}
```

### Mock Strategy

- **`requireTier`**: Mocked per-test to return authorized (with userId/plan/orgId) or unauthorized (with Response)
- **`supabaseServer`**: Returns a chainable mock that simulates `.from().select().eq().single()` patterns
- **`NextRequest`**: Factory helpers create proper request objects with URL params and JSON body
- **`ethers`**: Aliased to empty stub since chain features are optional

---

## Coverage Gaps (Known)

These areas are intentionally not yet covered and represent the next wave of test development:

| Area | Reason | Priority |
|------|--------|----------|
| React component tests | Requires component-level test patterns; focus was on logic first | Medium |
| Copilot API routes | Complex AI integration; needs mock strategy for Anthropic client | Medium |
| Middleware auth flow | Integration-level; testing Supabase auth refresh requires different approach | Low |
| E2E browser tests | Requires Playwright/Cypress setup; future phase | Low |
| Database RLS policies | Requires Supabase test project; integration-level | Low |
| Stripe webhook handlers | Requires Stripe test fixtures | Medium |

---

## Keeping This Document in Sync

This document should be updated whenever:

1. New test files are added
2. Test counts change significantly (>5 tests added/removed)
3. New test categories are introduced (e.g., component tests, E2E)
4. Coverage gaps are addressed
5. Test infrastructure changes (framework, config, mock strategy)

**Auto-generate command:**
```bash
npx vitest run --reporter=verbose 2>&1 | grep -c "✓"   # Total passing
npx vitest run --reporter=verbose 2>&1 | grep "Test Files" # File summary
```

---

## Changelog

| Date | Change | Tests Before | Tests After |
|------|--------|-------------|-------------|
| 2026-03-04 | Phase 11: Initial test suite — core libs, validations, API routes, infra | 0 | 238 |
| 2026-03-04 | BDD+ methodology adopted — helpers, example test, docs | 238 | 251 |
