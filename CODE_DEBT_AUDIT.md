================================================================================
VERISUM CODEBASE CODE DEBT AUDIT REPORT
================================================================================
Audit Date: 2026-03-18
Codebase Size: 303 TS/TSX files in src/, ~61,427 total lines
API Routes: 110 route.ts files

================================================================================
1. DUPLICATED AUTH BOILERPLATE — CRITICAL DEBT
================================================================================

FINDING: Massive duplication of auth+org lookup pattern across 63+ API routes
Confidence: HIGH (verified across 10+ sample routes)

Pattern Details:
- 78 instances of "const authClient = await createSupabaseServerClient()"
- Nearly identical inline auth flow: check user → fetch profile → check org_id
- Some routes define helpers (getAuthenticatedOrg), others repeat inline
- Inconsistent error messages ("Not authenticated" vs "Unauthorized")

Files with Inline Auth Boilerplate (sample):
  /src/app/api/vendors/route.ts — Lines 9-26 (GET/POST/PATCH/DELETE each repeat)
  /src/app/api/incidents/route.ts — Lines 10-26 (GET), Lines 75-94 (POST), Lines 161-178 (PATCH)
  /src/app/api/regulatory/route.ts — Lines 11-17, Lines 56-74
  /src/app/api/trustgraph/health/route.ts — Lines 13-30 (GET), Lines 115-122 (POST)
  /src/app/api/copilot/policies/route.ts — Lines 8-19
  /src/app/api/declarations/[token]/route.ts — REPEAT auth code multiple times
  /src/app/api/trustgraph/escalations/route.ts — Uses helper (getAuthenticatedOrg) but not shared

ROUTES WITH HELPERS (3 found):
  /src/app/api/actions/route.ts — Defines getAuthenticatedOrg() helper (reusable)
  /src/app/api/trustgraph/escalations/route.ts — Uses requireTier() from lib
  /src/app/api/prove/approvals/route.ts — Uses requireTier() from lib

ROUTES WITHOUT AUTH (intentional):
  /src/app/api/try-explorer/route.ts — Public endpoint (correct)
  /src/app/api/claim-explorer-run/route.ts — Optional auth (correct)
  /src/app/api/auth/route.ts — Auth endpoint (correct)
  /src/app/api/copilot/monthly-report/route.ts — Cron with bearer token (correct)

IMPACT: ~500+ lines of duplicated auth code. Adding new routes requires copy-paste.

================================================================================
2. HARDCODED MAGIC NUMBERS & STRINGS — MODERATE DEBT
================================================================================

FINDING: Tier classification thresholds and plan limits hardcoded in multiple locations

Canonical Sources (GOOD):
  /src/lib/trustGraphTiers.ts — Score→Tier thresholds (80, 65, 50)
  /src/lib/entitlements.ts — Plan limits (LIMITS record + functions)
    - Plans: "explorer" | "starter" | "pro" | "enterprise"
    - Limits hardcoded: 1, 3, 5, 10, 50, 250, Infinity

Duplicate/Hardcoded Locations (BAD):
  /src/app/upgrade/page.tsx — Lines 48, 50, 80, 132-135 — Plans + limits duplicated
    "Staff Declaration Portal (50 staff)" — Line 48
    "AI Vendor Register (10 vendors)" — Line 49
    "Incident Logging (5/month)" — Line 50
    Table matrix: "50 staff", "250 staff", "10", "5/month" — Lines 129-135

  Result: Marketing page tiers must be manually kept in sync with entitlements.ts

CONSISTENCY CHECK:
  entitlements.ts says: maxVendors(starter) = 10
  upgrade/page.tsx says: "AI Vendor Register (10)" ✓ (matches)

  entitlements.ts says: maxStaffDeclarations(starter) = 50
  upgrade/page.tsx says: "50 staff" ✓ (matches, but not DRY)

IMPACT: If tier limits change, 2+ locations must be updated. Risk of sync issues.

================================================================================
3. LARGE FILES — MODERATE DEBT
================================================================================

FINDING: Multiple files exceed 1000 lines, making them hard to maintain

Files Over 800 Lines (Top 10):

  1. /src/app/reports/page.tsx — 1,927 lines
     - "use client" component with multiple report types and charts
     - Contains: tab switching, data fetching, PDF export, multiple chart renders
     - Candidate for splitting: ReportBoard, ReportHistory, ReportActions, ReportRisk components

  2. /src/app/systems/[systemId]/assess/page.tsx — 1,146 lines
     - Single system assessment view
     - Contains: multi-step questionnaire, scoring logic, UI rendering
     - Candidate for splitting: AssessmentForm, ScoringDisplay, RecommendationPanel

  3. /src/app/admin/run/[runId]/page.tsx — 1,080 lines
     - Admin survey run viewer with CSV export logic
     - Contains: questions list, responses, data transformation
     - Candidate for splitting: QuestionsList, ResponsesTable, ExportDialog

  4. /src/app/dashboard/surveys/[runId]/results/page.tsx — 987 lines
  5. /src/app/dashboard/[runId]/page.tsx — 950 lines
  6. /src/app/dashboard/surveys/[runId]/page.tsx — 929 lines
  7. /src/app/prove/decisions/page.tsx — 913 lines
  8. /src/app/govern/registry/page.tsx — 825 lines
  9. /src/app/actions/page.tsx — 819 lines
  10. /src/app/trustsys/[assessmentId]/ibg/page.tsx — 810 lines

