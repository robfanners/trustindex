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

import { GET, POST } from "@/app/api/prove/exchanges/route";
import { requireAuth } from "@/lib/apiHelpers";

const VALID_UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

// ---------------------------------------------------------------------------
// POST /api/prove/exchanges
// ---------------------------------------------------------------------------
describe("POST /api/prove/exchanges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireAuthUnauthorized(requireAuth as unknown as Mock);

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
    mockRequireAuthNoOrg(requireAuth as unknown as Mock);

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
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, {
      db: createMockSupabase(),
    });

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
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, {
      db: createMockSupabase(),
    });

    const req = mockPostRequest({
      proof_type: "attestation",
      proof_id: VALID_UUID,
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 with empty shared_with_name", async () => {
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, {
      db: createMockSupabase(),
    });

    const req = mockPostRequest({
      proof_type: "attestation",
      proof_id: VALID_UUID,
      shared_with_name: "",
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 with missing proof_id", async () => {
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, {
      db: createMockSupabase(),
    });

    const req = mockPostRequest({
      proof_type: "attestation",
      shared_with_name: "Auditor Inc",
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 with invalid proof_id (not UUID)", async () => {
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, {
      db: createMockSupabase(),
    });

    const req = mockPostRequest({
      proof_type: "attestation",
      proof_id: "not-a-uuid",
      shared_with_name: "Auditor Inc",
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 with invalid shared_with_email", async () => {
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, {
      db: createMockSupabase(),
    });

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
    // Proof lookup returns null → verificationId null → 404
    const mockDb = createMockSupabase({ data: null });
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, { db: mockDb });

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
    const mockDb = createMockSupabase({ data: null });
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, { db: mockDb });

    const req = mockPostRequest({
      proof_type: "provenance",
      proof_id: VALID_UUID,
      shared_with_name: "Auditor Inc",
    });
    const res = await POST(req);

    expect(res.status).toBe(404);
  });

  it("returns 404 when proof record not found (incident_lock)", async () => {
    const mockDb = createMockSupabase({ data: null });
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, { db: mockDb });

    const req = mockPostRequest({
      proof_type: "incident_lock",
      proof_id: VALID_UUID,
      shared_with_name: "Auditor Inc",
    });
    const res = await POST(req);

    expect(res.status).toBe(404);
  });

  it("returns 201 on valid exchange with verify_url in response", async () => {
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

    // Two-call sequencing: first .single() returns proof lookup, second returns insert result
    let callCount = 0;
    const mockDb = createMockSupabase();
    mockDb.single = vi.fn(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ data: proofLookup, error: null, count: 1 });
      }
      return Promise.resolve({ data: exchangeRow, error: null, count: 1 });
    }) as Mock;

    mockRequireAuthAuthorized(requireAuth as unknown as Mock, { db: mockDb });

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
    const mockDb = createMockSupabase();
    mockDb.single = vi.fn(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ data: proofLookup, error: null, count: 1 });
      }
      return Promise.resolve({ data: exchangeRow, error: null, count: 1 });
    }) as Mock;

    mockRequireAuthAuthorized(requireAuth as unknown as Mock, { db: mockDb });

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
    const proofLookup = {
      verification_id: "VER-ABCD1234",
      title: "Our Policy",
    };

    let callCount = 0;
    const mockDb = createMockSupabase();
    mockDb.single = vi.fn(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ data: proofLookup, error: null, count: 1 });
      }
      return Promise.resolve({
        data: null,
        error: { message: "Insert failed" },
        count: 0,
      });
    }) as Mock;

    mockRequireAuthAuthorized(requireAuth as unknown as Mock, { db: mockDb });

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
    mockRequireAuthUnauthorized(requireAuth as unknown as Mock);

    const req = mockGetRequest("/api/prove/exchanges");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it("returns 200 with exchanges array", async () => {
    const rows = [
      { id: "exc-1", proof_type: "attestation" },
      { id: "exc-2", proof_type: "provenance" },
    ];

    const mockDb = createMockSupabase({ data: rows, count: 2 });
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, { db: mockDb });

    const req = mockGetRequest("/api/prove/exchanges");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.exchanges).toHaveLength(2);
    expect(json.total).toBe(2);
  });

  it("supports proof_type filter", async () => {
    const rows = [{ id: "exc-1", proof_type: "attestation" }];
    const mockDb = createMockSupabase({ data: rows, count: 1 });
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, { db: mockDb });

    const req = mockGetRequest(
      "/api/prove/exchanges?proof_type=attestation"
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.exchanges).toHaveLength(1);
  });
});
