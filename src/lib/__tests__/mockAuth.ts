/**
 * mockAuth — single helper for mocking the post-TG-28 auth + supabase pattern.
 *
 * Routes now use:
 *   import { requireAuth, checkTierAccess } from "@/lib/apiHelpers";
 *   import { supabaseServer } from "@/lib/supabase/admin";
 *
 * requireAuth() returns { user, orgId, plan, db } on success or { error: NextResponse }.
 * checkTierAccess() returns undefined when allowed or NextResponse on deny.
 *
 * Usage in a test file:
 *
 *   import { vi } from "vitest";
 *   import { mockRequireAuthAuthorized, mockRequireAuthUnauthorized,
 *            mockRequireAuthNoOrg, mockApiHelpers,
 *            mockSupabaseAdmin } from "@/lib/__tests__/mockAuth";
 *
 *   mockApiHelpers();        // vi.mock @/lib/apiHelpers
 *   mockSupabaseAdmin();     // vi.mock @/lib/supabase/admin
 *
 *   // Then in a test:
 *   mockRequireAuthAuthorized({ db: mockDb });
 *
 * All mocks are hoisted by vitest (vi.mock is hoisted automatically).
 */

import { vi } from "vitest";
import { NextResponse } from "next/server";
import type { Mock } from "vitest";

// ---------------------------------------------------------------------------
// Canonical identity fixtures
// ---------------------------------------------------------------------------

export const TEST_USER_ID = "user-123";
export const TEST_ORG_ID = "org-456";

export const testUser = {
  id: TEST_USER_ID,
  email: "test@example.com",
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: new Date().toISOString(),
} as const;

// ---------------------------------------------------------------------------
// Module mockers — call these once per test file, before the route import.
// vi.mock is hoisted, so call-site position doesn't matter.
// ---------------------------------------------------------------------------

/** Mock @/lib/apiHelpers so requireAuth / checkTierAccess are controllable. */
export function mockApiHelpers() {
  vi.mock("@/lib/apiHelpers", async () => {
    const actual = await vi.importActual<typeof import("@/lib/apiHelpers")>(
      "@/lib/apiHelpers"
    );
    return {
      ...actual,
      requireAuth: vi.fn(),
      checkTierAccess: vi.fn(() => undefined),
    };
  });
}

/** Mock @/lib/supabase/admin for public/no-auth routes that call supabaseServer() directly. */
export function mockSupabaseAdmin() {
  vi.mock("@/lib/supabase/admin", () => ({
    supabaseServer: vi.fn(),
  }));
}

/** Mock @/lib/audit — writeAuditLog is fire-and-forget; return undefined. */
export function mockAudit() {
  vi.mock("@/lib/audit", () => ({
    writeAuditLog: vi.fn(async () => undefined),
  }));
}

// ---------------------------------------------------------------------------
// requireAuth() return-value builders
// ---------------------------------------------------------------------------

type AuthorizedOptions = {
  db: unknown;
  plan?: string;
  orgId?: string;
  user?: typeof testUser;
};

/** Build the success shape: { user, orgId, plan, db } */
export function buildAuthorized(opts: AuthorizedOptions) {
  return {
    user: opts.user ?? testUser,
    orgId: opts.orgId ?? TEST_ORG_ID,
    plan: opts.plan ?? "enterprise",
    db: opts.db,
  };
}

/** Build the failure shape: { error: NextResponse } */
export function buildAuthError(message: string, status: number) {
  return {
    error: NextResponse.json({ error: message }, { status }),
  };
}

// ---------------------------------------------------------------------------
// Mock-setters — use inside individual tests
// ---------------------------------------------------------------------------

/** Set requireAuth to return an authorized response. */
export function mockRequireAuthAuthorized(
  requireAuthMock: Mock,
  opts: AuthorizedOptions
) {
  requireAuthMock.mockResolvedValue(buildAuthorized(opts));
}

/** Set requireAuth to return a 401 unauthenticated response. */
export function mockRequireAuthUnauthorized(requireAuthMock: Mock) {
  requireAuthMock.mockResolvedValue(buildAuthError("Not authenticated", 401));
}

/** Set requireAuth to return a 400 "No organisation linked" response. */
export function mockRequireAuthNoOrg(requireAuthMock: Mock) {
  requireAuthMock.mockResolvedValue(
    buildAuthError("No organisation linked", 400)
  );
}

// ---------------------------------------------------------------------------
// Chainable Supabase mock — covers the common query shapes used across routes
// ---------------------------------------------------------------------------

type MockSupabaseOptions = {
  /** Row(s) returned by terminal methods (single, range, maybeSingle). */
  data?: unknown;
  /** Error object returned alongside data. */
  error?: unknown;
  /** Explicit count for head-count queries. */
  count?: number | null;
};

export type ChainableMock = {
  from: Mock;
  select: Mock;
  insert: Mock;
  update: Mock;
  delete: Mock;
  eq: Mock;
  neq: Mock;
  gte: Mock;
  lte: Mock;
  in: Mock;
  order: Mock;
  limit: Mock;
  range: Mock;
  single: Mock;
  maybeSingle: Mock;
};

/**
 * Create a chainable Supabase mock. Every method returns `self` so `.from().select().eq()...`
 * works; terminal methods (`single`, `maybeSingle`, `range`) resolve to `{ data, error, count }`.
 *
 * For tests needing branching behaviour (e.g. two `.from()` calls returning different
 * data), use `.mockImplementationOnce()` on the returned mock.
 */
export function createMockSupabase(options: MockSupabaseOptions = {}): ChainableMock {
  const { data = null, error = null, count = null } = options;
  const resolved = Promise.resolve({
    data,
    error,
    count:
      count ?? (Array.isArray(data) ? data.length : data == null ? 0 : 1),
  });

  const self: Partial<ChainableMock> = {};
  const chain = () => self as ChainableMock;

  self.from = vi.fn(chain);
  self.select = vi.fn(chain);
  self.insert = vi.fn(chain);
  self.update = vi.fn(chain);
  self.delete = vi.fn(chain);
  self.eq = vi.fn(chain);
  self.neq = vi.fn(chain);
  self.gte = vi.fn(chain);
  self.lte = vi.fn(chain);
  self.in = vi.fn(chain);
  self.order = vi.fn(chain);
  self.limit = vi.fn(chain);
  // Terminal-ish methods: return a thenable that also exposes chain methods.
  // Tests that need plain terminal values can override with mockResolvedValue.
  self.range = vi.fn(() => resolved);
  self.single = vi.fn(() => resolved);
  self.maybeSingle = vi.fn(() => resolved);

  return self as ChainableMock;
}
