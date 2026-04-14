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
  hashPayload: vi.fn(() => "0xabc123"),
  generateVerificationId: vi.fn(() => "VER-ABC12345"),
  anchorOnChain: vi.fn(() =>
    Promise.resolve({ txHash: null, status: "skipped" })
  ),
}));

import { GET, POST } from "@/app/api/prove/attestations/route";
import { requireAuth } from "@/lib/apiHelpers";

// ---------------------------------------------------------------------------
// POST /api/prove/attestations
// ---------------------------------------------------------------------------
describe("POST /api/prove/attestations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireAuthUnauthorized(requireAuth as unknown as Mock);

    const req = mockPostRequest({ title: "T", statement: "S" });
    const res = await POST(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Not authenticated");
  });

  it("returns 400 when no organisation linked", async () => {
    mockRequireAuthNoOrg(requireAuth as unknown as Mock);

    const req = mockPostRequest({ title: "T", statement: "S" });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("No organisation linked");
  });

  it("returns 400 when title is missing", async () => {
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, {
      db: createMockSupabase(),
    });

    const req = mockPostRequest({ statement: "Some statement" });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("returns 400 when title is empty string", async () => {
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, {
      db: createMockSupabase(),
    });

    const req = mockPostRequest({ title: "", statement: "Some statement" });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("returns 400 when statement is missing", async () => {
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, {
      db: createMockSupabase(),
    });

    const req = mockPostRequest({ title: "Some title" });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("returns 400 when statement is empty string", async () => {
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, {
      db: createMockSupabase(),
    });

    const req = mockPostRequest({ title: "Some title", statement: "" });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("returns 400 when both title and statement missing", async () => {
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, {
      db: createMockSupabase(),
    });

    const req = mockPostRequest({});
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 201 on valid input", async () => {
    const insertedRow = {
      id: "att-1",
      organisation_id: "org-456",
      title: "Our AI Ethics Policy",
      statement: "We commit to fair AI use",
      verification_id: "VER-ABC12345",
      event_hash: "0xabc123",
      chain_tx_hash: null,
      chain_status: "skipped",
    };

    const mockDb = createMockSupabase({ data: insertedRow });
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, { db: mockDb });

    const req = mockPostRequest({
      title: "Our AI Ethics Policy",
      statement: "We commit to fair AI use",
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.title).toBe("Our AI Ethics Policy");
    expect(json.verification_id).toBe("VER-ABC12345");
  });

  it("returns 201 with optional posture_snapshot", async () => {
    const insertedRow = {
      id: "att-2",
      title: "Policy Update",
      statement: "Updated statement",
      posture_snapshot: { score: 85 },
      verification_id: "VER-ABC12345",
    };

    const mockDb = createMockSupabase({ data: insertedRow });
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, { db: mockDb });

    const req = mockPostRequest({
      title: "Policy Update",
      statement: "Updated statement",
      posture_snapshot: { score: 85 },
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.posture_snapshot).toEqual({ score: 85 });
  });

  it("returns 500 when Supabase insert fails", async () => {
    const mockDb = createMockSupabase({
      data: null,
      error: { message: "DB insert failed" },
    });
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, { db: mockDb });

    const req = mockPostRequest({
      title: "Good title",
      statement: "Good statement",
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("DB insert failed");
  });
});

// ---------------------------------------------------------------------------
// GET /api/prove/attestations
// ---------------------------------------------------------------------------
describe("GET /api/prove/attestations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireAuthUnauthorized(requireAuth as unknown as Mock);

    const req = mockGetRequest("/api/prove/attestations");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it("returns 400 when no organisation linked", async () => {
    mockRequireAuthNoOrg(requireAuth as unknown as Mock);

    const req = mockGetRequest("/api/prove/attestations");
    const res = await GET(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("No organisation linked");
  });

  it("returns 200 with attestations array", async () => {
    const rows = [
      { id: "att-1", title: "Policy A" },
      { id: "att-2", title: "Policy B" },
    ];

    const mockDb = createMockSupabase({ data: rows, count: 2 });
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, { db: mockDb });

    const req = mockGetRequest("/api/prove/attestations?page=1&per_page=20");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.attestations).toHaveLength(2);
    expect(json.total).toBe(2);
  });

  it("returns empty array when no attestations exist", async () => {
    const mockDb = createMockSupabase({ data: [], count: 0 });
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, { db: mockDb });

    const req = mockGetRequest("/api/prove/attestations");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.attestations).toEqual([]);
    expect(json.total).toBe(0);
  });

  it("returns 500 when Supabase query fails", async () => {
    const mockDb = createMockSupabase({
      data: null,
      error: { message: "DB error" },
      count: null,
    });
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, { db: mockDb });

    const req = mockGetRequest("/api/prove/attestations");
    const res = await GET(req);

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("DB error");
  });
});
