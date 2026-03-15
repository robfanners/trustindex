# AI-Driven BDD+ Continuous Testing Methodology

> **Notion Location:** Technology > Testing > Methodology
> **Adopted:** 2026-03-04
> **Applies to:** All Verisum development (~/trustindex)

---

## Philosophy

**AI-Driven BDD+ Continuous Testing** combines three practices:

1. **BDD (Behaviour-Driven Development)** — Tests describe business behaviours, not implementation details
2. **Shift-Left** — Testing happens before and during code, not after
3. **Shift-Right** — Production monitoring and observability feed back into test design
4. **AI-Driven** — Claude Code generates, refines, and maintains tests as a first-class development partner

The "+" in BDD+ means we go beyond classic Gherkin. We write BDD-style `describe/it` blocks with business language, but also include property-based edge cases and security assertions that pure BDD would miss.

---

## Core Principles

### 1. Tests Before or With Code, Never After

Every feature branch must include tests. The workflow is:

```
Spec/Design → Behaviour Scenarios → Test Stubs → Implementation → Tests Pass → Review
```

- When Claude builds a feature, tests are part of the same commit
- Tests describe the **intended behaviour**, not the current implementation
- If a test needs to change when refactoring, the test was too tightly coupled

### 2. Business Language in Test Names

Tests should read like specifications. Anyone (including non-engineers) should understand what's being tested.

```typescript
// BAD: Technical implementation detail
describe("POST handler", () => {
  it("should return 400 when title is falsy", () => {});
});

// GOOD: Business behaviour
describe("creating an attestation", () => {
  it("requires a title to be provided", () => {});
  it("requires a statement describing what is being attested", () => {});
  it("generates a verification ID that can be shared externally", () => {});
});
```

### 3. Given-When-Then Structure in Test Bodies

Use implicit Given/When/Then sections even without Gherkin syntax:

```typescript
it("rejects an exchange when the proof record does not belong to the organisation", async () => {
  // Given: an authenticated user with a valid organisation
  const { requireTier } = await setupAuth({ orgId: "org-1" });

  // When: they try to share a proof from another organisation
  const response = await POST(
    mockPostRequest({ proof_type: "attestation", proof_id: "foreign-id", shared_with_name: "Auditor" })
  );

  // Then: the request is rejected with a clear error
  expect(response.status).toBe(404);
  expect(await response.json()).toMatchObject({
    error: expect.stringContaining("not found"),
  });
});
```

### 4. AI-Generated Test Expansion

After writing initial happy-path tests, Claude should expand coverage by asking:

- **Boundary conditions**: What happens at min/max limits?
- **Empty/null states**: What if optional fields are missing?
- **Permission boundaries**: What if a lower-tier user attempts this?
- **Concurrent access**: What if two users act simultaneously?
- **Error propagation**: What if the database returns an error?
- **Security**: Can inputs be used for injection? Are auth checks enforced first?

### 5. Continuous — Not Batch — Testing

Tests run at every stage:

| Stage | What Runs | How |
|-------|-----------|-----|
| **Pre-commit** | Affected test files | `vitest run --changed` |
| **PR** | Full suite | `npm run test` |
| **Deploy** | Full suite + build | `npm run test && npm run build` |
| **Production** | Smoke tests + monitoring | Health checks, signal monitoring |

---

## Test Categories

### Level 1: Behaviour Specifications (Unit)

Pure logic tests with zero external dependencies. These are the foundation.

**When to write:** For any exported function, utility, schema, or business rule.

**Pattern:**
```typescript
describe("feature or module name", () => {
  describe("specific behaviour", () => {
    it("does X when Y", () => {
      // Given
      const input = createValidInput();

      // When
      const result = functionUnderTest(input);

      // Then
      expect(result).toBe(expectedOutput);
    });
  });
});
```

**Current examples:** `tiers.test.ts`, `entitlements.test.ts`, `validations.test.ts`, `chain.test.ts`, `navigation.test.ts`

### Level 2: API Behaviour Tests (Integration)

Test API routes with mocked infrastructure. Validates the contract between frontend and backend.

**When to write:** For every API route.

**Pattern:**
```typescript
describe("POST /api/prove/attestations", () => {
  // Auth behaviour
  it("requires authentication", async () => {});
  it("requires an active organisation", async () => {});

  // Input validation behaviour
  it("requires a title to be provided", async () => {});
  it("requires a statement to be provided", async () => {});

  // Business logic behaviour
  it("creates an attestation with a verification ID", async () => {});
  it("includes the proof hash for chain anchoring", async () => {});

  // Error behaviour
  it("reports database failures clearly", async () => {});
});
```

**Current examples:** `attestations/route.test.ts`, `exchanges/route.test.ts`, `signals/route.test.ts`

### Level 3: Component Behaviour Tests (UI)

Test React components with `@testing-library/react`. Focus on user interactions, not implementation.

**When to write:** For any interactive component (forms, modals, data tables, tier gates).

