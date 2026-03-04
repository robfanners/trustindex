import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import {
  mockPostRequest,
  mockGetRequest,
  mockAuthorized,
  createMockSupabase,
} from "@/lib/__tests__/test-helpers";

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the route
// ---------------------------------------------------------------------------
vi.mock("@/lib/requireTier", () => ({
  requireTier: vi.fn(),
}));
vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: vi.fn(),
}));
vi.mock("@/lib/prove/chain", () => ({
  hashPayload: vi.fn(() => "0xdef456"),
  generateVerificationId: vi.fn(() => "VER-DEF45678"),
  anchorOnChain: vi.fn(() =>
    Promise.resolve({ txHash: null, status: "skipped" })
  ),
}));

import { GET, POST } from "@/app/api/prove/incident-locks/route";
import { requireTier } from "@/lib/requireTier";
import { supabaseServer } from "@/lib/supabaseServer";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const mockUnauthorized = {
  authorized: false as const,
  response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
};

const mockNoOrg = {
  authorized: true as const,
  userId: "user-123",
  plan: "enterprise",
  orgId: null,
};

const VALID_UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

// ---------------------------------------------------------------------------
// POST /api/prove/incident-locks
// ---------------------------------------------------------------------------
describe("POST /api/prove/incident-locks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (requireTier as any).mockResolvedValue(mockUnauthorized);

    const req = mockPostRequest({
      incident_id: VALID_UUID,
      lock_reason: "Compliance freeze",
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Not authenticated");
  });

  it("returns 400 when no organisation linked", async () => {
    (requireTier as any).mockResolvedValue(mockNoOrg);

    const req = mockPostRequest({
      incident_id: VALID_UUID,
      lock_reason: "Compliance freeze",
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("No organisation linked");
  });

  it("returns 400 when incident_id is missing", async () => {
    (requireTier as any).mockResolvedValue(mockAuthorized);

    const req = mockPostRequest({ lock_reason: "Compliance freeze" });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("returns 400 when lock_reason is missing", async () => {
    (requireTier as any).mockResolvedValue(mockAuthorized);

    const req = mockPostRequest({ incident_id: VALID_UUID });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("returns 400 when lock_reason is empty string", async () => {
    (requireTier as any).mockResolvedValue(mockAuthorized);

    const req = mockPostRequest({
      incident_id: VALID_UUID,
      lock_reason: "",
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 when incident_id is not a valid UUID", async () => {
    (requireTier as any).mockResolvedValue(mockAuthorized);

    const req = mockPostRequest({
      incident_id: "not-a-uuid",
      lock_reason: "Compliance freeze",
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("returns 404 when incident not found", async () => {
    (requireTier as any).mockResolvedValue(mockAuthorized);

    // First call: incident lookup returns null
    const mockDb = createMockSupabase(null, null);
    (supabaseServer as any).mockReturnValue(mockDb);

    const req = mockPostRequest({
      incident_id: VALID_UUID,
      lock_reason: "Compliance freeze",
    });
    const res = await POST(req);

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toContain("Incident not found");
  });

  it("returns 404 when incident lookup returns error", async () => {
    (requireTier as any).mockResolvedValue(mockAuthorized);

    const mockDb = createMockSupabase(null, { message: "not found" });
    (supabaseServer as any).mockReturnValue(mockDb);

    const req = mockPostRequest({
      incident_id: VALID_UUID,
      lock_reason: "Compliance freeze",
    });
    const res = await POST(req);

    expect(res.status).toBe(404);
  });

  it("returns 201 on valid input", async () => {
    (requireTier as any).mockResolvedValue(mockAuthorized);

    const incidentData = {
      title: "Data breach incident",
      description: "Unauthorized access detected",
      impact_level: "high",
      status: "resolved",
      resolution: "Access revoked",
      reported_by: "user-123",
      created_at: "2026-01-01T00:00:00Z",
      resolved_at: "2026-01-02T00:00:00Z",
    };

    const lockRow = {
      id: "lock-1",
      organisation_id: "org-456",
      incident_id: VALID_UUID,
      lock_reason: "Regulatory requirement",
      verification_id: "VER-DEF45678",
      event_hash: "0xdef456",
      chain_tx_hash: null,
      chain_status: "skipped",
    };

    // The route makes two DB calls: first .single() for incident lookup,
    // then .single() for insert. We need the mock to return different data.
    let callCount = 0;
    const mockDb: any = {
      from: vi.fn(() => mockDb),
      select: vi.fn(() => mockDb),
      insert: vi.fn(() => mockDb),
      eq: vi.fn(() => mockDb),
      single: vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          // First call: incident lookup
          return Promise.resolve({ data: incidentData, error: null });
        }
        // Second call: lock insert
        return Promise.resolve({ data: lockRow, error: null });
      }),
    };

    (supabaseServer as any).mockReturnValue(mockDb);

    const req = mockPostRequest({
      incident_id: VALID_UUID,
      lock_reason: "Regulatory requirement",
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.verification_id).toBe("VER-DEF45678");
    expect(json.lock_reason).toBe("Regulatory requirement");
  });

  it("returns 500 when lock insert fails", async () => {
    (requireTier as any).mockResolvedValue(mockAuthorized);

    const incidentData = {
      title: "Some incident",
      description: "Desc",
      impact_level: "low",
      status: "open",
      resolution: null,
      reported_by: "user-123",
      created_at: "2026-01-01T00:00:00Z",
      resolved_at: null,
    };

    let callCount = 0;
    const mockDb: any = {
      from: vi.fn(() => mockDb),
      select: vi.fn(() => mockDb),
      insert: vi.fn(() => mockDb),
      eq: vi.fn(() => mockDb),
      single: vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ data: incidentData, error: null });
        }
        return Promise.resolve({
          data: null,
          error: { message: "Insert failed" },
        });
      }),
    };

    (supabaseServer as any).mockReturnValue(mockDb);

    const req = mockPostRequest({
      incident_id: VALID_UUID,
      lock_reason: "Regulatory requirement",
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Insert failed");
  });
});

// ---------------------------------------------------------------------------
// GET /api/prove/incident-locks
// ---------------------------------------------------------------------------
describe("GET /api/prove/incident-locks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (requireTier as any).mockResolvedValue(mockUnauthorized);

    const req = mockGetRequest("/api/prove/incident-locks");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it("returns 200 with locks array", async () => {
    (requireTier as any).mockResolvedValue(mockAuthorized);

    const rows = [{ id: "lock-1" }, { id: "lock-2" }];
    const mockDb = createMockSupabase(rows);
    // GET uses a query that may end with .eq() for incident_id filter then awaits
    // The query chain ends at range() or resolves the full query
    mockDb.range.mockResolvedValue({ data: rows, count: 2, error: null });
    (supabaseServer as any).mockReturnValue(mockDb);

    const req = mockGetRequest("/api/prove/incident-locks?page=1");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.locks).toHaveLength(2);
    expect(json.total).toBe(2);
  });

  it("returns 200 when filtering by incident_id", async () => {
    (requireTier as any).mockResolvedValue(mockAuthorized);

    const rows = [{ id: "lock-1", incident_id: VALID_UUID }];

    // The GET route calls .range() then optionally .eq() on the result.
    // range() must return a chainable+thenable, not a plain Promise,
    // because .eq() is called on its return value when incident_id is present.
    const result = { data: rows, count: 1, error: null };
    const mockDb: any = {
      from: vi.fn(() => mockDb),
      select: vi.fn(() => mockDb),
      eq: vi.fn(() => mockDb),
      order: vi.fn(() => mockDb),
      range: vi.fn(() => mockDb),
      // Make the chainable thenable so `await query` resolves
      then: vi.fn((resolve: any) => resolve(result)),
    };

    (supabaseServer as any).mockReturnValue(mockDb);

    const req = mockGetRequest(
      `/api/prove/incident-locks?incident_id=${VALID_UUID}`
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.locks).toHaveLength(1);
  });
});