IMPACT: Hard to test, maintain, and reason about. Increased cognitive load.

================================================================================
4. TYPE SAFETY GAPS — MODERATE DEBT
================================================================================

FINDING: 26 instances of `: any` type in production code (not tests)

Instances by File:
  /src/app/admin/run/[runId]/page.tsx — 6 instances (escapeCsv, toCsvValue, errors)
  /src/app/admin/new-run/page.tsx — 1 instance (catch error)
  /src/app/dashboard/[runId]/page.tsx — 5 instances
  /src/app/dashboard/surveys/[runId]/results/page.tsx — 6 instances
  /src/app/dashboard/surveys/[runId]/page.tsx — 3 instances
  /src/app/api/stripe/webhook/route.ts — 1 instance (event type)
  /src/app/api/stripe/checkout/route.ts — 1 instance
  /src/app/api/stripe/portal/route.ts — 1 instance
  /src/lib/prove/chain.ts — 1 instance
  /src/components/AccessGate.tsx — 1 instance

Examples:
  Line 56-64 in /src/app/admin/run/[runId]/page.tsx:
    function escapeCsv(value: any) { ... }
    function toCsvValue(v: any) { ... }

  Line 428-429 in /src/app/admin/run/[runId]/page.tsx:
    let questions: any[] | null = null;
    let questionsErr: any = null;

IMPACT: Type safety gaps in CSV export, error handling, and data transformation.

================================================================================
5. CONSOLE.LOG IN PRODUCTION — LOW DEBT
================================================================================

FINDING: 45 console statements in API routes, 23 files affected

Files with Console Output (sample):
  /src/app/api/incidents/route.ts:139 — console.error("[incidents] Error creating:", error)
  /src/app/api/governance-pack/generate/route.ts — console.error("[pack] Generation failed")
  /src/lib/env.ts:38 — console.warn (environment validation)
  /src/lib/email.ts — console.error for email failures
  /src/lib/audit.ts — console.error for audit logging failures
  /src/app/api/stripe/webhook/route.ts — console.error/log
  /src/app/api/declarations/create-token/route.ts — console.log/error
  /src/app/api/stripe/checkout/route.ts — console.error
  /src/app/api/settings/billing/route.ts:177 — console.error("Billing API error:")
  /src/app/api/stripe/portal/route.ts — console.error

CONTEXT: Some console.error are legitimate (env warnings, critical failures).
Others appear to be debug statements left in.

IMPACT: Production logs pollution. Should use structured logging instead.

================================================================================
6. ERROR HANDLING INCONSISTENCY — LOW DEBT
================================================================================

FINDING: Error response shapes vary across API routes

Patterns Found:

  Standard Pattern (GOOD):
    return NextResponse.json({ error: message }, { status: 500 });

  Variable Error Messages:
    "Not authenticated" vs "Unauthorized" — /src/app/api/vendors/route.ts (401)
    "No organisation" vs "No organisation linked" — different routes
    "Internal server error" vs "Unknown error" — inconsistent defaults

  Variable Variable Names in Catch:
    Some use `err`, some use `e`, some use `error`

    Example 1: /src/app/api/vendors/route.ts:45-48
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Internal server error";
        return NextResponse.json({ error: message }, { status: 500 });

    Example 2: /src/app/api/actions/route.ts:81-84
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Unknown error";
        return NextResponse.json({ error: message }, { status: 500 });

  Stripe Webhook Route:
    /src/app/api/stripe/webhook/route.ts — Returns { ok: true/false } (different shape)

  Settings Routes:
    /src/app/api/settings/billing/route.ts:177 — console.error before returning

IMPACT: Client inconsistency. Error parsing code is fragile.

================================================================================
7. RECOMMENDATION SUMMARY
================================================================================

CRITICAL (High ROI):
  1. Extract auth middleware helper
     - Create: /src/lib/api/requireAuth.ts — standardizes user+org lookup
     - Replace 78 instances across API routes
     - Reduces ~400 lines of boilerplate
     - Unifies error messages

  2. Create shared API response builder
     - Ensures consistent error shape: { error: string, status: number }
     - Type-safe error codes

MODERATE (Good to have):
  3. Extract tier limit constants
     - Move hardcoded tier limits from upgrade/page.tsx to entitlements.ts
     - Export named constants (e.g., STARTER_STAFF_DECLARATIONS = 50)
     - Audit page should reference entitlements.ts

  4. Split large page components
     - ReportsPage (1,927 lines) → Split into 4-5 sub-components
     - AssessmentPage (1,146 lines) → Split into form + display + panels

LOW (Nice to have):
  5. Add TypeScript strict mode to CSV exports
     - Replace `: any` with proper types in escapeCsv, toCsvValue

  6. Use structured logging
     - Replace console.* with pino/winston logger
     - Centralize debug vs error output

  7. Standardize error variable names
     - Use `error` consistently in catch blocks (not `err` or `e`)

================================================================================
END OF AUDIT REPORT
================================================================================
