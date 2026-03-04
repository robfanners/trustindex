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

import { GET, POST } from "@/app/api/prove/exchanges/route";
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
// POST /api/prove/exchanges
// ---------------------------------------------------------------------------
describe("POST /api/prove/exchanges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (requireTier as any).mockResolvedValue(mockUnauthorized);

    const req = mockPostRequest({
      proof_type: "attestation",
      proof_id: VALID_UUID,
      shared_with_name: "Auditor Inc",
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Not authenticated");
  });

  it("returns 400 when no organisation linked", async () => {
    (requireTier as any).mockResolvedValue(mockNoOrg);

    const req = mockPostRequest({
      proof_type: "attestation",
      proof_id: VALID_UUID,
      shared_with_name: "Auditor Inc",
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("No organisation linked");
  });

  it("returns 400 with invalid proof_type", async () => {
    (requireTier as any).mockResolvedValue(mockAuthorized);

    const req = mockPostRequest({
      proof_type: "invalid_type",
      proof_id: VALID_UUID,
      shared_with_name: "Auditor Inc",
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("returns 400 with missing shared_with_name", async () => {
    (requireTier as any).mockResolvedValue(mockAuthorized);

    const req = mockPostRequest({
      proof_type: "attestation",
      proof_id: VALID_UUID,
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("returns 400 with empty shared_with_name", async () => {
    (requireTier as any).mockResolvedValue(mockAuthorized);

    const req = mockPostRequest({
      proof_type: "attestation",
      proof_id: VALID_UUID,
      shared_with_name: "",
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 with missing proof_id", async () => {
    (requireTier as any).mockResolvedValue(mockAuthorized);

    const req = mockPostRequest({
      proof_type: "attestation",
      shared_with_name: "Auditor Inc",
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 with invalid proof_id (not UUID)", async () => {
    (requireTier as any).mockResolvedValue(mockAuthorized);

    const req = mockPostRequest({
      proof_type: "attestation",
      proof_id: "not-a-uuid",
      shared_with_name: "Auditor Inc",
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 with invalid shared_with_email", async () => {
    (requireTier as any).mockResolvedValue(mockAuthorized);

    const req = mockPostRequest({
      proof_type: "attestation",
      proof_id: VALID_UUID,
      shared_with_name: "Auditor Inc",
      shared_with_email: "not-an-email",
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 404 when proof record not found (attestation)", async () => {
    (requireTier as any).mockResolvedValue(mockAuthorized);

    // Proof lookup returns null
    const mockDb = createMockSupabase(null, null);
    (supabaseServer as any).mockReturnValue(mockDb);

    const req = mockPostRequest({
      proof_type: "attestation",
      proof_id: VALID_UUID,
      shared_with_name: "Auditor Inc",
    });
    const res = await POST(req);

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toContain("Proof record not found");
  });

  it("returns 404 when proof record not found (provenance)", async () => {
    (requireTier as any).mockResolvedValue(mockAuthorized);

    const mockDb = createMockSupabase(null, null);
    (supabaseServer as any).mockReturnValue(mockDb);

    const req = mockPostRequest({
      proof_type: "provenance",
      proof_id: VALID_UUID,
      shared_with_name: "Auditor Inc",
    });
    const res = await POST(req);

    expect(res.status).toBe(404);
  });

  it("returns 404 when proof record not found (incident_lock)", async () => {
    (requireTier as any).mockResolvedValue(mockAuthorized);

    const mockDb = createMockSupabase(null, null);
    (supabaseServer as any).mockReturnValue(mockDb);

    const req = mockPostRequest({
      proof_type: "incident_lock",
      proof_id: VALID_UUID,
      shared_with_name: "Auditor Inc",
    });
    const res = await POST(req);

    expect(res.status).toBe(404);
  });

  it("returns 201 on valid exchange with verify_url in response", async () => {
    (requireTier as any).mockResolvedValue(mockAuthorized);

    const proofLookup = {
      verification_id: "VER-ABCD1234",
      title: "Our Policy",
    };

    const exchangeRow = {
      id: "exc-1",
      organisation_id: "org-456",
      proof_type: "attestation",
      proof_id: VALID_UUID,
      verification_id: "VER-ABCD1234",
      shared_with_name: "Auditor Inc",
      shared_with_email: "auditor@example.com",
      note: "Please review",
      shared_by: "user-123",
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
          // First call: proof lookup
          return Promise.resolve({ data: proofLookup, error: null });
        }
        // Second call: exchange insert
        return Promise.resolve({ data: exchangeRow, error: null });
      }),
    };

    (supabaseServer as any).mockReturnValue(mockDb);

    const req = mockPostRequest({
      proof_type: "attestation",
      proof_id: VALID_UUID,
      shared_with_name: "Auditor Inc",
      shared_with_email: "auditor@example.com",
      note: "Please review",
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.verify_url).toBe("/verify/VER-ABCD1234");
    expect(json.shared_with_name).toBe("Auditor Inc");
  });

  it("returns 201 for provenance exchange", async () => {
    (requireTier as any).mockResolvedValue(mockAuthorized);

    const proofLookup = {
      verification_id: "VER-PROV1234",
      title: "AI Model Output",
    };

    const exchangeRow = {
      id: "exc-2",
      proof_type: "provenance",
      proof_id: VALID_UUID,
      verification_id: "VER-PROV1234",
      shared_with_name: "Regulator",
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
          return Promise.resolve({ data: proofLookup, error: null });
        }
        return Promise.resolve({ data: exchangeRow, error: null });
      }),
    };

    (supabaseServer as any).mockReturnValue(mockDb);

    const req = mockPostRequest({
      proof_type: "provenance",
      proof_id: VALID_UUID,
      shared_with_name: "Regulator",
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.verify_url).toBe("/verify/VER-PROV1234");
  });

  it("returns 500 when exchange insert fails", async () => {
    (requireTier as any).mockResolvedValue(mockAuthorized);

    const proofLookup = {
      verification_id: "VER-ABCD1234",
      title: "Our Policy",
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
          return Promise.resolve({ data: proofLookup, error: null });
        }
        return Promise.resolve({
          data: null,
          error: { message: "Insert failed" },
        });
      }),
    };

    (supabaseServer as any).mockReturnValue(mockDb);

    const req = mockPostRequest({
      proof_type: "attestation",
      proof_id: VALID_UUID,
      shared_with_name: "Auditor Inc",
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Insert failed");
  });
});

// ---------------------------------------------------------------------------
// GET /api/prove/exchanges
// ---------------------------------------------------------------------------
describe("GET /api/prove/exchanges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (requireTier as any).mockResolvedValue(mockUnauthorized);

    const req = mockGetRequest("/api/prove/exchanges");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it("returns 200 with exchanges array", async () => {
    (requireTier as any).mockResolvedValue(mockAuthorized);

    const rows = [
      { id: "exc-1", proof_type: "attestation" },
      { id: "exc-2", proof_type: "provenance" },
    ];

    const mockDb = createMockSupabase(rows);
    mockDb.range.mockResolvedValue({ data: rows, count: 2, error: null });
    (supabaseServer as any).mockReturnValue(mockDb);

    const req = mockGetRequest("/api/prove/exchanges");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.exchanges).toHaveLength(2);
    expect(json.total).toBe(2);
  });

  it("supports proof_type filter", async () => {
    (requireTier as any).mockResolvedValue(mockAuthorized);

    const rows = [{ id: "exc-1", proof_type: "attestation" }];
    const mockDb = createMockSupabase(rows);
    mockDb.range.mockResolvedValue({ data: rows, count: 1, error: null });
    (supabaseServer as any).mockReturnValue(mockDb);

    const req = mockGetRequest(
      "/api/prove/exchanges?proof_type=attestation"
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.exchanges).toHaveLength(1);
  });
});