**Pattern:**
```typescript
describe("AttestationForm", () => {
  it("shows validation error when submitting without a title", async () => {
    render(<AttestationForm />);
    await userEvent.click(screen.getByRole("button", { name: /create/i }));
    expect(screen.getByText(/title is required/i)).toBeInTheDocument();
  });

  it("disables submit button while saving", async () => {});
  it("shows success message after creating attestation", async () => {});
});
```

**Status:** Not yet implemented. Priority for next phase.

### Level 4: E2E Behaviour Tests (System)

Full browser tests with Playwright. Validate complete user journeys.

**When to write:** For critical user flows (onboarding, creating proofs, verification).

**Status:** Future phase. Will use Playwright.

---

## Shift-Right: Production Feedback Loop

Production signals feed back into test design:

1. **Monitor signals** → When a signal fires (accuracy drop, fairness drift), create a regression test
2. **Incident locks** → When an incident is locked, review test coverage for the affected path
3. **Verification lookups** → Track which verification IDs are queried; ensure those proof types have deep test coverage
4. **Error logs** → Production errors become test cases (bug → test → fix → verify)

### Signal-to-Test Mapping

```
Production signal fires → Classify the failure mode
  → Does a test exist for this case?
    → No: Write one (shift-left the lesson)
    → Yes: Why didn't it catch it? (test quality review)
```

---

## AI-Driven Workflow

### During Feature Development

1. **Claude reads the spec/design doc** — understands the intended behaviour
2. **Claude generates BDD test stubs** — `describe/it` blocks with business names
3. **Claude implements the feature** — code that makes the tests pass
4. **Claude expands edge cases** — boundary, error, security tests
5. **Claude runs the full suite** — verifies no regressions
6. **Claude updates TEST-SUMMARY.md** — keeps the doc in sync

### During Bug Fixes

1. **Claude writes a failing test** that reproduces the bug
2. **Claude fixes the code** to make the test pass
3. **Claude checks for related edge cases** — similar bugs nearby?
4. **Claude runs the full suite** — verifies fix + no regressions

### During Refactoring

1. **Claude runs the existing suite** — establishes green baseline
2. **Claude refactors** — changes implementation, not behaviour
3. **Claude runs the suite again** — all tests should still pass
4. If tests break → the refactoring changed behaviour → investigate

---

## Naming Conventions

### Test Files

```
src/lib/__tests__/[module].test.ts          # Library unit tests
src/lib/[feature]/__tests__/[module].test.ts # Feature-specific lib tests
src/app/api/[...path]/__tests__/route.test.ts # API route tests
src/components/__tests__/[Component].test.tsx # Component tests
```

### Describe/It Blocks

- **`describe`**: Name the feature, module, or API endpoint
- **`it`**: Start with a verb describing the behaviour ("requires", "creates", "rejects", "shows")
- Avoid "should" — just state what it does

```typescript
// Prefer:
it("requires authentication before processing", () => {});

// Avoid:
it("should return 401 when auth is missing", () => {});
```

---

## Test Helpers & BDD Utilities

### Location: `src/lib/__tests__/test-helpers.ts`

Shared mock factories maintain DRY test setup:

| Helper | Purpose |
|--------|---------|
| `mockGetRequest(url)` | Create NextRequest for GET with query params |
| `mockPostRequest(body)` | Create NextRequest for POST with JSON body |
| `mockPatchRequest(body)` | Create NextRequest for PATCH with JSON body |
| `mockAuthorized` | Pre-built authorized requireTier response |
| `mockUnauthorized` | Pre-built unauthorized requireTier response |
| `createMockSupabase(data, error)` | Chainable Supabase client mock |

### Location: `src/lib/__tests__/bdd-helpers.ts`

BDD-specific utilities (see below for implementation):

| Helper | Purpose |
|--------|---------|
| `scenario(name, fn)` | Alias for `describe` with scenario semantics |
| `given(description, fn)` | Setup block with clear given semantics |
| `when(description, fn)` | Action block |
| `then(description, fn)` | Assertion block |
| `Feature(name, fn)` | Top-level feature grouping |

---

## Quality Gates

Before merging any PR:

- [ ] All existing tests pass (`npm run test`)
- [ ] New tests written for new/changed behaviour
- [ ] Test names use business language (not implementation details)
- [ ] TEST-SUMMARY.md updated if test count changed significantly
- [ ] No `test.skip` or `test.todo` without a linked issue
- [ ] Build passes (`npm run build`)

---

## Metrics & Targets

| Metric | Current | Target (Q2 2026) |
|--------|---------|-------------------|
| Total tests | 238 | 400+ |
| Test files | 12 | 25+ |
| Behaviour specs (L1) | 98 | 150+ |
| API tests (L2) | 71 | 120+ |
| Component tests (L3) | 0 | 50+ |
| E2E tests (L4) | 0 | 10+ |
| Run time | ~2.5s | <5s |
| Build + test | ~45s | <60s |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-03-04 | Methodology adopted. Initial framework with 238 tests across 12 files. |
