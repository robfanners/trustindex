import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import {
  mockPostRequest,
} from "@/lib/__tests__/test-helpers";
import {
  mockApiHelpers,
  mockAudit,
  mockRequireAuthAuthorized,
  mockRequireAuthUnauthorized,
  createMockSupabase,
} from "@/lib/__tests__/mockAuth";

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the route.
// ---------------------------------------------------------------------------
mockApiHelpers();
mockAudit();
vi.mock("@/lib/runAdminTokensSchema", () => ({
  getRunAdminTokensColumnNames: vi.fn(async () => ({
    runIdCol: "run_id",
    tokenCol: "token",
  })),
}));

import { GET, POST } from "@/app/api/security/survey-tokens/route";
import { requireAuth } from "@/lib/apiHelpers";

// ---------------------------------------------------------------------------
// GET /api/security/survey-tokens
// ---------------------------------------------------------------------------
describe("GET /api/security/survey-tokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireAuthUnauthorized(requireAuth as unknown as Mock);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 200 with the caller's surveys and derived respondent_count", async () => {
    const rows = [
      {
        id: "run-1",
        title: "Q1 2026 governance survey",
        created_at: "2026-01-15T00:00:00Z",
        invites: [{ count: 42 }],
      },
      {
        id: "run-2",
        title: "Ethics baseline",
        created_at: "2026-02-01T00:00:00Z",
        invites: null,
      },
    ];

    const mockDb = createMockSupabase({ data: rows });
    // Route awaits `.order(...)` — override to be terminal for this test.
    mockDb.order.mockReturnValue(Promise.resolve({ data: rows, error: null }));
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, { db: mockDb });

    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.surveys).toHaveLength(2);
    expect(json.surveys[0]).toEqual({
      id: "run-1",
      title: "Q1 2026 governance survey",
      created_at: "2026-01-15T00:00:00Z",
      respondent_count: 42,
    });
    // Missing invites relation becomes count of 0.
    expect(json.surveys[1].respondent_count).toBe(0);
  });

  it("returns empty array when caller has no surveys", async () => {
    const mockDb = createMockSupabase({ data: [] });
    mockDb.order.mockReturnValue(Promise.resolve({ data: [], error: null }));
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, { db: mockDb });

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.surveys).toEqual([]);
  });

  it("returns 500 when the query errors", async () => {
    const mockDb = createMockSupabase({ data: null, error: { message: "boom" } });
    mockDb.order.mockReturnValue(
      Promise.resolve({ data: null, error: { message: "boom" } })
    );
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, { db: mockDb });

    const res = await GET();
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("boom");
  });
});

// ---------------------------------------------------------------------------
// POST /api/security/survey-tokens — rotation
// ---------------------------------------------------------------------------
describe("POST /api/security/survey-tokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireAuthUnauthorized(requireAuth as unknown as Mock);
    const req = mockPostRequest({ surveyIds: ["run-1"] });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when surveyIds is missing", async () => {
    const mockDb = createMockSupabase();
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, { db: mockDb });

    const req = mockPostRequest({});
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when surveyIds is empty array", async () => {
    const mockDb = createMockSupabase();
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, { db: mockDb });

    const req = mockPostRequest({ surveyIds: [] });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when none of the requested surveys belong to the caller", async () => {
    // ownership query returns empty.
    const mockDb = createMockSupabase();
    mockDb.in.mockReturnValue(
      Promise.resolve({ data: [], error: null })
    );
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, { db: mockDb });

    const req = mockPostRequest({ surveyIds: ["not-mine"] });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("returns 200 with rotation results for owned surveys", async () => {
    const owned = [
      { id: "run-1", title: "First survey" },
      { id: "run-2", title: "Second survey" },
    ];
    const mockDb = createMockSupabase();

    // ownership check terminates at `.in()`
    mockDb.in.mockReturnValueOnce(
      Promise.resolve({ data: owned, error: null })
    );
    // existing-row check terminates at `.limit()`
    mockDb.limit.mockReturnValue(
      Promise.resolve({ data: [{ run_id: "run-1" }], error: null })
    );
    // UPDATE chain terminates at `.single()` — already terminal in the
    // shared mock but we override to guarantee success shape.
    mockDb.single.mockReturnValue(
      Promise.resolve({ data: null, error: null })
    );

    mockRequireAuthAuthorized(requireAuth as unknown as Mock, { db: mockDb });

    const req = mockPostRequest({ surveyIds: ["run-1", "run-2"] });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.rotated).toBe(2);
    expect(json.results).toHaveLength(2);
    // Each result should have a fresh 28-char token.
    expect(json.results[0].newToken).toMatch(/^[a-zA-Z0-9]{28}$/);
    expect(json.results[0].id).toBe("run-1");
    expect(json.results[0].title).toBe("First survey");
  });
});
