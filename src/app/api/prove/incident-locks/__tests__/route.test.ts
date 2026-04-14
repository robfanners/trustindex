import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import {
  mockPostRequest,
  mockGetRequest,
} from "@/lib/__tests__/test-helpers";
import {
  mockApiHelpers,
  mockAudit,
  mockRequireAuthAuthorized,
  mockRequireAuthUnauthorized,
  mockRequireAuthNoOrg,
  createMockSupabase,
} from "@/lib/__tests__/mockAuth";

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the route (vi.mock is hoisted).
// ---------------------------------------------------------------------------
mockApiHelpers();
mockAudit();
vi.mock("@/lib/prove/chain", () => ({
  hashPayload: vi.fn(() => "0xdef456"),
  generateVerificationId: vi.fn(() => "VER-DEF45678"),
  anchorOnChain: vi.fn(() =>
    Promise.resolve({ txHash: null, status: "skipped" })
  ),
}));

import { GET, POST } from "@/app/api/prove/incident-locks/route";
import { requireAuth } from "@/lib/apiHelpers";

const VALID_UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

// ---------------------------------------------------------------------------
// POST /api/prove/incident-locks
// ---------------------------------------------------------------------------
describe("POST /api/prove/incident-locks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireAuthUnauthorized(requireAuth as unknown as Mock);

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
    mockRequireAuthNoOrg(requireAuth as unknown as Mock);

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
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, {
      db: createMockSupabase(),
    });

    const req = mockPostRequest({ lock_reason: "Compliance freeze" });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("returns 400 when lock_reason is missing", async () => {
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, {
      db: createMockSupabase(),
    });

    const req = mockPostRequest({ incident_id: VALID_UUID });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("returns 400 when lock_reason is empty string", async () => {
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, {
      db: createMockSupabase(),
    });

    const req = mockPostRequest({
      incident_id: VALID_UUID,
      lock_reason: "",
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 when incident_id is not a valid UUID", async () => {
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, {
      db: createMockSupabase(),
    });

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
    const mockDb = createMockSupabase({ data: null });
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, { db: mockDb });

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
    const mockDb = createMockSupabase({
      data: null,
      error: { message: "not found" },
    });
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, { db: mockDb });

    const req = mockPostRequest({
      incident_id: VALID_UUID,
      lock_reason: "Compliance freeze",
    });
    const res = await POST(req);

    expect(res.status).toBe(404);
  });

  it("returns 201 on valid input", async () => {
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

    let callCount = 0;
    const mockDb = createMockSupabase();
    mockDb.single = vi.fn(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ data: incidentData, error: null, count: 1 });
      }
      return Promise.resolve({ data: lockRow, error: null, count: 1 });
    }) as Mock;

    mockRequireAuthAuthorized(requireAuth as unknown as Mock, { db: mockDb });

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
    const mockDb = createMockSupabase();
    mockDb.single = vi.fn(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ data: incidentData, error: null, count: 1 });
      }
      return Promise.resolve({
        data: null,
        error: { message: "Insert failed" },
        count: 0,
      });
    }) as Mock;

    mockRequireAuthAuthorized(requireAuth as unknown as Mock, { db: mockDb });

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
//
// The route builds a query ending with `.range(...)` and optionally adds
// `.eq("incident_id", ...)` on top, then awaits the whole thing. So the
// chainable must be both thenable and support `.eq()` after `.range()`.
// We build a dedicated mock here rather than contort createMockSupabase.
// ---------------------------------------------------------------------------
describe("GET /api/prove/incident-locks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireAuthUnauthorized(requireAuth as unknown as Mock);

    const req = mockGetRequest("/api/prove/incident-locks");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  function makeThenableChain(result: {
    data: unknown;
    count: number | null;
    error: unknown;
  }) {
    const chain: Record<string, unknown> & {
      from: Mock;
      select: Mock;
      eq: Mock;
      order: Mock;
      range: Mock;
      then: (
        resolve: (value: unknown) => void
      ) => void;
    } = {
      from: vi.fn(() => chain),
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      order: vi.fn(() => chain),
      range: vi.fn(() => chain),
      then: (resolve) => resolve(result),
    };
    return chain;
  }

  it("returns 200 with locks array", async () => {
    const rows = [{ id: "lock-1" }, { id: "lock-2" }];
    const mockDb = makeThenableChain({ data: rows, count: 2, error: null });
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, { db: mockDb });

    const req = mockGetRequest("/api/prove/incident-locks?page=1");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.locks).toHaveLength(2);
    expect(json.total).toBe(2);
  });

  it("returns 200 when filtering by incident_id", async () => {
    const rows = [{ id: "lock-1", incident_id: VALID_UUID }];
    const mockDb = makeThenableChain({ data: rows, count: 1, error: null });
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, { db: mockDb });

    const req = mockGetRequest(
      `/api/prove/incident-locks?incident_id=${VALID_UUID}`
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.locks).toHaveLength(1);
  });
});
